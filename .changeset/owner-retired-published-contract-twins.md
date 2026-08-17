---
'@object-ui/types': patch
'@object-ui/plugin-detail': patch
---

The retired `owner` field-type spelling stops being blessed by the published contract, and inline edit refuses it the way the record form already does.

objectui#4814 retired `owner` as a field type (ruling A′): it was a synonym for
`user` with zero behavioral delta — both resolved to the same person-picker
widget — and it was never a member of `@objectstack/spec`'s closed `FieldType`,
so no object schema could ever declare it. `@object-ui/fields` now answers the
spelling with a visible tombstone refusal plus a console prescription. That PR
shrank the three public DOC unions; their CODE twins were left behind, so this
package spent the interval telling an author "legal" for a word the renderer
refuses.

**`@object-ui/types` — the three published twins shrink (objectui#4914 items 1-3).**
`ReportFieldSchema.type` (`zod/reports.zod.ts`) is a RUNTIME validator, so the
contradiction was executable, not merely advisory: a report document authored
with `type: 'owner'` validated green and then rendered a refusal. It now fails
validation, with the issue on the `type` path. Its TS twin `ReportField['type']`
and `UserFieldMetadata['type']` drop the member in the same batch, so published
`.d.ts` autocomplete stops offering it. This is an accept-set SHRINK on a
published validator and a narrowing of two published unions — patch-level
because the spelling it removes has had no working renderer since #4814, but
callers still passing `type: 'owner'` will now see a type error and a failed
parse. The record-owner idiom survives verbatim as
`{ type: 'user', name: 'owner' }`: the field NAME carries the ownership meaning,
the type carries the widget.

**`@object-ui/plugin-detail` — inline edit joins the tombstone (objectui#4914 item 5).**
`InlineFieldInput` routes by a STORED field's actual type, so a record whose
field is still typed `owner` was getting a working person picker inline while
the record form showed the refusal — two edit surfaces disagreeing about one
field, which is worse than either uniform outcome. A retired spelling now
renders the same `RetiredFieldTombstone` the form does, reported once per
spelling rather than once per row. The table is read live from
`@object-ui/fields`, so a future retirement is covered the day it lands.

Measured while implementing, and the reason the refusal is the load-bearing
half: simply deleting `owner` from the inline routing table would have changed
nothing an author could see. `hasFieldEditWidget('owner')` is still true — the
fields package maps `owner: UserField` in `EDIT_WIDGETS` — so the type would
have reached the same picker down the delegation road instead of the routing
road. That residual face is outside this change's scope and is filed separately.
