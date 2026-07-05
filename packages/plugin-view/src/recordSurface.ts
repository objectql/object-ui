/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Local mirror of `@objectstack/spec` `deriveRecordSurface` (framework #2578).
 *
 * A record's default surface — full `page` vs a `drawer`/`modal` overlay — is
 * DERIVED from how heavy the record is (visible, non-system field count), not
 * authored: per ADR-0085 §2 a `recordSurface` object key would fail the
 * admission test (field count is machine-inferable). Field-heavy objects open
 * create/edit/detail as a full page; light ones as a drawer. Mobile always
 * pages (overlays are cramped on phones). An explicit `schema.layout` or
 * per-view navigation config still wins — this is only the default.
 *
 * Kept local because objectui pins `@objectstack/spec@^11.7.0`, which predates
 * the export. Consolidate to
 * `import { deriveRecordSurface } from '@objectstack/spec/data'` when objectui
 * adopts spec >= 11.10 (framework #2578). The field set + threshold below mirror
 * the spec helper exactly so the two agree.
 */

/** Audit/system fields excluded from the "how heavy is this record" count. */
const RECORD_SURFACE_SYSTEM_FIELDS: ReadonlySet<string> = new Set([
  'created_at', 'created_by', 'updated_at', 'updated_by',
  'organization_id', 'tenant_id', 'is_deleted', 'deleted_at',
]);

/** At/above this many authorable fields, a record opens as a full page. */
export const RECORD_SURFACE_PAGE_THRESHOLD = 12;

export type RecordSurface = 'page' | 'drawer';

export interface RecordSurfaceOptions {
  viewport?: 'mobile' | 'desktop';
  pageThreshold?: number;
}

/** Count visible, non-system fields on an object schema. */
function countAuthorableFields(objectSchema: unknown): number {
  const fields = (objectSchema as { fields?: unknown } | null)?.fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return 0;
  let n = 0;
  for (const [name, f] of Object.entries(fields as Record<string, { hidden?: boolean } | undefined>)) {
    if (f?.hidden === true) continue;
    if (RECORD_SURFACE_SYSTEM_FIELDS.has(name)) continue;
    n++;
  }
  return n;
}

/**
 * Derive the default record surface for an object schema. Field-heavy → `page`,
 * otherwise `drawer`; mobile always `page`.
 */
export function deriveRecordSurface(objectSchema: unknown, opts: RecordSurfaceOptions = {}): RecordSurface {
  if (opts.viewport === 'mobile') return 'page';
  const threshold = opts.pageThreshold ?? RECORD_SURFACE_PAGE_THRESHOLD;
  return countAuthorableFields(objectSchema) >= threshold ? 'page' : 'drawer';
}

/**
 * Overlay size bucket for a drawer/modal (mirrors spec `NavigationConfig.size`
 * / `FormView.modalSize`). #2578: width is a runtime concern — the author can't
 * know the client viewport — so buckets map to a pixel CAP that the renderer
 * always clamps to the viewport (`min(cap, 92vw)`).
 */
export type OverlaySize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

/** Pixel cap per bucket; always clamped to the viewport at render (min(cap, 92vw)). */
const OVERLAY_SIZE_PX: Record<OverlaySize, number> = {
  sm: 480, md: 720, lg: 960, xl: 1200, full: 1600,
};

/** Derive the overlay size bucket from field count (the `size: 'auto'` path). */
export function deriveOverlaySize(objectSchema: unknown): OverlaySize {
  const n = countAuthorableFields(objectSchema);
  if (n <= 3) return 'sm';
  if (n <= 8) return 'md';
  if (n <= 15) return 'lg';
  return 'xl';
}

/**
 * Resolve an overlay `size` (bucket or `'auto'`/absent) to a viewport-clamped
 * CSS width. `'auto'` derives the bucket from field count. The `min(cap, 92vw)`
 * clamp is why the AUTHOR never needs the client width — the client applies it.
 */
export function overlayWidthFor(size: 'auto' | OverlaySize | undefined, objectSchema: unknown): string {
  const bucket = (!size || size === 'auto') ? deriveOverlaySize(objectSchema) : size;
  return `min(92vw, ${OVERLAY_SIZE_PX[bucket]}px)`;
}

/**
 * Local mirror of `@objectstack/spec` `deriveRecordFlowSurface` (framework
 * #2604 — same consolidation TODO as `deriveRecordSurface` above: swap to the
 * `@objectstack/spec/data` import when the pinned spec ships it).
 *
 * The record flow being opened. `view` shows state; the other four perform a
 * task (create/change a record). For `child-*` flows — a subtable / related-
 * list child created or edited from its PARENT's detail — pass the CHILD
 * object's schema: the overlay sizes to the record being edited, while the
 * return target is always the parent (#2604 D3).
 */
export type RecordFlow = 'view' | 'create' | 'edit' | 'child-create' | 'child-edit';

/** How the surface is mounted: a navigated route, or an overlay over the origin. */
export type RecordFlowContainer = 'route' | 'overlay';

export interface RecordFlowSurface {
  /**
   * `'route'` only ever for flow `'view'` (a record is shareable state).
   * Every task flow is an `'overlay'`: close returns to the origin with its
   * context (scroll / filters / tab) intact — the #2604 return-flow invariant.
   */
  container: RecordFlowContainer;
  /** Includes `'modal'`, which the base heuristic never emits — task flows do. */
  surface: 'page' | 'modal' | 'drawer';
  /** Maps onto `modalSize` / `navigation.size`; routes ignore it. */
  size: 'auto' | 'full';
}

/**
 * Derive the DEFAULT surface for a record FLOW (#2604). The two axes are
 * independent: how BIG comes from {@link deriveRecordSurface} (unchanged);
 * whether it ROUTES comes from what the flow *is* — viewing a record is
 * state → route-capable; making/changing one is a task → always an overlay,
 * with the derived `'page'` mapped to a FULL-SCREEN MODAL (same big canvas,
 * overlay return semantics). A DEFAULT only: explicit `navigation.mode`/`size`,
 * `FormView.type`/`modalSize`, or an assigned page win.
 */
export function deriveRecordFlowSurface(
  objectSchema: unknown,
  flow: RecordFlow,
  opts: RecordSurfaceOptions = {},
): RecordFlowSurface {
  const surface = deriveRecordSurface(objectSchema, opts);
  if (flow === 'view') {
    return { container: surface === 'page' ? 'route' : 'overlay', surface, size: 'auto' };
  }
  // Task flows (create / edit / child-*): never a route. Field-heavy (or
  // mobile, where the base derivation says 'page') → full-screen modal.
  if (surface === 'page') return { container: 'overlay', surface: 'modal', size: 'full' };
  return { container: 'overlay', surface, size: 'auto' };
}
