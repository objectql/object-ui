---
---

Internal only — no user-visible change, so no version bump (objectui#6765).

`CurrencyField` and `PercentField` hand `parseFloat(e.target.value)` to `onChange`
with no whole-string guard of their own, leaning entirely on the browser's
number-input value sanitization. The card that filed this measured that
**happy-dom, this package's test environment, does not implement that
sanitization**, and concluded that any test written for these two widgets
exercises a code path no browser takes. What it explicitly had NOT measured was
the real browser.

Measured now, on Chromium 141.0.7390.37 via Playwright, driving the real widgets
mounted in a real page through the routes a user actually has:

```
                    happy-dom                 real Chromium
typed  "12abc"      onChange(12)              onChange(12)
typed  "1.2.3"      onChange(1.2)             onChange(1.23)    <- DIFFERS
pasted "0x10"       onChange(0)               onChange(10)      <- DIFFERS
typed  "1e"         onChange(1)               onChange(null)    <- DIFFERS
el.value = "12abc"  .value stays "12abc"      .value becomes ""  <- DIFFERS
```

Two findings follow, and the first decides the card. **Residue never reaches
these widgets in a real browser** — keystrokes and pastes are filtered before the
change event fires, so the text is already a well-formed number (or empty) by the
time `handleChange` runs. Copying objectui#6715's anchored `WHOLE_NUMBER_TEXT`
guard here would therefore accept every string these boxes can produce and reject
only strings the test environment fabricates: a no-op in the product, and a pin
freezing a truncation no user reaches. It is deliberately not added, and the two
widgets now say so at the `parseFloat` sites, with the measurement quoted.

`NumberInputWidgets.environmentDivergence.test.tsx` pins the disagreement so it
cannot be re-derived by accident: happy-dom's missing sanitization, the fact that
it still reports `validity.badInput` (the one signal that agrees with the
browser), #6715's own regex read out of its source and shown to accept every
measured browser reading, and the per-widget oracle-vs-product table above.

The second finding is escalated, not fixed: typing `1e` leaves Chromium visibly
DISPLAYING `1e` while `.value` reads `''`, so the widget emits `null` with
`aria-invalid` still `false` and no diagnostic drawn — objectui#6716's silent-
refusal class, now reproduced rather than hypothesised. The same drop belongs to
every `type="number"` widget here (`NumberField`, `GeolocationField`), and the
truncating rows above cannot be refused by any widget-side guard at all, so the
route out is a decision about the widget class rather than a patch to two of it.
