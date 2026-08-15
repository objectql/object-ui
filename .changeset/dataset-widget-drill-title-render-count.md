---
---

Test-only: fixed a flaky overshoot in `plugin-dashboard`'s DatasetWidget drill-title
tests, where `waitFor` pinned a cumulative drawer-render count that a late, unrelated
dimension-metadata re-render could push past 1 with no way to recover (objectui#4706).
The assertions now wait for the drawer to have opened at least once and keep their
content check (the drawer title/filter) as the substantive assertion. No published
behaviour changes.
