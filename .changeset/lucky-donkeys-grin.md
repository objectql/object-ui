---
"@object-ui/react": patch
---

Evaluate expressions written under a node's `properties`, not just under `props`

`properties` is the spec spelling of a node's config bag and `props` is the
legacy alias, but `SchemaRenderer`'s evaluation memo only ran the expression
evaluator over `props`. Renderers in the `element:*` namespace read
`schema.properties` first, so a node written the canonical way handed the
renderer the raw `${…}` source and rendered it verbatim, while the same node
written with the alias evaluated correctly — writing the spec-compliant form
was the way to lose your expressions.

`schema.properties` values are now evaluated per value, exactly as `props`
already was, and the evaluation runs before the existing
`properties`-to-top-level hoist so a key means the same thing whether it is read
as `schema.properties.x`, as `schema.x`, or as the spread `x` React prop.
Evaluation stays shallow on both spellings (nested objects and arrays are passed
through, not walked), and `properties` keeps its precedence over `props`.
