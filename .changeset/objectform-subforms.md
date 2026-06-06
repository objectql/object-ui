---
"@object-ui/plugin-form": minor
"@object-ui/types": minor
---

feat(form): inline master-detail in a plain ObjectForm via `subforms`

`ObjectFormSchema` gains a `subforms` array. When set, a regular `object-form`
renders as a master-detail form — the object's own fields on top, an editable
grid per child collection below, persisted together in one atomic transaction —
without a bespoke `object-master-detail-form` page.

```ts
{ type: 'object-form', objectName: 'expense_claim',
  subforms: [{ childObject: 'expense_line' }] }   // FK + columns auto-derived
```

Each subform needs only `childObject` (relationship FK and columns are derived
from the child object's metadata; override with `relationshipField`/`columns`).
This is the config-driven, page-less way to express master-detail entry — a form
view can declare its child collections directly.
