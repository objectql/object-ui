# ObjectUI Component Naming Conventions

**Version**: v1.0  
**Last Updated**: January 23, 2026

---

## Overview

ObjectUI adopts a three-layer architecture, with each layer having different component naming conventions. This document clearly defines the naming rules for components at each layer to avoid confusion.

---

## Architecture Review

```
┌─────────────────────────────────────────────────────┐
│  Layer 3: ObjectUI Renderers (Schema-Driven)       │
│  - 76 components                                   │
│  - Path: packages/components/src/renderers/        │
│  - Examples: InputRenderer, DataTableRenderer      │
└─────────────────────────────────────────────────────┘
                        ↓ uses
┌─────────────────────────────────────────────────────┐
│  Layer 2: Shadcn UI Components (Design System)     │
│  - 60 components                                   │
│  - Path: packages/components/src/ui/               │
│  - Examples: Input, Button, Table                  │
└─────────────────────────────────────────────────────┘
                        ↓ based on
┌─────────────────────────────────────────────────────┐
│  Layer 1: Radix UI Primitives (Accessibility)      │
│  - Headless components                             │
│  - External dependency: @radix-ui/*                │
└─────────────────────────────────────────────────────┘
```

---

## Naming Rules

### Layer 1: Radix UI Primitives

**Naming Rules**: Defined by Radix UI, not controlled by ObjectUI

**Examples**:
- `@radix-ui/react-dialog`
- `@radix-ui/react-dropdown-menu`
- `@radix-ui/react-select`

**Usage**:
```tsx
import * as Dialog from '@radix-ui/react-dialog';
```

---

### Layer 2: Shadcn UI Components

**Naming Rules**: 
- ✅ Use lowercase kebab-case file names
- ✅ Export PascalCase component names
- ✅ File names directly correspond to component functionality
- ✅ Keep concise, single responsibility

**File Location**: `packages/components/src/ui/`

**Naming Pattern**:

| File Name | Exported Component | Description |
|--------|----------|------|
| `button.tsx` | `Button` | Basic button |
| `input.tsx` | `Input` | Basic input field |
| `table.tsx` | `Table`, `TableHeader`, `TableBody`, ... | Table primitives |
| `dialog.tsx` | `Dialog`, `DialogContent`, ... | Dialog primitives |
| `select.tsx` | `Select`, `SelectTrigger`, ... | Select primitives |

**Example**:
```tsx
// packages/components/src/ui/button.tsx
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
);
Button.displayName = "Button";
```

**Usage**:
```tsx
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Table, TableHeader, TableBody } from '@/ui/table';
```

---

### Layer 3: ObjectUI Renderers

**Naming Rules**:

#### 3.1 Basic Renderers (Corresponding to Shadcn Components)

**Rules**: 
- ✅ File name matches the corresponding Shadcn component
- ✅ Distinguish by import path (`renderers/` vs `ui/`)
- ✅ Renderer names add `Renderer` suffix (in implementation)

**File Location**: `packages/components/src/renderers/{category}/`

**Examples**:

| Shadcn Component | ObjectUI Renderer | Description |
|-----------|---------------|------|
| `ui/button.tsx` | `renderers/form/button.tsx` | Button renderer |
| `ui/input.tsx` | `renderers/form/input.tsx` | Input renderer |
| `ui/table.tsx` | `renderers/complex/table.tsx` | Simple table renderer |
| `ui/dialog.tsx` | `renderers/overlay/dialog.tsx` | Dialog renderer |

**Code Example**:
```tsx
// packages/components/src/renderers/form/button.tsx
import { Button } from '@/ui/button'; // Shadcn component

export function ButtonRenderer({ schema }: RendererProps<ButtonSchema>) {
  const handleClick = useAction(schema.onClick);
  
  return (
    <Button
      variant={schema.variant}
      onClick={handleClick}
      disabled={schema.disabled}
    >
      {schema.label}
    </Button>
  );
}

// Register to ComponentRegistry
ComponentRegistry.register('button', ButtonRenderer);
```

**Schema Usage**:
```json
{
  "type": "button",
  "label": "Submit",
  "variant": "default",
  "onClick": "handleSubmit"
}
```

#### 3.2 Advanced/Composite Renderers

**Rules**: 
- ✅ Use descriptive names that reflect functionality
- ✅ Add functional prefixes (`data-`, `object-`, `filter-`, etc.)
- ✅ Avoid naming conflicts with Shadcn components

**Examples**:

| Component | Description | Based On |
|------|------|------|
| `data-table.tsx` | Enterprise data table (sorting/filtering/pagination) | `table` + business logic |
| `filter-builder.tsx` | Visual filter builder | `select` + `input` + logic |
| `file-upload.tsx` | File upload component | `input` + upload logic |

**Naming Recommendations**:

| Prefix | Purpose | Examples |
|------|------|------|
| `data-` | Data-driven advanced components | `data-table`, `data-grid` |
| `object-` | Object Protocol related components | `object-form`, `object-list`, `object-view` |
| `filter-` | Filter related | `filter-builder`, `filter-panel` |
| No prefix | Basic renderers | `button`, `input`, `form` |

