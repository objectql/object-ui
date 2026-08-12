---
'@object-ui/fields': patch
---

fields: the currency adornment has one symbol channel

`CurrencyField` carried the same one-entry fact twice — a dead `CURRENCY_SYMBOLS`
map that nothing read, and a live `currency === 'USD' ? '$' : currency` ternary
two lines below it. Both were hand copies of knowledge `Intl` already carries,
and both are gone: a new `currencySymbol(currency, locale)` beside
`currencyFractionDigits()` reads the `currency` part of the very format the
widget's readonly branch already renders amounts with.

USD is unchanged at the display-locale default. Other currencies now show their
real symbol instead of the bare ISO code — `€` for EUR, `¥` for JPY, `£` for
GBP — which is what the same widget's readonly mode has always displayed; the
edit adornment simply stopped disagreeing with it. Currencies CLDR has no symbol
for (KWD, BHD, CHF, ISK, CLP) still render their code, exactly as before.
