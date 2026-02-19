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
 */

import React, { useState, useRef, useEffect, useCallback, type ComponentType } from 'react';
import {
  cn,
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
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
} from 'lucide-react';
import type { ViewTabBarConfig } from '@object-ui/types';

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

  /** Whether user has unsaved filter/sort changes (shows "Save as View" indicator) */
  hasUnsavedChanges?: boolean;
  /** Called when user clicks "Reset" to discard changes */
  onResetChanges?: () => void;
  /** Additional CSS class */
  className?: string;
}

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
  hasUnsavedChanges = false,
  onResetChanges,
  className,
}) => {
  const {
    showAddButton = true,
    inlineRename = true,
    contextMenu: enableContextMenu = true,
    maxVisibleTabs = 6,
    showIndicators = true,
    showSaveAsView = true,
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

  // --- Overflow ---
  const visibleViews = views.slice(0, maxVisibleTabs);
  const overflowViews = views.slice(maxVisibleTabs);

  const DefaultIcon = TableIcon;

  // --- Render a single tab ---
  const renderTab = (view: ViewTabItem) => {
    const isActive = view.id === activeViewId;
    const ViewIcon = viewTypeIcons[view.type] || DefaultIcon;
    const isRenaming = renamingViewId === view.id;
    const hasIndicator = showIndicators && (view.hasActiveFilters || view.hasActiveSort);

    const tabContent = (
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

    // Wrap with context menu if enabled
    if (enableContextMenu && !isRenaming) {
      return (
        <ContextMenu key={view.id}>
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
    }

    return <React.Fragment key={view.id}>{tabContent}</React.Fragment>;
  };

  return (
    <TooltipProvider>
      <div
        data-testid="view-tab-bar"
        className={cn('flex items-center gap-0.5 -mb-px', className)}
      >
        {/* Visible tabs */}
        {visibleViews.map(renderTab)}

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
