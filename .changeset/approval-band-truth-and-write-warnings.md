---
"@object-ui/plugin-detail": minor
"@object-ui/app-shell": minor
"@object-ui/data-objectstack": minor
"@object-ui/i18n": minor
---

fix(detail): finish the approval-lock story, and warn on silently stripped fields (framework#3794)

The Console reported record writability wrong in both directions during an
approval, so a user had nothing to go on: what they *could* edit said "locked",
and what they *couldn't* said "updated successfully".

**The lock band told the truth; the Edit button did not.** objectui#2902 split
the band into "in approval · editable" vs locked, but the header **Edit** CTA
still keyed off nothing at all — on a genuinely locked record it stayed live, so
the user opened the form, filled a screen, and got `RECORD_LOCKED` back on Save.
It is now `disabled` on a locked record: visible-but-off, with the band beside it
saying why. This is the LOCK, not the mere presence of an approval — a
`lockRecord: false` node keeps Edit live, which is the point of that setting.

**And the band could still re-lock itself.** `DetailView` OR-ed the record's own
`approval_status` mirror into `isLocked` unconditionally. That mirror is written
on submit by any flow configuring an `approvalStatusField`, *regardless of*
`lockRecord` — so on a `lockRecord: false` node the host correctly resolved "not
locked" from the request's `lock_record` while the mirror dragged the band back
to "Locked for approval", with the pencils live and saves landing underneath it.
The host is now authoritative whenever it threads `approvalPending`; the mirror
is consulted only for bare/legacy `DetailView` hosts that thread nothing, where
it still reads as locked (no node granularity — the safe direction).

Recall's tooltip no longer promises to unlock a record the node never locked
(`detail.cancelApprovalTooltipUnlocked`).

**Silently stripped fields now surface on the record form's save path.** The
adapter emitted a write-warning for `create`/`update` responses carrying
`droppedFields`, but not for `batchTransaction` — which is how the record form
saves a master-detail record, i.e. the one surface where a user actually edits a
`readonlyWhen`-locked field. `batchTransaction` now emits one warning per event,
resolving each back to its operation via the response's `index`.

The toast itself was hardcoded English and called every strip "read-only". It is
now localized (`detail.writeStripped*`, ten locales) and worded by reason:
`readonly_when` says the field is not editable *in this record's current state*,
which is what actually happened — the field is editable in other states and the
form rendered it as an ordinary input, so "read-only" sent the user hunting for a
permission problem that does not exist.

**And it stopped crying wolf.** `createObjectStackUserStateAdapter` hand-stamped
the server-managed `updated_at` on every recents/favorites write, which the
server strips and reports — so the console popped "Some fields were not saved"
about a field no user ever touched, on page loads, drowning the signal the toast
exists for. It no longer sends the column; the server stamps it anyway.
