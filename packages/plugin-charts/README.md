# Plugin Charts - Lazy-Loaded Recharts Components

A lazy-loaded charting component for Object UI based on Recharts.

## Features

- **Internal Lazy Loading**: Recharts is loaded on-demand using `React.lazy()` and `Suspense`
- **Zero Configuration**: Just import the package and use `type: 'chart-bar'` in your schema
- **Automatic Registration**: Components auto-register with the ComponentRegistry
- **Skeleton Loading**: Shows a skeleton while Recharts loads

## Installation

```bash
pnpm add @object-ui/plugin-charts
```

## Usage

### Automatic Registration (Side-Effect Import)

```typescript
// In your app entry point (e.g., App.tsx or main.tsx)
import '@object-ui/plugin-charts';

// Now you can use chart-bar type in your schemas
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
};
```

### Manual Integration

```typescript
import { chartComponents } from '@object-ui/plugin-charts';
import { ComponentRegistry } from '@object-ui/core';

// Manually register if needed
Object.entries(chartComponents).forEach(([type, component]) => {
  ComponentRegistry.register(type, component);
});
```

### TypeScript Support

The plugin exports TypeScript types for full type safety:

```typescript
import type { BarChartSchema } from '@object-ui/plugin-charts';

const schema: BarChartSchema = {
  type: 'chart-bar',
  data: [
    { name: 'Jan', value: 400 },
    { name: 'Feb', value: 300 }
  ],
  dataKey: 'value',
  xAxisKey: 'name',
  height: 400
};
```

## Schema API

```typescript
{
  type: 'chart-bar',
  data?: Array<Record<string, any>>,  // Chart data
  dataKey?: string,                    // Y-axis data key (default: 'value')
  xAxisKey?: string,                   // X-axis label key (default: 'name')
  height?: number,                     // Chart height in pixels (default: 400)
  color?: string,                      // Bar color (default: '#8884d8')
  className?: string                   // Tailwind classes
}
```

## Lazy Loading Architecture

The plugin uses a two-file pattern for optimal code splitting:

1. **`ChartImpl.tsx`**: Contains the actual Recharts import (heavy ~541 KB)
2. **`index.tsx`**: Entry point with `React.lazy()` wrapper (light)

When bundled, Vite automatically creates separate chunks:
- `index.js` (~200 bytes) - The entry point
- `ChartImpl-xxx.js` (~541 KB minified, ~136 KB gzipped) - The lazy-loaded implementation

The Recharts library is only downloaded when a `chart-bar` component is actually rendered, not on initial page load.

## Build Output Example

```
dist/index.js                 0.19 kB  # Entry point
dist/ChartImpl-BJBP1UnW.js  541.17 kB  # Lazy chunk (loaded on demand)
dist/index.umd.cjs          393.20 kB  # UMD bundle
```

## Development

```bash
# Build the plugin
pnpm build

# The package will generate proper ESM and UMD builds with lazy loading preserved
```

## Bundle Size Impact

By using lazy loading, the main application bundle stays lean:
- Without lazy loading: +541 KB on initial load
- With lazy loading: +0.19 KB on initial load, +541 KB only when chart is rendered

This results in significantly faster initial page loads for applications that don't use charts on every page.
