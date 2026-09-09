---
'@object-ui/types': patch
---

Remove stale source-line citations (`NAME.ext:NNN`) from twelve published `.describe()`
schema descriptions in `packages/types/src/zod/overlay.zod.ts`,
`zod/data-display.zod.ts` and `zod/objectql.zod.ts` (objectstack-ai/objectui#8478).

Text only — no accept-set, key, or shape change. Each description was either trimmed to
its author-useful sentence (the line address removed, with no loss: the same detail is
already duplicated in an adjacent maintainer-facing JSDoc comment), or rewritten to cite
the same fact by identifier/behavior instead of by file:line (e.g. "forwarded as `align`
on `HoverCardContent`" instead of "read at renderers/overlay/hover-card.tsx:24"), which
survives a line renumbering that a bare address would not.

One of the twelve addresses removed here (`ObjectKanban.tsx:264` on the `limit` field's
description) was measured to have already drifted — the cited line is now unrelated
permissions code; the real read site is `ObjectKanban.tsx:365`. Filed back on
objectstack-ai/objectui#8478 as the drift evidence its own re-grade trigger asked for.

The remaining 15 addresses (`form.zod.ts`, `layout.zod.ts`, `complex.zod.ts`) are out of
scope for this PR — held by in-flight PR objectstack-ai/objectui#8763 (`form.zod.ts` /
`layout.zod.ts`); `complex.zod.ts`'s hold (PR objectstack-ai/objectui#8766) cleared when
that PR merged during this round, so its 6 addresses return to the queue rather than
riding this PR's scope.
