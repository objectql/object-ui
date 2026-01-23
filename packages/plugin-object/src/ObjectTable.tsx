/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ObjectTable Component
 * 
 * A specialized table component that automatically fetches and displays data from ObjectQL objects.
 * It integrates with ObjectQL's schema system to generate columns and handle CRUD operations.
 */

import React, { useEffect, useState, useCallback } from 'react';
import type { ObjectTableSchema, TableColumn, TableSchema, DataSource } from '@object-ui/types';
import { SchemaRenderer } from '@object-ui/react';

export interface ObjectTableProps {
  /**
   * The schema configuration for the table
   */
  schema: ObjectTableSchema;
  
  /**
   * Data source (ObjectQL or ObjectStack adapter)
   * Optional when inline data is provided in schema
   */
  dataSource?: DataSource;
  
  /**
   * Additional CSS class
   */
  className?: string;
  
  /**
   * Callback when a row is clicked
   */
  onRowClick?: (record: any) => void;
  
  /**
   * Callback when a row is edited
   */
  onEdit?: (record: any) => void;
  
  /**
   * Callback when a row is deleted
   */
  onDelete?: (record: any) => void;
  
  /**
   * Callback when records are bulk deleted
   */
  onBulkDelete?: (records: any[]) => void;
}

/**
 * ObjectTable Component
 * 
 * Renders a table for an ObjectQL object with automatic schema integration.
 * 
 * @example
 * ```tsx
 * <ObjectTable
 *   schema={{
 *     type: 'object-table',
 *     objectName: 'users',
 *     fields: ['name', 'email', 'status'],
 *     operations: { create: true, update: true, delete: true }
 *   }}
 *   dataSource={dataSource}
 *   onEdit={(record) => console.log('Edit', record)}
 *   onDelete={(record) => console.log('Delete', record)}
 * />
 * ```
 */
