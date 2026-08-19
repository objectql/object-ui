---
'@object-ui/plugin-view': minor
---

`object-view`: a top-level `conditionalFormatting` no longer reaches the kanban view.

`ObjectView.generateViewSchema`'s kanban branch resolved its rule list from a
three-link chain: `options.kanban.conditionalFormatting`, then the active view's
own rule, then `(schema as any).conditionalFormatting` read straight off the
`object-view` node. The first two links are declared surface. The third was not:
`ObjectViewSchema` has no such member, the `object-view` registry registration
does not publish it in `inputs`, and `BaseSchema`'s index signature keeps tsc
silent — yet it was honoured, because that branch runs exactly when no host
supplies `renderListView`, which is the path the registered renderer takes.

That one key was the sole counter-example to the objectui#5097 exemption, whose
stated basis is that its 27 keys are reachable only through the host-supplied
delegation. Maintainer ruling of 2026-08-19 on objectui#5248 (verbatim
「全部接受」): Option 2, gated on a liveness check, with Option 1 (declare the key
on `ObjectViewSchema` and in the registry `inputs`) pre-ruled for the case where
the check found real authored usage. The check came back empty — no authored
document in either repo puts `conditionalFormatting` on an `object-view` node
(objectui docs carry it only on `object-grid`, the authoring skill only on
`list-view`; objectstack authors no `object-view` node at all) — so the read was
dropped rather than the key declared.

Behavior change, stated because it is one: an `object-view` node that carried a
top-level `conditionalFormatting` and rendered a kanban view now renders that
kanban unformatted. Author the rules where they are declared — under
`options.kanban.conditionalFormatting`, or on the view — and both keep working
with the same precedence as before.

Not narrowed: the host `renderListView` delegation still reads the key off the
`object-view` node and forwards it to the host's list renderer. It remains
host-composition surface under objectui#5097; only the author-reachable path
closed. Both halves are pinned in
`packages/plugin-view/src/__tests__/ObjectView.kanbanConditionalFormatting.test.tsx`,
and `objectViewHostSurface.test.tsx` now asserts that ZERO exempt keys are read
outside the host-composition fence.
