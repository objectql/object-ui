---
"@object-ui/app-shell": minor
---

feat(studio): add a "Local / Custom (this env)" scope to the package selector

In a self-hosted, metadata-customizable environment (single-tenant — no org
dimension), the package selector only listed code packages, so metadata authored
at runtime (`package_id = null` / `sys_metadata` provenance) was filtered out of
every code-package view and became un-navigable — opening such an item redirected
to "new". This complements framework #2252 + objectui #1937, which stop runtime
metadata from being stamped into a loaded code package and keep it editable.

- Surface a stable, always-present "Local / Custom (this env)" entry in the
  Studio package context-selector (`ContextSelectors`), mapped to the
  `sys_metadata` scope the metadata list/get API already understands.
- Accept that scope in the metadata-admin pages (`StudioHomePage`,
  `DirectoryPage`, `ResourceListPage`) via a shared `buildPackageScopeOptions`
  helper, so it no longer redirects, and the list shows this environment's
  runtime-authored items (`package_id = null`).
- On the Studio home grid, the Local scope shows every runtime-creatable type so
  the user can start authoring locally even with zero items yet.
