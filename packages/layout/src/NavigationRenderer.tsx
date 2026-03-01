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
import * as LucideIcons from 'lucide-react';
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

  /** Called when an `action`-type item is clicked */
  onAction?: (item: NavigationItem) => void;

  // --- P1.7 Navigation Enhancements ---

  /** Search query to filter navigation items by label */
  searchQuery?: string;

  /** Enable pin/favorite toggle on navigation items */
  enablePinning?: boolean;

  /** Called when a navigation item is pinned or unpinned */
  onPinToggle?: (itemId: string, pinned: boolean) => void;

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
}

// ---------------------------------------------------------------------------
// Icon Helper
// ---------------------------------------------------------------------------

const iconCache = new Map<string, React.ComponentType<any>>();

/**
 * Resolve a Lucide icon component by name string.
 * Supports PascalCase, camelCase, and kebab-case.
 */
export function resolveIcon(name?: string): React.ComponentType<any> {
  if (!name) return LucideIcons.FileText;

  const cached = iconCache.get(name);
  if (cached) return cached;

  // Direct match
  if ((LucideIcons as any)[name]) {
    iconCache.set(name, (LucideIcons as any)[name]);
    return (LucideIcons as any)[name];
  }

  // kebab-case → PascalCase
  const pascal = name
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
  if ((LucideIcons as any)[pascal]) {
    iconCache.set(name, (LucideIcons as any)[pascal]);
    return (LucideIcons as any)[pascal];
  }

  return LucideIcons.FileText;
}

// ---------------------------------------------------------------------------
// I18nLabel resolver
// ---------------------------------------------------------------------------

/**
 * Resolve a NavigationItem label to a plain string.
 * Handles both plain strings and I18nLabel objects { key, defaultValue }.
 * This is a basic client-side fallback resolver — actual i18n translation
 * is performed at the application level by passing labels through the
 * i18n `t()` function (e.g. via resolveI18nLabel in the console).
 */
export function resolveLabel(label: string | { key: string; defaultValue?: string; params?: Record<string, any> }): string {
  if (typeof label === 'string') return label;
  return label.defaultValue || label.key;
}

/**
 * Resolve a navigation item label, applying convention-based i18n for object-type items
 * when a `resolveObjectLabel` callback is provided.
 */
