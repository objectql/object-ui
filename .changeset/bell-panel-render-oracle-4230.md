---
---

Internal only — tests and comments, no source change, so no release.

#4230 reported the console bell panel dead again ("No notifications" under both
Unread and All while `/api/v1/notifications` returned 10 rows) and filed it as a
regression of #4110 / PR #4199. It is not a regression: the QA build vendored
console `09987b68` (2026-08-09 02:35:56Z) and #4199 landed as `7b0783232`
(2026-08-10 20:39:10Z), 42 hours later — `git merge-base --is-ancestor 7b0783232
09987b68` exits non-zero, and that console's `AppHeader.tsx` still carries the
`isApp` gate #4199 removed. No production code needed changing.

What the round did expose is a hole in #4199's own pin: every case in
`AppHeader.inboxVariant.test.tsx` held one row and never touched the popover's
Unread/All sub-filter, so nothing could distinguish "Unread is empty because
every row is read" from "the panel was handed nothing" — and the second reading
under All is the load-bearing half of the reported symptom. This adds eight
cases driving the QA payload (ten rows, mixed read-state, including the
`approval.reminder`) through `AppHeader` and `InboxPopover` under both filters.
