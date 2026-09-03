---
'@object-ui/types': minor
---

**`BaseSchema.hidden` now declares the predicate string the renderer already evaluates** (objectui#7455, maintainer ruling 2026-09-03).

`hidden?: boolean` becomes `hidden?: boolean | string`, and the Zod mirror's `z.boolean()` becomes `z.union([z.boolean(), z.string()])` — matching `visible` (#4581) and `disabled` (#4580 ruling Q3-A) on both faces. `hidden` was the third key on the same evaluated path and the only one still declared boolean-only.

This is a **widening**, not a replacement: every boolean `hidden` keeps parsing and keeps type-checking unchanged, and the renderer's behaviour is untouched by this change — `SchemaRenderer`'s `shouldHide` chain already routed this key through `hasDeclaredPredicate` and evaluated it, which is the evidence the widening rests on. What changes is that authors and their tooling can now write `hidden: "${data.status === 'draft'}"` without casting past the declaration, and the Zod mirror stops refusing it (before this, that value failed `safeParse` with `invalid_type` at path `hidden` while the identical string on `visible` parsed).

`hiddenOn` is unchanged and remains the sibling expression spelling. The CEL envelope object form is still declared on none of `visible` / `hidden` / `disabled`; objectui#7530 rules on all three together.

Per this repository's version-alignment convention, a widening of a published type surface ships as `minor` with the semantics spelled out here rather than as `major` (see AGENTS.md, "版本号策略").
