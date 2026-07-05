/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/layout - Navigation Renderer
 *
 * Renders a `NavigationItem[]` tree from AppSchema JSON into a Shadcn sidebar.
 * Supports all 7 navigation item types: object, dashboard, page, report,
 * url, action, group — plus separators, badges, visibility expressions,
 * and RBAC permission guards.
 *
 * Enhanced with:
 * - Search filtering across navigation tree
 * - Pin/favorite navigation items (pinned items in "Favorites" section)
 * - Drag-to-reorder navigation items via @dnd-kit
 *
 * @module NavigationRenderer
 */

import React, { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChevronRight,
  FileText,
  GripVertical,
  Pin,
  PinOff,
  Star,
} from 'lucide-react';
import { getLazyIcon } from '@object-ui/components';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  Badge,
  Separator,
  cn,
  useIsMobile,
} from '@object-ui/components';
import type { NavigationItem } from '@object-ui/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Callback to evaluate a visibility expression.
 * Return `true` if the item should be visible.
 * When not provided, all items default to visible.
 */
export type VisibilityEvaluator = (
  expression: string | boolean | undefined,
) => boolean;

/**
 * Callback to check whether the current user satisfies **all** of the
 * given permission strings.  Each string is opaque — the consumer decides
 * the format (e.g. `"object:action"` or a named role).
 * When not provided, all items default to permitted.
 */
export type PermissionChecker = (permissions: string[]) => boolean;

/**
 * Callback to check whether the runtime advertises the named capabilities.
 *
 * Used to gate navigation entries that target objects or services which
 * may not exist in every runtime (e.g. `sys_app` / `sys_package` only
 * live in the cloud control-plane). When `requiresObject` or
 * `requiresService` is set on a navigation item and the checker returns
 * `false`, the item is hidden — preventing the 404-when-clicked trap.
 *
 * When not provided, capability gates default to *pass* (i.e. always
 * shown) so navigation works in environments that haven't wired up a
 * runtime capability probe yet.
 */
export type CapabilityChecker = (kind: 'object' | 'service', name: string) => boolean;

export interface NavigationRendererProps {
  /** Navigation items to render */
  items: NavigationItem[];

  /**
   * Base URL prefix prepended to generated hrefs.
   * @example "/apps/crm"
   */
  basePath?: string;

  /** Optional visibility evaluator for `visible` expressions */
  evaluateVisibility?: VisibilityEvaluator;

  /** Optional permission checker for `requiredPermissions` */
  checkPermission?: PermissionChecker;

  /** Optional runtime-capability checker for `requiresObject` / `requiresService` */
  checkCapability?: CapabilityChecker;

  /** Called when an `action`-type item is clicked */
  onAction?: (item: NavigationItem) => void;

  // --- P1.7 Navigation Enhancements ---

  /** Search query to filter navigation items by label */
  searchQuery?: string;

  /** Enable pin/favorite toggle on navigation items */
  enablePinning?: boolean;

  /**
   * Called when a navigation item is pinned or unpinned. The optional
   * `item` and `basePath` arguments are passed so consumers can synthesize
   * a portable favorite record (with a real label/href) instead of storing
   * only the raw nav id. Older consumers that ignore the extra args keep
   * working unchanged.
   */
  onPinToggle?: (
    itemId: string,
    pinned: boolean,
    item?: NavigationItem,
    basePath?: string,
  ) => void;

  /** Enable drag-to-reorder for navigation items */
  enableReorder?: boolean;

  /** Called when navigation items are reordered via drag */
  onReorder?: (reorderedItems: NavigationItem[]) => void;

  /**
   * Optional label resolver for object-type navigation items.
   * When provided, called with `(objectName, fallbackLabel)` for items
   * where `item.type === 'object'` and `item.label` is a plain string.
   * Enables convention-based i18n auto-resolution without coupling
   * the layout package to i18n.
   */
  resolveObjectLabel?: (objectName: string, fallbackLabel: string) => string;

  /**
   * Optional label resolver for dashboard-type navigation items.
   * Called with `(dashboardName, fallbackLabel)` for items where
   * `item.type === 'dashboard'` and `item.label` is a plain string.
   * Mirrors `resolveObjectLabel` for the convention-based i18n hook
   * `useObjectLabel().dashboardLabel`.
   */
  resolveDashboardLabel?: (dashboardName: string, fallbackLabel: string) => string;

  /**
   * Optional label resolver for object-type navigation items that target a
   * specific view (i.e. `viewName` is set). Called with
   * `(objectName, viewName, fallbackLabel)`. Mirrors
   * `useObjectLabel().viewLabel` and resolves
   * `{ns}.objects.{objectName}._views.{viewName}.label`.
   *
   * Without this resolver, an object item with a `viewName` falls back to
   * its schema-provided explicit label (which keeps it distinct from a bare
   * object-list entry under the same group — avoids visual duplicates such
   * as two `商机` rows where one is the list and the other is a Kanban view).
   */
  resolveViewLabel?: (objectName: string, viewName: string, fallbackLabel: string) => string;

  /**
   * Optional label resolver for navigation group items.
   * Called with `(groupId, fallbackLabel)` for items where
   * `item.type === 'group'` and `item.label` is a plain string.
   * Enables convention-based i18n via
   * `{ns}.apps.{appName}.navigation.{groupId}.label`.
   */
  resolveGroupLabel?: (groupId: string, fallbackLabel: string) => string;

  /**
   * Optional label resolver for non-object/non-dashboard/non-group nav
   * items (url, page, report, custom). Called with `(itemId, fallbackLabel)`
   * for items that have a plain-string label and a stable `id`.
   * Convention: `{ns}.apps.{appName}.navigation.{itemId}.label` — same
   * key shape as `resolveGroupLabel` so a single i18n helper covers both.
   */
  resolveItemLabel?: (itemId: string, fallbackLabel: string) => string;

