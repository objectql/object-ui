---
---

Docs only, publishes nothing: the `## Schema` blocks of
`content/docs/components/overlay/dropdown-menu.mdx` and
`content/docs/components/overlay/context-menu.mdx` are corrected to the surface
`packages/types/src/overlay.ts` actually declares. Same defect class objectui#6521
fixed on the third menu page, and more of it — all three pages publish a locally
named mirror of the shared `MenuItem` union, and these two were still wrong.

`dropdown-menu.mdx`, four rows:

| page before | authority on `origin/main` | page after |
| --- | --- | --- |
| `value?: string` | declared on **neither** arm — not `MenuCommandItem` (`overlay.ts:363-401`), not `MenuDividerItem` (`overlay.ts:409-419`), absent from both zod arms (`zod/overlay.zod.ts:149-166`); no menu renderer reads a `.value` | row deleted |
| `variant?: 'default' \| 'destructive'` | declared nowhere on the menu types. The only `variant` in `renderers/overlay/dropdown-menu.tsx` is `:130`, inside `defaultProps.trigger` — `{ type: 'button', label: 'Menu', variant: 'outline' }`, a button node, a different object than a menu item | row deleted |
| *(absent)* | `shortcut?: string` (`overlay.ts:383`, zod `zod/overlay.zod.ts:154`), **read** at `dropdown-menu.tsx:80` | `shortcut?: string` added |
| *(absent)* | `children?: MenuItem[]` (`overlay.ts:387`, zod `zod/overlay.zod.ts:155`), **read** at `dropdown-menu.tsx:58,66` — branches into `DropdownMenuSub` / `DropdownMenuSubTrigger` / `DropdownMenuSubContent`, a real submenu | `children?: DropdownMenuItem[]` added |

`context-menu.mdx`, four rows:

| page before | authority on `origin/main` | page after |
| --- | --- | --- |
| `value?: string` | same as above — undeclared on both arms; no `.value` read in `renderers/overlay/context-menu.tsx` | row deleted |
| *(absent)* | `shortcut?: string` (`overlay.ts:383`, zod `zod/overlay.zod.ts:154`), **read** at `context-menu.tsx:78`, rendered through `ContextMenuShortcut` | `shortcut?: string` added |
| *(absent)* | `children?: MenuItem[]` (`overlay.ts:387`, zod `zod/overlay.zod.ts:155`), **read** at `context-menu.tsx:56,64` — branches into `ContextMenuSub` / `ContextMenuSubTrigger` / `ContextMenuSubContent` | `children?: ContextMenuItem[]` added |
| `trigger: ComponentSchema` (required) | `trigger?: SchemaNode \| SchemaNode[]` — optional at `overlay.ts:486`, `.optional()` at `zod/overlay.zod.ts:191`. The renderer substitutes a placeholder (`context-menu.tsx:95`), so a trigger-less document is legal today, and the declaration's own doc comment records the divergence in words: "Declared OPTIONAL although the docs page shows it required" (objectui#6150) | `trigger?: ComponentSchema` |

`children` and `shortcut` are the rows that matter: declared capabilities with
working runtime that both pages hid outright, so an author reading either page
had no way to learn these menus draw nested submenus at all, or that an item can
carry a keyboard shortcut. That is the reverse of the usual docs defect and
strictly worse for an AI author, which will not emit a key the reference page
does not list. `value` and `variant` are the forward direction — keys the pages
taught and nothing on the platform has ever read.

Interface names stay localized (`DropdownMenuItem`, `ContextMenuItem`) and the
`type` tombstone stays taught as `## Dividers` prose rather than a block row —
both are house convention, measured across all three menu pages by objectui#6521's
PR and unchanged here.

Not in this diff, and deliberately not: declaring `value` or `variant` on
`MenuCommandItem`. objectui#6523 narrowed that union on purpose; widening a
published type to match a doc page would invert the fix.

No fence moved: each page holds one `plaintext` fence marker pair before and
after, so objectui#5867's SHRINK-ONLY declared population is unchanged.

Part of objectui#7073.
