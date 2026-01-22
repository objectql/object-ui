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

[**Documentation**](https://www.objectui.org) | [**Quick Start**](#quick-start) | [**🎨 Showcase**](#-try-the-showcase) | [**Examples**](#examples)

</div>

## 🎨 Try the Showcase

**Explore all components interactively!** The Object UI Showcase demonstrates every component, layout pattern, and feature in an interactive demo.

```bash
# Clone the repository
git clone https://github.com/objectql/objectui.git

cd objectui

# Install and build
pnpm install && pnpm build

# Run the showcase
pnpm showcase
```

**Opens at:** `http://localhost:3000`

**What's included:**
- ✨ 60+ component examples across 8 categories
- 📱 Responsive layouts (mobile, tablet, desktop)
- 🎨 Light/Dark theme support
- 🔍 Live schema inspection
- 📋 Copy-paste ready JSON examples

[**📖 Complete Showcase Guide →**](./docs/guide/showcase.md)

---

## 🚀 Just JSON

No React code required. Run any folder containing an `app.json` or `pages/*.json` file:

```bash
# Run the CRM Example
pnpm dev:crm

# Run the Dashboard Example
pnpm dev:dashboard

# Run any custom folder
pnpm start:app ./my-app-folder
```

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

2.  **Run Examples**

    We have pre-configured commands to run the JSON examples directly from the source.

    *   **Run Dashboard Example:**
        ```bash
        pnpm dev
        # Opens http://localhost:3000
        ```

    *   **Run CRM Example (Routing Demo):**
        ```bash
        pnpm dev:crm
        # Opens http://localhost:3001
        ```

3.  **Edit & Reload**

    Open `examples/dashboard/app.json` or `examples/crm-app/pages/index.json`. 
    Any change you make to the JSON files will be instantly reflected in the browser.

## 📦 For React Developers

Install the core packages to use `<SchemaRenderer>` inside your Next.js or Vite app.

```bash
npm install @object-ui/react @object-ui/components
```

See [React Integration Guide](examples/framework-react) for details.

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

[📖 CLI Documentation](./docs/CLI_GUIDE.md)

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

### Visual Designer

Object UI includes a visual designer package that allows you to build UIs with a drag-and-drop interface. See the `@object-ui/designer` package for more information.

## 📦 Packages

Object UI is a modular monorepo with packages designed for specific use cases:

| Package | Description | Size |
|---------|-------------|------|
| **[@object-ui/cli](./packages/cli)** | CLI tool for building apps from JSON schemas | 25KB |
| **[@object-ui/types](./packages/types)** | TypeScript definitions and protocol specs | 10KB |
| **[@object-ui/core](./packages/core)** | Core logic, validation, registry (Zero React) | 20KB |
| **[@object-ui/react](./packages/react)** | React bindings and `SchemaRenderer` | 15KB |
| **[@object-ui/components](./packages/components)** | Standard UI components (Tailwind + Shadcn) | 50KB |
| **[@object-ui/designer](./packages/designer)** | Visual drag-and-drop schema editor | 80KB |
| **[@object-ui/data-objectql](./packages/data-objectql)** | ObjectQL API adapter for data integration | 15KB |
| **[vscode-extension](./packages/vscode-extension)** | VSCode extension for schema development | 32KB |

**Plugins** (lazy-loaded):
- `@object-ui/plugin-charts` - Chart components (Chart.js)
- `@object-ui/plugin-editor` - Rich text editor components

**Developer Tools**:
- **[VSCode Extension](./packages/vscode-extension)** - IntelliSense, live preview, validation, and snippets for Object UI schemas

## 🔌 Data Integration

Object UI is designed to work with any backend through its universal DataSource interface:

### ObjectQL Integration

```bash
npm install @object-ui/data-objectql
```

```typescript
import { ObjectQLDataSource } from '@object-ui/data-objectql';

const dataSource = new ObjectQLDataSource({
  baseUrl: 'https://api.example.com',
  token: 'your-auth-token'
});

// Use with any component
<SchemaRenderer schema={schema} dataSource={dataSource} />
```

[**ObjectQL Integration Guide →**](./docs/integration/objectql.md)

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

## 📚 Documentation

Visit [**objectui.org**](https://www.objectui.org) for complete documentation.

### Getting Started
- [Quick Start](./docs/guide/quick-start.md) - Build your first app in 5 minutes
- [Installation](./docs/guide/installation.md) - Detailed setup instructions
- [Showcase](./docs/guide/showcase.md) - Interactive component gallery
- [CLI Guide](./docs/guide/cli/getting-started.md) - Using the ObjectUI CLI
- [Visual Studio](./docs/guide/studio.md) - Drag-and-drop designer

### Core Concepts
- [Schema Rendering](./docs/concepts/schema-rendering.md) - How the rendering system works
- [Expressions](./docs/concepts/expressions.md) - Dynamic values and conditions
- [Data Sources](./docs/concepts/data-source.md) - Connecting to APIs
- [Component Registry](./docs/concepts/component-registry.md) - Registering custom components
- [Plugins](./docs/concepts/plugins.md) - Extending ObjectUI

### Components & Plugins
- [Component Library](./docs/components/) - Browse all available components
- [Charts Plugin](./docs/plugins/plugin-charts.mdx) - Chart components
- [Kanban Plugin](./docs/plugins/plugin-kanban.mdx) - Kanban boards

### API Reference
- [Core API](./docs/reference/api/core.md) - `@object-ui/core` API
- [React API](./docs/reference/api/react.md) - `@object-ui/react` API
- [Components API](./docs/reference/api/components.md) - Component library API
- [Designer API](./docs/reference/api/designer.md) - Visual designer API

### Protocol Specifications
- [Protocol Overview](./docs/reference/protocol/overview.md) - Complete protocol reference
- [Page Protocol](./docs/reference/protocol/page.md) - Page schema specification
- [Form Protocol](./docs/reference/protocol/form.md) - Form schema specification
- [View Protocol](./docs/reference/protocol/view.md) - Data view specifications
- [CRUD Protocol](./docs/reference/protocol/crud.md) - CRUD operations

### Architecture & Advanced
- [Architecture](./docs/architecture/architecture.md) - System architecture overview
- [Project Structure](./docs/architecture/project-structure.md) - Code organization
- [Component System](./docs/architecture/component.md) - How components work
- [Rendering Specification](./docs/architecture/rendering-specification.md) - Technical rendering spec

### Ecosystem & Integration
- [ObjectQL Integration](./docs/ecosystem/objectql.md) - Connect to ObjectQL backends
- [API Integration](./docs/ecosystem/api.md) - REST API integration
- [Deployment](./docs/ecosystem/deployment/showcase-deployment.md) - Deploy to production

### Support & Resources
- [FAQ](./docs/faq.md) - Frequently asked questions
- [Troubleshooting](./docs/troubleshooting/index.md) - Common issues and solutions
- [Security](./docs/security.md) - Security best practices
- [Migration Guide](./docs/migration/from-objectstack.md) - Migrating from ObjectStack
- [Examples](./docs/examples.md) - Learn from real-world examples

## 🎯 What Can You Build?

Object UI is perfect for:

- ✅ **Admin Panels** - Complete CRUD interfaces in minutes
- ✅ **Dashboards** - Data visualization and analytics
- ✅ **Forms** - Complex multi-step forms with validation
- ✅ **CMS** - Content management systems
- ✅ **Internal Tools** - Business applications
- ✅ **Prototypes** - Rapid UI prototyping

## 🏗️ Examples

### JSON Schema Examples (Recommended) 🚀

Explore ready-to-use JSON examples that showcase Object UI's capabilities:

```bash
# Install CLI
npm install -g @object-ui/cli

# Try different examples
objectui serve examples/basic-form/app.json       # Contact form
objectui serve examples/dashboard/app.json        # Analytics dashboard
objectui serve examples/data-display/app.json     # Data visualization
objectui serve examples/landing-page/app.json     # Marketing page
```

**Available Examples:**
- 📝 [**Basic Form**](./examples/basic-form) - Contact form with validation
- 📊 [**Dashboard**](./examples/dashboard) - Analytics with metrics and feeds
- 📋 [**Data Display**](./examples/data-display) - Lists, badges, progress bars
- 🚀 [**Landing Page**](./examples/landing-page) - Full marketing page
- 🎨 [**CLI Demo**](./examples/cli-demo) - Bilingual form demo

[**View All Examples →**](./examples)

### Full Application Examples

```bash
# Clone the repository
git clone https://github.com/objectstack-ai/objectui.git
cd objectui

# Install dependencies
pnpm install

# Run the prototype example
pnpm prototype

# Run the visual designer demo
pnpm designer
```

## 🛣️ Roadmap

See our [detailed roadmap](./docs/community/roadmap.md) for upcoming features and release timeline.

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
- 🏗️ [Architecture](./docs/architecture/architecture.md) - Technical architecture
- 📚 [Best Practices](./docs/community/best-practices.md) - Code quality guidelines

### Development Setup

```bash
# Clone the repository
git clone https://github.com/objectstack-ai/objectui.git
cd objectui

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run the showcase
pnpm showcase

# Run tests
pnpm test

# Run documentation site
pnpm docs:dev
```

## 📄 License

Object UI is [MIT licensed](./LICENSE).

## 🌟 Community & Support

- ⭐ [Star on GitHub](https://github.com/objectstack-ai/objectui) - Show your support!
- 📖 [Documentation](https://www.objectui.org) - Comprehensive guides and API reference
- 💬 [GitHub Discussions](https://github.com/objectstack-ai/objectui/discussions) - Ask questions and share ideas
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
