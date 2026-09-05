---
'@object-ui/types': minor
---

**The overlay family's `trigger` slot now declares the node array its Zod mirror, its runtime and its own shipped defaults already accept** (objectui#7081).

`trigger` on `DialogSchema`, `AlertDialogSchema`, `SheetSchema`, `DrawerSchema`, `PopoverSchema`, `HoverCardSchema` and `DropdownMenuSchema` widens from `SchemaNode` to `SchemaNode | SchemaNode[]` on the TypeScript face — the spelling `ContextMenuSchema` and `TooltipSchema` already carried. Each member keeps its optionality (the first four optional, the last three required). `SchemaNode` itself is unchanged.

This is a **widening**, not a replacement: every singular `trigger` keeps type-checking unchanged. The Zod mirror is untouched — `zod/overlay.zod.ts` already spelled every one of these keys `z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)])` — and so is the runtime: every overlay renderer hands `schema.trigger` to `renderChildren`, whose `Array.isArray` branch has served the array form all along, and every registration's `defaultProps.trigger` ships as an array. What changes is that the TypeScript face stops under-reporting an accept set that already ships: copying a renderer's own default into a typed document is no longer a type error against the type that shipped it. The seven docs pages' `trigger` rows follow the declaration.

Triage on the card (2026-09-03): the validator's accept set does not move, so this is a declaration catching up with what ships rather than a new capability. Per this repository's version-alignment convention, a widening of a published type surface ships as `minor` with the semantics spelled out here rather than as `major` (see AGENTS.md, "版本号策略").
