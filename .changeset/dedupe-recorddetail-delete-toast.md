---
'@object-ui/app-shell': patch
---

Stop double-firing action toasts on record-detail script actions and the delete handler.

`ActionRunner.handlePostExecution` already surfaces a result's `error` as a toast
(and a success toast unless `silent`). Two handlers ALSO toasted themselves while
returning `{success:false, error}` (or a non-`silent` success), so on a runner
seeded with `onToast` the same message fired twice:

- **`RecordDetailView` `serverActionHandler`** (script actions): the HTTP/inner-fail
  branch and the catch branch each called `toast.error` before returning the error.
  #2177 fixed the twin in `useConsoleActionRuntime` (interface pages) but not this
  copy, so record-detail script-action failures (e.g. a `RECORD_LOCKED` from an
  approval-locked record) still showed the error twice for everyone on the published
  console bundle. Both branches now return the error and let the runner toast it once.

- **`useObjectActions` `delete` handler** (ObjectView list/detail deletes): kept its
  richer localized toast (label + description, or the bulk succeeded/failed summary)
  and now returns WITHOUT `error` on failure so the runner doesn't re-toast it, and
  marks successful deletes `silent` so the runner doesn't append a second generic
  "Action completed successfully" toast.

Adds `useObjectActions.test.tsx` asserting exactly one toast on delete
success / failure / partial-bulk-failure.
