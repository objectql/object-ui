---
---

Close the network-escape window in
`RecordDetailView.approvalDeclaredActions.test.tsx` (objectui#7439): the `fetch`
double is now installed once for the whole file instead of being torn down by an
unconditional `afterEach`, which used to race the record page's own
`refreshAfter: true` approvals re-read. Test only; no package is released by
this change.
