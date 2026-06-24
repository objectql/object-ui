---
"@object-ui/app-shell": patch
"@object-ui/plugin-report": patch
---

fix(studio): enable report authoring (create flow, chart render, dataset-aware inspector)

Found dogfooding report design in Studio as a business user — you could not create a report at all, plus several follow-on gaps.

- **Report create now uses the canvas + `ReportDefaultInspector`.** Only `object` was in `CREATE_MODE_CANVAS_TYPES`, so report-create fell back to a stale name-first form whose create-config (`objectName`, `columns: []`) predates the ADR-0021 dataset-bound model — saving failed server validation (*"a report needs `dataset` + `values`"*) with no field to fix it. Add `'report'` to the canvas set; the inspector exposes an auto-derived snake_case Name in create mode; fix the create-config (drop `objectName`/`columns`, seed `type: 'summary'` + `drilldown: true`).
- **Preserve `?package=` on post-create navigation** — it was dropped, so the editor reloaded a blank draft in the user's default package.
- **Render a report's embedded `chart`** in `DatasetReportRenderer` (authorable in Studio but never rendered) via the lazily-registered generic chart component; requests a non-animated render for export/background-tab safety.
- **Dedicated Chart panel in the inspector** — chart type + dataset-aware X-Axis (dimension) / Y-Axis (measure) dropdowns + title, replacing free-text axis fields and the vague "Chart: Required text value" validation.
