# ObjectUI Quick Start Guide

**Build Enterprise-Grade Frontend Interfaces in 5 Minutes**

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Three Usage Methods](#three-usage-methods)
3. [Core Concepts](#core-concepts)
4. [Common Scenarios](#common-scenarios)
5. [FAQ](#faq)

---

## Quick Start

### Prerequisites

- Node.js 20+ 
- PNPM 9+ (recommended) or NPM/Yarn

### Method 1: Using CLI (Fastest) ⚡

```bash
# 1. Install CLI globally
npm install -g @object-ui/cli

# 2. Create new project
objectui init my-app

# 3. Navigate to project directory
cd my-app

# 4. Start development server
objectui serve app.schema.json

# Visit http://localhost:3000
```

**That's it!** You now have a running enterprise-grade frontend interface.

---

### Method 2: Integration with Existing React Projects

```bash
# 1. Install core packages
npm install @object-ui/react @object-ui/components @object-ui/fields

# 2. Install data adapter (optional)
npm install @object-ui/data-objectstack

# 3. Install plugins as needed
npm install @object-ui/plugin-grid @object-ui/plugin-charts
```

**Configure Tailwind CSS:**

```javascript
// tailwind.config.js
export default {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './node_modules/@object-ui/components/**/*.{js,jsx}'
  ],
  theme: { extend: {} },
  plugins: []
};
```

**Use in your application:**

```tsx
// App.tsx
import { SchemaRenderer } from '@object-ui/react';
import { registerDefaultRenderers } from '@object-ui/components';
import { registerField } from '@object-ui/fields';

// Register components
registerDefaultRenderers();

// Register fields as needed (reduce bundle size)
registerField('text');
registerField('number');
registerField('email');

const schema = {
  type: 'page',
  title: 'User Management',
  body: {
    type: 'crud',
    api: '/api/users',
    columns: [
      { name: 'name', label: 'Name', type: 'text' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'role', label: 'Role', type: 'select', 
        options: ['admin', 'user', 'guest'] }
    ]
  }
};

function App() {
  return <SchemaRenderer schema={schema} />;
}

export default App;
```

---

### Method 3: From Source Code (Full Control)

```bash
# 1. Clone repository
git clone https://github.com/objectstack-ai/objectui.git
cd objectui

# 2. Install dependencies
pnpm install

# 3. Build all packages
pnpm build

# 4. Start development console
pnpm dev

# Visit http://localhost:5173
```

---

## Three Usage Methods Comparison

| Feature | CLI Method | React Integration | Source Code |
|---------|-----------|-------------------|-------------|
| **Setup Time** | ⚡ 5 minutes | ⏱️ 15 minutes | 🕐 30 minutes |
| **Use Cases** | Quick Prototype<br/>Simple Apps | Production<br/>Existing Projects | Full Customization<br/>Contribution |
| **Learning Curve** | ⭐ Zero Code | ⭐⭐ React Required | ⭐⭐⭐ Deep Understanding |
| **Flexibility** | ⭐⭐ Limited | ⭐⭐⭐ High | ⭐⭐⭐⭐⭐ Full Control |
| **Bundle Optimization** | ⭐⭐ Automatic | ⭐⭐⭐⭐ Controllable | ⭐⭐⭐⭐⭐ Fully Optimized |
| **Recommended For** | Learning<br/>Internal Tools | Enterprise Apps<br/>Production | Deep Customization<br/>Open Source |

---

## Core Concepts

### 1. Schema (Configuration)

ObjectUI uses **JSON Schema** to describe interfaces. Schema is a declarative configuration object.

**Simplest Schema:**

```json
{
  "type": "text",
  "content": "Hello World"
}
```

**Schema with Data Binding:**

```json
{
  "type": "text",
  "content": "User Count: ${stats.users}"
}
```

### 2. Component Types

ObjectUI provides **40+ components** in 7 categories:

```
📦 Layout Components
   ├─ page, card, grid, flex, stack, tabs
   
📝 Form Components
   ├─ input, select, checkbox, radio, switch, slider
   
📊 Data Display
   ├─ table, list, badge, avatar, chart
   
💬 Feedback Components
   ├─ toast, alert, progress, skeleton
   
🎭 Overlays
   ├─ dialog, sheet, drawer, popover, tooltip
   
🧭 Navigation Components
   ├─ breadcrumb, pagination, menu
   
🔌 Advanced Plugins
   ├─ crud, kanban, calendar, gantt, dashboard
```

### 3. Data Binding

Use `${}` expressions to bind data:

```json
{
  "type": "card",
  "title": "${user.name}",
  "description": "Email: ${user.email}",
  "visible": "${user.isActive}"
}
```

### 4. Action System

Handle user interactions:

```json
{
  "type": "button",
  "label": "Save",
  "onClick": {
    "type": "ajax",
    "api": "/api/users",
    "method": "POST",
    "data": "${formData}",
    "onSuccess": {
      "type": "toast",
      "message": "Saved successfully!"
    }
  }
}
```

---

## Common Scenarios

### Scenario 1: Data List (CRUD)

```json
{
  "type": "crud",
  "title": "User Management",
  "api": "/api/users",
  "columns": [
    { "name": "id", "label": "ID", "type": "text" },
    { "name": "name", "label": "Name", "type": "text" },
    { "name": "email", "label": "Email", "type": "email" },
    { "name": "role", "label": "Role", "type": "select",
      "options": ["admin", "user", "guest"] },
    { "name": "status", "label": "Status", "type": "badge" }
  ],
  "actions": [
    { "label": "Create", "type": "create", "icon": "plus" },
    { "label": "Edit", "type": "update", "icon": "edit" },
    { "label": "Delete", "type": "delete", "icon": "trash",
      "confirm": "Are you sure you want to delete?" }
  ],
  "pagination": { "pageSize": 20 },
  "searchable": true,
  "exportable": true
}
```

---

### Scenario 2: Dashboard

```json
{
  "type": "dashboard",
  "title": "Operations Dashboard",
  "widgets": [
    {
      "type": "card",
      "title": "Total Users",
      "value": "${stats.totalUsers}",
      "icon": "users",
      "trend": { "value": 12.5, "direction": "up" }
    },
    {
      "type": "card",
      "title": "Monthly Revenue",
      "value": "${formatCurrency(stats.revenue)}",
      "icon": "dollar-sign",
      "trend": { "value": 8.3, "direction": "up" }
    },
    {
      "type": "chart",
      "title": "Sales Trend",
      "chartType": "line",
      "dataSource": { "api": "/api/stats/sales" },
      "xField": "date",
      "yField": "amount"
    },
    {
      "type": "grid",
      "title": "Recent Orders",
      "dataSource": { "api": "/api/orders/recent" },
      "columns": [
        { "field": "orderNo", "label": "Order No" },
        { "field": "customer", "label": "Customer" },
        { "field": "amount", "label": "Amount", "type": "currency" }
      ]
    }
  ]
}
```

---

### Scenario 3: Multi-Step Form

```json
{
  "type": "form",
  "title": "User Registration",
  "steps": [
    {
      "title": "Basic Information",
      "fields": [
        { "name": "name", "label": "Name", "type": "text", "required": true },
        { "name": "email", "label": "Email", "type": "email", "required": true,
          "validation": { "type": "email", "unique": true } },
        { "name": "phone", "label": "Phone", "type": "phone" }
      ]
    },
    {
      "title": "Account Information",
      "fields": [
        { "name": "username", "label": "Username", "type": "text", "required": true },
        { "name": "password", "label": "Password", "type": "password", "required": true,
          "validation": { "minLength": 8 } },
        { "name": "confirmPassword", "label": "Confirm Password", "type": "password",
          "validation": { "match": "password" } }
      ]
    },
    {
      "title": "Complete",
      "fields": [
        { "name": "terms", "label": "I agree to the terms of service", "type": "checkbox", "required": true }
      ]
    }
  ],
  "onSubmit": {
    "type": "ajax",
    "api": "/api/register",
    "method": "POST",
    "data": "${formData}",
    "onSuccess": {
      "type": "redirect",
      "url": "/dashboard"
    }
  }
}
```

---

### Scenario 4: Kanban (Project Management)

```json
{
  "type": "kanban",
  "title": "Project Task Board",
  "dataSource": { "api": "/api/tasks" },
  "groupByField": "status",
  "columns": [
    { "id": "todo", "title": "To Do", "color": "gray" },
    { "id": "in_progress", "title": "In Progress", "color": "blue" },
    { "id": "review", "title": "In Review", "color": "yellow" },
    { "id": "done", "title": "Done", "color": "green" }
  ],
  "cardTemplate": {
    "title": "${task.title}",
    "description": "${task.description}",
    "avatar": "${task.assignee.avatar}",
    "tags": "${task.tags}",
    "priority": "${task.priority}"
  },
  "onCardMove": {
    "type": "ajax",
    "api": "/api/tasks/${card.id}/move",
    "method": "PATCH",
    "data": { "status": "${targetColumn}" }
  }
}
```

---

### Scenario 5: Data Visualization Charts

```json
{
  "type": "page",
  "title": "Sales Analysis",
  "body": {
    "type": "grid",
    "columns": 2,
    "items": [
      {
        "type": "chart",
        "chartType": "area",
        "title": "Sales Trend",
        "dataSource": { "api": "/api/stats/sales-trend" },
        "xField": "date",
        "yField": "amount",
        "smooth": true
      },
      {
        "type": "chart",
        "chartType": "pie",
        "title": "Product Distribution",
        "dataSource": { "api": "/api/stats/products" },
        "nameField": "product",
        "valueField": "count"
      },
      {
        "type": "chart",
        "chartType": "bar",
        "title": "Regional Comparison",
        "dataSource": { "api": "/api/stats/regions" },
        "xField": "region",
        "yField": "sales"
      },
      {
        "type": "chart",
        "chartType": "radar",
        "title": "Performance Radar",
        "dataSource": { "api": "/api/stats/performance" },
        "indicators": ["Sales", "Service", "Quality", "Speed", "Innovation"]
      }
    ]
  }
}
```

---

### Scenario 6: Detail Page

```json
{
  "type": "detail",
  "title": "User Details",
  "dataSource": { "api": "/api/users/${id}" },
  "sections": [
    {
      "title": "Basic Information",
      "fields": [
        { "name": "name", "label": "Name" },
        { "name": "email", "label": "Email" },
        { "name": "phone", "label": "Phone" },
        { "name": "department", "label": "Department" }
      ]
    },
    {
      "title": "Permission Information",
      "fields": [
        { "name": "role", "label": "Role" },
        { "name": "permissions", "label": "Permissions", "type": "tags" },
        { "name": "status", "label": "Status", "type": "badge" }
      ]
    },
    {
      "title": "Statistics",
      "layout": "grid",
      "columns": 3,
      "fields": [
        { "name": "loginCount", "label": "Login Count", "type": "statistic" },
        { "name": "lastLogin", "label": "Last Login", "type": "datetime" },
        { "name": "createdAt", "label": "Created At", "type": "datetime" }
      ]
    }
  ],
  "tabs": [
    {
      "title": "Order History",
      "component": {
        "type": "grid",
        "dataSource": { "api": "/api/users/${id}/orders" },
        "columns": [
          { "field": "orderNo", "label": "Order No" },
          { "field": "amount", "label": "Amount", "type": "currency" },
          { "field": "status", "label": "Status", "type": "badge" }
        ]
      }
    },
    {
      "title": "Activity Log",
      "component": {
        "type": "timeline",
        "dataSource": { "api": "/api/users/${id}/activities" }
      }
    }
  ]
}
```

---

## Advanced Features

### 1. Expression System

ObjectUI supports powerful expression syntax:

```json
{
  "visible": "${user.role === 'admin'}",
  "disabled": "${!user.canEdit}",
  "className": "${item.isActive ? 'text-green-500' : 'text-gray-500'}",
  "value": "${user.firstName + ' ' + user.lastName}",
  "options": "${departments.map(d => ({ label: d.name, value: d.id }))}",
  "total": "${items.reduce((sum, item) => sum + item.price, 0)}"
}
```

### 2. Conditional Rendering

```json
{
  "type": "grid",
  "items": [
    {
      "type": "card",
      "title": "Welcome",
      "visible": "${user.isNewUser}"
    },
    {
      "type": "alert",
      "message": "Please complete your profile",
      "visible": "${!user.profileComplete}",
      "variant": "warning"
    }
  ]
}
```

### 3. Action Chaining

```json
{
  "type": "button",
  "label": "Submit",
  "onClick": {
    "type": "chain",
    "actions": [
      {
        "type": "ajax",
        "api": "/api/validate",
        "method": "POST"
      },
      {
        "type": "ajax",
        "api": "/api/submit",
        "method": "POST",
        "data": "${formData}"
      },
      {
        "type": "toast",
        "message": "Submitted successfully!",
        "variant": "success"
      },
      {
        "type": "redirect",
        "url": "/success"
      }
    ]
  }
}
```

### 4. Permission Control

```json
{
  "type": "crud",
  "api": "/api/users",
  "permissions": {
    "create": "${user.role === 'admin'}",
    "update": "${user.role === 'admin' || record.id === user.id}",
    "delete": "${user.role === 'admin'}",
    "export": "${user.hasPermission('export_users')}"
  },
  "columns": [
    { "name": "salary", "label": "Salary", "type": "currency",
      "visible": "${user.role === 'admin'}" }
  ]
}
```

### 5. Theme Customization

```tsx
import { ThemeProvider } from '@object-ui/react';

const customTheme = {
  mode: 'dark',
  colors: {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444'
  },
  radius: 'lg',
  font: 'system-ui'
};

function App() {
  return (
    <ThemeProvider theme={customTheme}>
      <SchemaRenderer schema={schema} />
    </ThemeProvider>
  );
}
```

---

## Performance Optimization Tips

### 1. Lazy Load Fields (Reduce Bundle by 70%)

```typescript
// ❌ Not recommended - Load all fields
import { registerAllFields } from '@object-ui/fields';
registerAllFields(); // 300KB

// ✅ Recommended - Load on demand
import { registerField } from '@object-ui/fields';
registerField('text');
registerField('number');
registerField('email');
// Only 90KB!
```

### 2. Lazy Load Plugins

```tsx
import { lazy, Suspense } from 'react';

const KanbanView = lazy(() => import('@object-ui/plugin-kanban'));

function KanbanPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SchemaRenderer schema={kanbanSchema} />
    </Suspense>
  );
}
```

### 3. Virtual Scrolling (Large Data Lists)

```json
{
  "type": "grid",
  "dataSource": { "api": "/api/large-dataset" },
  "virtualScroll": true,
  "pageSize": 50
}
```

### 4. API Caching

```typescript
import { createObjectStackAdapter } from '@object-ui/data-objectstack';

const dataSource = createObjectStackAdapter({
  baseUrl: API_URL,
  cache: {
    enabled: true,
    ttl: 300000  // 5 minutes
  }
});
```

---

## FAQ

### Q1: What's the difference between ObjectUI and other Low-Code platforms?

**A:** ObjectUI's core differentiators:
- ✅ **Tailwind Native** - Not a custom styling system
- ✅ **TypeScript Strict Mode** - Complete type safety
- ✅ **Shadcn/UI Design Quality** - Doesn't look "Low-Code"
- ✅ **Bundle Size 6x Smaller** - 50KB vs 300KB+
- ✅ **Fully Open Source MIT** - Can be forked and customized

### Q2: Can it integrate with existing React projects?

**A:** Absolutely! ObjectUI is designed as a React library that can:
- Be used partially in existing projects
- Mix with other React components
- Customize themes and components
- Export to standard React code anytime

### Q3: What data sources are supported?

**A:** ObjectUI supports any backend:
- ✅ REST API
- ✅ GraphQL
- ✅ ObjectQL (ObjectStack)
- ✅ Firebase
- ✅ Custom adapters

### Q4: How to customize components?

**A:** Three approaches:
1. **Override default components**
   ```typescript
   ComponentRegistry.register('button', MyCustomButton);
   ```

2. **Create new components**
   ```typescript
   ComponentRegistry.register('my-widget', MyWidget, {
     namespace: 'custom'
   });
   ```

3. **Use plugin system**
   ```bash
   pnpm create-plugin my-plugin
   ```

### Q5: Is it production-ready?

**A:** ObjectUI is production-ready:
- ✅ 85%+ test coverage
- ✅ TypeScript strict mode
- ✅ Continuous Integration (CI/CD)
- ✅ Security scanning (CodeQL)
- ✅ Active maintenance and support

### Q6: How to handle complex business logic?

**A:** Multiple approaches:
- **Expression System** - Inline simple logic
- **Custom Actions** - Register business logic
- **Mix with React Components** - Use code for complex scenarios
- **Trigger System** - Workflow automation

### Q7: Does it support mobile?

**A:** Supports responsive design:
- ✅ Tailwind responsive classes
- ✅ Touch-friendly components
- ⏳ Dedicated mobile components (in development)

### Q8: How to upgrade versions?

**A:** See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
- Follows semantic versioning
- Provides migration tools
- Detailed upgrade documentation

---

## Learning Resources

### Official Resources
- 📖 [Full Documentation](https://www.objectui.org)
- 💻 [GitHub Repository](https://github.com/objectstack-ai/objectui)
- 🎨 [Storybook Component Showcase](./storybook/)
- 📦 [Example Projects](./examples/)

### Community
- ⭐ [Star on GitHub](https://github.com/objectstack-ai/objectui)
- 🐛 [Report Issues](https://github.com/objectstack-ai/objectui/issues)
- 📧 [Contact Us](mailto:hello@objectui.org)

### Further Reading
- [Architecture Evaluation Report](./ARCHITECTURE_EVALUATION.zh-CN.md)
- [ObjectStack Spec Alignment Analysis](./OBJECTSTACK_SPEC_ALIGNMENT.zh-CN.md)
- [Enterprise Solutions](./OBJECTUI_ENTERPRISE_SOLUTION.md)
- [Contributing Guide](./CONTRIBUTING.md)

---

## Next Steps

Now that you've mastered the basics of ObjectUI, you can:

1. **Try Examples** - Run `pnpm dev` to see examples
2. **Build Your First App** - Use CLI to create a project
3. **Read Full Documentation** - Learn about all features
4. **Join Community** - Get help and share experiences

**Enjoy using ObjectUI!** 🎉

---

**Version:** v1.0  
**Last Updated:** 2026-02-02  
**Maintained by:** ObjectUI Team
