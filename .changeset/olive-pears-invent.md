---
---

Declare the batch write-warning's unattributed-strip placeholder in
`@object-ui/data-objectstack`, and pin what it is (objectui#7160).

`notifyBatchDroppedFields` resolves the object a cross-object strip is about
from the wire entry's `object`, else from the operation its `index` addresses.
When neither channel answers, it wrote a bare `''` — a value satisfying the
spec's required `object: string` while naming no object at all. That literal is
now the named, documented `UNATTRIBUTED_STRIP_OBJECT`, carrying the reachability
argument, why such a strip is still emitted rather than refused, and why the
placeholder must stay falsy. A stale comment claiming an unattributable strip
"reads as an update" is corrected to what the code does (it lands on `create`,
tracked as objectui#7170).

No published behaviour changes and no released surface moves: the value is
unchanged, and the new boundary suite passes identically against the pre-change
source. The emitted `dist/index.d.ts` is byte-identical at both shas, with a
live control (one temporary exported const) proving the comparison detects a
real surface change.

`node scripts/check-changeset-presence.mjs` on this tree, verbatim:

> ✅  2 source file(s) of 1 released package(s) changed, and this change declares 1 changeset(s): .changeset/olive-pears-invent.md.
>     Every one of them has an EMPTY frontmatter — declared as releasing nothing, which
>     is the explicit exemption and a complete answer to this gate.
