# Object UI

<div align="center">

![Object UI Logo](./docs/public/logo.svg)

**The Universal Schema-Driven UI Engine**

*From JSON to world-class UI in minutes*

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18+-61dafb.svg)](https://reactjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0+-38bdf8.svg)](https://tailwindcss.com/)

[**Documentation**](https://www.objectui.org) | [**Quick Start**](#quick-start) | [**Examples**](#examples) | [**Studio**](https://www.objectui.org/studio/)

</div>

---

## What is Object UI?

Object UI is a **modern, lightweight, schema-driven UI engine** that transforms JSON configurations into beautiful, performant React interfaces. Build enterprise-grade applications without writing repetitive UI code.

```json
{
  "type": "form",
  "title": "Contact Us",
  "body": [
    { "type": "input", "name": "email", "label": "Your Email", "required": true },
    { "type": "textarea", "name": "message", "label": "Message" }
  ],
  "actions": [
    { "type": "submit", "label": "Send Message", "level": "primary" }
  ]
}
```

That's it! This JSON creates a complete, accessible, and beautiful form.

## ✨ Features

### 🎨 **Beautiful by Default**
- Professional designs using **Tailwind CSS** and **Shadcn/UI**
- Light/dark theme support
- Fully customizable with utility classes
- WCAG 2.1 AA accessible

### ⚡ **Blazing Fast**
- **3x faster** page loads than traditional low-code platforms
- **6x smaller** bundle sizes (< 50KB vs 300KB+)
- Built on React 18+ with automatic optimizations
- Tree-shakable architecture

### 🚀 **Developer Friendly**
- **TypeScript-first** with complete type definitions
- **Zero learning curve** if you know React
- Works with existing tools and workflows
- Full control - extend or customize anything

### 🛠️ **Production Ready**
- 85%+ test coverage
- Enterprise security built-in
- Comprehensive documentation
- Active development and support

## Why Object UI?

### For You as a Developer

**Stop Writing Repetitive UI Code**
```tsx
// Traditional React: 200+ lines
function UserForm() {
  // ... useState, validation, handlers, JSX
}

// Object UI: 20 lines
const schema = {
  type: "crud",
  api: "/api/users",
  columns: [...]
}
```

**Better Performance, Smaller Bundle**
- Automatic code splitting
- Lazy-loaded components
- Zero runtime CSS overhead
- Optimized for production

**Full Control & Flexibility**
- Mix with existing React code
- Override any component
- Custom themes with Tailwind
- Export to standard React anytime

### vs Other Solutions

| Feature | Object UI | Amis | Formily | Material-UI |
|---------|-----------|------|---------|-------------|
| **Tailwind Native** | ✅ | ❌ | ❌ | ❌ |
| **Bundle Size** | 50KB | 300KB+ | 200KB+ | 500KB+ |
| **TypeScript** | ✅ Full | Partial | ✅ Full | ✅ Full |
| **Tree Shakable** | ✅ | ❌ | ⚠️ Partial | ⚠️ Partial |
| **Server Components** | ✅ | ❌ | ❌ | ⚠️ Coming |
| **Visual Designer** | ✅ | ✅ | ❌ | ❌ |

## Quick Start

### Installation

```bash
# Using npm
npm install @object-ui/react @object-ui/components

# Using yarn
yarn add @object-ui/react @object-ui/components

# Using pnpm
pnpm add @object-ui/react @object-ui/components
```

### Basic Usage

```tsx
import React from 'react'
import { SchemaRenderer } from '@object-ui/react'
import { registerDefaultRenderers } from '@object-ui/components'

// Register default components once
registerDefaultRenderers()

const schema = {
  type: "page",
  title: "Dashboard",
  body: {
    type: "grid",
    columns: 3,
    items: [
      { type: "card", title: "Total Users", value: "${stats.users}" },
      { type: "card", title: "Revenue", value: "${stats.revenue}" },
      { type: "card", title: "Orders", value: "${stats.orders}" }
    ]
  }
}

function App() {
  const data = {
    stats: { users: 1234, revenue: "$56,789", orders: 432 }
  }
  
  return <SchemaRenderer schema={schema} data={data} />
}

export default App
```

### Try the Visual Studio

Explore our interactive drag-and-drop designer:

🚀 [**Launch Object UI Studio**](https://www.objectui.org/studio/) - Design visually, export JSON instantly.

## 📦 Packages

Object UI is a modular monorepo with packages designed for specific use cases:

| Package | Description | Size |
|---------|-------------|------|
| **[@object-ui/types](./packages/types)** | TypeScript definitions and protocol specs | 10KB |
| **[@object-ui/core](./packages/core)** | Core logic, validation, registry (Zero React) | 20KB |
| **[@object-ui/react](./packages/react)** | React bindings and `SchemaRenderer` | 15KB |
| **[@object-ui/components](./packages/components)** | Standard UI components (Tailwind + Shadcn) | 50KB |
| **[@object-ui/designer](./packages/designer)** | Visual drag-and-drop schema editor | 80KB |

**Plugins** (lazy-loaded):
- `@object-ui/plugin-charts` - Chart components (Chart.js)
- `@object-ui/plugin-editor` - Rich text editor components

## 📚 Documentation

### Getting Started
- [Introduction](./docs/guide/introduction.md) - Learn what Object UI is and why it exists
- [Quick Start](./docs/guide/quick-start.md) - Build your first app in 5 minutes
- [Installation](./docs/guide/installation.md) - Detailed setup instructions
- [Visual Studio](./docs/guide/studio.md) - Use the drag-and-drop designer

### Core Concepts
- [Schema Rendering](./docs/spec/schema-rendering.md) - Understand the rendering system
- [Architecture](./docs/spec/architecture.md) - Technical architecture overview
- [Component System](./docs/spec/component.md) - How components work

### Protocol Specifications
- [Protocol Overview](./docs/protocol/overview.md) - Complete protocol reference
- [Form Protocol](./docs/protocol/form.md) - Form schema specification
- [View Protocol](./docs/protocol/view.md) - Data view specifications
- [Page Protocol](./docs/protocol/page.md) - Page layout specifications

### API Reference
- [Core API](./docs/api/core.md) - `@object-ui/core` API reference
- [React API](./docs/api/react.md) - `@object-ui/react` API reference
- [Components API](./docs/api/components.md) - Component library reference
- [Designer API](./docs/api/designer.md) - Visual designer API

### Advanced
- [Lazy-Loaded Plugins](./docs/lazy-loaded-plugins.md) - Plugin architecture
- [Component Packages](./docs/spec/component-package.md) - Creating custom components

## 🎯 What Can You Build?

Object UI is perfect for:

- ✅ **Admin Panels** - Complete CRUD interfaces in minutes
- ✅ **Dashboards** - Data visualization and analytics
- ✅ **Forms** - Complex multi-step forms with validation
- ✅ **CMS** - Content management systems
- ✅ **Internal Tools** - Business applications
- ✅ **Prototypes** - Rapid UI prototyping

## 🏗️ Examples

Check out complete example applications:

```bash
# Clone the repository
git clone https://github.com/objectql/objectui.git
cd objectui

# Install dependencies
pnpm install

# Run the playground
pnpm playground

# Run the visual designer demo
pnpm designer

# Run the prototype example
pnpm prototype
```

## 🛣️ Roadmap

See our [detailed roadmap](./docs/ROADMAP.md) for upcoming features and release timeline.

**Q1 2026** (Available March 2026):
- ✅ Core schema rendering
- ✅ 20+ production-ready components
- ✅ Expression system
- ✅ Visual designer (beta)

**Q2-Q4 2026**:
- 🔄 Advanced data binding
- 🔄 Real-time collaboration
- 🔄 Mobile components
- 🔄 AI-powered schema generation

## 🤝 Contributing

We welcome contributions! Please read our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/objectql/objectui.git
cd objectui

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build all packages
pnpm build

# Run documentation site
pnpm docs:dev
```

## 📄 License

Object UI is [MIT licensed](./LICENSE).

## 🌟 Community & Support

- ⭐ [Star on GitHub](https://github.com/objectql/objectui) - Show your support!
- 📖 [Documentation](https://www.objectui.org) - Comprehensive guides and API reference
- 💬 [GitHub Discussions](https://github.com/objectql/objectui/discussions) - Ask questions and share ideas
- 🐛 [Report Issues](https://github.com/objectql/objectui/issues) - Found a bug? Let us know
- 📧 [Email Us](mailto:hello@objectui.org) - Get in touch

## 🙏 Acknowledgments

Object UI is inspired by and builds upon ideas from:
- [Amis](https://github.com/baidu/amis) - Schema-driven UI framework
- [Formily](https://github.com/alibaba/formily) - Form solution
- [Shadcn/UI](https://ui.shadcn.com/) - UI component library
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework

---

<div align="center">

**Built with ❤️ by the [ObjectQL Team](https://github.com/objectql)**

[Website](https://www.objectui.org) · [Documentation](https://www.objectui.org) · [GitHub](https://github.com/objectql/objectui)

</div>
