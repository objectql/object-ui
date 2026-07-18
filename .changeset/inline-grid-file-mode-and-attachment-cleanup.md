---
"@object-ui/plugin-form": minor
"@object-ui/plugin-detail": patch
---

fix(form+detail): keep single-file children as inline grids; drop non-spec `attachment` handling

Two follow-ups to the upload-in-grid work (objectui#2360):

- **#2654** — Now that `file`/`image`/`avatar` fields render a compact upload
  cell in the line-item grid, a child object with a *single* such field no
  longer flips the smart `inlineEdit` default to a per-row form. `resolveInlineMode`
  splits the old `FORM_ONLY_TYPES`: truly form-only types (textarea / richtext /
  html / markdown / json / location / address) still tip to `form` on their own,
  while file-family types only tip when several rich fields pile up
  (`RICH_FIELD_FORM_THRESHOLD`, default 2). An explicit `inlineEdit` always wins.

- **#2655** — `attachment` is not a `@objectstack/spec` field type (the spec
  media types are file/image/avatar/video/audio), so the renderer no longer
  models it: removed from `fieldTypeToColumnType`, the inline-mode heuristic, and
  `RelatedList`'s auto-column `SKIP_TYPES`. Contract-first cleanup — the renderer
  stops fossilizing a phantom type (AGENTS.md #0.1).
