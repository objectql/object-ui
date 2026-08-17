---
'@object-ui/components': minor
'@object-ui/plugin-detail': minor
---

`element:text.content` and `element:button.label` declare the inline translation
map they already accept

Two more instances of the contradiction objectui#3832 fixed the mechanism for,
measured after that ruling had fixed its scope at five specimens and filed
separately as objectui#4970. Both inputs' own `description` tells the author to
write an inline translation map (`{ en, "zh-CN", … }`), both renderers resolve one
through `pickLocalized`, and both spec props schemas accept one — while the
declaration said `type: 'string'`, so the manifest gate reported
`type-mismatch` on the exact shape the block had recommended. Both blocks are in
`PUBLIC_BLOCKS`, so this reached authors through `sdui.manifest.json` and
`sdui-intrinsics.d.ts` as well as the save gate.

Each declaration is now `type: ['string', 'object']`, the union form
objectui#3832 introduced, and the arms are the ones the contract accepts —
re-measured on the `@objectstack/spec` 17.0.0 GA pin rather than carried over
from the issue, which was written at the 17.0.0-rc.6 pin:
`ComponentPropsMap['element:text'].content` and
`ComponentPropsMap['element:button'].label` are both
`string | Record< string, string >`, and both refuse a number, a boolean and an
array. Those three refusals are the controls in the acceptance test, which is
what keeps a widening distinguishable from a silenced check.

Nothing else about the two blocks moves. A plain-string `content` / `label`
validates exactly as before, values matching neither arm are still reported, and
no other manifest entry changes shape — the public manifest now carries seven
array-valued input types, the five from objectui#3832 plus these two, with the
remaining 57 public blocks serializing byte for byte as they did.

`record:alert`'s renderer-local prop type is corrected in the same pass
(`plugin-detail`): its `title` / `body` were still typed `string` while the same
file resolves both through `pickLocalized` and the block's published `inputs`
have declared `['string', 'object']` since objectui#3832, so the two slots were
narrower than both the renderer and the block's own published surface. The type
is not exported, so no consumer was misled and no published surface changes. The
CTA's `action.label` one level down is left alone on purpose (objectui#4998):
`action` is published as a bare `object` whose member shape lives in prose, so
there are no declared arms for it to be aligned against yet.
