---
'@object-ui/components': minor
'@object-ui/core': minor
---

Three more secret-field spellings no longer render a secret in clear text on the form's unregistered-widget branch.

Measured on `main` at `f2e11ae6f`, the real `form` renderer on the built-in path
(no `registerAllFields()`), before and after objectui#5322's fix:

```
type            registry hit   rendered type
ui:password     true           text
secret          false          text
field:secret    false          text
```

Two halves, per the maintainer ruling of 2026-08-20:

- **`@object-ui/core` — an unresolvable namespaced widget id is now an authoring
  ERROR.** A form field's widget id (`widget`, else `type`) may name the
  `field:` namespace or a bare name; any other namespace resolves no field
  widget (objectui#5254) and used to degrade silently to a plain text box.
  `validateSchema` now reports `UNRESOLVABLE_FIELD_WIDGET_NAMESPACE` and
  `assertValidSchema` throws. Behaviour change: a schema that previously
  validated with e.g. `type: 'ui:password'` is now invalid — inventing a
  plausible-looking widget id fails loudly instead of rendering clear text.
  `field:` ids stay valid whether or not the widget is registered, since
  registration is a runtime fact an authoring-time validator cannot see.
- **`@object-ui/components` — the known secret types cover the remaining
  spellings.** Bare `secret` and `ui:password` render the native masked input,
  and `field:secret` is refused outright like `field:password`. Existing authors
  need no migration.

`ui:password` **is** registered — as an SDUI node renderer for a top-level
`{ type: 'email' }`-style node — so an author who checked whether it resolved
got a yes and still got a clear-text box on the field path. No producer emits
any of the three; all are reachable only through a hand-authored standalone
form schema, which is exactly the surface where the author is the producer and
no normalizer sits in between.
