---
---

Docs only, publishes nothing: four `content/docs/components` reference pages
taught props the shipped types do not have. Each correction was resolved
against a freshly built `packages/types/dist/*.d.ts` **and** against the zod
schemas that are the ruled enforcement boundary, so both layers agree:

| page | documented | shipped | declaration |
| --- | --- | --- | --- |
| `feedback/toast.mdx` | `variant?: 'default' \| 'destructive'` | `variant?: 'default' \| 'success' \| 'warning' \| 'error' \| 'info'` | `feedback.d.ts:123`, `zod/feedback.zod.js:59` |
| `form/radio-group.mdx` | `direction` | `orientation?: 'horizontal' \| 'vertical'` | `form.d.ts:377`, `zod/form.zod.js:263` |
| `form/combobox.mdx` | `searchPlaceholder`, `emptyText` | neither is declared | `form.d.ts:1283`, `zod/form.zod.js:378` |
| `form/command.mdx` | `CommandItem.shortcut` | `CommandItem` declares only `value`, `label`, `icon` | `form.d.ts:1329`, `zod/form.zod.js:76` |

`toast.mdx` is the one that mattered most: `'destructive'` is not a member of
the union, it is the Shadcn vocabulary a reader arrives with, and it is the
value most likely to be copied verbatim into an authored schema.

Each removal was checked against the renderer before it was made, because a
key a renderer genuinely reads is an undeclared capability rather than a doc
error. None of these four is read: `renderers/form/combobox.tsx` contains
neither `searchPlaceholder` nor `emptyText`, `renderers/form/command.tsx`
contains no `shortcut`, and `renderers/feedback/toast.tsx` contains no
`'destructive'`. The same sweep's genuinely-consumed keys went to
objectui#6150 instead of being edited away.

`emptyText` is removed from `ComboboxSchema` only. `CommandSchema` really does
declare it (`form.d.ts:1368`), so `command.mdx` keeps it.

No type, export or union member was minted, nothing was re-fenced, and no
block changed shape — these blocks stay `plaintext` and stay outside the
compile population. `check:doc-snippets` reports the same numbers before and
after: 248 blocks to compile, 111 declared fragments, 178 covered / 44
ungated. The import mechanism this card originally proposed is sequenced
behind objectui#5155 and is deliberately not attempted here.

Part of objectui#6143.
