---
'@object-ui/layout': patch
---

`SidebarNav`'s README example teaches the shape the component actually reads.

`packages/layout/README.md` — the package's npm landing page, shipped in `files` —
spelled every nav item `{ label, path, icon: 'home' }`. `NavItem` declares none of
those three keys: the label is `title`, the target is `href`, and `icon` is a
`React.ComponentType` rendered as `<item.icon />`, not an icon name. Copied
verbatim the example produced a sidebar whose every row was unlabelled
(`<span>{item.title}</span>` reading `undefined`), a `NavLink` with
`to={undefined}`, and the string `'home'` handed to React as an unknown lowercase
tag. Both README examples now use `title` / `href` / imported Lucide components,
and annotate the array as `NavItem[]` so the same class of typo becomes a compile
error where it is written instead of a blank sidebar at runtime.

Adds the props tables the README never carried — `SidebarNavProps`, `NavItem`
(`badge`, `badgeVariant` and `children` included) and `NavGroup`, plus a grouped
and nested example — and pins all of it rather than leaving a second surface free
to rot the same way: the examples are real, type-checked code in
`readme-sidebar-nav-example.test.ts` asserted to appear verbatim in the README, and
the tables are compared against the interface keys read out of `SidebarNav.tsx` on
every run. Also corrects a comment in `side-effects-manifest.test.ts` that named
`SidebarNav` as the component behind the `navigation-renderer` registration; that
key belongs to a different component, and `SidebarNav` is registered under no key
at all.

No runtime change — `SidebarNav.tsx` is untouched. This is `patch` rather than a
no-release declaration because the corrected landing page only reaches npm through
a publish.
