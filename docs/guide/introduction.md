# Introduction

Object UI is a **Universal, Schema-Driven UI Engine** designed for modern enterprise applications.

Unlike other low-code renderers (Amis, Formily), Object UI is built specifically for the **React + Tailwind + Shadcn** ecosystem.

## Core Philosophy

### 1. Protocol Agnostic (The Universal Adapter)
We do not assume you are using any specific backend. 
*   **The Input:** Pure JSON Schema (`@object-ui/types`).
*   **The Data:** Abstract `DataSource` interface.
*   **The Output:** Standard React Components.

### 2. Separation of Concerns (The 5-Layer Model)

Our monorepo structure ensures strict decoupling:

| Layer | Package | Description |
| :--- | :--- | :--- |
| **1. Protocol** | `@object-ui/types` | **Pure JSON Types.** No logic. Zero dependencies. Defines `interface InputSchema`. |
| **2. Engine** | `@object-ui/core` | **Logic Kernel.** State management, Validation, Registry, and Events. |
| **3. Framework** | `@object-ui/react` | **React Bridge.** Hooks like `useRenderer` and Context Providers. |
| **4. Components** | `@object-ui/components` | **Visual Layer.** Impementations using Shadcn UI & Tailwind. |
| **5. Adapters** | `@object-ui/data-*` | **Connectivity.** Connectors for REST, GraphQL, etc. |

### 3. Tailwind First
We believe "Low Code" shouldn't mean "Ugly Code" or "Hard to Style". 
Every component in the schema accepts a standard `className` prop, which is merged using `cn()` (tailwind-merge). You have full control over margins, padding, colors, and layouts directly from the JSON.

## Comparison

| Feature | Object UI | Amis | Formily |
| :--- | :--- | :--- | :--- |
| **Tech Stack** | React + Tailwind | React + Custom CSS | React + Reactive |
| **Styling** | Utility Classes | CSS Classes / Themes | CSS Modules |
| **Bundle Size** | Light (Modular) | Heavy (All-in-one) | Medium |
| **Data Source** | Universal Interface | Built-in Fetcher | Observable State |

## What is Object UI?

Object UI is a schema-driven UI system that transforms JSON descriptions into beautiful, performant React interfaces. Instead of writing component code, you write JSON that describes what you want, and Object UI handles the rendering, styling, and behavior.

### The Core Idea

```json
// You write this
{
  "type": "form",
  "title": "Sign Up",
  "body": [
    { "type": "input", "name": "email", "label": "Email" },
    { "type": "input-password", "name": "password", "label": "Password" }
  ]
}

// Object UI renders a complete, functional form
```

## Why Object UI?

### 1. Build Faster

Stop writing repetitive UI code. A complete CRUD interface that would take days to code can be created in minutes with Object UI.

**Traditional React:**
```tsx
// 200+ lines of code for forms, tables, validation, etc.
```

**Object UI:**
```json
// 20 lines of JSON
{
  "type": "crud",
  "api": "/api/users",
  "columns": [...]
}
```

### 2. Better Performance

Object UI is built on modern technologies with performance in mind:

- **3x faster** page loads than traditional low-code platforms
- **6x smaller** bundle sizes (< 50KB vs 300KB+)
- Automatic code splitting and lazy loading
- Zero runtime CSS overhead with Tailwind

### 3. Easy to Learn

If you know React and JSON, you already know most of Object UI:

- Uses standard React patterns (no custom lifecycle)
- Full TypeScript support with autocomplete
- Works with your existing tools and workflows
- Progressive adoption - use as much or as little as you need

### 4. Full Control

Unlike other low-code platforms, you're never locked in:

- Extend or customize any component
- Export to standard React code anytime
- Mix Object UI with your existing React code
- Override styles with Tailwind classes

## How It Works

Object UI follows a simple three-step process:

### 1. Define Your Schema

Write JSON that describes your UI:

```json
{
  "type": "page",
  "title": "Dashboard",
  "body": {
    "type": "grid",
    "columns": 3,
    "items": [
      { "type": "card", "title": "Users", "value": "${stats.users}" },
      { "type": "card", "title": "Revenue", "value": "${stats.revenue}" }
    ]
  }
}
```

### 2. Render with Object UI

Pass your schema to the renderer:

```tsx
import { SchemaRenderer } from '@object-ui/react'

function App() {
  return <SchemaRenderer schema={mySchema} data={myData} />
}
```

### 3. Get Beautiful UI

Object UI automatically:
- Renders the components
- Applies professional styling
- Handles validation and state
- Manages accessibility
- Optimizes performance

## Architecture

Object UI is built as a modular ecosystem:

```
@object-ui/core       → Core logic, types, and validation (Zero React)
@object-ui/react      → React bindings and SchemaRenderer
@object-ui/components → UI components (Tailwind + Shadcn)
@object-ui/designer   → Visual schema editor
```

This modular design means:
- Use only what you need
- Smaller bundle sizes (tree-shakable)
- Framework-agnostic core (Vue/Svelte adapters possible)
- Independent versioning per package

## What Can You Build?

Object UI is perfect for:

- **Admin Panels**: Complete CRUD interfaces in minutes
- **Dashboards**: Data visualization and analytics
- **Forms**: Complex multi-step forms with validation
- **CMS**: Content management systems
- **Internal Tools**: Business applications
- **Prototypes**: Rapid UI prototyping

## Next Steps

Ready to get started?

- [Quick Start](/guide/quick-start) - Build your first Object UI app
- [Installation](/guide/installation) - Setup instructions
- [Schema Rendering](/guide/schema-rendering) - Learn the core concepts

## Getting Help

- 📖 [Documentation](/) - You're reading it!
- ⭐ [GitHub](https://github.com/objectstack-ai/objectui) - Star us and report issues
- 📧 [Email](mailto:hello@objectui.org) - Get in touch

Let's build something amazing! 🚀
