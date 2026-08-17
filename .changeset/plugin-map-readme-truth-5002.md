---
---

Docs only: `packages/plugin-map/README.md` is rewritten against the code it documents
(objectui#5002). The old text taught a component that does not exist — an authored
`markers` array, `layers`, `height`, `useGeolocation`, a `center: { lat, lng }` object,
a `zoom` "default: 10", and an `import { mapComponents }` + `Object.entries()` manual
registration — so every snippet in it rendered an empty map with no diagnostic. What the
component actually reads is the ObjectQL query (`objectName` / `staticData` / `data`,
with `filter` and `sort` as the query's own) plus the declared `map` block
(`latitudeField`, `longitudeField`, `locationField`, `titleField`, `descriptionField`,
`zoom`, `center` as a `[latitude, longitude]` tuple, `style`), and registration is a side
effect of the import.

The rewrite is deliberately shorter than what it replaces: the exhaustive authoring
reference stays in the one gated copy, `content/docs/plugins/plugin-map.mdx`, and the
README keeps only what is local to the package — what it registers, what it exports, one
working schema of each provider shape, the camera rule since objectui#4941/#5000 (no
default zoom: an undeclared camera fits the records), and the traps a reader cannot infer
(a `map` block replaces the field-name defaults instead of merging with them; an
unreadable `center` is diagnosed, not adapted). Restating the whole schema in an ungated
second copy is what produced this drift, the same failure shape as objectui#3881.

No code, types, or runtime behaviour change, so this declares no release; the corrected
README reaches npm with `@object-ui/plugin-map`'s next publish.
