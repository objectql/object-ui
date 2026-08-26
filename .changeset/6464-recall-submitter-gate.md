---
'@object-ui/react': minor
'@object-ui/plugin-detail': patch
'@object-ui/app-shell': patch
---

The record page's approval band offers its **Recall** button to the approval's submitter
only (objectui#6464).

Field report on `@objectstack/*@17.2.0`: user A submits a record into a 4-level approval;
user B — not the submitter, read access, not an admin — opens the record and the band still
lights a clickable recall button. The click cannot succeed. The recall endpoint authorizes
on submitter identity and refuses everyone else, so the only outcome available to that
button was a failure toast. Record state was never at risk; this was purely a
writability-feedback mismatch, the same family as objectui#3794.

The button's only gate was `dataSource.cancelPendingApproval` — "can this adapter recall at
all" — which is a question about the DataSource, not about the viewer. Identity now joins
it, threaded the way every other signal on that band already travels: the HOST resolves it
and passes it through `InlineEditProvider`, so the renderer stays DataSource-agnostic and
never re-derives who submitted what.

- `@object-ui/react` — `InlineEditProvider` accepts `approvalIsSubmitter`, surfaced on
  `InlineEditContextValue`. Additive and optional; no existing prop changes.
- `@object-ui/plugin-detail` — the band's recall button is withdrawn when that signal is a
  resolved `false`.
- `@object-ui/app-shell` — `RecordDetailView` resolves the verdict from its existing
  approvals read and threads it.

**The signal is tri-state, and the third state is the load-bearing one.** `true` offers
recall, `false` withdraws it, and **`undefined` — a host that resolves no approval identity
— renders exactly as it did before this release.** Omission preserving prior behaviour
mirrors how `approvalPending` falls back to `locked`. Defaulting the unknown case to "hide"
would have traded a cosmetic defect for a functional loss: every host whose band runs off
the record's `approval_status` mirror alone would silently lose its submitter's only way to
unlock their own record.

**Withdrawn rather than disabled-with-reason.** The card offered either. For a
non-submitter this control is never actionable on any pending record, so a permanently
disabled button is standing clutter rather than a lesson; and the two sibling submitter
levers already hide — the approvals panel's Remind button, and the declared
`approval_recall` action's `visible` predicate. The band, its quorum tally and the
approvals timeline still tell a non-submitter exactly what state the record is in. Only the
lever they can never pull is gone.

**This changes no permission.** Nothing about what the server allows moves, `canEdit` and
the approval lock are untouched, and nothing downstream reads `approvalIsSubmitter` as an
authorization verdict — the recall endpoint remains the sole authority, and it refused
these callers before this change and refuses them after. There is deliberately **no admin
carve-out** (the reporter ruled that case out, cf. objectstack#9464).

The derivation itself is now one function, `isSubmitterOf` — server-resolved
`viewer.is_submitter` first (framework#3310), an id comparison as the fallback for backends
that predate it, joined with `??` so a server that resolved `false` is believed rather than
re-litigated client-side. The approvals panel's Remind gate, which already carried that
expression inline and whose behaviour is unchanged, now reads the same answer: two copies
would have been two definitions of who submitted.

The **untranslated refusal text** the reporter also saw ("No pending approval request found
for this record", concatenated after a localized prefix) is a separate defect and is not
addressed here; it is tracked on objectstack#11993.
