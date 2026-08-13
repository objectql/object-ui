---
'@object-ui/plugin-gantt': patch
---

Gantt tooltip numbers and currency follow the display locale (objectui#4553).

`formatFieldValue`, the tooltip value formatter inside ObjectGantt's `tasks`
memo, had its four TEMPORAL call sites threaded with `useDisplayLocale()` by
objectui#4272. The numeric cases beside them passed no locale, so they reached
`new Intl.NumberFormat(undefined, …)` — the MACHINE's locale, which is neither
of the repo's two locale channels.

One tooltip therefore rendered two conventions. A German session read
`5. Jan. 2024` on the date row and `1,234.50` on the amount row directly below
it, where German groups with `.` and marks the decimal with `,`. Inverted
separators do not read as an unstyled number; they read as a different number.
The currency row was affected in the symbol's POSITION too — `1.234,50 EUR`
rather than `EUR1,234.50` — while the currency CODE itself was already resolved
correctly (objectui#4542 made the memo watch it); only the locale rendering that
code was missing.

`number` / `integer` / `float` / `decimal` and `currency` now pass the
`displayLocale` already read at component level, using each formatter's existing
locale parameter. No formatter signature changed and no memo dependency changed
(`displayLocale` has been in that array since objectui#4272), so this is
consumer-side threading only: the package's `.d.ts` files are byte-identical and
English output is unchanged at every touched site.

Known gap, tracked on objectui#4553: the `percent` row still does not follow the
display locale. `formatPercent(value, precision)` takes no locale parameter —
it is `${percentDisplayValue(value).toFixed(precision)}%`, so it builds no
`Intl.NumberFormat` at all and renders in NO locale rather than the machine's
(ASCII decimal mark, never grouped, identical on every machine). Closing that
needs a `@object-ui/fields` signature change, which is outside this change's
ruled surface, and is pinned by a test here so the gap cannot drift unnoticed.
