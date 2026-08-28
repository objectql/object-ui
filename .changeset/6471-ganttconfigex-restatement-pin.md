---
---

Pin every member `plugin-gantt`'s `GanttConfigEx` restates on top of `GanttConfig`
against its twin, so two declarations of one key can no longer drift apart in silence
(objectui#6471).

**No release.** Type-only and package-private: no runtime code changes, and the published
surface is untouched on both sides. `packages/types` has zero changed files, so
`GanttConfig`'s member list in the built `dist/index.d.ts` is byte-for-byte what it was;
the new `GanttConfigRestated` alias is exported from `ObjectGantt.tsx` for the pin to
import but is not re-exported by the package entry, and `plugin-gantt/dist/index.d.ts`
carries zero occurrences of it after a real build (positive control: `QuickFilterDef`,
which *is* re-exported, appears there).

`GanttConfigEx` is `GanttConfig & { … }` and the intersection's second half re-declares
keys the first half already declares — nine of them arriving from the spec's
`GanttConfigSchema`, which declares 19 keys as of rc.6. The restatements are deliberate:
their JSDoc is the only prose in this repo describing what the renderer does with each
key, and the spec emits no per-member documentation, so deleting the members deletes the
documentation. What was missing was any assertion that the two declarations still agree.

The local half is now a named type, and that is the whole mechanism rather than a tidying
step. An assertion phrased over `GanttConfigEx` cannot measure anything: `GanttConfigEx[K]`
is already `GanttConfig[K] & local[K]`, so it is assignable to `GanttConfig[K]` by
construction and stays green no matter how far the two declarations drift. Naming the
local half gives the pin two independent operands.

Measured, not assumed: **all twelve** restated members are mutually assignable with their
`GanttConfig` twin today — including `quickFilters` and `timeSegments`, which the card and
its triage both describe as load-bearing NARROWINGS. On current `main` they narrow
nothing. objectui#6051/#6472 lifted `timeSegments` onto `GanttConfig` in the shape that is
structurally `ShiftSegmentsConfig`, and rc.6's `GanttConfigSchema.quickFilters` already
models `field` / `label` / `options` exactly as `QuickFilterDef` does. Both are kept and
pinned as a measured state rather than deleted, so a future spec bump surfaces as a
decision instead of a silent widening.
