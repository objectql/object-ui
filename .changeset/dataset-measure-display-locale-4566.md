---
'@object-ui/core': minor
'@object-ui/plugin-dashboard': patch
---

Dashboard dataset measures follow the display locale (objectui#4566).

`formatMeasure` and `formatDimensionValue` in `@object-ui/core` formatted every
value with a bare `undefined` locale tag at all three of their `Intl` sites.
`undefined` is not "the user's locale", it is the MACHINE's — neither of the
repo's two locale channels. A German session read a dashboard KPI as `1,234.5`
next to a grid cell rendering the same number as `1.234,5`, and inverted
separators read as a different number, not as an unstyled one.

Both functions take the display locale as a new OPTIONAL LAST parameter, and
`DatasetWidget` threads `useDisplayLocale()` into every site it formats through:
the KPI, the grouped table's measure and dimension cells, and the cross-tab's
header labels and cells.

**English output does not move**, and that is the discriminator against the
sibling fix. These sites already went through `Intl` with default grouping, so
the only thing that changes is WHOSE locale is used:

| | before | after |
|---|---|---|
| en, 1234.5 `0.0` | `1,234.5` | `1,234.5` (unchanged) |
| de, 1234.5 `0.0` | `1,234.5` | `1.234,5` |
| de, 1234.5 EUR | `€1,234.50` | `1.234,50 €` |
| de, 0.6083 `0.0%` | `60.8%` | `60,8%` |

Contrast objectui#4553, where `formatPercent` had never grouped at all and
moving en `1235%` → `1,235%` WAS the fix.

Omitting the new argument reproduces the previous output byte for byte, so
callers that do not thread a locale yet are unaffected.

Two behaviours are deliberately preserved rather than "improved" alongside the
locale fix, both measured:

- **Integers stay verbatim.** The integer branch renders no separator and no
  decimal mark, so a locale has nothing to change there — and routing it through
  `Intl` WOULD change it (a locale with its own numbering system re-digits it,
  and `1e21` expands to 22 digits).
- **The percent sign stays a literal suffix.** `Intl`'s `style: 'percent'`
  re-scales by 100, and that round trip loses precision at the top of the range
  (en `100,000,000,000,000,000,000,000%` becomes
  `99,999,999,999,999,990,000,000%`). The consequence — a German list cell
  writing `1.234,5 %` with a no-break space where a dashboard measure writes
  `1.234,5%` — is filed separately rather than smuggled in behind a locale fix.

`@object-ui/core` is `minor` because two of its ENTRY exports gained an optional
parameter (measured in the built `.d.ts`). `@object-ui/plugin-dashboard` is
`patch`: its published declarations are unchanged — `buildPivot`'s new optional
parameter is internal, as that function is not on the package's `exports`
surface.
