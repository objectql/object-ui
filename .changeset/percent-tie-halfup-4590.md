---
'@object-ui/fields': minor
---

fix(fields): `formatPercent` renders percentage points directly — ties round half-up and extremes keep every digit

`formatPercent` rendered a value that is already in percentage POINTS through
`Intl`'s `style: 'percent'`, which expects a FRACTION, so the body divided by
100 for `Intl` to multiply straight back. That round trip is not
value-preserving: `Intl` formats from the shortest decimal representation of the
double it is handed, and the quotient's is not the authored one. A stored
`1.005` at 2 decimals rendered `1.00%` where half-up on the authored decimal is
`1.01%`; `1.45` at 1 decimal rendered `1.4%` for `1.5%`. Every case was a
last-digit off-by-one — the failure mode least likely to be noticed and most
likely to be trusted.

The body now renders through `style: 'percentPoints'` with no scaling round
trip. Measured on this repo's runner (node v22.22.2 / ICU 78.2), 27,577 of
1,200,003 ordinary en-US forms move (0.005-step grid to 2,000, precisions
0/1/2), and the same artefact at the top of the double range is gone too:
`Number.MAX_SAFE_INTEGER` percentage points rendered `9,007,199,254,740,990%`
and now render `9,007,199,254,740,991%`.

The locale percent CONVENTION is unchanged — this is a numeral move only.
`'percentPoints'` is `Intl`'s `style: 'unit'` / `unit: 'percent'`, re-measured on
this call shape across 720 combinations (10 locales x 18 values x 4 precisions):
0 convention differences, 130 numeral differences. The no-break space in
de/fr/ru/sv, Turkish's prefixed sign, Arabic's own percent sign and Bengali's
digits all render exactly as before. Percent SCALING (a stored fraction below 1
scaling by 100) is upstream of the render and untouched.

A percentage point now reads identically in a list cell and in a dashboard
measure, which `formatMeasure` already rendered this way.
