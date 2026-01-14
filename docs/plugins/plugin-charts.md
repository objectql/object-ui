# Plugin Charts

Data visualization components powered by Recharts.

## Installation

```bash
npm install @object-ui/plugin-charts
```

## Usage

### Basic Usage

```tsx
// Import once in your app entry point
import '@object-ui/plugin-charts'

// Use in schemas
const schema = {
  type: 'chart-bar',
  data: [
    { name: 'Jan', value: 400 },
    { name: 'Feb', value: 300 },
    { name: 'Mar', value: 600 }
  ],
  dataKey: 'value',
  xAxisKey: 'name',
  height: 400
}
```

## Features

- **Bar, line, area, and pie charts**
- **Responsive design**
- **Customizable colors and styles**
- **Lazy-loaded** (~540 KB loads only when rendered)

## Schema API

```typescript
{
  type: 'chart-bar',
  data?: Array<Record<string, any>>,  // Chart data
  dataKey?: string,                    // Y-axis data key
  xAxisKey?: string,                   // X-axis label key
  height?: number,                     // Chart height
  color?: string,                      // Bar color
  className?: string                   // Tailwind classes
}
```

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `data` | Array<Record<string, any>> | `[]` | Array of data objects to visualize |
| `dataKey` | string | `'value'` | Key in data objects for Y-axis values |
| `xAxisKey` | string | `'name'` | Key in data objects for X-axis labels |
| `height` | number | `400` | Chart height in pixels |
| `color` | string | `'#8884d8'` | Primary color for bars/lines |
| `className` | string | `''` | Additional Tailwind CSS classes |

## Chart Types

### Bar Chart

```tsx
const schema = {
  type: 'chart-bar',
  data: [
    { month: 'Jan', sales: 400 },
    { month: 'Feb', sales: 300 },
    { month: 'Mar', sales: 600 }
  ],
  dataKey: 'sales',
  xAxisKey: 'month',
  color: '#3b82f6',
  height: 300
}
```

### Line Chart

```tsx
const schema = {
  type: 'chart-line',
  data: [
    { date: '2024-01', users: 120 },
    { date: '2024-02', users: 180 },
    { date: '2024-03', users: 250 }
  ],
  dataKey: 'users',
  xAxisKey: 'date',
  height: 350
}
```

### Area Chart

```tsx
const schema = {
  type: 'chart-area',
  data: [
    { time: '9:00', value: 20 },
    { time: '10:00', value: 35 },
    { time: '11:00', value: 45 }
  ],
  dataKey: 'value',
  xAxisKey: 'time',
  color: '#10b981'
}
```

### Pie Chart

```tsx
const schema = {
  type: 'chart-pie',
  data: [
    { name: 'Desktop', value: 400 },
    { name: 'Mobile', value: 300 },
    { name: 'Tablet', value: 200 }
  ],
  dataKey: 'value',
  nameKey: 'name'
}
```

## Examples

### Revenue Dashboard

```tsx
const revenueChart = {
  type: 'chart-bar',
  data: [
    { quarter: 'Q1 2024', revenue: 45000, target: 50000 },
    { quarter: 'Q2 2024', revenue: 52000, target: 50000 },
    { quarter: 'Q3 2024', revenue: 61000, target: 55000 },
    { quarter: 'Q4 2024', revenue: 58000, target: 60000 }
  ],
  dataKey: 'revenue',
  xAxisKey: 'quarter',
  height: 400,
  color: '#059669',
  className: 'rounded-lg shadow-md'
}
```

### User Growth Chart

```tsx
const growthChart = {
  type: 'chart-line',
  data: [
    { month: 'Jan', users: 1200, active: 980 },
    { month: 'Feb', users: 1450, active: 1150 },
    { month: 'Mar', users: 1680, active: 1380 },
    { month: 'Apr', users: 1920, active: 1620 }
  ],
  dataKey: 'users',
  xAxisKey: 'month',
  height: 350
}
```

## Bundle Size

The plugin uses lazy loading to optimize bundle size:

- **Initial load**: ~0.2 KB (entry point)
- **Lazy chunk**: ~541 KB minified (~136 KB gzipped)
- **Loads only when rendered**

Without lazy loading, this would add 541 KB to your main bundle. With lazy loading, it's loaded only when charts are displayed.

## Customization

### Custom Colors

```tsx
const schema = {
  type: 'chart-bar',
  data: salesData,
  color: '#f59e0b', // Amber color
  className: 'bg-white p-4 rounded-lg'
}
```

### Responsive Height

```tsx
const schema = {
  type: 'chart-line',
  data: metricsData,
  height: 500,
  className: 'h-64 sm:h-96 lg:h-[500px]'
}
```

## TypeScript Support

```typescript
import type { BarChartSchema } from '@object-ui/plugin-charts'

const chartSchema: BarChartSchema = {
  type: 'chart-bar',
  data: [
    { name: 'Product A', value: 400 },
    { name: 'Product B', value: 300 }
  ],
  dataKey: 'value',
  xAxisKey: 'name',
  height: 400
}
```

## Related Documentation

- [Plugin System Overview](../guide/plugins.md)
- [Lazy-Loaded Plugins Architecture](../lazy-loaded-plugins.md)
- [Package README](https://github.com/objectstack-ai/objectui/tree/main/packages/plugin-charts)
