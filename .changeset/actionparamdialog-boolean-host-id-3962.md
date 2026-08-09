---
"@object-ui/app-shell": patch
---

`ActionParamDialog` boolean params: the dialog now owns the control id, so the checkbox is named once instead of twice

The boolean branch rendered `<Label htmlFor={param.name}>` beside the control but
passed the widget no `id`, unlike its own generic branch a few dozen lines below,
which has always passed `id={param.name}`. Measured on a real dialog render, a
`boolean` param labelled "Confirm This" produced TWO label elements pointing at
one control — the dialog's visible one and a `sr-only` copy the widget emitted —
so the checkbox's accessible name was the two concatenated: screen readers
announced "Confirm This Confirm This".

Two distinct problems, one line apart:

- The association was IMPLICIT. It resolved only because `BooleanField`'s id
  fallback chain reaches `config.name`, which `paramToField` seeds from
  `param.name`, so both sides landed on the same string by coincidence of
  another package's internals. A host that renders `htmlFor` must emit the id it
  names; that is what the declared `id` key of the widget contract is for.
- The duplicate `sr-only` label. objectui#3952 / PR #3959 made `BooleanField`
  suppress its own label whenever a host supplies the id — precisely because a
  host that supplies an id is a host that renders a label. Receiving no id, this
  branch never triggered that suppression.

Both `for` targets resolved, so unlike objectui#3341 and objectui#3952 this was
never a dangling label: clicking the row's text already toggled the control, and
still does. What changes is the announced name, which is now the single
"Confirm This" the author declared. The generic branch is untouched.
