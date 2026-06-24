---
"@object-ui/app-shell": minor
---

feat(metadata-admin): visual filter authoring in the dataset designer

The dataset designer gains a visual filter editor (reusing the shared
`FilterBuilder`) for both the dataset-level **Scope filter** (`dataset.filter`)
and per-measure **Filter** (`measure.filter`) — previously only settable via the
raw Source/JSON tab. Both are backed by real runtime: the analytics executor ANDs
the scope filter into every query and runs measure-scoped filters as supplementary
grouped queries, so e.g. `won_amount = sum(amount) where stage = won` and an
"exclude archived" dataset scope are now authorable without hand-writing JSON.

A small, unit-tested converter bridges the builder's flat `{field, op, value}`
group ⇄ the spec `FilterCondition` (Mongo-style `$and` / `$op`). Conditions it
can't faithfully round-trip (nested groups, `$or`, multi-operator objects) are
detected and shown as "edit in Source" rather than being silently rewritten.
