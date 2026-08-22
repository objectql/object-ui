---
'@object-ui/components': minor
---

`stack` now reads its spacing from `gap` and nothing else — the undeclared
`spacing` key it also accepted is gone (objectui#4890).

`StackSchema extends Omit<FlexSchema, 'type'>`, whose spacing key is `gap`.
`spacing` was declared by nothing: not the TypeScript interface, not the zod
mirror, not the renderer's own `inputs` registration. `stack.tsx` read it anyway,
as `schema.gap ?? (schema as any).spacing ?? 2` — and the `as any` is the whole
story, since it existed to get past the type system saying the key was not there.
A lenient consumer leg does not stay in the consumer: it becomes a second
de-facto contract that producers write to, and 135 nodes across 39 files of the
shipped schema catalog did exactly that. Every one of them rendered correctly, so
nothing ever pointed at it, while the examples went on teaching the key to every
author who copied them.

The trap it was one edit away from springing: `flex` — semantically a `stack`
with a `direction` — never read `spacing`, so re-typing any of those nodes would
have dropped the spacing to the default silently. Fixed at the producer
(AGENTS.md #0.1): those nodes now author `gap`, carrying the same value, and the
alias is deleted rather than legalised into `StackSchema`, where it would only
have been a second name for `gap`.

**If you author `spacing` on a `stack`**, rename it to `gap`; the value and the
rendering are unchanged. A `stack` still carrying `spacing` now renders the
default gap, exactly as a `flex` always did.

Also in the same sweep, and visible only in the published example catalog rather
than in any package API: 140 catalog nodes that were already `flex` / `stack` /
`container` stopped hand-writing their own declared props in `className`
(`items-center` → `align`, `justify-between` → `justify`, `gap-2` → `gap`,
`flex-wrap` → `wrap`, `p-4` → a container's `padding`) — 231 tokens in all
(objectui#4891). Breakpoint-prefixed overrides and everything decorative stay in
`className`, because the props are not responsive. Both facts are ratcheted in
`examples/schema-catalog/test/layout-props-conversion.test.tsx`.
