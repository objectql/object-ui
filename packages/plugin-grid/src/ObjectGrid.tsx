/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ObjectGrid Component
 * 
 * A specialized grid component built on top of data-table.
 * Auto-generates columns from ObjectQL schema with type-aware rendering.
 * Implements the grid view type from @objectstack/spec view.zod ListView schema.
 * 
 * Features:
 * - Traditional table/grid with CRUD operations
 * - Search, filters, pagination
 * - Column resizing, sorting
 * - Row selection
 * - Inline editing support
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { ObjectGridSchema, DataSource, ListColumn, ViewData } from '@object-ui/types';
import { SchemaRenderer, useDataScope, useNavigationOverlay, useAction } from '@object-ui/react';
import { getCellRenderer, formatCurrency, formatCompactCurrency, formatDate, formatPercent, humanizeLabel } from '@object-ui/fields';
import {
  Badge, Button, NavigationOverlay,
  Popover, PopoverContent, PopoverTrigger,
} from '@object-ui/components';
import { usePullToRefresh } from '@object-ui/mobile';
import { evaluatePlainCondition, buildExpandFields } from '@object-ui/core';
import { ChevronRight, ChevronDown, Download, Rows2, Rows3, Rows4, AlignJustify, Type, Hash, Calendar, CheckSquare, User, Tag, Clock } from 'lucide-react';
import { useRowColor } from './useRowColor';
import { useGroupedData } from './useGroupedData';
import { GroupRow } from './GroupRow';
import { useColumnSummary } from './useColumnSummary';
import { RowActionMenu, formatActionLabel } from './components/RowActionMenu';
import { BulkActionBar } from './components/BulkActionBar';

export interface ObjectGridProps {
  schema: ObjectGridSchema;
  dataSource?: DataSource;
  className?: string;
  onRowClick?: (record: any) => void;
  onEdit?: (record: any) => void;
  onDelete?: (record: any) => void;
  onBulkDelete?: (records: any[]) => void;
  onCellChange?: (rowIndex: number, columnKey: string, newValue: any, row: any) => void;
  onRowSave?: (rowIndex: number, changes: Record<string, any>, row: any) => void | Promise<void>;
  onBatchSave?: (changes: Array<{ rowIndex: number; changes: Record<string, any>; row: any }>) => void | Promise<void>;
  onRowSelect?: (selectedRows: any[]) => void;
  onAddRecord?: () => void;
}

/**
 * Helper to get data configuration from schema
 * Handles both new ViewData format and legacy inline data
 */
function getDataConfig(schema: ObjectGridSchema): ViewData | null {
  // New format: explicit data configuration
  if (schema.data) {
    // Check if data is an array (shorthand format) or already a ViewData object
    if (Array.isArray(schema.data)) {
      // Convert array shorthand to proper ViewData format
      return {
        provider: 'value',
        items: schema.data,
      };
    }
    // Already in ViewData format
    return schema.data;
  }
  
  // Legacy format: staticData field
  if (schema.staticData) {
    return {
      provider: 'value',
      items: schema.staticData,
    };
  }
  
  // Default: use object provider with objectName
  if (schema.objectName) {
    return {
      provider: 'object',
      object: schema.objectName,
    };
  }
  
  return null;
}

/**
 * Helper to normalize columns configuration
 * Handles both string[] and ListColumn[] formats
 */
function normalizeColumns(
  columns: string[] | ListColumn[] | undefined
): ListColumn[] | string[] | undefined {
  if (!columns || columns.length === 0) return undefined;
  
  // Already in ListColumn format - check for object type with optional chaining
  if (typeof columns[0] === 'object' && columns[0] !== null) {
    return columns as ListColumn[];
  }
  
  // String array format
  return columns as string[];
}

