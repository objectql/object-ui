---
"@object-ui/core": minor
"@object-ui/types": minor
"@object-ui/plugin-list": minor
"@object-ui/plugin-view": minor
"@object-ui/app-shell": minor
---

feat(views): the list toolbar speaks one vocabulary — `userActions` (#2890 scope A step 3)

The seven bare `show*` toolbar flags fold into the spec's `userActions`, and the
renderer reads nothing else. `showDescription` folds into
`appearance.showDescription` at the same boundary.

| legacy | canonical |
| :--- | :--- |
| `showSearch` / `showSort` / `showFilters` / `showDensity` | `userActions.search` / `.sort` / `.filter` / `.rowHeight` |
| `showGroup` / `showHideFields` / `showColor` | `userActions.group` / `.hideFields` / `.rowColor` |
| `showDescription` | `appearance.showDescription` |

**The last three are new keys, and they close a capability hole rather than just
renaming one.** `@objectstack/spec`'s `UserActionsConfigSchema` documents itself
as "which interactive actions are available to users in the view toolbar — each
boolean toggles the corresponding toolbar element on/off", and already carries
`rowHeight` (objectui's `showDensity` under its spec name). Grouping, column
visibility and row coloring are the same kind of toggle: the spec models all
three as *configuration* (`grouping`, `hiddenFields`, `rowColor`) but has no
"may the user change it" switch for any of them.

The consequence was visible in the product. With no `userActions` key to read,
the two list surfaces **hardcoded opposite policies**: `InterfaceListPage` (the
author-curated interface page) pinned all three OFF, `ObjectDataPage` pinned two
ON — and an interface-page author could not turn grouping back on for end users
at all. Both surfaces now express their policy as `userActions` defaults, which
an author can override.

Until the keys land in `@objectstack/spec`, `@object-ui/types` carries them as a
documented `.extend()` on `UserActionsConfigSchema` (the same shape
`ListColumnSchema` uses while waiting on objectstack#3761); it collapses into a
plain re-export once they do. Note the spec schema is not `.strict()`, so before
this an author writing `userActions: { group: false }` had it **silently
stripped** — valid on parse, no effect at render.

Defaults are unchanged and deliberately asymmetric, matching what these flags
have always done: `search` / `sort` / `filter` / `rowHeight` / `group` are on
unless turned off; `hideFields` / `rowColor` are off unless turned on. Making
them uniform would grow two buttons on every existing view, so it is left as its
own product decision rather than smuggled into a vocabulary migration.

Also drops a dead relay in app-shell's `ObjectView`, which forwarded
`showDescription` onto the node although `ListView` has only ever read
`appearance.showDescription`.
