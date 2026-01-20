---
title: "Architecture: ObjectStack Spec Integration"
---

## Overview

This document explains how ObjectUI integrates with `@objectstack/spec` (v0.1.1) as the foundational protocol for all UI components.

## The Inheritance Chain

```
@objectstack/spec (v0.1.1)          ← The "Highest Law" - Universal Protocol
    ↓
UIComponent                         ← Base interface for all UI components
    ↓
BaseSchema (@object-ui/types)       ← ObjectUI-specific extensions
    ↓
Specific Schemas                    ← Component implementations
    ↓
Component Renderers                 ← UI implementations
```

### 1. UIComponent (@objectstack/spec)

The foundational interface that defines the core protocol for schema-driven UI:

```typescript
interface UIComponent {
  type: string;                           // Component type discriminator
  id?: string;                            // Unique identifier
  props?: Record<string, any>;            // Component-specific properties
  children?: SchemaNode | SchemaNode[];   // Child content
  [key: string]: any;                     // Extensibility
}
```

**Why this is the "highest law":**
- Defines the universal contract for all UI components
- Ensures interoperability across the ObjectStack ecosystem
- Provides the type discriminator pattern
- Enables JSON serialization

### 2. BaseSchema (@object-ui/types)

Extends `UIComponent` with ObjectUI-specific rendering logic:

```typescript
interface BaseSchema extends UIComponent {
  // Inherited from UIComponent
  type: string;
  id?: string;
  children?: SchemaNode | SchemaNode[];
  
  // ObjectUI extensions
  className?: string;          // Tailwind CSS classes
  visible?: boolean;           // Static visibility
  visibleOn?: string;          // Dynamic visibility (expression)
  hidden?: boolean;            // Static hiding
  hiddenOn?: string;           // Dynamic hiding (expression)
  disabled?: boolean;          // Static disabled state
  disabledOn?: string;         // Dynamic disabled state (expression)
  
  // Additional ObjectUI properties
  name?: string;
  label?: string;
  description?: string;
  placeholder?: string;
  style?: Record<string, string | number>;
  data?: any;
  body?: SchemaNode | SchemaNode[];
  testId?: string;
  ariaLabel?: string;
}
```

### 3. Specific Schemas (e.g., ChartSchema)

Component-specific interfaces that extend `BaseSchema`:

```typescript
interface ChartSchema extends BaseSchema {
  type: 'chart';                    // Type discriminator
  chartType: ChartType;             // Chart-specific property
  title?: string;
  description?: string;
  categories?: string[];
  series: ChartSeries[];
  height?: string | number;
  showLegend?: boolean;
  showGrid?: boolean;
  animate?: boolean;
  config?: Record<string, any>;
}
```

## Data Display Components

The following components are defined in `@object-ui/types/data-display`:

| Type | Component | Schema Interface | Key Properties |
|------|-----------|-----------------|----------------|
| `alert` | Alert | `AlertSchema` | title, description, variant, icon, dismissible |
| `statistic` | Metric Card | `StatisticSchema` | label, value, trend, description, icon |
| `badge` | Badge | `BadgeSchema` | label, variant, icon |
| `avatar` | Avatar | `AvatarSchema` | src, alt, fallback, size, shape |
| `list` | List | `ListSchema` | items, ordered, dividers |
| `table` | Basic Table | `TableSchema` | columns, data, caption, hoverable |
| `data-table` | Data Grid | `DataTableSchema` | pagination, searchable, rowActions, selectable |
| `chart` | Chart | `ChartSchema` | chartType, series, categories, showLegend |
| `timeline` | Timeline | `TimelineSchema` | events, orientation, position |
| `tree-view` | Tree View | `TreeViewSchema` | data, multiSelect, showLines |
| `markdown` | Markdown | `MarkdownSchema` | content, sanitize |
| `html` | Raw HTML | `HtmlSchema` | html |

## Usage Examples

### 1. Simple Component (Compliant with UIComponent)

```json
{
  "type": "badge",
  "id": "status-badge",
  "label": "New",
  "variant": "default"
}
```

### 2. Component with ObjectUI Extensions

```json
{
  "type": "alert",
  "id": "welcome-alert",
  "title": "Welcome!",
  "description": "Thank you for using ObjectUI",
  "variant": "default",
  "icon": "info",
  "dismissible": true,
  "visibleOn": "${user.isNewUser}",
  "className": "mb-4"
}
```

### 3. Complex Component with Children

```json
{
  "type": "flex",
  "id": "user-profile",
  "props": {
    "direction": "col",
    "gap": 4
  },
  "children": [
    {
      "type": "avatar",
      "src": "https://github.com/shadcn.png",
      "fallback": "JD",
      "size": "lg"
    },
    {
      "type": "statistic",
      "label": "Followers",
      "value": "1,234",
      "trend": "up"
    },
    {
      "type": "badge",
      "label": "Pro Member",
      "variant": "default"
    }
  ]
}
```

### 4. Data Display with Chart

```json
{
  "type": "chart",
  "id": "sales-chart",
  "chartType": "bar",
  "title": "Monthly Sales",
  "categories": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  "series": [
    {
      "name": "Revenue",
      "data": [12000, 15000, 18000, 14000, 22000, 25000],
      "color": "#3b82f6"
    }
  ],
  "showLegend": true,
  "height": 400
}
```

## Protocol Compliance Rules

When creating or using components:

1. ✅ **MUST** extend from `UIComponent` (directly or indirectly via `BaseSchema`)
2. ✅ **MUST** include a `type` field (the discriminator)
3. ✅ **MUST** use the correct type value from the component registry
4. ✅ **SHOULD** place component-specific properties at the top level (not in props)
5. ✅ **SHOULD** use `props` for standard HTML attributes (role, aria-*, data-*)
6. ✅ **SHOULD** support `children` for composable components
7. ✅ **SHOULD** support `id` for unique identification
8. ✅ **MAY** use ObjectUI extensions (className, visibleOn, etc.)

### Property Placement Guide

**Component-specific properties** → Top level:
```json
{
  "type": "alert",
  "title": "Welcome",        // ✅ Component-specific
  "variant": "default",      // ✅ Component-specific
  "dismissible": true        // ✅ Component-specific
}
```

**Standard HTML/ARIA attributes** → props object:
```json
{
  "type": "alert",
  "title": "Welcome",
  "props": {
    "role": "alert",         // ✅ HTML attribute
    "aria-live": "polite",   // ✅ ARIA attribute
    "data-testid": "alert"   // ✅ Data attribute
  }
}
```

## Related Packages

- **[@objectstack/spec](../../packages/objectstack-spec)** - Universal UI component specification
- **[@object-ui/types](../../packages/types)** - ObjectUI protocol extensions
- **[@object-ui/core](../../packages/core)** - Schema validation and expression engine
- **[@object-ui/react](../../packages/react)** - React renderer
- **[@object-ui/components](../../packages/components)** - Shadcn/Tailwind implementation

## References

- [ObjectStack Spec README](../../packages/objectstack-spec/README.md)
- [Object UI Types README](../../packages/types/README.md)
- [Data Display Examples](../../packages/types/examples/data-display-examples.json)