  /**
   * Optional i18n translation function for resolving I18nLabel objects
   * (`{ key, defaultValue }`). When provided, labels are translated
   * through i18next; otherwise falls back to `defaultValue`.
   */
  t?: (key: string, options?: any) => string;

  /**
   * Optional template-variable context for resolving `recordId` on
   * `object`-type nav items that target a specific record. The shell
   * passes the signed-in user id / active org id; authors write
   * `{current_user_id}` / `{current_org_id}` in `recordId`.
   *
   * When omitted (or a referenced variable is missing), affected items
   * fall back to opening the list view so the link is still functional.
   */
  templateContext?: NavTemplateContext;
}

// ---------------------------------------------------------------------------
// Icon Helper
// ---------------------------------------------------------------------------

/**
 * Resolve a Lucide icon component by name string.
 * Delegates to the shared `getLazyIcon` utility (lucide-react `DynamicIcon`
 * under the hood) so each icon ships as a separate micro-chunk.
 */
export function resolveIcon(name?: string): React.ComponentType<any> {
  if (!name) return FileText as any;
  return getLazyIcon(name) as any;
}

// ---------------------------------------------------------------------------
// I18nLabel resolver
// ---------------------------------------------------------------------------

/**
 * Resolve a NavigationItem label to a plain string.
 * Handles both plain strings and I18nLabel objects { key, defaultValue }.
 * When a `t` function is provided, I18nLabel objects are translated via i18next.
 */
export function resolveLabel(
  label: string | { key: string; defaultValue?: string; params?: Record<string, any> },
  t?: (key: string, options?: any) => string,
): string {
  if (typeof label === 'string') return label;
  if (t) {
    const result = t(label.key, { defaultValue: label.defaultValue, ...label.params });
    if (result && result !== label.key) return result;
  }
  return label.defaultValue || label.key;
}

/**
 * Resolve a navigation item label, applying:
 * 1. i18n translation for I18nLabel objects (when `t` is provided)
 * 2. Convention-based i18n for object-type items whose plain string label was
 *    never customized (still equal to the bare object/dashboard/item name),
 *    so standard nav entries still localize automatically
 *    (when `resolveObjectLabel`/`resolveDashboardLabel`/etc. is provided)
 * 3. Otherwise, the schema-authored explicit label always wins — an app
 *    author who wrote a custom label (e.g. a plural 'Projects') must never
 *    have it silently overridden by an `objects.<name>.label` translation.
 */
function resolveNavItemLabel(
  item: NavigationItem,
  resolver?: (objectName: string, fallbackLabel: string) => string,
  t?: (key: string, options?: any) => string,
  dashboardResolver?: (dashboardName: string, fallbackLabel: string) => string,
  groupResolver?: (groupId: string, fallbackLabel: string) => string,
  viewResolver?: (objectName: string, viewName: string, fallbackLabel: string) => string,
  itemResolver?: (itemId: string, fallbackLabel: string) => string,
): string {
  const base = resolveLabel(item.label, t);
  // Only apply convention-based resolution for items with plain string labels.
  // I18nLabel objects (with explicit key/defaultValue) already have their own translation keys.
  if (typeof item.label !== 'string') return base;
  // An explicit label that differs from the bare target name was authored on
  // purpose (e.g. a custom plural 'Projects') — never let convention-based
  // i18n resolution override it.
  const isCustomized = (target: string | undefined) =>
    !!target && base.trim().toLowerCase() !== target.trim().toLowerCase();
  if (item.type === 'object' && item.objectName) {
    // View-scoped item — prefer view-specific label so a Kanban / Calendar /
    // custom view in the sidebar doesn't collapse to the parent object's
    // label (which would visually duplicate the object's list entry).
    // Convention: `{ns}.objects.{objectName}._views.{viewName}.label`.
    if (item.viewName) {
      if (isCustomized(item.viewName)) return base;
      if (viewResolver) return viewResolver(item.objectName, item.viewName, base);
      // No view resolver: respect the schema-provided explicit label rather
      // than overriding with the parent object's i18n label.
      return base;
    }
    if (isCustomized(item.objectName)) return base;
    if (resolver) return resolver(item.objectName, base);
  }
  if (item.type === 'dashboard' && (item as any).dashboardName) {
    if (isCustomized((item as any).dashboardName)) return base;
    if (dashboardResolver) return dashboardResolver((item as any).dashboardName, base);
  }
  if (item.type === 'group' && item.id) {
    if (isCustomized(item.id)) return base;
    if (groupResolver) return groupResolver(item.id, base);
  }
  // Fallback for non-object/non-dashboard/non-group items (url, page, report,
  // custom) with a stable id — translate via the per-app navigation namespace.
  if (itemResolver && item.id && !isCustomized(item.id)) {
    return itemResolver(item.id, base);
  }
  return base;
}

// ---------------------------------------------------------------------------
// Default evaluators (always-visible, always-permitted)
// ---------------------------------------------------------------------------

const defaultVisibility: VisibilityEvaluator = (expr) => {
  if (expr === false || expr === 'false') return false;
  return true;
};

const defaultPermission: PermissionChecker = () => true;

const defaultCapability: CapabilityChecker = () => true;

// ---------------------------------------------------------------------------
// Internal helper: resolve href from NavigationItem
// ---------------------------------------------------------------------------

/**
 * Lightweight template-variable context for nav items that target a
 * specific record / org. The shell injects the signed-in user id and
 * active org id; the schema author writes `{current_user_id}` /
 * `{current_org_id}` in `recordId` and the renderer substitutes.
 *
 * Kept intentionally small — anything beyond this should be a Page or
 * a `component`-type nav, not encoded in metadata strings.
 */
