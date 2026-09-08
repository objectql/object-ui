---
'@object-ui/plugin-detail': patch
---

A masked detail row no longer offers to copy its value (objectui#8440, maintainer
ruling 2026-09-08, option A).

`@object-ui/fields` renders `password` and `secret` cells as `••••••` — the cell
deliberately refuses to show the value. `DetailSection` offered click-to-copy on that
same row anyway and handed the **raw** credential to the clipboard: silently, with no
error and no visible sign. A masked cell that copies in the clear is worse than an
unmasked one, because the reader believes the value is protected.

Rows whose field type is masked are now not copy-interactive at all: no row click, no
Enter/Space, no hover copy button, in either the desktop or the mobile row layout. The
alternative — copying the bullets — was considered and refused as a second silent wrong
answer.

The refusal is a separate gate, deliberately **not** spelled into `canCopy`: that name
is one of the readers of the shared emptiness authority (`hasCellValue`), and a masked
row is not an empty one. Emptiness classification, the "Show N empty fields" counter,
the auto-hide heuristic and every ordinary row's clipboard payload are unchanged.

Like the editability gates beside it, the new gate reads the view's authored `type` and
the object schema's `type` separately and answers their **union**, so a presentation
override can withdraw the affordance but never restore it on a credential column.
