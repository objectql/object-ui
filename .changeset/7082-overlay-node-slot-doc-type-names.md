---
---

Docs only, publishes nothing: six component pages spelled a node slot
`ComponentSchema`, a real shipped export (`packages/types/src/blocks.ts`) that
is **not** a node slot — it is the concrete `type: 'component'` block. The keys
carry `SchemaNode` (`packages/types/src/base.ts`), which also admits
`string | number | boolean | null | undefined`. A reader who looked the
published name up found a narrow, unrelated type.

Every row is re-derived from its own declaration on `2c3cd1b`, per page — not
by a string replace, because the declarations disagree with each other on
whether the array form is admitted.

| page row before | declaration on `main` | page after |
| --- | --- | --- |
| `AlertDialogSchema.trigger: ComponentSchema` | `trigger?: SchemaNode` (`overlay.ts:91`) | `SchemaNode` |
| `ContextMenuSchema.trigger?: ComponentSchema` | `trigger?: SchemaNode \| SchemaNode[]` (`overlay.ts:486`) | `SchemaNode \| SchemaNode[]` |
| `HoverCardSchema.trigger: ComponentSchema` | `trigger: SchemaNode` (`overlay.ts:296`) | `SchemaNode` |
| `HoverCardSchema.content: ComponentSchema` | `content: SchemaNode \| SchemaNode[]` (`overlay.ts:292`) | `SchemaNode \| SchemaNode[]` |
| `DropdownMenuSchema.trigger: ComponentSchema` | `trigger: SchemaNode` (`overlay.ts:433`) | `SchemaNode` |
| `SheetSchema.trigger: ComponentSchema` | `trigger?: SchemaNode` (`overlay.ts:150`) | `SchemaNode` |
| `SheetSchema.content: ComponentSchema` | `content?: SchemaNode \| SchemaNode[]` (`overlay.ts:146`) | `SchemaNode \| SchemaNode[]` |

**`dropdown-menu` stays singular on purpose.** Its Zod mirror
(`zod/overlay.zod.ts:176`), its sibling `ContextMenuSchema`, and its own shipped
`defaultProps` (`renderers/overlay/dropdown-menu.tsx:130`) all use the array
form, and the published TS type refuses it. Which side is right is objectui#7081,
open and awaiting a maintainer decision on a published-type widening. Publishing
the array form here would have put a claim in the docs that the shipped type
rejects and pre-empted that ruling; the page therefore follows the type an
author's editor reads. The incoherence is real, and it *is* #7081.

**Two of the nine rows the card named are NOT renamed**, because no honest
docs-only edit resolves them, and both are filed instead:

- `AlertDialogSchema.actions?: ComponentSchema[]` — declared on neither the TS
  interface (`overlay.ts:78-127`) nor the mirror (`zod/overlay.zod.ts:42-55`),
  and read by nothing. Renaming it would have kept a phantom key alive under a
  second wrong type.
- `EmptySchema.action?: ComponentSchema` — declared on neither
  (`feedback.ts:210-224`, `zod/feedback.zod.ts:120-125`), but *read* by the
  shipped renderer through a cast (`renderers/feedback/empty.tsx`), which
  requires `typeof === 'object'`. `SchemaNode` admits `string | number |
  boolean`, so publishing it there would have been a new false claim, not a
  correction.

Requiredness is likewise left alone and filed: `AlertDialogSchema.trigger`,
`SheetSchema.trigger` and `SheetSchema.content` are declared optional and
published required. That is objectui#7073's defect class, already fixed by it on
`context-menu.mdx`, and is out of this card's fence.

`packages/types/src/__tests__/overlay-node-slot-doc-types-7082.test.ts` pins the
result, and this is a page where the pin is the only evidence there is: all
these rows sit in `plaintext` fences, `check:doc-snippets` compiles
`ts`/`tsx`/`typescript` only and `check:doc-types` reads only the `type` string
literals, so no gate parses them (objectui#5250, objectui#5867). A green CI run
here says "nothing else broke", not "the correction is right".

The pin's authority is the **TS declaration**, not the Zod mirror — the one
deliberate departure from the objectui#6347 model, because on this tree the two
disagree on four `trigger` rows and pinning against the mirror would have
published #7081's answer. Its type-level leg is compiled by
`packages/types/tsconfig.test.json`, so widening `DropdownMenuSchema.trigger`
turns it red and whoever lands #7081 is told this page owes an update. The two
undeclared rows and the three requiredness divergences are pinned as
divergences, so a fix on either side of any of them also turns it red.

No fence moved: each page holds one `plaintext` fence marker pair before and
after, so objectui#5867's shrink-only declared population is unchanged. No
declaration, mirror, renderer or fixture was edited.

Part of objectui#7082.
