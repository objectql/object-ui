---
"@object-ui/plugin-form": minor
"@object-ui/types": minor
---

`mobile.fullscreenLongText` finally reaches auto-generated long-text fields, and
`mobile_fullscreen` gets one declared carrier (objectui#3245).

FROM: `ObjectForm` stamped the flag onto the FormField itself
(`{ ...f, mobile_fullscreen: true }`). TO: it stamps the flag onto the object the
form renderer will actually forward to the widget as `field` — `f.field || f`,
resolved exactly the way `renderFieldComponent` resolves it.

**The flag's only legal carrier is the field metadata, and its only producer is
`ObjectForm`.** That convention was already what the widget side assumed after
objectui#3232/#3233 (`TextAreaField` reads `field.mobile_fullscreen` and nothing
else, and `field` is the single metadata carrier); the producer was writing to a
different object, so for auto-generated fields the two never met.

What was broken, end to end: `ObjectForm` builds an auto-generated field as
`type: 'field:textarea'` **and** stashes the object-field metadata on `.field`.
The renderer forwards `field: field.field || field`, so the widget received the
raw metadata — which never carried the flag — while the FormField-level copy was
dropped by `stripRegisteredFieldProps`. Every entry point into `TextAreaField`
therefore read `undefined` and the expand affordance never rendered. Only the
hand-authored `customFields` path (no `.field` to shadow the FormField) ever
worked, i.e. the feature was dead on the path virtually every form takes. Unit
tests on both ends passed the whole time, because the break lived in the seam
between them; this release adds the feature's first integration coverage — real
`ObjectForm` → real form renderer → real `TextAreaField`, no mocks — which fails
against the old producer and passes against the new one.

`mobile_fullscreen` is now declared on `@object-ui/types`' `BaseFieldMetadata`,
hence on every member of the `FieldMetadata` union that
`FieldWidgetComponentProps.field` resolves to. It is deliberately **not** an
`@objectstack/spec` property: nobody authors it on a field definition, it is a
projection of the form-level `ObjectFormSchema.mobile.fullscreenLongText` setting
onto the field metadata at render time. Declaring it removes the last untyped
end of the chain — the producer's `as FormField` cast is gone — so the two sides
can now disagree out loud instead of silently.

The hand-authored `customFields` path keeps working unchanged, and keeps its own
metadata: the flag is stamped on the FormField only when there is no `.field` to
carry it. Synthesizing a `field` object in that case would light the affordance
up while quietly replacing the field's `rows` / `placeholder` with defaults — the
regression test pins that too.
