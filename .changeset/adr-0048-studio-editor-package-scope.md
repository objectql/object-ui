---
"@object-ui/data-objectstack": patch
"@object-ui/app-shell": patch
---

ADR-0048: package-scope the Studio metadata editor read. Two installed packages
may ship metadata with the same `type`/`name`; the editor now resolves the right
one instead of first-match.

- `MetadataClient`: `layered()` and `getDraft()` accept `{ packageId }`, and
  `get()` emits the `package` query param (→ server prefer-local, `?package=`).
- `ResourceListPage`: each item's edit link carries its owning package
  (`?package=<row._packageId>`), so even the unscoped "all" list disambiguates;
  falls back to the workspace suffix for runtime/overlay-only rows.
- `ResourceEditPage`: reads `?package=` and scopes the layered + draft read to
  that package. (The route's `:appName` is the Studio app, not the edited item's
  owner, so the scope must come from the URL, not the active app.)
