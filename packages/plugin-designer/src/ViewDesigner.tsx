/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { ViewDesignerColumn } from '@object-ui/types';
import {
  GripVertical,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Save,
  X,
  Columns3,
  Settings2,
  LayoutGrid,
  Kanban,
  Calendar,
  Map,
  Image,
  Clock,
  GanttChart,
  Undo2,
  Redo2,
  Copy,
  Clipboard,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useDesignerHistory } from './hooks/useDesignerHistory';
import { useConfirmDialog } from './hooks/useConfirmDialog';
import { useClipboard } from './hooks/useClipboard';
import { ConfirmDialog } from './components/ConfirmDialog';
import { useCollaboration } from './CollaborationProvider';

function cn(...inputs: (string | undefined | false)[]) {
  return twMerge(clsx(inputs));
}

type ViewType = 'grid' | 'kanban' | 'gallery' | 'calendar' | 'timeline' | 'gantt' | 'map';

export interface ViewDesignerProps {
  /** Object name this view is for */
  objectName: string;
  /** View identifier (for editing existing views) */
  viewId?: string;
  /** Initial view label */
  viewLabel?: string;
  /** Initial view type */
  viewType?: ViewType;
  /** Initial columns configuration */
  columns?: ViewDesignerColumn[];
  /** Initial filter conditions */
  filters?: Array<{ field: string; operator: string; value: any }>;
  /** Initial sort configuration */
  sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  /** Available fields from the object schema */
  availableFields?: Array<{ name: string; label: string; type: string }>;
  /** Type-specific options (kanban groupField, calendar startDateField, etc.) */
  options?: Record<string, any>;
  /** Read-only mode */
  readOnly?: boolean;
  /** Callback when save is clicked */
  onSave?: (config: ViewDesignerConfig) => void;
  /** Callback when cancel is clicked */
  onCancel?: () => void;
  /** Custom CSS class */
  className?: string;
}

/** The output configuration from the view designer */
export interface ViewDesignerConfig {
  viewId?: string;
  viewLabel: string;
  viewType: ViewType;
  columns: ViewDesignerColumn[];
  filters: Array<{ field: string; operator: string; value: any }>;
  sort: Array<{ field: string; direction: 'asc' | 'desc' }>;
  options: Record<string, any>;
}

/** Tracked state for undo/redo */
interface ViewDesignerState {
  columns: ViewDesignerColumn[];
  filters: Array<{ field: string; operator: string; value: any }>;
  sort: Array<{ field: string; direction: 'asc' | 'desc' }>;
  viewType: ViewType;
  viewLabel: string;
  options: Record<string, any>;
}

const LABELS = {
  title: 'View Designer',
  saveView: 'Save View',
  cancel: 'Cancel',
  availableFields: 'Available Fields',
  allFieldsAdded: 'All fields added',
  noColumnsTitle: 'No columns added yet. Select fields from the palette to add columns.',
  columnsCount: (count: number) => `Columns (${count})`,
  viewType: 'View Type',
  viewName: 'View Name',
  viewNamePlaceholder: 'Enter view name...',
  columnProperties: 'Column Properties',
  selectColumnPrompt: 'Select a column to edit its properties',
  labelField: 'Label',
  widthField: 'Width',
  widthPlaceholder: 'auto',
  fieldLabel: 'Field:',
  addFilter: 'Add Filter',
  addSort: 'Add Sort',
  valuePlaceholder: 'Value',
  asc: 'Asc',
  desc: 'Desc',
  selectField: 'Select field...',
  moveUp: 'Move up',
  moveDown: 'Move down',
  moveColumnUp: 'Move column up',
  moveColumnDown: 'Move column down',
  hideColumn: 'Hide column',
  showColumn: 'Show column',
  toggleVisibility: 'Toggle column visibility',
  removeColumn: 'Remove column',
  copyColumn: 'Copy column',
  pasteColumn: 'Paste column',
  deleteColumnTitle: 'Delete Column',
  deleteColumnMessage: (field: string) => `Are you sure you want to delete the column "${field}"? This action cannot be undone.`,
  undo: 'Undo (Ctrl+Z)',
  redo: 'Redo (Ctrl+Y)',
  gridOptionsHint: 'Grid view uses the columns configured above.',
  groupByField: 'Group By Field',
  startDateField: 'Start Date Field',
  titleField: 'Title Field',
  latitudeField: 'Latitude Field',
  longitudeField: 'Longitude Field',
  imageField: 'Image Field',
  dateField: 'Date Field',
} as const;

