---
---

Docs only, publishes nothing: the last five `content/docs/components` reference
pages annotating an event prop as `string | ActionConfig` are corrected. These
are the five objectui#6122 measured as having **no declared slot at all** (the
other eleven were renamed in #6130/#6142), and the maintainer ruled Option A on
2026-08-25: documentation follows the shipped types.

Two different remedies, because the two cases are not the same defect:

**Deleted — nothing declares them, at any level:**

| page | documented prop | shipped type |
| --- | --- | --- |
| `feedback/sonner.mdx` | `action?: { label; onClick }` | `SonnerSchema` declares no `action` (`packages/types/src/feedback.ts:204`) |
| `basic/button-group.mdx` | `onValueChange` | `ButtonGroupSchema` declares only `type`/`buttons`/`variant`/`size` (`packages/types/src/navigation.ts:335`) |

**Redirected — the real slot is one level down, on the item:**

`overlay/context-menu.mdx`, `overlay/dropdown-menu.mdx` and `overlay/menubar.mdx`
documented a menu-level `onSelect`. None of the three menu schemas declares any
event slot (`DropdownMenuSchema` declares `onOpenChange` and nothing else). The
handler is declared on the **item**, and that declaration is real:

```ts
// packages/types/src/overlay.ts:330-357 (jsdoc elided except on onClick)
// built: packages/types/dist/overlay.d.ts:334 -- the line objectui#6132 cited
export interface MenuItem {
  label: string;
  icon?: string;
  disabled?: boolean;
  /**
   * Click handler
   */
  onClick?: () => void;
  shortcut?: string;
  children?: MenuItem[];
  separator?: boolean;
}
```

declared at `packages/types/src/overlay.ts:346` and mirrored in Zod at
`packages/types/src/zod/overlay.zod.ts:136`
(`onClick: z.function().optional().describe('Click handler')`). `MenuItem` is the
element type of `DropdownMenuSchema.items`, `ContextMenuSchema.items` and
`MenubarMenu.items`, so all three pages redirect to the same declaration rather
than losing the capability.

The `string |` half goes with the name in every case: objectui#4453 narrowed the
runtime to `typeof === 'function'`, so an authored string handler is dropped. A
reference page promising `string | Fn` is what makes an AI author emit a handler
that validates, publishes, and silently does nothing.

No type was minted to make the prose true, and no fence moved: the five pages
hold 10 `plaintext` fence markers before and after, so objectui#5867's
SHRINK-ONLY declared population is unchanged.

Part of objectui#6132 (maintainer ruling of 2026-08-25, Option A).
