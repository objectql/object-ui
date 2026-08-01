---
"@object-ui/app-shell": minor
"@object-ui/plugin-detail": minor
"@object-ui/react": minor
"@object-ui/i18n": minor
---

A record's approval band now shows the quorum / per-group tally the server already computes.

The showcase's `showcase_committee_quorum` node declares `behavior: 'quorum'` with
`minApprovals: 2` over three approvers, and even ships a pre-rendered
`"Committee Sign-off (2 of 3)"` label; `showcase_expense_signoff` declares
`per_group` (会签) with named manager / finance groups. On the business record
the approval band rendered none of it — the lock badge, the recall button and
the approve/reject actions were all correct, but a two-of-three committee step
looked exactly like a one-approver step. An approver could not see whether their
own click finalized the node or was one of three, which is the single fact a
quorum node exists to express (objectstack#4478).

Nothing was wrong on the wire, and nothing here papers over the server. The
framework computes `decision_progress` — `{ behavior, got, need, groups? }`,
derived from the node's own `node_config_json` snapshot, so the count a client
shows is the count the engine will enforce. **It attaches that block in
`getRequest` only**: `listRequests` deliberately skips it, because the
`sys_approval_action` tally it costs is per row and a list read may return
hundreds. The record header's `useRecordApprovals` reads
`GET /approvals/requests?object=…&recordId=…` — the list route — so the
enrichment was never in the payload it had. The hook now follows up with one
single read for the ONE pending row and folds the result onto it; a failed or
mismatched follow-up leaves the row exactly as the list sent it, so a display-only
enrichment can never take the approval panel down and no tally is ever invented.

`InlineEditProvider` carries the block through as `approvalProgress`, and the
DetailView approval band renders it beside the existing badge: a labelled
`role="progressbar"` with one tick per required approval for `quorum` /
`unanimous`, and for `per_group` a chip per group marking which have signed
(`finance 1/1` ✓, `manager 0/1`). Group names come from the flow author's own
config, so they need no locale strings; the three new label keys are added to all
ten packs. `first_response` nodes carry no `decision_progress` and are unchanged —
one decision is the whole step there, and a "1 of 1" bar would be noise.

Scored `minor` rather than `patch`: this is new observable rendering plus a new
public `approvalProgress` prop / `ApprovalProgress` type on `@object-ui/react`,
not a behavior correction inside an existing surface.
