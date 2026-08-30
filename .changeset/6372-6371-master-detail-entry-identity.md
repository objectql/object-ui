---
'@object-ui/plugin-form': patch
---

`MasterDetailForm` gives every detail collection a per-entry record carrying its own
identity and its own resolution status, closing two defects that both came from the same
absence (objectui#6372, objectui#6371).

`resolvedDetails` was a plain `MasterDetailDetailConfig[]` with no per-entry metadata, so
both *what happened to this entry* and *which entry is this* were inferred from the
entry's position in the array. One record answers both, which is why they land together —
either one alone would have reshaped this structure and the second would then have
rewritten the first.

**objectui#6372 — a detail whose schema fetch threw sat on "Loading columns…" forever.**
The resolver's `catch` returned the entry unchanged, and an entry with no `columns` is how
*still in flight* is represented too, so the two states were indistinguishable and the
render branch showed the same spinner-shaped message for both. For the failed one it never
ended: the fetch is not retried, so nothing could ever replace it. Entries now carry a
resolution status, and a failed one renders a refusal placeholder naming the child object
whose schema could not be loaded (shaped on `AdvancedChartImpl`'s refusal placeholders —
`role="status"`, because a refusal is a state, not an alert). Measured before the fix
rather than read from source: a detail whose `getObjectSchema` rejects rendered
`<p>Loading columns…</p>`.

The thrown error is no longer discarded. The bare `catch` threw away the whole diagnosis,
so whoever debugged this had neither a message nor a stack; the decline arm next to it has
warned since objectui#5940, and this arm now matches it and passes the error object
through.

⭐ The fetch and the derive are caught **separately**, because they are different failures
with different truths to tell. A schema that loads fine and then yields no relationship
field is a configuration error, and calling it a load failure would be false. That arm's
render is deliberately unchanged; only its error stops being swallowed.

**objectui#6371 — a declined entry had no identity across a reorder.** There was no
duplicate-key collision: the map index is unique among siblings by construction, so two
declined details keyed as `undefined-0` and `undefined-1`, distinct. The real defect is
that for a declined entry the data half of that key is `undefined`, leaving position as
the entry's whole identity — and the row-state store was addressed the same way, seeded
once at mount and never re-synced when the authored config changed. Reordering or removing
an entry therefore handed a collection a different collection's rows.

Entries now carry an id synthesized once from the incoming config: the child object for a
named collection, and the authored position for a declined one, which has no other
identity to offer. Row state is keyed by that id, so a collection can only ever read its
own slot. Three reads were affected, not the one the report named:

- the grid value, which showed the wrong collection's rows;
- the document **subtotal** reducer, so a reorder did not merely mis-associate a grid, it
  mis-computed the total;
- the batch payload on save, which read
  `details.filter(d => d.relationshipField).map((d, i) => state[i])` — after the filter `i`
  indexed the filtered array while the row state was indexed against the full one, so a
  declined entry above a real collection shifted every read below it by one and that
  collection's rows were **silently dropped from the transaction**. Data loss on save, not
  a display defect.
