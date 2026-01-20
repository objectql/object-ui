---
title: "Report & Dashboard Metadata"
---

> **Implementation Status**: 📝 **Planned** - Report and dashboard features planned for Q3-Q4 2026.
> 
> See [Implementation Status](./implementation-status.md#protocol-specifications) for roadmap.

Report and dashboard metadata defines data visualization, analytics, and reporting capabilities. This enables business intelligence directly from ObjectQL metadata.

## 1. Overview

Reporting features include:

- **Multiple Report Types**: Tabular, summary, matrix (pivot), chart
- **Multi-Object Joins**: Query across related objects
- **Grouping & Aggregations**: COUNT, SUM, AVG, MIN, MAX
- **Filtering**: Dynamic filters and criteria
- **Scheduling**: Automated report generation and delivery
- **Export**: PDF, Excel, CSV formats
- **Dashboards**: Combine multiple reports and charts

**File Naming Convention:** `<report_name>.report.yml`, `<dashboard_name>.dashboard.yml`

The filename (without the `.report.yml` or `.dashboard.yml` extension) automatically becomes the report/dashboard identifier.

**Examples:**
- `sales_summary.report.yml` → Report name: `sales_summary`
- `executive_dashboard.dashboard.yml` → Dashboard name: `executive_dashboard`

## 2. Report Types

| Type | Description | Use Case |
|:---|:---|:---|
| `tabular` | Simple list/table | Flat data lists, exports |
| `summary` | Grouped with subtotals | Sales by region, tasks by status |
| `matrix` | Pivot table/cross-tab | Time-series analysis, comparisons |
| `chart` | Visualization only | Dashboards, presentations |

## 3. Tabular Reports

Simple list reports with columns and filters:

```yaml
# File: open_tasks.report.yml
# Report name is inferred from filename!

label: Open Tasks
type: tabular
object: tasks

# Columns
columns:
  - field: name
    label: Task Name
    width: 300
  
  - field: assignee.name
    label: Assigned To
    width: 150
  
  - field: priority
    label: Priority
    width: 100
  
  - field: due_date
    label: Due Date
    width: 120
    format: MM/DD/YYYY
  
  - field: project.name
    label: Project
    width: 200

# Filters
filters:
  - field: status
    operator: "!="
    value: completed
  
  - field: due_date
    operator: ">="
    value: $today

# Sorting
sort:
  - field: priority
    direction: desc
  - field: due_date
    direction: asc

# Limit
limit: 1000

# Allow export
export:
  enabled: true
  formats: [csv, excel, pdf]
```

## 4. Summary Reports

Grouped reports with aggregations:

```yaml
name: sales_by_region
label: Sales Summary by Region
type: summary
object: orders

# Grouping Levels
groupings:
  # Primary grouping
  - field: customer.region
    label: Region
    sort: asc
  
  # Secondary grouping
  - field: product_category
    label: Category
    sort: asc

# Detail Columns
columns:
  - field: order_number
    label: Order #
  
  - field: customer.name
    label: Customer
  
  - field: order_date
    label: Date
    format: MM/DD/YYYY
  
  - field: amount
    label: Amount
    format: currency

# Aggregations
aggregations:
  # Count of records
  - function: count
    field: id
    label: Total Orders
    display_at: [group, total]
  
  # Sum
  - function: sum
    field: amount
    label: Total Sales
    format: currency
    display_at: [group, total]
  
  # Average
  - function: avg
    field: amount
    label: Average Order Value
    format: currency
    display_at: [group, total]
  
  # Min/Max
  - function: min
    field: order_date
    label: First Order
    format: date
    display_at: [group]
  
  - function: max
    field: order_date
    label: Last Order
    format: date
    display_at: [group]

# Filters
filters:
  - field: status
    operator: "="
    value: completed
  
  - field: order_date
    operator: between
    value: [$start_of_year, $end_of_year]

# Chart
chart:
  enabled: true
  type: bar
  x_axis: customer.region
  y_axis: amount
  aggregation: sum
```

## 5. Matrix Reports

Pivot table / cross-tab reports:

```yaml
name: sales_by_month_and_product
label: Sales Matrix
type: matrix
object: orders

# Row Grouping
row_groupings:
  - field: product.category
    label: Product Category
    sort: asc
  
  - field: product.name
    label: Product
    sort: asc

# Column Grouping
column_groupings:
  - field: order_date
    label: Month
    date_function: month  # year, quarter, month, week, day
    format: MMM YYYY

# Measure (Value in cells)
measure:
  function: sum
  field: amount
  label: Total Sales
  format: currency

# Show Totals
totals:
  row_totals: true
  column_totals: true
  grand_total: true

# Filters
filters:
  - field: order_date
    operator: ">="
    value: $start_of_year
  
  - field: status
    operator: "="
    value: completed

# Chart
chart:
  enabled: true
  type: stacked_bar
```

## 6. Chart Reports

Visualization-focused reports:

```yaml
name: revenue_trend
label: Revenue Trend
type: chart
object: orders

# Chart Configuration
chart:
  type: line  # line, bar, pie, donut, area, scatter
  title: Monthly Revenue Trend
  
  # Data
  x_axis:
    field: order_date
    label: Month
    date_function: month
    format: MMM YYYY
  
  y_axis:
    function: sum
    field: amount
    label: Revenue
    format: currency
  
  # Multiple series
  series:
    field: product_category
    label: Category
  
  # Styling
  height: 400
  show_legend: true
  show_grid: true
  show_data_labels: false
  
  # Colors
  color_scheme: default  # default, blue, green, red, custom
  
  # Interactive
  interactive: true
  allow_drill_down: true

# Filters
filters:
  - field: order_date
    operator: ">="
    value: $start_of_year
  
  - field: status
    operator: "="
    value: completed
```

### 6.1 Chart Types

```yaml
# Bar Chart
chart:
  type: bar
  orientation: vertical  # vertical, horizontal
  stacked: false

# Line Chart
chart:
  type: line
  smooth: true
  fill_area: false

# Pie/Donut Chart
chart:
  type: pie  # or donut
  show_percentage: true
  show_labels: true

# Area Chart
chart:
  type: area
  stacked: true

# Scatter Plot
chart:
  type: scatter
  x_axis: { field: quantity }
  y_axis: { field: price }
  size_by: { field: discount }

# Combo Chart
chart:
  type: combo
  series:
    - type: bar
      field: revenue
      y_axis: primary
    - type: line
      field: profit_margin
      y_axis: secondary
```

## 7. Dashboard Configuration

Combine multiple reports and charts:

```yaml
name: sales_dashboard
label: Sales Dashboard
description: Executive sales overview

# Layout
layout:
  columns: 12  # Grid system
  
  # Widgets
  widgets:
    # KPI Cards
    - type: metric
      title: Total Revenue
      position: { row: 1, col: 1, width: 3, height: 2 }
      metric:
        object: orders
        function: sum
        field: amount
        format: currency
        filters:
          - field: status
            value: completed
      
      # Comparison
      compare_to: previous_month
      show_trend: true
    
    - type: metric
      title: Active Customers
      position: { row: 1, col: 4, width: 3, height: 2 }
      metric:
        object: customers
        function: count
        field: id
        filters:
          - field: status
            value: active
    
    - type: metric
      title: Avg Order Value
      position: { row: 1, col: 7, width: 3, height: 2 }
      metric:
        object: orders
        function: avg
        field: amount
        format: currency
    
    - type: metric
      title: Conversion Rate
      position: { row: 1, col: 10, width: 3, height: 2 }
      metric:
        formula: (completed_orders / total_leads) * 100
        format: percentage
    
    # Chart Widget
    - type: chart
      title: Revenue Trend
      position: { row: 3, col: 1, width: 8, height: 4 }
      report: revenue_trend
    
    # Table Widget
    - type: table
      title: Top Products
      position: { row: 3, col: 9, width: 4, height: 4 }
      report: top_products
      limit: 10
    
    # Chart Widget 2
    - type: chart
      title: Sales by Region
      position: { row: 7, col: 1, width: 6, height: 4 }
      report: sales_by_region
    
    # Chart Widget 3
    - type: chart
      title: Product Mix
      position: { row: 7, col: 7, width: 6, height: 4 }
      chart:
        type: pie
        object: order_items
        measure: { function: sum, field: quantity }
        grouping: product_category

# Filters (apply to all widgets)
filters:
  - name: date_range
    label: Date Range
    type: date_range
    default: this_month
  
  - name: region
    label: Region
    type: select
    object: regions
    field: name
    allow_all: true

# Refresh
refresh:
  auto_refresh: true
  interval: 300  # 5 minutes

# Permissions
permissions:
  view: [admin, manager, sales]
  edit: [admin]
```

## 8. Report Filters

### 8.1 Standard Filters

```yaml
filters:
  # Equality
  - field: status
    operator: "="
    value: active
  
  # Comparison
  - field: amount
    operator: ">"
    value: 1000
  
  # Range
  - field: created_date
    operator: between
    value: [2024-01-01, 2024-12-31]
  
  # List
  - field: category
    operator: in
    value: [electronics, computers, phones]
  
  # String matching
  - field: name
    operator: contains
    value: laptop
  
  # Null check
  - field: deleted_date
    operator: is_null
```

### 8.2 Dynamic Filters

```yaml
filters:
  # Current user
  - field: owner_id
    operator: "="
    value: $current_user.id
  
  # Date functions
  - field: created_date
    operator: "="
    value: $today
  
  # Relative dates
  - field: created_date
    operator: ">="
    value: $start_of_month
  
  # Formulas
  - field: total
    operator: ">"
    value: $average_order_value * 2
```

### 8.3 User Filters

Allow users to customize filters:

```yaml
user_filters:
  - name: date_range
    label: Date Range
    field: order_date
    type: date_range
    default: this_month
    required: false
  
  - name: status
    label: Status
    field: status
    type: multi_select
    options:
      - draft
      - pending
      - completed
    default: [pending, completed]
  
  - name: region
    label: Region
    field: customer.region
    type: lookup
    object: regions
    allow_all: true
  
  - name: amount_min
    label: Min Amount
    field: amount
    type: number
    operator: ">="
```

## 9. Formulas & Calculated Fields

Create computed values:

```yaml
columns:
  # Simple calculation
  - name: profit
    label: Profit
    formula: revenue - cost
    format: currency
  
  # Percentage
  - name: profit_margin
    label: Profit Margin
    formula: (revenue - cost) / revenue * 100
    format: percentage
  
  # Conditional
  - name: status_category
    label: Category
    formula: |
      if (amount > 10000) {
        return 'High Value';
      } else if (amount > 1000) {
        return 'Medium Value';
      } else {
        return 'Low Value';
      }
  
  # Date calculations
  - name: days_open
    label: Days Open
    formula: $today - created_date
    format: number
  
  # Lookup
  - name: account_owner_name
    label: Account Owner
    formula: customer.account.owner.name
```

## 10. Scheduling & Distribution

Automate report generation:

```yaml
schedule:
  # Enable scheduling
  enabled: true
  
  # Frequency
  frequency: weekly  # daily, weekly, monthly, custom
  
  # Custom schedule
  cron: "0 9 * * 1"  # Every Monday at 9 AM
  
  # Time zone
  timezone: America/New_York
  
  # Distribution
  recipients:
    - email: sales-team@company.com
    - user_id: manager_123
    - role: executive
  
  # Email settings
  email:
    subject: Weekly Sales Report - ${date}
    body: |
      Please find attached the weekly sales report.
      
      Report Period: ${start_date} to ${end_date}
    
    # Attachment format
    format: pdf  # pdf, excel, csv
    
    # Inline preview
    include_preview: true
  
  # Filters for scheduled run
  filter_values:
    date_range: last_week
    region: all
```

## 11. Export Configuration

```yaml
export:
  enabled: true
  
  # Available formats
  formats:
    - csv
    - excel
    - pdf
  
  # Excel options
  excel:
    sheet_name: Sales Report
    include_filters: true
    include_chart: true
    freeze_header: true
  
  # PDF options
  pdf:
    page_size: letter  # letter, a4, legal
    orientation: portrait  # portrait, landscape
    include_logo: true
    header: Company Sales Report
    footer: "Page ${page} of ${total_pages}"
  
  # CSV options
  csv:
    delimiter: ","
    include_header: true
    encoding: utf-8
```

## 12. Performance Optimization

```yaml
performance:
  # Caching
  cache:
    enabled: true
    ttl: 3600  # 1 hour
    
    # Cache key includes
    cache_key_fields:
      - filters
      - user_id
  
  # Pagination
  pagination:
    enabled: true
    page_size: 100
    max_records: 10000
  
  # Indexing hints
  use_indexes:
    - customer.region
    - order_date
  
  # Query optimization
  optimize:
    push_down_filters: true
    parallel_execution: true
```

## 13. Access Control

```yaml
permissions:
  # Who can view
  view:
    - admin
    - manager
    - sales_rep
  
  # Who can edit report definition
  edit:
    - admin
  
  # Row-level security
  row_level_security:
    enabled: true
    filter:
      # Users only see their own data
      field: owner_id
      operator: "="
      value: $current_user.id
    
    # Except for admins
    bypass_roles:
      - admin
      - manager
  
  # Field-level security
  field_restrictions:
    cost:
      visible_to: [admin, finance]
    
    profit_margin:
      visible_to: [admin, executive]
```

## 14. Implementation Example

```typescript
// src/reports/sales_summary.report.yml
import { ReportDefinition } from '@objectql/types';

export const sales_summary: ReportDefinition = {
  name: 'sales_summary',
  type: 'summary',
  object: 'orders',
  groupings: [
    { field: 'customer.region', label: 'Region' }
  ],
  aggregations: [
    { function: 'sum', field: 'amount', label: 'Total Sales' },
    { function: 'count', field: 'id', label: 'Order Count' }
  ],
  filters: [
    ['status', '=', 'completed']
  ],
  chart: {
    enabled: true,
    type: 'bar',
    x_axis: 'customer.region',
    y_axis: 'amount'
  }
};
```

## 15. Best Practices

1. **Performance**: Use indexes, limit record counts
2. **Filters**: Provide sensible default filters
3. **Aggregations**: Use appropriate summary functions
4. **Formatting**: Apply proper number/date formatting
5. **Permissions**: Implement row-level security
6. **Caching**: Enable caching for frequently-run reports
7. **Naming**: Use clear, descriptive names
8. **Documentation**: Document report purpose and filters

## 16. Related Specifications

- [Objects & Fields](./object.md) - Data models
- [Query Language](./query-language.md) - Query syntax
- [Views](./view.md) - Display layouts
- [Permissions](./permission.md) - Access control
