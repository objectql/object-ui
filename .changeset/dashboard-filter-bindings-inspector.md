---
"@object-ui/app-shell": minor
---

Studio dashboard widget inspector: visual `filterBindings` editor (#2578
item 4, framework#2501). When the dashboard declares filters (`dateRange` /
`globalFilters`), the widget inspector shows a "Dashboard filter bindings"
section with one row per filter: an **Apply** toggle (unticked writes
`filterBindings[name] = false`, opting the widget out) and a field picker
that re-targets the filter to one of THIS widget's fields (empty = default:
the filter's own field). Previously bindings were only configurable through
raw JSON metadata. Filter rows come from the same `resolveDashboardFilterDefs`
normalization the runtime broadcasts from, so the editor offers exactly the
filters the renderer will apply.
