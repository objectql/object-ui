/**
 * Touch Drag Polyfill
 * 
 * Enables HTML5 Drag and Drop API to work on touch devices (tablets/mobile).
 * This utility converts touch events (touchstart, touchmove, touchend) into
 * their drag event equivalents (dragstart, drag, dragend, dragover, drop).
 */

interface TouchDragOptions {
  /** Callback when drag starts */
  onDragStart?: (e: TouchEvent, element: HTMLElement) => void;
  /** Callback during dragging */
  onDrag?: (e: TouchEvent, element: HTMLElement) => void;
  /** Callback when drag ends */
  onDragEnd?: (e: TouchEvent, element: HTMLElement) => void;
  /** Data to transfer (like dataTransfer.setData) */
  dragData?: Record<string, string>;
}

/**
 * Creates a visual drag preview element
 */
function createDragPreview(element: HTMLElement, touch: Touch): HTMLElement {
  const preview = element.cloneNode(true) as HTMLElement;
  preview.style.position = 'fixed';
  preview.style.pointerEvents = 'none';
  preview.style.zIndex = '9999';
  preview.style.opacity = '0.8';
  preview.style.transform = 'scale(0.95)';
  preview.style.transition = 'none';
  preview.style.left = `${touch.clientX - element.offsetWidth / 2}px`;
  preview.style.top = `${touch.clientY - element.offsetHeight / 2}px`;
  preview.style.width = `${element.offsetWidth}px`;
  preview.style.height = `${element.offsetHeight}px`;
  
  document.body.appendChild(preview);
  return preview;
}

/**
 * Simulates a drag event from a touch event
 */
function simulateDragEvent(
  type: string,
  touch: Touch,
  target: EventTarget | null,
  dataTransfer?: Record<string, string>
): void {
  const dragEvent = new DragEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: touch.clientX,
    clientY: touch.clientY,
    screenX: touch.screenX,
    screenY: touch.screenY,
  });

  // Store data transfer info
  if (dataTransfer && (dragEvent as any).dataTransfer) {
    Object.keys(dataTransfer).forEach(key => {
      try {
        (dragEvent as any).dataTransfer?.setData(key, dataTransfer[key]);
      } catch (e) {
        // Some browsers don't allow setData during event creation
      }
    });
  }

  target?.dispatchEvent(dragEvent);
}

/**
 * Enables touch-based dragging on an element
 */
export function enableTouchDrag(
  element: HTMLElement,
  options: TouchDragOptions = {}
): () => void {
  let isDragging = false;
  let dragPreview: HTMLElement | null = null;
  let currentDropTarget: Element | null = null;
  let startTouch: Touch | null = null;

  const handleTouchStart = (e: TouchEvent) => {
    // Only handle single touch
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    startTouch = touch;
    
    // Small delay to distinguish between scroll and drag
    setTimeout(() => {
      if (!startTouch) return;
      
      isDragging = true;
      
      // Create visual preview
      dragPreview = createDragPreview(element, touch);
      
      // Add dragging class to original element
      element.classList.add('dragging', 'opacity-50', 'grayscale');
      
      // Simulate dragstart
      simulateDragEvent('dragstart', touch, element, options.dragData);
      
      // Call custom handler
      options.onDragStart?.(e, element);
    }, 100);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging || !dragPreview || e.touches.length !== 1) return;
    
    e.preventDefault(); // Prevent scrolling while dragging
    
    const touch = e.touches[0];
    
    // Update preview position
    dragPreview.style.left = `${touch.clientX - dragPreview.offsetWidth / 2}px`;
    dragPreview.style.top = `${touch.clientY - dragPreview.offsetHeight / 2}px`;
    
    // Find element under touch
    dragPreview.style.pointerEvents = 'none';
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    dragPreview.style.pointerEvents = 'auto';
    
    // Simulate dragover on new target
    if (elementBelow) {
      if (currentDropTarget !== elementBelow) {
        // Dragleave on old target
        if (currentDropTarget) {
          simulateDragEvent('dragleave', touch, currentDropTarget);
        }
        
        // Dragenter on new target
        currentDropTarget = elementBelow;
        simulateDragEvent('dragenter', touch, elementBelow);
      }
      
      simulateDragEvent('dragover', touch, elementBelow, options.dragData);
    }
    
    // Call custom handler
    options.onDrag?.(e, element);
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (!isDragging) {
      startTouch = null;
      return;
    }
    
    const touch = e.changedTouches[0];
    
    // Find drop target
    if (dragPreview) {
      dragPreview.style.pointerEvents = 'none';
    }
    const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
    
    // Simulate drop
    if (dropTarget) {
      simulateDragEvent('drop', touch, dropTarget, options.dragData);
    }
    
    // Simulate dragend
    simulateDragEvent('dragend', touch, element);
    
    // Cleanup
    if (dragPreview && dragPreview.parentNode) {
      dragPreview.parentNode.removeChild(dragPreview);
    }
    dragPreview = null;
    currentDropTarget = null;
    isDragging = false;
    startTouch = null;
    
    // Remove dragging class
    element.classList.remove('dragging', 'opacity-50', 'grayscale');
    
    // Call custom handler
    options.onDragEnd?.(e, element);
  };

  const handleTouchCancel = () => {
    if (!isDragging) return;
    
    // Cleanup
    if (dragPreview && dragPreview.parentNode) {
      dragPreview.parentNode.removeChild(dragPreview);
    }
    dragPreview = null;
    currentDropTarget = null;
    isDragging = false;
    startTouch = null;
    
    element.classList.remove('dragging', 'opacity-50', 'grayscale');
  };

  // Add event listeners
  element.addEventListener('touchstart', handleTouchStart, { passive: false });
  element.addEventListener('touchmove', handleTouchMove, { passive: false });
  element.addEventListener('touchend', handleTouchEnd, { passive: false });
  element.addEventListener('touchcancel', handleTouchCancel, { passive: false });

  // Return cleanup function
  return () => {
    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchmove', handleTouchMove);
    element.removeEventListener('touchend', handleTouchEnd);
    element.removeEventListener('touchcancel', handleTouchCancel);
  };
}

/**
 * Hook to detect if device supports touch
 */
export function isTouchDevice(): boolean {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0
  );
}
