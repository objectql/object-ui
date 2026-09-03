---
'@object-ui/types': patch
---

Repair the `tooltip` and `context-menu` mirrors: declare the keys their renderers
actually read, and stop requiring the `children` neither of them reads
(objectui#6939, maintainer ruling recorded 2026-09-02 — this is one of the eight
groups on that card, dispatched as its own PR per the ruling).

Both members demanded `children` and omitted keys the renderer reads first, so
`safeValidateSchema` refused two catalog entries that draw correctly:

- **`tooltip`** now declares `trigger`, and `content` / `body` as the two halves of
  one read (`renderers/overlay/tooltip.tsx:28,31` — `renderChildren(schema.trigger)`
  and `schema.content || renderChildren(schema.body)`). The registration's own
  `inputs` list `trigger` / `content` / `body` and never `children`. `trigger`
  follows `HoverCardSchema` two entries below, which is the settled in-repo shape
  for this slot.
- **`context-menu`** now declares `triggerClassName`, `contentClassName` and
  `modal` (read at `renderers/overlay/context-menu.tsx:87,88,91`), which survived
  only on `BaseSchema.passthrough()`.

**patch, not minor: the accept set only widens toward what already renders.**
Every key involved is optional, and `children` stays legal — it is `BaseSchema`'s
own optional key, merely no longer demanded here. No document that validated
before this change stops validating; documents the renderers already draw start
validating. The TypeScript twins in `packages/types/src/overlay.ts` move in the
same stroke, so the published declaration and the published validator keep saying
the same thing.

⛔ A tooltip's trigger is authored under `trigger`, never `children`: the catalog
entry was already moved to `trigger` once on render evidence (objectui#4626 — it
was a measured blank tile) and moving it back is a known regression.
