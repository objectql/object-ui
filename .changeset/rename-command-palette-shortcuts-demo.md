---
---

Rename the `components-form-command/command-palette-with-shortcuts` catalog demo to
`components-form-command/file-command-palette`, so its id, title and docs heading name what
the fixture actually renders after objectui#6157 removed the invented `shortcut` key. The
docs heading, the generated catalog index and the fixture test follow the rename.

No published behaviour changes: the two `@object-ui/components` files touched are a code
comment and a test name that spelled the old filename.
