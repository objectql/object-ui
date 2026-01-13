# @object-ui/designer

A professional drag-and-drop visual editor to generate Object UI schemas with advanced features.

## Features

### Core Functionality
- **Visual Schema Editor**: Edit Object UI schemas visually with a live preview
- **Drag-and-Drop**: Drag components from the palette to the canvas and reorder them within the canvas
- **Smart Insertion**: Intelligent drop position detection for precise component placement
- **Component Search**: Quickly find components with the built-in search functionality
- **JSON Import/Export**: Import and export schemas as JSON files or clipboard
- **Undo/Redo**: Full history management with keyboard shortcuts
- **Copy/Paste**: Duplicate components easily with Ctrl+C/V

### Visual Design
- **Enhanced Selection**: Clear visual feedback with component type labels
- **Hover Indicators**: Helpful drop zone indicators during drag operations
- **Empty State Guidance**: Helpful instructions when starting a new design
- **Responsive Preview**: Switch between Desktop (1024px), Tablet (768px), and Mobile (375px) views
- **Zoom Controls**: Scale the canvas to fit your workflow

### User Experience
- **Keyboard Shortcuts**: 
  - `Ctrl+Z` / `Cmd+Z`: Undo
  - `Ctrl+Y` / `Cmd+Y` / `Cmd+Shift+Z`: Redo
  - `Ctrl+C` / `Cmd+C`: Copy component
  - `Ctrl+V` / `Cmd+V`: Paste component
  - `Delete` / `Backspace`: Delete component
- **Tooltips**: Contextual help throughout the interface
- **Property Editor**: Configure component properties with a dynamic form
- **Categorized Components**: Organized by Layout, Form, Data Display, Feedback, Overlay, and Navigation

## Installation

```bash
npm install @object-ui/designer @object-ui/renderer @object-ui/ui
# or
yarn add @object-ui/designer @object-ui/renderer @object-ui/ui
# or
pnpm add @object-ui/designer @object-ui/renderer @object-ui/ui
```

## Usage

### Basic Example

```tsx
import { Designer } from '@object-ui/designer';
import { useState } from 'react';
import type { SchemaNode } from '@object-ui/protocol';

function App() {
  const [schema, setSchema] = useState<SchemaNode>({
    type: 'div',
    className: 'p-8',
    body: []
  });
  
  return (
    <Designer 
      initialSchema={schema} 
      onSchemaChange={setSchema}
    />
  );
}
```

### With Initial Schema

```tsx
const initialSchema: SchemaNode = {
  type: 'div',
  className: 'p-8 max-w-4xl mx-auto',
  body: [
    {
      type: 'card',
      title: 'Welcome',
      body: [
        {
          type: 'text',
          content: 'This is a starter template'
        }
      ]
    }
  ]
};

function App() {
  return <Designer initialSchema={initialSchema} />;
}
```

### Custom Layout

You can use individual designer components to create a custom layout:

```tsx
import { 
  DesignerProvider, 
  Canvas, 
  ComponentPalette, 
  PropertyPanel,
  Toolbar 
} from '@object-ui/designer';

function CustomDesigner() {
  return (
    <DesignerProvider>
      <div className="flex flex-col h-screen">
        <Toolbar />
        <div className="flex-1 flex">
          <ComponentPalette className="w-64" />
          <Canvas className="flex-1" />
          <PropertyPanel className="w-80" />
        </div>
      </div>
    </DesignerProvider>
  );
}
```

## Keyboard Shortcuts

The designer supports the following keyboard shortcuts for efficient workflow:

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+Z` / `Cmd+Z` | Undo | Undo the last change |
| `Ctrl+Y` / `Cmd+Y` | Redo | Redo the last undone change |
| `Cmd+Shift+Z` | Redo (Mac) | Alternative redo on macOS |
| `Ctrl+C` / `Cmd+C` | Copy | Copy the selected component |
| `Ctrl+V` / `Cmd+V` | Paste | Paste the copied component |
| `Delete` / `Backspace` | Delete | Delete the selected component |

**Note**: Copy, paste, and delete shortcuts only work when not editing text in input fields.

## Components

### `<Designer />`

The main designer component that includes all panels and functionality.

**Props:**
- `initialSchema?: SchemaNode` - Initial schema to load
- `onSchemaChange?: (schema: SchemaNode) => void` - Callback when schema changes

### `<DesignerProvider />`

Context provider for designer state.

**Props:**
- `initialSchema?: SchemaNode` - Initial schema
- `onSchemaChange?: (schema: SchemaNode) => void` - Change callback
- `children: ReactNode` - Child components

### `<Canvas />`

The visual editor canvas that renders the schema.

**Props:**
- `className?: string` - Additional CSS classes

### `<ComponentPalette />`

Sidebar showing available components to add.

**Props:**
- `className?: string` - Additional CSS classes

### `<PropertyPanel />`

Right sidebar for editing selected component properties.

**Props:**
- `className?: string` - Additional CSS classes

### `<Toolbar />`

Top toolbar with import/export and other actions.

**Props:**
- `className?: string` - Additional CSS classes

## Hooks

### `useDesigner()`

Access the designer context in custom components.

```tsx
import { useDesigner } from '@object-ui/designer';

function CustomComponent() {
  const { 
    schema, 
    setSchema,
    selectedNodeId,
    setSelectedNodeId,
    updateNode,
    addNode,
    deleteNode
  } = useDesigner();
  
  // Use designer state and methods
}
```

## API

### Context API

```typescript
interface DesignerContextValue {
  schema: SchemaNode;
  setSchema: (schema: SchemaNode) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  hoveredNodeId: string | null;
  setHoveredNodeId: (id: string | null) => void;
  updateNode: (id: string, updates: Partial<SchemaNode>) => void;
  addNode: (parentId: string | null, node: SchemaNode, index?: number) => void;
  deleteNode: (id: string) => void;
  moveNode: (nodeId: string, targetParentId: string | null, targetIndex: number) => void;
}
```

## Styling

The designer uses Tailwind CSS. Make sure to include the designer components in your Tailwind configuration:

```javascript
// tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@object-ui/designer/**/*.{js,ts,jsx,tsx}',
  ],
  // ...
}
```

## Features Roadmap

### Completed ✅
- [x] Drag and drop components from palette
- [x] Drag to reorder components in canvas
- [x] Smart insertion based on drop position
- [x] Undo/redo functionality with history
- [x] Copy/paste components
- [x] Keyboard shortcuts (Ctrl+Z/Y, Ctrl+C/V, Delete)
- [x] Component search in palette
- [x] JSON import/export with file and clipboard support
- [x] Responsive viewport modes (Desktop/Tablet/Mobile)
- [x] Enhanced visual feedback and tooltips
- [x] Zoom controls for canvas

### Planned 🚀
- [ ] Schema validation with error indicators
- [ ] Component tree view for better navigation
- [ ] Copy/duplicate entire schema branches
- [ ] Custom component templates library
- [ ] Export to React/TypeScript code
- [ ] Collaborative editing features
- [ ] Version history and restore points
- [ ] Accessibility checker

## Examples

See the [examples/designer-demo](../../examples/designer-demo) directory for a complete working example.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
