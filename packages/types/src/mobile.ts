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
 * `stackBreakpoint`, and `hidden`/`showOnly` in place of `hiddenOn`.
 *
 * It now has NO consumer. Its only one was `MobileComponentConfig`, retired by
 * objectui#5942 (see the RETIRED note below), so this type is still published
 * from both barrels and mounted nowhere — the same declared-surface-with-no-
 * consumption-path shape #5942 closed, one level down. Recorded as
 * objectui#7519 rather than widened into that PR: the name-ownership tripwire
 * below outlives the type, and retire-vs-implement here is a product call.
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

// RETIRED (objectui#4919, maintainer ruling 2026-08-19, ADR-0049
// enforce-or-remove): the mobile component-override surface and its mount
// point on `MobileComponentConfig` are gone, not narrowed. Every member was
// declaration-only — nothing in this repo, the example apps, or the
// `objectstack` sibling checkout ever read the property, so all six keys
// behaved identically (they did nothing), and the navigation vocabulary's
// three values were three spellings of the same no-op. Removal rather than a
// `?: never` tombstone follows this package's own discriminator: a tombstone
// exists to steer authors to a named live replacement (`crud.ts` `confirm` →
// `confirmText`; `data-display.ts` `hoverable`/`striped` → `data-table`),
// and there is no replacement here — the same zero-pull/no-successor shape as
// the retired `AccordionItem.icon` / `ToggleGroupItem.icon`, which were
// likewise removed outright rather than tombstoned.
//
// Reopen condition, recorded on objectui#4919: real mobile-override renderer
// work re-enters as designed product surface on its own card, with the
// renderer landing in the same change as the declaration. Re-adding the
// declaration alone is the declare-without-enforce shape this removal exists
// to close.

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
 * **The prefix is NOT reclaimable, unlike its two gesture siblings**
 * (objectui#3363). `@objectstack/spec` did vacate `OfflineConfig` when
 * `ui/offline` was deleted (objectstack#4988, PR objectstack#5321) — but the
 * spec was never the only claimant. This rename was a CROSS-PACKAGE
 * arbitration between two objectui packages, and `@object-ui/react` won it:
 * `useOffline`'s config is the offline DATA model key for key, so it holds
 * `OfflineConfig`. Since objectui#3560 that name is declared locally in
 * `packages/react/src/hooks/useOffline.ts` rather than re-exported from the
 * spec, so the retirement did not free it — it only changed who owns it.
 * Taking it back here would put two different `OfflineConfig` shapes on the
 * public surface of two packages that are routinely imported together, which
 * is the exact ambiguity objectstack#4115 renamed this away from.
 *
 * Tripwire: `__tests__/page-nav-misc-spec-parity.test.ts` (both the spec side
 * and the `@object-ui/react` owner, so neither reason can expire unnoticed).
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
 * Held the prefixed name `TouchGestureType` from objectstack#4115 until
 * objectui#3363: `@objectstack/spec` owned `GestureType`, and the two unions
 * agree on only three members (the spec modelled gesture and direction
 * separately — `swipe | pinch | long_press | double_tap | drag | rotate | pan`,
 * with direction inside its `GestureConfig.swipe.direction` — while objectui
 * folds direction into the name: `swipe-left`, `swipe-up`, …). Neither was a
 * subset of the other; objectui has `tap`, the spec had `drag`.
 *
 * `@objectstack/spec` 17.0.0-rc.3 deleted the whole `ui/touch` module
 * (objectstack#4988, PR objectstack#5321), vacating the name, so the natural
 * name is reclaimed here rather than letting the workaround outlive its reason
 * (objectui#3169). The retired spec vocabulary still lives in this file, under
 * the deliberately prefixed {@link SpecGestureType} — that prefix is what now
 * carries the distinction the `Touch` prefix used to.
 *
 * Tripwire: `__tests__/page-nav-misc-spec-parity.test.ts` — it fails if the
 * spec ever claims `GestureType` back.
 */
export type GestureType ='tap' | 'double-tap' | 'long-press' | 'swipe-left' | 'swipe-right' | 'swipe-up' | 'swipe-down' | 'pinch' | 'rotate' | 'pan';

/**
 * Gesture handler configuration — binds one {@link GestureType} to an
 * action name.
 *
 * Held the prefixed name `TouchGestureConfig` from objectstack#4115 until
 * objectui#3363, for the same reason as its `type` field: the spec's
 * `GestureConfig` was a per-gesture TUNING record (`{ type, label, enabled,
 * swipe: { direction, threshold, velocity }, pinch: { minScale, maxScale },
 * longPress: { duration, moveTolerance } }`) with no notion of what the gesture
 * DOES. This one is a handler binding: flat, and its whole point is `action`,
 * which the spec's had no room for. That shape did not go away — it is
 * {@link SpecGestureConfig} below, now owned by this package — but the spec no
 * longer exports the bare name, so the dialect takes it back.
 *
 * Tripwire: `__tests__/page-nav-misc-spec-parity.test.ts`.
 */
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

// RETIRED (objectui#5942, ADR-0049 enforce-or-remove): `MobileComponentConfig`
// — the free-floating "mobile component schema extension" that published
// `responsive`, `gestures`, `pullToRefresh` and `infiniteScroll` — is gone, not
// narrowed. It never had a MOUNT POINT: no type mounted it as a property, no
// declaration extended it, and nothing in this repo, the example apps or the
// `objectstack` sibling checkout annotated, cast to or imported it outside the
// two barrel re-exports. A value written against it could not reach a renderer
// by any path, so all four keys behaved identically — they did nothing.
// objectui#4919 removed its last member (`mobileOverrides`), which is what left
// the container itself inert.
//
// Removed outright rather than kept as a `?: never` carcass, on this package's
// own discriminator: a tombstone exists to steer authors to a named live
// replacement KEY (`crud.ts` `confirm` -> `confirmText`; `data-display.ts`
// `hoverable`/`striped` -> `data-table`), or to keep loud a key the docs taught
// as working. Neither applies. There is no surviving object to hang a `never`
// key on — the whole interface goes — and no documentation ever described it:
// `skills/objectui/guides/mobile.md` teaches the HOOKS and never this type.
// Same zero-pull, no-successor shape as `MobileOverrides` (objectui#4919), and
// as `AccordionItem.icon` / `ToggleGroupItem.icon` before it.
//
// No BEHAVIOUR is retired here. What the four keys named lives in
// `@object-ui/mobile` as real React hooks — `useResponsive` /
// `ResponsiveContainer`, `useGesture`, `usePullToRefresh` — which is where the
// working code always was; only the declaration nothing read is gone.
//
// Reopen condition: a declarative mobile component-config surface re-enters as
// designed product surface on its own card, with the renderer that READS it
// landing in the same change as the declaration. Re-adding the declaration
// alone is the declare-without-enforce shape this removal exists to close.

// ============================================================================
// Spec Touch Vocabulary (formerly `@objectstack/spec/ui`)
// ============================================================================
// `@objectstack/spec` 17.0.0-rc.3 deleted the whole `ui/touch` module along
// with the four other interaction-config modules (objectstack#4988, PR
// objectstack#5321). None of them had an authoring door — no metadata document
// could ever carry a touch block — so the platform stopped publishing
// vocabulary nothing could author, and a stack that parsed before the
// retirement parses byte-for-byte the same after it.
//
// The declarations below are that vocabulary moved here verbatim: same keys,
// same members, same optionality as the retired `z.infer` types this file's
// consumers used to reach through the `@objectstack/spec/ui` re-export block in
// `index.ts`. `@object-ui/mobile`'s `useSpecGesture` / `useTouchTarget` are the
// only implementations of these semantics in the repo, so this package is now
// their owner. Nothing about either hook's behaviour changes.
//
// The `Spec…` prefix on {@link SpecGestureConfig} is kept deliberately, and
// objectui#3363 has now made it the ONLY thing carrying the distinction: the
// sibling dialect above shed its own `Touch` prefix and is plain
// {@link GestureConfig} / {@link GestureType}. The two are still a DIFFERENT
// contract with different members (`swipe-left` vs `swipe` + a direction
// array), so both prefixed names below stay exactly as they are — dropping
// `Spec…` too would collapse the pair the rename just made legible.

/**
 * Gesture kinds the retired `ui/touch` vocabulary recognised.
 *
 * Declared as a runtime `as const` tuple, not a bare union, and that is
 * deliberate. `@object-ui/mobile`'s `gesture-spec-parity.test.tsx` pinned
 * `SPEC_GESTURE_TYPE_MAP` against `GestureTypeSchema.options` — a RUNTIME read
 * of the spec's enum — in both directions: every declared type maps to a
 * recogniser, and no renderer-local dialect sneaks in. A type-only union would
 * have left that pin with nothing to read and it would have had to be deleted,
 * which is how a retirement quietly takes working coverage with it. The tuple
 * keeps the pin executable against the vocabulary's new owner.
 */
export const SPEC_GESTURE_TYPES = [
  'swipe',
  'pinch',
  'long_press',
  'double_tap',
  'drag',
  'rotate',
  'pan',
] as const;

/** Gesture kinds the retired `ui/touch` vocabulary recognised. */
export type SpecGestureType = (typeof SPEC_GESTURE_TYPES)[number];

/** Swipe direction. */
export type SpecSwipeDirection = 'left' | 'right' | 'up' | 'down';

/** Swipe recogniser tuning. */
export interface SwipeGestureConfig {
  direction: SpecSwipeDirection[];
  threshold?: number;
  velocity?: number;
}

/** Pinch recogniser bounds. */
export interface PinchGestureConfig {
  minScale?: number;
  maxScale?: number;
}

/** Long-press recogniser tuning. */
export interface LongPressGestureConfig {
  duration: number;
  moveTolerance?: number;
}

/** A single gesture declaration. */
export interface SpecGestureConfig {
  type: SpecGestureType;
  label?: string;
  enabled: boolean;
  swipe?: SwipeGestureConfig;
  pinch?: PinchGestureConfig;
  longPress?: LongPressGestureConfig;
}

/** Minimum touch target sizing (WCAG 2.5.5). */
export interface TouchTargetConfig {
  minWidth: number;
  minHeight: number;
  padding?: number;
  hitSlop?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
}

/** A component's whole touch-interaction declaration. */
export interface TouchInteraction {
  gestures?: SpecGestureConfig[];
  touchTarget?: TouchTargetConfig;
  hapticFeedback?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  role?: string;
}