const VIEW_TYPE_OPTIONS: Array<{ type: ViewType; label: string; icon: React.ElementType }> = [
  { type: 'grid', label: 'Grid', icon: LayoutGrid },
  { type: 'kanban', label: 'Kanban', icon: Kanban },
  { type: 'gallery', label: 'Gallery', icon: Image },
  { type: 'calendar', label: 'Calendar', icon: Calendar },
  { type: 'timeline', label: 'Timeline', icon: Clock },
  { type: 'gantt', label: 'Gantt', icon: GanttChart },
  { type: 'map', label: 'Map', icon: Map },
];

const FILTER_OPERATORS = [
  { value: 'equals', label: '=' },
  { value: 'contains', label: 'Contains' },
  { value: 'startsWith', label: 'Starts with' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'gte', label: '>=' },
  { value: 'lte', label: '<=' },
  { value: 'ne', label: '!=' },
];

/** Supported field data types for columns */
const DESIGNER_FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'percent', label: 'Percent' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & Time' },
  { value: 'boolean', label: 'Checkbox' },
  { value: 'select', label: 'Select' },
  { value: 'multiselect', label: 'Multi-Select' },
  { value: 'email', label: 'Email' },
  { value: 'url', label: 'URL' },
  { value: 'phone', label: 'Phone' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'lookup', label: 'Lookup' },
  { value: 'attachment', label: 'Attachment' },
  { value: 'formula', label: 'Formula' },
  { value: 'autonumber', label: 'Auto Number' },
  { value: 'rating', label: 'Rating' },
];

/** Column width constraints */
const COLUMN_WIDTH_MIN = 50;
const COLUMN_WIDTH_MAX = 1000;

/**
 * Visual designer for creating and editing list views.
 * Provides a 3-panel layout:
 * - Left: Field palette (available fields to add)
 * - Center: View layout preview (columns, order)
 * - Right: Properties panel (view settings, filters, sort)
 */
