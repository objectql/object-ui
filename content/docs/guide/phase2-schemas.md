---
title: "Phase 2 Schemas Overview"
description: "Comprehensive overview of ObjectUI Phase 2 schemas for building enterprise applications"
---

# Phase 2 Schemas Overview

ObjectUI Phase 2 introduces powerful new schemas that enable you to build sophisticated enterprise applications with advanced features like theming, reporting, reusable components, and complex workflows. This guide provides an overview of all Phase 2 schemas and helps you get started quickly.

## What's New in Phase 2?

Phase 2 brings enterprise-grade capabilities to ObjectUI, making it easier to build production-ready applications:

- **Application Structure** - Define complete multi-page applications with navigation
- **Dynamic Theming** - Brand your applications with custom themes and light/dark modes
- **Advanced Actions** - Build complex workflows with API calls, chaining, and conditions
- **Enterprise Reporting** - Generate, schedule, and export comprehensive reports
- **Reusable Components** - Create and share component blocks across projects

## Core Schemas

### Application Configuration

#### [App Schema](/docs/core/app-schema)
Define your entire application structure with navigation, branding, and global settings.

```typescript
const app: AppSchema = {
  type: 'app',
  title: 'My Application',
  layout: 'sidebar',
  menu: [...],
  actions: [...]
};
```

**Use Cases:**
- Multi-page applications
- Admin dashboards
- CRM systems
- Internal tools

---

### Theming & Branding

#### [Theme Schema](/docs/core/theme-schema)
Dynamic theming with light/dark modes, color palettes, and typography.

```typescript
const theme: ThemeSchema = {
  type: 'theme',
  mode: 'dark',
  themes: [{
    name: 'professional',
    light: { primary: '#3b82f6', ... },
    dark: { primary: '#60a5fa', ... }
  }]
};
```

**Features:**
- Light/dark mode switching
- 20+ semantic colors
- Typography system
- CSS variables
- Tailwind integration

---

### Advanced Actions

#### [Enhanced Actions](/docs/core/enhanced-actions)
Powerful action system with AJAX calls, chaining, conditions, and callbacks.

```typescript
const action: ActionSchema = {
  type: 'action',
  actionType: 'ajax',
  api: '/api/submit',
  chain: [...],
  condition: { expression: '${...}', then: {...} },
  onSuccess: {...},
  tracking: {...}
};
```

**New Action Types:**
- **`ajax`** - API calls with full request configuration
- **`confirm`** - Confirmation dialogs
- **`dialog`** - Modal/dialog actions

**Advanced Features:**
- Action chaining (sequential/parallel)
- Conditional execution (if/then/else)
- Success/failure callbacks
- Event tracking
- Retry logic

---

### Reporting

#### [Report Schema](/docs/core/report-schema)
Enterprise reports with aggregation, export, and scheduling.

```typescript
const report: ReportSchema = {
  type: 'report',
  title: 'Sales Report',
  fields: [
    { name: 'revenue', aggregation: 'sum' },
    { name: 'orders', aggregation: 'count' }
  ],
  schedule: {
    frequency: 'monthly',
    recipients: ['team@company.com']
  }
};
```

**Features:**
- Field aggregation (sum, avg, count, min, max)
- Multiple export formats (PDF, Excel, CSV)
- Scheduled reports
- Email distribution
- Interactive builder

---

### Reusable Components

#### [Block Schema](/docs/blocks/block-schema)
Reusable component blocks with variables, slots, and marketplace support.

```typescript
const block: BlockSchema = {
  type: 'block',
  meta: { name: 'hero-section', category: 'Marketing' },
  variables: [
    { name: 'title', type: 'string', defaultValue: 'Welcome' }
  ],
  slots: [
    { name: 'content', label: 'Content Area' }
  ],
  template: { type: 'div', children: [...] }
};
```

**Features:**
- Typed variables (props)
- Content slots
- Block templates
- Marketplace support
- Version control

---

## Quick Comparison

| Schema | Purpose | Best For |
|--------|---------|----------|
| **AppSchema** | Application structure | Multi-page apps, dashboards |
| **ThemeSchema** | Visual theming | Brand consistency, white-labeling |
| **Enhanced Actions** | Complex workflows | API integration, multi-step processes |
| **ReportSchema** | Data reporting | Analytics, business intelligence |
| **BlockSchema** | Reusable components | Marketing pages, component libraries |

## View Components

Phase 2 also includes enhanced view components:

### [Detail View](/docs/components/detail-view)
Rich detail pages with sections, tabs, and related records.

### [View Switcher](/docs/components/view-switcher)
Toggle between list, grid, kanban, calendar, timeline, and map views.

### [Filter UI](/docs/components/filter-ui)
Advanced filtering interface with multiple field types.

### [Sort UI](/docs/components/sort-ui)
Sort configuration with multiple fields.

## Installation & Setup

### Package Installation

All Phase 2 schemas are included in `@object-ui/types`. Install it in your project:

```bash
npm install @object-ui/types
# or
pnpm add @object-ui/types
# or
yarn add @object-ui/types
```

### TypeScript Usage

Import the type definitions you need:

```typescript
import type { 
  AppSchema, 
  ThemeSchema, 
  ActionSchema,
  ReportSchema,
  BlockSchema 
} from '@object-ui/types';
```

### Runtime Validation

For runtime validation, use the included Zod schemas:

```typescript
import { 
  AppSchema,
  ThemeSchema,
  ActionSchema,
  ReportSchema,
  BlockSchema
} from '@object-ui/types/zod';

const result = AppSchema.safeParse(myConfig);
if (result.success) {
  // Valid configuration
  const app = result.data;
} else {
  // Handle validation errors
  console.error(result.error);
}
```

