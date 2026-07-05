// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Nav-item target resolution (#2245) — the pure logic behind
 * AppNavInspector's type + per-type target editing.
 *
 * The nav contract is a discriminated union on `type`; each type carries its
 * own typed target field. `object` items additionally have FOUR mutually
 * exclusive landing modes matching resolveHref's precedence
 * (`recordId` → `filters` → `viewName` → bare default). The mode is NEVER
 * persisted — it is derived from which fields are present — and switching
 * type/mode explicitly clears the other target fields plus the legacy
 * off-spec keys (`path` / `kind` / aliases), so every edit normalizes the
 * item to spec shape ("edit is the migration").
 */

/** Nav item types the inspector offers (spec union minus separator/action). */
export const NAV_ITEM_TYPES = ['object', 'page', 'dashboard', 'report', 'url', 'group'] as const;
export type NavItemType = (typeof NAV_ITEM_TYPES)[number];

/** Landing modes for `type: 'object'`, in resolveHref precedence order. */
export const OBJECT_TARGET_MODES = ['default', 'view', 'record', 'filters'] as const;
export type ObjectTargetMode = (typeof OBJECT_TARGET_MODES)[number];

/**
 * Per-type target descriptor: which field the picker writes and which
 * metadata list feeds its options (`client.list(metaType)`); free-text
 * types have no metaType.
 */
export const NAV_TYPE_TARGETS: Record<
  NavItemType,
  { targetKey?: string; metaType?: string }
> = {
  object: { targetKey: 'objectName', metaType: 'object' },
  page: { targetKey: 'pageName', metaType: 'page' },
  dashboard: { targetKey: 'dashboardName', metaType: 'dashboard' },
  report: { targetKey: 'reportName', metaType: 'report' },
  url: { targetKey: 'url' },
  group: {},
};

/** Typed target fields across the whole union. */
const TYPED_TARGET_FIELDS = [
  'objectName',
  'viewName',
  'recordId',
  'recordMode',
  'filters',
  'pageName',
  'dashboardName',
  'reportName',
  'url',
  'target',
  'params',
] as const;

/**
 * Legacy / off-spec keys that runtime resolution ignores and save-time
 * validation rejects. Cleared on EVERY inspector edit so stale keys never
 * hijack behavior or fail validation (`navigation.0: Invalid input`).
 */
const LEGACY_KEYS = ['path', 'kind', 'href', 'route', 'object', 'page', 'dashboard', 'report'] as const;

/**
 * Map a legacy `kind` value (the old inspector's vocabulary) to the spec
 * type; `link` was never a spec member — it maps to `url`.
 */
const LEGACY_KIND_TO_TYPE: Record<string, NavItemType> = {
  object: 'object',
  page: 'page',
  dashboard: 'dashboard',
  report: 'report',
  link: 'url',
  url: 'url',
  group: 'group',
};

/**
 * Infer the effective type of a (possibly legacy) nav node for display:
 * spec `type` wins; else legacy `kind`; else the presence of typed or
 * legacy target fields; else children ⇒ group; else null (unset).
 */
export function inferNavItemType(node: Record<string, unknown>): NavItemType | null {
  const t = node.type;
  if (typeof t === 'string' && (NAV_ITEM_TYPES as readonly string[]).includes(t)) {
    return t as NavItemType;
  }
  const kind = node.kind;
  if (typeof kind === 'string' && LEGACY_KIND_TO_TYPE[kind]) return LEGACY_KIND_TO_TYPE[kind];
  if (node.objectName || node.object) return 'object';
  if (node.pageName || node.page) return 'page';
  if (node.dashboardName || node.dashboard) return 'dashboard';
  if (node.reportName || node.report) return 'report';
  if (node.url || node.href) return 'url';
  if (Array.isArray(node.children) && node.children.length > 0) return 'group';
  const path = node.path;
  if (typeof path === 'string' && /^https?:/i.test(path)) return 'url';
  return null;
}

/**
 * Derive an object item's landing mode from field presence, following
 * resolveHref's precedence — the mode is a projection, never stored.
 */
export function deriveObjectTargetMode(node: Record<string, unknown>): ObjectTargetMode {
  if (node.recordId) return 'record';
  const filters = node.filters;
  if (filters && typeof filters === 'object' && !Array.isArray(filters)) return 'filters';
  if (node.viewName) return 'view';
  return 'default';
}

/**
 * The patch that clears everything EXCEPT the fields the given type+mode
 * legitimately owns. Always includes the legacy keys. Spread this before
 * the fields being set so a type/mode switch leaves no stale target behind.
 */
export function clearedTargetPatch(
  keep: ReadonlyArray<string> = [],
): Record<string, undefined> {
  const patch: Record<string, undefined> = {};
  for (const key of [...TYPED_TARGET_FIELDS, ...LEGACY_KEYS]) {
    if (!keep.includes(key)) patch[key] = undefined;
  }
  return patch;
}

/** Fields each object landing mode owns (besides objectName). */
export const OBJECT_MODE_FIELDS: Record<ObjectTargetMode, ReadonlyArray<string>> = {
  default: ['objectName'],
  view: ['objectName', 'viewName'],
  record: ['objectName', 'recordId', 'recordMode'],
  filters: ['objectName', 'filters'],
};

/**
 * Ensure a spec-valid snake_case `id`. Existing ids are kept; otherwise one
 * is derived from the target/label and uniqued against sibling ids.
 */
export function ensureNavId(
  node: Record<string, unknown>,
  siblings: ReadonlyArray<Record<string, unknown>>,
  seed?: string,
): string {
  const existing = node.id;
  if (typeof existing === 'string' && existing) return existing;
  const raw = (seed ?? String(node.objectName ?? node.label ?? 'item'))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'item';
  const base = `nav_${raw}`;
  const taken = new Set(
    siblings.map((s) => (typeof s.id === 'string' ? s.id : '')).filter(Boolean),
  );
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}
