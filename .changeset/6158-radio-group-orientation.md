---
'@object-ui/components': minor
---

`radio-group` now renders the `orientation` its own type has always declared (objectui#6158).

`RadioGroupSchema.orientation` was declared in two layers and read by none. The shipped TS
type carries `orientation?: 'horizontal' | 'vertical'` with `@default 'vertical'`
(`packages/types/src/form.ts:383`) and the zod mirror carries the matching
`z.enum(['horizontal', 'vertical'])` (`packages/types/src/zod/form.zod.ts:282`), while
`packages/components/src/renderers/form/radio-group.tsx` contained neither the string
`orientation` nor `direction` and forwarded only `defaultValue`, `className`, the
form-control DOM whitelist and the designer props.

The consequence was measurable rather than cosmetic: every radiogroup root the library
rendered came back byte-identical on that axis — no `data-orientation`, no
`aria-orientation` — so the docs page's `## Layout Options` section demonstrated a
distinction the product could not make, and its horizontal demo rendered vertically. An
author reading the shipped type had every reason to write `orientation: 'horizontal'` and
no way to discover it was inert.

The key is now forwarded to the underlying Radix `RadioGroup`, which accepts it natively
with the same two-value vocabulary and puts it on the root as `aria-orientation` and
`data-orientation`; the layout utilities follow it so the visible difference the docs
promise is real. This restores declared = enforced **without widening the acceptance
set** — no new key is accepted, and no spelling outside the declared enum becomes legal.

Two behaviour notes for anyone already shipping radio groups:

- The declared `@default 'vertical'` is now actually applied instead of being left to
  Radix's own `undefined`. A group that never authored the key keeps the vertical stack it
  already rendered, and additionally announces `aria-orientation="vertical"` — the
  announced orientation now agrees with the rendered one rather than being absent. Arrow
  key roving focus narrows to Up/Down for those groups, which is the correct pairing for a
  vertical stack.
- Author `className` still wins: the orientation layout utilities compose first and the
  authored class last, so tailwind-merge resolves every conflict in the author's favour.

Registry meta `inputs` for `radio-group` gains `orientation` in the same change — it was
the third surface that omitted the key, and leaving it out would have kept the designer
palette disagreeing with the type.