export function ViewDesigner({
  objectName,
  viewId,
  viewLabel: initialViewLabel = '',
  viewType: initialViewType = 'grid',
  columns: initialColumns = [],
  filters: initialFilters = [],
  sort: initialSort = [],
  availableFields = [],
  options: initialOptions = {},
  readOnly = false,
  onSave,
  onCancel,
  className,
}: ViewDesignerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Undo/Redo ---
  const history = useDesignerHistory<ViewDesignerState>({
    columns: initialColumns,
    filters: initialFilters,
    sort: initialSort,
    viewType: initialViewType,
    viewLabel: initialViewLabel,
    options: initialOptions,
  });

  const { columns, filters, sort, viewType, viewLabel, options } = history.current;

  const pushState = useCallback(
    (updates: Partial<ViewDesignerState>) => {
      history.push({ ...history.current, ...updates });
    },
    [history],
  );

  // --- Clipboard ---
  const clipboardHook = useClipboard<ViewDesignerColumn>();

  // --- Confirm dialog ---
  const confirmDialog = useConfirmDialog();

  // --- Collaboration (optional) ---
  const collaboration = useCollaboration();

  const [selectedColumnIndex, setSelectedColumnIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'columns' | 'filters' | 'sort' | 'options'>('columns');

  // Fields not yet added as columns
  const unusedFields = useMemo(() => {
    const usedNames = new Set(columns.map((c) => c.field));
    return availableFields.filter((f) => !usedNames.has(f.name));
  }, [availableFields, columns]);

  const handleAddColumn = useCallback(
    (fieldName: string) => {
      if (readOnly) return;
      const fieldDef = availableFields.find((f) => f.name === fieldName);
      const newCol: ViewDesignerColumn = {
        field: fieldName,
        label: fieldDef?.label ?? fieldName,
        visible: true,
        order: columns.length,
      };
      pushState({ columns: [...columns, newCol] });
      collaboration?.sendOperation({ type: 'insert', userId: collaboration.currentUserId ?? '', elementId: fieldName, data: { column: newCol } });
    },
    [availableFields, columns, readOnly, pushState, collaboration],
  );

  const handleRemoveColumn = useCallback(
    async (index: number) => {
      if (readOnly) return;
      const col = columns[index];
      if (!col) return;
      const confirmed = await confirmDialog.confirm(
        LABELS.deleteColumnTitle,
        LABELS.deleteColumnMessage(col.label || col.field),
      );
      if (!confirmed) return;
      pushState({ columns: columns.filter((_, i) => i !== index) });
      if (selectedColumnIndex === index) setSelectedColumnIndex(null);
      collaboration?.sendOperation({ type: 'delete', userId: collaboration.currentUserId ?? '', elementId: col.field, data: {} });
    },
    [readOnly, columns, confirmDialog, pushState, selectedColumnIndex, collaboration],
  );

  const handleToggleColumnVisibility = useCallback(
    (index: number) => {
      if (readOnly) return;
      pushState({
        columns: columns.map((col, i) => (i === index ? { ...col, visible: !col.visible } : col)),
      });
    },
    [readOnly, columns, pushState],
  );

  const handleMoveColumn = useCallback(
    (index: number, direction: 'up' | 'down') => {
      if (readOnly) return;
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= columns.length) return;
      const updated = [...columns];
      const temp = updated[index];
      updated[index] = updated[newIndex];
      updated[newIndex] = temp;
      pushState({ columns: updated });
      setSelectedColumnIndex(newIndex);
    },
    [readOnly, columns, pushState],
  );

  const handleAddFilter = useCallback(() => {
    if (readOnly || availableFields.length === 0) return;
    pushState({
      filters: [...filters, { field: availableFields[0].name, operator: 'equals', value: '' }],
    });
  }, [readOnly, availableFields, filters, pushState]);

  const handleRemoveFilter = useCallback(
    (index: number) => {
      if (readOnly) return;
      pushState({ filters: filters.filter((_, i) => i !== index) });
    },
    [readOnly, filters, pushState],
  );

  const handleUpdateFilter = useCallback(
    (index: number, updates: Partial<{ field: string; operator: string; value: any }>) => {
      if (readOnly) return;
      pushState({
        filters: filters.map((f, i) => (i === index ? { ...f, ...updates } : f)),
      });
    },
    [readOnly, filters, pushState],
  );

  const handleAddSort = useCallback(() => {
    if (readOnly || availableFields.length === 0) return;
    pushState({
      sort: [...sort, { field: availableFields[0].name, direction: 'asc' as const }],
    });
  }, [readOnly, availableFields, sort, pushState]);

  const handleRemoveSort = useCallback(
    (index: number) => {
      if (readOnly) return;
      pushState({ sort: sort.filter((_, i) => i !== index) });
    },
    [readOnly, sort, pushState],
  );

  const handleUpdateSort = useCallback(
    (index: number, updates: Partial<{ field: string; direction: 'asc' | 'desc' }>) => {
      if (readOnly) return;
      pushState({
        sort: sort.map((s, i) => (i === index ? { ...s, ...updates } : s)),
      });
    },
    [readOnly, sort, pushState],
  );

  // --- Copy/Paste handlers ---
  const handleCopyColumn = useCallback(() => {
    if (selectedColumnIndex === null || !columns[selectedColumnIndex]) return;
    clipboardHook.copy(columns[selectedColumnIndex]);
  }, [selectedColumnIndex, columns, clipboardHook]);

  const handlePasteColumn = useCallback(() => {
    if (readOnly) return;
    const pasted = clipboardHook.paste();
    if (!pasted) return;
    const pastedCol: ViewDesignerColumn = {
      ...pasted,
      field: `${pasted.field}_copy`,
      label: `${pasted.label || pasted.field} (Copy)`,
      order: columns.length,
    };
    pushState({ columns: [...columns, pastedCol] });
  }, [readOnly, clipboardHook, columns, pushState]);

  const handleSave = useCallback(() => {
    onSave?.({
      viewId,
      viewLabel: viewLabel || `${objectName} View`,
      viewType,
      columns,
      filters,
      sort,
      options,
    });
  }, [onSave, viewId, viewLabel, objectName, viewType, columns, filters, sort, options]);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName);
      const ctrl = e.ctrlKey || e.metaKey;

      if (isInput) return;

      if (ctrl && e.key === 's' && !readOnly) {
        e.preventDefault();
        handleSave();
        return;
      }
      if (ctrl && e.key === 'z' && !e.shiftKey && !readOnly) {
        e.preventDefault();
        history.undo();
        return;
      }
      if (ctrl && ((e.key === 'z' && e.shiftKey) || e.key === 'y') && !readOnly) {
        e.preventDefault();
        history.redo();
        return;
      }
      if (ctrl && e.key === 'c') {
        e.preventDefault();
        handleCopyColumn();
        return;
      }
      if (ctrl && e.key === 'v' && !readOnly) {
        e.preventDefault();
        handlePasteColumn();
        return;
      }
    };

    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [readOnly, history, handleCopyColumn, handlePasteColumn, handleSave]);

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className={cn('flex flex-col h-full w-full border rounded-lg overflow-hidden bg-background', className)}
    >
      {/* Top Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-muted/20 shrink-0" role="toolbar">
        <Settings2 className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">{LABELS.title}</span>
        <span className="text-xs text-muted-foreground">— {objectName}</span>

        {/* Collaboration indicator */}
        {collaboration?.isConnected && collaboration.users.length > 1 && (
          <div className="flex items-center gap-1 ml-2" role="status" aria-label="Active collaborators">
            {collaboration.users.slice(0, 3).map((u) => (
              <div
                key={u.userId}
                className="h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                style={{ backgroundColor: u.color }}
                title={u.userName}
              >
                {u.userName.charAt(0).toUpperCase()}
              </div>
            ))}
            {collaboration.users.length > 3 && (
              <span className="text-xs text-muted-foreground">+{collaboration.users.length - 3}</span>
            )}
          </div>
        )}

        <div className="flex-1" />

        {/* Undo/Redo buttons */}
        {!readOnly && (
          <>
            <button
              onClick={history.undo}
              disabled={!history.canUndo}
              className="p-1.5 rounded hover:bg-accent disabled:opacity-30"
              title={LABELS.undo}
              aria-label={LABELS.undo}
              data-testid="view-designer-undo"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={history.redo}
              disabled={!history.canRedo}
              className="p-1.5 rounded hover:bg-accent disabled:opacity-30"
              title={LABELS.redo}
              aria-label={LABELS.redo}
              data-testid="view-designer-redo"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
            <div className="w-px h-4 bg-border mx-1" />
          </>
        )}

        {/* Copy/Paste buttons */}
        {!readOnly && (
          <>
            <button
              onClick={handleCopyColumn}
              disabled={selectedColumnIndex === null}
              className="p-1.5 rounded hover:bg-accent disabled:opacity-30"
              title={LABELS.copyColumn}
              aria-label={LABELS.copyColumn}
              data-testid="view-designer-copy"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handlePasteColumn}
              disabled={!clipboardHook.hasContent}
              className="p-1.5 rounded hover:bg-accent disabled:opacity-30"
              title={LABELS.pasteColumn}
              aria-label={LABELS.pasteColumn}
              data-testid="view-designer-paste"
            >
              <Clipboard className="h-3.5 w-3.5" />
            </button>
            <div className="w-px h-4 bg-border mx-1" />
          </>
        )}

        {!readOnly && (
          <>
            {onCancel && (
              <button
                onClick={onCancel}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded border border-border hover:bg-accent"
                data-testid="view-designer-cancel"
              >
                <X className="h-3 w-3" /> {LABELS.cancel}
              </button>
            )}
            <button
              onClick={handleSave}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="view-designer-save"
            >
              <Save className="h-3 w-3" /> {LABELS.saveView}
            </button>
          </>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Field Palette */}
        {!readOnly && (
          <div className="w-56 border-r bg-muted/30 flex flex-col shrink-0">
            <div className="p-3 border-b font-medium text-sm">{LABELS.availableFields}</div>
            <div className="flex-1 overflow-y-auto p-2">
              {unusedFields.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">
                  {LABELS.allFieldsAdded}
                </div>
              ) : (
                unusedFields.map((field) => (
                  <button
                    key={field.name}
                    onClick={() => handleAddColumn(field.name)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent text-left"
                    data-testid={`field-${field.name}`}
                  >
                    <Plus className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate">{field.label || field.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{field.type}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Center - View Layout Preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* View Name & Type */}
          <div className="p-3 border-b space-y-3 shrink-0 bg-muted/10">
            {/* View Type - Made more prominent for creation */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-foreground">{LABELS.viewType}</label>
              <div className="flex gap-2 flex-wrap">
                {VIEW_TYPE_OPTIONS.map(({ type, label, icon: Icon }) => (
                  <button
                    key={type}
                    onClick={() => !readOnly && pushState({ viewType: type })}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 text-sm rounded-md border-2 transition-all font-medium',
                      viewType === type
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : 'border-border bg-background hover:border-primary/50 hover:bg-accent',
                    )}
                    data-testid={`view-type-${type}`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* View Label */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-foreground">{LABELS.viewName}</label>
              <input
                type="text"
                value={viewLabel}
                onChange={(e) => !readOnly && pushState({ viewLabel: e.target.value })}
                placeholder={LABELS.viewNamePlaceholder}
                className="px-3 py-2 text-sm border-2 rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                readOnly={readOnly}
                data-testid="view-label-input"
              />
            </div>
          </div>

          {/* Column Layout Preview */}
          <div className="flex-1 overflow-auto p-3">
            {columns.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                <div className="text-center">
                  <Columns3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>{LABELS.noColumnsTitle}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  {LABELS.columnsCount(columns.length)}
                </div>
                {columns.map((col, index) => (
                  <div
                    key={`${col.field}-${index}`}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded border transition-colors cursor-pointer',
                      selectedColumnIndex === index
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border hover:border-primary/50',
                      !col.visible && 'opacity-50',
                    )}
                    onClick={() => setSelectedColumnIndex(index)}
                    data-testid={`column-${col.field}`}
                  >
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate flex-1">
                      {col.label || col.field}
                    </span>
                    <span className="text-xs text-muted-foreground">{col.field}</span>
                    {!readOnly && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveColumn(index, 'up');
                          }}
                          disabled={index === 0}
                          className="p-0.5 rounded hover:bg-accent disabled:opacity-30"
                          title={LABELS.moveUp}
                          aria-label={LABELS.moveColumnUp}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveColumn(index, 'down');
                          }}
                          disabled={index === columns.length - 1}
                          className="p-0.5 rounded hover:bg-accent disabled:opacity-30"
                          title={LABELS.moveDown}
                          aria-label={LABELS.moveColumnDown}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleColumnVisibility(index);
                          }}
                          className="p-0.5 rounded hover:bg-accent"
                          title={col.visible !== false ? LABELS.hideColumn : LABELS.showColumn}
                          aria-label={LABELS.toggleVisibility}
                        >
                          {col.visible !== false ? (
                            <Eye className="h-3 w-3" />
                          ) : (
                            <EyeOff className="h-3 w-3" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveColumn(index);
                          }}
                          className="p-0.5 rounded hover:bg-destructive/10"
                          title={LABELS.removeColumn}
                          aria-label={LABELS.removeColumn}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Properties */}
        <div className="w-64 border-l bg-muted/30 flex flex-col shrink-0">
          {/* Tabs */}
          <div className="flex border-b shrink-0" role="tablist">
            {(['columns', 'filters', 'sort', 'options'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                role="tab"
                aria-selected={activeTab === tab}
                className={cn(
                  'flex-1 px-2 py-2 text-xs font-medium capitalize transition-colors',
                  activeTab === tab
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {/* Columns Tab - Selected column properties */}
            {activeTab === 'columns' && (
              <div>
                {selectedColumnIndex !== null && columns[selectedColumnIndex] ? (
                  <div className="space-y-3">
                    <div className="text-xs font-medium">{LABELS.columnProperties}</div>
                    <div>
                      <label className="text-xs text-muted-foreground">{LABELS.labelField}</label>
                      <input
                        type="text"
                        value={columns[selectedColumnIndex].label ?? ''}
                        onChange={(e) => {
                          if (readOnly) return;
                          const idx = selectedColumnIndex;
                          pushState({
                            columns: columns.map((c, i) => (i === idx ? { ...c, label: e.target.value } : c)),
                          });
                        }}
                        className="w-full px-2 py-1 text-sm border rounded bg-background mt-1"
                        readOnly={readOnly}
                        data-testid="column-label-input"
                      />
                    </div>
                    {/* Field type selector */}
                    <div>
                      <label className="text-xs text-muted-foreground">Field Type</label>
                      <select
                        value={availableFields.find((f) => f.name === columns[selectedColumnIndex].field)?.type ?? 'text'}
                        onChange={(e) => {
                          if (readOnly) return;
                          // Field type is informational — stored on the availableField, not the column
                        }}
                        className="w-full px-2 py-1 text-sm border rounded bg-background mt-1"
                        disabled={readOnly}
                        data-testid="column-field-type"
                      >
                        {DESIGNER_FIELD_TYPES.map((ft) => (
                          <option key={ft.value} value={ft.value}>
                            {ft.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">{LABELS.widthField}</label>
                      <input
                        type="text"
                        value={columns[selectedColumnIndex].width ?? ''}
                        onChange={(e) => {
                          if (readOnly) return;
                          const idx = selectedColumnIndex;
                          const val = e.target.value;
                          if (val === '' || val === 'auto') {
                            pushState({
                              columns: columns.map((c, i) => (i === idx ? { ...c, width: val || undefined } : c)),
                            });
                            return;
                          }
                          if (/^\d+$/.test(val)) {
                            const num = Number(val);
                            const clamped = Math.max(COLUMN_WIDTH_MIN, Math.min(COLUMN_WIDTH_MAX, num));
                            pushState({
                              columns: columns.map((c, i) => (i === idx ? { ...c, width: clamped } : c)),
                            });
                            return;
                          }
                          // Reject non-numeric, non-auto values
                        }}
                        placeholder={LABELS.widthPlaceholder}
                        className="w-full px-2 py-1 text-sm border rounded bg-background mt-1"
                        readOnly={readOnly}
                        data-testid="column-width-input"
                      />
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">
                        {COLUMN_WIDTH_MIN}–{COLUMN_WIDTH_MAX}px or &quot;auto&quot;
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {LABELS.fieldLabel} <span className="font-mono">{columns[selectedColumnIndex].field}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    {LABELS.selectColumnPrompt}
                  </div>
                )}
              </div>
            )}

            {/* Filters Tab */}
            {activeTab === 'filters' && (
              <div className="space-y-2">
                {filters.map((filter, index) => (
                  <div key={index} className="space-y-1 p-2 border rounded bg-background" data-testid={`filter-${index}`}>
                    <div className="flex items-center gap-1">
                      <select
                        value={filter.field}
                        onChange={(e) => handleUpdateFilter(index, { field: e.target.value })}
                        className="flex-1 px-1 py-0.5 text-xs border rounded bg-background"
                        disabled={readOnly}
                      >
                        {availableFields.map((f) => (
                          <option key={f.name} value={f.name}>
                            {f.label || f.name}
                          </option>
                        ))}
                      </select>
                      {!readOnly && (
                        <button
                          onClick={() => handleRemoveFilter(index)}
                          className="p-0.5 rounded hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <select
                        value={filter.operator}
                        onChange={(e) => handleUpdateFilter(index, { operator: e.target.value })}
                        className="w-24 px-1 py-0.5 text-xs border rounded bg-background"
                        disabled={readOnly}
                      >
                        {FILTER_OPERATORS.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={filter.value ?? ''}
                        onChange={(e) => handleUpdateFilter(index, { value: e.target.value })}
                        placeholder={LABELS.valuePlaceholder}
                        className="flex-1 px-1 py-0.5 text-xs border rounded bg-background"
                        readOnly={readOnly}
                      />
                    </div>
                  </div>
                ))}
                {!readOnly && (
                  <button
                    onClick={handleAddFilter}
                    className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded border border-dashed border-border hover:bg-accent"
                    data-testid="add-filter"
                    aria-label={LABELS.addFilter}
                  >
                    <Plus className="h-3 w-3" /> {LABELS.addFilter}
                  </button>
                )}
              </div>
            )}

            {/* Sort Tab */}
            {activeTab === 'sort' && (
              <div className="space-y-2">
                {sort.map((s, index) => (
                  <div key={index} className="flex items-center gap-1 p-2 border rounded bg-background" data-testid={`sort-${index}`}>
                    <select
                      value={s.field}
                      onChange={(e) => handleUpdateSort(index, { field: e.target.value })}
                      className="flex-1 px-1 py-0.5 text-xs border rounded bg-background"
                      disabled={readOnly}
                    >
                      {availableFields.map((f) => (
                        <option key={f.name} value={f.name}>
                          {f.label || f.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={s.direction}
                      onChange={(e) => handleUpdateSort(index, { direction: e.target.value as 'asc' | 'desc' })}
                      className="w-16 px-1 py-0.5 text-xs border rounded bg-background"
                      disabled={readOnly}
                    >
                      <option value="asc">{LABELS.asc}</option>
                      <option value="desc">{LABELS.desc}</option>
                    </select>
                    {!readOnly && (
                      <button
                        onClick={() => handleRemoveSort(index)}
                        className="p-0.5 rounded hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    )}
                  </div>
                ))}
                {!readOnly && (
                  <button
                    onClick={handleAddSort}
                    className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded border border-dashed border-border hover:bg-accent"
                    data-testid="add-sort"
                    aria-label={LABELS.addSort}
                  >
                    <Plus className="h-3 w-3" /> {LABELS.addSort}
                  </button>
                )}
              </div>
            )}

            {/* Options Tab - Type-specific configuration */}
            {activeTab === 'options' && (
              <div className="space-y-3">
                <div className="text-xs font-medium">
                  {VIEW_TYPE_OPTIONS.find((v) => v.type === viewType)?.label ?? viewType} Options
                </div>
                {viewType === 'kanban' && (
                  <div>
                    <label className="text-xs text-muted-foreground">{LABELS.groupByField}</label>
                    <select
                      value={options.groupBy ?? ''}
                      onChange={(e) => !readOnly && pushState({ options: { ...options, groupBy: e.target.value } })}
                      className="w-full px-2 py-1 text-sm border rounded bg-background mt-1"
                      disabled={readOnly}
                      data-testid="kanban-group-by"
                    >
                      <option value="">{LABELS.selectField}</option>
                      {availableFields.map((f) => (
                        <option key={f.name} value={f.name}>
                          {f.label || f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {viewType === 'calendar' && (
                  <>
                    <div>
                      <label className="text-xs text-muted-foreground">{LABELS.startDateField}</label>
                      <select
                        value={options.startDateField ?? ''}
                        onChange={(e) => !readOnly && pushState({ options: { ...options, startDateField: e.target.value } })}
                        className="w-full px-2 py-1 text-sm border rounded bg-background mt-1"
                        disabled={readOnly}
                        data-testid="calendar-start-date"
                      >
                        <option value="">{LABELS.selectField}</option>
                        {availableFields.map((f) => (
                          <option key={f.name} value={f.name}>
                            {f.label || f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">{LABELS.titleField}</label>
                      <select
                        value={options.titleField ?? ''}
                        onChange={(e) => !readOnly && pushState({ options: { ...options, titleField: e.target.value } })}
                        className="w-full px-2 py-1 text-sm border rounded bg-background mt-1"
                        disabled={readOnly}
                        data-testid="calendar-title-field"
                      >
                        <option value="">{LABELS.selectField}</option>
                        {availableFields.map((f) => (
                          <option key={f.name} value={f.name}>
                            {f.label || f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                {viewType === 'map' && (
                  <>
                    <div>
                      <label className="text-xs text-muted-foreground">{LABELS.latitudeField}</label>
                      <select
                        value={options.latitudeField ?? ''}
                        onChange={(e) => !readOnly && pushState({ options: { ...options, latitudeField: e.target.value } })}
                        className="w-full px-2 py-1 text-sm border rounded bg-background mt-1"
                        disabled={readOnly}
                      >
                        <option value="">{LABELS.selectField}</option>
                        {availableFields.map((f) => (
                          <option key={f.name} value={f.name}>
                            {f.label || f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">{LABELS.longitudeField}</label>
                      <select
                        value={options.longitudeField ?? ''}
                        onChange={(e) => !readOnly && pushState({ options: { ...options, longitudeField: e.target.value } })}
                        className="w-full px-2 py-1 text-sm border rounded bg-background mt-1"
                        disabled={readOnly}
                      >
                        <option value="">{LABELS.selectField}</option>
                        {availableFields.map((f) => (
                          <option key={f.name} value={f.name}>
                            {f.label || f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                {(viewType === 'gallery') && (
                  <div>
                    <label className="text-xs text-muted-foreground">{LABELS.imageField}</label>
                    <select
                      value={options.imageField ?? ''}
                      onChange={(e) => !readOnly && pushState({ options: { ...options, imageField: e.target.value } })}
                      className="w-full px-2 py-1 text-sm border rounded bg-background mt-1"
                      disabled={readOnly}
                    >
                      <option value="">{LABELS.selectField}</option>
                      {availableFields.map((f) => (
                        <option key={f.name} value={f.name}>
                          {f.label || f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {(viewType === 'timeline' || viewType === 'gantt') && (
                  <>
                    <div>
                      <label className="text-xs text-muted-foreground">{LABELS.dateField}</label>
                      <select
                        value={options.dateField ?? options.startDateField ?? ''}
                        onChange={(e) => !readOnly && pushState({ options: { ...options, dateField: e.target.value, startDateField: e.target.value } })}
                        className="w-full px-2 py-1 text-sm border rounded bg-background mt-1"
                        disabled={readOnly}
                      >
                        <option value="">{LABELS.selectField}</option>
                        {availableFields.map((f) => (
                          <option key={f.name} value={f.name}>
                            {f.label || f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">{LABELS.titleField}</label>
                      <select
                        value={options.titleField ?? ''}
                        onChange={(e) => !readOnly && pushState({ options: { ...options, titleField: e.target.value } })}
                        className="w-full px-2 py-1 text-sm border rounded bg-background mt-1"
                        disabled={readOnly}
                      >
                        <option value="">{LABELS.selectField}</option>
                        {availableFields.map((f) => (
                          <option key={f.name} value={f.name}>
                            {f.label || f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                {viewType === 'grid' && (
                  <div className="text-xs text-muted-foreground text-center py-2">
                    {LABELS.gridOptionsHint}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={confirmDialog.onCancel}
      />
    </div>
  );
}
