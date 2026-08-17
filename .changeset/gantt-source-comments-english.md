---
---

Comment-only: the remaining six non-test source files in `@object-ui/plugin-gantt`
(`GanttView.tsx`, `ObjectGantt.tsx`, `shifts.ts`, `scheduling.ts`, `ResourceWorkload.tsx`,
`workload.ts`) now carry English comments throughout — Commandment #-1 covers code
comments, not just user-facing text. This is the sequel to objectui#4021 / PR #4883,
which did the same for `QuickFilterBar.tsx` in the same package.

Comments that named a UI label now point at the `gantt.*` bundle key that actually
resolves it (`gantt.toolbar.saveLayout`, `gantt.menu.removeDependency`,
`gantt.conflict.confirm`, …) instead of quoting a Chinese literal that no call site
holds any more, and one comment block that had drifted above the wrong dialog was moved
back over the JSX it describes. No behaviour change — every one of the six files is
byte-identical after comment stripping, so no shipped code, type, or string was touched
(objectui#4884).
