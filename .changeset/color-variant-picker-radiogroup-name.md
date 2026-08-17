---
'@object-ui/app-shell': patch
---

The designer's colour swatch rows now announce WHAT they colour, and the Dashboard widget inspector's "Color Variant" label no longer points at nothing.

`ColorVariantPicker` renders its swatches inside a `div role="radiogroup"`. Each
swatch was named by its colour ("Blue", "Success"); the group was named by
nothing at all, so focus entering it announced an anonymous radiogroup — eight
colours with no statement of which field they set — while the visible label
beside it belonged to no one.

`DashboardWidgetInspector` had the worse half of it. Its `Field` wrapper renders
`Label htmlFor={id}` and expects the wrapped control to carry that id; the picker
accepted no id, so `htmlFor="widget-color"` was a DANGLING IDREF — an association
tooling reports as closed while it resolves to no element, which is why a static
"every label has a `for`" check saw nothing wrong (objectui#4010).

A `for` cannot fix this: `role="radiogroup"` is a container, not a labelable
element, so a `for` aimed at it is inert HTML that names nobody. The picker now
takes its name through ARIA, required at the type level and singular — exactly
one of `ariaLabelledBy` or `ariaLabel`, so an unnamed colour group no longer
compiles (the contract `InspectorComboField` got in objectui#3997):

- **Dashboard widget inspector** — the "Color Variant" label publishes
  `widget-color-label` and drops its `for`; the group answers by IDREF. The
  visible text IS the accessible name, in every locale, with no second string to
  translate.
- **Page block properties panel** — the "Color" label never carried a `for`, so
  nothing dangled there; the group was simply anonymous. Same repair, with the
  id minted per instance so two colour rows cannot collide.
- **Generic `color-picker` widget** — its host writes `Label htmlFor` before it
  can know whether this field renders a swatch group or a labelable
  `input type="color"`, so the group carries its own name, taken from the host's
  own label source.

This is the WAI-ARIA group pattern this repo already applies to group-labelled
field widgets (objectui#3961 → #3990), applied to the three surfaces that were
still outside it.
