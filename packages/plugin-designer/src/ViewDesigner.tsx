/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useCallback, useMemo } from 'react';
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
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
  const [viewLabel, setViewLabel] = useState(initialViewLabel);
  const [viewType, setViewType] = useState<ViewType>(initialViewType);
  const [columns, setColumns] = useState<ViewDesignerColumn[]>(initialColumns);
  const [filters, setFilters] = useState<Array<{ field: string; operator: string; value: any }>>(initialFilters);
  const [sort, setSort] = useState<Array<{ field: string; direction: 'asc' | 'desc' }>>(initialSort);
  const [options, setOptions] = useState<Record<string, any>>(initialOptions);
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
      setColumns((prev) => [...prev, newCol]);
    },
    [availableFields, columns.length, readOnly],
  );

  const handleRemoveColumn = useCallback(
    (index: number) => {
      if (readOnly) return;
      setColumns((prev) => prev.filter((_, i) => i !== index));
      if (selectedColumnIndex === index) setSelectedColumnIndex(null);
    },
    [readOnly, selectedColumnIndex],
  );

  const handleToggleColumnVisibility = useCallback(
    (index: number) => {
      if (readOnly) return;
      setColumns((prev) =>
        prev.map((col, i) => (i === index ? { ...col, visible: !col.visible } : col)),
      );
    },
    [readOnly],
  );

  const handleMoveColumn = useCallback(
    (index: number, direction: 'up' | 'down') => {
      if (readOnly) return;
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= columns.length) return;
      setColumns((prev) => {
        const updated = [...prev];
        const temp = updated[index];
        updated[index] = updated[newIndex];
        updated[newIndex] = temp;
        return updated;
      });
      setSelectedColumnIndex(newIndex);
    },
    [readOnly, columns.length],
  );

  const handleAddFilter = useCallback(() => {
    if (readOnly || availableFields.length === 0) return;
    setFilters((prev) => [
      ...prev,
      { field: availableFields[0].name, operator: 'equals', value: '' },
    ]);
  }, [readOnly, availableFields]);

  const handleRemoveFilter = useCallback(
    (index: number) => {
      if (readOnly) return;
      setFilters((prev) => prev.filter((_, i) => i !== index));
    },
    [readOnly],
  );

  const handleUpdateFilter = useCallback(
    (index: number, updates: Partial<{ field: string; operator: string; value: any }>) => {
      if (readOnly) return;
      setFilters((prev) =>
        prev.map((f, i) => (i === index ? { ...f, ...updates } : f)),
      );
    },
    [readOnly],
  );

  const handleAddSort = useCallback(() => {
    if (readOnly || availableFields.length === 0) return;
    setSort((prev) => [
      ...prev,
      { field: availableFields[0].name, direction: 'asc' as const },
    ]);
  }, [readOnly, availableFields]);

  const handleRemoveSort = useCallback(
    (index: number) => {
      if (readOnly) return;
      setSort((prev) => prev.filter((_, i) => i !== index));
    },
    [readOnly],
  );

  const handleUpdateSort = useCallback(
    (index: number, updates: Partial<{ field: string; direction: 'asc' | 'desc' }>) => {
      if (readOnly) return;
      setSort((prev) =>
        prev.map((s, i) => (i === index ? { ...s, ...updates } : s)),
      );
    },
    [readOnly],
  );

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

  return (
    <div className={cn('flex flex-col h-full w-full border rounded-lg overflow-hidden bg-background', className)}>
      {/* Top Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-muted/20 shrink-0">
        <Settings2 className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">View Designer</span>
        <span className="text-xs text-muted-foreground">— {objectName}</span>
        <div className="flex-1" />
        {!readOnly && (
          <>
            {onCancel && (
              <button
                onClick={onCancel}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded border border-border hover:bg-accent"
                data-testid="view-designer-cancel"
              >
                <X className="h-3 w-3" /> Cancel
              </button>
            )}
            <button
              onClick={handleSave}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="view-designer-save"
            >
              <Save className="h-3 w-3" /> Save View
            </button>
          </>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Field Palette */}
        {!readOnly && (
          <div className="w-56 border-r bg-muted/30 flex flex-col shrink-0">
            <div className="p-3 border-b font-medium text-sm">Available Fields</div>
            <div className="flex-1 overflow-y-auto p-2">
              {unusedFields.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">
                  All fields added
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
              <label className="text-xs font-semibold text-foreground">View Type</label>
              <div className="flex gap-2 flex-wrap">
                {VIEW_TYPE_OPTIONS.map(({ type, label, icon: Icon }) => (
                  <button
                    key={type}
                    onClick={() => !readOnly && setViewType(type)}
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
              <label className="text-xs font-semibold text-foreground">View Name</label>
              <input
                type="text"
                value={viewLabel}
                onChange={(e) => !readOnly && setViewLabel(e.target.value)}
                placeholder="Enter view name..."
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
                  <p>No columns added yet</p>
                  <p className="text-xs mt-1">Add fields from the left panel to design your view</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Columns ({columns.length})
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
                          title="Move up"
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
                          title="Move down"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleColumnVisibility(index);
                          }}
                          className="p-0.5 rounded hover:bg-accent"
                          title={col.visible !== false ? 'Hide column' : 'Show column'}
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
                          title="Remove column"
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
          <div className="flex border-b shrink-0">
            {(['columns', 'filters', 'sort', 'options'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
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
                    <div className="text-xs font-medium">Column Properties</div>
                    <div>
                      <label className="text-xs text-muted-foreground">Label</label>
                      <input
                        type="text"
                        value={columns[selectedColumnIndex].label ?? ''}
                        onChange={(e) => {
                          if (readOnly) return;
                          const idx = selectedColumnIndex;
                          setColumns((prev) =>
                            prev.map((c, i) => (i === idx ? { ...c, label: e.target.value } : c)),
                          );
                        }}
                        className="w-full px-2 py-1 text-sm border rounded bg-background mt-1"
                        readOnly={readOnly}
                        data-testid="column-label-input"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Width</label>
                      <input
                        type="text"
                        value={columns[selectedColumnIndex].width ?? ''}
                        onChange={(e) => {
                          if (readOnly) return;
                          const idx = selectedColumnIndex;
                          const val = e.target.value;
                          setColumns((prev) =>
                            prev.map((c, i) =>
                              i === idx
                                ? { ...c, width: /^\d+$/.test(val) ? Number(val) : val }
                                : c,
                            ),
                          );
                        }}
                        placeholder="auto"
                        className="w-full px-2 py-1 text-sm border rounded bg-background mt-1"
                        readOnly={readOnly}
                        data-testid="column-width-input"
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Field: <span className="font-mono">{columns[selectedColumnIndex].field}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    Select a column to edit its properties
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
                        placeholder="Value"
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
                  >
                    <Plus className="h-3 w-3" /> Add Filter
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
                      <option value="asc">Asc</option>
                      <option value="desc">Desc</option>
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
                  >
                    <Plus className="h-3 w-3" /> Add Sort
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
                    <label className="text-xs text-muted-foreground">Group By Field</label>
                    <select
                      value={options.groupBy ?? ''}
                      onChange={(e) => !readOnly && setOptions((prev) => ({ ...prev, groupBy: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border rounded bg-background mt-1"
                      disabled={readOnly}
                      data-testid="kanban-group-by"
                    >
                      <option value="">Select field...</option>
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
                      <label className="text-xs text-muted-foreground">Start Date Field</label>
                      <select
                        value={options.startDateField ?? ''}
                        onChange={(e) => !readOnly && setOptions((prev) => ({ ...prev, startDateField: e.target.value }))}
                        className="w-full px-2 py-1 text-sm border rounded bg-background mt-1"
                        disabled={readOnly}
                        data-testid="calendar-start-date"
                      >
                        <option value="">Select field...</option>
                        {availableFields.map((f) => (
                          <option key={f.name} value={f.name}>
                            {f.label || f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Title Field</label>
                      <select
                        value={options.titleField ?? ''}
                        onChange={(e) => !readOnly && setOptions((prev) => ({ ...prev, titleField: e.target.value }))}
                        className="w-full px-2 py-1 text-sm border rounded bg-background mt-1"
                        disabled={readOnly}
                        data-testid="calendar-title-field"
                      >
                        <option value="">Select field...</option>
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
                      <label className="text-xs text-muted-foreground">Latitude Field</label>
                      <select
                        value={options.latitudeField ?? ''}
                        onChange={(e) => !readOnly && setOptions((prev) => ({ ...prev, latitudeField: e.target.value }))}
                        className="w-full px-2 py-1 text-sm border rounded bg-background mt-1"
                        disabled={readOnly}
                      >
                        <option value="">Select field...</option>
                        {availableFields.map((f) => (
                          <option key={f.name} value={f.name}>
                            {f.label || f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Longitude Field</label>
                      <select
                        value={options.longitudeField ?? ''}
                        onChange={(e) => !readOnly && setOptions((prev) => ({ ...prev, longitudeField: e.target.value }))}
                        className="w-full px-2 py-1 text-sm border rounded bg-background mt-1"
                        disabled={readOnly}
                      >
                        <option value="">Select field...</option>
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
                    <label className="text-xs text-muted-foreground">Image Field</label>
                    <select
                      value={options.imageField ?? ''}
                      onChange={(e) => !readOnly && setOptions((prev) => ({ ...prev, imageField: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border rounded bg-background mt-1"
                      disabled={readOnly}
                    >
                      <option value="">Select field...</option>
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
                      <label className="text-xs text-muted-foreground">Date Field</label>
                      <select
                        value={options.dateField ?? options.startDateField ?? ''}
                        onChange={(e) => !readOnly && setOptions((prev) => ({ ...prev, dateField: e.target.value, startDateField: e.target.value }))}
                        className="w-full px-2 py-1 text-sm border rounded bg-background mt-1"
                        disabled={readOnly}
                      >
                        <option value="">Select field...</option>
                        {availableFields.map((f) => (
                          <option key={f.name} value={f.name}>
                            {f.label || f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Title Field</label>
                      <select
                        value={options.titleField ?? ''}
                        onChange={(e) => !readOnly && setOptions((prev) => ({ ...prev, titleField: e.target.value }))}
                        className="w-full px-2 py-1 text-sm border rounded bg-background mt-1"
                        disabled={readOnly}
                      >
                        <option value="">Select field...</option>
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
                    Grid view uses the columns configured above.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
