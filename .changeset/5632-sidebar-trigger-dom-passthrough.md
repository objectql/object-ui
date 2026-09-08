---
'@object-ui/components': patch
---

`ui:sidebar-trigger` routes its host spread through the form-control DOM
declaration (objectui#5632, the `ui:sidebar-trigger` slice of objectui#5574).

The renderer forwarded its whole prop bag to `SidebarTrigger`, which spreads its
own rest onto the `<button>` it renders — so every authored SDUI key on the node
became an attribute. Fourteen of them, one more than the shape this target
derives from, because this registration also never destructured `schema`: every
other registration in `renderers/navigation/sidebar.tsx` names it (they need
`schema.body`), while this one renders no children and named only `className`,
so the node `SchemaRenderer` injects on every render rode the spread and landed
as `schema="[object Object]"`.

The declaration is the form-control one, not the bare `toDomProps`: the host is
a `<button>`, where HTML defines `name` and `disabled`. That is measurable in
the ledger row itself — it recorded thirteen attributes plus `schema` and never
`name`, because the leak judge counts an authored `name` as legitimate on this
element. A bare `toDomProps` would therefore have un-named this control without
moving a single number in the gate that grades the change.

Nothing else about the trigger moves. The `<button>` still carries its
`data-sidebar="trigger"` hook, its "Toggle Sidebar" accessible name, the
resolved `aria-label` / `aria-describedby`, the `data-obj-*` designer
attributes, its `id` and its `name`; an authored `className` still merges into
the primitive's computed classes rather than replacing them; and `style`, `role`
and `tabIndex` still reach the DOM — `style` forwarded by name, the two others
on the shared pass-through list. The leak set went from 14 to 0 underneath an
unchanged 8-attribute legitimate set, and clicking the trigger still toggles the
sidebar.
