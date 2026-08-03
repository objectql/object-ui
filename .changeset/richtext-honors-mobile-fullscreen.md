---
"@object-ui/fields": minor
"@object-ui/plugin-form": minor
---

`RichTextField` honours `mobile_fullscreen`, so `mobile.fullscreenLongText` is
finally true of rich text too (objectui#3301).

`ObjectFormSchema.mobile.fullscreenLongText` has always been documented as
"textarea/rich-text get an expand button", and `ObjectForm` has always stamped
`mobile_fullscreen` onto `field:markdown` / `field:html` fields to deliver it.
Both of those types resolve to `RichTextField`, and that widget never read the
flag: a producer with no consumer. Turning the setting on gave a phone user an
expand affordance on their textareas and nothing at all on their markdown or
HTML fields, with nothing anywhere reporting that half the feature was inert.

FROM: `RichTextField` ignored the flag entirely (`grep fullscreen` over that
file returned nothing). TO: it reads `field.mobile_fullscreen` — the same single
metadata carrier `TextAreaField` reads, and nowhere else — and renders the same
expand affordance and full-height editing dialog.

**The affordance now has one implementation, not two.** One form-level setting
should produce one behaviour, so the expand button, the dialog and the
draft/commit semantics moved into a shared `FullscreenFieldEditor` that both
widgets render; only the EDITOR is per-widget. A second hand-written copy of
that state machine would be the same defect this release fixes, with an extra
step — it drifts, and nothing reports the drift. The rich-text dialog hosts the
widget's real editing surface (same format indicator, same editor), not a bare
textarea, so whatever that editor grows into, both positions get it at once.

Behaviour is identical across the two widgets and unchanged for
`TextAreaField`: the dialog seeds its draft from the committed value at open
time, keeps typing local (a react-hook-form field is not marked dirty by an
edit the user may still cancel), commits once on "Done", and discards on
"Cancel". Test ids follow the existing convention per widget —
`richtext-fullscreen-toggle` / `-dialog` / `-input` / `-save` alongside the
`textarea-*` ones, since a single form can contain both.

There is deliberately no prop spelling of the flag and no `??` fallback chain in
either widget. The field metadata is the one carrier (objectui#3233), so a
misspelled or misplaced flag stays inert and visible rather than being quietly
caught by a tolerant consumer.

Also removes a dead type from the producer: `ObjectForm` stamped the flag on
`'string-multiline'`, a string that `grep -rn` finds exactly once across both
this repo and `objectstack` — that line itself. No producer emitted it, no
registry key matched it, no widget read it. The remaining four stamped types
(`textarea`, `field:textarea`, `field:markdown`, `field:html`) each have a real
reader.
