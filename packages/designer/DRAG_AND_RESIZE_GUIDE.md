# Drag and Resize Guide

## Overview

The Object UI Designer supports both **drag-and-drop** and **resize** functionality for components, providing a premium visual editing experience with smooth Tailwind CSS animations and transitions.

## Component Behaviors

### Draggable Components

**All components are draggable by default** except the root container. This allows you to:
- Reorder components within their parent container
- Move components between different containers
- Quickly reorganize your layout

**Drag Interaction:**
1. **Hover** over any component to see the hover outline
2. **Click and drag** to move the component
3. **Drop** on another container to relocate

**Visual Feedback:**
- **Grab cursor** (🖐️) when hovering over draggable components
- **Grabbing cursor** (✊) when actively dragging
- **Ghost effect** on the original component while dragging (50% opacity, grayscale)
- **Animated drop zones** with gradient borders where you can drop

### Resizable Components

Only **container/layout components** are resizable. This includes:
- `card` - Card container with title/description
- `container` - Responsive container wrapper
- `grid` - Grid layout component

**Why not all components?**
- Leaf components (inputs, buttons, text) should maintain their intrinsic sizing
- Container components benefit from custom dimensions for layout control
- This prevents UI inconsistencies and maintains design quality

**Resize Interaction:**
1. **Select** a resizable component by clicking on it
2. **Resize handles** appear on the edges and corners (8 directions)
3. **Drag** a handle to resize width, height, or both
4. Dimensions are constrained by min/max values

**Visual Feedback:**
- **Resize handles** appear as circular dots on hover
- **Corner handles** (larger) for diagonal resizing
- **Edge handles** (smaller) for single-axis resizing
- **Cursor changes** to indicate resize direction (↔, ↕, ↗, ↖, ↘, ↙)

## Configuration

### Making a Component Resizable

To make a component resizable, update its registration in the component renderer file:

```typescript
ComponentRegistry.register('your-component', 
  YourComponentRenderer,
  {
    label: 'Your Component',
    inputs: [/* ... */],
    defaultProps: {/* ... */},
    
    // Enable resizing
    isContainer: true,
    resizable: true,
    
    // Optional: Define constraints
    resizeConstraints: {
      width: true,        // Allow width resizing
      height: true,       // Allow height resizing
      minWidth: 200,      // Minimum width in pixels
      maxWidth: 1200,     // Maximum width in pixels
      minHeight: 100,     // Minimum height in pixels
      maxHeight: 800      // Maximum height in pixels
    }
  }
);
```

### Resize Constraints

You can control how a component resizes using the `resizeConstraints` object:

| Property | Type | Description |
|----------|------|-------------|
| `width` | boolean | Enable/disable width resizing (default: true) |
| `height` | boolean | Enable/disable height resizing (default: true) |
| `minWidth` | number | Minimum width in pixels |
| `maxWidth` | number | Maximum width in pixels |
| `minHeight` | number | Minimum height in pixels |
| `maxHeight` | number | Maximum height in pixels |

**Examples:**

```typescript
// Only horizontal resizing
resizeConstraints: {
  width: true,
  height: false,
  minWidth: 200,
  maxWidth: 1000
}

// Only vertical resizing
resizeConstraints: {
  width: false,
  height: true,
  minHeight: 100,
  maxHeight: 600
}

// Maintain aspect ratio (manual implementation needed)
// You'd need to customize the resize handler for this
```

## Visual Design System

### Selection States

**Hover State:**
- Gradient border effect (indigo-400 → indigo-500)
- Slight upward translation (1px)
- Enhanced shadow
- Smooth 200ms cubic-bezier transition

**Selected State:**
- **Animated gradient border** (indigo-600 → indigo-700 → indigo-800)
- **Pulsing animation** to indicate active selection
- **Component type label** with gradient background
- **Enhanced drop shadow** with multiple layers
- **Resize handles** if component is resizable

**Dragging State:**
- **Ghost effect** on original position (40% opacity, grayscale, blur)
- **Drop zones** show with dashed gradient borders
- **Instruction badges** guide where to drop

### Color Palette

The design system uses the **Indigo/Purple spectrum** for consistency:

| Element | Colors | Purpose |
|---------|--------|---------|
| Hover borders | indigo-400 → indigo-500 | Subtle indication |
| Selection borders | indigo-600 → indigo-700 → indigo-800 | Strong focus |
| Drop zones | indigo-400 → indigo-500 → indigo-600 | Active targets |
| Badges & Labels | indigo-600 → purple-600 | Informational |
| Resize handles | indigo-500 | Interactive elements |
| Resizable indicators | emerald-400 → green-500 | Status badge |

### Animations

All animations use **cubic-bezier easing** for smooth, natural motion:

```css
/* Standard transition */
transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

/* Pulse animation for selection */
@keyframes pulse-border {
  0%, 100% { box-shadow: /* subtle */ }
  50% { box-shadow: /* enhanced */ }
}

/* Drop zone pulse */
@keyframes pulse-drop-zone {
  0%, 100% { /* light gradient */ }
  50% { /* intense gradient */ }
}
```

## Component Palette

### Visual Indicators

**Resizable Badge:**
- Small **green dot** in top-right corner
- Appears on hover
- Indicates component supports resizing

**Component Card:**
- **Scale animation** on hover (1.05x)
- **Active scale** on drag (0.95x)
- **Gradient background** on hover
- **Enhanced icon background**

