# @object-ui/plugin-dashboard — Skill notes

Server-driven dashboard renderer. Consumes `DashboardSchema` (from
`@objectstack/spec`) and renders a grid of widgets (metric, gauge, chart,
table, pivot, etc.) with drag/resize, drill-down, and async data binding.

> **Authoring shape (ADR-0021).** Dashboard widgets bind a semantic-layer
> `dataset` and select its `dimensions` + `values` by name — that is the only
> author-facing analytics shape. The pre-ADR-0021 inline query
> (`object` + `categoryField` + `valueField` + `aggregate`, pivot
> `rowField`/`columnField`) was removed at `@objectstack/spec` 9.0.0 and is a
> hard error under `DashboardWidgetSchema.strict()` (framework#3251). Examples
> below use the dataset shape.

## Period-over-period comparison (`compareTo`)

Any dataset-bound widget (metric / gauge / chart) can opt into a
period-over-period comparison by adding a `compareTo` field. The renderer
issues a second dataset query against the comparison-period filter and:

- For **metric** & **gauge** widgets, computes a delta percentage and surfaces
  it as a `trend` indicator (overrides any static `trend` prop).
- For **chart** widgets (line / area / bar / horizontal-bar / scatter / combo),
  overlays a muted second series (dashed line, lower fill opacity). Pie,
  donut, and funnel charts ignore `compareTo`.

### Accepted values

| Value | Meaning |
|---|---|
| `'previousPeriod'` | Substitute `current_*` / `today` date macro tokens with `last_*` / `yesterday` (e.g. `current_quarter_start` → `last_quarter_start`). Best when the filter uses date macros. |
| `'previousYear'` | Re-resolve macros against a `now` shifted back one calendar year. |
| `{ offset: '7d' \| '4w' \| '1M' \| '1y' }` | Re-resolve macros against `now` shifted by the given duration. Units: `d`, `w`, `M`, `y`. |

### Trend label i18n

The trend label key is sniffed from the filter so it surfaces automatically
without per-card configuration:

| Filter contains | Translation key |
|---|---|
| `{current_year_*}` / `{year_*}` | `dashboard.trend.vsLastYear` |
| `{current_quarter_*}` / `{quarter_*}` | `dashboard.trend.vsLastQuarter` |
| `{current_month_*}` / `{month_*}` | `dashboard.trend.vsLastMonth` |
| `{current_week_*}` / `{week_*}` | `dashboard.trend.vsLastWeek` |
| `{today}` | `dashboard.trend.vsYesterday` |
| anything else / `offset` | `dashboard.trend.vsPreviousPeriod` |

`previousYear` always uses `vsLastYear` regardless of the filter shape.

### Metric example

```json
{
  "id": "revenue",
  "type": "metric",
  "dataset": "order_metrics",
  "values": ["revenue"],
  "filter": {
    "created_at": {
      "$gte": "{current_quarter_start}",
      "$lte": "{current_quarter_end}"
    }
  },
  "compareTo": "previousPeriod"
}
```

Renders a KPI card showing this quarter's revenue with a `↑ 12.5% vs last quarter`
delta sourced from the same dataset query run against Q1 2026. (The `revenue`
measure — its aggregate, field, format, and currency — is declared once on the
`order_metrics` dataset, not inline on the widget.)

### Chart example (year-over-year line)

```json
{
  "id": "orders-trend",
  "type": "line",
  "dataset": "order_metrics",
  "dimensions": ["created_at"],
  "values": ["order_count"],
  "filter": {
    "created_at": {
      "$gte": "{current_year_start}",
      "$lte": "{current_year_end}"
    }
  },
  "compareTo": "previousYear"
}
```

Renders a line of monthly order counts for the current year with a dashed,
50%-opacity overlay of last year's counts on the same axis. Comparison-period
points are aligned to current-period buckets by groupBy value when possible,
otherwise by sorted index (the common case for time series).

### Sliding offset example

```json
{ "compareTo": { "offset": "7d" } }
```

Use when "this week vs last week" is more meaningful than "this calendar
week vs last calendar week".

### When NOT to use `compareTo`

- Filters that do not include any date macros — for `previousPeriod` /
  `previousYear` the comparison filter would be identical to the current
  filter, producing a meaningless 0% delta. Prefer `{ offset: '...' }` in
  this case, or omit `compareTo` entirely.
- Pie / donut / funnel charts — comparison overlays are not visually
  meaningful and are silently ignored.

## Related

- Date macros: `@object-ui/core` → `resolveDateMacros`
- Comparison utilities: `@object-ui/core` → `shiftFilterByCompareTo`,
  `compareToTrendLabelKey`, `CompareToConfig`
- Spec: `@objectstack/spec` → `DashboardWidgetSchema.compareTo`
