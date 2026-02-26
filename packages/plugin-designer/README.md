# @object-ui/plugin-designer

Visual designers for Object UI — page, data model, process, and report designers with collaboration support.

## Features

- 🎨 **Page Designer** - Drag-and-drop page builder with component tree
- 🗄️ **Data Model Designer** - Entity-relationship diagram editor with auto-layout
- ⚙️ **Process Designer** - BPMN-style process flow editor with minimap
- 📝 **Report Designer** - Visual report layout builder with sections
- 🤝 **Collaboration Provider** - Real-time multi-user editing with connection status
- ↩️ **Undo/Redo** - Full undo/redo history via `useUndoRedo`
- 📋 **Clipboard** - Copy/paste support via `useClipboard`
- 🔲 **Multi-Select** - Bulk selection via `useMultiSelect`
- 🔍 **Canvas Pan/Zoom** - Smooth pan and zoom via `useCanvasPanZoom`
- 🗺️ **Minimap** - Overview minimap for large canvases
- 📦 **Auto-registered** - Components register with `ComponentRegistry` on import

## Installation

```bash
npm install @object-ui/plugin-designer
```

**Peer Dependencies:**
- `react` ^18.0.0 || ^19.0.0
- `react-dom` ^18.0.0 || ^19.0.0
- `@object-ui/core`

## Quick Start

```tsx
import {
  PageDesigner,
  DataModelDesigner,
  CollaborationProvider,
} from '@object-ui/plugin-designer';

function DesignerApp() {
  return (
    <CollaborationProvider>
      <PageDesigner
        components={componentList}
        showComponentTree
        undoRedo
      />
    </CollaborationProvider>
  );
}
```

## API

### PageDesigner

Drag-and-drop page layout builder:

```tsx
<PageDesigner
  canvas={canvasConfig}
  components={componentList}
  showComponentTree
  undoRedo
  readOnly={false}
/>
```

### DataModelDesigner

Entity-relationship diagram editor:

```tsx
<DataModelDesigner entities={entities} relationships={relationships} autoLayout />
```

### ProcessDesigner

BPMN-style process flow editor:

```tsx
<ProcessDesigner
  processName="Order Approval"
  nodes={nodes}
  edges={edges}
  showMinimap
  showToolbar
/>
```

### ReportDesigner

Visual report layout builder:

```tsx
<ReportDesigner reportName="Sales Report" objectName="Order" sections={sections} />
```

### CollaborationProvider / ConnectionStatusIndicator

Multi-user real-time editing support:

```tsx
<CollaborationProvider>
  <ConnectionStatusIndicator />
  <PageDesigner ... />
</CollaborationProvider>
```

### Shared Hooks

```tsx
import {
  useUndoRedo,
  useClipboard,
  useMultiSelect,
  useCanvasPanZoom,
  useConfirmDialog,
} from '@object-ui/plugin-designer';

const { undo, redo, canUndo, canRedo } = useUndoRedo();
const { copy, paste, cut } = useClipboard();
const { selected, select, selectAll, clearSelection } = useMultiSelect();
const { zoom, pan, resetView } = useCanvasPanZoom();
```

### Shared Components

```tsx
import { ConfirmDialog, Minimap, PropertyEditor, VersionHistory } from '@object-ui/plugin-designer';
```

## License

MIT
