/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useMemo, useRef, useEffect, useCallback, type ComponentType } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@object-ui/components';
import {
  GripVertical,
  Search,
  Plus,
  Pin,
  PinOff,
  Star,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Table as TableIcon,
  Check,
  X,
  Lock,
} from 'lucide-react';
import { cn } from '@object-ui/components';
import type { ViewTabItem } from './ViewTabBar';

export interface ManageViewsDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** All views (metadata + saved) */
  views: ViewTabItem[];
  /** Currently active view ID */
  activeViewId?: string;
  /** Icon map: view type → React component */
  viewTypeIcons?: Record<string, ComponentType<{ className?: string }>>;

  // --- Action callbacks (reuse the same handlers from ObjectView) ---
  onRename?: (viewId: string, newName: string) => void;
  onDelete?: (viewId: string) => void;
  /**
   * Opt-in duplicate action — the row's "Duplicate" button renders only when
   * wired. Deliberate generic affordance (not dead code); the console defers
   * view duplication to per-user personalisation (objectui#1520). Omit to hide.
   */
  onDuplicate?: (viewId: string) => void;
  onSetDefault?: (viewId: string) => void;
  onSetPinned?: (viewId: string, pinned: boolean) => void;
  onReorder?: (viewIds: string[]) => void;
  onAddView?: () => void;
  /** Open the edit-config drawer for a view (closes the dialog first) */
  onConfigView?: (viewId: string) => void;
}

const DEFAULT_ICON: ComponentType<{ className?: string }> = TableIcon;

// --- Single sortable row ---
interface RowProps {
  view: ViewTabItem;
  isActive: boolean;
  Icon: ComponentType<{ className?: string }>;
  isRenaming: boolean;
  onStartRename: (id: string) => void;
  onCommitRename: (id: string, name: string) => void;
  onCancelRename: () => void;
  onRowClick?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onSetDefault?: (id: string) => void;
  onSetPinned?: (id: string, pinned: boolean) => void;
  onConfigView?: (id: string) => void;
}