export interface NavTemplateContext {
  currentUserId?: string | null;
  currentOrgId?: string | null;
  /**
   * Active values for app-level context selectors (e.g. the Studio
   * package scope). Keyed by the selector's `id`; referenced in nav
   * items as `{<id>}` (e.g. `{active_package}`). Empty/absent values
   * are treated as "no scope" and dropped from the resolved URL.
   */
  contextValues?: Record<string, string | null | undefined>;
}

const TEMPLATE_VAR_RE = /\{(current_user_id|current_org_id|[a-z][a-z0-9_]*)\}/g;

function applyNavTemplate(
  raw: string,
  ctx: NavTemplateContext | undefined,
): string | null {
  if (!raw.includes('{')) return raw;
  let missing = false;
  const out = raw.replace(TEMPLATE_VAR_RE, (_, name: string) => {
    let v: string | null | undefined;
    if (name === 'current_user_id') v = ctx?.currentUserId;
    else if (name === 'current_org_id') v = ctx?.currentOrgId;
    else v = ctx?.contextValues?.[name];
    if (!v) {
      missing = true;
      return '';
    }
    return v;
  });
  return missing ? null : out;
}

/**
 * Resolve a NavigationItem to an absolute href (relative to `basePath`).
 *
 * Single source of truth for nav → URL mapping across the shell. Other
 * surfaces that need to navigate to a nav item (command palette,
 * pinned rail, search results, recent items, etc.) MUST use this helper
 * instead of constructing URLs ad-hoc — otherwise features like
 * `recordId` / `recordMode` / `componentRef` will silently regress.
 */
export function resolveHref(
  item: NavigationItem,
  basePath: string,
  templateContext?: NavTemplateContext,
): { href: string; external: boolean } {
  switch (item.type) {
    case 'object': {
      const objectPath = `${basePath}/${item.objectName ?? ''}`;
      // `recordId` (optionally templated) takes precedence over `viewName`:
      // when set, jump straight to the record detail page instead of the
      // list view. Used by self-service nav entries like "My Profile"
      // (`recordId: '{current_user_id}'`).
      const rawRecordId = (item as any).recordId as string | undefined;
      if (rawRecordId) {
        const resolved = applyNavTemplate(rawRecordId, templateContext);
        if (resolved) {
          const recordHref = `${objectPath}/record/${encodeURIComponent(resolved)}`;
          const mode = (item as any).recordMode as 'view' | 'edit' | undefined;
          return { href: mode === 'edit' ? `${recordHref}/edit` : recordHref, external: false };
        }
        // Template variable couldn't be resolved (e.g. logged-out
        // pre-render). Fall through to the list view so the link is
        // still well-formed rather than a dead `#`.
      }
      // `filters` (#2251) targets the parameterized bare data surface
      // (`/:objectName/data`) instead of a saved view: each entry becomes a
      // `filter[<field>]=<value>` search param. Values pass through the same
      // template substitution as `recordId`; entries whose template can't be
      // resolved are dropped so the link stays well-formed. Precedence:
      // recordId → filters → viewName.
      const navFilters = (item as any).filters as Record<string, string> | undefined;
      if (navFilters && typeof navFilters === 'object' && !Array.isArray(navFilters)) {
        const usp = new URLSearchParams();
        for (const [field, raw] of Object.entries(navFilters)) {
          if (raw === undefined || raw === null || field === '') continue;
          const resolved = applyNavTemplate(String(raw), templateContext);
          if (resolved !== null) usp.set(`filter[${field}]`, resolved);
        }
        const qs = usp.toString();
        return { href: qs ? `${objectPath}/data?${qs}` : `${objectPath}/data`, external: false };
      }
      return { href: item.viewName ? `${objectPath}/view/${item.viewName}` : objectPath, external: false };
    }
    case 'dashboard':
      return { href: item.dashboardName ? `${basePath}/dashboard/${item.dashboardName}` : '#', external: false };
    case 'page': {
      if (!item.pageName) return { href: '#', external: false };
      // Forward `params` as querystring so the page can read them via
      // `useSearchParams()` (PageView already does this). String values
      // additionally pass through `applyNavTemplate` so nav entries can
      // refer to `{current_user_id}` / `{current_org_id}` — exactly like
      // the `recordId` substitution above for object-typed nav items.
      const pageParams = (item as any).params as Record<string, unknown> | undefined;
      let url = `${basePath}/page/${item.pageName}`;
      if (pageParams && typeof pageParams === 'object') {
        const usp = new URLSearchParams();
        for (const [k, v] of Object.entries(pageParams)) {
          if (v === undefined || v === null) continue;
          if (typeof v === 'string') {
            const resolved = applyNavTemplate(v, templateContext);
            if (resolved !== null) usp.set(k, resolved);
          } else {
            usp.set(k, JSON.stringify(v));
          }
        }
        const qs = usp.toString();
        if (qs) url += `?${qs}`;
      }
      return { href: url, external: false };
    }
    case 'report':
      return { href: item.reportName ? `${basePath}/report/${item.reportName}` : '#', external: false };
    case 'url':
      return { href: item.url ?? '#', external: item.target === '_blank' };
    case 'component': {
      // Phase 3b: `componentRef` is colon-joined (e.g. `metadata:resource`).
      // We map it to `/component/<ns>/<name>` so URLs stay clean and
      // React Router can pull the segments via :ns/:name params.
      // Any `params` on the nav item are serialised as querystring so
      // the same component can be reused across many nav entries with
      // different inputs (e.g. `params: { type: 'object' }` vs
      // `params: { type: 'field' }`).
      const ref = (item as any).componentRef as string | undefined;
      if (!ref) return { href: '#', external: false };
      const segs = ref.split(':').filter(Boolean);
      if (segs.length === 0) return { href: '#', external: false };
      const navParams = (item as any).params as Record<string, unknown> | undefined;
      // Special-case metadata refs: route to nested REST-style /metadata paths.
      //   metadata:directory                  → /metadata
      //   metadata:resource (+ params.type)   → /metadata/:type
      //   metadata:resource (+ type + name)   → /metadata/:type/:name
      if (segs[0] === 'metadata') {
        const kind = segs[1];
        const type = navParams && typeof navParams.type === 'string' ? navParams.type : undefined;
        const name = navParams && typeof navParams.name === 'string' ? navParams.name : undefined;
        // Forward any extra params (e.g. `package: '{active_package}'`) as
        // querystring so an app-level context selector transparently scopes
        // every metadata surface. `type`/`name` are encoded in the path, so
        // they're excluded here. Template vars that don't resolve (no active
        // scope) are dropped, leaving a clean unscoped URL.
        let metaQs = '';
        if (navParams && typeof navParams === 'object') {
          const usp = new URLSearchParams();
          for (const [k, v] of Object.entries(navParams)) {
            if (k === 'type' || k === 'name') continue;
            if (v === undefined || v === null) continue;
            if (typeof v === 'string') {
              const resolved = applyNavTemplate(v, templateContext);
              if (resolved) usp.set(k, resolved);
            } else {
              usp.set(k, JSON.stringify(v));
            }
          }
          const qs = usp.toString();
          if (qs) metaQs = `?${qs}`;
        }
        if (kind === 'directory' || !kind) {
          return { href: `${basePath}/metadata${metaQs}`, external: false };
        }
        if (kind === 'resource' && type) {
          const tail = name
            ? `/${encodeURIComponent(type)}/${encodeURIComponent(name)}`
            : `/${encodeURIComponent(type)}`;
          return { href: `${basePath}/metadata${tail}${metaQs}`, external: false };
        }
        return { href: `${basePath}/metadata${metaQs}`, external: false };
      }
      let url = `${basePath}/component/${segs.join('/')}`;
      if (navParams && typeof navParams === 'object') {
        const usp = new URLSearchParams();
        for (const [k, v] of Object.entries(navParams)) {
          if (v === undefined || v === null) continue;
          usp.set(k, typeof v === 'string' ? v : JSON.stringify(v));
        }
        const qs = usp.toString();
        if (qs) url += `?${qs}`;
      }
      return { href: url, external: false };
    }
    default:
      return { href: '#', external: false };
  }
}

