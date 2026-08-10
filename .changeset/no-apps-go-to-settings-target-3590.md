---
'@object-ui/app-shell': patch
---

Point the "System Settings" entries at the system hub `/apps/setup/system` instead of the bare `/apps/setup` (objectui#3590).

`AppContent` mounts the system hub only under `isSystemRoute`, which keys on a `/system` path segment. A bare `/apps/setup` therefore matched no pseudo-route except `isSetupRoute` and fell back into the "No Apps Configured" guard — i.e. on a zero-app deployment it *is* that empty state's own URL, so the empty state's `go-to-settings-btn` re-rendered the very screen it sits on. Retargeted three call sites: the empty state's CTA, `AppSidebar`'s no-active-app `sys-settings` fallback entry, and `UnifiedSidebar`'s `/home` Administration `sys-settings` entry. Every sibling entry in both clusters already spelled `/apps/setup/system/...`.
