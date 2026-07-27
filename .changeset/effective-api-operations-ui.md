---
"@object-ui/core": minor
"@object-ui/permissions": minor
"@object-ui/plugin-grid": minor
"@object-ui/plugin-list": minor
"@object-ui/app-shell": minor
"@object-ui/i18n": minor
---

feat: render the server's effective API operation set (#3391 PR-4)

The frontend now consumes the per-object **effective API operation set** the
server resolves (from `/me/permissions` `apiOperations`, framework #3391) —
never the raw `apiMethods` — so Import/Export/New/Edit/Delete buttons match what
the server will actually admit, and a 405 import refusal shows a dedicated
message instead of silently falling back.

- **core** `resolveCrudAffordances(obj, effectiveApiOperations?)` — new optional
  second argument intersects each affordance bit with its API operation
  (create/import→create/import, edit→update, delete→delete, exportCsv→export).
  Omitting it (old backend / no effective set) leaves affordances unchanged.
- **permissions** — `/me/permissions` response carries per-object
  `apiOperations`; `PermissionContextValue.getObjectApiOperations(object)`
  exposes it (undefined when absent → callers keep current behavior); `check()`
  maps `import→allowCreate`, `export→allowRead`.
- **app-shell** `ObjectView` intersects its toolbar affordances with the object's
  effective operations (Import); the platform-admin identity-import bypass is
  unaffected.
- **plugin-list** `ListView` / **plugin-grid** `ObjectGrid` gate the Export
  button (and export handler) on effective `export`; `plugin-grid` gains the
  `@object-ui/permissions` workspace dependency.
- **plugin-grid** `ImportWizard` — a 405 / `OBJECT_API_METHOD_NOT_ALLOWED`
  import refusal is detected by a new `isImportNotAllowed` predicate at every
  catch site (async, sync, dry-run) and STOPS with a dedicated
  `grid.import.notAllowed` message (10 locales + fallback dict) — it never falls
  back to the sync/legacy path (which 405s too), distinct from the 404
  route-absent fallback.

Backward-compatible: a missing effective set (unrestricted object, older
backend, or no permission provider) preserves the current default-allow
behavior everywhere.