export const ObjectTable: React.FC<ObjectTableProps> = ({
  schema,
  dataSource,
  onRowClick,
  onEdit,
  onDelete,
  onBulkDelete,
}) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [objectSchema, setObjectSchema] = useState<any>(null);
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);

  // Check if using inline data
  const hasInlineData = Boolean(schema.data);

  // Initialize with inline data if provided
  useEffect(() => {
    if (hasInlineData && schema.data) {
      setData(schema.data);
      setLoading(false);
    }
  }, [hasInlineData, schema.data]);

  // Fetch object schema from ObjectQL/ObjectStack (skip if using inline data)
  useEffect(() => {
    const fetchObjectSchema = async () => {
      try {
        if (!dataSource) {
          throw new Error('DataSource is required when using ObjectQL schema fetching (inline data not provided)');
        }
        const schemaData = await dataSource.getObjectSchema(schema.objectName);
        setObjectSchema(schemaData);
      } catch (err) {
        console.error('Failed to fetch object schema:', err);
        setError(err as Error);
      }
    };

    // Skip fetching schema if we have inline data and custom columns
    if (hasInlineData && schema.columns) {
      // Use a minimal schema for inline data with type safety
      setObjectSchema({
        name: schema.objectName,
        fields: {} as Record<string, any>,
      });
    } else if (schema.objectName && !hasInlineData && dataSource) {
      fetchObjectSchema();
    }
  }, [schema.objectName, schema.columns, dataSource, hasInlineData]);

  // Generate columns from object schema or inline data
  useEffect(() => {
    // For inline data with custom columns, use the custom columns directly
    if (hasInlineData && schema.columns) {
      setColumns(schema.columns);
      return;
    }

    // For inline data without custom columns, auto-generate from first data row
    if (hasInlineData && schema.data && schema.data.length > 0) {
      const generatedColumns: TableColumn[] = [];
      const firstRow = schema.data[0];
      const fieldsToShow = schema.fields || Object.keys(firstRow);
      
      fieldsToShow.forEach((fieldName) => {
        generatedColumns.push({
          header: fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/_/g, ' '),
          accessorKey: fieldName,
        });
      });
      
      setColumns(generatedColumns);
      return;
    }

    if (!objectSchema) return;

    const generatedColumns: TableColumn[] = [];
    
    // Use specified fields or all visible fields from schema
    const fieldsToShow = schema.fields || Object.keys(objectSchema.fields || {});
    
    fieldsToShow.forEach((fieldName) => {
      const field = objectSchema.fields?.[fieldName];
      if (!field) return;

      // Check field-level permissions
      const hasReadPermission = !field.permissions || field.permissions.read !== false;
      if (!hasReadPermission) return; // Skip fields without read permission

      // Check if there's a custom column configuration
      const customColumn = schema.columns?.find(col => col.accessorKey === fieldName);
      
      if (customColumn) {
        generatedColumns.push(customColumn);
      } else {
        // Auto-generate column from field schema
        const column: TableColumn = {
          header: field.label || fieldName,
          accessorKey: fieldName,
        };
        
        // Add field type-specific formatting hints
        if (field.type === 'date' || field.type === 'datetime') {
          column.type = 'date';
        } else if (field.type === 'boolean') {
          column.type = 'boolean';
        } else if (field.type === 'number' || field.type === 'currency' || field.type === 'percent') {
          column.type = 'number';
        } else if (field.type === 'image' || field.type === 'file') {
          // For file/image fields, display the name or count
          column.cell = (value: any) => {
            if (!value) return '-';
            if (Array.isArray(value)) {
              const count = value.length;
              const fileType = field.type === 'image' ? 'image' : 'file';
              return count === 1 ? `1 ${fileType}` : `${count} ${fileType}s`;
            }
            return value.name || value.original_name || 'File';
          };
        } else if (field.type === 'lookup' || field.type === 'master_detail') {
          // For relationship fields, display the name property if available
          column.cell = (value: any) => {
            if (!value) return '-';
            if (typeof value === 'object' && value !== null) {
              // Try common display properties first
              if (value.name) return value.name;
              if (value.label) return value.label;
              if (value._id) return value._id;
              // Fallback to object type indicator
              return '[Object]';
            }
            return String(value);
          };
        } else if (field.type === 'url') {
          // For URL fields, make them clickable
          column.cell = (value: any) => {
            if (!value) return '-';
            return value; // The table renderer should handle URL formatting
          };
        }
        
        // Add sorting if field is sortable
        if (field.sortable !== false) {
          column.sortable = true;
        }
        
        generatedColumns.push(column);
      }
    });

    // Add actions column if operations are enabled
    const operations = schema.operations || { read: true, update: true, delete: true };
    if ((operations.update || operations.delete) && (onEdit || onDelete)) {
      generatedColumns.push({
        header: 'Actions',
        accessorKey: '_actions',
        cell: (_value: any, row: any) => {
          return {
            type: 'button-group',
            buttons: [
              ...(operations.update && onEdit ? [{
                label: 'Edit',
                variant: 'ghost' as const,
                size: 'sm' as const,
                onClick: () => handleEdit(row),
              }] : []),
              ...(operations.delete && onDelete ? [{
                label: 'Delete',
                variant: 'ghost' as const,
                size: 'sm' as const,
                onClick: () => handleDelete(row),
              }] : []),
            ],
          };
        },
        sortable: false,
      });
    }

    setColumns(generatedColumns);
  }, [objectSchema, schema.fields, schema.columns, schema.operations, schema.data, hasInlineData, onEdit, onDelete]);

  // Fetch data from ObjectQL (skip if using inline data)
  const fetchData = useCallback(async () => {
    // Don't fetch if using inline data
    if (hasInlineData) return;
    
    if (!schema.objectName) return;
    if (!dataSource) {
      setError(new Error('DataSource is required for remote data fetching (inline data not provided)'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params: any = {
        $select: schema.fields || undefined,
        $top: schema.pageSize || 10,
      };

      // Add default filters if specified
      if (schema.defaultFilters) {
        params.$filter = schema.defaultFilters;
      }

      // Add default sort if specified
      if (schema.defaultSort) {
        params.$orderby = `${schema.defaultSort.field} ${schema.defaultSort.order}`;
      }

      const result = await dataSource.find(schema.objectName, params);
      setData(result.data || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [schema, dataSource, hasInlineData]);

  useEffect(() => {
    if (columns.length > 0) {
      fetchData();
    }
  }, [columns, fetchData]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Handle edit action
  const handleEdit = useCallback((record: any) => {
    if (onEdit) {
      onEdit(record);
    }
  }, [onEdit]);

  // Handle delete action with confirmation
  const handleDelete = useCallback(async (record: any) => {
    if (!onDelete) return;

    // Show confirmation dialog
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        `Are you sure you want to delete this ${schema.objectName}?`
      );
      if (!confirmed) return;
    }

    try {
      // Optimistic update: remove from UI immediately
      const recordId = record._id || record.id;
      setData(prevData => prevData.filter(item => 
        (item._id || item.id) !== recordId
      ));

      // Call backend delete only if we have a dataSource
      if (!hasInlineData && dataSource) {
        await dataSource.delete(schema.objectName, recordId);
      }

      // Notify parent
      onDelete(record);
    } catch (err) {
      console.error('Failed to delete record:', err);
      // Revert optimistic update on error
      if (!hasInlineData) {
        await fetchData();
      }
      alert('Failed to delete record. Please try again.');
    }
  }, [schema.objectName, dataSource, hasInlineData, onDelete, fetchData]);

  // Handle bulk delete action
  const handleBulkDelete = useCallback(async (records: any[]) => {
    if (!onBulkDelete || records.length === 0) return;

    // Show confirmation dialog
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        `Are you sure you want to delete ${records.length} ${schema.objectName}(s)?`
      );
      if (!confirmed) return;
    }

    try {
      // Optimistic update: remove from UI immediately
      const recordIds = records.map(r => r._id || r.id);
      setData(prevData => prevData.filter(item => 
        !recordIds.includes(item._id || item.id)
      ));

      // Call backend bulk delete only if we have a dataSource and it supports bulk operations
      if (!hasInlineData && dataSource && dataSource.bulk) {
        await dataSource.bulk(schema.objectName, 'delete', records);
      }

      // Notify parent
      onBulkDelete(records);
      
      // Clear selection
      setSelectedRows([]);
    } catch (err) {
      console.error('Failed to delete records:', err);
      // Revert optimistic update on error
      if (!hasInlineData) {
        await fetchData();
      }
      alert('Failed to delete records. Please try again.');
    }
  }, [schema.objectName, dataSource, hasInlineData, onBulkDelete, fetchData]);

  // Handle row selection
  const handleRowSelect = useCallback((rows: any[]) => {
    setSelectedRows(rows);
  }, []);

  // Render error state
  if (error) {
    return (
      <div className="p-4 border border-red-300 bg-red-50 rounded-md">
        <h3 className="text-red-800 font-semibold">Error loading table</h3>
        <p className="text-red-600 text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  // Render loading state
  if (loading && data.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <p className="mt-2 text-sm text-gray-600">Loading {schema.objectName}...</p>
      </div>
    );
  }

  // Convert to TableSchema
  const tableSchema: TableSchema = {
    type: 'table',
    caption: schema.title,
    columns,
    data,
    className: schema.className,
    selectable: schema.selectable || (onBulkDelete ? 'multiple' : undefined),
    onRowSelect: handleRowSelect,
    onRowClick: onRowClick,
  };

  // Add toolbar with bulk actions if selection is enabled
  const hasToolbar = selectedRows.length > 0 && onBulkDelete;

  return (
    <div className="w-full">
      {hasToolbar && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md flex items-center justify-between">
          <span className="text-sm text-blue-800">
            {selectedRows.length} {schema.objectName}(s) selected
          </span>
          <button
            onClick={() => handleBulkDelete(selectedRows)}
            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
          >
            Delete Selected
          </button>
        </div>
      )}
      <SchemaRenderer schema={tableSchema} onAction={handleRefresh} />
    </div>
  );
};
