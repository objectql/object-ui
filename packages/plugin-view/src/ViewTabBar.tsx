/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ViewTabBar Component
 *
 * A reusable view tab bar with:
 * - Inline "+" Add View button
 * - Right-click context menu (rename, duplicate, delete, set as default, share)
 * - Overflow → "More" dropdown when maxVisibleTabs exceeded
 * - Filter/sort indicator badges on tabs
 * - "Save as View" button when user filters differ from saved state
 * - Double-click to rename view tab inline
 * - Drag-reorder view tabs (Phase 2)
 * - Pin/favorite views (Phase 2)
 * - View type quick-switch palette (Phase 2)
 * - Personal vs. shared views grouping (Phase 2)
 */

import React, { useState, useRef, useEffect, useCallback, useMemo, type ComponentType } from 'react';
import {
  cn,
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Input,
  Button,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@object-ui/components';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Star,
  Share2,
  Save,
  Table as TableIcon,
  Pin,
  PinOff,
  Lock,
  Globe,
  GripVertical,
  LayoutGrid,
} from 'lucide-react';
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
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ViewTabBarConfig } from '@object-ui/types';

/** Visibility group sort order: private → team → organization → public */
const VISIBILITY_ORDER: Record<string, number> = { private: 0, team: 1, organization: 2, public: 3 };

/** A single view definition for the tab bar */
export interface ViewTabItem {
  /** Unique view identifier */
  id: string;
  /** Display label */
  label: string;
  /** View type (grid, kanban, calendar, etc.) */
  type: string;
  /** Whether this view has active filters */
  hasActiveFilters?: boolean;
  /** Whether this view has active sort */
  hasActiveSort?: boolean;
  /** Whether this is the default view */
  isDefault?: boolean;
  /** Whether this view is pinned/favorited */
  isPinned?: boolean;
  /** View visibility for grouping */
  visibility?: 'private' | 'team' | 'organization' | 'public';
}

/** Available view type for quick-switch palette */
export interface AvailableViewType {
  type: string;
  label: string;
  description?: string;
}

export interface ViewTabBarProps {
  /** Views to render as tabs */
  views: ViewTabItem[];
  /** Currently active view ID */
  activeViewId: string;
  /** Callback when a view tab is clicked */
  onViewChange: (viewId: string) => void;
  /** Icon map: view type → React component */
  viewTypeIcons?: Record<string, ComponentType<{ className?: string }>>;
  /** Configuration for the tab bar UX */
  config?: ViewTabBarConfig;

  // --- Action callbacks ---
  /** Called when "+" button is clicked to add a new view */
  onAddView?: () => void;
  /** Called when a view is renamed via context menu or double-click */
  onRenameView?: (viewId: string, newName: string) => void;
  /** Called when a view is duplicated */
  onDuplicateView?: (viewId: string) => void;
  /** Called when a view is deleted */
  onDeleteView?: (viewId: string) => void;
  /** Called when a view is set as default */
  onSetDefaultView?: (viewId: string) => void;
  /** Called when a view is shared */
  onShareView?: (viewId: string) => void;
  /** Called when "Save as View" is clicked */
  onSaveAsView?: () => void;
  /** Called when a view is pinned/unpinned */
  onPinView?: (viewId: string, pinned: boolean) => void;
  /** Called when views are reordered via drag */
  onReorderViews?: (viewIds: string[]) => void;
  /** Called when a view type is changed via quick-switch */
  onChangeViewType?: (viewId: string, newType: string) => void;

  /** Available view types for quick-switch palette */
  availableViewTypes?: AvailableViewType[];
  /** Whether user has unsaved filter/sort changes (shows "Save as View" indicator) */
  hasUnsavedChanges?: boolean;
  /** Called when user clicks "Reset" to discard changes */
  onResetChanges?: () => void;
  /** Additional CSS class */
  className?: string;
}

// --- Sortable Tab wrapper ---
const SortableTab: React.FC<{
  id: string;
  disabled?: boolean;
  children: (props: {
    setNodeRef: (node: HTMLElement | null) => void;
    style: React.CSSProperties;
    listeners: Record<string, Function> | undefined;
    attributes: Record<string, unknown>;
    isDragging: boolean;
  }) => React.ReactNode;
}> = ({ id, disabled, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.5 : undefined,
  };

  return <>{children({ setNodeRef, style, listeners, attributes, isDragging })}</>;
};

