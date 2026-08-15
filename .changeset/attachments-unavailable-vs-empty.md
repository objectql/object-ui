---
'@object-ui/app-shell': patch
'@object-ui/i18n': patch
---

RecordAttachmentsPanel distinguishes an UNLOADED attachment list from an empty one.

A `sys_attachment` list read that failed for any non-authorization reason — a
network failure (server unreachable, DNS, aborted request), a 5xx, or a 401 /
`AUTH_REQUIRED` (an expired session is authentication, not authorization, so the
denied predicate deliberately does not claim it) — was swallowed into the
panel's empty state. All three rendered "No attachments yet. Upload a file to
get started.": an affirmative claim about the record's contents, made by a panel
that never got an answer, over a record that may hold thousands of files.

The panel now carries the same four-way status vocabulary its siblings use —
`loading` / `loaded` / `denied` / `unavailable` — and every state that means
"the panel does not know" is answered before `rows.length === 0` is allowed to
mean "the record holds nothing". A failed read renders a distinct unavailable
state ("We couldn't load the attachments for this record.", new
`detail.attachmentsLoadFailed` and `detail.retryLoadAttachments` keys in all ten
locale packs) with a **retry** — unlike the denied state, an outage and a lapsed
session are both things a second attempt can fix — and withdraws the Upload
affordance, because offering an upload against a list the panel could not reach
is the same over-assertion as the empty state it replaces. Like the denied
state, it renders the translated sentence and nothing sourced from the error: no
status code, no server message, no host.

The empty state is now reserved for a genuine 200-with-zero-rows, and the
denied state (403 / `PERMISSION_DENIED` / `FORBIDDEN` / a row-level-security
denial) is unchanged. The "table not provisioned on an older stack" case is
unaffected: the ObjectStack adapter degrades a bare 404 to `{ data: [], total: 0 }`,
so it resolves through the success path and still renders the empty state.

This restores a house rule that had already landed twice as a bug fix —
`HomeActionCenter` may only say "You're all caught up" once the inbox has
answered, and an unloadable app list is UNKNOWN rather than "no default app".
