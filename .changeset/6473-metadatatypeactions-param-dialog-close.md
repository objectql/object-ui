---
'@object-ui/app-shell': patch
---

The metadata-admin type-action param dialog no longer blanks itself while it closes
(objectui#6473).

`MetadataTypeActions` is the **third** consumer of `ActionParamDialog` in this package,
after `useConsoleActionRuntime` and `RecordDetailView` — and it was the last one still
writing `setParamState({ open: false, params: [] })` on close, replacing the whole state
object. `DialogContent` carries `duration-200 data-[state=closed]:animate-out`, so Radix
holds the content mounted through its exit animation and the dialog goes on rendering off
`state` for the whole fade-out: a user who cancelled "Test connection" or a datasource
sync watched the heading revert from the action's own label to the generic
`actionDialog.title` and every param row disappear, for 200ms, on the way out. Close now
flips `open` and keeps every other field, which is the shape objectui#6431 converged the
other two consumers on.

Not a user-data change: the values typed into the dialog never lived in `paramState` —
they live in `ActionParamDialog`'s own `values`, reseeded from the param defaults on every
open — so a reopen still starts from the defaults, pinned as a control.

The pre-reset `paramState.resolve?.(null)` is dropped as well, on an enumeration rather
than on "resolving twice is a no-op": `onOpenChange` is reachable from exactly three places,
all inside `ActionParamDialog`, and every one settles the promise before asking for the
close — `handleSubmit`, `handleCancel`, and the Radix root handler that delegates to
`handleCancel` (the single route Escape, an overlay click and the header close button all
take). All four routes are driven in the new test, with a census over
`ActionParamDialog.tsx` so a later call site that skipped the settle is red there instead
of leaving a promise pending forever.
