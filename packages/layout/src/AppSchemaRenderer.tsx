/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/layout - AppSchema Renderer
 *
 * Consumes an `AppSchema` JSON object and renders a complete application
 * shell with branding, sidebar navigation (including area switching),
 * and mobile navigation modes.
 *
 * This is the main P0.1 deliverable — it allows Console (or any consumer)
 * to render a fully-functional AppShell from a single JSON document.
 *
 * @module AppSchemaRenderer
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Layers } from 'lucide-react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarInput,
  useSidebar,
} from '@object-ui/components';
import type { AppComponentSchema, NavigationItem, NavigationArea } from '@object-ui/types';
import { menuItemToNavigationItem } from '@object-ui/types';
// Aliased on import, following PR #4169's convention: this repo has its OWN
// `resolveI18nLabel` over a DIFFERENT vocabulary, and neither accepts the
// other's shape. See `resolveAreaLabel` below for which is which.
import { resolveI18nLabel as resolveInlineI18nLabel } from '@objectstack/spec/ui';
import { AppShell, type AppShellBranding } from './AppShell';
import {
  NavigationRenderer,
  hasVisibleNavigationItems,
  resolveIcon,
  resolveLabel,
  type VisibilityEvaluator,
  type PermissionChecker,
  type CapabilityChecker,
} from './NavigationRenderer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Mobile navigation display mode */
export type MobileNavMode = 'drawer' | 'bottom_nav' | 'hamburger';

export interface AppSchemaRendererProps {
  /** The AppSchema JSON to render */
  schema: AppComponentSchema;

  /** Base URL prefix for generated hrefs (e.g. "/apps/crm") */
  basePath?: string;

  /** Mobile navigation mode @default "drawer" */
  mobileNavMode?: MobileNavMode;

  /** Optional visibility evaluator passed to NavigationRenderer */
  evaluateVisibility?: VisibilityEvaluator;

  /** Optional permission checker passed to NavigationRenderer */
  checkPermission?: PermissionChecker;

  /** Optional capability checker passed to NavigationRenderer (gates `requiresObject` / `requiresService`) */
  checkCapability?: CapabilityChecker;

  /** Called when an action-type navigation item is clicked */
  onAction?: (item: NavigationItem) => void;

  /** Slot: top navbar content (rendered beside the sidebar trigger) */
  navbar?: React.ReactNode;

  /** Slot: sidebar header (e.g. app switcher dropdown). Replaces default branding header when provided. */
  sidebarHeader?: React.ReactNode;

  /** Slot: sidebar footer (e.g. user profile menu) */
  sidebarFooter?: React.ReactNode;

  /** Slot: extra sidebar content rendered after navigation (e.g. favorites, recent items) */
  sidebarExtra?: React.ReactNode;

  /** Page content */
  children: React.ReactNode;

  /** Extra class on the <main> content area */
  className?: string;

  /** Whether the sidebar starts open @default true */
  defaultOpen?: boolean;

  // --- P1.7 Navigation Enhancements ---

  /** Show a search input in the sidebar to filter navigation items */
  enableSearch?: boolean;

  /** Enable pin/favorite toggle on navigation items */
  enablePinning?: boolean;

  /** Called when a navigation item is pinned or unpinned */
  onPinToggle?: (itemId: string, pinned: boolean, item?: NavigationItem, basePath?: string) => void;

  /** Enable drag-to-reorder for navigation items */
  enableReorder?: boolean;

  /** Called when navigation items are reordered via drag */
  onReorder?: (reorderedItems: NavigationItem[]) => void;
}

// ---------------------------------------------------------------------------
// AreaSwitcher
// ---------------------------------------------------------------------------

