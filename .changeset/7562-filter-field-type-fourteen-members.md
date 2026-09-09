---
'@object-ui/types': minor
---

`FilterFieldSchema.type` / `FilterField['type']`: widen to the fourteen field types the
published doc declares, and make the key OPTIONAL (objectui#7562, director seat,
decision batch #88, 2026-09-08).

**What was wrong.** One authoring surface had three declarations that disagreed. The
published doc (`content/docs/components/complex/filter-builder.mdx`) offers fourteen
`type` members and marks the key optional; the renderer follows the doc — it buckets all
fourteen by name and reads `fieldType || "text"` when the key is absent; this mirror
offered seven and REQUIRED the key. So a `fields` entry written against our own
documentation, which the component renders correctly, was refused by our own validator.
The ruling made the published doc the authority: a contract does not retract what it
published to authors.

**What changes.** `type` now accepts `text` · `number` · `currency` · `percent` ·
`rating` · `date` · `datetime` · `time` · `boolean` · `select` · `status` · `lookup` ·
`master_detail` · `user`, and may be omitted (absent means `text`). Widening only —
every document that validated before still validates. `{ value, label }` with no `type`
now validates, as does `{ value, label, type: 'currency' }`.

**Still refused, deliberately.** `string` stays out. It is named nowhere in the renderer
and reaches the text control only by the unrecognised-word fallthrough, so it is
indistinguishable from a nonsense spelling — the phantom objectui#6939 removed. `text`
shares that fallthrough but IS named (`valueFamilyForFieldType`'s `fieldType || "text"`),
which is the whole difference between the two. The vocabulary also stays CLOSED: an
unrecognised spelling is still refused, so this is not "`type` stopped being checked".

**Measured before it moved.** The ruling's precondition was that every one of the
fourteen has a renderer branch — a member that nothing draws would have come OUT of the
doc instead. One condition row per member was driven through the real `FilterBuilder`
and both the value control and the operator bucket were read. All fourteen have a
branch; nothing was withdrawn from the doc. The table is in `FilterFieldSchema`'s
docblock, bucket by bucket with the file:line that carries each one.

**Not in this change.** `FilterBuilderConditionSchema.id` is objectui#8415, the filter
OPERATOR vocabulary is objectui#7561, and the filter GROUP's `id` stays optional
(objectui#7560 measured zero read sites for it — the same answer does not transfer).
