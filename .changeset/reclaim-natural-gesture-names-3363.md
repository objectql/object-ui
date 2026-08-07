---
"@object-ui/types": minor
"@object-ui/mobile": minor
---

Reclaim the natural names `GestureType` and `GestureConfig` (objectui#3363).

`@objectstack/spec` 17.0.0-rc.3 deleted the whole `ui/touch` module
(objectstack#4988, PR objectstack#5321), vacating three names objectui had
renamed **away from** in objectstack#4115 purely to avoid a collision. Two of
those workarounds have now outlived their reason and are undone.

## Breaking, in FROM → TO form

- `TouchGestureType` → **`GestureType`** — objectui's direction-fused recogniser
  vocabulary (`tap`, `swipe-left`, `swipe-up`, …).
- `TouchGestureConfig` → **`GestureConfig`** — the flat gesture→`action` handler
  binding.

Both are exported from `@object-ui/types` and re-exported by `@object-ui/mobile`.
Nothing about either shape changed: same members, same optionality. Consumers
import the new name; there is no other edit.

**The old names are gone, not deprecated.** This follows the precedent set by the
objectstack#4115 rename batch that introduced them, whose own migration note reads:
"an alias would preserve exactly the ambiguity being removed". A deprecated alias
would be worse here than in the general case, because the ambiguity these renames
exist to prevent is between two same-named types — leaving `TouchGestureType`
alive next to `GestureType` restores the two-spellings-one-concept problem while
claiming to retire it.

The retired spec vocabulary that used to hold these names still lives in
`@object-ui/types`' `mobile` module under its deliberate `Spec…` prefix
(`SpecGestureType`, `SpecGestureConfig`, `SwipeGestureConfig`, …), and that prefix
is untouched — it is now the only thing distinguishing the two contracts, so
`useSpecGesture` still maps one onto the other exactly as before.

## `PWAOfflineConfig` is deliberately NOT reclaimed

The spec vacated `OfflineConfig` in the same retirement, but the spec was never
its only claimant: that rename was a **cross-package arbitration between two
objectui packages**, and `@object-ui/react` won it. `useOffline`'s config is the
offline data/sync model key for key, so it holds the bare `OfflineConfig`, while
this package's service-worker route cache stays `PWAOfflineConfig`
(objectui#3156 / objectui#3159).

Before objectui#3560 that name reached `@object-ui/react` from the spec, so the
spec-side tripwire covered it by accident. Since the retirement it is declared
locally in `packages/react/src/hooks/useOffline.ts`, which means the spec's
vacancy no longer says anything about whether the name is free — it is not.
Reclaiming it would put two different `OfflineConfig` shapes on the public
surface of two packages that are routinely imported together, which is the exact
ambiguity objectstack#4115 renamed it away from.

`page-nav-misc-spec-parity.test.ts` now pins that reason directly instead of
leaving it as prose: it asserts `@object-ui/react` still declares
`OfflineConfig`, and its failure message tells the next reader that the reclaim
has become available if it ever stops.