/**
 * Renders the switcher for the areas the current user can still see.
 *
 * Areas carry no authorable gate of their own: `@objectstack/spec` 17.0.0
 * retired `visible` and `requiredPermissions` at area level
 * (`AREA_VISIBLE_RETIRED` / `AREA_REQUIRED_PERMISSIONS_RETIRED`) — an area is
 * a layout grouping, not an access boundary, so gating belongs on the
 * navigation ITEM, which `NavigationRenderer` still enforces via the same
 * `evalVis` / `checkPerm` this component used to apply one level up. The
 * spec's area object is `.strict()`, so no v17-valid app can carry the
 * retired keys.
 *
 * Area visibility is instead DERIVED (objectui#3311): `AppSchemaRenderer`
 * lists an area here iff `hasVisibleNavigationItems` finds at least one item
 * in it that survives the item-level guards. An area whose items are all
 * gated away disappears from the switcher — the same UX the retired keys used
 * to produce — without resurrecting any authorable key for the platform's
 * strict schema to reject. An area with no items at all derives the same way
 * (no visible item → hidden).
 */
/**
 * Resolve a `NavigationArea.label` — the spec's `I18nLabel` — to display text.
 *
 * ## Why the spec's resolver and not this package's `resolveLabel`
 *
 * There are two label vocabularies in play and they are NOT interchangeable
 * (objectui#4167 renamed objectui's own resolver to keep them apart):
 *
 *  - `NavigationItem.label` is objectui's KEYED ref — a translation key plus a
 *    default (`{ key, defaultValue, params }`) — resolved by {@link resolveLabel}
 *    against an injected `t`;
 *  - `NavigationArea.label` is `@objectstack/spec`'s `I18nLabel`, which
 *    17.0.0-rc.6 widened from `string` to `string | Record<string, string>` —
 *    the INLINE per-locale map the author writes directly in the metadata.
 *
 * Feeding a map to the keyed resolver returns `undefined` (no `key`, no
 * `defaultValue`); feeding it to `String()` renders `[object Object]`. So this
 * uses the producer's own shared resolver, `resolveI18nLabel` from
 * `@objectstack/spec/ui`, which is the single rule for that vocabulary on both
 * ends of the platform (objectstack#6761).
 *
 * ## Why no locale is threaded — a deliberate choice, not an omission
 *
 * `@object-ui/layout` carries **no i18n dependency by design**: this package's
 * whole i18n story is injection (`NavigationRenderer` takes `t` and the label
 * resolvers as arguments — "enables convention-based i18n auto-resolution
 * without coupling the layout package to i18n"), and `AppSchemaRendererProps`
 * exposes no locale, no `t`, and no context that carries one. Reaching for
 * `@object-ui/i18n` here to read the live UI language would add exactly the
 * coupling that design forbids, so the resolver is called with `undefined`,
 * which it documents as "no locale known" and resolves as `en` — the platform's
 * source language.
 *
 * The observable consequence, stated rather than hidden: an area whose label is
 * an inline map renders its `en` entry (then `default`, then any entry) instead
 * of the viewer's language. That is strictly better than `[object Object]`, and
 * it is a floor, not a ceiling — the day a consumer needs per-viewer area
 * labels, the fix is to thread a locale down as a prop from the host that
 * already knows it, and this call is the one place it lands. Deliberately not
 * done pre-emptively: no consumer of `AppSchemaRenderer` in this repo has a
 * locale to give it today.
 */
function resolveAreaLabel(label: NavigationArea['label']): string {
  return resolveInlineI18nLabel(label, undefined) ?? '';
}

