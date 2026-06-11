---
"@object-ui/plugin-charts": patch
---

Dashboard charts no longer render blank on first paint. Recharts'
`ResponsiveContainer` was a child of a `flex … justify-center` box, so it
collapsed to content width (0) on first paint inside react-grid-layout,
measured `width(-1)` and skipped drawing until a later resize fired its
ResizeObserver. The chart wrapper is now a definite-width block in both the
dashboard chart container (`plugin-charts/ChartContainerImpl`) and the shadcn
base (`components/ui/chart`). Follow-up changeset for #1634.
