/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useEffect, useRef, useCallback } from 'react';
import type { GestureType, GestureContext } from '@object-ui/types';

export interface UseGestureOptions {
  /** Gesture type to detect */
  type: GestureType;
  /** Callback when gesture is detected */
  onGesture: (context: GestureContext) => void;
  /** Minimum distance for swipe detection (pixels) */
  threshold?: number;
  /** Duration for long-press detection (milliseconds) */
  longPressDuration?: number;
  /** Whether gesture detection is enabled */
  enabled?: boolean;
}

/**
 * Hook for detecting touch gestures on an element.
 * Returns a ref to attach to the target element.
 * 
 * @example
 * ```tsx
 * const gestureRef = useGesture({
 *   type: 'swipe-left',
 *   onGesture: (ctx) => console.log('Swiped left!', ctx),
 * });
 * return <div ref={gestureRef}>Swipe me</div>;
 * ```
 */
export function useGesture<T extends HTMLElement = HTMLElement>(
  options: UseGestureOptions,
) {
  const ref = useRef<T>(null);
  const startRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { type, onGesture, threshold = 50, longPressDuration = 500, enabled = true } = options;

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;
      const touch = e.touches[0];
      startRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };

      if (type === 'long-press') {
        longPressTimerRef.current = setTimeout(() => {
          if (startRef.current) {
            onGesture({
              type: 'long-press',
              startPosition: { x: startRef.current.x, y: startRef.current.y },
              endPosition: { x: startRef.current.x, y: startRef.current.y },
              distance: 0,
              duration: longPressDuration,
              velocity: 0,
            });
          }
        }, longPressDuration);
      }
    },
    [type, onGesture, longPressDuration, enabled],
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!enabled || !startRef.current) return;
      clearTimeout(longPressTimerRef.current);

      const touch = e.changedTouches[0];
      const dx = touch.clientX - startRef.current.x;
      const dy = touch.clientY - startRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const duration = Date.now() - startRef.current.time;
      const velocity = distance / Math.max(duration, 1);

      const context: GestureContext = {
        type,
        startPosition: { x: startRef.current.x, y: startRef.current.y },
        endPosition: { x: touch.clientX, y: touch.clientY },
        distance,
        duration,
        velocity,
      };

      // Detect gesture type
      if (type === 'tap' && distance < 10 && duration < 300) {
        onGesture(context);
      } else if (type === 'double-tap') {
        // Double-tap handled separately (simplified)
        if (distance < 10 && duration < 300) {
          onGesture(context);
        }
      } else if (distance >= threshold) {
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        let direction: GestureContext['direction'];

        if (absX > absY) {
          direction = dx > 0 ? 'right' : 'left';
        } else {
          direction = dy > 0 ? 'down' : 'up';
        }

        context.direction = direction;

        if (
          (type === 'swipe-left' && direction === 'left') ||
          (type === 'swipe-right' && direction === 'right') ||
          (type === 'swipe-up' && direction === 'up') ||
          (type === 'swipe-down' && direction === 'down') ||
          type === 'pan'
        ) {
          onGesture(context);
        }
      }

      startRef.current = null;
    },
    [type, onGesture, threshold, enabled],
  );

  const handleTouchMove = useCallback(() => {
    // Cancel long-press if finger moves
    if (type === 'long-press') {
      clearTimeout(longPressTimerRef.current);
    }
  }, [type]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchmove', handleTouchMove);
      clearTimeout(longPressTimerRef.current);
    };
  }, [handleTouchStart, handleTouchEnd, handleTouchMove, enabled]);

  return ref;
}
