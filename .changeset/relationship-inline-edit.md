---
"@object-ui/app-shell": minor
---

feat(metadata): relationship-level `inlineEdit` auto-renders master-detail

A child object's `master_detail`/`lookup` field can declare `inlineEdit: true`
(in the data model) to mean "edit me inline within my parent's form". The
metadata layer now scans for these and merges the resulting child collections
into each parent object's form view as `subforms` — so the parent's **standard**
New/Edit form auto-renders an atomic master-detail form with **no view config
and no bespoke page**. The intent lives once in the data model (where e.g. an AI
modelling the schema naturally sets it); forms derive the UI.

`master_detail` children WITHOUT `inlineEdit` are not inlined (so associations
like comments/attachments stay out of the entry form). An explicit
`form.subforms` entry overrides the derived one. Optional
`inlineTitle`/`inlineColumns`/`inlineAmountField` tune the grid.
