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

Rider carried by the same change, because objectui#8212 landed first: the
console's `registry-inputs-spec-parity` ledger is updated in step with the
declaration — the `object-calendar.sort` unpublished-key exemption is deleted
(its cover expires the moment the key is declared), the shrink-only objectui#8176
backlog ceiling drops 16 to 15, and `sort` gets a `MEMBER_PINS` entry rather than
a member-pin exemption. `MEMBER_PIN_EXEMPTION_CEILING` is untouched at 62.

⚠️ That member pin is deliberately NOT the identity-forwarding shape the two
`filter` pins use. `ObjectCalendar.tsx` writes
`$orderby: convertSortToQueryParams(schema.sort)`, which builds a new
`field -> direction` map, so this key is lowered rather than passed through and
`toBe` on `$orderby` is false about it. The pin asserts what is READ inside a
member instead — `field`, `order`, an omitted `order` meaning ascending, and a
member with no usable `field` dropped rather than invented.

No version bump is declared for `@object-ui/console`: its only edit here is that
test file's ledger data, which publishes nothing.
