---
'@object-ui/plugin-view': patch
---

A host-composed `tree` view is now labelled with the tree icon in `ObjectView`'s
view switcher instead of the grid one, and the `tree` / `chart` view types are
recorded as host-composition-only surfaces (objectui#5321).

`viewSwitcherSchema`'s `iconMap` carried an entry for every view type except
`tree`, so a tree view fell through to the `|| 'table'` fallback and was drawn
with the grid glyph. objectui#2916 fixed exactly this once, for `chart`, by
adding a single key — nothing recorded that the map had to be COMPLETE, so the
next missing member went unnoticed. The map is now typed
`Record<ViewType, string>`, which is how `ViewSwitcher`'s own
`DEFAULT_VIEW_ICONS` (the consumer of these strings) has always been declared:
a future `ViewType` member fails `type-check` rather than silently rendering as
a grid. The `tree` value is `'list-tree'`, the same `ListTree` glyph
`DEFAULT_VIEW_ICONS` already names for this view type, and the runtime fallback
stays for host props that carry an unrecognised type. Reached in practice by
the console, whose `CreateViewDialog` offers `tree` among the view types a user
can create.

No authoring surface changes. `generateViewSchema` renders eight view types
while `ObjectViewSchema.defaultViewType` and `NamedListView.type` admit six of
them, so `tree` and `chart` are selectable only through the component's `views`
prop. The maintainer ruled on 2026-08-20 that both stay recorded as
host-composition-only rather than being added to those unions, following the
objectui#5097 precedent; the record now lives beside that one, with the branch
set derived from a source fence, the authored unions pinned at the type level,
and host reachability measured.
