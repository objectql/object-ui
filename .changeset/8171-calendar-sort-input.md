---
'@object-ui/plugin-calendar': minor
---

Declare the `sort` input on both `object-calendar` registrations
(objectui#8171) — the html tier stops reporting `unknown-prop` on a key the spec
declares and `ObjectCalendar` already reads.

objectui#7712's defect, one key over. `ObjectCalendar.tsx` lowers the authored
key onto its own query as `$orderby: convertSortToQueryParams(schema.sort)`, and
`@objectstack/spec`'s `ComponentPropsMap['object-calendar']` declares `sort`
(measured on 17.2.0: `safeParse({ objectName, sort })` returns `success: true`,
while the same strict schema on the same call refuses `bogusProp` by name — that
control is what makes the acceptance a verdict). But neither of the two
registrations that publish this renderer — `plugin-calendar:object-calendar` and
`view:calendar` — listed `sort` in `inputs`, and `sdui-parser`'s `validateTree`
reports `unknown-prop` for every key no `inputs` entry claims. So an author
writing the one spelling that WORKS was told it was unknown — objectui#6678's
shape, where a correct write draws the same diagnostic as a write that does
nothing.

ADR-0049 enforce-or-remove resolves toward **declare**, not remove: the key has
live readers on both ends, so the registrations were the side that was wrong.
Declared `type: 'array'`, matching the `filter` entry objectui#7712 put beside
it and the `sort` that `object-grid`'s `GRID_QUERY_INPUTS` publishes — measured,
that arm is the repo-wide convention for this key, all seven existing `sort`
declarations write it.

⛔ Not derived from the `ElementDataSourceMapping` sitting six lines above,
which already asserts `sort: true`. That structure maps query keys for
`ElementDataSourceGate`; it is not an authoring declaration, and objectui#7712
measured why a mechanical derivation would be wrong — kanban's mapping also
carries `limit`, which the spec refuses by name.

⚠️ Carried forward from objectui#7712, because it stays true here:
`check:react-blocks-declaration-parity` runs manifest → spec, one direction. A
key the SPEC declares and the manifest omits is structurally outside what that
ratchet measures, so declaring this key does **not** make the next omission
loud. Making that ratchet bidirectional is objectui#8176.
