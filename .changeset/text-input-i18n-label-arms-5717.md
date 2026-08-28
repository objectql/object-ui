---
'@object-ui/components': patch
---

`element:text_input` now DECLARES the inline-translation arm on `label`,
`placeholder` and `description`, so the manifest gate stops reporting
`type-mismatch` on a locale map its own renderer has always resolved correctly
(objectui#5717).

`@objectstack/spec` types all three keys as the `I18nLabel` union
(`string | Record<string, string>`) — measured on the installed 17.1.0 pin, per
key, from the schema's own verdicts — and `text-input.tsx` has resolved all
three through `pickLocalized` at their read sites since it was written. Only the
`ComponentMeta` entries stayed at a single `'string'` arm. Driven through the
same `manifestFromConfigs` + `validateTree` pair the JSX-page compiler and the
save gate use, an author writing `{ en: 'Owner', 'zh-CN': '负责人' }` got three
warnings on a write that renders correctly in the viewer's language:

```
<element:text_input> prop "label" expected a string
<element:text_input> prop "placeholder" expected a string
<element:text_input> prop "description" expected a string
```

That is the INVERSE of the direction the rest of this family moved in.
`element:record_picker.emptyText` (objectui#5590) and that block's `label` /
`placeholder` (objectui#5637) each held one arm for exactly as long as their
render site dropped the map, and gained the object arm in the change that taught
the render site to resolve it — never declare an arm the renderer drops. Here
the render site was never behind, so the same rule's other half applies:
withholding an arm the renderer resolves is the false declaration in the other
direction, and noise on legal writes trains authors (AI authors included) to
dismiss the `unknown-prop` and `type-mismatch` reports that are real.

Per-key, not blanket. `defaultValue` on this same block keeps `['string',
'number']` — its contract has no object arm, measured the same way — and the
console specimen file keeps asserting that an `I18N_MAP` there still reports
`type-mismatch`. That control is what makes this a widening of three keys rather
than of a component.

All three keys also gain a `description` written from what the renderer does
rather than from restating the contract: where each one lands in the rendered
output (a `<label>` above the field, the native `placeholder` attribute inside
it, a `<p>` below it), when each is omitted, and the locale fallback chain the
read site follows. No renderer behaviour changed.
