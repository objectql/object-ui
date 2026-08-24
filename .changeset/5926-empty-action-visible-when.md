---
'@object-ui/components': minor
---

Route a `data-table`'s `emptyAction` node through `SchemaRenderer`, so a `visibleWhen`
authored on it is actually evaluated (objectui#5926 gap 1).

`visibleWhen` is not a per-block concern in this platform. It is enforced **once,
generically**, in `packages/react/src/SchemaRenderer.tsx`: `shouldHide` tests `visibleWhen`
ahead of the hoisted `visible` (objectui#5454), sets `_hidden`, and the `_hidden` early
return fires **before** the registry dispatches. A block renderer cannot ignore the gate,
because it never sees the node.

`emptyAction` was the one authored-node exception in the tree. The empty-state CTA slot
resolved the registry **directly** — `ComponentRegistry.get(node.type)` — and mounted the
result itself, so the node never passed through `SchemaRenderer` and its `visibleWhen` was
**never evaluated**. `@objectstack/spec` accepts the key (`SchemaNodeSchema` carries
`visibleWhen`, and `data-display.zod.ts` types `emptyAction` as a `SchemaNode`), so an
author wrote a gate, the platform took it, and nothing enforced it — declared-not-enforced,
the same class objectui#5401 / #5505 closed for `record:alert`, one level down.

Measured on the branch point, mounting a `data-table` with no rows so the empty state is
actually reached: an `emptyAction` carrying
`visibleWhen: { dialect: 'cel', source: 'features.can_create == true' }` under an ambient
scope of `features.can_create = false` **rendered**, and so did the bare-string spelling of
the same predicate. Both now render nothing. The three must-show cases were pinned in the
same file and were green before and after — an `emptyAction` whose predicate resolves
**true**, one declaring **no** `visibleWhen`, and one whose predicate names an unbound root
(the central gate fails soft to visible, and this slot now gives the same answer as every
other node rather than a private one).

The fix is a **route**, not a new check: no `visibleWhen` test was added to `data-table.tsx`.
A local check on this slot would have been a fourth evaluator, which is the drift
`page:tabs`' item-level predicate already records on this card. The slot now mounts its
authored node exactly the way the `empty` renderer's `action` slot always has.

**Behaviour change worth declaring, beyond the gate itself.** No declaration moves and no
new key is accepted, but two host-observable answers change on this slot:

- An `emptyAction` whose `visibleWhen` resolves false stops rendering. That is the fix.
- An `emptyAction` whose `type` is missing or names an unregistered component now gets the
  platform's uniform "unknown component type" report instead of rendering as silent
  nothing. Malformed metadata gets one answer across the tree rather than a private one
  here — but a page that shipped a typo'd `emptyAction` type went from invisible to visibly
  reported.
