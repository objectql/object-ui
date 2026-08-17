---
---

Docs-only correction, no behaviour and no authoring-surface change (objectui#3888).

ADR-0036's `## Server enforcement (framework)` section stated the server's fault
policy unconditionally: "A predicate that fails to evaluate is **fail-open** and
logged". That covered both server-enforced predicates in one line, and it has been
false for one whole fault class since objectstack#4889: a `readonlyWhen` predicate
that faults because it names a scope ROOT the write never bound (`parent.status ==
'paid'` with no master-detail header in hand) is fail-CLOSED —
`isReadonlyWhenLocked` warns `… treating the field as LOCKED` and resolves the
field to locked, and `stripReadonlyWhenFields` / `stripReadonlyWhenFieldsMulti`
then delete that key from the UPDATE payload, surfacing as a `droppedFields` entry
with `reason: 'readonly_when'`.

This was the last uncorrected copy of that stale assertion. The code-comment copy,
in `packages/core/src/evaluator/fieldRules.ts`, was narrowed by objectui#3828; the
ADR is where a reader looks FIRST when asking what the server does, so leaving it
preserved the wrong mental model in the more authoritative place.

The summary bullet now carries the exception and points at a new subsection that
states it in full: why the unbound-root case is not a broken predicate, what the
server does with it, and — since the client deliberately does NOT mirror it — the
silent symptom that divergence produces (field renders editable, save reports
success, value never lands) plus which end to debug. The `## Client enforcement
(objectui)` section's "the same posture as the server" clause is narrowed the same
way, since it asserted the same parity.

Two things verified as still accurate and left alone: the `requiredWhen` half
(objectstack#4977 bound the same `parent` scope but deliberately kept fail-open
semantics, so an unevaluable requirement is skipped on both ends) and the
`visibleWhen` bullet (the server never evaluates it). Both are now stated as
explicit non-exceptions rather than implied by an over-broad summary.

The ADR-0057 D10 citation is marked as the **framework's** numbering: this repo
carries an unrelated `docs/adr/0057-console-ai-chat-one-conversation-docked.md`,
so an unqualified "ADR-0057" resolves to the wrong document for a reader in this
tree. It is also written as an attribution — the shorthand the framework's
rule-validator, lint diagnostics and QA runner all use — rather than as a claim
that the D-anchor resolves, because verification could not confirm that it does
(filed against the framework, not fixed here).

No package is declared because nothing published changed: the diff is one
markdown file under `docs/adr/`.
