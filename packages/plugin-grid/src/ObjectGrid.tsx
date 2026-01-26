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
import { SchemaRenderer } from '@object-ui/react';
import { getCellRenderer } from '@object-ui/fields';
import { Button } from '@object-ui/components';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@object-ui/components';
import { Edit, Trash2, MoreVertical } from 'lucide-react';

export interface ObjectGridProps {
  schema: ObjectGridSchema;
  dataSource?: DataSource;
  className?: string;
  onRowClick?: (record: any) => void;
  onEdit?: (record: any) => void;
  onDelete?: (record: any) => void;
  onBulkDelete?: (records: any[]) => void;
  onCellChange?: (rowIndex: number, columnKey: string, newValue: any) => void;
  onRowSelect?: (selectedRows: any[]) => void;
}

/**
 * Helper to get data configuration from schema
 * Handles both new ViewData format and legacy inline data
 */
function getDataConfig(schema: ObjectGridSchema): ViewData | null {
  // New format: explicit data configuration
  if (schema.data) {
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
}) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [objectSchema, setObjectSchema] = useState<any>(null);

  // Get data configuration (supports both new and legacy formats)
  const dataConfig = getDataConfig(schema);
  const hasInlineData = dataConfig?.provider === 'value';

  useEffect(() => {
    if (hasInlineData && dataConfig?.provider === 'value') {
      setData(dataConfig.items as any[]);
      setLoading(false);
    }
  }, [hasInlineData, dataConfig]);

  useEffect(() => {
    const fetchObjectSchema = async () => {
      try {
        if (!dataSource) {
          throw new Error('DataSource required');
        }
        
        // For object provider, get the object name
        const objectName = dataConfig?.provider === 'object' 
          ? dataConfig.object 
          : schema.objectName;
          
        if (!objectName) {
          throw new Error('Object name required for object provider');
        }
        
        const schemaData = await dataSource.getObjectSchema(objectName);
        setObjectSchema(schemaData);
      } catch (err) {
        setError(err as Error);
      }
    };

    // Normalize columns (support both legacy 'fields' and new 'columns')
    const cols = normalizeColumns(schema.columns) || schema.fields;
    
    if (hasInlineData && cols) {
      setObjectSchema({ name: schema.objectName, fields: {} });
    } else if (schema.objectName && !hasInlineData && dataSource) {
      fetchObjectSchema();
    }
  }, [schema.objectName, schema.columns, schema.fields, dataSource, hasInlineData, dataConfig]);

  const generateColumns = useCallback(() => {
    // Use normalized columns (support both new and legacy)
    const cols = normalizeColumns(schema.columns);
    
    if (cols) {
      // If columns are already ListColumn objects, convert them to data-table format
      if (cols.length > 0 && typeof cols[0] === 'object' && cols[0] !== null) {
        return (cols as ListColumn[])
          .filter((col) => col?.field && typeof col.field === 'string') // Filter out invalid column objects
          .map((col) => ({
            header: col.label || col.field.charAt(0).toUpperCase() + col.field.slice(1).replace(/_/g, ' '),
            accessorKey: col.field,
            ...(col.width && { width: col.width }),
            ...(col.align && { align: col.align }),
            sortable: col.sortable !== false,
          }));
      }
      
      // String array format - filter out invalid entries
      return (cols as string[])
        .filter((fieldName) => typeof fieldName === 'string' && fieldName.trim().length > 0)
        .map((fieldName) => ({
          header: fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/_/g, ' '),
          accessorKey: fieldName,
        }));
    }

    // Legacy support: use 'fields' if columns not provided
    if (hasInlineData) {
      const inlineData = dataConfig?.provider === 'value' ? dataConfig.items as any[] : [];
      if (inlineData.length > 0) {
        const fieldsToShow = schema.fields || Object.keys(inlineData[0]);
        return fieldsToShow.map((fieldName) => ({
          header: fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/_/g, ' '),
          accessorKey: fieldName,
        }));
      }
    }

    if (!objectSchema) return [];

    const generatedColumns: any[] = [];
    const fieldsToShow = schema.fields || Object.keys(objectSchema.fields || {});
    
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
  }, [objectSchema, schema.fields, schema.columns, dataConfig, hasInlineData]);

  const fetchData = useCallback(async () => {
    if (hasInlineData || !dataSource) return;

    setLoading(true);
    try {
      // Get object name from data config or schema
      const objectName = dataConfig?.provider === 'object' 
        ? dataConfig.object 
        : schema.objectName;
        
      if (!objectName) {
        throw new Error('Object name required for data fetching');
      }
      
      // Helper to get select fields
      const getSelectFields = () => {
        if (schema.fields) return schema.fields;
        if (schema.columns && Array.isArray(schema.columns)) {
          return schema.columns.map(c => typeof c === 'string' ? c : c.field);
        }
        return undefined;
      };
      
      const params: any = {
        $select: getSelectFields(),
        $top: schema.pagination?.pageSize || schema.pageSize || 50,
      };

      // Support new filter format
      if (schema.filter && Array.isArray(schema.filter)) {
        params.$filter = schema.filter;
      } else if ('defaultFilters' in schema && schema.defaultFilters) {
        // Legacy support
        params.$filter = schema.defaultFilters;
      }

      // Support new sort format
      if (schema.sort) {
        if (typeof schema.sort === 'string') {
          // Legacy string format
          params.$orderby = schema.sort;
        } else if (Array.isArray(schema.sort)) {
          // New array format
          params.$orderby = schema.sort
            .map(s => `${s.field} ${s.order}`)
            .join(', ');
        }
      } else if ('defaultSort' in schema && schema.defaultSort) {
        // Legacy support
        params.$orderby = `${schema.defaultSort.field} ${schema.defaultSort.order}`;
      }

      const result = await dataSource.find(objectName, params);
      setData(result.data || []);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [schema, dataSource, hasInlineData, dataConfig]);

  useEffect(() => {
    if (objectSchema || hasInlineData) {
      fetchData();
    }
  }, [objectSchema, hasInlineData, fetchData]);

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
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(row)}>
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
    className: schema.className,
    onSelectionChange: onRowSelect,
  };

  return <SchemaRenderer schema={dataTableSchema} />;
};
