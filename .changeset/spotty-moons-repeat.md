---
'@object-ui/plugin-calendar': patch
'@object-ui/plugin-form': patch
'@object-ui/plugin-grid': patch
'@object-ui/plugin-kanban': patch
'@object-ui/app-shell': patch
---

Rename four component-props types off the names `@objectstack/spec` starts owning in
17.0.0, keeping the old spellings as deprecated aliases. No behaviour changes and no
importer breaks.

`@objectstack/spec/ui` exports `ObjectCalendarProps`, `ObjectFormProps`, `ObjectGridProps`
and `ObjectKanbanProps` from 17.0.0, where each is the AUTHORED props document of the
matching element — a serialisable authoring surface (`z.input< typeof
ObjectGridPropsSchema >`). The same-named interfaces here are the RENDERERS' props: a live
`dataSource`, records pre-fetched by a parent, and the host callbacks. Two different things
under one word, so the local ones are renamed rather than derived, following the split this
repo already made for `PageHeaderProps` -> `PageHeaderComponentProps` and the
`Record*ComponentProps` family in `@object-ui/types`:

| package | new name | old name |
|---|---|---|
| `@object-ui/plugin-calendar` | `ObjectCalendarComponentProps` | `ObjectCalendarProps` |
| `@object-ui/plugin-form` | `ObjectFormComponentProps` | `ObjectFormProps` |
| `@object-ui/plugin-grid` | `ObjectGridComponentProps` | `ObjectGridProps` |
| `@object-ui/plugin-kanban` | `ObjectKanbanComponentProps` | `ObjectKanbanProps` |

Every old name is still exported from its package barrel as a `@deprecated` alias denoting
the SAME type, pinned per package by `spec-symbol-4650.test.ts`, so existing imports keep
compiling. New code should use the `ComponentProps` spelling.

`@object-ui/app-shell` carries no API change: its `SECRET_MASK` — the ADR-0100 credential
read mask, which 17.0.0 moves into `@objectstack/spec/data` — is renamed to
`OBJECTUI_SECRET_MASK` at its declaration in `views/metadata-admin/widgets.tsx`. That
constant is package-internal and is not re-exported from the barrel, so nothing published
changes; the rename exists so the local copy cannot be read as the spec's own definition
while this repo is still pinned below the release that exports it.
