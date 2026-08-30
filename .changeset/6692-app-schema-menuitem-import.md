---
---

Docs-only fix: `content/docs/core/app-schema.mdx`'s "Global Actions" snippet imported the
wrong same-named `MenuItem`. `import type { MenuItem } from '@object-ui/types'` resolves to
the **overlay** union (`overlay.ts`, re-exported bare at `index.ts:255`) — the type behind
`ui:dropdown-menu`/`ui:context-menu`/`ui:menubar`. But `AppAction.items` (`app.ts:728`) is
declared inside `app.ts`, so it resolves to that file's own legacy navigation-item
`MenuItem` (`app.ts:461` — `type`/`path`/`href`/`badge`/`hidden`), which the barrel
re-exports renamed as `AppMenuItem` (`index.ts:59`) precisely to avoid this collision. The
snippet now imports `AppMenuItem`, so a reader compiles against the shape the field really
has.

The two types are mutually incompatible, not merely differently named: the overlay union
declares `type?: never` on both arms (dividers are `{ separator: true }` since
objectui#6523), so the `{ "type": "separator" }` item the same page documents is *refused*
by the type the snippet used to name.

⚠️ Note for anyone re-reading the original finding: `import type { MenuItem as AppMenuItem }`
does **not** fix this. That spelling imports the bare (overlay) export and only renames it
locally, leaving the defect in place while looking repaired. `AppMenuItem` is already the
barrel's export name, so the correct import is `import type { AppMenuItem }`.

No published behaviour changes; no gate flips red→green (the snippet is a bare type
reference, so it compiled either way).
