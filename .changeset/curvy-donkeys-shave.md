---
'@object-ui/fields': patch
---

fix(fields): `formatCurrency` keeps both cents digits on a fractional amount

The symbol branch passed `minimumFractionDigits: 0` against a
wholeness-switched `maximumFractionDigits`, which handed `Intl` the range
`[0, 2]` — and `Intl` emits the shortest representation in range, so a real
cents value of `.50` was printed as `.5`. Any price ending in a zero cent digit
rendered one digit short: `$1,234.50` as `$1,234.5`, `$19.90` as `$19.9`,
`$0.50` as `$0.5` — money on a record page and in grid cells reading as a data
error rather than a formatting one.

Both bounds now take the same wholeness-switched width, so the function
delivers the contract its own doc comment states: a fractional amount shows
exactly two digits, a whole amount still drops `.00` (`$1,234`). The
no-currency branch and the bad-currency fallback already behaved this way; only
the symbol branch disagreed.

Reaches every consumer of the shared helper: `CurrencyCellRenderer`,
`ObjectGrid`, the dashboard `recordFields` and `ObjectGantt`.
