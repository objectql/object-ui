---
---

Fixes the `flex` node in `packages/types/examples/data-display-examples.json`, which authored
its layout configuration under a `props` envelope (`props: { direction: 'col', gap: 4 }`).
`SchemaRenderer` hoists `properties.*` onto the node and spreads `props` as React props
instead, so a renderer declared `({ schema })` — the ordinary component-renderer shape, which
`flex.tsx` has — never reads the envelope. The example therefore rendered with the default
`row` direction and the default gap while presenting itself as a column with `gap: 4`. The
two keys are lifted onto the node, where `FlexSchema` declares them; `props` is not renamed,
because renaming it to `properties` would be a second spelling for something the schema
already declares at node level.

Declared as releasing nothing: `packages/types/examples/**` is not in that package's
published `files`, and the accompanying pin is a test. No published behaviour changes.
