---
"@object-ui/app-shell": patch
"@object-ui/i18n": patch
---

fix(approvals): Approval Center triage + drawer readability pass (#2762 P1-2/P1-3/P1-4/P1-5/P2)

- **Decision-relevant data in the queue (P1-3)** — list rows and mobile cards
  now surface the request's amount/total inline (detected from the snapshot,
  preferring the server-formatted `payload_display` value), so a reviewer can
  triage without opening each request. A sort control adds "Oldest first" and
  "Amount (high→low)" alongside the default newest-first.
- **Empty applicant column (P1-4)** — flow-/system-initiated requests (no human
  submitter) now read "Flow-initiated" with a workflow icon instead of a bare
  person icon + "—", in the desktop table, mobile card, and drawer.
- **Approver chips deduped (P1-2)** — a person filling more than one approver
  slot rendered as N identical "Waiting on" chips; they collapse to one chip
  with a ×N count, the tooltip keeping every underlying id.
- **Action hierarchy (P1-5)** — `DeclaredActionsBar` maps the spec action
  `variant` enum onto the Button variants (`primary` → filled default,
  `danger` → destructive), so the drawer's Approve stands out and Reject reads
  as destructive once `@objectstack/plugin-approvals` declares them.
- **Label polish (P2)** — `owner_id`-style resolved lookup keys render as
  "Owner", not the awkward "Owner Id", in the drawer summary.

New `approvalsInbox` keys (`flowOrigin`, `sortBy`/`sortRecent`/`sortOldest`/
`sortAmount`) added to all ten locales.
