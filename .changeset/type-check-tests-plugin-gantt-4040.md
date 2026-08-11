---
---

Releases nothing on purpose: `@object-ui/plugin-gantt` now type-checks its 41 test files
(`tsconfig.test.json` chained from `type-check`), and its `TEST_DEBT` entry is gone. Only
test sources changed; no published behaviour, and no public type, moved.

All three declared code-tier errors were real:

- `GanttView.scales.test.tsx` carried hand-written copies of `MS_PER_DAY` and
  `NOMINAL_DAYS`, both of which `GanttView.tsx` exports, under a header claiming it
  recomputes expectations with "the same linear ms→px mapping the component uses". The copy
  had already drifted — `NOMINAL_DAYS` grew a `year` entry the fork never did, which is what
  the compiler reported (`TS2741`). Both are imported now, so "the same" is true by
  construction.
- `GanttView.summaryedit.test.tsx` stubbed `onTaskUpdate` with a bare `vi.fn()`, typing
  `mock.calls` as `any[][]` — arrays of unknown length — while the assertions destructure
  `[task]` and read `call[1]`. The spies are typed to the handler signature the helper
  already declares.
