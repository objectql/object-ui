---
'@object-ui/fields': patch
---

An empty array no longer makes a cell renderer fabricate a value (objectui#8490).

objectui#8481 fixed the shared read renderers whose output for `[]` was *blank*. These
are the other half of that census: the renderers whose output for `[]` was not blank
but **wrong** — a value the record does not hold. Measured by rendering on `e411c3e58`:

| field types | renderer | rendered for `[]` before |
|---|---|---|
| `boolean`, `toggle` | `BooleanCellRenderer` | a **checked**, disabled checkbox (`aria-checked` true); a completion field drew the green "Completed" indicator |
| `number`, `slider`, `rating` | `NumberCellRenderer` | the digit `0` |
| `currency` | `CurrencyCellRenderer` | the digit `0` |
| `percent`, `progress` | `PercentCellRenderer` | a 0% progress bar with `aria-valuenow` of 0 |
| `email` | `EmailCellRenderer` | a live anchor whose `href` was `mailto:` with no address, plus a copy button |
| `url` | `UrlCellRenderer` | a live `_blank` anchor with an empty `href` |
| `phone` | `PhoneCellRenderer` | a live anchor whose `href` was `tel:` with no number |
| `color` | `ColorSwatchCellRenderer` | a bordered swatch box with no colour and an empty hex span |
| `date` | `DateCellRenderer` | a hand-rolled em-dash with no accessible name (not the shared placeholder) |

All of them now render the shared `EmptyValue` affordance — the muted em-dash with a
`No value` accessible name — exactly as they already did for `null`.

**The ruling is per renderer, not one predicate.** A boolean cell is not a text cell:
`[]` holds no boolean, so the column holds *no value*, not `false` — a real `false` is
still an unchecked box, and only `[]` moves (scalar truthiness coercions are untouched).
The number family's `0` was `Number('')`, a coercion artefact rather than a stored zero,
so its guard is now on the coerced *text* — which **deliberately also sweeps a stored
`''`** (the same fabrication one input shape over); a real stored `0` still prints. The
link family draws no anchor when there is nothing to link to; `color` draws no swatch
without a colour string; `date` reaches the shared affordance instead of `formatDate`'s
private dash.

**Deliberately narrow.** `{}` is untouched everywhere, `json` still draws the array
literal and `file` still states `0 files` (the objectui#8481 fence), and whether a
non-boolean *scalar* in a boolean column should surface as a coercion error is a separate
question this change does not answer.
