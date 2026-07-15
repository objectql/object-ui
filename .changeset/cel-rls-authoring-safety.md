---
"@object-ui/app-shell": minor
---

feat(app-shell): CEL authoring safety for RLS policies — lint, field autocomplete, test-run (objectui#2413)

The permission-set Studio editor's Row-Level Security section
(`PermissionAdvancedFacets`) let admins author `USING` (read filter) / `CHECK`
(write filter) predicates as hand-typed CEL with **no validation, no
autocomplete, and no way to test**. RLS is security-critical: a typo silently
mis-scopes rows, and some evaluation paths **fail open** — widening access with
no visible error. The `USING`/`CHECK` editors now run three author-time
safeties, all delegated to the framework's canonical CEL engine
(`@objectstack/formula`) so the GUI reaches the **same verdict as the server**
rather than maintaining a second grammar:

- **Inline lint** (`CelPredicateField`) — `validateExpression` flags parse
  faults inline (and gates Save), unknown-field near-misses as non-blocking
  "did-you-mean" warnings, and a non-pushdown-able `USING` filter as a
  fail-open blast-radius advisory (`isPushdownableCel`).
- **Field autocomplete** — `introspectScope` offers the target object's fields
  plus scope vars (`current_user`, `record`, …) and stdlib functions as you
  type, so an identifier that would silently never match is caught early.
- **Test-run** (`CelTestRunDialog`) — dry-runs a predicate against a sample
  record + `current_user` and shows allow / deny / non-boolean / error before
  shipping.

The engine loads lazily (dynamic `import`, feature-detected and
error-swallowing), keeping the CEL parser out of the main bundle; a
missing/older engine degrades to "no assistance" rather than breaking the
editor. New bridge: `metadata-admin/celAuthoring.ts`. New `perm.cel.*` i18n keys
(en + zh-CN).
