---
"@object-ui/app-shell": patch
---

Setup-app UX fixes from a system-settings review:

- `sys_team` now shows an accurate empty state ("No teams yet" — create one with Create Team, or they arrive via org/SSO provisioning) instead of the generic better-auth "these records … are not added by hand here" copy, which flatly contradicted the visible Create Team button.
- The form renderer no longer spreads `objectName` / `onDirtyChange` (and other FormSchema-only props) onto its `<form>` DOM element, removing the `React does not recognize the objectName prop` / `Unknown event handler property onDirtyChange` warnings logged on every object list view.
