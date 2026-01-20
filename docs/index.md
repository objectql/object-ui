---
title: "You Define the Intent. We Render the Reality."

layout: home

hero:
  name: ObjectUI
  text: Stop Hand-Coding Enterprise UIs
  tagline: A Server-Driven UI Engine that turns JSON into pixel-perfect React + Tailwind + Shadcn components. Build complex dashboards, forms, and data views faster—without sacrificing design quality or flexibility.
  actions:
    - theme: brand
      text: Read the Spec
      link: /reference/protocol/overview
    - theme: alt
      text: View Component Gallery
      link: /reference/components/

features:
  - title: 🎨 The Stack You Love
    details: Built on React, Radix primitives (Shadcn), and native Tailwind CSS. Not a black box—override styles with utility classes. No hidden CSS modules. Just pure, modern frontend tech.
  - title: ⚡️ Server-Driven Agility
    details: Update layouts, fields, and validation rules instantly from your backend—no frontend redeployment needed. Change a form in production? Just update the JSON. The UI adapts in real-time.
  - title: 🏢 Enterprise Ready-Made
    details: Built-in support for complex patterns like Kanbans, Gantt charts, multi-step forms, and data tables with sorting/filtering. Stop rebuilding the same components from scratch.
---

Frontend development for enterprise apps is repetitive. You spend 80% of your time gluing together form libraries, data tables, and validation logic—writing the same boilerplate over and over.

**ObjectUI turns UI into Data.** Define your interface in standard JSON, and let our engine render pixel-perfect, accessible React + Tailwind components.

---

## The Magic Trick: JSON → Beautiful UI

ObjectUI bridges the gap between configuration speed and design quality. Here's how:

### Input: The Protocol (JSON Schema)

You define **what** you want, not **how** to build it. Standard Tailwind classes work natively.

```json
{
  "type": "data-table",
  "className": "rounded-lg border",
  "dataSource": {
    "api": "/api/users",
    "method": "GET"
  },
  "columns": [
    {
      "key": "name",
      "title": "User Name",
      "sortable": true
    },
    {
      "key": "email",
      "title": "Email Address"
    },
    {
      "key": "status",
      "title": "Status",
      "render": "badge"
    }
  ],
  "actions": [
    {
      "label": "Edit",
      "type": "button",
      "variant": "outline",
      "onClick": {
        "action": "navigate",
        "target": "/users/${row.id}/edit"
      }
    }
  ]
}
```

### Output: Production-Ready Shadcn Component

The engine transforms your JSON into a **fully interactive, accessible data table** with:

- ✅ Server-side data fetching
- ✅ Column sorting and filtering
- ✅ Action buttons with dynamic routing
- ✅ Responsive design (mobile-friendly)
- ✅ Light/dark theme support
- ✅ WCAG 2.1 AA accessibility

**All rendered using the same Shadcn UI primitives you'd hand-code**, but configured in seconds instead of hours.

---

## Why ObjectUI?

### 1. The Stack You Love 🎨

ObjectUI is **not a proprietary framework**. It's built on the modern frontend stack you already know and trust:

- **React 18+** with hooks and concurrent rendering
- **Radix UI primitives** (the foundation of Shadcn)
- **Tailwind CSS** for styling—use utility classes directly in your JSON
- **TypeScript-first** with complete type definitions

**You're not locked into a black box.** Every component ObjectUI renders looks and behaves like hand-coded Shadcn UI. You can:

- Override styles using `className` with Tailwind utilities
- Inspect the rendered DOM—it's just clean React + Radix
- Mix ObjectUI with your existing React codebase seamlessly

### 2. Server-Driven Agility ⚡️

In traditional frontend development, changing a form field requires:

1. Editing React code
2. Running tests
3. Building the app
4. Deploying to production

With **Server-Driven UI (SDUI)**, the UI is a **configuration**, not code. ObjectUI separates the **protocol** (what to render) from the **implementation** (how to render it).

**The Benefits:**

- **Instant Updates:** Change layouts, fields, or validation rules from your backend—no frontend redeployment
- **A/B Testing:** Serve different UI schemas to different users dynamically
- **Multi-tenant Apps:** Each client gets a customized interface from the same codebase
- **Backend-Driven Validation:** Form rules defined server-side, enforced client-side automatically

**Example:** Your backend returns a JSON schema. The UI adapts instantly.

```typescript
// Backend returns this JSON
const schema = await fetch('/api/dashboard/schema').then(r => r.json());

// React renders it
<SchemaRenderer schema={schema} />
```

Change the schema on the backend? The dashboard updates in production—**no code push required.**

### 3. Enterprise Ready-Made 🏢

Stop rebuilding the same complex components from scratch. ObjectUI includes production-ready patterns for:

- **📊 Data Tables** with sorting, filtering, pagination, and bulk actions
- **📋 Multi-step Forms** with validation, conditional fields, and auto-save
- **🗂️ Kanban Boards** with drag-and-drop and swimlanes
- **📅 Gantt Charts** for project planning
- **📈 Dashboards** with metrics, charts, and real-time updates
- **🔍 Advanced Filters** with dynamic operators and query builders

All components are:

- **Accessible** (WCAG 2.1 AA compliant)
- **Responsive** (mobile-first design)
- **Themeable** (light/dark mode built-in)
- **Performant** (lazy-loaded, tree-shakable)

---

## How It Works: The Architecture

ObjectUI follows a clean, three-layer architecture:

### Step 1: The Protocol (JSON Schema)

You define the UI structure using a **standard JSON protocol**. This is the **source of truth** for your interface.

```json
{
  "type": "page",
  "title": "User Dashboard",
  "body": {
    "type": "grid",
    "columns": 3,
    "items": [...]
  }
}
```

The protocol is **backend-agnostic**. Serve it from REST, GraphQL, or even static files.

### Step 2: The Engine (@object-ui/core)

The **core engine** processes the schema:

- **Validates** the JSON structure
- **Resolves** expressions like `visible: "${user.role === 'admin'}"`
- **Manages** component state and data flow
- **Registers** custom components

**Zero React dependencies.** The core is pure TypeScript logic—fully testable, fully portable.

### Step 3: The Renderer (@object-ui/react)

The **React runtime** maps JSON nodes to Shadcn components:

```typescript
import { SchemaRenderer } from '@object-ui/react';

<SchemaRenderer schema={schema} data={data} />
```

Under the hood, ObjectUI uses the **component registry** to find the right React component for each schema type (e.g., `"type": "data-table"` → `<DataTable />`).

The rendered output is **indistinguishable** from hand-coded Shadcn UI.

---

## Not Just a Toy: Extensibility

**Worried about being locked in?** Don't be.

ObjectUI is designed for **professional developers** who need flexibility. You can:

### Register Custom React Components

Have a specialized component your design system requires? Register it into the engine and use it in your JSON schemas.

```typescript
import { registerRenderer } from '@object-ui/core';
import { MyCustomWidget } from './components/MyCustomWidget';

// Register your custom component
registerRenderer('custom-widget', MyCustomWidget);
```

Now use it in your schema:

```json
{
  "type": "custom-widget",
  "className": "my-custom-class",
  "props": {
    "customProp": "value"
  }
}
```

**You're not limited to the built-in component set.** ObjectUI is a **rendering engine**, not a walled garden.

### Override Built-in Components

Don't like the default `Button` component? Replace it:

```typescript
import { registerRenderer } from '@object-ui/core';
import { MyCustomButton } from './components/MyCustomButton';

// Override the built-in button
registerRenderer('button', MyCustomButton);
```

All schemas using `"type": "button"` will now render **your** component.

### Mix with Existing React Code

ObjectUI components are **just React components**. Use them alongside your existing codebase:

```tsx
function MyPage() {
  return (
    <div>
      <MyExistingHeader />
      <SchemaRenderer schema={formSchema} />
      <MyExistingFooter />
    </div>
  );
}
```

**No migration required.** Adopt ObjectUI incrementally, one component at a time.

---

## Part of the ObjectStack Ecosystem

ObjectUI is the **official UI renderer** for the ObjectStack ecosystem, but it's **backend-agnostic** and works with any REST API.

### Standalone Usage

Connect ObjectUI to **any backend**:

- REST APIs (with the universal `DataSource` interface)
- GraphQL endpoints
- Firebase, Supabase, or custom backends
- Static JSON files for prototyping

### Perfect Pair with ObjectQL

For an **end-to-end protocol-driven experience**, pair ObjectUI with [**ObjectQL**](https://github.com/objectstack-ai/objectql):

- **ObjectQL** handles your backend: type-safe APIs from YAML schemas
- **ObjectUI** handles your frontend: beautiful UIs from JSON schemas

Together, they enable **full-stack development at configuration speed**—without sacrificing the control and quality of hand-written code.

**Learn more:** [ObjectQL Integration Guide](/integration/objectql)

---

## Ready to Build Faster?

Stop writing repetitive UI code. Start building with ObjectUI.

<div style="display: flex; gap: 1rem; margin-top: 2rem;">
  <a href="/protocol/overview" style="padding: 0.75rem 1.5rem; background: #3b82f6; color: white; border-radius: 0.5rem; text-decoration: none; font-weight: 600;">Read the Spec</a>
  <a href="/components/" style="padding: 0.75rem 1.5rem; border: 1px solid #3b82f6; color: #3b82f6; border-radius: 0.5rem; text-decoration: none; font-weight: 600;">View Component Gallery</a>
  <a href="/guide/quick-start" style="padding: 0.75rem 1.5rem; border: 1px solid #6b7280; color: #6b7280; border-radius: 0.5rem; text-decoration: none; font-weight: 600;">Quick Start →</a>
</div>
