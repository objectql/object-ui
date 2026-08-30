---
'@object-ui/fields': patch
---

`LocationField` no longer emits a coordinate pair the platform's own validator
refuses (objectui#6714).

`@objectstack/spec`'s `LocationValueSchema` constrains the coordinate **range**
(`lat` −90..90, `lng` −180..180), but the widget's guard tested only that each
coordinate was a finite number. Typing `999, 999` therefore emitted
`{ lat: 999, lng: 999 }` — a value `valueSchemaFor({ type: 'location' })`
rejects with `too_big` at both keys. That is the producer direction of the
contract-first failure class (AGENTS.md #0.1): a renderer writing what the
contract rejects. It was open to every user who edits a location field, since
typing the coordinates is this field's only interaction.

**Measured before choosing the disposition**, as triage required: nothing
downstream rejects or repairs the value. Driving a real `ObjectForm` with a
`type: 'location'` field and typing `999, 999` called `dataSource.create` once
with `place: { lat: 999, lng: 999 }` verbatim, `aria-invalid="false"` on the
control and no error text anywhere. `sanitizeFormData` filters keys and never
inspects a value, and `buildValidationRules` has no `location` branch. So the
out-of-range pair reached storage silently, and the widget is the only place a
refusal can work.

The fix therefore **refuses the emission**, extending the rule this widget
already applies to text that isn't a coordinate pair from *format* to *range*:
the typed pair is simply not written and the prior value stands. No new UI and
no new mechanism — the same `// If invalid, don't update the value` branch.

The bounds are **not** restated in the widget. A hand-copied `-90..90` would be
a second contract free to drift from the spec, so the emission is put to
`LocationValueSchema` itself. Two consequences of asking the schema rather than
testing two bounds by hand: the check covers the WHOLE emitted object, so the
`altitude`/`accuracy` carried across an edit (objectui#6664) are held to the
contract too; and `Infinity` is refused as well, which the finiteness gate let
through (`parseFloat('Infinity')` is `Infinity`, and `!isNaN(Infinity)` is
`true`).

Reading is deliberately unchanged: a record that already holds an out-of-range
pair still renders in the box, so the person who can correct it can still see
it. objectui#6272's empty render was for a value whose *shape* this widget
cannot read; this shape is readable, it is only not writable.
