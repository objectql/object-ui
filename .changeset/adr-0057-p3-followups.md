---
"@object-ui/app-shell": patch
---

feat(console-ai): ChatDock follow-ups — mobile sheet, wide side-by-side properties, exact collapse landing (ADR-0057 P3)

- Under `md` the dock presents as a bottom sheet (`ChatDockMobileSheet`) —
  console FAB opens it; Studio gets a mobile-visible edge launcher.
- The folded Studio layout keeps canvas AND properties side by side on 2xl+
  viewports; tabs (and their auto-switch) only exist where width forces them.
- Folded tabs mode flattens the source page's nested Source/Props tabs — the
  Properties tab body is the code editor directly.
- Maximize remembers its origin, so `/ai`'s collapse-to-dock returns to the
  exact page (console or Studio) the user left, immune to history churn.
- The dock's conversation honors `app.defaultAgent` via the one resolver,
  matching the FAB's behavior.
