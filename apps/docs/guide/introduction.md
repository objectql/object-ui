# Introduction

Welcome to Object UI! This guide will help you understand what Object UI is, why it exists, and how it can help you build better interfaces faster.

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
@object-ui/protocol  → Type definitions and schemas
@object-ui/engine    → Core logic and state management
@object-ui/ui        → UI components (Tailwind + Shadcn)
@object-ui/renderer  → Schema-to-React transformer
@object-ui/designer  → Visual editor (coming Q3 2026)
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
- [Roadmap](/roadmap) - See what's coming next

## Getting Help

- 📖 [Documentation](/) - You're reading it!
- ⭐ [GitHub](https://github.com/objectql/object-ui) - Star us and report issues
- 📧 [Email](mailto:hello@objectui.org) - Get in touch

Let's build something amazing! 🚀
