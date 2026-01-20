---
title: "Chart Components"
---

Visualizations for data analytics.

## Bar Chart `bar-chart`

Vertical or horizontal bar chart.

```typescript
interface BarChartSchema {
  type: 'bar-chart';
  data: any[]; // Or bound via context
  categories: string[]; // Fields to plot as bars (e.g. ["sales", "profit"])
  index: string; // Field for X-axis (e.g. "month")
  colors?: string[]; // Array of color codes or CSS variables
  valueFormatter?: string; // Function name to format values
  yAxisWidth?: number;
  layout?: 'vertical' | 'horizontal';
  stack?: boolean; // Stacked bars
}
```

## Line Chart `line-chart`

Line chart for trends over time.

```typescript
interface LineChartSchema {
  type: 'line-chart';
  data: any[];
  categories: string[];
  index: string;
  colors?: string[];
  valueFormatter?: string;
  yAxisWidth?: number;
  curveType?: 'monotone' | 'linear' | 'step'; // Curve interpolation
}
```

## Pie Chart `pie-chart`

Circular chart for part-to-whole comparison.

```typescript
interface PieChartSchema {
  type: 'pie-chart';
  data: any[];
  category: string; // Field for segment names
  value: string; // Field for segment values
  colors?: string[];
  valueFormatter?: string;
  donut?: boolean; // Donut style
}
```

## Area Chart `area-chart`

Area chart for filled trends.

```typescript
interface AreaChartSchema {
  type: 'area-chart';
  data: any[];
  categories: string[];
  index: string;
  colors?: string[];
  stack?: boolean;
}
```
