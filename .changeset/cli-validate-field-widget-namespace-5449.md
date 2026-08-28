---
'@object-ui/types': patch
'@object-ui/cli': patch
---

`objectui validate` now refuses a form field whose widget id names a namespace
other than `field:`, matching the verdict `@object-ui/core`'s `validateSchema`
has given since objectui#5375 (objectui#5449).

The CLI reaches `FormFieldSchema` through `safeValidateSchema`, and that schema
declared `type` and `widget` as bare optional strings — so a field typed
`ui:password` validated clean while the runtime validator rejected the same
document with `UNRESOLVABLE_FIELD_WIDGET_NAMESPACE`. The CLI is the surface an
author actually runs before shipping, so it was the one handing out the false
green: an author did exactly the diligence objectui#5375 asks for and still
shipped metadata that renders a secret into a plain text box.

A `superRefine` on `FormFieldSchema` now states the rule, mirroring core's
precedence (`widget` before `type`), the key it blames, its error code and its
message verbatim, so the two entry points cannot describe one defect two ways.

**This rejects documents that previously validated.** Only colon-qualified
field widget ids outside the `field:` namespace are affected — `field:`-prefixed
ids and bare names such as `password` still pass, registered or not. A field
carrying, say, `type: 'ui:password'` must be rewritten as `password` or
`field:password`; it never rendered as a password box in any case.

Which of the repo's authoring-time validators is canonical remains open
(objectui#4631) — this states the rule on the zod side rather than unifying
them.
