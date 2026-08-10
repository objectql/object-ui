---
'@object-ui/app-shell': patch
---

Point the four remaining "Settings" senders at the system hub `/apps/setup/system` instead of the bare `/apps/setup` (objectui#3611).

Same root cause as objectui#3590, which fixed the three call sites inside its declared file surface: `AppContent` mounts the system hub only under `isSystemRoute`, which keys on a `/system` path segment, so on a zero-app deployment the bare `/apps/setup` *is* the "No Apps Configured" empty state's own URL and every entry spelling it looped in place.

Three of the four are live defects, all reachable on a zero-app deployment today:

- `AppSidebar`'s no-active-app sidebar header (`system-sidebar-header`) — the sharpest of them, since it renders *only* when there is no active app, i.e. it was unreachable except in exactly the state where its target was broken.
- `AppSidebar`'s user-menu "Settings" entry.
- `SystemRedirect`'s bare `/system` legacy bookmark. This forwarder was already half right — every *suffixed* bookmark (`/system/users`) was correctly rewritten to `/apps/setup/system/users`, and only the bare one dropped the `system` segment. The bare branch now agrees with the suffixed branch beside it; no new logic.

The fourth, `QuickActions`' "System Settings" card, is dormant — the component has zero JSX call sites repo-wide, so no user can reach it today. It is corrected in the same pass so the dead link cannot return with the component if it is ever remounted.
