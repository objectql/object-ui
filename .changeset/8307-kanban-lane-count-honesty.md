---
'@object-ui/plugin-kanban': patch
---

A Kanban lane header over a windowed fetch now says `77+` instead of `77`
(objectui#8307).

**The defect.** `object-kanban` fetches with a real `$top` (objectui#4025) and then
groups **what came back** into lanes client-side, so `col.cards.length` counts fetched
rows that fell into this lane — not the size of the group. Over any object holding more
rows than the window every lane number is wrong and they sum to the window. Measured in
a consuming app on 200 records: the board displayed **77 · 19 · 2** against a true
**88 · 46 · 28 · 14 · 9 · 15**.

The expensive part is that those numbers look right. 77 · 19 · 2 is a plausible funnel;
there was no ellipsis, no "100 of 200", no styling difference — nothing prompting the
reader to distrust a number that then travels into a status report.

**The fix is not a better number, it is an honest one.** This component does not have a
group total and cannot compute one: that needs a server-side group-count aggregate over
the whole filtered set, which is a separate change. What it can stop doing is claiming a
total it never fetched. When the fetch comes back **saturated** — at least as many rows
as the window allowed — every lane header on the board renders `77+`, which is precisely
what a count over a window establishes: *at least* 77. A fetch that came back short of
its window is the one case where the client knows the result set was exhausted, and
there the bare number is the truth and is kept. Rows handed to the board whole (inline,
bound or external `data`) never passed through this window and keep the bare number too.

`DEFAULT_KANBAN_LIMIT` is unchanged, deliberately: raising it moves the threshold
without touching the property, and every board above the new number would fail exactly
as silently.

**The boundary case is resolved towards the true statement.** A board holding exactly
the window is indistinguishable from a truncated one from the client side — both answer
a `$top: N` query with N rows — so such a board renders `77+` for a lane that really
holds 77. "At least 77" is TRUE there, whereas the bare "77" is FALSE on every truncated
board. The marker is conservative; it is never wrong.

All three lane headers move together — the flat column header and the swimlane layout's
column-title row and lane rows — through one `laneCountLabel` helper, so a board cannot
be honest in one layout and silently wrong in the other. Pinned by
`laneCountHonesty-8307.test.tsx`, which reads the rendered header text (a threaded flag
dropped one render short of the DOM would ship the identical silent board) and carries
the exactly-at-the-window row and both negative controls.
