---
'@object-ui/types': minor
'@object-ui/components': minor
---

Settle the two declared-but-unread keys on `AccordionItem`: retire `icon`, wire
`disabled` (objectui#4652).

The same defect as objectui#4632 (PR #4651), one interface up in the same file.
`AccordionItem` declared `disabled?: boolean` and `icon?: string` while the
`accordion` renderer read neither — it mapped items to `value`/`title`/`content`
and dropped the rest. Nothing went red: an author who declared either key got a
correctly rendered accordion with the key silently ignored.

The two keys are settled in opposite directions, by measurement rather than by
symmetry. A full corpus sweep (schema catalog, docs, example apps, and this
repo's `objectstack` sibling checkout) found **zero** sites authoring either key
on an `AccordionItem`:

- **`icon` is retired** from the TypeScript interface and from the
  `AccordionItemSchema` Zod mirror. It had zero measured pull anywhere in the
  corpus and no established convention to lean on, so under this platform's
  declared=enforced doctrine it is removed rather than speculatively
  implemented.
- **`disabled` is honored**, despite also having zero catalog pull today.
  Item-level `disabled` is already established live convention in this
  codebase — `tabs`, `select`, `dropdown-menu`, `menubar`, `context-menu` and
  (objectui#4632) `toggle-group` all forward it, and `accordion` was the next
  outlier. The underlying Radix accordion item supports `disabled` natively, so
  the renderer forwarding one prop is the whole change; the synced
  `ui/accordion.tsx` primitive is untouched. The schema catalog's
  `basic-accordion` example now demonstrates a disabled item.

**Breaking for TypeScript authors of `icon` only** (marked `minor` per this
repo's version-alignment rule, which reserves `major` for following
`@objectstack` across a major — see AGENTS.md's 版本号策略 and the identical
classification PR #4651 used for `ToggleGroupItem.icon`). Runtime behaviour of
an authored `icon` is unchanged — it rendered nothing before and renders
nothing now; what changes is that the contract no longer claims otherwise, so
the mistake surfaces at authoring time. Authored `disabled` changes from
silently ignored to actually disabling that one item (and blocking its
expand/collapse).
