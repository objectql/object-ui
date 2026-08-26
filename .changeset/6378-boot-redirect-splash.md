---
'@object-ui/app-shell': patch
'@object-ui/console': patch
---

The console boot no longer flashes a fully-white frame after the splash has painted
(objectui#6378).

Cause, established by measurement before any fix was written — the card named
`LoadingScreen`'s unmount timing and `RouteFader` as suspects and both are exonerated.
A CDP `Page.startScreencast` frame ledger (every frame classified with the card's own
rule: white when no colour channel falls below 242) was correlated against a DOM-state
ledger on the same clock (`performance.timeOrigin`), against the production
`apps/console` bundle with the boot endpoints mocked. `RouteFader` never mounts on the
boot path at all, and `LoadingScreen` unmounts exactly when its own gate says to. What
is wrong is what REPLACES it: every readiness gate renders the splash while it waits and
a bare `<Navigate>` the moment it decides. `<Navigate>` renders `null` and react-router
runs the navigation as a transition, so the destination tree renders while the commit
that already dropped the splash is what the compositor is showing — 41–147 ms during
which `#root` holds no view and the viewport is the bare page background. The flash is
intermittent only because it depends on a frame being swapped inside that window; the
window itself was present on every measured boot.

`RedirectWithSplash` (new, `@object-ui/app-shell`) pairs the same `<Navigate>` with the
same `LoadingScreen` the gate one line above was already rendering, so the handoff
changes no pixels and the transition runs underneath an unchanged screen. The console's
three boot redirects use it: the auth gate's `/login` bounce, the `/` landing resolver,
and the catch-all route. The nested organization `index` redirect deliberately does not —
it fires under an already-painted layout, where covering the screen would be the
regression.

Rate over the campaign that accepts this, same instrument on both sides, arms interleaved
in one process so machine load lands on both equally: the empty-viewport window is
present on 100% of pre-fix boots and 0% after, and the white frame itself goes from a
substantial minority of pre-fix boots to none. `e2e/console-boot-indicator.spec.ts` gains
the deterministic half as a gate — after React's first commit the viewport centre must
never stop being covered — and it is red on the pre-fix build on every run.
