---
'@object-ui/app-shell': patch
'@object-ui/plugin-list': patch
---

fix(app-shell,plugin-list): a list view's own `description` now reaches the screen

A `description` authored on a per-list-view entry (`listViews.<viewName>.description`)
was validated, built and served correctly, then silently never rendered. Two
independent cuts, both fixed here:

- **app-shell** — `ObjectView`'s `renderListView` relay copied ~46 keys off the
  active view onto the schema it hands `ListView` (`label`, `sort`, `filter`,
  `hiddenFields`, `inlineEdit`, `color`, `allowExport`, …) but had no rung for
  `description`, so the renderer could only ever see the object-level list's
  description and a per-view one was unreachable. It is relayed now, with the
  same two-rung shape as `label`. This is *not* the object's own
  `objectDef.description`, which stays the page header's subtitle.
- **plugin-list** — `ListView` rendered `typeof description === 'string' ? … : ''`,
  a type test rather than a resolution. `ListViewSchema.description` is
  `I18nLabel`, so an inline locale map (`{ en, 'zh-CN' }`) — metadata the spec
  entitles an author to write — rendered a blank strip in every locale. It now
  resolves through the same shared helper the sibling `label` uses, and the
  visibility guard reads the resolved text, so a map with no usable entry drops
  the strip instead of reserving empty space for it.

`appearance.showDescription: false` still suppresses the description in both arms.
