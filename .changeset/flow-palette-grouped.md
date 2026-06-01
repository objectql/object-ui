---
'@object-ui/app-shell': minor
---

Group the flow add-node palette by category, and offer every node type

The quick-add palette listed 12 node types as a flat list; `assignment`,
`screen`, `delete_record` and the parallel gateways could only be reached by
adding a node and switching its type in the inspector. Building flows, that's a
real friction point.

- **Complete**: the palette now offers Delete record, Set variables
  (assignment), Screen, Parallel split and Parallel join too — so every common
  node type is one click away.
- **Grouped**: items are organised into **Data / Logic / Human / Integration /
  Flow** sections with headers and dividers, so the (now longer) list stays
  scannable. A new `nodeCategory(type)` helper drives the grouping and gives
  engine-only / plugin-contributed node types a sensible section; `mergePalette`
  preserves a base item's category and infers one for engine-only types.

Verified in-browser: the grouped palette renders all sections with tinted icon
chips, and the newly-offered types add to the canvas with the correct icon/tone
and no overlap.
