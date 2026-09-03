---
'@object-ui/core': patch
'@object-ui/fields': patch
---

Render a dataset measure over a date field as a date (objectui#7178, maintainer
ruling 2026-09-02, director summon #8 — option A).

`formatMeasure` opened with `if (typeof v !== 'number') return String(v)`,
placed **before** `format` was ever read. So a `min` / `max` measure over a date
or datetime field printed its stored value verbatim — a 24-character ISO string
in the KPI tile's `text-2xl font-semibold`, wrapping to two lines — and the
`format` that `DatasetMeasureSchema` accepts was unreachable for those values.
A date-shaped value now routes to the date display path before that
short-circuit, so all four dataset-bound surfaces are served at once: the metric
tile, chart values, dataset table cells, and the metadata-admin dataset preview.

`min` / `max` over a date stays a legal measure; nothing in `@objectstack/spec`
narrows. `PivotTable` takes a `number` outright and is unchanged.

**No second date formatter was written.** `formatDate`, `formatDateTime`,
`formatRelativeDate` and `DateDisplayOptions` MOVED from `@object-ui/fields`'
barrel down into `@object-ui/core` (`utils/date-display.ts`), which is the same
remedy objectui#4576 applied to `formatDisplayNumber` and for the same reason:
`core` is the React-free engine and could not import from a React package, so
the alternative was a parallel date convention in `dataset-format.ts` — exactly
the drift that once had a list cell rendering `1.234,5 %` beside a dashboard
measure's `1.234,5%`. `@object-ui/fields` re-exports all four names unchanged,
so no consumer's import path or behaviour changes, and a reference-identity test
pins that the cell renderer and the measure formatter call the same function.

**What `format` can say for a date measure, measured rather than assumed.** The
shared date path takes a named STYLE, not a date pattern: `'short'` and
`'relative'` are honoured — the same words `DateCellRenderer` honours from
`field.format` — while a pattern such as `'YYYY-MM-DD'` renders the locale
default. That limit is unchanged by this release (`plugin-dashboard`'s
`recordFields` already routed a date-shaped `format` into the same style slot)
and is now pinned by a test instead of being silent.

**Numeric measures are byte-identical.** 33,696 argument forms
(value × format × currency × percentScale × locale) were compared against a
verbatim copy of the pre-fix function: the only values that moved were the four
ISO-shaped, parseable ones. Numbers, numeric strings (`'1751612400000'`,
`'2026'`), the nullish em dash, arbitrary prose and non-strings all render
exactly as before.
