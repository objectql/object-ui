# Installation

This guide covers everything you need to install and configure Object UI in your project.

## Prerequisites

Before installing Object UI, ensure you have:

- **Node.js** 18.0 or higher
- **React** 18.0 or higher
- A package manager: **npm**, **yarn**, or **pnpm**

## Package Overview

Object UI is distributed as several packages:

| Package | Description | Required |
|---------|-------------|----------|
| `@object-ui/core` | Core logic, types, and validation (Zero React dependencies) | Yes |
| `@object-ui/react` | React bindings and SchemaRenderer component | Yes |
| `@object-ui/components` | Standard UI library with Shadcn + Tailwind components | Yes |
| `@object-ui/designer` | Visual schema editor and builder | Optional |

## Basic Installation

To get started, install the core packages:

::: code-group

```bash [npm]
npm install @object-ui/react @object-ui/components
```

```bash [pnpm]
pnpm add @object-ui/react @object-ui/components
```

```bash [yarn]
yarn add @object-ui/react @object-ui/components
```

:::

## Setup Steps

### 1. Install Dependencies

First, install the required packages as shown above.

### 2. Install Peer Dependencies

Object UI requires these peer dependencies:

```bash
npm install react@^18.0.0 react-dom@^18.0.0
```

### 3. Configure Tailwind CSS

Object UI uses Tailwind CSS for styling. Add to your `tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './node_modules/@object-ui/components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### 4. Import Styles

Import Tailwind and Object UI styles in your main CSS file:

```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@import '@object-ui/components/dist/style.css';
```

### 5. Register Components

Register the default components in your app entry point:

```tsx
// src/main.tsx
import { registerDefaultRenderers } from '@object-ui/components'

registerDefaultRenderers()
```

## TypeScript Setup

If you're using TypeScript, Object UI provides full type definitions:

```json
{
  "compilerOptions": {
    "types": ["@object-ui/react", "@object-ui/components"]
  }
}
```

## Framework Integration

### Next.js

For Next.js 13+ with App Router:

```tsx
// app/providers.tsx
'use client'

import { useEffect } from 'react'
import { registerDefaultRenderers } from '@object-ui/components'

export function Providers({ children }) {
  useEffect(() => {
    registerDefaultRenderers()
  }, [])
  
  return <>{children}</>
}
```

### Vite

Vite works out of the box. Just ensure you have the Tailwind config.

### Create React App

Create React App requires no special configuration.

## Optional Packages

### Protocol Types

For TypeScript type definitions:

```bash
npm install @object-ui/core
```

```typescript
import type { PageSchema, FormSchema } from '@object-ui/core'
```

### Designer

For visual schema editing:

```bash
npm install @object-ui/designer
```

## Verification

Verify your installation with this test:

```tsx
import { SchemaRenderer } from '@object-ui/react'

const testSchema = {
  type: "text",
  value: "Hello from Object UI!"
}

function App() {
  return <SchemaRenderer schema={testSchema} />
}
```

If you see "Hello from Object UI!" rendered, you're all set! ✅

## Troubleshooting

### Styles Not Loading

Make sure you:
1. Added Object UI to Tailwind content paths
2. Imported the CSS file
3. Imported Tailwind directives

### Components Not Rendering

Check that you:
1. Called `registerDefaultRenderers()`
2. Installed all peer dependencies
3. Used the correct schema format

### TypeScript Errors

Ensure you:
1. Installed type packages
2. Added types to `tsconfig.json`
3. Updated TypeScript to version 5.0+

## Development Setup

For contributing or local development:

```bash
# Clone the repository
git clone https://github.com/objectql/objectui.git
cd objectui

# Install dependencies
pnpm install

# Start development
pnpm dev
```

## Next Steps

- [Quick Start](/guide/quick-start) - Build your first app
- [Schema Rendering](/guide/schema-rendering) - Learn core concepts
- [Component Registry](/guide/component-registry) - Understand components

## Getting Help

Having trouble? We're here to help:

- 📖 [Documentation](/)
- 💬 [GitHub Discussions](https://github.com/objectql/objectui/discussions)
- 🐛 [Report Issues](https://github.com/objectql/objectui/issues)
- 📧 [Email](mailto:hello@objectui.org)
