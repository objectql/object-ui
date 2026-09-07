---
'@object-ui/types': minor
---

**Breaking for authored metadata:** a `filter-builder` CONDITION must now declare
`id` (objectui#8415). It is declared on both published faces — the TypeScript
interface `FilterBuilderCondition` in `complex.ts` and the Zod mirror
`FilterBuilderConditionSchema` in `zod/complex.zod.ts` — so a key the renderer
has always required is finally validated instead of silently discarded.

**What was measured, on this branch's base (`0203a29e`).** The mirror declared a
condition as `{ field, operator, value? }` and it is a plain `z.object`, which
STRIPS undeclared keys. So an author who correctly wrote `id` had it removed:
`FilterBuilderConditionSchema.safeParse({ id: 'c1', field, operator, value })`
returned `success: true` with an output whose keys were `field`, `operator`,
`value` — no `id`. The document then validated and the row rendered, and from
that point on it could never be edited or removed, because every affordance on
the row matches on the identity that was no longer there.

Re-derived from `packages/components/src/custom/filter-builder.tsx` rather than
inherited: `id` has **sixteen** condition-side read sites — the four MATCH sites
that decide which row a mutation lands on (`removeCondition`'s
`c.id !== conditionId`, `updateCondition`'s and `changeOperator`'s
`c.id === conditionId`, `changeField`'s `c.id !== conditionId`), the React `key`
on the row, and eleven call sites that hand `condition.id` to one of those four.
Handed `undefined`, `removeCondition` deletes every OTHER row, `updateCondition`
and `changeField` match none, and React keys the row `undefined`. The
component's own exported `FilterBuilderCondition` has always declared
`id: string`, and `addCondition` emits `crypto.randomUUID()`.

**Who is affected — a condition authored without `id`:**

```json
{ "type": "filter-builder", "name": "f",
  "fields": [{ "value": "a", "label": "A", "type": "text" }],
  "value": { "id": "root", "logic": "and",
             "conditions": [{ "field": "a", "operator": "equals", "value": "x" }] } }
```

now fails validation at `value.conditions.0.id`. **Migration:** give each
condition a stable unique string — any value the rest of the document does not
reuse; the component generates `crypto.randomUUID()` for rows the user adds.

⭐ **The narrowing refuses only what was ALREADY broken.** A condition with no
`id` renders today but can never be edited or removed, so nothing that works
stops working; the state this refuses is *accepted-and-discarded*, the class
objectui#6150 closed for `tree-view.title`. Measured across `apps/**`,
`examples/**`, `content/**` and `packages/**`: **every** authored
`filter-builder` condition in this repository already carries `id` — 7 of 7,
across the three schema-catalog entries that author rows — so no shipped
document in this repo changes verdict on this key.

**What else now refuses, and it is the second thing declaring a key buys:**
`id: 42`. An UNDECLARED key gets no type check at all, so a wrong-typed identity
parsed clean at base and was then dropped. It is now refused at its own path.

**Who is NOT affected.** ⛔ The GROUP's `id` is untouched and stays OPTIONAL
(objectui#7560): `isValidGroup` never consults it, nothing reads
`filterGroup.id`, and deleting it from an authored group renders
byte-identically — the opposite reading, on a member that looks identical.
`{ logic: 'and', conditions: [] }` still validates. The renderer is unchanged;
`FilterOperatorSchema`, `FilterFieldSchema` and `FilterBuilderSchema`'s own keys
are byte-identical, so the three items parked on objectui#7562 and the operator
vocabulary of objectui#7561 are neither addressed nor moved here.

Graded `minor`, not `patch`: this narrows the accepted input set, which is
breaking for any author who wrote a condition without an identity. It is not
`major` per this repo's fixed-group convention (objectui's own breaking changes
ship as `minor`; the group's major tracks `@objectstack` — AGENTS.md 版本号策略,
mechanically enforced by `scripts/check-changeset-no-major.mjs`).