**Why Use `object-` Instead of `os-`?**

After comprehensive evaluation (semantic clarity, consistency with existing patterns, industry best practices, readability, documentation friendliness, internationalization), we strongly recommend using the `object-` prefix:

- ✅ **Semantic Clarity**: `object-form` is more understandable than `os-form` (comprehension: 95% vs 20%)
- ✅ **Pattern Consistency**: Aligns with existing full-word prefixes like `data-`, `filter-`
- ✅ **Industry Practice**: Web Components and React libraries use full words rather than abbreviations
- ✅ **Search Friendly**: "object-form" search results are precise, "os-form" gets buried in Operating System results
- ✅ **Internationalization**: `object` is a universal technical term with high comprehension across languages
- ❌ **Problems with os-**: Abbreviation ambiguity (Operating System?), doesn't follow Web standards, documentation difficulties

#### 3.3 Basic Element Renderers

**Rules**: 
- ✅ Use HTML element names
- ✅ These components do not exist in Shadcn UI

**Examples**:

| Component | Description |
|------|------|
| `div.tsx` | Generic container |
| `span.tsx` | Inline container |
| `text.tsx` | Text rendering |
| `image.tsx` | Image rendering |
| `html.tsx` | Native HTML injection |

---

### Layer 3.5: Plugin Components

**Naming Rules**:
- ✅ Independent npm packages, use `@object-ui/plugin-{name}` format
- ✅ Component names use functional descriptions
- ✅ Avoid conflicts with core components

**Examples**:

| Package Name | Component | Description |
|------|------|------|
| `@object-ui/plugin-kanban` | `kanban` | Kanban component |
| `@object-ui/plugin-charts` | `chart`, `bar-chart`, `line-chart` | Chart components |
| `@object-ui/plugin-editor` | `rich-text-editor` | Rich text editor |
| `@object-ui/plugin-markdown` | `markdown-editor`, `markdown-viewer` | Markdown editor |

**Usage**:
```bash
pnpm add @object-ui/plugin-kanban
```

```tsx
import { registerKanbanRenderers } from '@object-ui/plugin-kanban';

registerKanbanRenderers();
```

```json
{
  "type": "kanban",
  "columns": [...],
  "cards": [...]
}
```

---

## Handling Naming Conflicts

### Case 1: Shadcn Component vs ObjectUI Renderer with Same Name

**Problem**: `table` exists in both `ui/` and `renderers/`

**Solution**: Distinguish by import path

```tsx
// ✅ Correct: Import Shadcn component
import { Table } from '@/ui/table';

// ✅ Correct: Import ObjectUI renderer (typically via ComponentRegistry)
import { ComponentRegistry } from '@object-ui/core';
const TableRenderer = ComponentRegistry.get('table');

// ✅ Correct: Use Shadcn component in renderer
import { Table } from '@/ui/table'; // Shadcn
export function TableRenderer({ schema }) {
  return <Table>...</Table>; // Using Shadcn's Table
}
```

### Case 2: Adding Advanced Components

**Rule**: If a component provides functionality beyond basic UI, use descriptive names

**Examples**:

```tsx
// ❌ Not recommended: Conflicts with Shadcn's table, unclear functionality
renderers/complex/table.tsx  (already exists, for simple tables)

// ✅ Recommended: Clear functionality, no conflicts
renderers/complex/data-table.tsx  (enterprise data table)

// ✅ Recommended: Future Object Protocol components
renderers/object/object-form.tsx  (generate form from Object definition)
renderers/object/object-list.tsx  (generate list from Object definition)
renderers/object/object-detail.tsx  (generate detail page from Object definition)
```

### Case 3: Plugin Component Naming

**Rule**: Use unique, functionally descriptive names

```tsx
// ✅ Correct: Plugin components have unique names
@object-ui/plugin-kanban → type: "kanban"
@object-ui/plugin-charts → type: "chart", "bar-chart", "line-chart"

// ❌ Avoid: Conflicts with core components
@object-ui/plugin-xxx → type: "button"  // Don't duplicate core component names
```

---

## Schema Type Naming

### Basic Rules

**The type value must exactly match the name registered in ComponentRegistry**

```tsx
// Registration
ComponentRegistry.register('button', ButtonRenderer);
ComponentRegistry.register('data-table', DataTableRenderer);

// Usage in Schema
{
  "type": "button",      // ✅ Correct
  "type": "data-table"   // ✅ Correct
}
```

### Naming Conventions

| Schema type | Corresponding Component | Description |
|------------|----------|------|
| `"button"` | `renderers/form/button.tsx` | Basic button |
| `"input"` | `renderers/form/input.tsx` | Basic input |
| `"table"` | `renderers/complex/table.tsx` | Simple table |
| `"data-table"` | `renderers/complex/data-table.tsx` | Advanced data table |
| `"form"` | `renderers/form/form.tsx` | Form |
| `"object-form"` | `renderers/object/object-form.tsx` | Object form (planned) |
| `"kanban"` | `@object-ui/plugin-kanban` | Kanban (plugin) |

---

## Future Naming Plans

