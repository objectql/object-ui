---
"@object-ui/components": patch
---

`element:record_picker.filter` is now discoverable from the published `inputs`

The fourth A-class gap of objectui#3808's own list, and the one its three-way
triage dropped: `filter` appears in that issue's raw key dump for this block and
then in none of its A / B / C lists, so the change that added the repo-wide
parity gate exempted it by name instead of declaring it. It is the same shape as
the four #3808 fixed — `@objectstack/spec` declares
`ElementRecordPickerProps.filter`, the renderer has read it all along
(`composed?.filter ?? props.filter`, straight into the picker query's `$filter`),
and the registry `inputs` never mentioned it.

`element:record_picker` is not in the public tier ("record picking is a field
widget, not a page block"), so the gap was not in `sdui.manifest.json` — it was
in the JSX-page compiler's prop whitelist, which `renderers/layout/page.tsx`
builds from `getKnownTypes()` plus these same `inputs`. A JSX page writing
`filter` therefore got an `unknown-prop` warning from `sdui-parser`'s prop walk
on the very key that decided which records the picker offered, and the designer
panel gave an author no way to discover the key existed at all.

The description is derived from what the renderer does, not from restating the
spec's one-liner, because the one thing an author cannot read off the spec is
which of the two places they may write a filter wins: a node-level `dataSource`
filter (itself AND-combined with any saved `view` it names) is taken and this
top-level `filter` is DROPPED, not merged — so this key applies only when the
node carries no `dataSource` filter.

`type` is `'object'`, taken from the spec's actual shape on the resolved pin
rather than the `'array'` the issue's landing sketch guessed:
`FilterConditionSchema` is `z.record(z.string(), z.unknown())` intersected with
the `$and` / `$or` / `$not` group, so a rule array is rejected. This is the one
key in the family where `ComponentInput`'s coarse typing costs nothing —
`sdui-parser`'s `checkType` accepts exactly the values the spec accepts here, so
unlike `element:text_input.defaultValue` there is no narrowing to disclose.

The parity gate's explicit exemption for this key is deleted in the same change
(its own `carries no stale unpublished-key exemption` assertion demands it), and
the key joins #3808's four in the by-name "declared, not merely not-failing" pin.
