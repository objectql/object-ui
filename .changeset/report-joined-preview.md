---
"@object-ui/app-shell": patch
---

fix(studio): preview joined reports in the report editor (was "design blind")

Found dogfooding report design in Studio as a business user. The report editor's
live preview only rendered single dataset-bound reports — a `joined` report
(which carries its data on `blocks`, with no top-level `dataset`) fell through to
the "Bind a dataset to preview this report" empty state, so an author building a
joined report saw nothing and designed blind.

`ReportPreview` now renders a joined report (≥1 dataset-bound block) through the
same runtime `ReportRenderer` (→ `DatasetReportRenderer`, which already stacks
the blocks), keeping the preview pixel-equal with the runtime, and shows a
joined-aware empty state ("Add a block…") when no block is bound yet.
