# ObjectUI Examples

This directory contains example projects demonstrating different ways to build with ObjectUI.

## 🎨 Interactive Showcase

The **Showcase** is the best place to start. It includes 60+ component examples organized by category.

```bash
# Clone the repository
git clone https://github.com/objectstack-ai/objectui.git
cd objectui

# Install and build
pnpm install && pnpm build

# Run the showcase
pnpm showcase
```

Opens at: `http://localhost:3000`

**Features:**
- ✨ 60+ component examples across 8 categories
- 📱 Responsive layouts (mobile, tablet, desktop)
- 🎨 Light/Dark theme support
- 🔍 Live schema inspection
- 📋 Copy-paste ready JSON examples

[**View Showcase Code →**](./showcase)

---

## 🚀 Pure JSON Applications

These projects run directly with the ObjectUI CLI. No React code required.

### Dashboard Example

A single-file application demonstrating layouts and components.

```bash
# From repository root
pnpm dev

# Or with CLI
objectui dev examples/dashboard/index.json
```

**Features:**
- Grid layouts
- Stats cards
- Charts and metrics
- Responsive design

[**View Code →**](./dashboard)

### CRM Application

A multi-page enterprise application with routing.

```bash
# From repository root
pnpm dev:crm

# Or with CLI
objectui dev examples/crm-app/app.json
```

**Features:**
- File-system routing
- Dynamic routes (`[id]`)
- Nested folders
- Master-detail views
- Form handling

[**View Code →**](./crm-app)

---

## 🧩 Component Demos

### Object View Demo

Demonstrates the object view component with different layouts.

```bash
objectui dev examples/object-view-demo
```

**Features:**
- Object display patterns
- Field grouping
- Layout variations
- Responsive views

[**View Code →**](./object-view-demo)

### Designer Modes

Shows different designer modes and configuration options.

```bash
objectui dev examples/designer-modes
```

**Features:**
- Visual designer integration
- Different editing modes
- Configuration examples

[**View Code →**](./designer-modes)

---

## 🛠 Framework Integration

For developers who want to integrate ObjectUI into existing React projects.

### React Integration (Coming Soon)

Vite + React + Tailwind setup showing how to import `<SchemaRenderer>` into an existing codebase.

**Will demonstrate:**
- Installing ObjectUI in an existing React app
- Configuring Tailwind CSS
- Registering renderers
- Mixing ObjectUI with custom React components
- Custom data sources

---

## Running Examples

### Using the CLI

The fastest way to run examples:

```bash
# Install CLI globally
npm install -g @object-ui/cli

# Run any example
objectui dev examples/dashboard/index.json
objectui dev examples/crm-app/app.json
```

### From Repository

If you've cloned the repository:

```bash
# Install dependencies
pnpm install

# Build packages
pnpm build

# Run specific example
pnpm dev              # Dashboard
pnpm dev:crm          # CRM App
pnpm showcase         # Showcase
```

---

## Creating Your Own Example

### 1. Single-File App

Create an `app.json` file:

```json
{
  "type": "page",
  "title": "My App",
  "body": {
    "type": "container",
    "body": [
      {
        "type": "text",
        "value": "Hello ObjectUI!"
      }
    ]
  }
}
```

Run it:
```bash
objectui dev app.json
```

### 2. Multi-Page App

Create a folder structure:

```
my-app/
├── app.json          # App configuration
└── pages/
    ├── index.json    # Home page
    ├── about.json    # About page
    └── users/
        ├── index.json   # Users list
        └── [id].json    # User detail (dynamic route)
```

Run it:
```bash
objectui dev my-app
```

---

## Learning Path

We recommend exploring examples in this order:

1. **[Showcase](./showcase)** - See all components in action
2. **[Dashboard](./dashboard)** - Simple single-file app
3. **[CRM App](./crm-app)** - Multi-page application with routing
4. **[Object View Demo](./object-view-demo)** - Specific component patterns
5. **[Designer Modes](./designer-modes)** - Visual designer features

---

## Documentation

- 📖 [Quick Start Guide](/docs/guide/quick-start.md)
- 🧩 [Component Reference](/docs/components/)
- 📚 [Protocol Specifications](/docs/reference/protocol/overview.md)
- 🏗️ [Architecture](/docs/architecture/architecture.md)

---

## Need Help?

- 💬 [GitHub Discussions](https://github.com/objectstack-ai/objectui/discussions)
- 🐛 [Report Issues](https://github.com/objectstack-ai/objectui/issues)
- 📖 [Documentation](https://objectui.org)