/**
 * ViewTabBar — Airtable/Salesforce-style view tab bar with management UX.
 */
export const ViewTabBar: React.FC<ViewTabBarProps> = ({
  views,
  activeViewId,
  onViewChange,
  viewTypeIcons = {},
  config = {},
  onAddView,
  onRenameView,
  onDuplicateView,
  onDeleteView,
  onSetDefaultView,
  onShareView,
  onSaveAsView,
  onPinView,
  onReorderViews,
  onChangeViewType,
  availableViewTypes,
  hasUnsavedChanges = false,
  onResetChanges,
  className,
}) => {
  const {
    showAddButton = true,
    inlineRename = true,
    contextMenu: enableContextMenu = true,
    reorderable = false,
    maxVisibleTabs = 6,
    showIndicators = true,
    showSaveAsView = true,
    showPinnedSection = true,
    showVisibilityGroups = false,
  } = config;

  // --- Inline rename state ---
  const [renamingViewId, setRenamingViewId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingViewId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingViewId]);

  const startRename = useCallback((viewId: string) => {
    if (!inlineRename || !onRenameView) return;
    const view = views.find(v => v.id === viewId);
    if (!view) return;
    setRenamingViewId(viewId);
    setRenameValue(view.label);
  }, [inlineRename, onRenameView, views]);

  const commitRename = useCallback(() => {
    if (renamingViewId && renameValue.trim() && onRenameView) {
      onRenameView(renamingViewId, renameValue.trim());
    }
    setRenamingViewId(null);
    setRenameValue('');
  }, [renamingViewId, renameValue, onRenameView]);

  const cancelRename = useCallback(() => {
    setRenamingViewId(null);
    setRenameValue('');
  }, []);

  // --- Sort views: pinned first → personal → shared ---
  const sortedViews = useMemo(() => {
    const sorted = [...views];
    sorted.sort((a, b) => {
      // Pinned views first
      if (showPinnedSection) {
        const aPinned = a.isPinned ? 1 : 0;
        const bPinned = b.isPinned ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
      }
      // Visibility grouping: private → team → organization → public
      if (showVisibilityGroups) {
        const aOrder = VISIBILITY_ORDER[a.visibility || 'public'] ?? 3;
        const bOrder = VISIBILITY_ORDER[b.visibility || 'public'] ?? 3;
        if (aOrder !== bOrder) return aOrder - bOrder;
      }
      return 0;
    });
    return sorted;
  }, [views, showPinnedSection, showVisibilityGroups]);

  // --- Overflow ---
  const visibleViews = sortedViews.slice(0, maxVisibleTabs);
  const overflowViews = sortedViews.slice(maxVisibleTabs);

  // --- Drag-reorder sensors ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorderViews) return;
    const oldIndex = sortedViews.findIndex(v => v.id === active.id);
    const newIndex = sortedViews.findIndex(v => v.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(sortedViews, oldIndex, newIndex);
    onReorderViews(reordered.map(v => v.id));
  }, [sortedViews, onReorderViews]);

  const DefaultIcon = TableIcon;

  // Determine if a visibility separator should appear before this view
  const shouldShowVisibilitySeparator = useCallback((index: number) => {
    if (!showVisibilityGroups || index === 0) return false;
    const prev = visibleViews[index - 1];
    const curr = visibleViews[index];
    const isPrivate = (v: ViewTabItem) => v.visibility === 'private';
    return isPrivate(prev) && !isPrivate(curr);
  }, [showVisibilityGroups, visibleViews]);

  // --- Render a single tab ---
  const renderTab = (view: ViewTabItem, index: number) => {
    const isActive = view.id === activeViewId;
    const ViewIcon = viewTypeIcons[view.type] || DefaultIcon;
    const isRenaming = renamingViewId === view.id;
    const hasIndicator = showIndicators && (view.hasActiveFilters || view.hasActiveSort);
    const showSeparator = shouldShowVisibilitySeparator(index);

    const getVisibilityIcon = (view: ViewTabItem) => {
      if (!showVisibilityGroups) return null;
      if (view.visibility === 'private') {
        return <Lock data-testid={`view-tab-visibility-${view.id}`} className="h-3 w-3 text-muted-foreground shrink-0" />;
      }
      if (view.visibility && view.visibility !== 'private') {
        return <Globe data-testid={`view-tab-visibility-${view.id}`} className="h-3 w-3 text-muted-foreground shrink-0" />;
      }
      return null;
    };

    const visibilityIcon = getVisibilityIcon(view);

    const buildTabContent = (dragHandleProps?: {
      listeners: Record<string, Function> | undefined;
      attributes: Record<string, unknown>;
    }) => (
      <button
        data-testid={`view-tab-${view.id}`}
        onClick={() => !isRenaming && onViewChange(view.id)}
        onDoubleClick={() => startRename(view.id)}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap relative',
          isActive
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
        )}
      >
        {reorderable && onReorderViews && (
          <span
            data-testid={`view-tab-drag-handle-${view.id}`}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
            {...(dragHandleProps?.listeners ?? {})}
            {...(dragHandleProps?.attributes ?? {})}
          >
            <GripVertical className="h-3 w-3" />
          </span>
        )}
        {showPinnedSection && view.isPinned && (
          <Pin data-testid={`view-tab-pin-indicator-${view.id}`} className="h-3 w-3 text-primary shrink-0" />
        )}
        {visibilityIcon}
        <ViewIcon className="h-3.5 w-3.5" />
        {isRenaming ? (
          <Input
            ref={renameInputRef}
            data-testid={`view-tab-rename-input-${view.id}`}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') cancelRename();
            }}
            className="h-5 w-24 px-1 py-0 text-sm border-none focus-visible:ring-1"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span>{view.label}</span>
        )}
        {hasIndicator && (
          <span
            data-testid={`view-tab-indicator-${view.id}`}
            className="ml-0.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0"
          />
        )}
        {view.isDefault && (
          <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />
        )}
      </button>
    );

    const wrapWithContextMenu = (tabContent: React.ReactElement) => {
      if (!enableContextMenu || isRenaming) return tabContent;

      return (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            {tabContent}
          </ContextMenuTrigger>
          <ContextMenuContent>
            {onRenameView && (
              <ContextMenuItem
                data-testid={`context-menu-rename-${view.id}`}
                onClick={() => startRename(view.id)}
              >
                <Pencil className="h-4 w-4 mr-2" /> Rename
              </ContextMenuItem>
            )}
            {onDuplicateView && (
              <ContextMenuItem
                data-testid={`context-menu-duplicate-${view.id}`}
                onClick={() => onDuplicateView(view.id)}
              >
                <Copy className="h-4 w-4 mr-2" /> Duplicate View
              </ContextMenuItem>
            )}
            {onShareView && (
              <ContextMenuItem
                data-testid={`context-menu-share-${view.id}`}
                onClick={() => onShareView(view.id)}
              >
                <Share2 className="h-4 w-4 mr-2" /> Share View
              </ContextMenuItem>
            )}
            {onSetDefaultView && (
              <ContextMenuItem
                data-testid={`context-menu-default-${view.id}`}
                onClick={() => onSetDefaultView(view.id)}
              >
                <Star className="h-4 w-4 mr-2" /> Set as Default
              </ContextMenuItem>
            )}
            {onPinView && (
              <ContextMenuItem
                data-testid={`context-menu-pin-${view.id}`}
                onClick={() => onPinView(view.id, !view.isPinned)}
              >
                {view.isPinned
                  ? <><PinOff className="h-4 w-4 mr-2" /> Unpin View</>
                  : <><Pin className="h-4 w-4 mr-2" /> Pin View</>
                }
              </ContextMenuItem>
            )}
            {onChangeViewType && availableViewTypes && availableViewTypes.length > 0 && (
              <>
                <ContextMenuSeparator />
                <ContextMenuSub>
                  <ContextMenuSubTrigger data-testid={`context-menu-change-type-${view.id}`}>
                    <LayoutGrid className="h-4 w-4 mr-2" /> Change View Type
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent data-testid={`context-menu-type-submenu-${view.id}`}>
                    {availableViewTypes.map((vt) => {
                      const TypeIcon = viewTypeIcons[vt.type] || DefaultIcon;
                      return (
                        <ContextMenuItem
                          key={vt.type}
                          data-testid={`context-menu-type-${view.id}-${vt.type}`}
                          disabled={vt.type === view.type}
                          onClick={() => onChangeViewType(view.id, vt.type)}
                        >
                          <TypeIcon className="h-4 w-4 mr-2" />
                          <div className="flex flex-col">
                            <span>{vt.label}</span>
                            {vt.description && (
                              <span className="text-xs text-muted-foreground">{vt.description}</span>
                            )}
                          </div>
                        </ContextMenuItem>
                      );
                    })}
                  </ContextMenuSubContent>
                </ContextMenuSub>
              </>
            )}
            {onDeleteView && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem
                  data-testid={`context-menu-delete-${view.id}`}
                  onClick={() => onDeleteView(view.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete View
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
        </ContextMenu>
      );
    };

    // Build the tab with optional drag-reorder wrapper
    if (reorderable && onReorderViews) {
      return (
        <React.Fragment key={view.id}>
          {showSeparator && (
            <div data-testid="view-tab-visibility-separator" className="w-px h-5 bg-border mx-1 self-center shrink-0" />
          )}
          <SortableTab id={view.id}>
            {({ setNodeRef, style, listeners, attributes, isDragging }) => (
              <div ref={setNodeRef} style={style} className={cn('flex', isDragging && 'z-10')}>
                {wrapWithContextMenu(buildTabContent({ listeners, attributes }))}
              </div>
            )}
          </SortableTab>
        </React.Fragment>
      );
    }

    return (
      <React.Fragment key={view.id}>
        {showSeparator && (
          <div data-testid="view-tab-visibility-separator" className="w-px h-5 bg-border mx-1 self-center shrink-0" />
        )}
        {wrapWithContextMenu(buildTabContent())}
      </React.Fragment>
    );
  };

  const tabList = (
    <>
      {visibleViews.map((view, index) => renderTab(view, index))}
    </>
  );

  return (
    <TooltipProvider>
      <div
        data-testid="view-tab-bar"
        className={cn('flex items-center gap-0.5 -mb-px', className)}
      >
        {/* Visible tabs — optionally wrapped with DndContext for reorder */}
        {reorderable && onReorderViews ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={visibleViews.map(v => v.id)} strategy={horizontalListSortingStrategy}>
              <div data-testid="view-tab-sortable-container" className="flex items-center gap-0.5">
                {tabList}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          tabList
        )}

        {/* Overflow "More" dropdown */}
        {overflowViews.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-testid="view-tab-overflow"
                className="inline-flex items-center gap-1 px-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="text-xs">{overflowViews.length} more</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {overflowViews.map((view) => {
                const ViewIcon = viewTypeIcons[view.type] || DefaultIcon;
                return (
                  <DropdownMenuItem
                    key={view.id}
                    data-testid={`view-tab-overflow-${view.id}`}
                    onClick={() => onViewChange(view.id)}
                  >
                    {view.isPinned && <Pin className="h-3 w-3 mr-1 text-primary shrink-0" />}
                    <ViewIcon className="h-4 w-4 mr-2" />
                    {view.label}
                    {showIndicators && (view.hasActiveFilters || view.hasActiveSort) && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Inline "+" Add View button */}
        {showAddButton && onAddView && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                data-testid="view-tab-add"
                onClick={onAddView}
                className="inline-flex items-center px-2 py-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Add View</TooltipContent>
          </Tooltip>
        )}

        {/* "Save as View" indicator */}
        {showSaveAsView && hasUnsavedChanges && (
          <div
            data-testid="view-tab-save-as"
            className="flex items-center gap-1 ml-2 text-xs text-amber-600 dark:text-amber-400"
          >
            <Save className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Unsaved changes</span>
            {onSaveAsView && (
              <Button
                variant="ghost"
                size="sm"
                data-testid="view-tab-save-as-btn"
                className="h-6 px-2 text-xs"
                onClick={onSaveAsView}
              >
                Save as View
              </Button>
            )}
            {onResetChanges && (
              <Button
                variant="ghost"
                size="sm"
                data-testid="view-tab-reset-btn"
                className="h-6 px-2 text-xs"
                onClick={onResetChanges}
              >
                Reset
              </Button>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};
