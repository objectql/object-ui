---
---

Test-only: fixed a flaky overshoot in `plugin-dashboard`'s DatasetWidget chart-bucket
drill test, where `waitFor` pinned a cumulative drill-filter render count that a late,
unrelated dimension-metadata re-render could push past 1 with no way to recover
(objectui#4718, same defect class as objectui#4706 / PR #4708). The assertion now waits
for the drill to have opened at least once and keeps its content check (which records
the drawer filtered on) as the substantive assertion. No published behaviour changes.
