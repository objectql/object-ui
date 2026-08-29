---
'@object-ui/react': minor
---

`useSchemaPersistence` refuses to save a schema carrying function-valued keys
(objectui#6658).

The designer save door handed the schema straight to `JSON.stringify`, which
does not preserve a function value and says nothing about it: an object key is
**dropped**, an array element is **coerced to `null`**. No throw, no warning.
`save()`
resolved with the id, `error` stayed null and `lastSavedAt` advanced, so every
observable signal reported success while the stored schema had quietly lost the
handler. The failure ordering was the bad one: loss at save, symptom at render
or click, arbitrarily later, in a different component, with no link back.

Per the 2026-08-29 maintainer ruling on objectui#6658, the door now refuses such
a save instead of performing a lossy one:

- `save()` walks the schema for function-valued keys **anywhere** in it —
  nested objects and array elements included — before serialization.
- On a hit it sets `error`, returns `null`, leaves `lastSavedAt` and `isDirty`
  untouched, and never reaches the adapter. The message names the exact
  offending key paths (`columns[2].cell`, `toolbar.actions.onExport`) and both
  escapes: strip the callables before saving, or use the declarative form.
- The guard sits at the **hook layer**, not inside the default localStorage
  adapter, so a host-injected or REST adapter is covered too — the documented
  REST adapter has the identical `JSON.stringify` shape, so a host following
  the docs inherited the behaviour rather than escaping it.

True lowering (objectstack's server-side `lowerCallables`) is recorded as
unavailable at a browser door: functions cannot round-trip storage without a
code registry, so refusal is the honest shape.

Behaviour change for hosts that previously saved callable-bearing schemas —
those saves were already losing the callables and now fail loudly instead.
Fully declarative schemas are unaffected and store byte-identically to before.
No published type or signature changed.
