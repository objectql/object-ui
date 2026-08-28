---
'@object-ui/plugin-dashboard': patch
'@object-ui/plugin-map': patch
'@object-ui/app-shell': patch
---

Each package's README now states, up front, that it needs a bundler: importing it from plain Node ESM fails, and that is a supported-configuration boundary rather than a defect.

`@object-ui/plugin-dashboard` imports `react-grid-layout/css/styles.css` at module
scope and `@object-ui/plugin-map` imports `maplibre-gl/dist/maplibre-gl.css`;
`@object-ui/app-shell` reaches the first of those through the static
`@object-ui/plugin-dashboard` imports in `DashboardView` and `ReportView`. Node has
no loader for `.css` at all, so all three resolve and then die during evaluation:

```
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".css"
  for .../react-grid-layout/css/styles.css
```

Nothing about how these packages load has changed — every supported host bundles
them (Vite, webpack, or Next with the package in `transpilePackages`), and that is
still the only supported way to consume them. What changed is that the boundary is
now written where a consumer meets it, instead of being learned from a red import.

objectui#5384 ruled unbundled Node consumption **unsupported** for style-carrying
plugin packages — permanently, over the three packages as a group — rather than
moving the stylesheet imports out of module scope. No unbundled-Node consumer
exists, and buying permanent machinery to close a capability gap nobody is pulling
on was the trade the ruling declined. A real consumer request reopens it as a
design question, not as a defect: the READMEs say so and name the issue.