### Category Organization

Components are organized into categories with gradient headers:

1. **Layout** - Container components (mostly resizable)
2. **Form** - Input components (not resizable)
3. **Data Display** - Display components (mixed)
4. **Feedback** - Alert/toast components (not resizable)
5. **Overlay** - Modal/popover components (not resizable)
6. **Navigation** - Nav/tab components (mixed)

## Keyboard Shortcuts

While resize doesn't have direct keyboard shortcuts, related actions do:

| Shortcut | Action |
|----------|--------|
| `Click` | Select component (shows resize handles if resizable) |
| `Drag` | Move component |
| `Ctrl/Cmd + Z` | Undo resize/move |
| `Ctrl/Cmd + Y` | Redo resize/move |
| `Delete` | Remove selected component |
| `Esc` | Deselect (hides resize handles) |

## Best Practices

### When to Make Components Resizable

✅ **Make Resizable:**
- Container components (div, section, article)
- Layout wrappers (grid, flex, stack)
- Card components
- Custom panel components
- Dashboard widgets

❌ **Don't Make Resizable:**
- Form inputs (input, textarea, select)
- Buttons
- Icons
- Badges
- Text/typography components
- Navigation links

### Why This Matters

1. **Consistency**: Users expect buttons to be consistently sized
2. **Accessibility**: Form elements have optimal sizes for interaction
3. **Design Quality**: Prevents arbitrary sizing that breaks layouts
4. **Performance**: Fewer resize calculations for non-container elements

### Implementing Custom Components

When creating custom components, consider:

1. **Is it a container?** If yes, consider making it resizable
2. **Does custom sizing make sense?** Inputs don't benefit from arbitrary sizing
3. **Will users need layout control?** Dashboard panels need resizing, buttons don't
4. **Define appropriate constraints** to prevent excessive sizing

## Technical Implementation

### State Management

The designer context manages resize state:

```typescript
type ResizingState = {
  nodeId: string;
  direction: ResizeDirection;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
} | null;
```

### Resize Directions

8 directions are supported:

```typescript
type ResizeDirection = 
  | 'n'   // North (top)
  | 's'   // South (bottom)
  | 'e'   // East (right)
  | 'w'   // West (left)
  | 'ne'  // North-East (top-right corner)
  | 'nw'  // North-West (top-left corner)
  | 'se'  // South-East (bottom-right corner)
  | 'sw'  // South-West (bottom-left corner)
```

### Resize Handler

The resize handler calculates new dimensions based on:

1. **Mouse movement delta** (clientX/Y - startX/Y)
2. **Resize direction** (which dimensions to change)
3. **Component constraints** (min/max values)
4. **Scale factor** (if canvas is zoomed)

```typescript
const handleResize = (e: MouseEvent) => {
  const deltaX = e.clientX - startX;
  const deltaY = e.clientY - startY;
  
  let newWidth = startWidth;
  let newHeight = startHeight;
  
  if (direction.includes('e')) newWidth += deltaX;
  if (direction.includes('w')) newWidth -= deltaX;
  if (direction.includes('s')) newHeight += deltaY;
  if (direction.includes('n')) newHeight -= deltaY;
  
  // Apply constraints
  newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
  newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
  
  // Update element
  updateNode(nodeId, { style: { width, height } });
};
```

## Troubleshooting

### Resize Handles Not Appearing

**Check:**
1. Is the component selected? (Click it first)
2. Is `resizable: true` in component registration?
3. Does the component config exist in ComponentRegistry?
4. Is the element rendered with a `data-obj-id` attribute?

### Resize Not Smooth

**Potential causes:**
1. Missing transition CSS classes
2. Scale transform interfering with dimensions
3. Parent container constraints
4. Browser performance issues with complex layouts

### Constraints Not Working

**Verify:**
1. `resizeConstraints` is properly defined
2. Min/max values are numbers (not strings)
3. Min values are less than max values
4. Constraints are in pixels (not percentages)

## Future Enhancements

Planned features for future releases:

- [ ] **Snap-to-grid** during resize
- [ ] **Aspect ratio locking** (Shift+Drag)
- [ ] **Keyboard resize** (Arrow keys with Shift)
- [ ] **Percentage-based constraints** 
- [ ] **Resize preview overlay** showing dimensions
- [ ] **Multi-select resize** (resize multiple components)
- [ ] **Resize from center** (Alt+Drag)

## Examples

### Basic Resizable Card

```typescript
const schema = {
  type: 'card',
  title: 'Resizable Card',
  className: 'w-96 h-64',
  body: [
    { type: 'text', content: 'This card can be resized!' }
  ]
};
```

### Grid with Fixed Height

```typescript
ComponentRegistry.register('fixed-grid',
  GridRenderer,
  {
    resizable: true,
    resizeConstraints: {
      width: true,
      height: false, // Fixed height
      minWidth: 300
    }
  }
);
```

### Dashboard Panel with Constraints

```typescript
const panel = {
  type: 'card',
  title: 'Dashboard Widget',
  className: 'min-w-[300px] max-w-[800px]',
  // Resizable between 300-800px width
};
```

## Support

For issues or questions:
- Check [GitHub Issues](https://github.com/objectstack-ai/objectui/issues)
- Review [Component Registry documentation](../../docs/api/component-registry.md)
- See [Designer API reference](../../docs/api/designer.md)
