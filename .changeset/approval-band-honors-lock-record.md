---
"@object-ui/react": minor
"@object-ui/plugin-detail": minor
"@object-ui/app-shell": minor
"@object-ui/i18n": minor
---

fix(detail): the approval band honors the node's `lockRecord` instead of assuming every approval locks (#2902)

A record detail page treated "a pending approval request exists" as "this
record is locked". An approval node declares `lockRecord` (default `true`), and
on `lockRecord: false` the server keeps accepting writes for the whole time
that node waits — so the console was asserting a lock the backend did not
enforce.

The label was the smaller half of it. The same conflated signal fed `canEdit`,
so the record-level inline-edit session was suppressed too: no pencils,
`enter()` a no-op. On a single-approver step — a department head or plant
manager, exactly the case `lockRecord: false` exists for, where the approver is
meant to fill in the missing detail before deciding — the capability was
unreachable from the UI. And a flow chaining nodes with different policies drew
one identical band for "edit freely" and "the server will reject your save with
`RECORD_LOCKED`", so the two states were indistinguishable until Save failed.

Approval state is now two signals:

- **`approvalPending`** — an approval is running. Drives the band and the recall
  button, both meaningful whether or not the record is editable.
- **`locked`** — that approval also forbids edits, from the pending node's
  `lock_record` (framework#3814, read off the same `node_config_json` snapshot
  the server's record-lock hook reads).

The band renders two states: amber lock + "Locked for approval", or sky clock +
"In approval · editable", each with its own tooltip. Recall moved out of the
locked branch — an editable pending approval is just as recallable. Inline
editing stays live in the editable state.

`InlineEditProvider` takes a new optional `approvalPending` prop, defaulting to
`locked`, so a host that threads only `locked` renders exactly as before. The
record's `approval_status` field remains the fallback for backends with no
approvals API; it carries no node granularity, so it still reads as locked — as
does a pending request from a backend too old to report the policy.

New `detail.approvalPendingEditable` / `detail.approvalPendingTooltip` keys are
translated in all ten locales.