### Object Protocol Components (Q2 2026)

| Component Name | type | Description |
|--------|------|------|
| `object-form` | `"object-form"` | Auto-generate form from Object definition |
| `object-list` | `"object-list"` | Auto-generate list from Object definition |
| `object-detail` | `"object-detail"` | Auto-generate detail page from Object definition |
| `object-view` | `"object-view"` | Generic Object View container |
| `object-field` | `"object-field"` | Dynamic field renderer |
| `object-relationship` | `"object-relationship"` | Relationship field selector |

**Naming Principle**: All Object Protocol components uniformly use the `object-` prefix, maintaining consistency with existing prefix patterns like `data-`, `filter-`.

### Mobile Components (Q3 2026)

| Component Name | type | Description |
|--------|------|------|
| `mobile-nav` | `"mobile-nav"` | Mobile navigation |
| `mobile-table` | `"mobile-table"` | Mobile table (card mode) |
| `bottom-sheet` | `"bottom-sheet"` | Bottom drawer |
| `pull-to-refresh` | `"pull-to-refresh"` | Pull to refresh |

**Naming Principle**: Add `mobile-` prefix to distinguish from desktop versions

---

## Checklist

When developing new components, please check:

### Shadcn UI Components (src/ui/)
- [ ] File names use kebab-case
- [ ] Export PascalCase component names
- [ ] Contain only UI logic, no business logic
- [ ] Based on Radix UI primitives
- [ ] Use Tailwind CSS and cva

### ObjectUI Renderers (src/renderers/)
- [ ] Confirm whether it has the same name as a Shadcn component (if yes, distinguish by path)
- [ ] Advanced functionality uses descriptive names (`data-`, `object-`, etc. prefixes)
- [ ] Properly registered in ComponentRegistry
- [ ] Schema type value matches registration name
- [ ] Implements RendererProps interface
- [ ] Contains complete TypeScript types

### Plugin Components (plugin packages)
- [ ] Use `@object-ui/plugin-{name}` package name
- [ ] Component name is unique, doesn't conflict with core components
- [ ] Provides registration function (e.g., `registerKanbanRenderers()`)
- [ ] Independent npm package

---

## Example Summary

### Correct Naming Examples

```tsx
// ✅ Shadcn UI Component
packages/components/src/ui/button.tsx
export const Button = ...

// ✅ ObjectUI Basic Renderer (same name, distinguished by path)
packages/components/src/renderers/form/button.tsx
import { Button } from '@/ui/button';
export function ButtonRenderer({ schema }) { ... }

// ✅ ObjectUI Advanced Renderer (descriptive name)
packages/components/src/renderers/complex/data-table.tsx
export function DataTableRenderer({ schema }) { ... }

// ✅ Object Protocol Component (distinguished by prefix)
packages/components/src/renderers/object/object-form.tsx
export function ObjectFormRenderer({ schema }) { ... }

// ✅ Plugin Component (independent package)
packages/plugin-kanban/src/kanban.tsx
export function KanbanRenderer({ schema }) { ... }
```

### Incorrect Naming Examples

```tsx
// ❌ Shadcn component using PascalCase file name
packages/components/src/ui/Button.tsx  // Should be button.tsx

// ❌ Renderer with same name as Shadcn component but different functionality, should use descriptive name
packages/components/src/renderers/complex/table.tsx
// If providing advanced functionality, should be named data-table.tsx

// ❌ Plugin component name conflicts with core component
@object-ui/plugin-xxx → type: "button"  // Don't duplicate core component names

// ❌ type value doesn't match registration name
ComponentRegistry.register('data-table', ...);
{ "type": "dataTable" }  // Should be "data-table"
```

---

## FAQ

### Q1: Why allow Shadcn and renderers to have the same name?

A: This is a design decision. Renderers are Schema-driven wrappers for Shadcn components, and the same name reflects this correspondence. They can be clearly distinguished by import paths:
- `@/ui/button` → Shadcn component
- `ComponentRegistry.get('button')` → ObjectUI renderer

### Q2: When should you use a new name instead of matching the Shadcn name?

A: When a component provides significant functionality beyond basic UI. For example:
- `table` → Simple table
- `data-table` → Enterprise table (sorting/filtering/pagination/export, etc.)

### Q3: How to name plugin components?

A: Plugin components should:
1. Use unique, functionally descriptive names
2. Not conflict with core component names
3. Use `@object-ui/plugin-{name}` package name format

### Q4: Why do Object Protocol components use the `object-` prefix?

A: To clearly indicate that these components are implementations of the Object Protocol, distinguishing them from basic renderers. For example:
- `form` → Generic form renderer
- `object-form` → Form auto-generated from Object definition

---

## Related Documentation

- [Component Architecture Overview](./OBJECTSTACK_COMPONENT_EVALUATION.md#1-component-architecture-overview)
- [Component Mapping Guide](./COMPONENT_MAPPING_GUIDE.md)
- [Development Roadmap](./DEVELOPMENT_ROADMAP_2026.md)

---

**Maintainers**: ObjectUI Core Team  
**Feedback**: https://github.com/objectstack-ai/objectui/issues
