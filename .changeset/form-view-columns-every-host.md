---
"@object-ui/plugin-form": patch
---

fix(form): a tabbed/split form honours the form view's own `columns`

`FormView.columns` is a spec key, but only `ObjectForm`'s simple path and
`ModalForm` read it. `TabbedForm` and `SplitForm` derived the grid width from the
per-section `columns` alone, so a view declaring `columns: 3` rendered 3 columns
in a modal and **single-column** as a tab or split — the same metadata laying out
differently depending on which host picked it up.

Both now resolve the grid the way the other hosts already did:

    explicit form `columns`  ??  widest section's `columns`  ??  1

The two keys answer different questions and the precedence reflects that: the
view's `columns` is how wide the grid is, a section's `columns` is how densely
that section fills it (via per-field `colSpan`). `columns` is declared on
`TabbedFormSchema` / `SplitFormSchema` accordingly — `ObjectForm` already spread
it through, it was simply being dropped on arrival.
