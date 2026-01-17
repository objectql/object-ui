# Touch Drag Support and Tablet Optimization

## Overview

This document describes the touch drag support and tablet optimization features added to the Object UI Designer.

## Problem Statement

1. **Touch Device Support**: The designer's component palette did not support dragging on touch devices (tablets/mobile) because the HTML5 Drag and Drop API doesn't natively support touch events.

2. **Tablet Layout**: The designer's fixed sidebar widths and spacing were not optimized for tablet screens (768px-1024px).

## Solution

### 1. Touch Drag Polyfill

Created a comprehensive touch event polyfill (`touchDragPolyfill.ts`) that:

- Converts touch events to drag events
- Creates visual drag preview during touch interactions
- Simulates the HTML5 Drag and Drop API for touch devices
- Maintains compatibility with mouse-based interactions

#### How It Works

```typescript
// Touch events flow
touchstart → (100ms delay to distinguish from scroll) → dragstart
touchmove → dragover on elements below touch point
touchend → drop on target element
touchcancel → cleanup
```

#### Key Features

- **Visual Feedback**: Creates a semi-transparent drag preview that follows the touch point
- **Smart Detection**: 100ms delay to distinguish between scroll and drag intent
- **Drop Target Detection**: Uses `document.elementFromPoint()` to find drop targets
- **Event Simulation**: Dispatches proper drag events that existing Canvas handlers understand
- **Cleanup**: Properly removes preview elements and event listeners

### 2. Responsive Layout

Updated the designer layout with Tailwind responsive classes:

#### Sidebar Widths
- **Mobile/Small Tablet**: `w-64` (256px)
- **Desktop**: `md:w-72` (288px) for left, `md:w-80` (320px) for right

#### Component Palette
- **Grid**: Always 2 columns with responsive gaps (`gap-2 md:gap-2.5`)
- **Item Heights**: `h-20` on mobile, `md:h-24` on desktop
- **Spacing**: Reduced padding and margins on smaller screens
- **Typography**: `text-[10px]` on mobile, `md:text-xs` on desktop

#### Tab Labels
- **Small Screens**: Icons only
- **Desktop**: Icons + text using `hidden sm:inline`

## Implementation Details

### ComponentItem Component

Each component in the palette is now a React component with:

```tsx
const ComponentItem: React.FC<ComponentItemProps> = ({ type, config, Icon, ... }) => {
  const itemRef = useRef<HTMLDivElement>(null);
  
  // Setup touch drag support
  useEffect(() => {
    if (!itemRef.current || !isTouchDevice()) return;
    
    const cleanup = enableTouchDrag(itemRef.current, {
      dragData: { componentType: type },
      onDragStart: () => setDraggingType(type),
      onDragEnd: () => setDraggingType(null)
    });
    
    return cleanup;
  }, [type]);
  
  return <div ref={itemRef} draggable ...>{/* component UI */}</div>;
};
```

### Touch Detection

```typescript
export function isTouchDevice(): boolean {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0
  );
}
```

The polyfill only activates on touch-enabled devices, maintaining optimal performance on desktop.

### Canvas Compatibility

The existing Canvas component's drag handlers (`handleDragOver`, `handleDrop`) work seamlessly with the simulated drag events from the touch polyfill. No changes were needed to the Canvas component.

## Usage

### For Users

**On Touch Devices (Tablet/Mobile):**
1. Long press on a component in the palette (100ms)
2. Drag your finger to the canvas
3. Drop the component by lifting your finger

**On Desktop:**
- Standard drag and drop with mouse continues to work as before

### For Developers

To add touch drag support to any element:

```typescript
import { enableTouchDrag, isTouchDevice } from '../utils/touchDragPolyfill';

// In a component
useEffect(() => {
  if (!elementRef.current || !isTouchDevice()) return;
  
  const cleanup = enableTouchDrag(elementRef.current, {
    dragData: { myData: 'value' },
    onDragStart: (e, el) => console.log('Started dragging'),
    onDrag: (e, el) => console.log('Dragging...'),
    onDragEnd: (e, el) => console.log('Finished dragging')
  });
  
  return cleanup;
}, []);
```

## Testing

### Manual Testing

To test on a real device:
1. Open the designer in Chrome DevTools device mode
2. Enable touch simulation
3. Try dragging components from the palette to the canvas
4. Verify the visual drag preview appears
5. Verify components are added to the canvas on drop

### Automated Testing

Run the test suite:
```bash
pnpm --filter @object-ui/designer test
```

The test file `touchDragPolyfill.test.ts` includes:
- Touch device detection tests
- Event listener setup/cleanup tests
- Callback invocation tests
- Edge case handling

## Browser Compatibility

The touch drag polyfill works on:
- ✅ iOS Safari 12+
- ✅ Chrome Android 80+
- ✅ Firefox Mobile 68+
- ✅ Edge Mobile
- ✅ Chrome Desktop (with touch screen)
- ✅ All browsers with mouse (unchanged behavior)

## Performance Considerations

1. **Conditional Activation**: Polyfill only activates on touch devices via `isTouchDevice()`
2. **Event Delegation**: Uses passive: false only where needed to prevent scrolling during drag
3. **Memory Management**: Properly cleans up preview elements and event listeners
4. **Efficient Updates**: Uses `useEffect` cleanup to remove listeners on unmount

## Responsive Breakpoints

The designer uses Tailwind's default breakpoints:

- `sm`: 640px - Show tab labels
- `md`: 768px - Increase sidebar widths, larger component items
- Default: < 640px - Compact layout

## Future Enhancements

Potential improvements for future releases:

- [ ] Add sidebar collapse/expand toggle for very small tablets
- [ ] Add pinch-to-zoom support for canvas
- [ ] Improve touch selection with long-press
- [ ] Add touch-optimized context menu
- [ ] Support multi-touch gestures
- [ ] Add haptic feedback on supported devices

## Migration Guide

No breaking changes. Existing code continues to work:
- Mouse-based dragging unchanged
- All existing props and APIs remain the same
- Desktop experience is identical
- Touch support is additive

## Known Limitations

1. **Drag Preview Customization**: The touch drag preview is auto-generated and cannot be customized per-component (matches the original element's appearance)
2. **Multi-Touch**: Currently only supports single-touch drag (multiple fingers are ignored)
3. **Scroll During Drag**: Scrolling while dragging is prevented to avoid accidental drops

## Support

For issues or questions:
- GitHub Issues: [objectstack-ai/objectui/issues](https://github.com/objectstack-ai/objectui/issues)
- Documentation: [objectui.org/docs](https://www.objectui.org)
