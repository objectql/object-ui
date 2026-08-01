---
"@object-ui/app-shell": minor
"@object-ui/i18n": minor
---

fix(approvals): the record page renders the request's declared actions, not its own two buttons (objectui#3055)

A record awaiting approval showed **Approve** and **Reject** on its header and
nothing else. Transfer, send back and request-more-info had no entry point on a
business record at all, decisions carried no attachments, and the copy was a
second set of strings that drifted from the Approval Center's. Worse, whether
the two buttons appeared at all was decided **client-side**:

```ts
pendingRequest.pending_approvers.includes(currentUserId)
```

A position / team / department approver never matches that test — those slots
hold group literals the server resolves — so a group approver saw **no decision
buttons at all** and had to find the Approval Center to act.

None of this needed to exist. `sys_approval_request` already declares all nine
actions as object metadata, with their params, confirm copy and a `visible` CEL
gated on the server-computed `viewer` block (the same resolution the decision
routes authorize with). The record header now mirrors that declaration instead
of re-implementing a subset of it:

- **Every action, one source.** Approve / Reject inline, Reassign / Send back /
  Request info / Remind / Recall / Resubmit in the header's `⋯` overflow —
  mapped from the declared `list_item` / `record_section` locations. A new
  decision capability now ships as metadata and needs no console change.
- **The server decides who may act.** Predicates are evaluated against the
  request (which carries `viewer`), then stripped before the header can
  re-evaluate them against the host record. Group approvers get their buttons;
  evaluation fails closed, so a backend that predates `viewer` offers no
  decision rather than one the server would reject.
- **One dispatch path.** `buildDeclaredActionDispatch` is now shared by the
  Approval Center's `DeclaredActionsBar` and the record header, and both fold
  `outputs.<key>` decision params through `foldDecisionOutputs` — so the two
  surfaces POST identical bodies, attachments and typed decision outputs
  included.
- **The returned round is actionable where the work happens.** The header reads
  a `liveRequest` (`pending` **or** ADR-0044 `returned`), so a submitter can
  resubmit from the record they just fixed.

`useRecordApprovals` stops deciding: `approve` / `reject` / `canDecide` and its
`currentUserId` argument are gone, leaving the status band, the `lock_record`
edit lock and the request the declared actions run against. The orphaned
`approvals.*` locale strings are removed with them — the declared labels
localize through the `_actions.<name>.*` convention both surfaces already use.
