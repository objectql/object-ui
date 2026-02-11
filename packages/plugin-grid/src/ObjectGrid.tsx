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

import React, { useEffect, useState, useCallback } from 'react';
import type { ObjectGridSchema, DataSource, ListColumn, ViewData } from '@object-ui/types';
import { SchemaRenderer, useDataScope, useNavigationOverlay, useAction } from '@object-ui/react';
import { getCellRenderer } from '@object-ui/fields';
import { Button, NavigationOverlay } from '@object-ui/components';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@object-ui/components';
import { Edit, Trash2, MoreVertical, ChevronRight, ChevronDown } from 'lucide-react';
import { useRowColor } from './useRowColor';
import { useGroupedData } from './useGroupedData';

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
  ...rest
}) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [objectSchema, setObjectSchema] = useState<any>(null);

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
  }, [objectName, schemaFields, schemaColumns, schemaFilter, schemaSort, schemaPagination, schemaPageSize, dataSource, hasInlineData, dataConfig]);

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

  // --- Grouping support ---
  const { groups, isGrouped, toggleGroup } = useGroupedData(schema.grouping, data);

  const generateColumns = useCallback(() => {
    // Use normalized columns (support both new and legacy)
    const cols = normalizeColumns(schemaColumns);
    
    if (cols) {
      // Check if columns are already in data-table format (have 'accessorKey')
      // vs ListColumn format (have 'field')
      if (cols.length > 0 && typeof cols[0] === 'object' && cols[0] !== null) {
        const firstCol = cols[0] as any;
        
        // Already in data-table format - use as-is
        if ('accessorKey' in firstCol) {
          return cols;
        }
        
        // ListColumn format - convert to data-table format with full feature support
        if ('field' in firstCol) {
          return (cols as ListColumn[])
            .filter((col) => col?.field && typeof col.field === 'string' && !col.hidden)
            .map((col) => {
              const header = col.label || col.field.charAt(0).toUpperCase() + col.field.slice(1).replace(/_/g, ' ');

              // Build custom cell renderer based on column configuration
              let cellRenderer: ((value: any, row: any) => React.ReactNode) | undefined;

              // Type-based cell renderer (e.g., "currency", "date", "boolean")
              const CellRenderer = col.type ? getCellRenderer(col.type) : null;

              if (col.link && col.action) {
                // Both link and action: link takes priority for navigation, action executes on secondary interaction
                cellRenderer = (value: any, row: any) => {
                  const displayContent = CellRenderer
                    ? <CellRenderer value={value} field={{ name: col.field, type: col.type || 'text' } as any} />
                    : String(value ?? '');
                  return (
                    <button
                      type="button"
                      className="text-primary underline-offset-4 hover:underline cursor-pointer bg-transparent border-none p-0 text-left font-inherit"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigation.handleClick(row);
                      }}
                    >
                      {displayContent}
                    </button>
                  );
                };
              } else if (col.link) {
                // Link column: clicking navigates to the record detail
                cellRenderer = (value: any, row: any) => {
                  const displayContent = CellRenderer
                    ? <CellRenderer value={value} field={{ name: col.field, type: col.type || 'text' } as any} />
                    : String(value ?? '');
                  return (
                    <button
                      type="button"
                      className="text-primary underline-offset-4 hover:underline cursor-pointer bg-transparent border-none p-0 text-left font-inherit"
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
                // Action column: clicking executes the registered action
                cellRenderer = (value: any, row: any) => {
                  const displayContent = CellRenderer
                    ? <CellRenderer value={value} field={{ name: col.field, type: col.type || 'text' } as any} />
                    : String(value ?? '');
                  return (
                    <button
                      type="button"
                      className="text-primary underline-offset-4 hover:underline cursor-pointer bg-transparent border-none p-0 text-left font-inherit"
                      onClick={(e) => {
                        e.stopPropagation();
                        executeAction({
                          type: col.action!,
                          params: { record: row, field: col.field, value },
                        });
                      }}
                    >
                      {displayContent}
                    </button>
                  );
                };
              } else if (CellRenderer) {
                // Type-only cell renderer (no link/action)
                cellRenderer = (value: any) => (
                  <CellRenderer value={value} field={{ name: col.field, type: col.type || 'text' } as any} />
                );
              }

              return {
                header,
                accessorKey: col.field,
                ...(col.width && { width: col.width }),
                ...(col.align && { align: col.align }),
                sortable: col.sortable !== false,
                ...(col.resizable !== undefined && { resizable: col.resizable }),
                ...(col.wrap !== undefined && { wrap: col.wrap }),
                ...(cellRenderer && { cell: cellRenderer }),
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
      generatedColumns.push({
        header: field.label || fieldName,
        accessorKey: fieldName,
        cell: (value: any) => <CellRenderer value={value} field={field} />,
        sortable: field.sortable !== false,
      });
    });

    return generatedColumns;
  }, [objectSchema, schemaFields, schemaColumns, dataConfig, hasInlineData, navigation.handleClick, executeAction]);

  if (error) {
    return (
      <div className="p-4 border border-red-300 bg-red-50 rounded-md">
        <h3 className="text-red-800 font-semibold">Error loading grid</h3>
        <p className="text-red-600 text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  if (loading && data.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <p className="mt-2 text-sm text-gray-600">Loading grid...</p>
      </div>
    );
  }

  const columns = generateColumns();
  const operations = 'operations' in schema ? schema.operations : undefined;
  const hasActions = operations && (operations.update || operations.delete);

  const columnsWithActions = hasActions ? [
    ...columns,
    {
      header: 'Actions',
      accessorKey: '_actions',
      cell: (_value: any, row: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {operations?.update && onEdit && (
              <DropdownMenuItem onClick={() => onEdit(row)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            {operations?.delete && onDelete && (
              <DropdownMenuItem onClick={() => onDelete(row)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      sortable: false,
    },
  ] : columns;

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
    columns: columnsWithActions,
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
    rowClassName: schema.rowColor ? (_row: any, _idx: number) => getRowClassName(_row) : undefined,
    onSelectionChange: onRowSelect,
    onRowClick: navigation.handleClick,
    onCellChange: onCellChange,
    onRowSave: onRowSave,
    onBatchSave: onBatchSave,
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

  // Render grid content: grouped (multiple tables with headers) or flat (single table)
  const gridContent = isGrouped ? (
    <div className="space-y-2">
      {groups.map((group) => (
        <div key={group.key} className="border rounded-md">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-left bg-muted/50 hover:bg-muted transition-colors"
            onClick={() => toggleGroup(group.key)}
          >
            {group.collapsed
              ? <ChevronRight className="h-4 w-4 shrink-0" />
              : <ChevronDown className="h-4 w-4 shrink-0" />}
            <span>{group.label}</span>
            <span className="ml-auto text-xs text-muted-foreground">{group.rows.length}</span>
          </button>
          {!group.collapsed && (
            <SchemaRenderer schema={buildGroupTableSchema(group.rows)} />
          )}
        </div>
      ))}
    </div>
  ) : (
    <SchemaRenderer schema={dataTableSchema} />
  );

  // For split mode, wrap the grid in the ResizablePanelGroup
  if (navigation.isOverlay && navigation.mode === 'split') {
    return (
      <NavigationOverlay
        {...navigation}
        title={detailTitle}
        mainContent={gridContent}
      >
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
    );
  }

  return (
    <>
      {gridContent}
      {navigation.isOverlay && (
        <NavigationOverlay
          {...navigation}
          title={detailTitle}
        >
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
};
