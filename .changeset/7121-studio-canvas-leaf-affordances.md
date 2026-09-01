---
'@object-ui/app-shell': patch
---

Studio Interfaces: no Design mode and no "click a block" rail on leaves that have
no block canvas (objectui#7121).

`registerStudioCanvasPreview(type, …)` opts a type into a surface-specific canvas
that renders the running app rather than an editable draft — a contract, not a
habit: `StudioCanvasPreviewProps` carries no `selection`, `onSelectionChange`,
`onPatch` or `editing`. Two affordances beside such a leaf ignored that.

- The Design/Run switch (objectui#5800) was still offered, though `editing` is
  handed to exactly one canvas branch (`Preview`). On a studio-canvas leaf the
  switch moved `canvasMode` and reached no renderer — a live-looking control
  wired to nothing. It is now gated.
- The right rail fell through to "Click a block on the canvas, and edit its
  properties right here." beside a canvas that has no blocks, so the instruction
  could not be followed. It now states what the canvas is, and — because this
  canvas has no blocks by contract — promises no recovery.
- The rail's new branch is ordered ahead of the selection branch, so a block
  selected on a *different* leaf no longer opens a scoped inspector for a block
  this canvas does not contain; the header's "clear selection" button is gated
  with it.

The discriminator is `StudioCanvas`, not `isEditable`. `isEditable` is
`!!Preview && !StudioCanvas` — a conjunction of two independent causes — so
gating on it would also strip these affordances from leaves whose only fault is
that their own type has no designer, the state objectui#6795 part C pinned as
still deserving the ordinary rail. Behaviour on every leaf with a block canvas
is unchanged.
