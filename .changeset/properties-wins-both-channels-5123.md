---
'@object-ui/react': patch
---

A node writing both `properties` and `props` now gets ONE answer per key, and it is the canonical `properties` one — on both read channels.

`properties` is the spec spelling of a node's config bag and `props` is the
annotated legacy alias, but which one actually reached the screen depended on
how the receiving renderer happened to read it — and the two channels disagreed
in opposite directions:

- **config bag** (`schema.properties.x`) — the `element:*` family's
  `readProps()` merges `{ ...schema.props, ...schema.properties }`, so
  `properties` won.
- **React prop** (`x` arriving as a prop) — `SchemaRenderer`'s `createElement`
  spread the hoisted `properties.*` values first and then
  `...(evaluatedSchema.props || {})` last, which overwrote them, so `props` won.

Measured on one render of one such node: the bag read `FROM_PROPERTIES` while
the same key read as a React prop gave `FROM_PROPS`. Which value rendered was
decided by nothing an author can see — only by whether their chosen component
belonged to the `readProps()` family.

The React-prop channel now declines to let the legacy alias override a key the
canonical bag also declares; the config-bag order was already correct and is
unchanged. Scope is co-occurrence only: a key that only `props` declares still
works exactly as before, and a node that writes one spelling is untouched. The
`props` alias is not retired here — only its precedence against a co-present
canonical spelling is settled.
