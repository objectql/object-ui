# Plugin Kanban - Lazy-Loaded Kanban Board

A lazy-loaded kanban board component for Object UI based on @dnd-kit for drag-and-drop functionality.

## Features

- **Internal Lazy Loading**: @dnd-kit libraries are loaded on-demand using `React.lazy()` and `Suspense`
- **Zero Configuration**: Just import the package and use `type: 'kanban'` in your schema
- **Automatic Registration**: Components auto-register with the ComponentRegistry
- **Skeleton Loading**: Shows a skeleton while @dnd-kit loads
- **Drag and Drop**: Full drag-and-drop support for cards between columns
- **Column Limits**: Set maximum card limits per column
- **Customizable**: Badge support, custom styling, and callbacks

## Installation

```bash
pnpm add @object-ui/plugin-kanban
```

## Usage

### Automatic Registration (Side-Effect Import)

```typescript
// In your app entry point (e.g., App.tsx or main.tsx)
import '@object-ui/plugin-kanban';

// Now you can use kanban type in your schemas
const schema = {
  type: 'kanban',
  columns: [
    {
      id: 'todo',
      title: 'To Do',
      cards: [
        { id: '1', title: 'Task 1', description: 'Description' }
      ]
    },
    {
      id: 'done',
      title: 'Done',
      cards: []
    }
  ]
};
```

### Manual Integration

```typescript
import { kanbanComponents } from '@object-ui/plugin-kanban';
import { ComponentRegistry } from '@object-ui/core';

// Manually register if needed
Object.entries(kanbanComponents).forEach(([type, component]) => {
  ComponentRegistry.register(type, component);
});
```

### TypeScript Support

The plugin exports TypeScript types for full type safety:

```typescript
import type { KanbanSchema, KanbanCard, KanbanColumn } from '@object-ui/plugin-kanban';

const card: KanbanCard = {
  id: 'task-1',
  title: 'My Task',
  description: 'Task description',
  badges: [
    { label: 'High Priority', variant: 'destructive' }
  ]
};

const column: KanbanColumn = {
  id: 'todo',
  title: 'To Do',
  cards: [card],
  limit: 5
};

const schema: KanbanSchema = {
  type: 'kanban',
  columns: [column]
};
```

## Schema API

```typescript
{
  type: 'kanban',
  columns?: KanbanColumn[],           // Array of columns
  onCardMove?: (cardId, fromColumnId, toColumnId, newIndex) => void,
  className?: string                  // Tailwind classes
}

// Column structure
interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
  limit?: number;                     // Maximum cards allowed
  className?: string;
}

// Card structure
interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  badges?: Array<{
    label: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  }>;
}
```

## Features

- **Drag and Drop**: Drag cards between columns or reorder within a column
- **Column Limits**: Set maximum card limits and get visual feedback when full
- **Card Badges**: Add colored badges to cards for status/priority
- **Responsive**: Horizontal scrolling for many columns
- **Accessible**: Built on @dnd-kit with keyboard navigation support

## Lazy Loading Architecture

The plugin uses a two-file pattern for optimal code splitting:

1. **`KanbanImpl.tsx`**: Contains the actual @dnd-kit imports (heavy ~100-150 KB)
2. **`index.tsx`**: Entry point with `React.lazy()` wrapper (light)

When bundled, Vite automatically creates separate chunks:
- `index.js` (~200 bytes) - The entry point
- `KanbanImpl-xxx.js` (~100-150 KB) - The lazy-loaded implementation

The @dnd-kit libraries are only downloaded when a `kanban` component is actually rendered, not on initial page load.

## Bundle Size Impact

By using lazy loading, the main application bundle stays lean:
- Without lazy loading: +100-150 KB on initial load
- With lazy loading: +0.19 KB on initial load, +100-150 KB only when kanban is rendered

This results in significantly faster initial page loads for applications that don't use kanban on every page.

## Development

```bash
# Build the plugin
pnpm build

# The package will generate proper ESM and UMD builds with lazy loading preserved
```

## Example with Callbacks

```typescript
const schema = {
  type: 'kanban',
  columns: [...],
  onCardMove: (cardId, fromColumnId, toColumnId, newIndex) => {
    console.log(`Card ${cardId} moved from ${fromColumnId} to ${toColumnId} at index ${newIndex}`);
    // Update your backend or state here
  }
};
```

<!-- release-metadata:v3.3.0 -->

## Compatibility

- **React:** 18.x or 19.x
- **Node.js:** ≥ 18
- **TypeScript:** ≥ 5.0 (strict mode)
- **`@objectstack/spec`:** ^3.3.0
- **`@objectstack/client`:** ^3.3.0
- **Tailwind CSS:** ≥ 3.4 (for packages with UI)

## Links

- 📚 [Documentation](https://www.objectui.org/docs/plugins/plugin-kanban)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/plugin-kanban)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
