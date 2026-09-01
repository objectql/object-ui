---
'@object-ui/app-shell': patch
---

Studio Interfaces pillar: a canvas block selection no longer outlives the leaf
it was made on (objectui#7137).

`InterfacesPillar`'s only clear of `selection` sat inside the draft-load effect,
*after* its `if (!current || !isEditable) … return` guard, so it never ran on the
early-return path. Since `isEditable = !!Preview && !StudioCanvas` is a
conjunction, that is two populations of leaf: a studio-canvas leaf (`object`),
and a leaf whose own type has no registered designer. Walking to either from a
leaf with a block selected carried the selection across, still describing a block
on the previous leaf's canvas.

Two symptoms, both measured before and after:

- the scoped inspector opened for a foreign block — recorded three renders as
  `page:home_page:block:blk_1`, with `blk_1` a dashboard block — and the header
  offered to clear a selection belonging to another leaf;
- in the folded (chat-dock) layout, `hasInspectorTarget` stayed true across the
  leaf change, so `nextCenterTab` saw no edge and stranded the author on the
  Properties tab of a leaf with no properties to show.

The selection is now stamped with its leaf and read back through that key — the
same "expires by construction" shape `blockingReport` already uses against
`inspectorKey` in this component. It goes null in the *same* render as the leaf
change rather than one committed render later, and there is no imperative clear
left for a future guard to strand. Within a leaf nothing changes: the Design/Run
round trip still keeps its selection, and a same-leaf reload (`publishNonce`)
still clears it.

objectui#7121's gating of the rail and the Design/Run switch is untouched, and
its discriminator remains `StudioCanvas` — not `isEditable`.