function AreaSwitcher({
  areas,
  activeAreaId,
  onAreaChange,
}: {
  areas: NavigationArea[];
  activeAreaId: string;
  onAreaChange: (id: string) => void;
}) {
  if (areas.length <= 1) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex items-center gap-1.5">
        <Layers className="h-3.5 w-3.5" />
        Area
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {areas.map((area) => {
            const AreaIcon = resolveIcon(area.icon);
            // `NavigationArea.label` is the spec's `I18nLabel`, which since
            // `@objectstack/spec` 17.0.0-rc.6 is `string | Record<string, string>` —
            // an author may inline `{ en: 'Sales', 'zh-CN': '销售' }` here.
            const areaLabel = resolveAreaLabel(area.label);
            return (
              <SidebarMenuItem key={area.id}>
                <SidebarMenuButton
                  isActive={area.id === activeAreaId}
                  tooltip={areaLabel}
                  onClick={() => onAreaChange(area.id)}
                >
                  <AreaIcon className="h-4 w-4" />
                  <span>{areaLabel}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

// ---------------------------------------------------------------------------
// MobileBottomNav
// ---------------------------------------------------------------------------

function MobileBottomNav({
  items,
  basePath,
}: {
  items: NavigationItem[];
  basePath: string;
}) {
  const location = useLocation();
  // Show up to 5 non-group leaf items. Flatten group children so apps that
  // organise navigation into groups (e.g. Setup → Overview / Administration /
  // …) still surface real links in the mobile bottom nav.
  const collectLeaves = (list: typeof items): typeof items => {
    const out: typeof items = [];
    for (const item of list) {
      if (item.type === 'separator') continue;
      if (item.type === 'group') {
        out.push(...collectLeaves(item.children || []));
      } else {
        out.push(item);
      }
    }
    return out;
  };
  const leaves = collectLeaves(items).slice(0, 5);

  if (leaves.length === 0) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t bg-background/95 backdrop-blur-sm px-2 py-1 sm:hidden safe-area-bottom"
      role="navigation"
      aria-label="Mobile navigation"
    >
      {leaves.map((item) => {
        const NavIcon = resolveIcon(item.icon);
        let href = '#';
        if (item.type === 'object') {
          href = `${basePath}/${item.objectName}`;
          if (item.viewName) href += `/view/${item.viewName}`;
        }
        else if (item.type === 'dashboard') href = item.dashboardName ? `${basePath}/dashboard/${item.dashboardName}` : '#';
        else if (item.type === 'page') href = item.pageName ? `${basePath}/page/${item.pageName}` : '#';
        else if (item.type === 'report') href = item.reportName ? `${basePath}/report/${item.reportName}` : '#';
        else if (item.type === 'url') href = item.url ?? '#';
        else if (item.type === 'component') {
          const ref = item.componentRef;
          if (ref) {
            const segs = ref.split(':').filter(Boolean);
            href = `${basePath}/component/${segs.join('/')}`;
            const navParams = item.params;
            if (navParams) {
              const usp = new URLSearchParams();
              for (const [k, v] of Object.entries(navParams)) {
                if (v === undefined || v === null) continue;
                usp.set(k, typeof v === 'string' ? v : JSON.stringify(v));
              }
              const qs = usp.toString();
              if (qs) href += `?${qs}`;
            }
          }
        }

        const isActive = href !== '#' && location.pathname.startsWith(href);

        return (
          <Link
            key={item.id}
            to={href}
            className={`flex flex-col items-center gap-0.5 px-2 py-1.5 transition-colors min-w-[44px] min-h-[44px] justify-center ${
              isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <NavIcon className="h-5 w-5" />
            <span className="text-[10px] truncate max-w-[60px]">{resolveLabel(item.label)}</span>
          </Link>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// InternalSidebar (wraps Sidebar primitive + header + navigation)
// ---------------------------------------------------------------------------

function InternalSidebar({
  schema,
  basePath,
  evalVis,
  checkPerm,
  checkCap,
  onAction,
  sidebarHeader,
  sidebarFooter,
  sidebarExtra,
  visibleAreas,
  activeAreaId,
  setActiveAreaId,
  resolvedNavigation,
  enableSearch,
  enablePinning,
  onPinToggle,
  enableReorder,
  onReorder,
}: {
  schema: AppComponentSchema;
  basePath: string;
  evalVis: VisibilityEvaluator;
  checkPerm: PermissionChecker;
  checkCap: CapabilityChecker;
  onAction?: (item: NavigationItem) => void;
  sidebarHeader?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  sidebarExtra?: React.ReactNode;
  /** Areas with at least one visible item — derived, not authored (#3311). */
  visibleAreas: NavigationArea[];
  activeAreaId: string | null;
  setActiveAreaId: (id: string) => void;
  resolvedNavigation: NavigationItem[];
  enableSearch?: boolean;
  enablePinning?: boolean;
  onPinToggle?: (itemId: string, pinned: boolean, item?: NavigationItem, basePath?: string) => void;
  enableReorder?: boolean;
  onReorder?: (reorderedItems: NavigationItem[]) => void;
}) {
  const Icon = resolveIcon(schema.logo);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <Sidebar collapsible="icon">
      {/* Header: custom slot or default branding */}
      <SidebarHeader>
        {sidebarHeader ?? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" tooltip={schema.title ?? schema.name}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  {schema.logo && schema.logo.startsWith('http') ? (
                    <img
                      src={schema.logo}
                      alt={schema.title ?? ''}
                      className="size-6 object-contain"
                    />
                  ) : (
                    // eslint-disable-next-line react-hooks/static-components -- resolveIcon returns a stable icon component from a static registry, not a component created during render
                    <Icon className="size-4" />
                  )}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {schema.title ?? schema.name ?? 'App'}
                  </span>
                  {schema.description && (
                    <span className="truncate text-xs text-muted-foreground">
                      {schema.description}
                    </span>
                  )}
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
        {/* Search input */}
        {enableSearch && (
          <SidebarInput
            placeholder="Search navigation…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search navigation"
          />
        )}
      </SidebarHeader>

      <SidebarContent>
        {/* Area Switcher — only areas with a visible item, and only when
            there is more than one of them left to switch between (#3311) */}
        {visibleAreas.length > 1 && activeAreaId && (
          <AreaSwitcher
            areas={visibleAreas}
            activeAreaId={activeAreaId}
            onAreaChange={setActiveAreaId}
          />
        )}

        {/* Navigation tree */}
        <NavigationRenderer
          items={resolvedNavigation}
          basePath={basePath}
          evaluateVisibility={evalVis}
          checkPermission={checkPerm}
          checkCapability={checkCap}
          onAction={onAction}
          searchQuery={searchQuery}
          enablePinning={enablePinning}
          onPinToggle={onPinToggle}
          enableReorder={enableReorder}
          onReorder={onReorder}
        />

        {/* Extra sidebar content slot (e.g. favorites, recent items) */}
        {sidebarExtra}
      </SidebarContent>

      {/* Optional footer slot */}
      {sidebarFooter && <SidebarFooter>{sidebarFooter}</SidebarFooter>}
    </Sidebar>
  );
}

// ---------------------------------------------------------------------------
// AppSchemaRenderer (main export)
// ---------------------------------------------------------------------------

/**
 * Renders a complete application shell from an `AppSchema` JSON document.
 *
 * Responsibilities:
 * - Reads `name`, `title`, `description`, `logo`, `favicon` for branding
 * - Renders sidebar navigation from `navigation` or `areas[].navigation`
 * - Area switcher when multiple areas are VISIBLE — area visibility is
 *   derived from the items inside, not authored (objectui#3311): an area
 *   whose items are all gated away is hidden and never auto-activated
 * - Mobile modes: `drawer` (sheet overlay, default), `bottom_nav` (fixed
 *   bottom bar), `hamburger` (collapsed sidebar)
 * - Evaluates `visible` expressions and `requiredPermissions` on every item
 *
 * @example
 * ```tsx
 * <AppSchemaRenderer
 *   schema={appJson}
 *   basePath="/apps/sales"
 *   mobileNavMode="bottom_nav"
 *   evaluateVisibility={(expr) => evaluateVisibility(expr, evaluator)}
 *   checkPermission={(perms) => perms.every(p => can(p))}
 * >
 *   <Outlet />
 * </AppSchemaRenderer>
 * ```
 */
export function AppSchemaRenderer({
  schema,
  basePath = '',
  mobileNavMode = 'drawer',
  evaluateVisibility: evalVisProp,
  checkPermission: checkPermProp,
  checkCapability: checkCapProp,
  onAction,
  navbar,
  sidebarHeader,
  sidebarFooter,
  sidebarExtra,
  children,
  className,
  defaultOpen = true,
  enableSearch,
  enablePinning,
  onPinToggle,
  enableReorder,
  onReorder,
}: AppSchemaRendererProps) {
  // Default evaluators
  const evalVis: VisibilityEvaluator = evalVisProp ?? ((expr) => {
    if (expr === false || expr === 'false') return false;
    return true;
  });
  const checkPerm: PermissionChecker = checkPermProp ?? (() => true);
  const checkCap: CapabilityChecker = checkCapProp ?? (() => true);

  // --- Resolve navigation from legacy `menu` or modern `navigation`/`areas` ---
  const legacyNavigation = useMemo(
    () => (schema.menu ?? []).map((m, i) => menuItemToNavigationItem(m, i)),
    [schema.menu],
  );
  const flatNavigation = schema.navigation ?? legacyNavigation;

  // --- Area management ---
  //
  // Area visibility is DERIVED from the items inside (objectui#3311): an area
  // is visible iff at least one of its navigation items survives the same
  // item-level guards `NavigationRenderer` applies (`visible`,
  // `requiredPermissions`, runtime capabilities, action-dispatcher presence).
  // Spec 17.0.0 retired the authorable area-level keys; this derivation
  // restores the "fully gated area disappears" UX without any authorable key.
  // The active area is elected among the VISIBLE areas only, so the user is
  // never landed in — or stranded on — an area that renders nothing.
  const areas = schema.areas ?? [];
  const visibleAreas = areas.filter((area) =>
    hasVisibleNavigationItems(area.navigation, {
      evaluateVisibility: evalVis,
      checkPermission: checkPerm,
      checkCapability: checkCap,
      hasActionHandler: !!onAction,
    }),
  );
  const [activeAreaId, setActiveAreaId] = useState<string | null>(
    () => visibleAreas.length > 0 ? visibleAreas[0].id : null,
  );

  const visibleAreaIds = visibleAreas.map((a) => a.id).join(',');

  useEffect(() => {
    if (visibleAreas.length > 0) {
      setActiveAreaId((prev) =>
        visibleAreas.some((a) => a.id === prev) ? prev : visibleAreas[0].id,
      );
    } else {
      setActiveAreaId(null);
    }
  }, [schema.name, visibleAreaIds]);

  // Resolve the EFFECTIVE active area at render time rather than trusting the
  // state: when a gating change hides the currently active area, the effect
  // above re-elects on the next tick — this fallback keeps the in-between
  // frame from rendering the hidden area's (empty) navigation.
  const activeArea =
    visibleAreas.find((a) => a.id === activeAreaId) ?? visibleAreas[0];
  const resolvedNavigation: NavigationItem[] = activeArea?.navigation ?? flatNavigation;

  // --- Branding ---
  const branding: AppShellBranding = {
    title: schema.title,
    favicon: schema.favicon,
    logo: schema.logo,
  };

  // --- Build sidebar element ---
  const sidebarElement = (
    <InternalSidebar
      schema={schema}
      basePath={basePath}
      evalVis={evalVis}
      checkPerm={checkPerm}
      checkCap={checkCap}
      onAction={onAction}
      sidebarHeader={sidebarHeader}
      sidebarFooter={sidebarFooter}
      sidebarExtra={sidebarExtra}
      visibleAreas={visibleAreas}
      activeAreaId={activeArea?.id ?? null}
      setActiveAreaId={setActiveAreaId}
      resolvedNavigation={resolvedNavigation}
      enableSearch={enableSearch}
      enablePinning={enablePinning}
      onPinToggle={onPinToggle}
      enableReorder={enableReorder}
      onReorder={onReorder}
    />
  );

  // --- Mobile bottom nav (shown alongside drawer sidebar on mobile) ---
  const showBottomNav = mobileNavMode === 'bottom_nav';

  return (
    <>
      <AppShell
        sidebar={sidebarElement}
        navbar={navbar}
        className={className}
        defaultOpen={defaultOpen}
        branding={branding}
      >
        {children}
      </AppShell>
      {showBottomNav && (
        <MobileBottomNav items={resolvedNavigation} basePath={basePath} />
      )}
    </>
  );
}
