# @object-ui/plugin-dashboard

Dashboard plugin for Object UI - Create beautiful dashboards with metrics, charts, and widgets.

## Features

- **Dashboard Layouts** - Grid-based dashboard layouts
- **Metric Cards** - Display KPIs and statistics
- **Widget System** - Modular widget components
- **Responsive** - Mobile-friendly dashboard grids
- **Customizable** - Tailwind CSS styling support

## Installation

```bash
pnpm add @object-ui/plugin-dashboard
```

## Usage

### Automatic Registration (Side-Effect Import)

```typescript
// In your app entry point (e.g., App.tsx or main.tsx)
import '@object-ui/plugin-dashboard';

// Now you can use dashboard types in your schemas
const schema = {
  type: 'dashboard',
  widgets: [
    {
      type: 'metric-card',
      title: 'Total Sales',
      value: '$123,456',
      trend: 'up',
      trendValue: '+12%'
    }
  ]
};
```

### Manual Registration

```typescript
import { dashboardComponents } from '@object-ui/plugin-dashboard';
import { ComponentRegistry } from '@object-ui/core';

// Register dashboard components
Object.entries(dashboardComponents).forEach(([type, component]) => {
  ComponentRegistry.register(type, component);
});
```

## Schema API

### Dashboard

Container for dashboard widgets:

```typescript
{
  type: 'dashboard',
  widgets: Widget[],
  columns?: number,               // Grid columns (default: 3)
  gap?: number,                   // Gap between widgets
  className?: string
}
```

### Metric Card

Display a single metric or KPI:

```typescript
{
  type: 'metric-card',
  title: string,
  value: string | number,
  icon?: string,                  // Lucide icon name
  trend?: 'up' | 'down' | 'neutral',
  trendValue?: string,
  description?: string,
  className?: string
}
```

## Examples

### Basic Dashboard

```typescript
const schema = {
  type: 'dashboard',
  columns: 3,
  gap: 4,
  widgets: [
    {
      type: 'metric-card',
      title: 'Total Users',
      value: '1,234',
      icon: 'users',
      trend: 'up',
      trendValue: '+12%',
      description: 'vs last month'
    },
    {
      type: 'metric-card',
      title: 'Revenue',
      value: '$56,789',
      icon: 'dollar-sign',
      trend: 'up',
      trendValue: '+8.2%',
      description: 'vs last month'
    },
    {
      type: 'metric-card',
      title: 'Active Sessions',
      value: '432',
      icon: 'activity',
      trend: 'down',
      trendValue: '-3%',
      description: 'vs last month'
    }
  ]
};
```

### Dashboard with Charts

```typescript
const schema = {
  type: 'dashboard',
  widgets: [
    {
      type: 'metric-card',
      title: 'Total Revenue',
      value: '$123,456'
    },
    {
      type: 'card',
      title: 'Sales Trend',
      body: {
        type: 'line-chart',
        data: [/* chart data */],
        height: 300
      }
    },
    {
      type: 'card',
      title: 'Category Distribution',
      body: {
        type: 'pie-chart',
        data: [/* chart data */]
      }
    }
  ]
};
```

### Responsive Dashboard

```typescript
const schema = {
  type: 'dashboard',
  columns: 4,
  gap: 6,
  className: 'lg:grid-cols-4 md:grid-cols-2 sm:grid-cols-1',
  widgets: [/* widgets */]
};
```

## Integration with Data Sources

Connect dashboard to live data:

```typescript
import { createObjectStackAdapter } from '@object-ui/data-objectstack';

const dataSource = createObjectStackAdapter({
  baseUrl: 'https://api.example.com',
  token: 'your-auth-token'
});

const schema = {
  type: 'dashboard',
  dataSource,
  widgets: [
    {
      type: 'metric-card',
      title: 'Total Users',
      value: '${data.metrics.totalUsers}',
      trend: '${data.metrics.userTrend}'
    }
  ]
};
```

## TypeScript Support

```typescript
import type { DashboardSchema, MetricCardSchema } from '@object-ui/plugin-dashboard';

const metricCard: MetricCardSchema = {
  type: 'metric-card',
  title: 'Revenue',
  value: '$123,456',
  trend: 'up',
  trendValue: '+12%'
};

const dashboard: DashboardSchema = {
  type: 'dashboard',
  columns: 3,
  widgets: [metricCard]
};
```

## Customization

All components support Tailwind CSS classes:

```typescript
const schema = {
  type: 'metric-card',
  title: 'Custom Metric',
  value: '100',
  className: 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
};
```

## License

MIT
