---
"@object-ui/app-shell": minor
---

fix(approvals): decision outputs reach both decision surfaces (objectui#2955, framework#3447 P2)

An approval node can ask the approver for structured data with their decision
(`decisionOutputs`) — typically to route the next node's approvers, which the
flow then reads as `vars.<nodeId>.<key>`. The server has shipped this since
framework#3447 P2 and surfaces the typed declaration on the request row
(`decision_output_defs`), but neither Console decision surface actually
delivered it.

**The Approval Center asked for a record id instead of showing a picker.** The
typed pickers landed in objectui#2831 and the drawer really did synthesize a
`lookup` param per declared output — but it spelled the picker target
`referenceTo`, and `resolveActionParams()` (which every collected param passes
through before the dialog renders it) rebuilds an inline param from a fixed key
list, reading the target from `reference`. The target was dropped there, and
`paramToField()` degrades a targetless picker to a plain text input — so a
`position` output rendered as a box labelled "<label> 的记录 ID". The approver
had to go find the record id somewhere else and paste it back. `user`-typed
outputs were unaffected (that widget needs no target), which is why this
survived: `department` / `position` / `team` were the broken three.

**The record header decided without collecting anything at all.** Approve /
Reject on the detail page shipped their inputs under `collectParams` — a key
nothing in the codebase reads (`ActionRunner` collects from `actionParams`).
No dialog had opened on that surface since the ADR-0019 rework: the approver's
comment was silently dropped on every record-page decision, and a node
declaring `decisionOutputs` got no inputs either, so the flow resumed with
`vars.<node>.<key>` missing — the next node's `expression` approver then failed
with `EXPRESSION_FAILED`, or fell through to `onEmptyApprovers`, with nothing
surfaced to the approver or the flow author. The header now collects through
`actionParams`, renders the node's declared outputs with the same pickers the
Approval Center uses, and posts them under `outputs` on the decide call. The
comment box works again as a side effect, and it is a real textarea (the param
resolver drops `multiline`, so the intent has to ride the type).

The widget mapping now lives in one place (`utils/decisionOutputParams`), so
the two surfaces cannot drift apart again, and the round trip through param
resolution — the stage that actually broke — is pinned by tests.

Not fixed here: `DecisionOutputDef` has no `required`, so a flow author still
cannot demand that an approver fill an output before approving. That needs the
spec-side field first (framework), and `onEmptyApprovers` remains the only
backstop until then.
