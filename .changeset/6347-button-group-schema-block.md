---
---

Docs only, publishes nothing: `content/docs/components/basic/button-group.mdx`
published a `ButtonGroupSchema` / `ButtonGroupButton` surface that disagreed
with the shipped types in **both** directions. objectui#6347 named the two
over-statements; re-measuring the whole fence against
`packages/types/src/navigation.ts`, `packages/types/src/base.ts` and their Zod
mirrors found eleven rows.

Over-stated — documented, never declared:

| page before | shipped declaration | page after |
| --- | --- | --- |
| `ButtonGroupSchema.value?: string \| string[]` | not declared (`navigation.ts:335-351`, `zod/navigation.zod.ts:154-159`) | removed |
| `ButtonGroupSchema.selectionMode?: 'single' \| 'multiple' \| 'none'` | not declared (same two blocks) | removed |
| `ButtonGroupButton.value: string` (required) | not declared (`navigation.ts:305-330`, `zod/navigation.zod.ts:142-149`) | removed |
| `ButtonGroupButton.icon?: string` | not declared (same two blocks) | removed |
| `buttons: ButtonGroupButton[]` (required) | `buttons?: ButtonGroupButton[]` (`navigation.ts:340`, `.zod.ts:156`) | `buttons?:` |
| `label?: string` | `label: string` — required (`navigation.ts:309`, `.zod.ts:143`) | `label:` |

Under-stated — declared, never documented:

| page before | shipped declaration | page after |
| --- | --- | --- |
| `ButtonGroupButton` had no `variant` row | `variant?: 'default' \| 'secondary' \| 'destructive' \| 'outline' \| 'ghost' \| 'link'` (`navigation.ts:313`, `.zod.ts:144`) | added |
| `ButtonGroupButton` had no `size` row | `size?: 'default' \| 'sm' \| 'lg' \| 'icon'` (`navigation.ts:317`, `.zod.ts:145`) | added |
| `ButtonGroupButton` had no `onClick` row | `onClick?: () => void` (`navigation.ts:325`, `.zod.ts:147`) | added, annotated as a runtime slot |
| `ButtonGroupButton` had no `className` row | `className?: string` (`navigation.ts:329`, `.zod.ts:148`) | added |
| `ButtonGroupSchema.variant?: 'default' \| 'outline' \| 'ghost'` | six members (`navigation.ts:345`, `.zod.ts:157`) | `secondary`, `destructive`, `link` restored |
| `ButtonGroupSchema.size?: 'sm' \| 'default' \| 'lg'` | four members (`navigation.ts:350`, `.zod.ts:158`) | `icon` restored |
| `disabled?: boolean` | `BaseSchema.disabled?: boolean \| string` (`base.ts`, `zod/base.zod.ts:190`) — `ButtonGroupSchema` does **not** redeclare it | `boolean \| string` |

Both directions are one defect class with the sign flipped. Fixing only the
direction a card happens to notice is what left these omissions sitting beside
two earlier corrections to the same page (objectui#6132, objectui#6143).

The `disabled` row deserves its own note, because it looks like a convention and
is not. Fourteen `content/docs/components/**` pages spell a component schema's
own `disabled` as `boolean` — but **thirteen of those fourteen schemas redeclare
`disabled?: boolean` themselves** (`ButtonSchema`, `SelectSchema`,
`SwitchSchema`, `ToggleGroupSchema` and nine more), so those pages are right.
`ButtonGroupSchema` is the one that does not, so it inherits `BaseSchema`'s
`boolean | string` and this page was the outlier rather than the convention.
Whether `ButtonGroupSchema` *should* narrow it like its thirteen siblings is a
types question, not a docs one, and is deliberately not answered here — the
renderer reads neither spelling today.

`onClick` is documented as declared and annotated as a runtime slot: it is
`z.function()`, and objectui#4453 narrowed the runtime to
`typeof === 'function'`, so a JSON author cannot supply one.

**`## Selection Mode` is deleted, not softened.**
`packages/components/src/renderers/basic/button-group.tsx` implements no
selection behaviour at all — no `selectionMode` read, no group-level `value`
read, no state — and it does not wire the declared per-button `onClick` either.
It maps `schema.buttons` to `Button` elements reading `variant`, `size`,
`className` and `label` only. A heading over two inert demos taught a
capability nothing draws. The capability question itself is filed separately
rather than answered here.

The two catalog fixtures the section rendered
(`components-basic-button-group/single-selection`, `/multiple-selection`) are
**kept**. Catalog entries are a separate verification population, fenced off by
PR #6345; orphaning them from this page is the accepted cost, and no gate reads
a catalog entry's page references (the index is generated from the schema
directory by `scripts/regenerate-catalog-index.py`, path-keyed).

`packages/types/src/__tests__/button-group-doc-surface-6347.test.ts` pins the
result. Nothing in CI parses a `plaintext` fence — `check:doc-types` reads only
the `type` string literals and `check:doc-snippets` compiles `ts`/`tsx` fences —
so without it a green CI run would have said "nothing else broke", not "the
correction is right". The pin reads membership off the mirror's `.shape` rather
than off parse acceptance, because `BaseSchema` is `.passthrough()` and carries
`[key: string]: any`: an undeclared `selectionMode` parses green and
type-checks, so acceptance cannot tell "declared" from "admitted unexamined".

No type was minted, no fence moved (the page holds one `plaintext` fence before
and after, so objectui#5867's shrink-only declared population is unchanged), and
no catalog fixture was edited.

Part of objectui#6347.
