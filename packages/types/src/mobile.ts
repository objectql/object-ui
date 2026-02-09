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

// ============================================================================
// Responsive Configuration
// ============================================================================

/** Breakpoint names */
export type BreakpointName = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/** Responsive value - different values for different breakpoints */
export type ResponsiveValue<T> = T | Partial<Record<BreakpointName, T>>;

/** Responsive layout configuration */
export interface ResponsiveConfig {
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
export type CacheStrategy = 'cache-first' | 'network-first' | 'stale-while-revalidate' | 'network-only' | 'cache-only';

/** Offline configuration */
export interface OfflineConfig {
  /** Enable offline support */
  enabled: boolean;
  /** Default caching strategy */
  defaultStrategy: CacheStrategy;
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
  strategy: CacheStrategy;
  /** Cache name */
  cacheName?: string;
  /** Cache expiration override */
  expiration?: number;
}

// ============================================================================
// Touch Gestures
// ============================================================================

/** Touch gesture types */
export type GestureType = 'tap' | 'double-tap' | 'long-press' | 'swipe-left' | 'swipe-right' | 'swipe-up' | 'swipe-down' | 'pinch' | 'rotate' | 'pan';

/** Gesture handler configuration */
export interface GestureConfig {
  /** Gesture type */
  type: GestureType;
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
  type: GestureType;
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
  responsive?: ResponsiveConfig;
  /** Mobile-specific overrides */
  mobileOverrides?: MobileOverrides;
  /** Touch gesture handlers */
  gestures?: GestureConfig[];
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
