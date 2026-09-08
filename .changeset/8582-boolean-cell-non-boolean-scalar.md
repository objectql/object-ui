---
'@object-ui/fields': patch
---

`BooleanCellRenderer` no longer reads a non-boolean scalar by truthiness (objectui#8582).

objectui#8490 ruled that a boolean column holding `[]` holds **no value** and deliberately
left every other non-boolean input on the old coercion. This takes that untouched half.
Measured by rendering on `2a38862f5`:

| stored value | rendered before | rendered now |
|---|---|---|
| the string `'false'`, the string `'0'`, `{}` | a **checked**, disabled checkbox | the shared `EmptyValue` affordance |
| `'false'` on a completion field (`completed`, `done`, …) | the green "Completed" indicator | the affordance |
| `'false'` on a status field (`active`, `enabled`, …) | a **checked** checkbox, no "Off" badge | the affordance |
| `0`, `''` | an **unchecked** checkbox | the affordance |
| `0` on a status field | the destructive "… — Off" badge | the affordance |
| `'true'`, `'1'`, `1` | a checked checkbox | the affordance |
| a real `true` / `false` | checked / unchecked | **unchanged** |

**The ruling is the spec's.** `@objectstack/spec` declares the runtime value of `boolean` /
`toggle` as a bare `z.boolean()` — "a JS boolean on the wire (driver read-coercion repairs SQL
0/1)", stored "never text on any backend". The truth table that turns `'true'` / `1` / `'0'`
into a boolean already lives at the producer boundaries (objectql's read-path
`coerceBooleanFields` and its `invalid_boolean` write refusal, `rest`'s CSV `parseBooleanCell`),
so a non-boolean that reaches the renderer is a producer that skipped its repair, and a second
copy of that table in the renderer would be the lenient dialect the contract forbids. Only a
real boolean is a value of a boolean column; everything else renders the affordance, whose
accessible name "No value" is a statement about the field's type.

**Declared, not smoothed.** `{}` and `'false'` now land on the same affordance for the same
reason, and neither is "checked". The affordance does not say *which* wrong-typed value the
column holds — surfacing that is the write path's job, not the read renderer's. A consumer
that fed this renderer `1` / `0` or `'true'` / `'false'` from a backend of its own now sees the
affordance instead of a box: coerce at the data source, where the platform does.
