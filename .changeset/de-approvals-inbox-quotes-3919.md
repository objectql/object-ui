---
"@object-ui/i18n": patch
---

`de` approvals inbox no longer shows two quote typographies on one screen

Three `approvalsInbox` values quoted the record title with ASCII straight quotes
on **both** sides while their own sibling `approvalsInbox.approveOneTitle` used
the correct German pair (U+201E low-9 opener, U+201C closer):

| key | before | after |
| --- | --- | --- |
| `approvalsInbox.rejectOneTitle` | `"{{title}}" ablehnen?` | `„{{title}}“ ablehnen?` |
| `approvalsInbox.inlineApproved` | `"{{title}}" genehmigt` | `„{{title}}“ genehmigt` |
| `approvalsInbox.inlineRejected` | `"{{title}}" abgelehnt` | `„{{title}}“ abgelehnt` |

A German approver therefore met both typographies in a single screen and inside a
single operation pair — German quotes on the approve confirmation, typewriter
quotes on the reject confirmation and on both inline toasts. `„…“` is the pack's
own majority (50 paired spans) and DUDEN R11, so the three values were the
outlier. Keys and the `{{title}}` placeholder are unchanged; this is a
value-domain typography fix, and `en` (ASCII on both sides by design) is
untouched.

This is a **different defect shape** from objectui#3876, which paired a German
opener with an ASCII closer. Because these three were ASCII on both sides they
were self-consistent, so the pairing invariant objectui#3876 left behind could
not see them — it scans forward from each `„`, and there was no `„` in them to
scan from. The pack's straight-quote census being empty now lets that pin become
strictly stronger: `de-quote-pairing-3876.test.ts` asserted an explicit
three-key allowlist and now asserts that **no `de` value holds a U+0022 at all**,
which covers both defect shapes and needs no per-key maintenance as new values
land. The pack census moves from `„` 47 / `“` 47 / `”` 0 / `"` 6 to
`„` 50 / `“` 50 / `”` 0 / `"` 0.

None of the three i18n gates could have caught this: `all-locales-key-parity`
compares key sets and placeholder shapes, `check-i18n-call-site-keys.mjs` only
asks whether a key resolves, and `check-i18n-en-drift.mjs` fires on `en` value
changes — these values were wrong from the day they landed, so no drift event
ever existed. All three are value-blind by design, which is why the invariant
lives in a test.
