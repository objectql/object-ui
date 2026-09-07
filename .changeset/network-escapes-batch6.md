---
---

Test-only (objectui#7307 batch 6, the last): `FlowNodeInspector.specKeys.test.tsx`
now serves its `GET /api/v1/meta/object` probe from a recording double instead of
a real socket, which empties the network-escape burn-down ledger. The ledger is
therefore RETIRED with it — the guard's `KNOWN_ESCAPES` set, its attributed-stderr
branch for listed files and its known/unknown split are gone, exactly as the
ledger's own non-vacuity floor prescribed for reaching zero, and
`scripts/__tests__/network-escape-ledger.test.ts` now pins that the machinery
stays gone. The standing guard from objectui#6640 is untouched and now covers
every file: any test that reaches a real socket is red on its first run. No
published runtime code changes, so nothing to release.
