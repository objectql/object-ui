/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Mobile Optimization Types
 * 
 * Type definitions for mobile-responsive components, PWA support,
 * and touch gesture handling.
 * 
 * @module mobile
 * @packageDocumentation
 */

import type { BreakpointName } from '@objectstack/spec/ui';

// ============================================================================
// Responsive Configuration
// ============================================================================

/**
 * Breakpoint names.
 *
 * Bound to the spec rather than re-declared (objectstack#4115): a local union
 * under a spec export's name is read by the next reader as the spec's own
 * definition, so a copy that is correct today is a planted premise tomorrow.
 */
export type { BreakpointName };

/** Responsive value - different values for different breakpoints */
export type ResponsiveValue<T> = T | Partial<Record<BreakpointName, T>>;

/**
 * Responsive layout configuration for objectui's **mobile component overrides**.
 *
 * Renamed off the spec's `ResponsiveConfig` name (objectstack#4115): the two
 * configure responsiveness through different vocabularies, and this package
 * already re-exports the spec's own under `SpecResponsiveConfig`, so the bare
 * name claimed an authority it did not have.
 *
 * The spec's `ResponsiveConfig` is the SDUI grid contract —
 * `{ breakpoint, hiddenOn, columns: {xs..2xl}, order: {xs..2xl} }` — arranging a
 * node within a grid. This one is the mobile renderer's box config: `columns`
 * also accepts a bare number, plus `gap`, `padding`, `stackOnMobile` /
 * `stackBreakpoint`, and `hidden`/`showOnly` in place of `hiddenOn`. It is
 * consumed only by {@link MobileComponentConfig}.
 *
 * Tripwire: `__tests__/page-nav-misc-spec-parity.test.ts` fails if the spec ever
 * claims this name, so the alias cannot outlive its reason.
 */
export interface MobileResponsiveConfig {
  /** Number of columns at each breakpoint */
  columns?: ResponsiveValue<number>;
  /** Whether to stack vertically on mobile */
  stackOnMobile?: boolean;
  /** Breakpoint at which to stack */
  stackBreakpoint?: BreakpointName;
  /** Gap between items at each breakpoint */
  gap?: ResponsiveValue<string | number>;
  /** Padding at each breakpoint */
  padding?: ResponsiveValue<string | number>;
  /** Whether to hide on specific breakpoints */
  hidden?: BreakpointName[];
  /** Whether to show only on specific breakpoints */
  showOnly?: BreakpointName[];
}

/** Mobile-specific component overrides */
export interface MobileOverrides {
  /** Simplified layout for mobile */
  layout?: 'stack' | 'tabs' | 'accordion' | 'carousel';
  /** Reduced columns for forms */
  columns?: number;
  /** Whether to use bottom sheet instead of modal */
  useBottomSheet?: boolean;
  /** Whether to use full-screen mode */
  fullScreen?: boolean;
  /** Touch-friendly sizing */
  touchTarget?: 'default' | 'large' | 'xlarge';
  /** Simplified navigation */
  navigation?: 'bottom-tabs' | 'hamburger' | 'drawer';
}

// ============================================================================
// PWA Support
// ============================================================================

/** PWA configuration */
export interface PWAConfig {
  /** Enable PWA support */
  enabled: boolean;
  /** App name */
  name: string;
  /** Short name for home screen */
  shortName: string;
  /** App description */
  description?: string;
  /** Theme color */
  themeColor?: string;
  /** Background color */
  backgroundColor?: string;
  /** Display mode */
  display?: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  /** App icons */
  icons?: PWAIcon[];
  /** Start URL */
  startUrl?: string;
  /** Scope */
  scope?: string;
  /** Orientation */
  orientation?: 'any' | 'portrait' | 'landscape';
}

/** PWA icon definition */
export interface PWAIcon {
  /** Icon URL */
  src: string;
  /** Icon sizes (e.g., '192x192') */
  sizes: string;
  /** MIME type */
  type?: string;
  /** Purpose */
  purpose?: 'any' | 'maskable' | 'monochrome';
}

/** Offline caching strategy */
export type FetchCacheStrategy = 'cache-first' | 'network-first' | 'stale-while-revalidate' | 'network-only' | 'cache-only';

/**
 * Offline configuration for the **PWA service worker** — which routes are
 * cached, with which fetch strategy.
 *
 * Renamed off the spec's `OfflineConfig` name (objectstack#4115): the spec's is
 * the application-level offline DATA model — `{ enabled, strategy, cache: {
 * persistStorage, evictionPolicy, ttl }, sync: { conflictResolution,
 * retryInterval, batchSize }, offlineIndicator, queueMaxSize }` — i.e. the
 * mutation queue and its storage backend. This one sits a layer below, next to
 * {@link PWAConfig} and {@link PWAIcon}: a list of URL patterns
 * ({@link OfflineRoute}) paired with {@link FetchCacheStrategy}, the
 * service-worker fetch ordering. Its `defaultStrategy`/`syncStrategy` are
 * kebab-case; the spec's are snake_case — two vocabularies, one name.
 *
 * The spec's shape is modelled in objectui by `@object-ui/react`'s
 * `useOffline` config, which keeps the spec's name (and its ledger entry,
 * objectui#3159) precisely because it IS that concept.
 *
 * Tripwire: `__tests__/page-nav-misc-spec-parity.test.ts`.
 */
