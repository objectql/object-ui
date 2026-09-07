---
'@object-ui/plugin-chatbot': patch
---

A confirm-gate preview no longer counts as the commit that settles the card before it
(objectui#8343).

`builtPlanIds` decided a proposed plan had been built from the tool NAME alone —
`tool.toolName === 'apply_blueprint'`. On an iteration turn where the user did not say
the magic phrase ("直接搭建" / "just build it"), `apply_blueprint` hits its own
confirm gate and returns `{status:'awaiting_confirmation'}`: it built nothing and is
itself waiting for the user. That still marked the earlier `propose_blueprint` card
已搭建, collapsing its "Build it" button into an inert badge — and the
`apply_blueprint` card carries no button of its own, so the turn was left with **no
confirm affordance at all** while the assistant's prose asked the user to confirm one.
The only way forward was guessing "确认" into the composer.

A build now only counts when the invocation is not a confirm-gate preview
(`!isProposalResult(tool.result)`) — the same fact the tool header already reads to say
"Awaiting Approval". A still-running `apply_blueprint` (no result yet) keeps counting,
so the objectui#432 guard against re-triggering an in-flight build is unchanged.

The sibling `confirmedChangeIds` memo carried the same defect one level down: it
inferred "this later call committed" from the ABSENCE of a rich `proposedChanges` card,
and that detector additionally requires ≥1 parseable change row — so a later same-tool
call that WAS a preview but produced no card (an empty `changes: []`) silently settled
the pending 确认修改 card. It now reads the preview fact directly too.
