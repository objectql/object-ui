---
'@object-ui/plugin-form': patch
---

`object-master-detail-form` now renders a config hint naming `childObject` for a detail
collection whose child object never resolved, instead of `Loading columns…` forever
(objectui#6360).

`MasterDetailForm` already declines to fetch the schema of such a detail (objectui#5940)
and returns the entry unresolved, which is correct — asking the data layer for an object
literally named `undefined` is what that guard removed. But the decline is precisely the
guarantee that the entry's columns can never arrive, and the render branch it fell into
read `!d.columns?.length ? <p>Loading columns…</p>`. The author was shown a
spinner-shaped message that was permanently, unfixably wrong, and that never named the
key they had to set.

The `!d.childObject` case now takes its own branch, checked **before** the columns arm
because nothing is pending — there is no first paint where "loading" is honest. The copy
and structure are `LineItemsPanel`'s, which took the same branch for the same key in
objectui#6194 / PR #6359; the two components had been disagreeing about what an author
sees for the identical authoring mistake, and the weaker of the two was the one that read
as the precedent. The hint carries its own `data-testid` (`md-detail-no-child-object`).

Two source comments — at the decline itself and at the resolver's `catch` — asserted that
"the grid card shows a config hint". They were false, and following them cost a reader a
run of the component. The first is now true and says so. The second is **corrected rather
than made true**: a detail whose schema fetch *threw* does name a child object, so it
skips the new branch and still lands on `Loading columns…`. Distinguishing that from
"still in flight" needs per-entry error state the resolver does not keep, so it is filed
as objectui#6372 and the comment now points at it instead of promising a hint that is not
rendered there.

No spec or schema change: `childObject` is already REQUIRED on `MasterDetailDetailConfig`.
This is renderer-side reporting of an authoring error that the type system cannot catch,
because a detail entry reaches this renderer straight off an authored JSON schema.
