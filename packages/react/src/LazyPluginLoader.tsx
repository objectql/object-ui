/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { lazy, Suspense } from 'react';

export interface LazyPluginOptions {
  /**
   * Fallback component to show while loading
   */
  fallback?: React.ReactNode;
}

/**
 * Create a lazy-loaded plugin component with Suspense wrapper
 * 
 * @param importFn - Dynamic import function that returns a module with default export
 * @param options - Configuration options for the lazy plugin
 * @returns A component that lazy loads the plugin
 * 
 * @example
 * ```tsx
 * // Basic usage
 * const ObjectGrid = createLazyPlugin(
 *   () => import('@object-ui/plugin-grid')
 * );
 * 
 * // With custom fallback
 * const ObjectGrid = createLazyPlugin(
 *   () => import('@object-ui/plugin-grid'),
 *   { fallback: <div>Loading grid...</div> }
 * );
 * ```
 */
export function createLazyPlugin<P extends object = any>(
  importFn: () => Promise<{ default: React.ComponentType<P> }>,
  options?: LazyPluginOptions
): React.ComponentType<P> {
  const LazyComponent = lazy(importFn);
  
  const PluginWrapper: React.FC<P> = (props) => (
    <Suspense fallback={options?.fallback || null}>
      <LazyComponent {...props} />
    </Suspense>
  );
  
  return PluginWrapper;
}
