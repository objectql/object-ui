---
'@object-ui/data-objectstack': minor
---

Parse a write-strip's `reason` against the spec enum at the boundary
(objectui#4934).

`notifyDroppedFields` filtered a create/update response's `droppedFields` on
SHAPE alone — a hand-written `e is DroppedFieldsEvent` guard that checked
`Array.isArray(fields)` and nothing else — so a `reason` outside
`'readonly' | 'readonly_when' | 'primary_key'` reached every subscriber typed as
though it were inside the union. A deployed client normally runs BEHIND the
server it talks to, so a reason from the future is the expected skew direction,
not a corrupt payload; the interior was typed to trust a union no one had
checked, and nothing in the repo could say so. `notifyBatchDroppedFields` did
the same through its `entry as DroppedFieldsEvent & { index?: number }` cast.

Both paths now read `reason` against `DroppedFieldsEventSchema.shape.reason` —
the enum the installed pin declares, derived rather than restated, so a pin bump
that adds an arm widens the accept set on its own:

- **Every entry is kept.** Dropping the unparsable ones would tell the user
  nothing about fields the server really did strip, which is exactly the silence
  objectui#3484 removed.
- An unrecognized `reason` arrives on a named skew arm,
  `UnrecognizedDropReasonEvent`, carrying `UNRECOGNIZED_DROP_REASON` plus the
  wire value **verbatim** in `unrecognizedReason` — never coerced onto a known
  arm, because claiming `readonly` for a reason we cannot name is a false
  statement about the user's data.
- `WriteWarningEvent['droppedFields']` is therefore the two-arm
  `DroppedFieldsNotice`. The spec type stays the canonical arm and is not
  widened to `string` (objectui#3160): the skew arm is not assignable to
  `DroppedFieldsEvent`, so a consumer branching on `reason` now hears about
  server skew from `tsc` instead of from a per-consumer discipline.

Runtime wording is unchanged: the one reader, the app shell's write-warning
toast, already answered an unrecognized reason with its cause-free line.
