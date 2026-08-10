---
---

Comment-only change, no behaviour and no authoring-surface change (objectui#3828).

The module head of `packages/core/src/evaluator/fieldRules.ts` described the
client's readonly fail-open as "matching the server, which logs and allows the
change through". That was true when it was written and has not been true for one
whole fault class since objectstack#4889: a `readonlyWhen` predicate that faults
because it names a scope ROOT the write never bound (`parent.status == 'paid'`
with no master-detail header in hand) is fail-CLOSED on the server —
`isReadonlyWhenLocked` warns and returns TRUE (LOCKED), and
`stripReadonlyWhenFields` / `stripReadonlyWhenFieldsMulti` then delete that key
from the UPDATE payload. The client, correctly, keeps the same fault fail-OPEN.

So the two ends point in OPPOSITE directions for that class, and the comment
described them as agreeing — which points a reader the wrong way on the one
symptom the divergence produces: the form renders the field editable, the save
reports success, and the value silently never lands. The narrowed text names the
divergence, cites the framework's ADR-0057 D10 (server enforces, client is
courtesy) as the reason the client does NOT follow the server here, and tells the
caller which end to debug (the server's `treating the field as LOCKED` warning
and the write response's `droppedFields`, not the client predicate).

The `requiredWhen` half stays as it was, re-verified accurate: objectstack#4977
bound the `parent` scope for those predicates and deliberately kept the fail-open
semantics, so an unevaluable requirement is skipped on both ends. Field-level
`visibleWhen` likewise — the server does not evaluate it at all. The "log and
allow" quote further down the docblock is now marked as the GENERIC-fault
message, so the narrowing is not undone two paragraphs later.

No package is declared because nothing published changed: the diff is a docblock
only, every line of code untouched, and `packages/core/src/evaluator`'s tests keep
their count byte for byte (289 passed before, 289 passed after).
