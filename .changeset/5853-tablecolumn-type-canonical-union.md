---
'@object-ui/types': minor
'@object-ui/components': patch
'@object-ui/plugin-grid': patch
'@object-ui/plugin-dashboard': patch
---

`TableColumn.type` now has ONE canonical value set across all three ends that disagreed
(objectui#5853, maintainer ruling 2026-08-25, Option B: the 8-literal interface union is
canonical). The interface declared `'text' | 'number' | 'date' | 'datetime' | 'currency' |
'percent' | 'boolean' | 'action'`; the zod mirror declared `z.string()` and accepted
anything; the renderer branched on a third set and could only read the key through an
`as any` cast.

## ⚠️ Accept-set narrowing — these spellings stop validating

`TableColumnSchema.type` was `z.string().optional()`. **Any string parsed green.** It is now
`z.enum(TABLE_COLUMN_TYPES).optional()`, so a value outside the eight is refused at parse
time with `type` named in the error path. Spellings that validated before and are **refused
now**, grouped by why they were being written:

- **Typos and invented names** — `'money'`, `'datetime2'`, `'string'`, `'int'`, `'integer'`,
  `'float'`, `'double'`, `'datetime-local'`, and every other free-form string. `'money'` is
  the card's headline case: it validated, matched no renderer branch, and the column fell
  through to plain text rendering with nothing reported. That silent fall-through is the
  lenient-validation face that lets AI-authored metadata errors through, and it is now a
  loud parse failure.
- **Object-schema field types written into a column slot** — `'select'`, `'lookup'`,
  `'user'`, `'file'`, `'formula'`, `'textarea'`, `'email'` and the other 35 members of
  `@objectstack/spec`'s `FieldType` that are not among the eight. These belong on the FIELD,
  not on the column: a column gets its dedicated widget from the field definition behind its
  `accessorKey`, never from `type`.

**Authored metadata in this repo needs no migration.** Measured before tightening, across
`examples/`, `content/`, `apps/`, `e2e/`, `docs/` and every package (591 JSON schema files
plus the docs and playground sources): **zero** authored `TableColumn.type` values outside
the eight, and zero occurrences of `int` / `integer` / `float` / `double` in a column
position anywhere in the repository. If you author `type` on a table column, check it
against the eight; if the value describes the FIELD rather than the column, remove it.

## The renderer's undeclared vocabulary disappears instead of being declared

`int` / `integer` / `float` / `double` were members of the data-table's `NUMERIC_EDIT_TYPES`
and `datetime-local` had its own editor branch, none of them declared. They arrived because
column-inference producers forwarded an object schema's field type **verbatim** into
`TableColumn.type`. Rather than publishing that dialect, producers now fold their inferred
value onto the declared vocabulary at their emit seam via the new
`normalizeTableColumnType()`: `int`/`integer`/`float`/`double` → `number`,
`datetime-local` → `datetime`, and **anything else drops the `type` annotation — never the
column**. Two producers do this, not the one the card named: `ObjectGrid` (`@object-ui/plugin-grid`)
and `ObjectDataTable` (`@object-ui/plugin-dashboard`), whose `buildFieldMeta` spread wrote
the raw field type into the same slot.

Dropping the annotation is behaviour-preserving at the only consumer that reads the key.
`data-table`'s inline editor branches on `date`, `datetime` and the numeric set and
otherwise falls through to a text input — which is exactly the `undefined` path. The
dedicated widget a `select` or `lookup` column gets comes from the host's `renderCellEditor`,
which resolves the field through `column.accessorKey` and never reads `type`.

## New public API

`@object-ui/types` exports `TABLE_COLUMN_TYPES` (the canonical tuple — the single
declaration the zod mirror builds its enum from, so the two cannot drift), the
`TableColumnType` union, and `normalizeTableColumnType()` for producers. The `as any` cast
in `data-table.tsx` is deleted and the read is typed, so re-introducing an undeclared
spelling is a tsc error rather than a silent widening.

A value-level parity pin covers all three ends
(`packages/types/src/__tests__/table-column-type-canonical.test.ts` and
`packages/components/src/renderers/complex/__tests__/table-column-type-read-set.test.tsx`).
objectui#5684's guard is key-set only and cannot see value drift — `type` was present on
both sides the whole time — which is how this instance survived while its siblings were
caught. A future inference value turning that pin red is by design; the note at the pin says
so, and names the two correct repairs.
