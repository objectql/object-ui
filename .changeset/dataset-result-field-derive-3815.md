---
'@object-ui/core': minor
---

`DatasetResultField` is now `@objectstack/spec`'s `AnalyticsResult.fields[]` element itself, not a hand-written restatement of it

`packages/core/src/utils/dataset-format.ts` declared its own six-key interface for the analytics result column, under a doc comment describing the server's contract. The key set happened to match the spec today, so nothing was broken — but it was the last surviving member of the derive-don't-restate family (#3613 / #3753 on the parameter side, #3752 on the adapter return side), and it was the member with no compile-time tripwire: three surfaces (`plugin-dashboard`'s `DatasetWidget`, `plugin-report`'s `DatasetReportRenderer`, app-shell's `DatasetPreview`) consume this name AS the real column type, so the next spec column key would simply never appear here and no build would complain. It is now `AnalyticsResult['fields'][number]`, so it cannot lag the contract again.

**Consumer-visible type tightening (the reason this is a minor, not a patch).** The restatement had relaxed `type` to optional; the contract requires it. Anything that assigned a column literal without `type` — or a bare `{ name, label?, format? }` — to `DatasetResultField` will now fail to compile, and the fix is to supply the `type` the server always sends. Nothing in this repo needed changing: every value of this type originates in `ObjectStackAdapter.queryDataset`, which already declares the spec element, and no consumer reads `.type` at all, so the widening had bought no caller anything while advertising a `string | undefined` the wire never produces. Marked `minor` per the repo's bump policy, which reserves `major` for following `@objectstack/spec` across a major.

The exported name is unchanged and the `PercentScale` re-export from this module is untouched, so existing import paths keep working. `packages/core/tsconfig.typetests.json` (chained off the package's `type-check`) compiles the new parity test, so the pins are checked by CI rather than merely written down — including a negative pin that goes red if the hand-written interface is ever restored, and the `ChartResultField` superset relationship the module's comment claims.
