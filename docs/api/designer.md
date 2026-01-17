# Designer API

The `@object-ui/designer` package provides a visual drag-and-drop editor for creating Object UI schemas.

## Installation

```bash
npm install @object-ui/designer @object-ui/react @object-ui/components
```

## Features

### ✅ Visual Editor

```tsx
import { Designer } from '@object-ui/designer'

function App() {
  const [schema, setSchema] = useState(null)
  
  return (
    <Designer
      initialSchema={schema}
      onSchemaChange={setSchema}
    />
  )
}
```

### ✅ Component Palette

Drag components from the categorized palette to the canvas. Includes:
- Basic components (text, button, link, image)
- Form inputs (input, textarea, select, checkbox, radio, date picker)
- Layout components (container, grid, flex, tabs, card)
- Data display (table, list, badge)
- Feedback components (alert, toast, dialog)

### ✅ Property Editor

Edit component properties visually with a dynamic form in the sidebar panel.

### ✅ Real-time Preview

See your changes instantly with live preview in the canvas.

### ✅ Drag and Drop

- Drag components from palette to canvas
- Reorder components within the canvas
- Visual feedback during drag operations

### ✅ JSON Import/Export

- Export schema as JSON
- Import schema from JSON
- Copy schema to clipboard

## Components

### Designer

The main designer component that includes all functionality.

```tsx
<Designer
  initialSchema={schema}
  onSchemaChange={handleChange}
/>
```

**Props:**
- `initialSchema?: SchemaNode` - Initial schema to load
- `onSchemaChange?: (schema: SchemaNode) => void` - Callback when schema changes

### Custom Layout

Use individual components for custom layouts:

```tsx
import { 
  DesignerProvider,
  Canvas,
  ComponentPalette,
  PropertyPanel,
  Toolbar
} from '@object-ui/designer'

function CustomDesigner() {
  return (
    <DesignerProvider>
      <div className="flex flex-col h-screen">
        <Toolbar />
        <div className="flex flex-1">
          <ComponentPalette className="w-64" />
          <Canvas className="flex-1" />
          <PropertyPanel className="w-80" />
        </div>
      </div>
    </DesignerProvider>
  )
}
```

## API Reference

### useDesigner Hook

Access designer state and methods:

```tsx
import { useDesigner } from '@object-ui/designer'

function CustomComponent() {
  const {
    schema,
    setSchema,
    selectedNodeId,
    setSelectedNodeId,
    updateNode,
    addNode,
    deleteNode,
    moveNode
  } = useDesigner()
  
  // Use designer state
}
```

### Context API

```typescript
interface DesignerContextValue {
  schema: SchemaNode
  setSchema: (schema: SchemaNode) => void
  selectedNodeId: string | null
  setSelectedNodeId: (id: string | null) => void
  hoveredNodeId: string | null
  setHoveredNodeId: (id: string | null) => void
  updateNode: (id: string, updates: Partial<SchemaNode>) => void
  addNode: (parentId: string | null, node: SchemaNode, index?: number) => void
  deleteNode: (id: string) => void
  moveNode: (nodeId: string, targetParentId: string | null, targetIndex: number) => void
}
```

## Examples

See [examples/designer-demo](https://github.com/objectstack-ai/objectui/tree/main/examples/designer-demo) for a complete working example.
