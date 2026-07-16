---
"@object-ui/react": patch
"@object-ui/plugin-detail": patch
"@object-ui/app-shell": patch
---

fix(detail): show the "Locked for approval" band on request-tracked backends (objectui#2618)

The DetailView approval-lock band keyed only off the record's own
`approval_status` field, so it never rendered on backends that track the lock
via an open approval request and never materialize that field — even though
the lock was real (writes rejected with `RECORD_LOCKED`). The record-level
`InlineEditContext` now carries the host's `locked`/`lockedReason` signal
(the same dual-source `approvalLocked` that already gates `canEdit` in
`RecordDetailView`), and the band renders from it while keeping `DetailView`
DataSource-agnostic. Also backfills the approval-lock strings into the detail
translation defaults so a bare DetailView shows the label, not the raw i18n key.