function resolveItemLabel(
  item: NavigationItem,
  resolver?: (objectName: string, fallbackLabel: string) => string,
): string {
  const base = resolveLabel(item.label);
  // Only apply convention-based resolution for object-type items with plain string labels.
  // I18nLabel objects (with explicit key/defaultValue) already have their own translation keys.
  if (resolver && item.type === 'object' && item.objectName && typeof item.label === 'string') {
    return resolver(item.objectName, base);
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

// ---------------------------------------------------------------------------
// Internal helper: resolve href from NavigationItem
// ---------------------------------------------------------------------------

function resolveHref(item: NavigationItem, basePath: string): { href: string; external: boolean } {
  switch (item.type) {
    case 'object': {
      const objectPath = `${basePath}/${item.objectName ?? ''}`;
      return { href: item.viewName ? `${objectPath}/view/${item.viewName}` : objectPath, external: false };
    }
    case 'dashboard':
      return { href: item.dashboardName ? `${basePath}/dashboard/${item.dashboardName}` : '#', external: false };
    case 'page':
      return { href: item.pageName ? `${basePath}/page/${item.pageName}` : '#', external: false };
    case 'report':
      return { href: item.reportName ? `${basePath}/report/${item.reportName}` : '#', external: false };
    case 'url':
      return { href: item.url ?? '#', external: item.target === '_blank' };
    default:
      return { href: '#', external: false };
  }
}

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
  onAction,
  enablePinning,
  onPinToggle,
  enableReorder,
  resolveObjectLabel,
}: {
  item: NavigationItem;
  basePath: string;
  evalVis: VisibilityEvaluator;
  checkPerm: PermissionChecker;
  onAction?: (item: NavigationItem) => void;
  enablePinning?: boolean;
  onPinToggle?: (itemId: string, pinned: boolean) => void;
  enableReorder?: boolean;
  resolveObjectLabel?: (objectName: string, fallbackLabel: string) => string;
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
        onAction={onAction}
        enablePinning={enablePinning}
        onPinToggle={onPinToggle}
        dragListeners={enableReorder ? listeners : undefined}
        resolveObjectLabel={resolveObjectLabel}
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
  onAction,
  enablePinning,
  onPinToggle,
  dragListeners,
  resolveObjectLabel,
}: {
  item: NavigationItem;
  basePath: string;
  evalVis: VisibilityEvaluator;
  checkPerm: PermissionChecker;
  onAction?: (item: NavigationItem) => void;
  enablePinning?: boolean;
  onPinToggle?: (itemId: string, pinned: boolean) => void;
  dragListeners?: Record<string, any>;
  resolveObjectLabel?: (objectName: string, fallbackLabel: string) => string;
}) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(item.defaultOpen !== false);

  // --- Visibility guard ---
  if (!evalVis(item.visible)) return null;

  // --- Permission guard ---
  if (item.requiredPermissions?.length && !checkPerm(item.requiredPermissions)) return null;

  // --- Separator ---
  if (item.type === 'separator') {
    return <Separator className="my-2" />;
  }

  // --- Group (collapsible) ---
  if (item.type === 'group') {
    const children = (item.children ?? [])
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <SidebarGroup>
          <SidebarGroupLabel asChild>
            <CollapsibleTrigger className="flex w-full items-center justify-between">
              {resolveLabel(item.label)}
              <LucideIcons.ChevronRight
                className={`ml-auto h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`}
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
                    onAction={onAction}
                    enablePinning={enablePinning}
                    onPinToggle={onPinToggle}
                    resolveObjectLabel={resolveObjectLabel}
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
    return (
      <SidebarMenuItem>
        {dragListeners && (
          <span className="absolute left-0.5 top-1/2 -translate-y-1/2 cursor-grab text-muted-foreground" aria-label="Drag to reorder" {...dragListeners}>
            <LucideIcons.GripVertical className="h-3.5 w-3.5" />
          </span>
        )}
        <SidebarMenuButton
          tooltip={resolveLabel(item.label)}
          onClick={() => onAction?.(item)}
        >
          <Icon className="h-4 w-4" />
          <span>{resolveLabel(item.label)}</span>
          {item.badge != null && (
            <Badge variant={item.badgeVariant ?? 'default'} className="ml-auto text-[10px] px-1.5 py-0">
              {item.badge}
            </Badge>
          )}
        </SidebarMenuButton>
        {enablePinning && onPinToggle && (
          <SidebarMenuAction
            showOnHover={!item.pinned}
            onClick={() => onPinToggle(item.id, !item.pinned)}
            aria-label={item.pinned ? `Unpin ${resolveLabel(item.label)}` : `Pin ${resolveLabel(item.label)}`}
          >
            {item.pinned ? (
              <LucideIcons.PinOff className="h-3.5 w-3.5" />
            ) : (
              <LucideIcons.Pin className="h-3.5 w-3.5" />
            )}
          </SidebarMenuAction>
        )}
      </SidebarMenuItem>
    );
  }

  // --- Leaf items (object / dashboard / page / report / url) ---
  const Icon = resolveIcon(item.icon);
  const { href, external } = resolveHref(item, basePath);
  const isActive = href !== '#' && location.pathname.startsWith(href);
  const itemLabel = resolveItemLabel(item, resolveObjectLabel);

  const content = (
    <>
      <Icon className="h-4 w-4" />
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
        <span className="absolute left-0.5 top-1/2 -translate-y-1/2 cursor-grab text-muted-foreground" aria-label="Drag to reorder" {...dragListeners}>
          <LucideIcons.GripVertical className="h-3.5 w-3.5" />
        </span>
      )}
      <SidebarMenuButton asChild isActive={isActive} tooltip={itemLabel}>
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
          showOnHover={!item.pinned}
          onClick={() => onPinToggle(item.id, !item.pinned)}
          aria-label={item.pinned ? `Unpin ${itemLabel}` : `Pin ${itemLabel}`}
        >
          {item.pinned ? (
            <LucideIcons.PinOff className="h-3.5 w-3.5" />
          ) : (
            <LucideIcons.Pin className="h-3.5 w-3.5" />
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
  onAction,
  searchQuery,
  enablePinning,
  onPinToggle,
  enableReorder,
  onReorder,
  resolveObjectLabel,
}: NavigationRendererProps) {
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
    onAction,
    enablePinning,
    onPinToggle,
    resolveObjectLabel,
  };

  const hasGroups = sorted.some((i) => i.type === 'group');

  // --- Favorites section (pinned items) ---
  const favoritesSection = pinnedItems.length > 0 && enablePinning ? (
    <SidebarGroup>
      <SidebarGroupLabel className="flex items-center gap-1.5">
        <LucideIcons.Star className="h-3.5 w-3.5" />
        Favorites
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
      <>
        {favoritesSection}
        <SidebarGroup>
          <SidebarGroupContent>
            {menuContent}
          </SidebarGroupContent>
        </SidebarGroup>
      </>
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
    <>
      {favoritesSection}
      {fragments}
    </>
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
