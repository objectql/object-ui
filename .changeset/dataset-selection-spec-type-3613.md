---
'@object-ui/data-objectstack': patch
---

data-objectstack: type `queryDataset(selection)` as the spec's `DatasetSelection` instead of a hand-written copy

The adapter restated the selection contract inline, field by field, and the copy
had drifted three ways from the pinned `@objectstack/spec@17.0.0-rc.5`:

- **`compareTo.dimension` was required.** It has been optional since
  objectstack#5011, *because the executor resolves it*: exactly one time
  dimension carrying a `dateRange` is the one shifted, and zero or several
  raises a loud error naming the candidates. Requiring it made the compiler
  demand from every typed caller precisely the consumer-side dimension guess
  that change forbids — trading a loud executor error for a silently wrong
  comparison window. No runtime path hit this yet (the dashboard's
  `DatasetWidget` passes `selection` as `unknown`), but a declaration is a live
  instruction to anyone calling this client from TypeScript.
- **`timeDimensions` was widened to `unknown[]`**, erasing the very entry shape
  the executor's resolution reads (`{ dimension, granularity?, dateRange? }`),
  and **`runtimeFilter` to `Record<string, unknown>`**, erasing the
  `$and`/`$or`/`$not` vocabulary the server parses.
- **`dateGranularity` was missing entirely** — the copy had simply stopped at
  whatever the contract looked like the day it was written, so a typed caller
  could not bucket a trend by month at all.

The parameter is now the spec type by reference, so there is nothing left to
re-sync. The fix is the removal of the dialect rather than a correction to it:
restating a contract owned elsewhere creates a second de-facto dialect of it, and
drift is then only a matter of time (AGENTS.md #0/#0.1). `queryDataset.test.ts`
pins structural identity with `DatasetSelection` plus each of the three drifts
individually, checked by this package's `tsc --noEmit`; a runtime test pins that
a dimension-less `compareTo` reaches the server untouched, so the adapter can
never start guessing on the executor's behalf.

The response type is deliberately left alone — it is the REST envelope
(`object` / `dimensionFields` / `drillRawRows`), not a restatement of
`AnalyticsResult`.
