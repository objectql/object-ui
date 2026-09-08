---
'@object-ui/app-shell': patch
---

The flow-node inspector now declares the spec's default for
`escalation.enabled`, so approval nodes that omit the key render as the
escalating nodes they are (objectui#6620).

`FLOW_NODE_CONFIG`'s approval group declared `defaultValue: 'false'` for
`escalation.enabled`, while the installed `@objectstack/spec` (17.3.0) defaults
the key to `true` — `ApprovalEscalationSchema.safeParse({ timeoutHours: 24 })`
returns `enabled: true`. An approval node whose escalation block omits the key
therefore escalates at runtime, while the designer drew the SLA-escalation
toggle OFF and hid all four sub-fields behind it (`timeoutHours`, `action`,
`escalateTo`, `notifySubmitter`). The inspector said "no escalation" about a
node that escalates, and the author had no way to see or edit the timeout that
was live.

`defaultValue` has two read sites, so the one-line flip repairs both: it is what
`controllerAdmits` resolves an unset `showWhen` controller against (the gating
of those four sub-fields) and, since the boolean control learned to seed itself,
what the rendered toggle shows. The online half of the same form was already
correct — a backend publishing the approval `configSchema` sends `default: true`,
which `json-schema-to-fields` turns into `defaultValue: 'true'` — so offline and
online rendered the same node from two different claims about the spec.

An explicitly stored `escalation.enabled: false` is unchanged: it still beats the
declared default and still hides every sibling.

The reconciliation assertion in `flow-node-config.spec-reconciliation.test.ts`
now covers the whole escalation block rather than `notifySubmitter` alone, and
derives every expected value from the installed `ApprovalEscalationSchema`
instead of pinning literals. This is the substance of the fix as much as the flip
is: the previous tripwire for this key read only the hand-written table, so a
spec bump could never redden it and the divergence went live unnoticed. A
vacuity guard fails if the spec stops materialising defaults for the block, so
the ledger cannot quietly become a comparison against nothing.
