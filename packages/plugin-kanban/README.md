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

Then import the stylesheet this package publishes, after the base sheets. It is a
supplement — compiled against the `@object-ui/components` theme with that sheet's
rules subtracted — so the order matters, and without it the board renders with no
themed styling at all ([#4929](https://github.com/objectstack-ai/objectui/issues/4929)):

```css
/* src/index.css */
@import "tailwindcss";
@import "@object-ui/components/style.css";
@import "@object-ui/fields/style.css";
@import "@object-ui/plugin-kanban/style.css";
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
import type { KanbanCard, KanbanColumn } from '@object-ui/plugin-kanban';
import type { ObjectKanbanSchema } from '@object-ui/types';

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

// ⚠️ `object-kanban`: the bare `kanban` node type key and its `KanbanSchema`
// arm RETIRED in objectui#8802. `groupBy` and one of `bind` / `data` /
// `objectName` are what the surviving face requires of every board.
const schema: ObjectKanbanSchema = {
  type: 'object-kanban',
  groupBy: 'status',
  data: [],
  columns: [column]
};
```

## Schema API

```typescript
import type { ObjectKanbanSchema } from '@object-ui/types';

declare const columns: KanbanColumn[];

// The board document. `type` and `groupBy` are required, and so is ONE record
// source — `bind`, `data` or `objectName`. `columns` and `className` are
// optional.
//
// ⚠️ `onCardMove` is NOT a document key: it is a React prop the host supplies
// (JSON has no function value), which is why it is spelled with explicit
// parameter types below rather than inferred from the annotation. The
// annotation is the type this package's renderer consumes; an unknown key does
// not fail it — `ObjectKanbanSchema` extends `BaseSchema`, whose index
// signature deliberately accepts type-specific extensions, so the compiler is
// not what catches a misspelt board key.
const board: ObjectKanbanSchema = {
  type: 'object-kanban',
  groupBy: 'status',                  // required — the field that makes the lanes
  data: [],                           // one record source is required
  columns,                            // Array of columns
  className: 'h-full',                // Tailwind classes
};

// Supplied by the React host, never authored in JSON:
const onCardMove = (cardId: string, fromColumnId: string, toColumnId: string, newIndex: number) => {
  // see "Example with Callbacks" below
  void [cardId, fromColumnId, toColumnId, newIndex];
};

// Column structure
interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
  limit?: number;                     // WIP limit — the count at which the lane warns
  className?: string;
  collapsed?: boolean;                // Lane renders collapsed (honoured by KanbanEnhanced)
  color?: never;                      // RETIRED — refused by name; style a lane through className
}

// Card structure
interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  badges?: Array<{
    label: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
    colorClass?: string;
    colorStyle?: React.CSSProperties; // Required whenever colorClass came from getBadgeHexAppearance(color) in @object-ui/fields — the class reads CSS custom properties only this style declares (objectui#5183)
  }>;
  cardSubtitle?: string;              // Synthesized subtitle, rendered in preference to description
  cardFieldCells?: Array<{            // Structured per-field cells; wins over cardSubtitle/description
    field: string;
    label?: string;
    node: React.ReactNode;
  }>;
  coverImage?: string;                // Resolved cover-image URL, from the board's coverImageField
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
import type { KanbanColumn } from '@object-ui/plugin-kanban';
import type { ObjectKanbanSchema } from '@object-ui/types';

declare const columns: KanbanColumn[];

const schema: ObjectKanbanSchema = {
  type: 'object-kanban',
  groupBy: 'status',
  data: [],
  columns,
};

// The host supplies the handler as a React prop — JSON has no function value.
const onCardMove = (cardId: string, fromColumnId: string, toColumnId: string, newIndex: number) => {
  console.log(`Card ${cardId} moved from ${fromColumnId} to ${toColumnId} at index ${newIndex}`);
  // Update your backend or state here
};
```

## Links

- 📚 [Documentation](https://www.objectui.org/docs/plugins/plugin-kanban)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/plugin-kanban)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
