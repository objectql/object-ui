---
---

Test-only change: the `type="number"` field widgets (`CurrencyField`, `PercentField`,
`NumberField`, `GeolocationField`) gain a suite that drives them with the keystroke
sequences a real Chromium was measured to deliver, and asserts what each one emits.
No published behaviour changes — the widgets are untouched.
