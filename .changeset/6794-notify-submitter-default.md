---
'@object-ui/app-shell': patch
---

The flow-node inspector now declares the spec's default for
`escalation.notifySubmitter` (objectui#6794).

`FLOW_NODE_CONFIG`'s approval group declared **no `defaultValue`** for
`escalation.notifySubmitter`, while the installed `@objectstack/spec` (17.2.0)
defaults the key to `true` — `ApprovalEscalationSchema.safeParse({ timeoutHours: 24 })`
returns `notifySubmitter: true`. So the hand-written table stated the opposite of
what an omitted key does at runtime, and it disagreed with the **online half of
the same form**: a backend that publishes the approval `configSchema` sends
`default: true`, which `json-schema-to-fields` turns into `defaultValue: 'true'`.
Offline and online rendered the same key from two different claims about the
spec.

`defaultValue` is what `isFieldVisible` resolves an unset controller against, so
the missing declaration is what a future field gating on `notifySubmitter` would
have read — and it is what the table asserts about the contract to anyone reading
it.

A reconciliation assertion in `flow-node-config.spec-reconciliation.test.ts`
keeps the two sides pinned. It reads the expected value **out of the installed
spec** rather than pinning the literal `'true'`: objectui is the consumer of that
contract and must not become a second source of truth for it. A vacuity guard
alongside it fails if the spec ever stops materialising the key at all, so the
comparison can never quietly become a comparison against `undefined`.

Deliberately scoped to `notifySubmitter`. The sibling controller
`escalation.enabled` is a separate, on-hold card (objectui#6620) whose default
flips on a *future* spec bump; installed spec and table agree on it today, and
generalising this assertion across the block would arm that card's tripwire here.
