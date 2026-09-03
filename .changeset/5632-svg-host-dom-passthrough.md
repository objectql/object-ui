---
'@object-ui/components': patch
---

`ui:icon` and `ui:spinner` route their host spread through `toDomProps`
(objectui#5632, the `BARE_SPREAD_ON_SVG` slice of objectui#5574).

Both renderers forwarded their whole prop bag to the SVG they render, so every
authored SDUI key on the node became an attribute — 14 per target, and
`icon="check"` on all 71 icon nodes in the schema catalog. `IconSchema` and
`SpinnerSchema` declare only `icon` / `size` / `color`, and both renderers
already consume all three by name, so the SDUI pass-through list withholds
nothing they need.

Two user-visible behaviours change, both of which were invisible to the DOM-leak
gate because the judge counts `stroke` / `width` / `height` as legitimate on an
SVG host:

- **`ui:spinner` now spins.** Its computed `class` (`animate-spin` plus the size
  class) was being overwritten by the `className` carried in the spread, so a
  spinner rendered through `SchemaRenderer` had neither. It is merged now.
- **A sized `ui:spinner` no longer emits invalid dimensions.** `size` is an enum
  (`sm`/`md`/`lg`/`xl`) and the spread handed the string to lucide's numeric
  `size` prop, putting `width="lg" height="lg"` on the element.

Also: an `icon` node's `color` is a Tailwind class (as `IconSchema.color`
declares, and as every authored value in the catalog uses). It reached lucide's
`color` prop through the spread as well, emitting an invalid
`stroke="text-red-500"` beside the class that does the real work; only the class
path remains. An authored raw CSS colour (e.g. `color: "red"`) no longer tints
the glyph through that accident — declare the colour as a class, which is the
declared contract.
