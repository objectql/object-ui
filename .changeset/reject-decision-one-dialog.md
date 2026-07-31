---
"@object-ui/app-shell": patch
---

fix(approvals): record-header Reject fires after ONE dialog again (objectui#3126)

Since #2961 made the record header's decision inputs live (`actionParams`),
the Reject action carried BOTH `confirmText` and a collectable comment param.
The ActionRunner chains confirmation before param collection, so rejecting
queued two dialogs: the approver answered "Reject this approval request? →
Continue", the alertdialog closed — and no request fired, because it was
waiting on a second, unexpected "Action parameters / Comment (optional)"
dialog. Anyone on the rc.0 contract (one confirm → request) read that as a
silent no-op: zero network traffic, no toast, the flow stuck pending. Approve
never declared `confirmText`, which is why it kept working on the same node.

The Reject action no longer declares `confirmText`. The param dialog is the
confirmation surface: it is titled by the action ("Reject"), carries the old
confirm question as its description (same `approvals.rejectConfirm` i18n key,
so every locale keeps its translation), collects the optional comment and any
declared decision outputs, and nothing is sent until its own Confirm — one
decision, one dialog, matching Approve and the Approval Center.
