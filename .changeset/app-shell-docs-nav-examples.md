---
---

Docs + test-only (objectui#4793). `content/docs/layout/app-shell.mdx`'s two `SidebarNav`
examples now spell the real `NavItem` keys — `title` instead of `label`, and the imported
Lucide **component** instead of a quoted icon name — and stop teaching a `header` /
`footer` prop that `SidebarNavProps` never declared. The examples are pinned to the real
types by `packages/layout/src/__tests__/app-shell-docs-nav-example.test.ts`.

No published behaviour changes: nothing in any package's runtime source was touched, only
the documentation page and the test that now compiles it.
