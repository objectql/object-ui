---
'@object-ui/core': patch
'@object-ui/console': patch
---

Form actions no longer carry a record id across an object boundary (#4292).

`ActionRunner.executeForm` forwarded `/forms/:name?recordId=<id>` unconditionally,
and that URL says nothing about which object the id belongs to — so the form route
resolved it against the FormView's own target object. When an action fired from a
record of a DIFFERENT object and ids collide across objects (per-table integer
keys), the form silently prefilled and, since the route learned to honour the param,
`PATCH`ed a same-id record of the wrong object.

- **Producer**: the id is forwarded only when the firing context record's object
  (`context.objectName`) matches the target view's object; on a mismatch no id is
  forwarded, preserving create semantics. When it IS forwarded, the object travels
  with it as `?recordObject=`.
- **Consumer**: `/forms/:name` refuses — no record read, no write — when
  `recordObject` disagrees with the FormView's object. A URL without the param
  behaves exactly as before, so existing deep links are unaffected.
