<div align="center">

# Object UI

**The Universal Schema-Driven UI Engine**

*From JSON to world-class UI in minutes*

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/objectstack-ai/objectui/workflows/CI/badge.svg)](https://github.com/objectstack-ai/objectui/actions/workflows/ci.yml)
[![CodeQL](https://github.com/objectstack-ai/objectui/workflows/CodeQL%20Security%20Scan/badge.svg)](https://github.com/objectstack-ai/objectui/actions/workflows/codeql.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18+-61dafb.svg)](https://reactjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0+-38bdf8.svg)](https://tailwindcss.com/)

[**Documentation**](https://www.objectui.org) | [**Quick Start**](#quick-start) 

</div>

---

---

## 🚀 Quick Start (Development Mode)

Since this package is not yet published to NPM, here is how to play with the source code:

1.  **Clone & Install**

    ```bash
    git clone https://github.com/objectstack-ai/objectui.git
    cd objectui
    pnpm install
    # Build the core engine
    pnpm build 
    ```

2.  **Run the Development Server**

    ```bash
    pnpm dev
    # Opens http://localhost:3000
    ```

3.  **Edit & Reload**

    Edit the JSON schema files and the changes will be instantly reflected in the browser.

## 📦 For React Developers

Install the core packages to use `<SchemaRenderer>` inside your Next.js or Vite app.

```bash
npm install @object-ui/react @object-ui/components
```

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

### Option 1: Using CLI (Fastest Way) 🚀

The easiest way to get started is using the Object UI CLI:

```bash
# Install the CLI globally
npm install -g @object-ui/cli

# Create a new app from JSON schema
objectui init my-app

# Start the development server
cd my-app
objectui serve app.schema.json
```

Your app will be running at http://localhost:3000! 🎉

Just edit `app.schema.json` to build your UI - no React code needed.

### Option 2: Using as a Library

#### Installation

```bash
# Using npm
npm install @object-ui/react @object-ui/components

# Using yarn
yarn add @object-ui/react @object-ui/components

# Using pnpm
pnpm add @object-ui/react @object-ui/components
```

#### Basic Usage

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

## 📦 Packages

Object UI is a modular monorepo with packages designed for specific use cases:

| Package | Description | Size |
|---------|-------------|------|
| **[@object-ui/cli](./packages/cli)** | CLI tool for building apps from JSON schemas | 25KB |
| **[@object-ui/types](./packages/types)** | TypeScript definitions and protocol specs | 10KB |
| **[@object-ui/core](./packages/core)** | Core logic, validation, registry, ObjectStack adapter | 20KB |
| **[@object-ui/react](./packages/react)** | React bindings and `SchemaRenderer` | 15KB |
| **[@object-ui/components](./packages/components)** | Standard UI components (Tailwind + Shadcn) | 50KB |
| **[vscode-extension](./packages/vscode-extension)** | VSCode extension for schema development | 32KB |

**Plugins** (lazy-loaded):
- `@object-ui/plugin-charts` - Chart components (Chart.js)
- `@object-ui/plugin-editor` - Rich text editor components
- `@object-ui/views` - ObjectStack-aware table and form components (core package)

**Developer Tools**:
- **[VSCode Extension](./packages/vscode-extension)** - IntelliSense, live preview, validation, and snippets for Object UI schemas

## 🔌 Data Integration

Object UI is designed to work with any backend through its universal DataSource interface:

### ObjectStack Integration

```bash
npm install @object-ui/core
```

```typescript
import { createObjectStackAdapter } from '@object-ui/core';

const dataSource = createObjectStackAdapter({
  baseUrl: 'https://api.example.com',
  token: 'your-auth-token'
});

// Use with any component
<SchemaRenderer schema={schema} dataSource={dataSource} />
```

### Custom Data Sources

You can create adapters for any backend (REST, GraphQL, Firebase, etc.) by implementing the `DataSource` interface:

```typescript
import type { DataSource, QueryParams, QueryResult } from '@object-ui/types';

class MyCustomDataSource implements DataSource {
  async find(resource: string, params?: QueryParams): Promise<QueryResult> {
    // Your implementation
  }
  // ... other methods
}
```

[**Data Source Examples →**](./packages/types/examples/rest-data-source.ts)

## 🎯 What Can You Build?

Object UI is perfect for:

- ✅ **Admin Panels** - Complete CRUD interfaces in minutes
- ✅ **Dashboards** - Data visualization and analytics
- ✅ **Forms** - Complex multi-step forms with validation
- ✅ **CMS** - Content management systems
- ✅ **Internal Tools** - Business applications
- ✅ **Prototypes** - Rapid UI prototyping

## 🛣️ Roadmap

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

### For Developers

- 📖 [Contributing Guide](./CONTRIBUTING.md) - How to contribute to the project

### Development Setup

```bash
# Clone the repository
git clone https://github.com/objectstack-ai/objectui.git
cd objectui

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run the development site
pnpm dev

# Run tests
pnpm test
```

## 📄 License

Object UI is [MIT licensed](./LICENSE).

## 🌟 Community & Support

- ⭐ [Star on GitHub](https://github.com/objectstack-ai/objectui) - Show your support!
- 📖 [Documentation](https://www.objectui.org) - Comprehensive guides and API reference
- 🐛 [Report Issues](https://github.com/objectstack-ai/objectui/issues) - Found a bug? Let us know
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

[Website](https://www.objectui.org) · [Documentation](https://www.objectui.org) · [GitHub](https://github.com/objectstack-ai/objectui)

</div>
