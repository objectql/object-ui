# Object UI

  **The Universal, Headless, Schema-Driven Rendering Engine.**
  
  Build complex Enterprise UIs with JSON. Styled with Tailwind CSS & Shadcn UI.

  [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
  [![TypeScript](https://img.shields.io/badge/written%20in-TypeScript-3178C6.svg)](https://www.typescriptlang.org/)
  [![NPM](https://img.shields.io/npm/v/@object-ui/react.svg)](https://www.npmjs.com/package/@object-ui/react)

---

## 🎨 Try It Online

**[Launch Object UI Studio →](https://www.objectui.org/studio/)**

Experience our interactive visual editor with drag-and-drop design, live preview, and instant JSON export. Perfect for prototyping and learning!

---

## 📖 Introduction

**Object UI** is a high-performance rendering engine for React. It transforms **JSON/YAML Schemas** into modern, responsive user interfaces.

Unlike traditional low-code libraries (like Amis or RJSF) that ship with heavy, opinionated CSS, Object UI is **Tailwind-Native**. Every component is built using **Shadcn UI** primitives and utility classes, giving you complete control over the design system.

**Why Object UI?**
* 🎨 **Tailwind Native:** No black-box styles. Override anything with `className`.
* 🔌 **Protocol Agnostic:** Works with **ObjectQL**, any **REST API**, or just **Static JSON**.
* ⚛️ **React First:** Built with React 18, Hooks, and modern Context patterns.
* 📱 **Responsive:** Enterprise-grade layouts (Grid, Kanban, Dashboard) out of the box.

---

## 📦 Installation

Object UI is modular. Install the React core and the standard component set:

```bash
npm install @object-ui/react @object-ui/components
# or
pnpm add @object-ui/react @object-ui/components

```

> **Note:** You also need `tailwindcss` and `lucide-react` installed in your project.

---

## ⚡ Quick Start

### 1. Define your Schema

You can define your UI structure using a simple JSON object.

```tsx
// schema.ts
import { PageSchema } from '@object-ui/types';

export const myPageSchema: PageSchema = {
  type: 'page',
  title: 'User Profile',
  body: [
    {
      type: 'grid',
      columns: 2,
      children: [
        { 
          type: 'input', 
          name: 'first_name', 
          label: 'First Name', 
          required: true 
        },
        { 
          type: 'input', 
          name: 'email', 
          label: 'Email', 
          className: 'bg-slate-50' // Tailwind classes work here!
        }
      ]
    },
    {
      type: 'button',
      label: 'Save Changes',
      level: 'primary',
      actionType: 'submit',
      className: 'mt-4'
    }
  ]
};

```

### 2. Render it!

Use the `<SchemaRenderer />` component to bring it to life.

```tsx
import React from 'react';
import { SchemaRenderer } from '@object-ui/react';
import { standardComponents } from '@object-ui/components';
import { myPageSchema } from './schema';

export default function App() {
  const handleAction = (action, data) => {
    console.log('User clicked:', action, 'Data:', data);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <SchemaRenderer 
        schema={myPageSchema} 
        components={standardComponents}
        onAction={handleAction}
      />
    </div>
  );
}

```

---

## 🔌 Universal Data Source (Protocol Agnostic)

Object UI is not tied to any specific backend. You can use it with **any** data source.

### Option A: Static / Uncontrolled

Use it as a pure controlled component for forms.

```tsx
<SchemaRenderer 
  schema={formSchema}
  value={formData}
  onChange={setFormData}
/>

```

### Option B: Generic REST API

Connect to any API using a `DataSource` adapter.

```tsx
import { RestDataSource } from '@object-ui/data-rest';

const api = new RestDataSource({
  baseUrl: '[https://api.example.com/v1](https://api.example.com/v1)',
  headers: { Authorization: 'Bearer ...' }
});

<SchemaRenderer 
  schema={pageSchema}
  dataSource={api} // The components will fetch data automatically
/>

```

### Option C: ObjectQL (The Perfect Match)

If you use **ObjectQL**, Object UI provides zero-config integration.

```tsx
import { ObjectQLDataSource } from '@object-ui/data-objectql';

<SchemaRenderer 
  schema={pageSchema}
  dataSource={new ObjectQLDataSource()} 
/>

```

---

## 🧩 Architecture

This project is organized as a Monorepo:

| Package | Description |
| --- | --- |
| **`@object-ui/core`** | Core logic, types, and validation. Zero React dependencies. |
| **`@object-ui/react`** | The React framework adapter with SchemaRenderer. |
| **`@object-ui/components`** | The standard UI library implementation (Shadcn + Tailwind). |
| **`@object-ui/designer`** | Visual schema editor for building UIs without code. |

---

## 🤝 Comparison

| Feature | Object UI | Amis / Lowcode Engine | Formily / RJSF |
| --- | --- | --- | --- |
| **Styling** | **Tailwind Native** (Utility) | Opinionated CSS (Hard to override) | Various (AntD/MUI wrappers) |
| **Scope** | **Full Pages** & Apps | Full Pages & Apps | Mostly Forms |
| **Protocol** | **JSON Schema** | Custom JSON | JSON Schema / Internal |
| **Dependencies** | Light (Radix UI) | Heavy (Bootstrap/JQuery legacy) | Medium |
| **Backend** | **Agnostic** | Tightly coupled (Amis) | Agnostic |

---

## 🛤️ Roadmap

* [ ] **Visual Designer:** Drag-and-drop schema builder.
* [ ] **Plugin Ecosystem:** Support for AG Grid Enterprise, ECharts, and Monaco Editor.
* [ ] **SSR Support:** Full compatibility with Next.js App Router.

## 📄 License

Licensed under the [MIT License](https://www.google.com/search?q=LICENSE).

---

<div align="center">
<sub>Built with ❤️ by the Object Ecosystem Team.</sub>
</div>