## Quick Start Example

Here's a complete example showing how to build a simple CRM application using Phase 2 schemas:

```typescript
import type { AppSchema, ThemeSchema } from '@object-ui/types';

// Define your application structure
const app: AppSchema = {
  type: 'app',
  name: 'enterprise-crm',
  title: 'Enterprise CRM',
  layout: 'sidebar',
  
  menu: [
    {
      type: 'item',
      label: 'Dashboard',
      icon: 'LayoutDashboard',
      path: '/dashboard'
    },
    {
      type: 'group',
      label: 'Sales',
      children: [
        { type: 'item', label: 'Leads', path: '/leads' },
        { type: 'item', label: 'Deals', path: '/deals' }
      ]
    }
  ],
  
  actions: [
    {
      type: 'user',
      label: 'User Name',
      items: [
        { type: 'item', label: 'Profile', path: '/profile' },
        { type: 'item', label: 'Logout', path: '/logout' }
      ]
    }
  ]
};

// Configure your theme
const theme: ThemeSchema = {
  type: 'theme',
  mode: 'system',
  themes: [{
    name: 'professional',
    light: { primary: '#3b82f6', background: '#fff' },
    dark: { primary: '#60a5fa', background: '#0f172a' }
  }],
  allowSwitching: true,
  persistPreference: true
};
```

This creates a professional-looking CRM application with:
- A sidebar layout with navigation menu
- Sales section with leads and deals
- User menu with profile and logout options
- Professional theme with light/dark mode support

## Upgrading from Phase 1

If you're currently using ObjectUI Phase 1, here's what's new and how to upgrade:

### New Top-Level Schemas

Phase 2 introduces four new top-level schemas:

- **`AppSchema`** - Define your entire application structure (new in Phase 2)
- **`ThemeSchema`** - Configure themes and color palettes (new in Phase 2)
- **`ReportSchema`** - Create data reports with aggregation (new in Phase 2)
- **`BlockSchema`** - Build reusable component blocks (new in Phase 2)

### Enhanced ActionSchema

The `ActionSchema` has been significantly enhanced with:

- ✅ New action types: `ajax`, `confirm`, `dialog`
- ✅ Action chaining via the `chain` array (sequential or parallel)
- ✅ Conditional execution with the `condition` property
- ✅ Success/failure callbacks: `onSuccess` and `onFailure`
- ✅ Event tracking with the `tracking` configuration
- ✅ Automatic retry logic

### New View Components

Phase 2 includes enhanced view components:

- **`DetailViewSchema`** - Rich detail pages with sections and tabs
- **`ViewSwitcherSchema`** - Toggle between list, grid, kanban, calendar views
- **`FilterUISchema`** - Advanced filtering interface
- **`SortUISchema`** - Multi-field sort configuration

### Backward Compatibility

Phase 2 is fully backward compatible with Phase 1 schemas. You can:

- Continue using existing Phase 1 schemas
- Gradually adopt Phase 2 features
- Mix Phase 1 and Phase 2 schemas in the same application

### Migration Steps

1. **Update package** - Install latest `@object-ui/types`
   ```bash
   npm install @object-ui/types@latest
   ```

2. **Add AppSchema** - Wrap your pages in an application structure (optional)
   
3. **Configure theme** - Add a ThemeSchema for consistent styling (optional)

4. **Enhance actions** - Update critical actions to use new features like `confirm` and callbacks

5. **Test thoroughly** - Verify all existing functionality works as expected

## Learning Resources

### Documentation
- **[Implementation Guide](https://github.com/objectstack-ai/objectui/blob/main/packages/types/PHASE2_IMPLEMENTATION.md)** - Complete implementation details and technical specifications
- **[Quick Start Guide](https://github.com/objectstack-ai/objectui/blob/main/PHASE2_QUICK_START.md)** - Step-by-step tutorial for getting started with Phase 2

### API Reference
- **[TypeScript Types](https://github.com/objectstack-ai/objectui/tree/main/packages/types/src)** - Browse all type definitions
- **[Zod Validation Schemas](https://github.com/objectstack-ai/objectui/tree/main/packages/types/src/zod)** - Runtime validation schemas

### Code Examples
- **[Test Suite](https://github.com/objectstack-ai/objectui/blob/main/packages/types/src/__tests__/phase2-schemas.test.ts)** - 40+ working examples demonstrating all Phase 2 features

## Getting Help

### Community Support
- **[GitHub Discussions](https://github.com/objectstack-ai/objectui/discussions)** - Ask questions and share ideas
- **[GitHub Issues](https://github.com/objectstack-ai/objectui/issues)** - Report bugs and request features

### Official Documentation
- **[Documentation Site](https://objectui.com/docs)** - Full documentation and guides
- **[Schema Reference](/docs/core)** - Detailed schema documentation

## Next Steps

Ready to build with Phase 2? Here's what to do next:

1. **[Review schema documentation](/docs/core)** - Learn about each schema in detail
2. **[Try the Quick Start](https://github.com/objectstack-ai/objectui/blob/main/PHASE2_QUICK_START.md)** - Build your first Phase 2 application
3. **[Explore examples](https://github.com/objectstack-ai/objectui/blob/main/packages/types/src/__tests__/phase2-schemas.test.ts)** - See real-world usage patterns
4. **[Join the community](https://github.com/objectstack-ai/objectui/discussions)** - Connect with other developers
