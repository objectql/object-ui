---
"@object-ui/plugin-form": minor
---

feat(master-detail): atomic EDIT via the cross-object batch endpoint

Edit mode now persists the parent update together with its child line-item
create/update/delete diffs in ONE server transaction (commit all or roll back
all), matching what create already did. Previously only create used the atomic
`/api/v1/batch` path; edit fell back to client-orchestrated writes with
best-effort cleanup.

- New pure helper `buildMasterDetailEditBatch(parentObject, parentId,
  parentData, details)` — emits a parent `update` op (index 0) then diffs each
  child collection against its loaded snapshot into `create` / `update` /
  `delete` ops (children reference the known parent id directly, no `$ref`).
- `MasterDetailForm` now treats `canBatch` as available whenever the data
  source exposes `batchTransaction` (create AND edit). `submitViaBatch` builds
  create-ops or edit-ops by mode; `onSuccess` → `handleSaved` ("saved" toast,
  no form reset in edit).

The server `/api/v1/batch` handler already supports `update`/`delete` actions,
and the adapter already forwards `action`/`id`, so this is a front-end change.
Unit-tested (parent update + child create/update/delete diff); the create path
remains verified by the live e2e.
