---
'@object-ui/app-shell': patch
'@object-ui/console': patch
'@object-ui/i18n': patch
---

An admin override of an approval now looks like one — before the click, and in the timeline afterwards.

A platform/tenant admin who holds **no slot** in a request's pending-approver
slate saw the exact same filled **Approve** / **Reject** / **Reassign** a
designated approver sees: no distinct styling, no warning, nothing. One unmarked
click takes framework#3424's privileged branch, which is *authoritative* — it
finalises the node even under `per_group` / `unanimous` / `quorum`, silently
bypassing every co-sign group that has not voted. The measured consequence in a
real app project was a PM who clicked Approve *"to see if it was real"* and
finalised a stage for an approver who never acted, then filed it as "countersign
is broken". The backend was working as designed; the console gave the admin no
way to see that.

Two halves, both client-side:

- **Affordance.** A viewer the server reports as `can_act: false` **and**
  `can_override: true` now gets a warning-styled action labelled as an override
  (`Override Approve`), and the dialog it opens **names the pending approvers
  being bypassed**. The wording is the fix, not decoration — a warning that does
  not say what is about to be bypassed would not have stopped that click.
- **Timeline.** `sys_approval_action.via_override` has been written since
  framework#4466 and sent on the wire ever since, but **no console surface read
  it** — an override rendered byte-for-byte like an ordinary approval in both the
  record page's approvals panel and the Approval Center. Override rows are now
  marked with an `Admin override` chip and a distinct timeline dot. This is
  framework#4466's own *Expected* ("surfaced in the timeline"), which never
  landed.

Nothing here relaxes anything. Who may act or override is unchanged, the request
the console sends is byte-identical, and no audit record is altered — this only
renders one that was already being written, and adds friction in front of a
privileged path.

Two details worth knowing, because both are load-bearing:

- The warning rides the **param dialog's** title and description rather than a
  chained `confirmText`. These decision actions collect params, so the param
  dialog is already the confirm — nothing is POSTed until its own Confirm — and
  putting a second dialog in front of it produces a first prompt that reads as
  "the action ran" (framework#7278, maintainer ruling 2026-08-10). One condition,
  one wording, one dialog.
- The notice travels as its own dispatch key, **not** folded into the action's
  `description`. The runtime resolves `description` through
  `_actions.<name>.description`, preferring a bundle hit over the passed literal,
  and `plugin-approvals` ships exactly such an entry for `approval_reject` — so a
  warning routed that way would have been silently replaced by the ordinary
  reject copy in every locale carrying the bundle. A safety notice a translation
  can delete is not a safety notice.

Which actions get the treatment is read from each action's **own declared
`visible` gate** (does it OR in `can_override`?), not from a hard-coded name
list, so a future decision action still ships as metadata alone — and
`approval_recall`, gated on `is_submitter`, is never relabelled. Every new string
goes through the `approvalsInbox.*` i18n path in all ten locale packs.
