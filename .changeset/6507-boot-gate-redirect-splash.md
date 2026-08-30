---
'@object-ui/app-shell': patch
---

Keep the boot splash painted across seven more console redirects (objectui#6507)

Every readiness gate on the console boot path renders `LoadingScreen` while it
waits and a bare `Navigate` the moment it decides. `Navigate` renders null and
react-router runs the navigation as a transition, so the destination tree
renders while the commit that already dropped the splash is what the compositor
shows — measured at 41-147 ms of empty `#root` on the three sibling gates
objectui#6506 fixed.

Converted to `RedirectWithSplash`, which pairs the same navigation with the same
`LoadingScreen` so the handoff changes no pixels:

- `RequireOrganization` — both decisions (orgs exist but none active; no org at
  all with multi-org enabled)
- `RequireAiSurface` — a runtime that serves no agent
- `AuthenticatedRoute` — the signed-out fallback (published for consumers;
  `apps/console` converted its own `ProtectedRoute` copy under objectui#6506)
- `RootRedirect` — byte-for-byte the shape that measured the widest window
- `SetupRedirect` — the `/setup` deep link
- `AppContent` — the no-accessible-app bounce, which returns above the single
  `ConsoleLayout` mount

`SystemRedirect` is deliberately left as a bare `Navigate`. It carries the same
shape on a first navigation, but it is the only site in this set that also fires
with the console already painted (`SettingsView` navigates to `/system/settings`
from a button; `AppSidebar` links to `/system`), and a redirect firing under an
already-painted layout must keep that layout rather than gain a splash. The five
URL-rewrite redirects in `AppContent` are excluded for the same reason.
