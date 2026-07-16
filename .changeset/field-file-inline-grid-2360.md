---
"@object-ui/fields": minor
"@object-ui/plugin-form": minor
"@object-ui/plugin-detail": minor
---

feat(fields+form+detail): file/image uploads in inline line-item grids (#2360)

`Field.file` in a master-detail inline grid previously degraded to a plain text
input (no `input[type=file]` on the page → no way to upload from the grid), and
auto-derived subform / related-list columns silently dropped file fields.

- **fields**: new `FileCell` — a compact upload control for grid cells (upload
  button + removable chips, image thumbnails), sharing the `UploadProvider`
  pipeline with the full-size `FileField` via an extracted `useFileUploads`
  hook. `GridField` supports `type: 'file'` columns (with `accept` /
  `multiple`), renders file names in list/readonly modes, and no longer falls
  back to a text `<Input>` for file columns.
- **plugin-form**: `deriveColumns` / `hydrateColumns` no longer exclude
  `file`/`image`/`avatar` fields — they map to `file` columns and carry the
  field's `multiple` + `accept` (image fields default to `['image/*']`).
- **plugin-detail**: auto-derived related-list columns no longer skip
  `file`/`image` fields — they render through the existing FileCellRenderer /
  ImageCellRenderer (file-name chip / thumbnail).
