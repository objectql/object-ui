---
"@object-ui/plugin-form": minor
"@object-ui/plugin-view": minor
"@object-ui/app-shell": minor
"@object-ui/types": minor
---

feat: adaptive record surface + semantic field span + responsive columns (framework#2578)

Field-heavy objects (all metadata is AI-authored) now present themselves without
any authored presentation config:

- **Adaptive surface** — a record's create/edit/detail opens as a full page when
  the object is field-heavy, or a drawer when it is light. Derived from field
  count (`deriveRecordSurface`), not authored; mobile always pages. Wired into the
  app-shell ObjectView detail navigation (an authored view/object `navigation`
  still wins).
- **Semantic field span** — `FormField.span` (`auto`/`full`) is a width primitive
  decoupled from the (per-surface derived) column count; legacy `colSpan` is
  clamped so it never overflows. `ObjectForm` now honours per-section `columns`
  and carries `span`/`colSpan` from section defs — fixes the bug where
  `type:'simple'` ignored `section.columns` and grouped fields rendered single
  column.
- **Responsive columns** — `inferColumns` scales the column CAP with field count
  (≤3→1, ≤8→2, ≤15→3, 16+→4); the ACTUAL column count follows the form's real
  width via CSS container queries, so the same form goes 1→2→3→4 columns as a
  drawer widens or becomes a page.
- **Runtime overlay width** — `NavigationConfig.size` bucket is resolved to a
  viewport-clamped width at runtime (`overlayWidthFor`); a pixel width is never
  authored (the author cannot know the client viewport).