export const ObjectGrid: React.FC<ObjectGridProps> = ({
  schema,
  dataSource,
  onEdit,
  onDelete,
  onRowSelect,
  onRowClick,
  onCellChange,
  onRowSave,
  onBatchSave,
  onAddRecord,
  ...rest
}) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [objectSchema, setObjectSchema] = useState<any>(null);
  const [useCardView, setUseCardView] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showExport, setShowExport] = useState(false);
  const [rowHeightMode, setRowHeightMode] = useState<'compact' | 'short' | 'medium' | 'tall' | 'extra_tall'>(schema.rowHeight ?? 'medium');
  const [selectedRows, setSelectedRows] = useState<any[]>([]);

  // Column state persistence (order and widths)
  const columnStorageKey = React.useMemo(() => {
    return schema.id
      ? `grid-columns-${schema.objectName}-${schema.id}`
      : `grid-columns-${schema.objectName}`;
  }, [schema.objectName, schema.id]);

  const [columnState, setColumnState] = useState<{
    order?: string[];
    widths?: Record<string, number>;
  }>(() => {
    try {
      const saved = localStorage.getItem(columnStorageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const saveColumnState = useCallback((state: typeof columnState) => {
    setColumnState(state);
    try {
      localStorage.setItem(columnStorageKey, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to persist column state:', e);
    }
  }, [columnStorageKey]);

  const handlePullRefresh = useCallback(async () => {
    setRefreshKey(k => k + 1);
  }, []);

  const { ref: pullRef, isRefreshing, pullDistance } = usePullToRefresh<HTMLDivElement>({
    onRefresh: handlePullRefresh,
    enabled: !!dataSource && !!schema.objectName,
  });

  useEffect(() => {
    const checkWidth = () => setUseCardView(window.innerWidth < 480);
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  // Check if data is passed directly (from ListView)
  const passedData = (rest as any).data;

  // Resolve bound data if 'bind' property exists
  const boundData = useDataScope(schema.bind);

  // Get data configuration (supports both new and legacy formats)
  const rawDataConfig = getDataConfig(schema);
  // Memoize dataConfig using deep comparison to prevent infinite loops
  const dataConfig = React.useMemo(() => {
    // If we have passed data (highest priority), treat it as value provider
    if (passedData && Array.isArray(passedData)) {
        return {
            provider: 'value',
            items: passedData
        };
    }

    // If we have bound data, it takes precedence as inline value
    if (boundData && Array.isArray(boundData)) {
        return {
            provider: 'value',
            items: boundData
        };
    }
    return rawDataConfig;
  }, [JSON.stringify(rawDataConfig), boundData, passedData]);
  
  const hasInlineData = dataConfig?.provider === 'value';

  // Extract stable primitive/reference-stable values from schema for dependency arrays.
  // This prevents infinite re-render loops when schema is a new object on each render
  // (e.g. when rendered through SchemaRenderer which creates a fresh evaluatedSchema).
  const objectName = dataConfig?.provider === 'object' && dataConfig && 'object' in dataConfig
    ? (dataConfig as any).object
    : schema.objectName;
  const schemaFields = schema.fields;
  const schemaColumns = schema.columns;
  const schemaFilter = schema.filter;
  const schemaSort = schema.sort;
  const schemaPagination = schema.pagination;
  const schemaPageSize = schema.pageSize;

  // --- Inline data effect (synchronous, no fetch needed) ---
  useEffect(() => {
    if (hasInlineData && dataConfig?.provider === 'value') {
       // Only update if data is different to avoid infinite loop
       setData(prev => {
         const newItems = dataConfig.items as any[];
         if (JSON.stringify(prev) !== JSON.stringify(newItems)) {
            return newItems;
         }
         return prev;
       });
       setLoading(false);
    }
  }, [hasInlineData, dataConfig]);

  // --- Unified async data loading effect ---
  // Combines schema fetch + data fetch into a single async flow with AbortController.
  // This avoids the fragile "chained effects" pattern where Effect 1 sets objectSchema,
  // triggering Effect 2 to call fetchData — a pattern prone to infinite loops when
  // fetchData's reference is unstable.
  useEffect(() => {
    if (hasInlineData) return;

    let cancelled = false;

    const loadSchemaAndData = async () => {
      setLoading(true);
      setError(null);
      try {
        // --- Step 1: Resolve object schema ---
        let resolvedSchema: any = null;
        const cols = normalizeColumns(schemaColumns) || schemaFields;

        if (cols && objectName) {
          // We have explicit columns — use a minimal schema stub
          resolvedSchema = { name: objectName, fields: {} };
        } else if (objectName && dataSource) {
          // Fetch full schema from DataSource
          const schemaData = await dataSource.getObjectSchema(objectName);
          if (cancelled) return;
          resolvedSchema = schemaData;
        } else if (!objectName) {
          throw new Error('Object name required for data fetching');
        } else {
          throw new Error('DataSource required');
        }

        if (!cancelled) {
          setObjectSchema(resolvedSchema);
        }

        // --- Step 2: Fetch data ---
        if (dataSource && objectName) {
          const getSelectFields = () => {
            if (schemaFields) return schemaFields;
            if (schemaColumns && Array.isArray(schemaColumns)) {
              return schemaColumns.map((c: any) => typeof c === 'string' ? c : c.field);
            }
            return undefined;
          };

          const params: any = {
            $select: getSelectFields(),
            $top: (schemaPagination as any)?.pageSize || schemaPageSize || 50,
          };

          // Support new filter format
          if (schemaFilter && Array.isArray(schemaFilter)) {
            params.$filter = schemaFilter;
          } else if (schema.defaultFilters) {
            // Legacy support
            params.$filter = schema.defaultFilters;
          }

          // Support new sort format
          if (schemaSort) {
            if (typeof schemaSort === 'string') {
              params.$orderby = schemaSort;
            } else if (Array.isArray(schemaSort)) {
              params.$orderby = schemaSort
                .map((s: any) => `${s.field} ${s.order}`)
                .join(', ');
            }
          } else if (schema.defaultSort) {
            // Legacy support
            params.$orderby = `${(schema.defaultSort as any).field} ${(schema.defaultSort as any).order}`;
          }

          // Auto-inject $expand for lookup/master_detail fields
          const expand = buildExpandFields(resolvedSchema?.fields, schemaColumns ?? schemaFields);
          if (expand.length > 0) {
            params.$expand = expand;
          }

          const result = await dataSource.find(objectName, params);
          if (cancelled) return;
          setData(result.data || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadSchemaAndData();

    return () => {
      cancelled = true;
    };
  }, [objectName, schemaFields, schemaColumns, schemaFilter, schemaSort, schemaPagination, schemaPageSize, dataSource, hasInlineData, dataConfig, refreshKey]);

  // --- NavigationConfig support ---
  // Must be called before any early returns to satisfy React hooks rules
  const navigation = useNavigationOverlay({
    navigation: schema.navigation,
    objectName: schema.objectName,
    onNavigate: schema.onNavigate,
    onRowClick,
  });

  // --- Action support for action columns ---
  const { execute: executeAction } = useAction();

  // --- Row color support ---
  const getRowClassName = useRowColor(schema.rowColor);

  // --- Conditional formatting support ---
  const getRowStyle = useCallback((row: Record<string, unknown>): React.CSSProperties | undefined => {
    const rules = schema.conditionalFormatting;
    if (!rules || rules.length === 0) return undefined;
    for (const rule of rules) {
      let match = false;
      const expression =
        ('condition' in rule ? (rule as any).condition : undefined)
        || ('expression' in rule ? (rule as any).expression : undefined)
        || undefined;
      if (expression) {
        match = evaluatePlainCondition(expression, row as Record<string, any>);
      } else if ('field' in rule && 'operator' in rule && (rule as any).field && (rule as any).operator) {
        const r = rule as any;
        const fieldValue = row[r.field];
        switch (r.operator) {
          case 'equals': match = fieldValue === r.value; break;
          case 'not_equals': match = fieldValue !== r.value; break;
          case 'contains': match = typeof fieldValue === 'string' && typeof r.value === 'string' && fieldValue.includes(r.value); break;
          case 'greater_than': match = typeof fieldValue === 'number' && typeof r.value === 'number' && fieldValue > r.value; break;
          case 'less_than': match = typeof fieldValue === 'number' && typeof r.value === 'number' && fieldValue < r.value; break;
          case 'in': match = Array.isArray(r.value) && r.value.includes(fieldValue); break;
        }
      }
      if (match) {
        const style: React.CSSProperties = {};
        if ('style' in rule && (rule as any).style) Object.assign(style, (rule as any).style);
        if ('backgroundColor' in rule && (rule as any).backgroundColor) style.backgroundColor = (rule as any).backgroundColor;
        if ('textColor' in rule && (rule as any).textColor) style.color = (rule as any).textColor;
        if ('borderColor' in rule && (rule as any).borderColor) style.borderColor = (rule as any).borderColor;
        return style;
      }
    }
    return undefined;
  }, [schema.conditionalFormatting]);

  // --- Grouping support ---
  const { groups, isGrouped, toggleGroup } = useGroupedData(schema.grouping, data);

  // --- Column summary support ---
  const summaryColumns = React.useMemo(() => {
    const cols = normalizeColumns(schema.columns);
    if (cols && cols.length > 0 && typeof cols[0] === 'object') {
      return cols as ListColumn[];
    }
    return undefined;
  }, [schema.columns]);
  const { summaries, hasSummary } = useColumnSummary(summaryColumns, data);

  const generateColumns = useCallback(() => {
    // Map field type to column header icon (Airtable-style)
    const getTypeIcon = (fieldType: string | null): React.ReactNode => {
      if (!fieldType) return <Type className="h-3.5 w-3.5" />;
      const iconMap: Record<string, React.ReactNode> = {
        text: <Type className="h-3.5 w-3.5" />,
        number: <Hash className="h-3.5 w-3.5" />,
        currency: <Hash className="h-3.5 w-3.5" />,
        percent: <Hash className="h-3.5 w-3.5" />,
        date: <Calendar className="h-3.5 w-3.5" />,
        datetime: <Clock className="h-3.5 w-3.5" />,
        boolean: <CheckSquare className="h-3.5 w-3.5" />,
        user: <User className="h-3.5 w-3.5" />,
        select: <Tag className="h-3.5 w-3.5" />,
      };
      return iconMap[fieldType] || <Type className="h-3.5 w-3.5" />;
    };

    // Auto-infer column type from field name and data values (Airtable-style)
    const inferColumnType = (col: ListColumn): string | null => {
      if (col.type) return col.type; // Explicit type takes priority

      const fieldLower = col.field.toLowerCase();

      // Infer boolean fields
      const booleanFields = ['completed', 'is_completed', 'done', 'active', 'enabled', 'archived'];
      if (booleanFields.some(f => fieldLower === f || fieldLower === `is_${f}`)) {
        return 'boolean';
      }

      // Infer datetime fields (fields with time component: created_time, modified_time, *_at patterns)
      const datetimePatterns = ['created_time', 'modified_time', 'updated_time', 'created_at', 'updated_at', 'modified_at', 'last_login', 'logged_at'];
      if (datetimePatterns.some(p => fieldLower === p || fieldLower.endsWith(`_${p}`))) {
        return 'datetime';
      }

      // Infer date fields from name patterns
      const datePatterns = ['date', 'due', 'created', 'updated', 'deadline', 'start', 'end', 'expires'];
      if (datePatterns.some(p => fieldLower.includes(p))) {
        // Verify with data: check if sample values look like dates
        if (data.length > 0) {
          const sample = data.find(row => row[col.field] != null)?.[col.field];
          if (typeof sample === 'string' && !isNaN(Date.parse(sample))) {
            return 'date';
          }
        }
        return 'date';
      }

      // Infer percent fields from name patterns
      const percentFields = ['probability', 'percent', 'percentage', 'completion', 'progress', 'rate'];
      if (percentFields.some(f => fieldLower.includes(f))) {
        if (data.length > 0) {
          const sample = data.find(row => row[col.field] != null)?.[col.field];
          if (typeof sample === 'number') {
            return 'percent';
          }
        }
      }

      // Infer select/badge fields (status, priority, category, etc.)
      const selectFields = ['status', 'priority', 'category', 'stage', 'type', 'severity', 'level'];
      if (selectFields.some(f => fieldLower.includes(f))) {
        if (data.length > 0) {
          const uniqueValues = new Set(data.map(row => row[col.field]).filter(Boolean));
          if (uniqueValues.size > 0 && uniqueValues.size <= 10) {
            return 'select';
          }
        }
      }

      // Infer user/assignee fields
      const userFields = ['assignee', 'owner', 'author', 'reporter', 'creator', 'user'];
      if (userFields.some(f => fieldLower.includes(f))) {
        return 'user';
      }

      // Infer currency/amount fields
      const currencyFields = ['amount', 'price', 'total', 'revenue', 'cost', 'budget', 'salary'];
      if (currencyFields.some(f => fieldLower.includes(f))) {
        if (data.length > 0) {
          const sample = data.find(row => row[col.field] != null)?.[col.field];
          if (typeof sample === 'number') {
            return 'currency';
          }
        }
      }

      // Fallback: detect ISO date strings in data values (catch-all for unmatched field names)
      if (data.length > 0) {
        const sample = data.find(row => row[col.field] != null)?.[col.field];
        if (typeof sample === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(sample)) {
          return 'datetime';
        }
      }

      return null;
    };

    // Use normalized columns (support both new and legacy)
    const cols = normalizeColumns(schemaColumns);
    
    if (cols) {
      // Check if columns are already in data-table format (have 'accessorKey')
      // vs ListColumn format (have 'field')
      if (cols.length > 0 && typeof cols[0] === 'object' && cols[0] !== null) {
        const firstCol = cols[0] as any;
        
        // Already in data-table format - apply type inference for columns without custom cell renderers
        if ('accessorKey' in firstCol) {
          return (cols as any[]).map((col) => {
            if (col.cell) return col; // already has custom renderer

            const syntheticCol: ListColumn = { field: col.accessorKey, label: col.header, type: col.type };
            const inferredType = inferColumnType(syntheticCol);
            if (!inferredType) return col;

            const CellRenderer = getCellRenderer(inferredType);
            const fieldMeta: Record<string, any> = { name: col.accessorKey, type: inferredType };

            if (inferredType === 'select') {
              const uniqueValues = Array.from(new Set(data.map(row => row[col.accessorKey]).filter(Boolean)));
              fieldMeta.options = uniqueValues.map((v: any) => ({ value: v, label: humanizeLabel(String(v)) }));
            }

            return {
              ...col,
              headerIcon: getTypeIcon(inferredType),
              cell: (value: any) => <CellRenderer value={value} field={fieldMeta as any} />,
            };
          });
        }
        
        // ListColumn format - convert to data-table format with full feature support
        if ('field' in firstCol) {
          return (cols as ListColumn[])
            .filter((col) => col?.field && typeof col.field === 'string' && !col.hidden)
            .map((col, colIndex) => {
              const header = col.label || col.field.charAt(0).toUpperCase() + col.field.slice(1).replace(/_/g, ' ');

              // Build custom cell renderer based on column configuration
              let cellRenderer: ((value: any, row: any) => React.ReactNode) | undefined;

              // Type-based cell renderer with auto-inference (e.g., "currency", "date", "boolean")
              const inferredType = inferColumnType(col);
              const CellRenderer = inferredType ? getCellRenderer(inferredType) : null;

              // Build field metadata for cell renderers (includes options for select fields)
              const fieldMeta: Record<string, any> = { name: col.field, type: inferredType || 'text' };
              if (inferredType === 'select' && !(col as any).options) {
                // Auto-generate options from unique data values for inferred select fields
                const uniqueValues = Array.from(new Set(data.map(row => row[col.field]).filter(Boolean)));
                fieldMeta.options = uniqueValues.map(v => ({ value: v, label: humanizeLabel(String(v)) }));
              }
              if ((col as any).options) {
                fieldMeta.options = (col as any).options;
              }

              // Auto-link primary field (first column) to record detail (Airtable-style)
              const isPrimaryField = colIndex === 0 && !col.link && !col.action;
              const isLinked = col.link || isPrimaryField;

              if ((col.link && col.action) || (isPrimaryField && col.action)) {
                // Both link and action: link takes priority for navigation, action executes on secondary interaction
                cellRenderer = (value: any, row: any) => {
                  const displayContent = CellRenderer
                    ? <CellRenderer value={value} field={fieldMeta as any} />
                    : (value != null && value !== '' ? String(value) : <span className="text-muted-foreground/50 text-xs italic">—</span>);
                  return (
                    <button
                      type="button"
                      className="text-primary font-medium underline-offset-4 hover:underline cursor-pointer bg-transparent border-none p-0 text-left font-inherit"
                      data-testid={isPrimaryField ? 'primary-field-link' : 'link-cell'}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigation.handleClick(row);
                      }}
                    >
                      {displayContent}
                    </button>
                  );
                };
              } else if (isLinked) {
                // Link column: clicking navigates to the record detail
                cellRenderer = (value: any, row: any) => {
                  const displayContent = CellRenderer
                    ? <CellRenderer value={value} field={fieldMeta as any} />
                    : (value != null && value !== '' ? String(value) : <span className="text-muted-foreground/50 text-xs italic">—</span>);
                  return (
                    <button
                      type="button"
                      className="text-primary font-medium underline-offset-4 hover:underline cursor-pointer bg-transparent border-none p-0 text-left font-inherit"
                      data-testid={isPrimaryField ? 'primary-field-link' : 'link-cell'}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigation.handleClick(row);
                      }}
                    >
                      {displayContent}
                    </button>
                  );
                };
              } else if (col.action) {
                // Action column: render as action button
                cellRenderer = (value: any, row: any) => {
                  return (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      data-testid="action-cell"
                      onClick={(e) => {
                        e.stopPropagation();
                        executeAction({
                          type: col.action!,
                          params: { record: row, field: col.field, value },
                        });
                      }}
                    >
                      {formatActionLabel(col.action!)}
                    </Button>
                  );
                };
              } else if (CellRenderer) {
                // Type-only cell renderer (no link/action)
                cellRenderer = (value: any) => (
                  <CellRenderer value={value} field={fieldMeta as any} />
                );
              } else {
                // Default renderer with empty value handling
                cellRenderer = (value: any) => (
                  value != null && value !== ''
                    ? <span>{String(value)}</span>
                    : <span className="text-muted-foreground/50 text-xs italic">—</span>
                );
              }

              // Wrap with prefix compound cell renderer (Airtable-style: [Badge] Text in same cell)
              const prefixConfig = (col as any).prefix;
              if (prefixConfig?.field) {
                const baseCellRenderer = cellRenderer;
                const PrefixRenderer = prefixConfig.type === 'badge' ? getCellRenderer('select') : null;
                cellRenderer = (value: any, row: any) => {
                  const prefixValue = row[prefixConfig.field];
                  const prefixEl = prefixValue != null && prefixValue !== ''
                    ? PrefixRenderer
                      ? <PrefixRenderer value={prefixValue} field={{ name: prefixConfig.field, type: 'select' } as any} />
                      : <span className="text-muted-foreground text-xs mr-1.5">{String(prefixValue)}</span>
                    : null;
                  return (
                    <span className="flex items-center gap-1.5">
                      {prefixEl}
                      {baseCellRenderer(value, row)}
                    </span>
                  );
                };
              }

              // Auto-infer alignment from field type if not explicitly set
              const numericTypes = ['number', 'currency', 'percent'];
              const effectiveType = inferredType || col.type;
              const inferredAlign = col.align || (effectiveType && numericTypes.includes(effectiveType) ? 'right' as const : undefined);

              // Determine if column should be hidden on mobile
              const isEssential = colIndex === 0 || (col as any).essential === true;

              return {
                header,
                accessorKey: col.field,
                headerIcon: getTypeIcon(inferredType),
                ...(!isEssential && { className: 'hidden sm:table-cell' }),
                ...(col.width && { width: col.width }),
                ...(inferredAlign && { align: inferredAlign }),
                sortable: col.sortable !== false,
                ...(col.resizable !== undefined && { resizable: col.resizable }),
                ...(col.wrap !== undefined && { wrap: col.wrap }),
                ...(cellRenderer && { cell: cellRenderer }),
                ...(col.pinned && { pinned: col.pinned }),
              };
            });
        }
      }
      
      // String array format - filter out invalid entries
      return (cols as string[])
        .filter((fieldName) => typeof fieldName === 'string' && fieldName.trim().length > 0)
        .map((fieldName) => {
          const fieldLabel = objectSchema?.fields?.[fieldName]?.label;
          return {
            header: fieldLabel || fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/_/g, ' '),
            accessorKey: fieldName,
          };
        });
    }

    // Legacy support: use 'fields' if columns not provided
    if (hasInlineData) {
      const inlineData = dataConfig?.provider === 'value' ? dataConfig.items as any[] : [];
      if (inlineData.length > 0) {
        const fieldsToShow = schemaFields || Object.keys(inlineData[0]);
        return fieldsToShow.map((fieldName) => ({
          header: fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/_/g, ' '),
          accessorKey: fieldName,
        }));
      }
    }

    if (!objectSchema) return [];

    const generatedColumns: any[] = [];
    const fieldsToShow = schemaFields || Object.keys(objectSchema.fields || {});
    
    fieldsToShow.forEach((fieldName) => {
      const field = objectSchema.fields?.[fieldName];
      if (!field) return;

      if (field.permissions && field.permissions.read === false) return;

      const CellRenderer = getCellRenderer(field.type);
      const numericTypes = ['number', 'currency', 'percent'];
      generatedColumns.push({
        header: field.label || fieldName,
        accessorKey: fieldName,
        ...(numericTypes.includes(field.type) && { align: 'right' }),
        cell: (value: any) => <CellRenderer value={value} field={field} />,
        sortable: field.sortable !== false,
      });
    });

    return generatedColumns;
  }, [objectSchema, schemaFields, schemaColumns, dataConfig, hasInlineData, navigation.handleClick, executeAction, data]);

  const handleExport = useCallback((format: 'csv' | 'xlsx' | 'json' | 'pdf') => {
    const exportConfig = schema.exportOptions;
    const maxRecords = exportConfig?.maxRecords || 0;
    const includeHeaders = exportConfig?.includeHeaders !== false;
    const prefix = exportConfig?.fileNamePrefix || schema.objectName || 'export';
    const exportData = maxRecords > 0 ? data.slice(0, maxRecords) : data;

    const downloadFile = (blob: Blob, filename: string) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    };

    const escapeCsvValue = (val: any): string => {
      const str = val == null ? '' : String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };

    if (format === 'csv') {
      const cols = generateColumns().filter((c: any) => c.accessorKey !== '_actions');
      const fields = cols.map((c: any) => c.accessorKey);
      const headers = cols.map((c: any) => c.header);
      const rows: string[] = [];
      if (includeHeaders) {
        rows.push(headers.join(','));
      }
      exportData.forEach(record => {
        rows.push(fields.map((f: string) => escapeCsvValue(record[f])).join(','));
      });
      downloadFile(new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' }), `${prefix}.csv`);
    } else if (format === 'json') {
      downloadFile(new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' }), `${prefix}.json`);
    }
    setShowExport(false);
  }, [data, schema.exportOptions, schema.objectName, generateColumns]);

  if (error) {
    return (
      <div className="p-3 sm:p-4 border border-red-300 bg-red-50 rounded-md">
        <h3 className="text-red-800 font-semibold">Error loading grid</h3>
        <p className="text-red-600 text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  if (loading && data.length === 0) {
    if (useCardView) {
      return (
        <div className="space-y-2 p-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-3 bg-card animate-pulse">
              <div className="h-5 bg-muted rounded w-3/4 mb-3" />
              <div className="flex items-center justify-between mb-2">
                <div className="h-4 bg-muted rounded w-1/4" />
                <div className="h-5 bg-muted rounded-full w-20" />
              </div>
              <div className="h-3 bg-muted rounded w-1/3" />
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="p-4 sm:p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
        <p className="mt-2 text-sm text-muted-foreground">Loading grid...</p>
      </div>
    );
  }

  const columns = generateColumns();

  // Apply persisted column order and widths
  let persistedColumns = [...columns];
  
  // Apply saved widths
  if (columnState.widths) {
    persistedColumns = persistedColumns.map((col: any) => {
      const savedWidth = columnState.widths?.[col.accessorKey];
      if (savedWidth) {
        return { ...col, size: savedWidth };
      }
      return col;
    });
  }
  
  // Apply saved order
  if (columnState.order && columnState.order.length > 0) {
    const orderMap = new Map(columnState.order.map((key: string, i: number) => [key, i]));
    persistedColumns.sort((a: any, b: any) => {
      const orderA = orderMap.get(a.accessorKey) ?? Infinity;
      const orderB = orderMap.get(b.accessorKey) ?? Infinity;
      return orderA - orderB;
    });
  }

  const operations = 'operations' in schema ? schema.operations : undefined;
  const hasActions = operations && (operations.update || operations.delete);
  const hasRowActions = schema.rowActions && schema.rowActions.length > 0;

  const columnsWithActions = (hasActions || hasRowActions) ? [
    ...persistedColumns,
    {
      header: 'Actions',
      accessorKey: '_actions',
      cell: (_value: any, row: any) => (
        <RowActionMenu
          row={row}
          rowActions={schema.rowActions}
          canEdit={!!(operations?.update && onEdit)}
          canDelete={!!(operations?.delete && onDelete)}
          onEdit={onEdit}
          onDelete={onDelete}
          onAction={(action, r) => executeAction({ type: action, params: { record: r } })}
        />
      ),
      sortable: false,
    },
  ] : persistedColumns;

  // --- Pinned column reordering ---
  // Reorder: pinned:'left' first, unpinned middle, pinned:'right' last
  const pinnedLeftCols = columnsWithActions.filter((c: any) => c.pinned === 'left');
  const pinnedRightCols = columnsWithActions.filter((c: any) => c.pinned === 'right');
  const unpinnedCols = columnsWithActions.filter((c: any) => !c.pinned);
  const hasPinnedColumns = pinnedLeftCols.length > 0 || pinnedRightCols.length > 0;
  const rightPinnedClasses = 'sticky right-0 z-10 bg-background border-l border-border';
  const orderedColumns = hasPinnedColumns
    ? [
        ...pinnedLeftCols,
        ...unpinnedCols,
        ...pinnedRightCols.map((col: any) => ({
          ...col,
          className: [col.className, rightPinnedClasses].filter(Boolean).join(' '),
          cellClassName: [col.cellClassName, rightPinnedClasses].filter(Boolean).join(' '),
        })),
      ]
    : columnsWithActions;

  // Calculate frozenColumns: if pinned columns exist, use left-pinned count; otherwise use schema default
  const effectiveFrozenColumns = hasPinnedColumns
    ? pinnedLeftCols.length
    : (schema.frozenColumns ?? 1);

  // Determine selection mode (support both new and legacy formats)
  let selectionMode: 'none' | 'single' | 'multiple' | boolean = false;
  if (schema.selection?.type) {
    selectionMode = schema.selection.type === 'none' ? false : schema.selection.type;
  } else if (schema.selectable !== undefined) {
    // Legacy support
    selectionMode = schema.selectable;
  }

  // Determine pagination settings (support both new and legacy formats)
  const paginationEnabled = schema.pagination !== undefined 
    ? true 
    : (schema.showPagination !== undefined ? schema.showPagination : true);
  
  const pageSize = schema.pagination?.pageSize 
    || schema.pageSize 
    || 10;

  // Determine search settings
  const searchEnabled = schema.searchableFields !== undefined
    ? schema.searchableFields.length > 0
    : (schema.showSearch !== undefined ? schema.showSearch : true);

  const dataTableSchema: any = {
    type: 'data-table',
    caption: schema.label || schema.title,
    columns: orderedColumns,
    data,
    pagination: paginationEnabled,
    pageSize: pageSize,
    searchable: searchEnabled,
    selectable: selectionMode,
    sortable: true,
    exportable: operations?.export,
    rowActions: hasActions,
    resizableColumns: schema.resizable ?? schema.resizableColumns ?? true,
    reorderableColumns: schema.reorderableColumns ?? false,
    editable: schema.editable ?? false,
    className: schema.className,
    cellClassName: rowHeightMode === 'compact'
      ? 'px-3 py-1 text-[13px] leading-tight'
      : rowHeightMode === 'short'
        ? 'px-3 py-1 text-[13px] leading-normal'
        : rowHeightMode === 'tall'
          ? 'px-3 py-2.5 text-sm'
          : rowHeightMode === 'extra_tall'
            ? 'px-3 py-3.5 text-sm leading-relaxed'
            : 'px-3 py-1.5 text-[13px] leading-normal',
    showRowNumbers: true,
    showAddRow: !!operations?.create,
    onAddRecord: onAddRecord,
    rowClassName: schema.rowColor ? (row: any, _idx: number) => getRowClassName(row) : undefined,
    rowStyle: schema.conditionalFormatting?.length ? (row: any, _idx: number) => getRowStyle(row) : undefined,
    frozenColumns: effectiveFrozenColumns,
    onSelectionChange: (rows: any[]) => {
      setSelectedRows(rows);
      onRowSelect?.(rows);
    },
    onRowClick: navigation.handleClick,
    onCellChange: onCellChange,
    onRowSave: onRowSave,
    onBatchSave: onBatchSave,
    onColumnResize: (columnKey: string, width: number) => {
      saveColumnState({
        ...columnState,
        widths: { ...columnState.widths, [columnKey]: width },
      });
    },
    onColumnReorder: (newOrder: string[]) => {
      saveColumnState({
        ...columnState,
        order: newOrder,
      });
    },
  };

  /** Build a per-group data-table schema (inherits everything except data & pagination). */
  const buildGroupTableSchema = (groupRows: any[]) => ({
    ...dataTableSchema,
    caption: undefined,
    data: groupRows,
    pagination: false,
    searchable: false,
  });

  // Build record detail title
  const detailTitle = schema.label
    ? `${schema.label} Detail`
    : schema.objectName
      ? `${schema.objectName.charAt(0).toUpperCase() + schema.objectName.slice(1)} Detail`
      : 'Record Detail';

  // Mobile card-view fallback for screens below 480px
  if (useCardView && data.length > 0 && !isGrouped) {
    const displayColumns = generateColumns().filter((c: any) => c.accessorKey !== '_actions');

    // Build a lookup of column metadata for smart rendering
    const colMap = new Map<string, any>();
    displayColumns.forEach((col: any) => colMap.set(col.accessorKey, col));

    // Identify special columns by inferred type for visual hierarchy
    const titleCol = displayColumns[0]; // First column is always the title
    const amountKeys = ['amount', 'price', 'total', 'revenue', 'cost', 'value', 'budget', 'salary'];
    const stageKeys = ['stage', 'status', 'priority', 'category', 'severity', 'level'];
    const dateKeys = ['date', 'due', 'created', 'updated', 'deadline', 'start', 'end', 'expires'];
    const percentKeys = ['probability', 'percent', 'rate', 'ratio', 'confidence', 'score'];

    // Stage badge color mapping for common pipeline stages
    const stageBadgeColor = (value: string): string => {
      const v = (value || '').toLowerCase();
      if (v.includes('won') || v.includes('completed') || v.includes('done') || v.includes('active'))
        return 'bg-green-100 text-green-800 border-green-300';
      if (v.includes('lost') || v.includes('cancelled') || v.includes('rejected') || v.includes('closed lost'))
        return 'bg-red-100 text-red-800 border-red-300';
      if (v.includes('negotiation') || v.includes('review') || v.includes('in progress'))
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      if (v.includes('proposal') || v.includes('pending'))
        return 'bg-blue-100 text-blue-800 border-blue-300';
      if (v.includes('qualification') || v.includes('qualified'))
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      if (v.includes('prospecting') || v.includes('new') || v.includes('open'))
        return 'bg-purple-100 text-purple-800 border-purple-300';
      return 'bg-muted text-muted-foreground border-border';
    };

    // Left border color for card accent based on stage
    const stageBorderLeft = (value: string): string => {
      const v = (value || '').toLowerCase();
      if (v.includes('won') || v.includes('completed') || v.includes('done') || v.includes('active'))
        return 'border-l-green-500';
      if (v.includes('lost') || v.includes('cancelled') || v.includes('rejected'))
        return 'border-l-red-500';
      if (v.includes('negotiation') || v.includes('review') || v.includes('in progress'))
        return 'border-l-yellow-500';
      if (v.includes('proposal') || v.includes('pending'))
        return 'border-l-blue-500';
      if (v.includes('qualification') || v.includes('qualified'))
        return 'border-l-indigo-500';
      if (v.includes('prospecting') || v.includes('new') || v.includes('open'))
        return 'border-l-purple-500';
      return 'border-l-gray-300';
    };

    const classify = (key: string): 'amount' | 'stage' | 'date' | 'percent' | 'other' => {
      const k = key.toLowerCase();
      if (amountKeys.some(p => k.includes(p))) return 'amount';
      if (stageKeys.some(p => k.includes(p))) return 'stage';
      if (dateKeys.some(p => k.includes(p))) return 'date';
      if (percentKeys.some(p => k.includes(p))) return 'percent';
      return 'other';
    };

    return (
      <>
        <div className="space-y-2 p-2">
          {data.map((row, idx) => {
            // Collect secondary fields (skip the title column)
            const secondaryCols = displayColumns.slice(1, 5);
            const amountCol = secondaryCols.find((c: any) => classify(c.accessorKey) === 'amount');
            const stageCol = secondaryCols.find((c: any) => classify(c.accessorKey) === 'stage');
            const dateCols = secondaryCols.filter((c: any) => classify(c.accessorKey) === 'date');
            const percentCols = secondaryCols.filter((c: any) => classify(c.accessorKey) === 'percent');
            const otherCols = secondaryCols.filter(
              (c: any) => c !== amountCol && c !== stageCol && !dateCols.includes(c) && !percentCols.includes(c)
            );

            // Determine left border accent color from stage value
            const stageValue = stageCol ? String(row[stageCol.accessorKey] ?? '') : '';
            const leftBorderClass = stageValue ? stageBorderLeft(stageValue) : '';
            const cardClassName = [
              'border rounded-lg p-2.5 bg-card hover:bg-accent/50 cursor-pointer transition-colors touch-manipulation',
              leftBorderClass ? `border-l-[3px] ${leftBorderClass}` : '',
            ].filter(Boolean).join(' ');

            return (
              <div
                key={row.id || row._id || idx}
                className={cardClassName}
                onClick={() => navigation.handleClick(row)}
              >
                {/* Title row - Name as bold prominent title */}
                {titleCol && (
                  <div className="font-semibold text-sm truncate mb-1">
                    {row[titleCol.accessorKey] ?? '—'}
                  </div>
                )}

                {/* Amount + Stage row - side by side for compact display */}
                {(amountCol || stageCol) && (
                  <div className="flex items-center justify-between gap-2 mb-1">
                    {amountCol && (
                      <span className="text-sm tabular-nums font-medium">
                        {typeof row[amountCol.accessorKey] === 'number'
                          ? formatCompactCurrency(row[amountCol.accessorKey])
                          : row[amountCol.accessorKey] ?? '—'}
                      </span>
                    )}
                    {stageCol && row[stageCol.accessorKey] && (
                      <Badge
                        variant="outline"
                        className={`text-xs shrink-0 max-w-[140px] truncate ${stageBadgeColor(String(row[stageCol.accessorKey]))}`}
                      >
                        {row[stageCol.accessorKey]}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Date + Percent combined row for density */}
                {(dateCols.length > 0 || percentCols.length > 0) && (
                  <div className="flex items-center justify-between py-0.5 text-xs text-muted-foreground">
                    {dateCols[0] && (
                      <span className="tabular-nums">
                        {row[dateCols[0].accessorKey]
                          ? formatDate(row[dateCols[0].accessorKey], 'short')
                          : '—'}
                      </span>
                    )}
                    {percentCols[0] && row[percentCols[0].accessorKey] != null && (
                      <span className="tabular-nums">
                        {formatPercent(Number(row[percentCols[0].accessorKey]))}
                      </span>
                    )}
                  </div>
                )}

                {/* Additional date fields beyond the first */}
                {dateCols.slice(1).map((col: any) => (
                  <div key={col.accessorKey} className="flex justify-between items-center py-0.5">
                    <span className="text-xs text-muted-foreground">{col.header}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {row[col.accessorKey] ? formatDate(row[col.accessorKey], 'short') : '—'}
                    </span>
                  </div>
                ))}

                {/* Other fields - hide empty values on mobile */}
                {otherCols.map((col: any) => {
                  const val = row[col.accessorKey];
                  if (val == null || val === '') return null;
                  return (
                    <div key={col.accessorKey} className="flex justify-between items-center py-0.5">
                      <span className="text-xs text-muted-foreground">{col.header}</span>
                      <span className="text-xs font-medium truncate ml-2 text-right">
                        {col.cell ? col.cell(val, row) : String(val)}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        {navigation.isOverlay && (
          <NavigationOverlay {...navigation} title={detailTitle}>
            {(record) => (
              <div className="space-y-3">
                {Object.entries(record).map(([key, value]) => (
                  <div key={key} className="flex flex-col">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm">{String(value ?? '—')}</span>
                  </div>
                ))}
              </div>
            )}
          </NavigationOverlay>
        )}
      </>
    );
  }

  // Row height cycle handler (plain function, not hook — after early returns)
  const cycleRowHeight = () => {
    setRowHeightMode(prev => {
      if (prev === 'compact') return 'short';
      if (prev === 'short') return 'medium';
      if (prev === 'medium') return 'tall';
      if (prev === 'tall') return 'extra_tall';
      return 'compact';
    });
  };

  const rowHeightIcons = { compact: Rows4, short: Rows3, medium: Rows2, tall: AlignJustify, extra_tall: AlignJustify };
  const RowHeightIcon = rowHeightIcons[rowHeightMode];

  // Grid toolbar (row height toggle + export)
  const showRowHeightToggle = schema.rowHeight !== undefined;
  const hasToolbar = schema.exportOptions || showRowHeightToggle;
  const gridToolbar = hasToolbar ? (
    <div className="flex items-center justify-end gap-1 px-2 py-1">
      {/* Row height toggle */}
      {showRowHeightToggle && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-muted-foreground hover:text-primary text-xs"
          onClick={cycleRowHeight}
          title={`Row height: ${rowHeightMode}`}
        >
          <RowHeightIcon className="h-3.5 w-3.5 mr-1.5" />
          <span className="hidden sm:inline capitalize">{rowHeightMode}</span>
        </Button>
      )}

      {/* Export */}
      {schema.exportOptions && (
        <Popover open={showExport} onOpenChange={setShowExport}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-primary text-xs"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48 p-2">
            <div className="space-y-1">
              {(schema.exportOptions.formats || ['csv', 'json']).map(format => (
                <Button
                  key={format}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-8 text-xs"
                  onClick={() => handleExport(format)}
                >
                  <Download className="h-3.5 w-3.5 mr-2" />
                  Export as {format.toUpperCase()}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  ) : null;

  // Form-based record detail renderer (replaces simple key-value dump)
  const renderRecordDetail = (record: any) => {
    const systemFields = ['_id', 'id', 'created_at', 'updated_at', 'created_by', 'updated_by'];
    const entries = Object.entries(record);
    const regularFields = entries.filter(([key]) => !systemFields.includes(key));
    const metaFields = entries.filter(([key]) => systemFields.includes(key) && key !== '_id' && key !== 'id');

    const formatFieldLabel = (key: string): string =>
      key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');

    const renderFieldValue = (key: string, value: any): React.ReactNode => {
      if (value == null || value === '') {
        return <span className="text-muted-foreground/50 text-sm italic">Empty</span>;
      }

      // Use objectSchema field type for type-aware rendering
      const fieldDef = objectSchema?.fields?.[key];
      if (fieldDef?.type) {
        const CellRenderer = getCellRenderer(fieldDef.type);
        if (CellRenderer) {
          return <CellRenderer value={value} field={fieldDef} />;
        }
      }

      // Fallback: infer from value and key name
      if (typeof value === 'boolean') {
        return <Badge variant={value ? 'default' : 'outline'}>{value ? 'Yes' : 'No'}</Badge>;
      }
      // Detect date-like values
      if (typeof value === 'string' && !isNaN(Date.parse(value)) && (key.includes('date') || key.includes('_at') || key.includes('time'))) {
        return <span className="text-sm tabular-nums">{formatDate(value)}</span>;
      }
      // Detect currency-like fields by name
      const currencyFields = ['amount', 'price', 'total', 'revenue', 'cost', 'value', 'budget', 'salary'];
      if (typeof value === 'number' && currencyFields.some(f => key.toLowerCase().includes(f))) {
        return <span className="text-sm tabular-nums font-medium">{formatCurrency(value)}</span>;
      }
      return <span className="text-sm break-words">{String(value)}</span>;
    };

    return (
      <div className="space-y-4" data-testid="record-detail-panel">
        {/* Regular fields in form-like layout */}
        <div className="rounded-lg border bg-card">
          <div className="divide-y">
            {regularFields.map(([key, value]) => (
              <div key={key} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 px-4 py-3">
                <span className="text-xs font-medium text-muted-foreground sm:w-1/3 sm:text-right sm:pt-0.5 uppercase tracking-wide shrink-0">
                  {formatFieldLabel(key)}
                </span>
                <div className="flex-1 min-w-0">
                  {renderFieldValue(key, value)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System/meta fields */}
        {metaFields.length > 0 && (
          <div className="rounded-lg border bg-muted/30">
            <div className="px-4 py-2 border-b">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">System</span>
            </div>
            <div className="divide-y divide-border/50">
              {metaFields.map(([key, value]) => (
                <div key={key} className="flex items-center gap-4 px-4 py-2">
                  <span className="text-xs text-muted-foreground w-1/3 text-right shrink-0">
                    {formatFieldLabel(key)}
                  </span>
                  <span className="text-xs text-muted-foreground flex-1 min-w-0 break-words">{String(value ?? '')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Summary footer row
  const summaryFooter = hasSummary ? (
    <div className="border-t bg-muted/30 px-2 py-1.5" data-testid="column-summary-footer">
      <div className="flex gap-4 text-xs text-muted-foreground font-medium">
        {orderedColumns
          .filter((col: any) => summaries.has(col.accessorKey))
          .map((col: any) => {
            const summary = summaries.get(col.accessorKey)!;
            return (
              <span key={col.accessorKey} data-testid={`summary-${col.accessorKey}`}>
                {col.header}: {summary.label}
              </span>
            );
          })}
      </div>
    </div>
  ) : null;

  // Bulk actions — support both batchActions (ObjectUI) and bulkActions (spec) names
  const effectiveBulkActions = schema.batchActions ?? (schema as any).bulkActions;

  // Render grid content: grouped (multiple tables with headers) or flat (single table)
  const gridContent = isGrouped ? (
    <div className="space-y-2">
      {groups.map((group) => (
        <GroupRow
          key={group.key}
          groupKey={group.key}
          label={group.label}
          count={group.rows.length}
          collapsed={group.collapsed}
          aggregations={group.aggregations}
          onToggle={toggleGroup}
        >
          <SchemaRenderer schema={buildGroupTableSchema(group.rows)} />
        </GroupRow>
      ))}
    </div>
  ) : (
    <>
      <SchemaRenderer schema={dataTableSchema} />
      {summaryFooter}
    </>
  );

  // For split mode, wrap the grid in the ResizablePanelGroup
  if (navigation.isOverlay && navigation.mode === 'split') {
    return (
      <NavigationOverlay
        {...navigation}
        title={detailTitle}
        mainContent={
          <>
            {gridToolbar}
            {gridContent}
            <BulkActionBar
              selectedRows={selectedRows}
              actions={effectiveBulkActions ?? []}
              onAction={(action, rows) => executeAction({ type: action, params: { records: rows } })}
              onClearSelection={() => setSelectedRows([])}
            />
          </>
        }
      >
        {(record) => renderRecordDetail(record)}
      </NavigationOverlay>
    );
  }

  return (
    <div ref={pullRef} className="relative h-full">
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center text-xs text-muted-foreground"
          style={{ height: pullDistance }}
        >
          {isRefreshing ? 'Refreshing…' : 'Pull to refresh'}
        </div>
      )}
      {gridToolbar}
      {gridContent}
      <BulkActionBar
        selectedRows={selectedRows}
        actions={effectiveBulkActions ?? []}
        onAction={(action, rows) => executeAction({ type: action, params: { records: rows } })}
        onClearSelection={() => setSelectedRows([])}
      />
      {navigation.isOverlay && (
        <NavigationOverlay
          {...navigation}
          title={detailTitle}
        >
          {(record) => renderRecordDetail(record)}
        </NavigationOverlay>
      )}
    </div>
  );
};
