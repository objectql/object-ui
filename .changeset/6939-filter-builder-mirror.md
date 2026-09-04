---
'@object-ui/types': minor
---

Repair the `filter-builder` mirror: the field key is `value`, the type
vocabulary is the value families the component actually folds a column into,
and a filter group is `{ id, logic, conditions }` (objectui#6939, maintainer
ruling recorded 2026-09-02 — one of the eight groups on that card, dispatched
as its own PR per the ruling).

Three independent mis-declarations sat in one member, and each is a key-name or
vocabulary **move** rather than a missing optional key:

1. **`FilterFieldSchema` required `name`.** Every read site matches an entry by
   `value` — `fields.find((f) => f.value === …)` in `getOperatorsForField`,
   `changeField`, `getInputType` and `renderValueInput`, `fields[0]?.value` in
   `addCondition`, and `<SelectItem value={field.value}>` in the field dropdown
   (`packages/components/src/custom/filter-builder.tsx`). `name` had zero read
   sites, and `FilterBuilderProps.fields` in that same file already declares
   `Array<{ value, label, type? }>`. `@object-ui/fields`' `deriveFilterFields`,
   the real producer that builds this list from an object schema, emits `value`
   too, and the published doc
   (`content/docs/components/complex/filter-builder.mdx`) has declared
   `value: string` all along.
2. **Its `type` enum was `string | number | date | boolean | select`.** `string`
   is a phantom, and `text`, `datetime` and `time` — three of the six
   `FilterValueFamily` members the component folds a column into — were all
   refused.
3. **`FilterGroupSchema` was `{ operator, conditions }`.** The gate is
   `isValidGroup`, which tests `Array.isArray(v.conditions)` and
   `v.logic === "and" || v.logic === "or"` and nothing else.

All five `components-complex-filter-builder/*` catalog entries author
`{ value, label, type }` fields and a `{ id, logic, conditions }` group — the
registration's own `inputs` / `defaultProps` spelling — so the mirror refused
them while the renderer drew them. Re-measured on `origin/main` at `3e01cb55f`,
both faces untouched: four refusals at the root (`search-interface` roots at
`stack`, so `objectui check` counts four for this row, and the `filter-builder`
it wraps is refused on its own), and five renders this change leaves
byte-identical (11 / 76 / 65 / 11 / 57 elements, same tag census, same
`textContent` SHA-256).

**This is `minor`, not `patch`, and the reason is that the accept set MOVES.**
The ruling grades this class "patch where the accept set only widens toward what
already renders"; that grading does not hold here. Three refusal classes are
created, each of which was a legal document before:

- **`fields[].name` as the field key.** `{ name, label, type }` now refuses:
  `value` is required and `name` is not declared, so a field entry spelled the
  old way has no identity at all. A document carrying BOTH keys still validates
  (the undeclared one is stripped), which is the migration path.
- **`type: 'string'`.** Refused outright. It reached the text control only
  through the unrecognised-word fallthrough in `valueFamilyForFieldType` —
  measured indistinguishable from a nonsense spelling — so nothing that read the
  key ever saw it; but a document that carried it did validate before and does
  not now.
- **`{ operator, conditions }` as the group shape.** Refused: `logic` is
  required. This is the loudest of the three at render time — a group spelled
  that way already failed `isValidGroup`, fell back to `EMPTY_GROUP` and drew an
  **empty board** (76 elements and three condition rows became 11 and none), so
  the mirror was blessing a shape that never rendered.

The widening half, for completeness: `fields[].value`, `type: 'text'` /
`'datetime'` / `'time'`, and the `{ id, logic, conditions }` group all become
legal. On the TypeScript twin the same move applies to `FilterField.value` /
`FilterField.type` and to `FilterGroup.logic`, so a consumer reading
`field.name` or `group.operator` stops compiling. `major` is not available in
this repository (`check-changeset-no-major`), so a breaking change is `minor`.

**Two places this departs from a literal reading of the ruling, both measured
and both flagged for contract review rather than made quietly:**

- **`select` is RETAINED** in the type vocabulary. The ruling's six-member list
  inherits the finding card's description of `select` as "extra"; it is not.
  `selectLikeTypes = ["select", "status"]` gives it its own operator bucket
  (`equals` / `in` / `notIn`) and its own value control — measured, a `select`
  column draws the option-driven Select and no `<input>` at all, against a text
  box for an unrecognised spelling. Dropping it would refuse a spelling this
  mirror accepts *today* and the renderer draws distinctly, which is a fresh
  instance of the class objectui#6939 exists to close.
- **The group's `id` is declared OPTIONAL.** `isValidGroup` never consults it
  and nothing reads `filterGroup.id`; deleting it from an authored group renders
  byte-identically. Requiring it would invent a refusal the renderer does not
  make. It stays *declared* because a plain `z.object` strips unknown keys in
  silence, so an undeclared `id` would be admitted unvalidated — declaring it
  buys the type check (`id: 42` now refuses) for a key the catalog authors,
  `EMPTY_GROUP` emits and `onChange` round-trips.

**What this does NOT reach, stated rather than left as an absence.** Two of the
four census entries — `product-search` and `with-conditions`, plus the
`filter-builder` nested in `search-interface` — still refuse afterwards, on a
FOURTH divergence the ruling does not address: they author
`conditions[].operator` as `eq` / `gt` / `lt`, while `FilterOperatorSchema` is
the spec's canonical `equals` / `greater_than` / `less_than`. Swapping only
those three spellings makes both entries parse, which is pinned, so the claim
"the three ruled divergences are gone from all four" is measured. That
vocabulary is a genuine fork needing its own ruling — the builder's dropdown ids
are `notEquals` / `greaterThan`, which this mirror also refuses, while the
canonical spellings it accepts render a **blank** operator trigger — and it is
reported on objectui#6939 rather than decided here. Seven further live field
types (`status`, `currency`, `percent`, `rating`, `lookup`, `master_detail`,
`user`) each have their own bucket and control and are still refused; they were
refused before this change as well, so that gap is pre-existing rather than a
regression introduced here, and it is reported on the same card. The published
doc for this component already offers all fourteen spellings and already marks
`type` OPTIONAL, which the mirror still does not — a third declaration that
agrees with the renderer, pinned here so the gap is measured rather than
asserted, and left for the same review.
