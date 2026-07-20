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
import type { AppSchema, NavigationItem, NavigationArea } from '@object-ui/types';
import { menuItemToNavigationItem } from '@object-ui/types';
import { AppShell, type AppShellBranding } from './AppShell';
import {
  NavigationRenderer,
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
  schema: AppSchema;

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

function AreaSwitcher({
  areas,
  activeAreaId,
  onAreaChange,
  evalVis,
  checkPerm,
}: {
  areas: NavigationArea[];
  activeAreaId: string;
  onAreaChange: (id: string) => void;
  evalVis: VisibilityEvaluator;
  checkPerm: PermissionChecker;
}) {
  // Filter areas by visibility & permissions
  const visibleAreas = areas.filter((a) => {
    if (!evalVis(a.visible)) return false;
    if (a.requiredPermissions?.length && !checkPerm(a.requiredPermissions)) return false;
    return true;
  });

  if (visibleAreas.length <= 1) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex items-center gap-1.5">
        <Layers className="h-3.5 w-3.5" />
        Area
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {visibleAreas.map((area) => {
            const AreaIcon = resolveIcon(area.icon);
            return (
              <SidebarMenuItem key={area.id}>
                <SidebarMenuButton
                  isActive={area.id === activeAreaId}
                  tooltip={resolveLabel(area.label)}
                  onClick={() => onAreaChange(area.id)}
                >
                  <AreaIcon className="h-4 w-4" />
                  <span>{resolveLabel(area.label)}</span>
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
          const ref = (item as any).componentRef as string | undefined;
          if (ref) {
            const segs = ref.split(':').filter(Boolean);
            href = `${basePath}/component/${segs.join('/')}`;
            const navParams = (item as any).params as Record<string, unknown> | undefined;
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
  activeAreaId,
  setActiveAreaId,
  resolvedNavigation,
  enableSearch,
  enablePinning,
  onPinToggle,
  enableReorder,
  onReorder,
}: {
  schema: AppSchema;
  basePath: string;
  evalVis: VisibilityEvaluator;
  checkPerm: PermissionChecker;
  checkCap: CapabilityChecker;
  onAction?: (item: NavigationItem) => void;
  sidebarHeader?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  sidebarExtra?: React.ReactNode;
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
  const areas = schema.areas ?? [];
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
        {/* Area Switcher */}
        {areas.length > 1 && activeAreaId && (
          <AreaSwitcher
            areas={areas}
            activeAreaId={activeAreaId}
            onAreaChange={setActiveAreaId}
            evalVis={evalVis}
            checkPerm={checkPerm}
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
 * - Area switcher when multiple `areas` are defined
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
  const areas = schema.areas ?? [];
  const [activeAreaId, setActiveAreaId] = useState<string | null>(
    () => areas.length > 0 ? areas[0].id : null,
  );

  const areaIds = areas.map((a) => a.id).join(',');

  useEffect(() => {
    if (areas.length > 0) {
      setActiveAreaId((prev) =>
        areas.some((a) => a.id === prev) ? prev : areas[0].id,
      );
    } else {
      setActiveAreaId(null);
    }
  }, [schema.name, areaIds]);

  const activeArea = areas.find((a) => a.id === activeAreaId);
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
      activeAreaId={activeAreaId}
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
