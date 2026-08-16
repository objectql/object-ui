---
---

Docs + test-only (objectui#4840, objectui#4842). `content/docs/guide/layout.md` taught a
`{ "type": "sidebar-nav" }` JSON node across three blocks. That key is registered nowhere
in this repo — `registerLayout()` registers `page-header`, `page:card`, `app-shell`,
`responsive-grid`, `navigation-renderer` and `app-schema-renderer` — so the node does not
resolve at all and the renderer replaces the whole sidebar with its red
`Unknown component type: sidebar-nav` panel (OBJUI-001), measured on this tree. The page's
`Schema API` block was wrong about the component's own shape in seven ways as well:
`label` for `title`, `icon` as an icon name rather than a component, a nested `items` for
`children`, invented `active` / `disabled` / `defaultOpen`, `collapsible` typed as a
boolean when it is the union of `offcanvas` / `icon` / `none`, and the real `title` prop
missing entirely.

The SidebarNav material now teaches the React component it is, with props tables read
against `SidebarNavProps` / `NavItem` / `NavGroup`, and points at `navigation-renderer`
as the navigation path that genuinely is authorable in JSON.

The same page's Responsive Behavior section promised a sidebar toggle button in the
header. The AppShell header renders `navbar` and nothing else, so on a phone the sidebar
had no way to open at all — the fact `content/docs/layout/app-shell.mdx` already stated
correctly. Auditing the rest of that section found its three-tier structure fictional:
the layout has exactly one breakpoint, at 768px, and never reads `lg`; the header is
`h-14` at every breakpoint rather than a compact variant. The section now describes the
one real boundary and tells readers to render a `SidebarTrigger` themselves.

Pinned by `packages/layout/src/__tests__/guide-layout-sidebar-nav-doc.test.ts`, whose
expected key lists are read out of `packages/layout/src/SidebarNav.tsx` on every run.

No published behaviour changes: no package's runtime source was touched, only the
documentation and the test that compiles and scans it.