export interface PWAOfflineConfig {
  /** Enable offline support */
  enabled: boolean;
  /** Default caching strategy */
  defaultStrategy: FetchCacheStrategy;
  /** Routes with specific caching strategies */
  routes?: OfflineRoute[];
  /** Maximum cache size in bytes */
  maxCacheSize?: number;
  /** Cache expiration in seconds */
  cacheExpiration?: number;
  /** Objects to cache for offline access */
  offlineObjects?: string[];
  /** Sync strategy when back online */
  syncStrategy?: 'immediate' | 'background' | 'manual';
  /** Conflict resolution strategy */
  conflictResolution?: 'server-wins' | 'client-wins' | 'manual';
}

/** Offline route configuration */
export interface OfflineRoute {
  /** URL pattern (glob or regex) */
  pattern: string;
  /** Caching strategy for this route */
  strategy: FetchCacheStrategy;
  /** Cache name */
  cacheName?: string;
  /** Cache expiration override */
  expiration?: number;
}

// ============================================================================
// Touch Gestures
// ============================================================================

/**
 * Touch gesture types — objectui's **direction-fused** gesture vocabulary.
 *
 * Renamed off the spec's `GestureType` name (objectstack#4115): the spec models
 * a gesture and its direction separately (`swipe | pinch | long_press |
 * double_tap | drag | rotate | pan`, with direction inside
 * `GestureConfig.swipe.direction`), while objectui folds direction into the
 * name (`swipe-left`, `swipe-up`, …). The two unions therefore agree on only
 * three members, and neither is a subset of the other — objectui has `tap`, the
 * spec has `drag`.
 *
 * Tripwire: `__tests__/page-nav-misc-spec-parity.test.ts`.
 */
export type TouchGestureType ='tap' | 'double-tap' | 'long-press' | 'swipe-left' | 'swipe-right' | 'swipe-up' | 'swipe-down' | 'pinch' | 'rotate' | 'pan';

/**
 * Gesture handler configuration — binds one {@link TouchGestureType} to an
 * action name.
 *
 * Renamed off the spec's `GestureConfig` name (objectstack#4115) for the same
 * reason as its `type` field: the spec's `GestureConfig` is a per-gesture
 * TUNING record (`{ type, label, enabled, swipe: { direction, threshold,
 * velocity }, pinch: { minScale, maxScale }, longPress: { duration,
 * moveTolerance } }`) with no notion of what the gesture DOES. This one is a
 * handler binding: flat, and its whole point is `action`, which the spec's has
 * no room for.
 *
 * Tripwire: `__tests__/page-nav-misc-spec-parity.test.ts`.
 */
export interface TouchGestureConfig {
  /** Gesture type */
  type: TouchGestureType;
  /** Action to execute */
  action: string;
  /** Minimum distance for swipe gestures (pixels) */
  threshold?: number;
  /** Duration for long-press (milliseconds) */
  duration?: number;
  /** Whether to prevent default browser behavior */
  preventDefault?: boolean;
  /** Whether gesture is enabled */
  enabled?: boolean;
}

/** Touch gesture context */
export interface GestureContext {
  /** Gesture type that was detected */
  type: TouchGestureType;
  /** Start position */
  startPosition: { x: number; y: number };
  /** End position */
  endPosition: { x: number; y: number };
  /** Distance traveled */
  distance: number;
  /** Direction of movement */
  direction?: 'up' | 'down' | 'left' | 'right';
  /** Duration of gesture in milliseconds */
  duration: number;
  /** Velocity (pixels per millisecond) */
  velocity: number;
  /** Scale for pinch gestures */
  scale?: number;
  /** Rotation angle for rotate gestures */
  rotation?: number;
}

/** Mobile component schema extension */
export interface MobileComponentConfig {
  /** Responsive configuration */
  responsive?: MobileResponsiveConfig;
  /** Mobile-specific overrides */
  mobileOverrides?: MobileOverrides;
  /** Touch gesture handlers */
  gestures?: TouchGestureConfig[];
  /** Pull-to-refresh configuration */
  pullToRefresh?: {
    enabled: boolean;
    threshold?: number;
    onRefresh?: string;
  };
  /** Infinite scroll configuration */
  infiniteScroll?: {
    enabled: boolean;
    threshold?: number;
    loadMore?: string;
  };
}
