---
'@object-ui/react': patch
---

A degenerate `properties` bag no longer reaches the element as indexed React
props (objectui#6760).

`properties` is the spec spelling of a node's config bag. The hoist that copies
`properties.*` onto the node's top level walked it with `Object.entries`
unconditionally, so a non-object value was enumerated rather than skipped:
measured on `c6732825d`, `{ type, properties: 'not-a-bag' }` reached the element
as nine React props named `0` … `8`, and `properties: ['x', 'y']` as `0`, `1`.
Nobody authored those keys — they are the walk's reading of a string's character
indices.

The hoist now asks the same `isConfigBag` question the evaluation memo and the
`props` bag already ask (objectui#6752, objectui#6761). Of the two arms the card
left open, this is "guard the hoist" rather than "declare that the hoist may
enumerate anything", because objectui#5123 ruled that a key gets one answer
whichever channel reads it — and the alternative would have answered one
authored mistake two ways, with the reinterpreting half falling on the canonical
spelling while the quiet half fell on its legacy alias.

Nothing else moves: a real object bag hoists exactly as before (including the
`type`/`id` keys the hoist has always refused to copy), the authored
`properties` value still reaches renderers on both channels unchanged, and
`properties: 42` / `properties: true` were already contributing no keys.
