---
'@object-ui/components': minor
---

layout: `flex` and `container` now honour a declared scale value of `0`

`FlexSchema.gap` and `ContainerSchema.padding` are declared `number`, and both
renderers already carried an explicit zero branch (`gap === 0 && 'gap-0'`,
`padding === 0 && 'p-0'`). Neither branch was reachable: the value was read with
`||`, so a declared `0` was folded into the default before the branch was tested.
A `flex` asking for no gap rendered `gap-1.5 sm:gap-2`, and a `container` asking
for no padding rendered `p-2 sm:p-3 md:p-4` — the JSON said one thing and the DOM
did another, with nothing reported.

Both now read the value with `??`, matching how the sibling `stack` and `grid`
renderers already read theirs. Omitting the key still applies the same defaults
(`gap: 2`, `padding: 4`); only an explicitly declared `0` changes, and no node in
this repository declared either key as `0` before this change.
