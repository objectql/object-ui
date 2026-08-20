/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/mobile
 * 
 * Mobile optimization for Object UI providing:
 * - useBreakpoint / useResponsive hooks for responsive behavior
 * - useGesture hook for touch gesture detection
 * - PWA utilities (manifest generation, service worker registration)
 * - Mobile-aware component wrappers
 * - Pull-to-refresh and infinite scroll support
 * 
 * @packageDocumentation
 */

export { useBreakpoint, type BreakpointState } from './useBreakpoint.js';
export { useResponsive } from './useResponsive.js';
export { useResponsiveConfig, type SpecResponsiveConfig, type ResolvedResponsiveState } from './useResponsiveConfig.js';
export { useGesture, type UseGestureOptions } from './useGesture.js';
export { useSpecGesture, type UseSpecGestureOptions } from './useSpecGesture.js';
export { useTouchTarget, type UseTouchTargetOptions, type TouchTargetResult } from './useTouchTarget.js';
export { usePullToRefresh, type PullToRefreshOptions } from './usePullToRefresh.js';
export { MobileProvider, type MobileProviderProps } from './MobileProvider.js';
export { ResponsiveContainer, type ResponsiveContainerProps } from './ResponsiveContainer.js';
export { generatePWAManifest } from './pwa.js';
export { registerServiceWorker, type ServiceWorkerConfig } from './serviceWorker.js';
export {
  createOfflineQueue,
  IndexedDbOfflineQueue,
  MemoryOfflineQueue,
  generateOpId,
  type OfflineOperation,
  type OfflineQueueBackend,
} from './offlineQueue.js';
export {
  createOfflineDataSource,
  type OfflineDataSource,
  type OfflineDataSourceOptions,
  type QueueableDataSource,
} from './createOfflineDataSource.js';
export { useOfflineSync, type OfflineSyncState } from './useOfflineSync.js';
export {
  getServiceWorkerSource,
  requestBackgroundSync,
  type ServiceWorkerSourceOptions,
} from './serviceWorkerSource.js';
export { BREAKPOINTS, resolveResponsiveValue } from './breakpoints.js';

// Re-export types for convenience
export type {
  BreakpointName,
  ResponsiveValue,
  MobileResponsiveConfig,
  MobileOverrides,
  PWAConfig,
  PWAIcon,
  FetchCacheStrategy,
  PWAOfflineConfig,
  OfflineRoute,
  GestureType,
  GestureConfig,
  GestureContext,
  MobileComponentConfig,
  SpecGestureConfig,
  SwipeGestureConfig,
  PinchGestureConfig,
  LongPressGestureConfig,
  TouchInteraction,
  TouchTargetConfig,
} from '@object-ui/types';
