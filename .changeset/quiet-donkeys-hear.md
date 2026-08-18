---
'@object-ui/app-shell': patch
---

metadata-admin: scope the detail drawer's form ids so its labels stop addressing the page form's controls

`MetadataDetailDrawer` is a Radix `Sheet`, so opening it leaves the page's own
`SchemaForm` in the DOM underneath. Top-level field ids were spelled
`mdf-{field}` with no instance dimension, so every field name the two forms
share (`name`, `label`, `description`) was one id twice — and a `label[for]`
resolves to the FIRST match in document order. Clicking a label in the drawer
focused the control of the form hidden behind it, and assistive tech announced
that control under the drawer field's name.

Both drawer-side mount points now pass a scope segment as their form's
`idPath`, so their top-level ids read `mdf-drawer-metadata.{field}` /
`mdf-drawer-embedded-item.{field}`. The page form passes nothing and its ids are
unchanged. Dev builds additionally report any duplicate `mdf-` host id in the
document, so a future second-form mount point that forgets a segment fails
loudly instead of silently re-crossing the wires.
