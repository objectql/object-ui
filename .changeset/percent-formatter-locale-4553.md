---
'@object-ui/fields': minor
'@object-ui/plugin-dashboard': minor
'@object-ui/plugin-gantt': patch
'@object-ui/plugin-grid': patch
---

`formatPercent` groups its output and follows the display locale — the last
tooltip/cell channel (objectui#4553).

PR #4557 threaded the gantt tooltip's number and currency rows and measured that
the percent row could not follow: `formatPercent(value, precision)` took no
locale parameter, and its whole body was
`${percentDisplayValue(value).toFixed(precision)}%`. It built no
`Intl.NumberFormat` and never reached `formatDisplayNumber` — so unlike its
siblings it did not render in the MACHINE's locale, it rendered in **no** locale:
an ASCII decimal mark, never a grouping separator, byte-identical on every
machine.

**English output MOVES, and that is the fix.** Because the function never
grouped, `1235%` was wrong in en-US too, not only in German. Grouping and locale
therefore land together:

| | before | after |
|---|---|---|
| en, 1234.5 | `1235%` | `1,235%` |
| de, 1234.5 | `1235%` | `1.235\u00a0%` |
| de, 80 | `80%` | `80\u00a0%` |

Values below the grouping threshold are unchanged in English (`80%`, `12.5%`,
`33.33%`), so the move is confined to four digits and up. German changes at every
magnitude, because the no-break space before the sign is part of the locale's
percent convention — which is what routing through `Intl` buys over appending a
literal `%`.

The scaling contract is untouched: `percentDisplayValue` still disambiguates a
fraction-stored percent (`0.8` → 80%) from a whole one, so the list cell and the
dashboard measure formatter still agree.

Consumers are threaded in the same change, the parameter never landing
speculatively:

- **fields** — `PercentCellRenderer`, on BOTH of its paths. Its whole-percent
  branch (`progress` / `completion` fields, which store 0-100 and must skip the
  fraction scaling) was a second bare `toFixed` call; leaving it behind would
  have made one grid internally inconsistent, so both branches now share one
  locale-aware body and differ only in the scaling policy.
- **plugin-gantt** — the tooltip percent row, completing objectui#4553's switch.
- **plugin-grid** — the mobile card's percent cell, which sits in the same
  density row as a date cell objectui#4272 had already localized.
- **plugin-dashboard** — `renderFieldValue`'s percent branch. It is a plain
  function rather than a component, so it takes the locale as an optional fourth
  parameter beside the `tenantCurrency` already threaded that way, and both of
  its callers pass it and declare it in their memo dependency arrays.

Bumps follow each package's own `.d.ts` diff, measured in both directions.
`@object-ui/fields` and `@object-ui/plugin-dashboard` are `minor` on the
objectui#4272 / PR #4544 precedent — quoted from that changeset: "`@object-ui/fields`
is `minor` because `formatDateTime`'s new optional parameter is visible in the
package's entry `.d.ts`; the plugin packages' own `.d.ts` files are
byte-identical, so their change is module-local." Here `formatPercent` and
`renderFieldValue` each gain an entry-visible optional parameter, while
plugin-gantt's and plugin-grid's `.d.ts` files are byte-identical and stay
`patch`.
