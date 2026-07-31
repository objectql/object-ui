---
"@object-ui/types": patch
"@object-ui/components": patch
"@object-ui/core": patch
"@object-ui/fields": patch
---

fix(form): a numeric/boolean select option survives selection with its type intact — #3090

`SelectOptionSchema.value` has accepted `string | number | boolean` for as
long as it has existed, but the Radix controls underneath speak strings:
picking `{ value: 2 }` silently submitted `"2"` — a wrong-typed write into a
number field that nothing on the client ever reported. (Display half-worked:
a numeric default matched its numeric item; only SELECTION morphed the type.)

The renderers now stringify on the way into the control and map the selection
back to the AUTHORED option value on the way out (`matchOptionValue`), across
the in-form select, the standalone `type: 'select'` component, and the
standalone `type: 'radio-group'` component. The TS types stop lying to match:
`SelectOption.value` / `RadioOption.value` and the corresponding
`value`/`defaultValue`/`onChange` channels widen to what the zod schemas
always accepted — a call site treating `option.value` as `string` is now a
compile error pointing at a real latent crash, not a false comfort.

The ripple the widening named, handled at each boundary: `@object-ui/core`'s
`OptionLike.value` widens (the option engines compare by identity, so values
flow opaquely; the option-lint's CEL-literal domain stringifies at its
boundary), and the multi-value field widgets (checkboxes / multiselect /
radio) stringify at theirs — multi-value fields store string arrays.

Round-trip pinned by real Radix interactions in jsdom: the in-form select
submits `2` (number), the standalone select hands its handler `false`
(boolean).
