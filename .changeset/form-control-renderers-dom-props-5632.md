---
'@object-ui/components': patch
---

**Behaviour change:** the eighteen renderers whose host element is a form
control no longer forward their whole prop bag to it. They route it through a
form-control DOM declaration — the same `pickDomProps` mechanism `grid`, `flex`,
`stack`, `container` and `text` were converged on — so an authored schema key
becomes an HTML attribute only if the contract declares it one (objectui#5632,
the `BARE_SPREAD_MINUS_NAME` slice of objectui#5574).

The eighteen: `action:button`, `action:icon`, `ui:button`, `ui:checkbox`,
`ui:combobox`, `ui:date-picker`, `ui:email`, `ui:file-upload`, `ui:input`,
`ui:input-otp`, `ui:password`, `ui:radio-group`, `ui:sidebar-menu-button`,
`ui:slider`, `ui:sonner`, `ui:switch`, `ui:textarea`, `ui:toggle`.

What this stops reaching the DOM: the renderer's own declared props, consumed
off `schema` to render the control AND spread onto the element a second time as
attributes HTML does not define, plus the authored node's SDUI metadata and the
flattened `props` container. Measured across `examples/schema-catalog`, rendered
through the real `SchemaRenderer`: 284 illegitimate attributes over 287
form-control nodes — `button[label]` 140, `button[icon]` 25, `input[inputtype]`
23, `input[label]` 19, `toggle[label]` 14, `radio-group[options]` 8,
`date-picker[placeholder]` 7, `file-upload[label]` 7, `file-upload[buttontext]`
7, `checkbox[label]` 6, `textarea[label]` 6, `toggle[arialabel]` 6,
`switch[label]` 4, `password[label]` 3, `email[label]` 2, `radio-group[direction]`
2, and six singletons. The same probe reads 0 after, with `grid`'s 26 nodes at 0
both times as the control and an unchanged node census across the two runs.

`name` and `disabled` are DELIBERATELY still forwarded. Both are legal on a form
control and neither was ever part of the leak — the ledgered shape for this
group is thirteen attributes, not fourteen, precisely because HTML defines
`name` on these hosts. The whitelist this group uses is therefore the shared
SDUI one PLUS those two, not the bare `toDomProps` the container renderers take:
that would have stripped the form-serialization key off every control and
silently re-enabled every disabled one, and no gate in the repo would have gone
red for it.

Nothing an author writes renders differently: every leaked key was already being
read off `schema` and applied. `id`, `role`, `tabIndex`, `className`, `style`,
event handlers and the open `data-*` / `aria-*` families are unchanged.

Anything that read one of the leaked attributes off the DOM — a CSS attribute
selector such as `[label="Save"]`, or a test asserting `inputtype` on a rendered
`ui:input` — must read the schema instead. No `@object-ui` code did; this is
called out because the attributes were externally visible while they lasted.
