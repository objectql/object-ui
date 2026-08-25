---
'@object-ui/app-shell': patch
---

Page-block canvas: draw the real icon and colour tone for block types that render fine but are not offered in the palette.

The canvas read its per-node icon and tone from `BLOCK_TYPE_META`, which is the palette's *offer* list ("what may an author drag in") — while the canvas is answering a different question ("what may an author already have in this page"). The two diverge for an alias pair: `record:discussion` and `record:chatter` are one renderer under two names, so exactly one spelling is always unoffered, and a page carrying it showed a plain unknown-block box and neutral grey instead of the message icon and the blue record tone its twin gets.

`block-types.ts` now declares `BLOCK_RENDERER_ALIAS_GROUPS` — spellings that resolve to the same registered renderer — and the canvas resolves display chrome through `resolveBlockDisplayMeta()`, which falls back to an alias sibling's entry. Keyed on renderer identity, not on "is excluded": palette exclusions that genuinely are not page blocks (`element:text_input`, `element:record_picker`, `element:form`, `ai:chat_window`) keep the generic box, and nothing became draggable — the palette offer list is unchanged.
