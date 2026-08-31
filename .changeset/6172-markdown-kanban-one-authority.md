---
'@object-ui/plugin-markdown': minor
'@object-ui/plugin-kanban': minor
---

One authority for `MarkdownSchema`, and for `KanbanCard` / `KanbanColumn`
inside `@object-ui/plugin-kanban` (objectui#6172, folding in objectui#6155).

The 2026-08-25 family ruling: every exported schema name has exactly one
authority. Two of this card's names are discharged here.

**`MarkdownSchema` — converged onto `@object-ui/types`.**
`@object-ui/plugin-markdown` declared a second copy of the name. The two
differed on exactly one member — `content`, required in `@object-ui/types` and
optional in the plugin — and that was measured to be drift rather than a real
semantic difference: the plugin's own registration declares the `content` input
`required: true` (pinned by its own test), `MarkdownImplProps.content` is a
non-optional `string`, the Zod mirror spells `z.string()`, and every authored
`type: 'markdown'` node in the repository supplies `content`. The plugin now
re-exports the one authority.

⚠️ **Breaking, in the narrowing direction, for `@object-ui/plugin-markdown`
consumers**: `MarkdownSchema['content']` goes from optional to **required**. A
value annotated `MarkdownSchema` that omitted `content` no longer type-checks.
Measured against this repository: zero authored markdown nodes omit it, so
nothing in-tree changed. (`type: 'markdown'` literals that carry no `content`
are rich-text FIELD metadata — `MarkdownFieldMetadata` — a different type.)
The plugin's face also gains the optional `sanitize` and `components` members
the canonical declaration carries; both are additive, and neither is read by
this renderer, which sanitizes unconditionally.

`className` is unaffected — it comes from `BaseSchema`, which both copies
extended, so it was always inherited rather than added by the plugin.

**`KanbanCard` / `KanbanColumn` — the three in-package copies converged to
one.** `KanbanImpl.tsx` and `KanbanEnhanced.tsx` each redeclared both names. A
TypeScript-AST comparison found them strict-SUBSET copies of `./types` with
nothing typed differently, so their extra members moved onto the one
declaration and both files now re-point at it.

Additive for consumers: `KanbanCard` gains `cardSubtitle`, `cardFieldCells` and
`coverImage`; `KanbanColumn` gains `collapsed`. All four are optional, so every
value that type-checked before still does. Both modules keep their previous
export surface via re-export, so no import path changes.

The cross-package `KanbanCard` / `KanbanColumn` / `KanbanSchema` collision
between `@object-ui/types` and `@object-ui/plugin-kanban` is NOT resolved here
and is escalated on objectui#6172 — those are two different dialects (`items`
vs `cards`, `labels` vs `badges`), and collapsing them renames a published
name, which needs an authority ruling.
