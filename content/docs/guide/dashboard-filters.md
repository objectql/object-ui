---
title: "Dashboard-Level Filters"
---

A dashboard often needs one top-level filter — a date range, a region select —
that drives **several charts at once**. ObjectUI models this as a
**dashboard-level parameter**, not a shared dataset:

- The **filter control and its value live on the dashboard** — hosted as
  dashboard-level variables (the page/dashboard variables primitive).
- Each widget declares which of **its own** fields a filter binds to via
  `filterBindings` — a small mapping, not a copied query.
- At render time the dashboard **broadcasts** the active values into every
  bound widget's inline query, `AND`-combined with the widget's own `filter`.

Charts stay inline and self-contained; one place owns the filter; each chart
edit stays local.

> Working examples: the schema catalog ships a `plugin-dashboard/filtered-dashboard`
> example plus variants for dynamic options, text/number/lookup filter types,
> dataset widgets, the `targetWidgets` allow-list, and date presets with a
> custom range.

## Tutorial: from zero to a filtered dashboard

### Step 1 — a plain dashboard

Start from two charts over **different** objects. Without filters they always
show everything:

```json
{
  "type": "dashboard",
  "columns": 2,
  "widgets": [
    {
      "id": "invoices_by_status",
      "title": "Invoices by Status",
      "type": "bar",
      "object": "invoices",
      "categoryField": "status",
      "aggregate": "count"
    },
    {
      "id": "accounts_signed",
      "title": "Accounts Signed",
      "type": "line",
      "object": "accounts",
      "categoryField": "signed_at",
      "categoryGranularity": "month",
      "aggregate": "count"
    }
  ]
}
```

### Step 2 — add the built-in date range

Declare `dateRange` at the dashboard level. A preset/custom date-range control
appears in the filter bar above the widgets:

```json
{
  "dateRange": {
    "field": "created_at",
    "defaultRange": "last_30_days",
    "allowCustomRange": true
  }
}
```

- `field` — the **default** field the range applies to on every bound widget
  (falls back to `created_at` when omitted).
- `defaultRange` — the initially selected preset: `today`, `yesterday`,
  `this_week`, `last_week`, `this_month`, `last_month`, `this_quarter`,
  `last_quarter`, `this_year`, `last_year`, `last_7_days`, `last_30_days`,
  `last_90_days`, or `custom` (starts empty and lets the user pick).
- `allowCustomRange` — offer a "Custom…" item that opens a from/to calendar
  (default `true`).

Presets stay **symbolic** until query time: they compile to date-macro tokens
(`{30_days_ago}`, `{current_month_start}`, …) that each widget resolves
exactly like hand-authored widget filters — so a dashboard saved today still
means "last 30 days" tomorrow.

### Step 3 — add a global filter

Add a `globalFilters` entry. Each entry renders one control in the filter bar:

```json
{
  "globalFilters": [
    {
      "name": "region",
      "field": "region",
      "label": "Region",
      "type": "select",
      "options": ["EMEA", "APAC", "AMER"]
    }
  ]
}
```

- `name` — the **stable filter name**: the variable key the value is published
  under, and the key widgets reference in `filterBindings`. Defaults to
  `field`. (`"dateRange"` is reserved for the built-in date range.)
- `field` — the default field the filter applies to on bound widgets.
- `type` — the control type: `text`, `number`, `select`, `lookup`, or `date`.

| Type | Control | Generated condition |
| --- | --- | --- |
| `text` | input | `{ field: { "$contains": value } }` |
| `number` | numeric input | `{ field: value }` (equality) |
| `select` / `lookup` | dropdown | `{ field: value }` (or `$in` for arrays) |
| `date` | preset/custom range | `{ field: { "$gte": from, "$lte": to } }` |

Options can be static (`options`) or fetched from an object at runtime:

```json
{
  "name": "industry",
  "field": "industry",
  "label": "Industry",
  "type": "select",
  "optionsFrom": {
    "object": "accounts",
    "valueField": "industry",
    "labelField": "industry"
  }
}
```

