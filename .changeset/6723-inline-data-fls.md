---
'@object-ui/plugin-grid': patch
---

`ObjectGrid` re-applies field-level security on its inline-data column path too,
so whether an object-bound grid re-checks FLS no longer depends on who fetched
the rows (objectui#6723, maintainer ruling 2026-08-29).

`generateColumns()` re-applied FLS at exactly one place — the object-schema
path. The inline-data path, taken when a host hands rows down as `data` **and**
the author declared a `fields` projection, had no equivalent check. Both paths
serve object-bound grids, so the same object with the same authored projection
did or did not go through the field gate purely according to provenance:

| rows from | `fields` declared | path taken | FLS re-applied |
| --- | --- | --- | --- |
| grid fetches | no | object-schema | yes |
| grid fetches | yes | object-schema | yes |
| host passes `data` | no | object-schema (since objectui#6677) | yes |
| host passes `data` | yes | inline-data | **no, until now** |

The inline-data path now filters each column through
`perms.checkField(objectName, fieldName, 'read')` when `perms.isLoaded &&
schema.objectName`, the same gate and the same deferral condition the
object-schema path has always used.

⚠️ **Only keys the OBJECT DECLARES are judged, and that limit is load-bearing
rather than an optimisation.** Host-joined and derived keys pass through
untouched, because keeping them is this path's whole reason to exist — the
object-schema path drops them outright (`if (!field) return;`). A field policy
that enumerates readable fields answers "no" for a key it has never heard of, so
judging derived keys would silently drop them, which is the failure the issue's
own analysis warned about. Declaration is read with `hasOwnProperty`, so an
inherited name (`constructor`) is not mistaken for a declared field.

**Defence in depth, not a reachable exploit through the shipped hosts.**
`ListView` — the dominant host — already filters its own `effectiveFields`
through this same gate before forwarding, and that redundancy is the point: the
invariant must not rest on every future host having read the docs. The exposure
this closes is a direct
`<ObjectGrid schema={{ objectName, fields }} data={rows} />` composition, or a
future host that forwards an authored projection unfiltered.

Deliberately unchanged, and refused by name in the ruling: the two paths' other
differences stay as they are — the schema path's `resolveFieldLabel` (i18n) vs
the inline path's local humanisation, and the schema path's drop of names the
object does not declare. Converging those is a separate decision.

Pinned in `packages/plugin-grid/src/__tests__/inlineDataFls-6723.test.tsx` (a
readable declared field renders; an unreadable declared field does not, even
with host data for it; a derived key is unaffected; plus the perms-not-loaded,
no-`objectName` and schema-in-flight boundaries and a case through the real
`PermissionProvider`) and, as a measured no-op on the `ListView` path, in
`packages/plugin-list/src/__tests__/ListView.inlineFlsNoop-6723.test.tsx`.