const SortableRow: React.FC<RowProps> = ({
  view,
  isActive,
  Icon,
  isRenaming,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onRowClick,
  onDelete,
  onDuplicate,
  onSetDefault,
  onSetPinned,
  onConfigView,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: view.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const inputRef = useRef<HTMLInputElement>(null);
  const [draftName, setDraftName] = useState(view.label);
  // System / read-only views suppress mutation affordances (rename, set
  // default, pin, edit configuration, delete). Duplicate is preserved
  // because it produces a fresh override that *is* mutable.
  const isReadonly = !!view.readonly;

  useEffect(() => {
    if (isRenaming) {
      setDraftName(view.label);
      // focus on next tick once the input is in the DOM
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isRenaming, view.label]);

  const commit = useCallback(() => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== view.label) onCommitRename(view.id, trimmed);
    else onCancelRename();
  }, [draftName, view.id, view.label, onCommitRename, onCancelRename]);

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-testid={`manage-views-row-${view.id}`}
      className={cn(
        'group/row flex items-center gap-2 px-2 py-2 rounded-md border border-transparent',
        'hover:bg-accent/50 transition-colors',
        isActive && 'bg-accent/40 border-border',
        isDragging && 'shadow-md bg-background border-border z-10',
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        data-testid={`manage-views-drag-${view.id}`}
        className="shrink-0 h-6 w-5 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing rounded hover:bg-accent"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* View type icon */}
      <Icon className="shrink-0 h-4 w-4 text-muted-foreground" />

      {/* Name (editable) */}
      <div
        className="flex-1 min-w-0"
        onClick={() => {
          if (!isRenaming) onRowClick?.(view.id);
        }}
      >
        {isRenaming ? (
          <Input
            ref={inputRef}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onCancelRename();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-7 text-sm"
            data-testid={`manage-views-rename-input-${view.id}`}
          />
        ) : (
          <button
            type="button"
            className="w-full text-left text-sm font-medium truncate cursor-pointer flex items-center gap-1.5"
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (!isReadonly) onStartRename(view.id);
            }}
            title={view.label}
          >
            <span className="truncate">{view.label}</span>
            {isReadonly && (
              <Lock
                aria-label="Read-only view"
                data-testid={`manage-views-readonly-${view.id}`}
                className="h-3 w-3 text-muted-foreground shrink-0"
              />
            )}
            {view.isDefault && (
              <span
                className="ml-1 inline-flex items-center text-[10px] uppercase tracking-wide text-muted-foreground"
                title="Default view"
              >
                <Star className="h-3 w-3 mr-0.5 fill-current" /> default
              </span>
            )}
          </button>
        )}
      </div>

      {/* Pin toggle */}
      {onSetPinned && !isRenaming && !isReadonly && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={view.isPinned ? 'Unpin view' : 'Pin view'}
                data-testid={`manage-views-pin-${view.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSetPinned(view.id, !view.isPinned);
                }}
                className={cn(
                  'shrink-0 h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent transition-colors',
                  view.isPinned ? 'text-amber-500' : 'text-muted-foreground/40 opacity-0 group-hover/row:opacity-100',
                )}
              >
                {view.isPinned ? <Pin className="h-4 w-4 fill-current" /> : <Pin className="h-4 w-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {view.isPinned ? 'Unpin view' : 'Pin view'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Set default */}
      {onSetDefault && !isRenaming && !view.isDefault && !isReadonly && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Set as default"
                data-testid={`manage-views-default-${view.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSetDefault(view.id);
                }}
                className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground/40 hover:text-foreground opacity-0 group-hover/row:opacity-100 transition-colors"
              >
                <Star className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Set as default</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Overflow menu */}
      {!isRenaming && (onDelete || onDuplicate || onConfigView || onSetDefault) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Actions for ${view.label}`}
              data-testid={`manage-views-actions-${view.id}`}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground opacity-60 group-hover/row:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            {!isReadonly && (
              <DropdownMenuItem
                data-testid={`manage-views-action-rename-${view.id}`}
                onClick={() => onStartRename(view.id)}
              >
                <Pencil className="h-4 w-4 mr-2" /> Rename
              </DropdownMenuItem>
            )}
            {onDuplicate && (
              <DropdownMenuItem
                data-testid={`manage-views-action-duplicate-${view.id}`}
                onClick={() => onDuplicate(view.id)}
              >
                <Copy className="h-4 w-4 mr-2" /> Duplicate
              </DropdownMenuItem>
            )}
            {onConfigView && !isReadonly && (
              <DropdownMenuItem
                data-testid={`manage-views-action-config-${view.id}`}
                onClick={() => onConfigView(view.id)}
              >
                <Pencil className="h-4 w-4 mr-2" /> Edit configuration…
              </DropdownMenuItem>
            )}
            {onSetDefault && !view.isDefault && !isReadonly && (
              <DropdownMenuItem
                data-testid={`manage-views-action-default-${view.id}`}
                onClick={() => onSetDefault(view.id)}
              >
                <Star className="h-4 w-4 mr-2" /> Set as default
              </DropdownMenuItem>
            )}
            {onSetPinned && !isReadonly && (
              <DropdownMenuItem
                data-testid={`manage-views-action-pin-${view.id}`}
                onClick={() => onSetPinned(view.id, !view.isPinned)}
              >
                {view.isPinned
                  ? <><PinOff className="h-4 w-4 mr-2" /> Unpin</>
                  : <><Pin className="h-4 w-4 mr-2" /> Pin</>}
              </DropdownMenuItem>
            )}
            {onDelete && !isReadonly && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  data-testid={`manage-views-action-delete-${view.id}`}
                  onClick={() => onDelete(view.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {isRenaming && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            aria-label="Save name"
            onMouseDown={(e) => e.preventDefault()}
            onClick={commit}
            className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent text-emerald-600"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Cancel rename"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onCancelRename}
            className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </li>
  );
};

export const ManageViewsDialog: React.FC<ManageViewsDialogProps> = ({
  open,
  onOpenChange,
  views,
  activeViewId,
  viewTypeIcons = {},
  onRename,
  onDelete,
  onDuplicate,
  onSetDefault,
  onSetPinned,
  onReorder,
  onAddView,
  onConfigView,
}) => {
  const [search, setSearch] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  // Local copy so drag reorder feels instant; we sync from props when they change.
  const [orderedIds, setOrderedIds] = useState<string[]>(() => views.map((v) => v.id));

  useEffect(() => {
    setOrderedIds(views.map((v) => v.id));
  }, [views]);

  // When dialog closes, exit rename mode and clear search
  useEffect(() => {
    if (!open) {
      setRenamingId(null);
      setSearch('');
    }
  }, [open]);

  const orderedViews = useMemo(() => {
    const byId = new Map(views.map((v) => [v.id, v]));
    return orderedIds.map((id) => byId.get(id)).filter(Boolean) as ViewTabItem[];
  }, [orderedIds, views]);

  const visibleViews = useMemo(() => {
    if (!search.trim()) return orderedViews;
    const q = search.toLowerCase();
    return orderedViews.filter((v) => v.label.toLowerCase().includes(q));
  }, [orderedViews, search]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(String(active.id));
    const newIndex = orderedIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(orderedIds, oldIndex, newIndex);
    setOrderedIds(next);
    onReorder?.(next);
  };

  const handleConfig = (id: string) => {
    onOpenChange(false);
    // Defer so the dialog close animation doesn't fight the drawer open
    requestAnimationFrame(() => onConfigView?.(id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[560px] p-0 gap-0 overflow-hidden"
        data-testid="manage-views-dialog"
      >
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base">Manage views</DialogTitle>
          <DialogDescription className="text-xs">
            Reorder, rename, pin, or delete every view in this object.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search views"
              className="pl-8 h-9"
              data-testid="manage-views-search"
            />
          </div>
        </div>

        {/* List */}
        <div
          className="px-3 pb-3 max-h-[55vh] overflow-y-auto"
          data-testid="manage-views-list"
        >
          {visibleViews.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-10">
              No views match your search.
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={visibleViews.map((v) => v.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="space-y-0.5">
                  {visibleViews.map((view) => {
                    const Icon = viewTypeIcons[view.type] || DEFAULT_ICON;
                    return (
                      <SortableRow
                        key={view.id}
                        view={view}
                        Icon={Icon}
                        isActive={view.id === activeViewId}
                        isRenaming={renamingId === view.id}
                        onStartRename={(id) => setRenamingId(id)}
                        onCancelRename={() => setRenamingId(null)}
                        onCommitRename={(id, name) => {
                          setRenamingId(null);
                          onRename?.(id, name);
                        }}
                        onDelete={onDelete}
                        onDuplicate={onDuplicate}
                        onSetDefault={onSetDefault}
                        onSetPinned={onSetPinned}
                        onConfigView={onConfigView ? handleConfig : undefined}
                      />
                    );
                  })}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </div>

        <DialogFooter className="border-t bg-muted/30 px-5 py-3 flex sm:justify-between gap-2">
          {onAddView ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                requestAnimationFrame(() => onAddView());
              }}
              data-testid="manage-views-add"
              className="text-sm"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Add new view
            </Button>
          ) : <span />}
          <Button
            size="sm"
            onClick={() => onOpenChange(false)}
            data-testid="manage-views-done"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManageViewsDialog;
