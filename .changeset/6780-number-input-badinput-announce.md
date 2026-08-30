---
"@object-ui/fields": minor
---

A `type="number"` field no longer displays one value and stores another in
silence (objectui#6780).

`NumberField`, `CurrencyField`, `PercentField` and `GeolocationField` now
announce when the browser reports `validity.badInput` — it is holding text it
cannot read. The control is marked `aria-invalid="true"` and draws
`Not saved: the text in this box is not a number. Enter a plain decimal
(example: …).`, reusing the refusal shape objectui#6716 introduced for
`LocationField`.

Measured in Chromium 141.0.7390.37 (Playwright 1.62.1), typing `1e` into an
empty number box leaves it **visibly displaying `1e`** while `.value` reads the
empty string. Before this change the widget emitted `null`, `aria-invalid`
stayed `"false"`, and nothing was said — on a money field. Nine keyboard
reachable states behave that way (`1e`, `1e-`, `1e+`, `5e`, `-`, `.`, `+`, `-.`,
`e`), and none of the six values a real browser actually emits trips the guard.

Both a change arm and a **blur** arm are wired. Pasting `1e` into an empty box
never moves `.value` off `''`, so React's input-value tracking suppresses the
change event entirely and blur is the only arm that sees it. `PercentField`,
`NumberField` and `GeolocationField` had no `onBlur` before; the new one
composes any handler a host supplied rather than replacing it.

The guard ANNOUNCES; it deliberately does not refuse. Refusing would leave the
React `value` prop unchanged, and React's `updateInput` writes it back over the
raw text — wiping the very entry the message points at.

⚠️ **Filtering truncation stays silent, and cannot be made otherwise.** Pasting
`1.2.3` into a currency field stores `1.23`; `0x10` stores `10`. The browser
discards those characters as they arrive, before any widget code runs, so no
widget-side guard can refuse them — only abandoning `type="number"` could, which
would reverse objectui#2572's deliberate `min`/`max`/`step` and mobile numeric
keyboard affordances. This asymmetry is documented for users in
`content/docs/guide/fields.md` and on the currency, percent and number field
pages, because a control that warns about `1e` while silently truncating `1.2.3`
teaches people that no warning means the value is right.
