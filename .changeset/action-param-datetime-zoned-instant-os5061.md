---
"@object-ui/app-shell": patch
---

`datetime` action params are usable in the Console for the first time — the dialog now POSTs the zoned ISO instant the platform requires instead of a shape the validator rejects

An action declaring a `type: 'datetime'` param was unusable from the UI: **no
value a user could pick could pass validation**. The dialog rendered the param
as `datetime-local` (which is zone-less by nature) and then serialized on
submit back to that control's own naive wall clock, e.g. `2026-08-10T15:00`.
Since 17.0 the dispatcher validates a params bag against the action's
declaration before the handler runs (ADR-0104 D2, `validateActionParams` →
`InstantValueSchema`), and that contract is an ISO-8601 instant with an
explicit zone. Every submission earned:

```
HTTP 400 VALIDATION_ERROR
Action param "start" (datetime): expected an ISO-8601 instant with explicit
zone (e.g. 2026-03-15T14:30:00.000Z)
```

The renderer and the validator wanted disjoint shapes, and an app author had no
seam between them — declaring a `datetime` param doomed the action in the UI,
whatever the app. Found in a hotcrm dogfood run (objectstack#5061), reproduced
from two separate entry points (list-view row menu and record header).

The fix is a removal, not a conversion. `DateTimeField` has been ISO-canonical
on both sides since objectui#3127/#3565 — it takes the record's ISO instant in
and hands an ISO instant back out, seconds, milliseconds and zone included — so
the widget's own value already satisfies the contract. #3565 added the
back-conversion to keep the wire shape byte-identical while it fixed a display
bug, and named the follow-up in its own commit message: moving action params
onto ISO is a contract change of its own. This is that change.
`serializeParamValues` now passes `datetime` values through untouched, which
makes it idempotent for a value that already carries a zone (a `+08:00` offset
survives byte-for-byte rather than being re-derived and re-cut to the minute)
and leaves an empty or unfilled param alone.

Deliberately still rejected: an authored `defaultValue` written as a zone-less
wall clock. That value is ambiguous metadata — whose zone? — and coercing it in
the renderer would make it "work" in the UI while the identical literal kept
400ing from REST and MCP, which is the worst split to debug. It stays loud
until the spec validates a param default against the param's own value
contract, filed as objectstack#6970 (the same hole lets a `number` param
default to `'abc'`, so it is not datetime-specific).

The render proof that pinned the old shape was replaced rather than re-spelled:
it asserted `2026-07-20T14:30` and was green while the feature was 100% broken,
because the shape it pinned is the one shape nothing accepts. It now drives the
real widget and asks the real `validateActionParams` — the exact function that
produced the 400 — whether the resolved bag is acceptable. The datetime
assertions are written to hold in every timezone (verified under
`Asia/Shanghai`, `UTC` and `America/Los_Angeles`), since a zone-shaped test that
only holds in UTC goes green on CI while the defect is live for every user east
or west of it.
