---
'@object-ui/types': minor
---

**`ObjectGanttSchema` now declares the `gantt` BLOCK face — and the spec's
required trio enforces at validate/check time.**

The `gantt` nested-block spelling of a gantt config (`{ type: 'object-gantt',
gantt: { … } }`) had **no mirror entry at all**: it rode through
`BaseSchema`'s `.passthrough()` entirely unvalidated, and the published
TypeScript never taught the shape either — an author writing `gantt: { … }`
got no completion, no type checking, no error on a misspelt member. It was
the 28th and last of the keys `getGanttConfig` (`plugin-gantt/src/ObjectGantt.tsx`)
reads off the schema that objectui#6051 (PR #6472) did not declare — severed
into its own card because, unlike the other 27, declaring it changes what a
published tool refuses.

Both faces now declare it:

```ts
// packages/types/src/objectql.ts
gantt?: GanttConfig;

// packages/types/src/zod/objectql.zod.ts
gantt: SpecGanttConfigSchema.extend(GanttConfigExtensionFields).optional(),
```

`GanttConfig` derives from the spec's `GanttConfigSchema`, which has required
`startDateField`, `endDateField` and `titleField` since rc.6.

**What the CLI now refuses that it accepted before:** `ObjectGanttSchema` is a
member of `AnyComponentSchema`, so it reaches `safeValidateSchema` and
therefore the CLI's `validate` and `check` commands. A `gantt` block missing
any of the three required fields — previously accepted silently — is now
**refused**, naming the missing field. A block carrying all three, or a
schema with no `gantt` block at all, is accepted exactly as before.

**This is a `declared = enforced` restoration, not new requiredness.**
`getGanttConfig`'s block branch already fed the block to
`GanttConfigSchema.safeParse` and logged `[ObjectGantt] Invalid gantt
configuration` to the console on failure — a block missing the trio was
already non-functional at runtime, silently. What changes is *when* the
author is told: runtime console warning becomes an authoring-time refusal.

Maintainer ruling, objectui#6475 (2026-08-27), **Option A** — enforce as-is,
immediately, no warning window (the startup-stage no-gradualism rule,
objectstack#12668: transitions do not get phased windows without named
external-user evidence, and none exists here). A census of every `gantt`
block reachable through `ObjectGanttSchema` in this repository — the
`examples/schema-catalog` fixtures, `content/docs/plugins/plugin-gantt.mdx`,
and the published `skills/objectui/guides/page-builder.md` guide — found
**zero** blocks missing the trio.
