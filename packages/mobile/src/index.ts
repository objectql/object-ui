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

export { useBreakpoint, type BreakpointState } from './useBreakpoint';
export { useResponsive } from './useResponsive';
export { useResponsiveConfig, type SpecResponsiveConfig, type ResolvedResponsiveState } from './useResponsiveConfig';
export { useGesture, type UseGestureOptions } from './useGesture';
export { useSpecGesture, type UseSpecGestureOptions } from './useSpecGesture';
export { useTouchTarget, type UseTouchTargetOptions, type TouchTargetResult } from './useTouchTarget';
export { usePullToRefresh, type PullToRefreshOptions } from './usePullToRefresh';
export { MobileProvider, type MobileProviderProps } from './MobileProvider';
export { ResponsiveContainer, type ResponsiveContainerProps } from './ResponsiveContainer';
export { generatePWAManifest } from './pwa';
export { registerServiceWorker, type ServiceWorkerConfig } from './serviceWorker';
export {
  createOfflineQueue,
  IndexedDbOfflineQueue,
  MemoryOfflineQueue,
  generateOpId,
  type OfflineOperation,
  type OfflineQueueBackend,
} from './offlineQueue';
export {
  createOfflineDataSource,
  type OfflineDataSource,
  type OfflineDataSourceOptions,
  type QueueableDataSource,
} from './createOfflineDataSource';
export { useOfflineSync, type OfflineSyncState } from './useOfflineSync';
export {
  getServiceWorkerSource,
  requestBackgroundSync,
  type ServiceWorkerSourceOptions,
} from './serviceWorkerSource';
export { BREAKPOINTS, resolveResponsiveValue } from './breakpoints';

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
