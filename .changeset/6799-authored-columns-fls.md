---
'@object-ui/plugin-grid': patch
---

`ObjectGrid` re-applies field-level security on its authored `columns` path too,
so all three of `generateColumns()`'s default paths now go through the field
gate (objectui#6799, maintainer ruling 2026-08-30).

objectui#6723 closed the inline-data path and left this one. It was the worst of
the three to leave, because it is the **most reachable**: the inline-data path
needs a host to hand rows down, while the authored `columns` path runs whether
the grid fetches its own rows or not.

| path | reached when | FLS re-applied |
| --- | --- | --- |
| authored `columns` (`ListColumn[]` and `string[]` arms) | `schema.columns` present and non-empty | **no, until now** |
| inline-data | host passes `data` and `fields` is declared | yes (objectui#6723) |
| object-schema | everything else | yes |

Both arms now filter through `perms.checkField(objectName, fieldName, 'read')`
when `perms.isLoaded && schema.objectName` — the same gate and the same deferral
condition the other two paths use.

**What a consumer will feel.** A grid that composes `ObjectGrid` directly with
an authored `columns` projection will now render *fewer* columns for a principal
whose field policy denies them: a column naming a declared field the user may
not read disappears, where it previously rendered with its values. If your host
already filters its projection through `checkField` before forwarding — as
`ListView` does — nothing changes at all; this is a measured no-op on that path.
Hosts that did **not** filter first will see the difference, and that is the
point of the change rather than a side effect of it.

⚠️ **Only keys the OBJECT DECLARES are judged, and that limit is load-bearing
rather than an optimisation.** Host-joined and derived columns pass through
untouched. It matters more here than on the inline-data path: a `ListColumn`
carries `label` / `link` / `action` / `prefix` / `width`, so a column whose
`field` the object does not declare is not a mistake but a legitimate authored
derived column, and dropping it would destroy authoring work. A field policy
that enumerates readable fields answers "no" for a key it has never heard of, so
judging derived keys would silently delete them. Declaration is read with
`hasOwnProperty`, so an inherited name (`constructor`) is not mistaken for a
declared field.

**The judged key is read through `columnIdentity`, never off a bare string.** It
folds the three authored identity spellings — `'salary'`, `{ field: 'salary' }`
and the legacy `{ name: 'salary' }` — which is why one predicate serves both
arms. A gate reading `col.field` directly would find no identity on the legacy
spelling and wave a denied declared field straight through.
`resolvesToDataColumn` still owns its own decisions and runs first, so the gate
narrows what survives and never resurrects a hidden or unresolvable column.

**Defence in depth, not a reachable exploit through `ListView`.** Measured in
this repo: three shipped compositions reach this path without filtering first —
`ObjectView`, and the designer's `ObjectManager` and `FieldDesigner` — plus two
dev/demo harnesses. `ListView` filters its own `effectiveFields` through the
same gate before forwarding, and that redundancy is the point: the invariant
must not rest on every future host having read the docs.

objectui#6598's `hasAuthoredColumns` predicate is unchanged and its rationale is
rewritten in the same change: it used to rest on "the grid would not re-check",
which is no longer true, and it now rests on the half that never depended on the
grid — an empty projection is the author's projection after filtering, and the
object's default columns are not what was authored whether or not they are
FLS-checked on the way out.

Pinned in `packages/plugin-grid/src/__tests__/authoredColumnsFls-6799.test.tsx`.