`optionsFrom` fetches records through the dashboard's data source and
de-duplicates values client-side (top 200 records; server-side distinct is a
planned enhancement).

### Step 4 — bind each widget's own fields

By default every filter applies to its own `field` on every widget. When a
widget stores the concept under a different field — or should ignore a filter
— declare `filterBindings` on the widget:

```json
{
  "widgets": [
    {
      "id": "invoices_by_status",
      "type": "bar",
      "object": "invoices",
      "categoryField": "status",
      "aggregate": "count"
    },
    {
      "id": "accounts_signed",
      "type": "line",
      "object": "accounts",
      "categoryField": "signed_at",
      "categoryGranularity": "month",
      "aggregate": "count",
      "filterBindings": { "dateRange": "signed_at", "region": "sales_region" }
    },
    {
      "id": "total_invoices",
      "title": "Total Invoices (all regions)",
      "type": "metric",
      "object": "invoices",
      "aggregate": "count",
      "filterBindings": { "region": false }
    }
  ]
}
```

Binding rules, in precedence order:

1. `filterBindings[name]` as a **string** — apply the filter to that field.
2. `filterBindings[name]: false` — opt this widget out of that filter.
3. Legacy `targetWidgets` on the filter — when set, only listed widget ids get
   the default binding (an explicit `filterBindings` entry still wins).
4. Otherwise the filter applies to its own `field` (the built-in date range
   defaults to `dateRange.field ?? 'created_at'`).

That's the whole feature: changing any filter live re-scopes every bound
widget, each against **its own** field.

## Reading filter values in expressions

Filter values are hosted as dashboard variables, so any widget expression can
read them under the `page.` scope, keyed by the filter's `name`:

```json
{
  "type": "text",
  "value": "Region: ${page.region || 'All'}"
}
```

```json
{
  "id": "emea_playbook",
  "component": {
    "type": "card",
    "title": "EMEA Playbook",
    "hidden": "${page.region !== 'EMEA'}"
  }
}
```

The built-in date range is an object under `page.dateRange` — a preset selection
is `{ "preset": "last_30_days" }`, a custom range is
`{ "from": "2026-01-01", "to": "2026-03-31" }` (either bound may be absent).

## Dataset widgets

Widgets bound to a semantic-layer `dataset` participate the same way: the
dashboard merges the scoped filter into the widget's `filter`, which the
dataset widget forwards to the dataset query as `runtimeFilter`. Inline
(`object`-based) and dataset-bound widgets can mix freely on one filtered
dashboard.

## Known limitations

- **Embedding a Page with its own `variables`** — the dashboard hosts its
  filter values in its own variables provider. When a dashboard and a
  surrounding Page both declare variables, expressions inside the dashboard
  resolve `page.*` against the **innermost** provider only: the outer Page's
  variables are shadowed inside the dashboard subtree. Workaround: don't rely
  on outer-page variables inside a filtered dashboard's widgets (or duplicate
  the value into a dashboard filter). Merging nested variable contexts is a
  candidate future enhancement.
- **Static-data widgets are not filtered** — a widget with an inline `data`
  array has no query to scope, so dashboard filters do not apply to it. Bind
  the widget to an `object` (or a `dataset`) if it should respond to filters.
- **Default bindings assume the field exists** — when a filter's default
  `field` does not exist on a widget's object, the widget's query returns
  empty (or errors, depending on the backend). Map the filter to the right
  field with `filterBindings: { "<name>": "<field>" }`, or opt the widget out
  with `filterBindings: { "<name>": false }`. Metadata-aware skipping is a
  planned enhancement.

## i18n

The filter bar's strings resolve from the `dashboard.filters.*` keys
(`@object-ui/i18n` ships `en` and `zh` entries — control labels come from each
filter's `label`, so translate those in your schema metadata).

## Spec alignment

`DashboardSchema.dateRange`, `GlobalFilterSchema` (including `name`) and
`DashboardWidgetSchema.filterBindings` are part of `@objectstack/spec`
(framework#2501). Author dashboards against the spec shapes; ObjectUI renders
them.
