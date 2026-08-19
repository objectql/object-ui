---
'@object-ui/plugin-gantt': patch
---

Fix the `GanttViewMode` JSDoc to name all five granularities (objectui#5132).

The comment above `export type GanttViewMode` said "one column per day, week,
month, or quarter" while the type itself, `VIEW_MODES`, `NOMINAL_DAYS`
(`year: 365.25`), the column builder, the toolbar and the header-band logic
have honored a fifth member, `'year'`, all along — `'year'` was fully live,
just undocumented. Doc-only change, no behavior difference.
