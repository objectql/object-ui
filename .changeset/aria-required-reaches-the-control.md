---
"@object-ui/components": patch
---

The required state now reaches the input control as `aria-required`, instead of
existing only as part of the control's accessible name (objectui#3290).

The form renderer has always computed a correct `required` — the static
`required` flag merged with the `requiredWhen` CEL verdict — and then spent it
on exactly one thing: the red asterisk in `<FormLabel>`. That asterisk carried
`aria-label="required"`, so the only path from the computed state to assistive
tech was `<label for>` folding it into the control's **accessible name**: the
field was announced as "Title required".

A state smuggled through a name is broken three ways:

- it is read in name order rather than announced as a state, and "list the
  required fields" style navigation cannot see it at all;
- a field rendered without a `label` (compact layouts, inline grid editing)
  draws no asterisk, so the signal disappears entirely;
- `requiredWhen` makes required **dynamic**, and a state channel can express
  the flip where a name cannot.

## What changed

- Every field control — built-in (`input` / `textarea` / `checkbox` / `switch` /
  `select`) and registered widget alike — now receives `aria-required="true"`
  when the field resolves required, and **no attribute at all** when it does
  not. Absence rather than `aria-required="false"` is deliberate: it is what
  the `requiredWhen`-turns-false case has to produce.
- The red asterisk is now `aria-hidden="true"` and no longer carries
  `aria-label="required"`. It renders exactly as before for sighted users; it
  simply stops being announced, so the state is reported once (as a state) and
  not twice.

**No field widget needed a change.** `aria-required` is already declared and
typed on the widget props contract (`FieldWidgetComponentProps &
AriaAttributes`) and every widget forwards its leftover props to the control it
renders, so all 48 widgets pick it up unmodified.

Two non-changes, both deliberate:

- **No native `required` attribute.** That would arm the browser's own
  constraint-validation bubble alongside react-hook-form's `<FormMessage/>` —
  two validators, two UIs, one field. `aria-required` reports the state without
  triggering native validation.
- **No `required` boolean in the widget props contract.** A boolean would give
  the required marker a second author, and the next widget draws its own
  asterisk next to the renderer's — the double-display failure objectui#3222
  already declined for the validation message.

If you select the asterisk in a test, it is now
`span[data-required-marker]` — an explicit locator, rather than an
accessibility attribute doubling as a test hook.
