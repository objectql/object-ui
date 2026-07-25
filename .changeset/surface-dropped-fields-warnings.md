---
"@object-ui/data-objectstack": minor
"@object-ui/app-shell": patch
---

feat(app-shell): toast when a save silently dropped read-only fields (framework #3431/#3455)

The framework now reports fields it LEGALLY stripped from a write (a non-system
caller can't seed a `readonly` field, a `readonlyWhen` predicate locked it, …)
via a `droppedFields` payload on the create/update response. Previously the
console discarded it: a value the user typed into a locked field just vanished on
save with a success toast and no explanation.

- **data-objectstack:** `ObjectStackAdapter` now emits a `WriteWarningEvent`
  after a create/update whose response carried `droppedFields`, exposed through a
  new `onWriteWarning(cb)` subscription (mirrors the existing `onMutation` bus).
  Reads the field structurally, so an older client or a backend that never drops
  is a no-op. New exported types: `WriteWarningEvent`, `WriteWarningListener`,
  `DroppedFieldsEvent`.
- **app-shell:** `AdapterProvider` subscribes and raises a `toast.warning`
  ("Some fields were not saved — the read-only field … could not be changed"),
  so the strip is visible instead of silent. The write itself still succeeded;
  status/behaviour are unchanged.
