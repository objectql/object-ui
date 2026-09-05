---
'@object-ui/types': minor
---

**`BaseSchema.visible` / `.hidden` / `.disabled` now declare the CEL envelope object the renderer already evaluates, as one named wire type** (objectui#7530, maintainer ruling 2026-09-04, option A).

Each of the three keys goes from `boolean | string` to `boolean | ExpressionWire` on both faces, where `ExpressionWire` is `string | { dialect?: string; source: string }` — the exact string-or-envelope union `FormField.visibleWhen` and its `*When` / `*On` siblings already carried, and the exact accept set of `@object-ui/core`'s `toPredicateInput` / `hasDeclaredPredicate`. The Zod mirror's `z.union([z.boolean(), z.string()])` becomes `z.union([z.boolean(), ExpressionWireSchema])` on all three.

Two names are new on the published surface:

- `ExpressionWire` (type, main entry) — the TypeScript wire union, in `packages/types/src/expression.ts`.
- `ExpressionWireSchema` (`@object-ui/types/zod`) — its runtime twin, hoisted out of `zod/form.zod.ts` (where it was module-private) into `zod/expression.zod.ts` and imported by both `base.zod.ts` and `form.zod.ts`. One envelope type, reused by reference; no second spelling.

This is a **widening**, not a replacement, and the renderer's behaviour is untouched: `SchemaRenderer`'s `shouldHide` / `shouldDisable` chains already routed all three keys through core's one definition of "declared" and evaluated the value, and the envelope was already pinned as working on `hidden` and `disabled` — through a `Record` cast, because no key declared it. Measured before this change, `BaseSchema.safeParse({ type, hidden: { dialect: 'cel', source: 'true' } })` returned `success: false` (`invalid_union` at path `hidden`) while the identical envelope on `FormField.visibleWhen` parsed one file over; that is the gap this closes, on all three keys at once. Every boolean and string value keeps parsing and keeps type-checking unchanged. `dialect` is optional and unconstrained on the wire because the runtime reads it that way (only `'cel'` keeps its envelope on the canonical engine; anything else is unwrapped onto the legacy path).

Not changed: `hasDeclaredPredicate` (no per-key branch — option B was rejected), the `*On` / `visibleWhen` sibling keys, and `ActionSchema.condition`, which already declared the envelope inline.

Per this repository's version-alignment convention, a widening of a published type surface ships as `minor` with the semantics spelled out here rather than as `major` (see AGENTS.md, "版本号策略").