// ---------------------------------------------------------------------------
// Active-state matching — the inverse of resolveHref (#2272)
// ---------------------------------------------------------------------------

/**
 * Match-specificity ranks. The whole tree elects EXACTLY ONE active item:
 * every leaf gets a score against the current location and the highest
 * score wins (ties break to tree order). This replaces the old per-item
 * `computeIsActive` prefix heuristics, whose independent per-item decisions
 * needed a special case for every "two rows light up at once" report and
 * could not see search params at all (a `filters` item's href carries
 * `?filter[...]`, so exact-pathname matching never fired — the item never
 * highlighted while its bare-object sibling wrongly claimed `/data`).
 *
 * Ranking, most→least specific:
 *   record deep-link > filters slice > named view > exact non-object href
 *   ≈ exact bare object > object sub-route (weak claim) > boundary prefix.
 *
 * A bare object item weak-claims ALL of its object's sub-routes (`/record`,
 * `/new`, `/view/*`, `/data`) so the user keeps orientation even when no
 * more-specific sibling is registered; when one is, its higher rank wins.
 */
const MATCH_RECORD = 50;
const MATCH_FILTERS = 40;
const MATCH_VIEW = 30;
const MATCH_EXACT = 25;
const MATCH_OBJECT_SUBROUTE = 10;
const MATCH_PREFIX = 5;

/** Collect `filter[<field>]=<value>` search params into a map. */
function parseFilterParams(search: string): Map<string, string> {
  const out = new Map<string, string>();
  new URLSearchParams(search).forEach((value, key) => {
    const m = /^filter\[(.+)\]$/.exec(key);
    if (m && m[1] && value !== '') out.set(m[1], value);
  });
  return out;
}

/**
 * Canonical view ids are qualified (`<object>.<key>`, see MetadataProvider)
 * while nav items usually carry the short key — compare both in short form.
 */
function stripViewQualifier(objectName: string, view: string): string {
  return view.startsWith(`${objectName}.`) ? view.slice(objectName.length + 1) : view;
}

