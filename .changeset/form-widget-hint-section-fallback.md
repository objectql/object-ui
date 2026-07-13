---
"@object-ui/components": patch
---

Form fields honor their object-schema `widget` render hint on the field-group /
section layout path. `ObjectForm` renders objects that declare field groups
(e.g. `sys_sharing_rule`) via an auto-derived section layout that passed each
field's metadata through without hoisting its `widget` override to the top-level
form-field config, so a field with `widget: 'object-ref'` (or `filter-condition`
/ `recipient-picker`) degraded to its bare `type` input — an admin was asked to
hand-type an object name instead of picking it. The form renderer now falls back
to the field metadata's own `widget` when no top-level override is present, so
the pickers render on sectioned forms just as they do on flat ones.
