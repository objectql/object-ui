# Object UI

<div align="center">

**The Modular Interface Engine for the Enterprise.**

A high-performance, schema-driven UI system built on **React 18**, **Tailwind CSS**, and **Shadcn UI**.

[![CI](https://github.com/objectql/object-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/objectql/object-ui/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[Documentation](https://objectui.org) · [Playground](https://object-ui.org/playground) · [Report Bug](https://github.com/objectql/object-ui/issues)

</div>

---

## 📖 Introduction

**Object UI** is a collection of libraries designed to transform data objects into intelligent user interfaces. It is the official presentation layer of the **ObjectQL** ecosystem, working in harmony with [ObjectQL](https://github.com/objectql/objectql) and [ObjectOS](https://github.com/objectql/objectos).

Unlike monolithic low-code frameworks, Object UI is built as a **modular ecosystem** under the `@object-ui` scope. You can use the core engine, the component library, or the visual designer independently or together.

## 📦 Ecosystem & Packages

Object UI is organized into several distinct packages, each serving a specific purpose:

| Package | NPM Name | Description |
| --- | --- | --- |
| **Core** | [`@object-ui/core`](./packages/core) | **The Brain.** Schema definitions, renderer registry, and logic. No UI dependencies. |
| **React** | [`@object-ui/react`](./packages/react) | **The Glue.** React context, hooks, and the main `<SchemaRenderer />` component. |
| **Components** | [`@object-ui/components`](./packages/components) | **The Look.** A set of high-quality UI renderers built with Tailwind CSS & Shadcn. |
| **Designer** | [`@object-ui/designer`](./packages/designer) | **The Tool.** A drag-and-drop visual editor to generate Object UI schemas. |

## 🏗 Architecture

The architecture is designed for **maximum flexibility** and **zero bloat**.

```mermaid
graph TD
    A[JSON Schema] -->|Parses| B(@object-ui/core)
    B -->|Provides Context| C(@object-ui/react)
    C -->|Renders| D(@object-ui/components)
    D -->|Uses| E[Tailwind CSS]
    D -->|Uses| F[Shadcn/Radix UI]

```

* **Decoupled Logic:** The `core` package handles schema validation and logic, meaning you could theoretically write a Vue or Svelte adapter in the future.
* **Tailwind Native:** Styles are not hardcoded. Override anything using utility classes in your schema.
* **Tree-Shakable:** If you only use the `Input` and `Button` components, your bundle won't include the heavy `DataGrid`.

## 🚀 Quick Start

To use Object UI in your React project, install the core and component packages.

### 1. Installation

```bash
npm install @object-ui/react @object-ui/components
# or
yarn add @object-ui/react @object-ui/components

```

### 2. Basic Usage

Define a schema and render it using the `SchemaRenderer`.

```tsx
import React from 'react';
import { SchemaRenderer } from '@object-ui/react';
import { Form, Input, Button } from '@object-ui/components'; // Register default components

// 1. Register the components you want to use (or register all globally)
import { registerRenderers } from '@object-ui/core';
registerRenderers({ 
  'form': Form, 
  'input': Input, 
  'button': Button 
});

// 2. Define your Schema
const schema = {
  type: "form",
  className: "space-y-4 p-6 border rounded-lg",
  body: [
    {
      type: "input",
      name: "username",
      label: "Username",
      required: true
    },
    {
      type: "button",
      label: "Submit",
      level: "primary"
    }
  ]
};

// 3. Render
export default function App() {
  return <SchemaRenderer schema={schema} />;
}

```

## 🛠 Developing

This project is a Monorepo managed by **TurboRepo** and **pnpm**.

### Prerequisites

* Node.js 18+
* pnpm 8+

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/objectql/object-ui.git

# 2. Install dependencies
pnpm install

# 3. Start the development playground
pnpm dev

```

### Testing

We use **Vitest** for testing. All tests are located in `__tests__` directories within each package.

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with UI
pnpm test:ui

# Generate coverage report
pnpm test:coverage

```

### Building

```bash
# Build all packages
pnpm build

# Lint all packages
pnpm lint

```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License.
