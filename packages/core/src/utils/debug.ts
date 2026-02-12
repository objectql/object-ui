/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

type DebugCategory = 'schema' | 'registry' | 'expression' | 'action' | 'plugin' | 'render';

function isDebugEnabled(): boolean {
  try {
    const g = typeof globalThis !== 'undefined' && (globalThis as any).OBJECTUI_DEBUG;
    return (
      (g === true || g === 'true') ||
      (typeof process !== 'undefined' && process.env?.OBJECTUI_DEBUG === 'true')
    );
  } catch {
    return false;
  }
}

/**
 * Log a debug message when OBJECTUI_DEBUG is enabled.
 * No-op in production or when debug mode is off.
 *
 * @example
 * ```ts
 * // Enable debug mode
 * globalThis.OBJECTUI_DEBUG = true;
 *
 * debugLog('schema', 'Resolving component', { type: 'Button' });
 * // [ObjectUI Debug][schema] Resolving component { type: 'Button' }
 * ```
 */
export function debugLog(category: DebugCategory, message: string, data?: unknown): void {
  if (!isDebugEnabled()) return;
  if (data !== undefined) {
    console.log(`[ObjectUI Debug][${category}] ${message}`, data);
  } else {
    console.log(`[ObjectUI Debug][${category}] ${message}`);
  }
}

const timers = new Map<string, number>();

/**
 * Start a debug timer. Pair with {@link debugTimeEnd}.
 */
export function debugTime(label: string): void {
  if (!isDebugEnabled()) return;
  timers.set(label, performance.now());
}

/**
 * End a debug timer and log the elapsed time.
 */
export function debugTimeEnd(label: string): void {
  if (!isDebugEnabled()) return;
  const start = timers.get(label);
  if (start !== undefined) {
    const elapsed = (performance.now() - start).toFixed(2);
    console.log(`[ObjectUI Debug][perf] ${label}: ${elapsed}ms`);
    timers.delete(label);
  }
}
