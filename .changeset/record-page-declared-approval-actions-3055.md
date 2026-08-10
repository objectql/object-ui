---
'@object-ui/app-shell': patch
---

Run `sys_approval_request`'s server-declared decision actions on the business record page, and retire the hard-coded two-button approval path (objectui#3055).

A record with an approval pending on it showed exactly two buttons — Approve and Reject — hand-written into the record header behind a bespoke `type:'approval'` handler and a client-side approver test. The approvals list, looking at the same request over the same nine REST routes, offered five decisions plus the submitter's levers and took decision attachments. On a business record, **reassign / send back / request info had no entry point at all**, a decision could not carry a file, and the copy on the two surfaces was maintained separately.

The record page now renders the object's own declared actions through the shared declared-action bar — the same metadata, the same action runtime, the same param dialogs the approvals list uses. Approve, Reject, Reassign, Send back and Request info reach a business record, with their declared params (comment, attachments, the new approver picker) and the per-request decision outputs an approval node declares. Remind stays with the approvals panel, which owns a richer, throttle-aware version of it. Adding a tenth decision action is now a metadata change with no console work.

Two behaviour changes come with it:

- **Who sees a decision is the server's answer, not the console's.** Visibility was `pending_approvers.includes(currentUserId)` evaluated in the browser; it is now each action's declared `visible` predicate over the server-computed `viewer` block (`can_act` / `is_submitter` / `can_override`) — the same block that gates the approvals list, computed by the same service that authorizes the decision. A platform or tenant admin's override levers, the recovery path for a request routed to an unstaffed position, now reach the record page for the first time. On a backend too old to send `viewer`, the predicate cannot be evaluated and no decision is offered rather than one whose precondition is unknown.
- **A declared `visible` written against the canonical `record.` root now evaluates.** The declared-action bar passed the row in as the bare predicate scope, so only the shorthand spelling (`status == "pending"`) resolved; `record.viewer.can_act` raised `record is not defined`, and the fail-closed gate turned that into "hidden". Every declared action on `sys_approval_request` gates on `record.viewer.*`, so the whole server-declared decision set was invisible on every surface this bar renders, the approvals inbox included. The row now binds the three ways the record header and list rows bind it — `record.status`, bare `status`, `data.status` — so both spellings reach a verdict.

`useRecordApprovals` keeps only its read half (status, `lock_record`, the request rows). Its `canDecide` / `approve` / `reject` members and its `currentUserId` parameter are gone: deciding is the declared action's POST, and every remaining question about the viewer is answered on the row by the server.
