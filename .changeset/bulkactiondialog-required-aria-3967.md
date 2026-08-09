---
"@object-ui/plugin-grid": patch
---

`BulkActionDialog` required params: the control now announces the required state, and the visual `*` stays out of its accessible name

`ParamField` renders each bulk param's label with a `*` marker when
`param.required`, inside a `<Label htmlFor>` that points at the control. Two
conventions the app-shell `ActionParamDialog` has carried since objectui#3299 /
objectui#3290 were missing at this site:

- The `*` span had no `aria-hidden="true"`. Accname folds a referencing label's
  text into the control's name, so every required bulk param announced as
  "Notify owner asterisk" — a decorative glyph read aloud as part of the label.
- No `aria-required` was passed to the widget. `param.required` is otherwise
  live — the dialog's own pre-submit gate reads it to keep Next disabled — but
  nothing carried the state to the control, and no widget derives it from
  `field.required` (`toDomProps` forwards `aria-*` by prefix; it invents
  nothing). So the only channel that could announce requiredness was empty
  while the only thing present was the glyph.

The required state now rides the state channel to the control, deliberately as
`aria-required` and not the native `required` attribute — per the objectui#3290
ruling, the native attribute would arm the browser's constraint-validation
bubble alongside this dialog's own gating, giving one field two validators.
`|| undefined` keeps an optional param free of the attribute entirely rather
than carrying `aria-required="false"`, matching `ActionParamDialog`.

The marker remains visible; only its participation in the accessible name
changes. `id` ownership at this site was already correct and is untouched, as
is `ActionParamDialog`.
