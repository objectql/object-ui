---
---

Docs + test-only (objectui#4817). `packages/layout/README.md`'s `AppShell` examples now
pass `navbar` — the component's only top-bar slot — instead of a `header` prop that
`AppShellProps` has never declared. `AppShell` destructures a fixed key list with no rest
element, so the node was built and dropped: every reader who copied the npm landing page's
snippet got a permanently empty top bar. The "Usage with React Router" fence had the same
defect, and "Customization" taught `headerClassName` / `sidebarClassName`, neither of which
exists either. The README also gains an `AppShellProps` key table, and all of it is pinned
to the real interface by `packages/layout/src/__tests__/readme-app-shell-example.test.ts`.

No published behaviour changes: no package's runtime source was touched, only the
documentation and the test that now compiles and scans it.
