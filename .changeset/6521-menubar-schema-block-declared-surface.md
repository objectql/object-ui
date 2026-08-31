---
---

Docs only, publishes nothing: `content/docs/components/overlay/menubar.mdx`'s
`## Schema` block is corrected to the surface `packages/types/src/overlay.ts`
actually declares. Three rows, each with its declaration:

| page before | authority on `origin/main` | page after |
| --- | --- | --- |
| `value?: string` | declared on **neither** arm — not `MenuCommandItem` (`overlay.ts:363-400`), not `MenuDividerItem` (`overlay.ts:409-421`), and no menu renderer reads a `.value` | row deleted |
| *(absent)* | `children?: MenuItem[]` (`overlay.ts:387`, zod `overlay.zod.ts:155`), drawn as a real submenu by `renderers/overlay/menubar.tsx:35-39` | `children?: MenubarItem[]` added |
| `menus: MenubarMenu[]` (required) | `menus?: MenubarMenu[]` (`overlay.ts:511`, `.optional()` at `overlay.zod.ts:208`), and the renderer optional-chains it (`menubar.tsx:28`) | `menus?: MenubarMenu[]` |

`children` is the one that matters: a declared capability with working runtime
that the page hid, so an author reading this page had no way to know menubar
draws submenus at all. `value` is the reverse — a key the page taught, the
catalog fixtures duly authored 21 times, and nothing on the platform has ever
read. `MenuItemSchema`'s arms are bare (non-strict) `z.object`s, so zod strips
`value` and reports success: the class of blindness objectui#5250 records.

The `## Dividers` prose also picks up the `type` tombstone sentence that
`overlay/dropdown-menu.mdx` and `overlay/context-menu.mdx` already carry, so all
three menu pages now say the same thing about the retired
`{ "type": "separator" }` spelling being a parse-time refusal (objectui#6523)
rather than a silent strip.

Not in this diff, because objectui#6523 already landed them: `label` required,
`shortcut?: string` (not an array), the `separator: true` divider arm, and the
removal of the excluded menu-level handler line. Anyone holding the card's
six-row "actually shipped" table is reading a measurement taken at `50f987f9a`,
before that union existed.

No fence moved: the page holds one `plaintext` fence marker pair before and
after, so objectui#5867's SHRINK-ONLY declared population is unchanged.

Part of objectui#6521.
