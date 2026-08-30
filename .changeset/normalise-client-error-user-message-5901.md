---
'@object-ui/data-objectstack': patch
---

Preserve the producer's `userMessage` marking when `normaliseClientError` re-wraps a refusal.

`ApiErrorSchema.userMessage` (objectstack#9934) is the opt-in channel an application author
sets at throw time to say "this text is for the end user", and the contract states it
status-agnostic — any refusal status may carry it. Both of the shapes this adapter re-wraps
into typed errors dropped the marking: a hook that refused a write with `VALIDATION_FAILED`
or `CONCURRENT_UPDATE` and marked its own sentence had that sentence discarded at the
adapter boundary, before any surface could render it. Nothing threw and the typed error was
otherwise correct, so the only symptom was the user reading a generic string instead of the
sentence their administrator wrote.

The marking now rides both re-wraps, in the form the shared reader (`declaredUserMessage`)
already looks for: on the details bag for `DataApiValidationError`, exactly the way `fields`
already survives, and on a new readonly `userMessage` member for `ConcurrentUpdateError`,
which has no details bag. Unmarked refusals are untouched — they carry no key and still read
as `null`, so nothing a producer did not opt into can reach a user.
