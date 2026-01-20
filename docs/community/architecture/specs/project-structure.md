---
title: "Project Structure"
---

This document defines the current directory structure of Object UI, designed for clarity and AI-driven development.

## 1. Top-Level Structure (Monorepo)

We use a standard Monorepo structure managed by `pnpm`.

```
/
├── examples/               # Example applications
│   ├── prototype/         # Main prototype/demo app
│   └── designer-demo/     # Designer demonstration
├── packages/              # Shared libraries
│   ├── core/             # Core logic, types, and validation (Zero React)
│   ├── react/            # React bindings and SchemaRenderer
│   ├── components/       # Standard UI components (Shadcn + Tailwind)
│   └── designer/         # Visual schema editor
├── docs/                 # Documentation site (VitePress)
│   ├── .vitepress/       # VitePress configuration
│   ├── guide/            # User guides
│   ├── api/              # API documentation
│   ├── protocol/         # Protocol specifications
│   └── spec/             # Technical specifications
└── .github/              # GitHub workflows and configurations
```

## 2. Package Responsibilities

### `@object-ui/core`
**Goal**: The "Brain" - Core logic with zero React dependencies.
**Tech**: Pure TypeScript + Zod + Lodash

**Contents**:
- `src/types/` - TypeScript type definitions (schemas, components)
- `src/registry/` - Component registry system
- `src/data-scope/` - Data scope and expression evaluation
- `src/validators/` - Zod validation schemas

**Key Principle**: This package can run in Node.js or any JavaScript environment.

### `@object-ui/react`
**Goal**: The "Glue" - React bindings and renderer.
**Tech**: React 18+ with Hooks

**Structure**:
```
src/
├── SchemaRenderer.tsx      # Main renderer component
├── hooks/                  # React hooks
│   ├── useRenderer.ts
│   ├── useDataScope.ts
│   └── useRegistry.ts
└── context/               # React Context providers
    ├── RendererContext.tsx
    └── DataScopeContext.tsx
```

### `@object-ui/components`
**Goal**: The "Body" - Standard UI implementation.
**Tech**: Shadcn UI + Radix UI + Tailwind CSS

**Structure**:
```
src/
├── ui/                    # Base Shadcn components
│   ├── button.tsx
│   ├── input.tsx
│   ├── select.tsx
│   └── ...
├── renderers/            # Object UI component renderers
│   ├── basic/           # Basic components
│   ├── form/            # Form components
│   ├── layout/          # Layout components
│   └── data-display/    # Data display components
└── index.ts             # Public exports
```

### `@object-ui/designer`
**Goal**: The "Tool" - Visual schema editor.
**Tech**: React + Drag-and-Drop

**Contents**:
- `src/Designer.tsx` - Main designer component
- `src/Canvas.tsx` - Visual editing canvas
- `src/ComponentPalette.tsx` - Component library browser
- `src/PropertyPanel.tsx` - Property editor
- `src/Toolbar.tsx` - Actions toolbar
- `src/context/` - Designer state management

## 3. Development Workflow

### Adding a New Component

When implementing a new component:

1. **Define Types** in `packages/core/src/types/`
   ```typescript
   export interface MyComponentSchema extends BaseSchema {
     type: 'my-component'
     // ... component-specific properties
   }
   ```

2. **Create UI Component** in `packages/components/src/ui/` (if needed)
   ```tsx
   // Base Shadcn component
   export function MyComponent({ ... }) { ... }
   ```

3. **Create Renderer** in `packages/components/src/renderers/`
   ```tsx
   export function MyComponentRenderer({ schema, ...props }) {
     return <MyComponent {...props} {...schema} />
   }
   ```

4. **Register** in `packages/components/src/index.ts`
   ```typescript
   registry.register('my-component', MyComponentRenderer)
   ```

### Package Dependencies

```
designer
   ↓
components ──→ react ──→ core
   ↓                        ↓
ui components         types & logic
```

**Dependency Rules**:
- `core`: NO dependencies on React or any UI framework
- `react`: Depends on `core`, peer depends on React
- `components`: Depends on `core` + `react` + Shadcn/Radix
- `designer`: Depends on `components`

## 4. File Naming Conventions

- **Components**: PascalCase with `.tsx` extension (e.g., `Button.tsx`)
- **Hooks**: camelCase starting with `use` (e.g., `useRenderer.ts`)
- **Types**: PascalCase with `.ts` extension (e.g., `Schema.ts`)
- **Utilities**: camelCase with `.ts` extension (e.g., `registry.ts`)

## 5. Import Aliases

When working within the monorepo, use workspace protocol:

```typescript
// In packages/react
import { BaseSchema } from '@object-ui/core'

// In packages/components
import { SchemaRenderer } from '@object-ui/react'
import type { ButtonSchema } from '@object-ui/core'
```
