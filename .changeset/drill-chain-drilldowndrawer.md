---
"@object-ui/plugin-dashboard": patch
---

fix(dashboard): complete the drill chain in the shared DrillDownDrawer

The chart and KPI drill-through record lists already let you click a row to open
that record, but the shared `DrillDownDrawer` (used by **pivot** and **dataset**
widget drill-through) did not — so the segment → list → record chain was
inconsistent across widget types. `DrillDownDrawer` now enables record drill on
its filtered list (dialog target, stacking over the drawer), so every
drill-through list lands on a clickable record.
