# Next-Gen Low-Code Engine Architecture Blueprint

This document outlines the technical architecture for Steedos Object UI, designed as a modern, lightweight, and extensible low-code engine. It reimagines the concepts from established frameworks (like Amis) using the latest frontend standards.

## 1. Core Philosophy

*   **Tailwind Native**: Styling is strictly defined via utility classes, enabling "copy-paste" customization and zero-runtime CSS costs.
*   **Headless Base**: UI logic is decoupled from styles using Headless UI / Radix primitives, wrapped in Shadcn-like composition.
*   **Tree-Shakable**: Unlike monolithic engines, this architecture allows importing only the necessary components, minimizing bundle size.
*   **React Standard**: Fully embraces React 18+ paradigms (Hooks, Suspense, potentially RSC) instead of custom state management layers.

## 2. Technology Stack

### A. Foundation
*   **Framework**: **React 18+**
    *   Utilize Hooks for logic reuse.
    *   Prepare for React Server Components (RSC) for initial render performance.
*   **Language**: **TypeScript** (Strict mode)

### B. Styling & UI
*   **Styling Engine**: **Tailwind CSS**
    *   Core utility-first CSS framework.
    *   Eliminates legacy BEM/LESS/SASS workflows.
*   **Component Base**: **Shadcn/UI** (built on Radix UI)
    *   Acceessible, unstyled primitives handling complex interactions (Dialogs, Popovers, Tabs).
    *   The implementation serves as the concrete "UI Kit" mapped to JSON nodes.
*   **Icons**: **Lucide React** (Standard for Shadcn).

### C. State & Data
*   **App State**: **Zustand** or **Jotai**
    *   Atomic, lightweight state management replacing Redux/MobX.
*   **Form Logic**: **React Hook Form**
    *   Headless form validation and state.
    *   High performance via uncontrolled components.
*   **Data Fetching**: **TanStack Query (React Query)**
    *   Manages server state, caching, polling, and synchronization.

## 3. Core Engine Mechanics

### 3.1 The SchemaRenderer

The heart of the engine is the `SchemaRenderer` component, which recursively transforms JSON nodes into React components.

```tsx
// Concept Signature
interface SchemaRendererProps {
  schema: SchemaNode;
  data: Record<string, any>; // Context data
}
```

### 3.2 Component Registry & Mapping
A central registry maps JSON `type` strings to React components.

*   `{ type: "input-text" }` -> `<Input />` (Shadcn wrapper)
*   `{ type: "select" }` -> `<Select />` (Shadcn wrapper)
*   `{ type: "card" }` -> `<Card />` (Shadcn wrapper)

### 3.3 Data Scope Chain (The "Prototype" Model)
To support nested scopes (e.g., a List row having access to its parent Form data), we implement a Data Scope Chain.

*   **Implementation**: A custom React Context `DataContext` that holds the current scope.
*   **Lookups**: When a component requests variable `${name}`, the engine looks up the value in the current scope. If not found, it traverses up the chain (similar to JavaScript prototypes).

### 3.4 Expression Engine
Dynamic logic is handled via string expressions in the JSON schema.

*   **Syntax**: `${data.user.isAdmin}` or `${items[0]}`.
*   **Engine**: Lightweight implementation (e.g., restricted `lodash/template` or a simple AST parser) to evaluate expressions against the Data Scope.

## 4. Architecture Layers

```
Layer 1: @object-ui/core (The Foundation)
  - Type definitions for schemas and components
  - Core logic with zero React dependencies
  - Validation Logic (Zod)
  - Component Registry
  - Data Scope and Expression Evaluation

Layer 2: @object-ui/react (The Glue)
  - React bindings and hooks
  - SchemaRenderer component
  - Context providers
  - React-specific state management

Layer 3: @object-ui/components (The Look)
  - Shadcn/UI primitives
  - Tailwind Configuration
  - Component Renderers
  - Standard UI implementations

Layer 4: @object-ui/designer (The Tool)
  - Visual Schema Editor
  - Drag-and-Drop Interface
  - Property Editing
```

## 5. Advantages over Traditional Engines

| Feature | Traditional (e.g., Amis/ExtJS) | Next-Gen Object UI |
| :--- | :--- | :--- |
| **Styling** | Custom CSS / Bootstrap | **Tailwind CSS** (Standard, Utility-first) |
| **Logic** | Heavy custom lifecycle | **React Hooks** (Standard, Composable) |
| **Size** | Monolithic, Large | **Modular, Tree-shakable** |
| **Extensibility** | Proprietary Plugins | **Standard React Components** |
| **Maintainability**| Specialized knowledge req. | **Standard React ecosystem skills** |
