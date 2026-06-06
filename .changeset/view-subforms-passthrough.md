---
"@object-ui/plugin-view": patch
---

feat(view): pass form-view `subforms` through to ObjectForm

`ObjectView`'s form schema now forwards `form.subforms` to `ObjectForm`, so a
form view that declares inline child collections renders as a master-detail
form (parent fields + child grids, atomic save) in ObjectView's own
create/edit form — no bespoke page. Pairs with `@objectstack/spec`
`FormViewSchema.subforms` and ObjectForm's existing `subforms` rendering.