function itemMatchScore(
  item: NavigationItem,
  pathname: string,
  filterParams: Map<string, string>,
  basePath: string,
  ctx: NavTemplateContext | undefined,
): number {
  const { href, external } = resolveHref(item, basePath, ctx);
  if (external || href === '#') return 0;

  if (item.type === 'object' && item.objectName) {
    const objectPath = `${basePath}/${item.objectName}`;
    if (pathname !== objectPath && !pathname.startsWith(`${objectPath}/`)) return 0;
    const segs = pathname === objectPath ? [] : pathname.slice(objectPath.length + 1).split('/');

    // Record deep-link — exact record only. An unresolved template
    // (logged-out pre-render) falls through to the list-style checks,
    // mirroring resolveHref's fallback.
    const rawRecordId = (item as any).recordId as string | undefined;
    if (rawRecordId) {
      const resolved = applyNavTemplate(rawRecordId, ctx);
      if (resolved) {
        return segs[0] === 'record' && decodeURIComponent(segs[1] ?? '') === resolved
          ? MATCH_RECORD
          : 0;
      }
    }

    // Filters slice — active only on `/data` with the SAME filter param
    // set (template-resolved, order-insensitive).
    const navFilters = (item as any).filters as Record<string, string> | undefined;
    if (navFilters && typeof navFilters === 'object' && !Array.isArray(navFilters)) {
      if (segs[0] !== 'data') return 0;
      const want = new Map<string, string>();
      for (const [field, raw] of Object.entries(navFilters)) {
        if (raw === undefined || raw === null || field === '') continue;
        const resolved = applyNavTemplate(String(raw), ctx);
        if (resolved !== null) want.set(field, resolved);
      }
      if (want.size !== filterParams.size) return 0;
      for (const [field, value] of want) {
        if (filterParams.get(field) !== value) return 0;
      }
      return MATCH_FILTERS;
    }

    if (item.viewName) {
      if (segs[0] !== 'view' || !segs[1]) return 0;
      const got = stripViewQualifier(item.objectName, decodeURIComponent(segs[1]));
      const want = stripViewQualifier(item.objectName, item.viewName);
      return got === want ? MATCH_VIEW : 0;
    }

    return segs.length === 0 ? MATCH_EXACT : MATCH_OBJECT_SUBROUTE;
  }

  // Non-object types match against their canonical href (metadata component
  // hrefs may carry a query string — compare pathnames only).
  const hrefPath = href.split('?')[0];
  if (pathname === hrefPath) return MATCH_EXACT;

  // Directory/index components (e.g. `metadata:directory`) link to a parent
  // route that also hosts more-specific child items (`metadata:resource`
  // pointing at `/metadata/:type`) — the index never claims sub-routes.
  const ref = (item as any).componentRef as string | undefined;
  if (ref && ref.split(':')[1] === 'directory') return 0;

  return pathname.startsWith(`${hrefPath}/`) ? MATCH_PREFIX : 0;
}

/**
 * Resolve the SINGLE active navigation item for the current location — the
 * inverse of {@link resolveHref}. Surfaces that need "which menu am I in"
 * (sidebar highlight, breadcrumbs, recents, designer deep-links) MUST use
 * this instead of comparing URL strings ad-hoc; the two functions are
 * round-trip tested together.
 */
export function resolveActiveNavItem(
  items: NavigationItem[],
  pathname: string,
  search: string,
  basePath: string,
  templateContext?: NavTemplateContext,
): NavigationItem | null {
  const filterParams = parseFilterParams(search);
  let best: NavigationItem | null = null;
  let bestScore = 0;
  const visit = (nodes: NavigationItem[] | undefined) => {
    if (!nodes) return;
    for (const node of nodes) {
      if (node.type === 'group') {
        visit(node.children);
        continue;
      }
      const score = itemMatchScore(node, pathname, filterParams, basePath, templateContext);
      if (score > bestScore) {
        best = node;
        bestScore = score;
      }
    }
  };
  visit(items);
  return best;
}

/**
 * The elected active item id, provided once at the tree root by
 * {@link NavigationRenderer} — per-item active state is a plain id
 * comparison, so at most one row can ever highlight.
 */
const ActiveNavIdContext = React.createContext<string | null>(null);

// ---------------------------------------------------------------------------
// Search filter helper
// ---------------------------------------------------------------------------

/**
 * Recursively filter navigation items by search query (case-insensitive label match).
 * Groups are kept if any child matches, with non-matching children pruned.
 */
export function filterNavigationItems(
  items: NavigationItem[],
  query: string,
): NavigationItem[] {
  if (!query.trim()) return items;
  const lowerQuery = query.toLowerCase().trim();

  return items.reduce<NavigationItem[]>((acc, item) => {
    // Separators are excluded during search
    if (item.type === 'separator') return acc;

    // Groups: recursively filter children
    if (item.type === 'group' && item.children?.length) {
      const filteredChildren = filterNavigationItems(item.children, query);
      if (filteredChildren.length > 0) {
        acc.push({ ...item, children: filteredChildren });
      }
      return acc;
    }

    // Leaf items: match label
    if (resolveLabel(item.label).toLowerCase().includes(lowerQuery)) {
      acc.push(item);
    }
    return acc;
  }, []);
}

/** Minimum drag distance in pixels to activate reorder */
const DRAG_ACTIVATION_DISTANCE = 5;

// ---------------------------------------------------------------------------
// SortableNavigationItem (drag-reorder wrapper)
// ---------------------------------------------------------------------------

function SortableNavigationItem({
  item,
  basePath,
  evalVis,
  checkPerm,
  checkCap,
  onAction,
  enablePinning,
  onPinToggle,
  enableReorder,
  resolveObjectLabel,
  resolveDashboardLabel,
  resolveGroupLabel,
  resolveViewLabel,
  resolveItemLabel,
  t: tProp,
  templateContext,
}: {
  item: NavigationItem;
  basePath: string;
  evalVis: VisibilityEvaluator;
  checkPerm: PermissionChecker;
  checkCap: CapabilityChecker;
  onAction?: (item: NavigationItem) => void;
  enablePinning?: boolean;
  onPinToggle?: (itemId: string, pinned: boolean, item?: NavigationItem, basePath?: string) => void;
  enableReorder?: boolean;
  resolveObjectLabel?: (objectName: string, fallbackLabel: string) => string;
  resolveDashboardLabel?: (dashboardName: string, fallbackLabel: string) => string;
  resolveGroupLabel?: (groupId: string, fallbackLabel: string) => string;
  resolveViewLabel?: (objectName: string, viewName: string, fallbackLabel: string) => string;
  resolveItemLabel?: (itemId: string, fallbackLabel: string) => string;
  t?: (key: string, options?: any) => string;
  templateContext?: NavTemplateContext;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !enableReorder });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <NavigationItemRenderer
        item={item}
        basePath={basePath}
        evalVis={evalVis}
        checkPerm={checkPerm}
        checkCap={checkCap}
        onAction={onAction}
        enablePinning={enablePinning}
        onPinToggle={onPinToggle}
        dragListeners={enableReorder ? listeners : undefined}
        resolveObjectLabel={resolveObjectLabel}
        resolveDashboardLabel={resolveDashboardLabel}
        resolveGroupLabel={resolveGroupLabel}
        resolveViewLabel={resolveViewLabel}
        resolveItemLabel={resolveItemLabel}
        t={tProp}
        templateContext={templateContext}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// NavigationItemRenderer (recursive)
