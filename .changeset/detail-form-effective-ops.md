---
"@object-ui/core": minor
"@object-ui/app-shell": minor
"@object-ui/plugin-detail": minor
"@object-ui/plugin-form": minor
---

feat: gate detail/form edit & delete on the server's effective operation set (#3546)

PR-4 (#3391) wired the **list/toolbar** surface (ObjectView Import, ListView /
ObjectGrid Export) to the server-resolved effective API operation set
(`/me/permissions` `apiOperations`, intersected via
`resolveCrudAffordances(obj, effectiveApiOperations?)`). The **detail / form**
surfaces still gated edit/delete on the bucket + `userActions` alone. This
extends the same intersection to them, so the record page and its forms never
offer an operation the server would 405.

- **core** `isObjectInlineEditable(obj, effectiveApiOperations?)` gains the same
  optional second argument as `resolveCrudAffordances` — inline-edit is now
  additionally ANDed with the server allowing `update`.
- **app-shell** `RecordDetailView` threads the object's effective operations into
  the synthesized Edit/Delete header actions and the record-body inline-edit
  gate (`canEdit`); `RelatedRecordActionsBridge` intersects each **child**
  object's Create/Edit/Delete handlers with that child's own effective set.
- **plugin-detail** `record:details` ANDs its inline-edit affordance with the
  object's effective `update`.
- **plugin-form** `ObjectForm`'s blanket managed-object field lock also engages
  when the server denies `update` (edit mode) / `create` (create mode).

Backward-compatible: a missing effective set (unrestricted object, older
backend, or no `PermissionProvider`) leaves the resolved affordance untouched —
the bucket/`userActions` decision wins, exactly as today. Layers on top of the
existing per-object `check('edit')` / `check('delete')` permission gates
(intersection, never union).
