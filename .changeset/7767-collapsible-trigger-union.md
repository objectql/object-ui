---
'@object-ui/types': minor
---

**`CollapsibleSchema.trigger` now declares the node array its Zod mirror, its runtime and its own shipped default already accept** (objectui#7767).

`trigger` on `CollapsibleSchema` widens from `string | SchemaNode` to `SchemaNode | SchemaNode[]` on the TypeScript face, and stays required. The dropped `string |` half was redundant rather than an extra: `SchemaNode` is `BaseSchema | string | number | boolean | null | undefined`, so `string | SchemaNode` already denoted exactly `SchemaNode` — a bare string trigger type-checks before and after. `SchemaNode` itself is unchanged.

This is a **widening**, not a replacement: every singular `trigger` keeps type-checking unchanged. The Zod mirror is untouched — `zod/disclosure.zod.ts` already spelled this key `z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)])` — and so is the runtime: `renderers/disclosure/collapsible.tsx` hands `schema.trigger` to `renderChildren`, whose `Array.isArray` branch has served the array form all along, and that same registration's `defaultProps.trigger` ships as an array. What changes is that the TypeScript face stops under-reporting an accept set that already ships: copying the renderer's own default into a typed document is no longer a type error against the type that shipped it. The docs page's `trigger` row follows the declaration.

This is the eighth member of the change objectui#7081 made to the overlay family, carried out under the same ruling (2026-09-03 on that card): the validator's accept set does not move, so this is a declaration catching up with what ships rather than a new capability. Per this repository's version-alignment convention, a widening of a published type surface ships as `minor` with the semantics spelled out here rather than as `major` (see AGENTS.md, "版本号策略").
