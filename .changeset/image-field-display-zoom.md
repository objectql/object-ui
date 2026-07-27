---
"@object-ui/fields": patch
"@object-ui/plugin-detail": patch
"@object-ui/i18n": patch
---

fix(fields): render `image` fields consistently and add click-to-zoom (#2836)

An `image` field rendered differently — and wrongly — on three surfaces:

- **Edit form showed broken thumbnails.** A record read back its `image` value
  as a bare `sys_file` id (the reference form), but `readFileValue` returned an
  id with no URL — the comment assumed the read path expands it, which the
  edit-form data path does not. The result was `<img src="">`. `file-value` now
  derives the stable download URL (`/api/v1/storage/files/:id`, which
  302-redirects to a signed URL and works directly as `<img src>`) for a bare
  id or an id-only object, so every widget and cell renderer resolves one.
- **Inline edit leaked the raw storage URL.** `InlineFieldInput` had no branch
  for file-backed types and fell through to a plain text input showing
  `/api/v1/storage/files/…`. It now renders the same upload widgets the form
  uses (`image`/`avatar`/`signature`/`file`/`video`/`audio`).
- **Hard-coded English.** `ImageField`'s upload/crop/remove/alt strings now go
  through `t('fields.image.*')` (en + zh added).

Also adds an `ImageLightbox` — click a read-only thumbnail (detail or list cell)
to open a full-screen preview; multiple images get prev/next navigation, a
position counter and arrow-key support, a single image just the image. In a
grid cell the click is `stopPropagation`-guarded so enlarging doesn't also open
the row.
