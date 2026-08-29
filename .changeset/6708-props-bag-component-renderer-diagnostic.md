---
'@object-ui/react': patch
---

A `props` config bag on a component-renderer node is now named at render
instead of dropped in silence (objectui#6708).

`SchemaRenderer` HOISTS every `properties.*` value onto the node, so a key
written under `properties` is a real value on `schema.<key>` by the time a
renderer destructures it. `props` — the annotated legacy alias of the same bag
— is NOT hoisted: it is evaluated and then spread as React props on the created
element. A renderer declared as `({ schema })`, which is the normal shape for
the component renderers, therefore never sees it. The `element:*` family is the
exception: its `readProps()` merges `{ ...schema.props, ...schema.properties }`,
so the same spelling is honoured there.

Every gate accepts the `props` spelling — `BaseSchema` is `.passthrough()` with
`[key: string]: any` — and the docs call it a supported alias, so nothing
between the author and the screen said a word. Re-measured on `faac0d935`
through the real `SchemaRenderer` with a probe that records both channels:

| node | React prop `data` | `schema.data` |
|---|---|---|
| `props: { data: "${data.customers}" }` | the evaluated array | absent |
| `properties: { data: "${data.customers}" }` | the evaluated array | the array |

Same key, same value, one envelope apart. The expression is evaluated on both
legs, so this is a dropped value rather than an unevaluated one. Read through a
real `data-table` (objectui#6665's four-leg pin) the same pair renders
`No results found` against the two rows.

The diagnostic's level and dedupe were chosen from a census, which the ruling
made a precondition. Every JSON document, every `json` fence in every
`.md`/`.mdx`, and every TypeScript object literal in the repo was walked for
nodes carrying both `type` and `props`: 39 such nodes, 22 of them on
component-renderer types, and 19 of those 22 are test fixtures exercising this
shape on purpose. The authored, non-test corpus holds 5 — three of which are
deliberate counter-examples in the skills guides. Nothing floods, so the level
is not softened for volume; the dedupe is keyed on the MESSAGE rather than on
the schema object, so a metadata generator emitting one wrong envelope across
many nodes still gets one line while two genuinely different nodes get two.

`console.warn`, matching objectui#6575 and objectui#6665 — the two prior
instances of this exact "you declared something and the renderer dropped it"
shape — rather than the `console.error` its neighbour at this tier uses for a
raw `${...}` placed verbatim in front of a user. Nothing is placed here; a
value is dropped.

No behaviour change, which is the entire reason this arm was chosen. Hoisting
`props` to parity with `properties` was refused at ruling: it would weld the
legacy alias in as a permanent second spelling, against this repo's
alias-retirement direction. Refusing the key at parse stays blocked on the
`.passthrough()` ceiling (objectui#5155 / objectui#6269). What every renderer
receives is pinned byte-for-byte against a reading captured on the tree before
the diagnostic existed. Nothing is added to the published surface either — the
predicate, message builder, prefix constant and test-only reset are
module-internal and are not re-exported from the package entry, matching
objectui#6575's own symbols. The trap stops being silent; it does not stop
being a trap.
