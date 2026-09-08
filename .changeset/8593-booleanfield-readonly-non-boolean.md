---
'@object-ui/fields': patch
---

`BooleanField`'s readonly branch no longer reads the value by truthiness (objectui#8593).

objectui#8582 ruled, on `@objectstack/spec`'s value contract, that only a real boolean is a
value of a boolean column and moved `BooleanCellRenderer` off truthiness. This takes the same
reading one surface over: the read-only branch of the edit widget that `FieldEditWidget`
registers for `boolean` / `toggle` and every generated form renders for a readonly boolean.
Measured by rendering on `21529629c`:

| stored value | readonly widget said before | says now |
|---|---|---|
| the string `'false'`, the string `'0'`, `{}`, `[]` | **Yes** | the shared `EmptyValue` affordance |
| the string `'true'`, the string `'1'`, `1` | Yes | the affordance |
| `0`, `''` | **No** | the affordance |
| `null`, `undefined` | No | the affordance |
| a real `true` / `false` | Yes / No | **unchanged** |

**The ruling is the spec's.** `@objectstack/spec` declares the runtime value of `boolean` /
`toggle` as a bare `z.boolean()` — "a JS boolean on the wire (driver read-coercion repairs SQL
0/1)", stored "never text on any backend". The truth table that turns `'true'` / `1` / `'0'`
into a boolean already lives at the producer boundaries (objectql's `coerceBooleanFields` and
its `invalid_boolean` write refusal, `rest`'s CSV `parseBooleanCell`), so a non-boolean that
reaches the widget is a producer that skipped its repair, and a second copy of that table in
the widget would be the lenient dialect the contract forbids.

**Both directions.** The truthy non-booleans said "Yes" — an affirmative the record never
made — and the falsy ones, plus a missing value, said "No", a negative it never made either.
The widget has no status-name badge, so unlike the cell renderer the fabricated "No" weighed
no more than the fabricated "Yes"; both now land on the affordance.

**Why `EmptyValue`.** It is this directory's own convention: every sibling widget with a
readonly branch and a nullable value (`NumberField`, `CurrencyField`, `PercentField`,
`DateTimeField`, `EmailField`, `PhoneField`, `RadioField`, `ObjectField`, …) draws it for the
absent case, and the cell renderer happens to draw the same component — the two surfaces agree
by convention, not by import. A consumer that fed the widget `1` / `0` or `'true'` / `'false'`
from a backend of its own now sees the affordance instead of a word: coerce at the data source,
where the platform does.