// ---------------------------------------------------------------------------

function NavigationItemRenderer({
  item,
  basePath,
  evalVis,
  checkPerm,
  checkCap,
  onAction,
  enablePinning,
  onPinToggle,
  dragListeners,
  resolveObjectLabel,
  resolveDashboardLabel,
  resolveGroupLabel,
  resolveViewLabel,
  resolveItemLabel,
  t: tProp,
  templateContext,
}: {
  item: NavigationItem;
  basePath: string;
  evalVis: VisibilityEvaluator;
  checkPerm: PermissionChecker;
  checkCap: CapabilityChecker;
  onAction?: (item: NavigationItem) => void;
  enablePinning?: boolean;
  onPinToggle?: (itemId: string, pinned: boolean, item?: NavigationItem, basePath?: string) => void;
  dragListeners?: Record<string, any>;
  resolveObjectLabel?: (objectName: string, fallbackLabel: string) => string;
  resolveDashboardLabel?: (dashboardName: string, fallbackLabel: string) => string;
  resolveGroupLabel?: (groupId: string, fallbackLabel: string) => string;
  resolveViewLabel?: (objectName: string, viewName: string, fallbackLabel: string) => string;
  resolveItemLabel?: (itemId: string, fallbackLabel: string) => string;
  t?: (key: string, options?: any) => string;
  templateContext?: NavTemplateContext;
}) {
  // iOS-native mobile drawer polish: >=44px tap targets, larger text and
  // icons, rounder rows. Desktop (>=768px) keeps the compact rail untouched.
  const isMobile = useIsMobile();
  const mobileBtnClass = isMobile ? 'min-h-[44px] text-[15px] gap-3 rounded-xl' : undefined;
  const navIconClass = cn('shrink-0', isMobile ? 'h-5 w-5' : 'h-4 w-4');
  // Resolve the initial open state with platform-aware defaults:
  //
  // 1. `expanded` is the spec field name; `defaultOpen` is the legacy
  //    objectui field name. Honor either when set explicitly so app
  //    authors don't get silently-ignored config.
  // 2. When the author has set neither, default-collapse groups that
  //    have many leaf children. A sidebar group with 10+ items doubles
  //    the rail height and pushes everything below the fold — Slack /
  //    Linear / Notion all default-collapse long sections for the same
  //    reason. Threshold is intentionally conservative (8) so short
  //    sections (typical 3-6 items) still open by default.
  // 3. Always override to open when the current route lives inside the
  //    group — otherwise an auto-collapsed group hides the active item
  //    and the user loses orientation.
  const explicitOpen = (() => {
    const expanded = (item as any).expanded;
    if (typeof expanded === 'boolean') return expanded;
    if (typeof item.defaultOpen === 'boolean') return item.defaultOpen;
    return undefined;
  })();
  const AUTO_COLLAPSE_THRESHOLD = 8;
  const childCount = item.type === 'group' ? (item.children?.length ?? 0) : 0;
  const activeNavId = React.useContext(ActiveNavIdContext);
  const hasActiveDescendant = React.useMemo(() => {
    if (item.type !== 'group' || !activeNavId) return false;
    const visit = (nodes: NavigationItem[] | undefined): boolean =>
      !!nodes?.some(
        (node) => node.id === activeNavId || (node.type === 'group' && visit(node.children)),
      );
    return visit(item.children);
  }, [item, activeNavId]);
  const initialOpen =
    hasActiveDescendant
      ? true
      : (explicitOpen ?? (childCount >= AUTO_COLLAPSE_THRESHOLD ? false : true));
  const [isOpen, setIsOpen] = useState(initialOpen);

  // --- Visibility guard ---
  if (!evalVis(item.visible)) return null;

  // --- Permission guard ---
  if (item.requiredPermissions?.length && !checkPerm(item.requiredPermissions)) return null;

  // --- Capability guard (runtime-feature gates) ---
  // Hide entries whose required object/service is not registered in this
  // runtime — e.g. `sys_app` only exists when the tenant service is loaded.
  const requiresObject = (item as any).requiresObject as string | undefined;
  const requiresService = (item as any).requiresService as string | undefined;
  if (requiresObject && !checkCap('object', requiresObject)) return null;
  if (requiresService && !checkCap('service', requiresService)) return null;

  // --- Separator ---
  if (item.type === 'separator') {
    return <Separator className="my-2" />;
  }

  // --- Group (collapsible) ---
  if (item.type === 'group') {
    const children = (item.children ?? [])
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const groupLabel = resolveNavItemLabel(item, resolveObjectLabel, tProp, resolveDashboardLabel, resolveGroupLabel, resolveViewLabel, resolveItemLabel);

    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <SidebarGroup>
          <SidebarGroupLabel asChild>
            <CollapsibleTrigger className={cn('flex w-full items-center justify-between', isMobile && 'min-h-[44px] text-[15px] rounded-xl')}>
              {groupLabel}
              <ChevronRight
                className={cn('ml-auto transition-transform', isMobile ? 'h-5 w-5' : 'h-4 w-4', isOpen && 'rotate-90')}
              />
            </CollapsibleTrigger>
          </SidebarGroupLabel>
          <CollapsibleContent>
            <SidebarGroupContent>
              <SidebarMenu>
                {children.map((child) => (
                  <NavigationItemRenderer
                    key={child.id}
                    item={child}
                    basePath={basePath}
                    evalVis={evalVis}
                    checkPerm={checkPerm}
                    checkCap={checkCap}
                    onAction={onAction}
                    enablePinning={enablePinning}
                    onPinToggle={onPinToggle}
                    resolveObjectLabel={resolveObjectLabel}
                    resolveDashboardLabel={resolveDashboardLabel}
                    resolveGroupLabel={resolveGroupLabel}
                    resolveViewLabel={resolveViewLabel}
                    resolveItemLabel={resolveItemLabel}
                    t={tProp}
                    templateContext={templateContext}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>
    );
  }

  // --- Action ---
  if (item.type === 'action') {
    const Icon = resolveIcon(item.icon);
    const actionLabel = resolveLabel(item.label, tProp);
    return (
      <SidebarMenuItem>
        {dragListeners && (
          <span
            className="absolute left-0.5 top-1/2 -translate-y-1/2 cursor-grab text-muted-foreground"
            aria-label={tProp ? tProp('console.nav.dragToReorder', { defaultValue: 'Drag to reorder' }) : 'Drag to reorder'}
            {...dragListeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
        )}
        <SidebarMenuButton
          tooltip={actionLabel}
          onClick={() => onAction?.(item)}
          className={mobileBtnClass}
        >
          <Icon className={navIconClass} />
          <span>{actionLabel}</span>
          {item.badge != null && (
            <Badge variant={item.badgeVariant ?? 'default'} className="ml-auto text-[10px] px-1.5 py-0">
              {item.badge}
            </Badge>
          )}
        </SidebarMenuButton>
        {enablePinning && onPinToggle && (
          <SidebarMenuAction
            showOnHover
            onClick={() => onPinToggle(item.id, !item.pinned, item, basePath)}
            aria-label={
              tProp
                ? tProp(item.pinned ? 'console.nav.unpinItem' : 'console.nav.pinItem', {
                    defaultValue: item.pinned ? `Unpin ${actionLabel}` : `Pin ${actionLabel}`,
                    name: actionLabel,
                  })
                : (item.pinned ? `Unpin ${actionLabel}` : `Pin ${actionLabel}`)
            }
          >
            {item.pinned ? (
              <PinOff className="h-3.5 w-3.5" />
            ) : (
              <Pin className="h-3.5 w-3.5" />
            )}
          </SidebarMenuAction>
        )}
      </SidebarMenuItem>
    );
  }

  // --- Leaf items (object / dashboard / page / report / url) ---
  const Icon = resolveIcon(item.icon);
  const { href, external } = resolveHref(item, basePath, templateContext);
  const isActive = activeNavId !== null && item.id === activeNavId;
  const itemLabel = resolveNavItemLabel(item, resolveObjectLabel, tProp, resolveDashboardLabel, resolveGroupLabel, resolveViewLabel, resolveItemLabel);

  const content = (
    <>
      <Icon className={navIconClass} />
      <span>{itemLabel}</span>
      {item.badge != null && (
        <Badge variant={item.badgeVariant ?? 'default'} className="ml-auto text-[10px] px-1.5 py-0">
          {item.badge}
        </Badge>
      )}
    </>
  );

  return (
    <SidebarMenuItem>
      {dragListeners && (
        <span
          className="absolute left-0.5 top-1/2 -translate-y-1/2 cursor-grab text-muted-foreground"
          aria-label={tProp ? tProp('console.nav.dragToReorder', { defaultValue: 'Drag to reorder' }) : 'Drag to reorder'}
          {...dragListeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
      )}
      <SidebarMenuButton asChild isActive={isActive} tooltip={itemLabel} className={mobileBtnClass}>
        {external ? (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {content}
          </a>
        ) : (
          <Link to={href}>
            {content}
          </Link>
        )}
      </SidebarMenuButton>
      {enablePinning && onPinToggle && (
        <SidebarMenuAction
          showOnHover
          onClick={() => onPinToggle(item.id, !item.pinned, item, basePath)}
          aria-label={
            tProp
              ? tProp(item.pinned ? 'console.nav.unpinItem' : 'console.nav.pinItem', {
                  defaultValue: item.pinned ? `Unpin ${itemLabel}` : `Pin ${itemLabel}`,
                  name: itemLabel,
                })
              : (item.pinned ? `Unpin ${itemLabel}` : `Pin ${itemLabel}`)
          }
        >
          {item.pinned ? (
            <PinOff className="h-3.5 w-3.5" />
          ) : (
            <Pin className="h-3.5 w-3.5" />
          )}
        </SidebarMenuAction>
      )}
    </SidebarMenuItem>
  );
}

// ---------------------------------------------------------------------------
// NavigationRenderer (main export)
// ---------------------------------------------------------------------------

/**
 * Renders a `NavigationItem[]` tree into Shadcn Sidebar components.
 *
 * Features:
 * - 7 navigation item types + separators
 * - Nested collapsible groups
 * - Badge indicators
 * - Visibility expression evaluation
 * - RBAC permission guards
 * - Active-route highlighting
 * - Search filtering across navigation tree
 * - Pin/favorite items with dedicated "Favorites" section
 * - Drag-to-reorder navigation items
 *
 * @example
 * ```tsx
 * <NavigationRenderer
 *   items={appSchema.navigation}
 *   basePath="/apps/crm"
 *   evaluateVisibility={(expr) => evaluateVisibility(expr, evaluator)}
 *   checkPermission={(perms) => perms.every(p => can(p))}
 *   searchQuery={searchTerm}
 *   enablePinning
 *   onPinToggle={(id, pinned) => updatePin(id, pinned)}
 *   enableReorder
 *   onReorder={(items) => saveOrder(items)}
 * />
 * ```
 */
export function NavigationRenderer({
  items,
  basePath = '',
  evaluateVisibility: evalVis = defaultVisibility,
  checkPermission: checkPerm = defaultPermission,
  checkCapability: checkCap = defaultCapability,
  onAction,
  searchQuery,
  enablePinning,
  onPinToggle,
  enableReorder,
  onReorder,
  resolveObjectLabel,
  resolveDashboardLabel,
  resolveGroupLabel,
  resolveViewLabel,
  resolveItemLabel,
  t: tProp,
  templateContext,
}: NavigationRendererProps) {
  // --- Active item election (#2272) — computed ONCE for the whole tree
  // against the full (unfiltered) item list, so search filtering never
  // changes what counts as active. Per-item state is an id comparison.
  const location = useLocation();
  const activeNavId = useMemo(
    () =>
      resolveActiveNavItem(items, location.pathname, location.search, basePath, templateContext)
        ?.id ?? null,
    [items, location.pathname, location.search, basePath, templateContext],
  );

  // --- Search filtering ---
  const filteredItems = useMemo(
    () => (searchQuery ? filterNavigationItems(items, searchQuery) : items),
    [items, searchQuery],
  );

  // --- Pinned items (favorites section) ---
  const pinnedItems = useMemo(
    () => collectPinnedItems(filteredItems),
    [filteredItems],
  );

  // --- Sort top-level items by order ---
  const sorted = filteredItems.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // --- Drag-reorder sensors ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;

    const oldIndex = sorted.findIndex((i) => i.id === active.id);
    const newIndex = sorted.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sorted, oldIndex, newIndex).map((item, idx) => ({
      ...item,
      order: idx,
    }));
    onReorder(reordered);
  };

  // --- Shared renderer props ---
  const itemProps = {
    basePath,
    evalVis,
    checkPerm,
    checkCap,
    onAction,
    enablePinning,
    onPinToggle,
    resolveObjectLabel,
    resolveDashboardLabel,
    resolveGroupLabel,
    resolveViewLabel,
    resolveItemLabel,
    t: tProp,
    templateContext,
  };

  const hasGroups = sorted.some((i) => i.type === 'group');

  // --- Favorites section (pinned items) ---
  const favoritesSection = pinnedItems.length > 0 && enablePinning ? (
    <SidebarGroup>
      <SidebarGroupLabel className="flex items-center gap-1.5">
        <Star className="h-3.5 w-3.5" />
        {tProp ? tProp('console.nav.favorites', { defaultValue: 'Favorites' }) : 'Favorites'}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {pinnedItems.map((item) => (
            <NavigationItemRenderer
              key={`fav-${item.id}`}
              item={item}
              {...itemProps}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  ) : null;

  // --- No explicit groups → wrap in a single SidebarGroup ---
  if (!hasGroups) {
    const topLevelIds = sorted.filter((i) => i.type !== 'group').map((i) => i.id);

    const menuContent = enableReorder ? (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={topLevelIds} strategy={verticalListSortingStrategy}>
          <SidebarMenu>
            {sorted.map((item) => (
              <SortableNavigationItem
                key={item.id}
                item={item}
                enableReorder={enableReorder}
                {...itemProps}
              />
            ))}
          </SidebarMenu>
        </SortableContext>
      </DndContext>
    ) : (
      <SidebarMenu>
        {sorted.map((item) => (
          <NavigationItemRenderer
            key={item.id}
            item={item}
            {...itemProps}
          />
        ))}
      </SidebarMenu>
    );

    return (
      <ActiveNavIdContext.Provider value={activeNavId}>
        {favoritesSection}
        <SidebarGroup>
          <SidebarGroupContent>
            {menuContent}
          </SidebarGroupContent>
        </SidebarGroup>
      </ActiveNavIdContext.Provider>
    );
  }

  // Mixed content: render groups inline, wrap consecutive leaf items
  const fragments: React.ReactNode[] = [];
  let leafBuffer: NavigationItem[] = [];

  const flushLeaves = (key: string) => {
    if (leafBuffer.length === 0) return;
    const leaves = leafBuffer;
    leafBuffer = [];
    fragments.push(
      <SidebarGroup key={key}>
        <SidebarGroupContent>
          <SidebarMenu>
            {leaves.map((item) => (
              <NavigationItemRenderer
                key={item.id}
                item={item}
                {...itemProps}
              />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>,
    );
  };

  sorted.forEach((item, idx) => {
    if (item.type === 'group') {
      flushLeaves(`leaf-${idx}`);
      fragments.push(
        <NavigationItemRenderer
          key={item.id}
          item={item}
          {...itemProps}
        />,
      );
    } else {
      leafBuffer.push(item);
    }
  });

  flushLeaves('leaf-end');

  return (
    <ActiveNavIdContext.Provider value={activeNavId}>
      {favoritesSection}
      {fragments}
    </ActiveNavIdContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Helper: collect all pinned items (leaf-only) from a navigation tree
// ---------------------------------------------------------------------------

function collectPinnedItems(items: NavigationItem[]): NavigationItem[] {
  const pinned: NavigationItem[] = [];
  for (const item of items) {
    if (item.pinned && item.type !== 'group' && item.type !== 'separator') {
      pinned.push(item);
    }
    if (item.children?.length) {
      pinned.push(...collectPinnedItems(item.children));
    }
  }
  return pinned;
}
