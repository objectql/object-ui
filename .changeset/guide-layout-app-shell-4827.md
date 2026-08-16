---
---

Docs + test-only (objectui#4827). `content/docs/guide/layout.md`'s `app-shell` material
taught seven keys `AppShellProps` has never declared — `header`, `body`,
`sidebarCollapsible`, `sidebarDefaultOpen`, `headerClassName`, `sidebarClassName`,
`contentClassName` — across six blocks, and its carrier was JSON: `app-shell` is
registered with no `inputs`, so `sdui-parser`'s unknown-prop check had nothing to compare
a node against and copied metadata was dropped with no diagnostic at all.

The page now teaches `AppShell` as the React component it is, with a props table read
against the interface, and states measured facts about what a JSON `app-shell` node does
with each key: `className` / `defaultOpen` / `branding` survive, `children` is stripped by
`SchemaRenderer` so `<main>` renders empty in silence, and a schema in `sidebar` / `navbar`
/ `rightRail` reaches the component as a plain object React refuses to render.

Pinned by `packages/layout/src/__tests__/guide-layout-app-shell-doc.test.ts`, whose
expected key list is read out of `packages/layout/src/AppShell.tsx` on every run.

No published behaviour changes: no package's runtime source was touched, only the
documentation and the test that compiles and scans it.
