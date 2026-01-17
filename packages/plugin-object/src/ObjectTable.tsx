/**
 * ObjectTable Component
 * 
 * A specialized table component that automatically fetches and displays data from ObjectQL objects.
 * It integrates with ObjectQL's schema system to generate columns and handle CRUD operations.
 */

import React, { useEffect, useState, useCallback } from 'react';
import type { ObjectTableSchema, TableColumn, TableSchema } from '@object-ui/types';
import type { ObjectQLDataSource } from '@object-ui/data-objectql';
import { SchemaRenderer } from '@object-ui/react';

export interface ObjectTableProps {
  /**
   * The schema configuration for the table
   */
  schema: ObjectTableSchema;
  
  /**
   * ObjectQL data source
   */
  dataSource: ObjectQLDataSource;
  
  /**
   * Additional CSS class
   */
  className?: string;
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
 *     fields: ['name', 'email', 'status']
 *   }}
 *   dataSource={objectQLDataSource}
 * />
 * ```
 */
export const ObjectTable: React.FC<ObjectTableProps> = ({
  schema,
  dataSource,
}) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [objectSchema, setObjectSchema] = useState<any>(null);
  const [columns, setColumns] = useState<TableColumn[]>([]);

  // Fetch object schema from ObjectQL
  useEffect(() => {
    const fetchObjectSchema = async () => {
      try {
        const schemaData = await dataSource.getObjectSchema(schema.objectName);
        setObjectSchema(schemaData);
      } catch (err) {
        console.error('Failed to fetch object schema:', err);
        setError(err as Error);
      }
    };

    if (schema.objectName && dataSource) {
      fetchObjectSchema();
    }
  }, [schema.objectName, dataSource]);

  // Generate columns from object schema
  useEffect(() => {
    if (!objectSchema) return;

    const generatedColumns: TableColumn[] = [];
    
    // Use specified fields or all visible fields from schema
    const fieldsToShow = schema.fields || Object.keys(objectSchema.fields || {});
    
    fieldsToShow.forEach((fieldName) => {
      const field = objectSchema.fields?.[fieldName];
      if (!field) return;

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
              return `${value.length} ${field.type}(s)`;
            }
            return value.name || value.original_name || 'File';
          };
        } else if (field.type === 'lookup' || field.type === 'master_detail') {
          // For relationship fields, display the name property if available
          column.cell = (value: any) => {
            if (!value) return '-';
            if (typeof value === 'object') {
              return value.name || value.label || value._id || String(value);
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
        
        generatedColumns.push(column);
      }
    });

    setColumns(generatedColumns);
  }, [objectSchema, schema.fields, schema.columns]);

  // Fetch data from ObjectQL
  const fetchData = useCallback(async () => {
    if (!schema.objectName) return;

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
  }, [schema, dataSource]);

  useEffect(() => {
    if (columns.length > 0) {
      fetchData();
    }
  }, [columns, fetchData]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

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
  };

  return (
    <div className="w-full">
      <SchemaRenderer schema={tableSchema} onAction={handleRefresh} />
    </div>
  );
};
