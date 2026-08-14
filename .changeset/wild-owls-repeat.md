---
'@object-ui/types': minor
'@object-ui/components': minor
---

Settle the two declared-but-unread keys on `ToggleGroupItem`: retire `icon`, wire
`disabled` (objectui#4632).

`ToggleGroupItem` declared `icon?: string` and `disabled?: boolean` while the
`toggle-group` renderer read neither — it mapped items to value + aria-label +
label and dropped the rest. Nothing went red, which is what made it durable: an
author who declared either key got a correctly rendered group with the key
silently ignored, and the schema catalog (the corpus AI authoring tools retrieve
from) was teaching `icon` on all three items of
`components-disclosure-toggle-group/with-labels`.

The two keys are settled in opposite directions, by measurement rather than by
symmetry:

- **`icon` is retired** from the TypeScript interface, from the `ToggleGroupItemSchema`
  Zod mirror, from that catalog entry and from the component's docs page. It had zero
  measured pull — across the repo the single catalog entry was the only site authoring
  it, no application code or example app declared it, and no renderer resolved it.
- **`disabled` is honored.** Item-level `disabled` is already live convention here —
  `tabs`, `select`, `dropdown-menu`, `menubar` and `context-menu` all forward it, and
  `toggle-group` was the lone outlier. The underlying Radix item supports it natively,
  so the renderer forwarding the prop is the whole change; the synced `ui/toggle-group.tsx`
  primitive is untouched.

**Breaking for TypeScript authors of `icon` only** (marked `minor` per this repo's
version-alignment rule, which reserves `major` for following `@objectstack` across a
major). Runtime behaviour of an authored `icon` is unchanged — it rendered nothing
before and renders nothing now; what changes is that the contract no longer claims
otherwise, so the mistake surfaces at authoring time. Authored `disabled` changes from
silently ignored to actually disabling that one item.
