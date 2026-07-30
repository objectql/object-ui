---
"@object-ui/components": patch
---

feat(page,element): declare inputs for the eight configurable page:\* / element:\* blocks

Same gap objectui#3027 closed for `record:*`, in the two namespaces next door:
renderers that read real props while every authoring surface reported "takes no
configuration". Declarations mirror what each renderer reads —

| block | inputs |
|---|---|
| `page:tabs` | items, tabStyle (line/card/pill), position (top/left) |
| `page:card` | title, bordered, body (slot), footer (slot) |
| `page:accordion` | items, allowMultiple, variant (flush/card) |
| `element:text` | content, variant (heading/subheading/body/caption), align |
| `element:number` | object, aggregate (count/sum/avg/min/max), field, filter, format, prefix, suffix |
| `element:button` | label, action (inline ActionDef), variant, size, icon, iconPosition, disabled |
| `element:definition-list` | items, columns, inline |
| `element:repeater` | object, titleField, fields, filter, sort, limit, emptyText, divided |

`page:section`, `page:footer` and `page:sidebar` are left at zero inputs on
purpose: their renderers render `children`/`body` and nothing else — like
`element:divider`, they are genuinely prop-less containers, and inventing
inputs for them would be the opposite falsehood.

`aria` and `className` stay undeclared throughout, per the convention on
`record:details`: escape hatches and styling pass-throughs, not authoring
choices. `element:button`'s registration also documents the split against
`action:button` — inline ActionDef vs a declared action referenced by name —
so the two stop reading as duplicates.

Declaration only; no renderer behavior changes. Curation (which of these join
`PUBLIC_BLOCKS`) is a separate change.
