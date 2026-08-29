---
'@object-ui/react': patch
---

`SchemaRenderer`: a non-object `props` bag is no longer object-spread into
indexed React props (objectui#6752).

A node written `{ type: 'card', props: 'not-a-bag' }` reached `createElement`
carrying nine React props named `0` through `8`, one per character, because
`{ ...'not-a-bag' }` enumerates a string's character indices. Nothing threw and
nothing was logged, so the symptom — a component handed nine props it never
declared — sat a long way from the `props` value that caused it. Measured
through the real `SchemaRenderer`; the in-repo corpus has no such node today, so
this is a latent shape rather than a live failure.

The canonical `properties` branch already carried the wider guard. Its comment
claimed the guard was hoist-specific, and that turned out not to survive
measurement: ablating it leaves the indexed keys the hoist puts on the node
completely unchanged, and moves only whether `schema.properties` still holds the
value the author wrote. The reason is channel-independent — a degenerate value
must not have its shape reinterpreted by an object spread — so `props` now
carries the same guard, both bags share one `isConfigBag` predicate, and the
`properties` comment states the measured reason instead of the old one.

Both sites that spread the bag are covered: the evaluation memo (so
`schema.props` keeps the authored value) and `propsWithoutCanonicalKeys` (so the
`createElement` spread does not re-enumerate it). A degenerate bag now
contributes no keys, and the authored value is passed through unmangled on the
React prop named `props`.

Unchanged: a normal object `props` (still evaluated, still spread per key),
objectui#5123's two-bag precedence, the `properties` hoist, and objectui#6708's
dropped-`props` diagnostic.
