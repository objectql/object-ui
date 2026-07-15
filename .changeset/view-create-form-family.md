---
"@object-ui/app-shell": minor
---

feat(metadata-admin): create form-family views through the View create UI (#2323)

`ViewItemSchema` is a discriminated union on `viewKind` (`list` | `form`), but the
View create form could only ever emit `viewKind: 'list'` — its `createBuildBody`
hardcoded the family and routed the chosen `kind` straight into `config.type`, so
form-family views were unreachable through the create UI.

- **Create schema** now asks for the **view family** up front (`viewKind`:
  List / Form) and offers the layout types appropriate to that family — the
  existing list layouts (grid / kanban / gallery / calendar / timeline / gantt /
  chart) for `list`, and the `FormViewSchema` layouts (simple / tabbed / wizard /
  split / drawer / modal) for `form`.
- **`createBuildBody`** discriminates on `viewKind`: a form view builds a
  `FormViewSchema` config (`{ type, data, sections: [] }`) instead of the list
  `{ type, columns: [], data }`. Both build outputs validate against the real
  `@objectstack/spec` `ViewItemSchema`.
- **SchemaForm** flat (create) rendering now honors per-property `visibleOn`, so
  the list-layout picker shows only for List and the form-layout picker only for
  Form. Additive and a no-op when a property has no predicate.
