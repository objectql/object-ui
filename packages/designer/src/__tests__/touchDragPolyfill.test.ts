import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { enableTouchDrag, isTouchDevice } from '../utils/touchDragPolyfill';

describe('touchDragPolyfill', () => {
  describe('isTouchDevice', () => {
    it('should detect touch support', () => {
      const result = isTouchDevice();
      expect(typeof result).toBe('boolean');
    });

    it('should return true if ontouchstart exists', () => {
      // Testing browser API
      (global as any).window = { ontouchstart: {} };
      expect(isTouchDevice()).toBe(true);
    });
  });

  describe('enableTouchDrag', () => {
    let element: HTMLElement;
    let cleanup: (() => void) | undefined;

    beforeEach(() => {
      element = document.createElement('div');
      document.body.appendChild(element);
    });

    afterEach(() => {
      if (cleanup) {
        cleanup();
        cleanup = undefined;
      }
      if (element.parentNode) {
        document.body.removeChild(element);
      }
    });

    it('should add touch event listeners to element', () => {
      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');
      
      cleanup = enableTouchDrag(element);

      expect(addEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function), expect.any(Object));
      expect(addEventListenerSpy).toHaveBeenCalledWith('touchmove', expect.any(Function), expect.any(Object));
      expect(addEventListenerSpy).toHaveBeenCalledWith('touchend', expect.any(Function), expect.any(Object));
      expect(addEventListenerSpy).toHaveBeenCalledWith('touchcancel', expect.any(Function), expect.any(Object));
    });

    it('should return a cleanup function', () => {
      cleanup = enableTouchDrag(element);
      
      expect(typeof cleanup).toBe('function');
    });

    it('should remove event listeners when cleanup is called', () => {
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');
      
      cleanup = enableTouchDrag(element);
      cleanup();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('touchmove', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('touchend', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('touchcancel', expect.any(Function));
    });

    it('should call onDragStart callback when provided', async () => {
      const onDragStart = vi.fn();
      cleanup = enableTouchDrag(element, { onDragStart });

      // Simulate touchstart
      const touch = new Touch({
        identifier: 0,
        target: element,
        clientX: 100,
        clientY: 100,
        screenX: 100,
        screenY: 100,
        pageX: 100,
        pageY: 100,
        radiusX: 0,
        radiusY: 0,
        rotationAngle: 0,
        force: 1,
      });

      const touchEvent = new TouchEvent('touchstart', {
        touches: [touch],
        targetTouches: [touch],
        changedTouches: [touch],
        bubbles: true,
        cancelable: true,
      });

      element.dispatchEvent(touchEvent);

      // Wait for the setTimeout delay (100ms)
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(onDragStart).toHaveBeenCalled();
    });

    it('should handle dragData option', () => {
      const dragData = { componentType: 'button' };
      cleanup = enableTouchDrag(element, { dragData });

      // Basic smoke test - just ensure it doesn't throw
      expect(cleanup).toBeDefined();
    });
  });
});
