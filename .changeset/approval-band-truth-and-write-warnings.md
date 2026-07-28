---
"@object-ui/plugin-detail": minor
"@object-ui/app-shell": minor
"@object-ui/data-objectstack": minor
"@object-ui/react": minor
"@object-ui/i18n": minor
---

fix(detail): say what the record actually allows — "in approval (editable)" vs locked, and warn on silently stripped fields (framework#3794)

The Console reported record writability wrong in both directions during an
approval, so a user had nothing to go on: what they *could* edit said "locked",
and what they *couldn't* said "updated successfully".

**"Locked for approval" was painted over every pending approval.** The band and
the recall affordance rendered on any open request, ignoring the node's
`lockRecord`. A node declaring `lockRecord: false` is pending *without* locking —
the server's hook lets the write through on purpose, so the approver can amend
the record as part of deciding on it — and the band told them not to bother. The
mirror image was just as bad: on a genuinely locked record the header **Edit**
button stayed live, so the user filled a whole form before the save came back
`RECORD_LOCKED`.

The pending request is now authoritative for both signals. `useRecordApprovals`
reads `locks_record` (framework#3794, resolved from the same node-config snapshot
the lock hook reads); `RecordDetailView` derives `approvalPending` and
`approvalLocked` separately and threads both through `InlineEditProvider`
(new `approvalPending` prop). The band renders the amber lock only when the
record is really locked, a neutral "In approval (editable)" / 审批中（可编辑）
otherwise, and the header Edit CTA is disabled on a locked record. With no
approvals-aware host, the old `approval_status`-field fallback is unchanged and
still assumes a lock — the safe direction.

**Silently stripped fields now surface on the record form's save path.** The
adapter emitted a write-warning for `create`/`update` responses carrying
`droppedFields`, but not for `batchTransaction` — which is how the record form
saves a master-detail record, i.e. the one surface where a user actually edits a
`readonlyWhen`-locked field. `batchTransaction` now emits one warning per event,
resolving each back to its operation via the response's `index`.

The toast itself was hardcoded English and called every strip "read-only". It is
now localized (`detail.writeStripped*`, en + zh) and worded by reason:
`readonly_when` says the field is not editable *in this record's current state*,
which is what actually happened — the field is editable in other states and the
form rendered it as an ordinary input.

**And it stopped crying wolf.** `createObjectStackUserStateAdapter` hand-stamped
the server-managed `updated_at` on every recents/favorites write, which the
server strips and reports — so the console popped "Some fields were not saved"
about a field no user ever touched, on page loads, drowning the signal the toast
exists for. It no longer sends the column; the server stamps it anyway.
