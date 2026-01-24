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
 * A specialized table component built on top of data-table.
 * Auto-generates columns from ObjectQL schema with type-aware rendering.
 * Supports traditional table mode and grid mode (with editable: true).
 */

import React, { useEffect, useState, useCallback } from 'react';
import type { ObjectTableSchema, DataSource } from '@object-ui/types';
import { SchemaRenderer } from '@object-ui/react';
import { getCellRenderer } from './field-renderers';

export interface ObjectTableProps {
  schema: ObjectTableSchema;
  dataSource?: DataSource;
  className?: string;
  onRowClick?: (record: any) => void;
  onEdit?: (record: any) => void;
  onDelete?: (record: any) => void;
  onBulkDelete?: (records: any[]) => void;
  onCellChange?: (rowIndex: number, columnKey: string, newValue: any) => void;
  onRowSelect?: (selectedRows: any[]) => void;
}

export const ObjectTable: React.FC<ObjectTableProps> = ({
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

  const hasInlineData = Boolean(schema.data);

  useEffect(() => {
    if (hasInlineData && schema.data) {
      setData(schema.data);
      setLoading(false);
    }
  }, [hasInlineData, schema.data]);

  useEffect(() => {
    const fetchObjectSchema = async () => {
      try {
        if (!dataSource) {
          throw new Error('DataSource required');
        }
        const schemaData = await dataSource.getObjectSchema(schema.objectName);
        setObjectSchema(schemaData);
      } catch (err) {
        setError(err as Error);
      }
    };

    if (hasInlineData && schema.columns) {
      setObjectSchema({ name: schema.objectName, fields: {} });
    } else if (schema.objectName && !hasInlineData && dataSource) {
      fetchObjectSchema();
    }
  }, [schema.objectName, schema.columns, dataSource, hasInlineData]);

  const generateColumns = useCallback(() => {
    if (schema.columns) return schema.columns;

    if (hasInlineData && schema.data && schema.data.length > 0) {
      const fieldsToShow = schema.fields || Object.keys(schema.data[0]);
      return fieldsToShow.map((fieldName) => ({
        header: fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/_/g, ' '),
        accessorKey: fieldName,
      }));
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
  }, [objectSchema, schema.fields, schema.columns, schema.data, hasInlineData]);

  const fetchData = useCallback(async () => {
    if (hasInlineData || !dataSource) return;

    setLoading(true);
    try {
      const params: any = {
        $select: schema.fields,
        $top: schema.pageSize || 50,
      };

      if ('defaultFilters' in schema && schema.defaultFilters) {
        params.$filter = schema.defaultFilters;
      }

      if ('defaultSort' in schema && schema.defaultSort) {
        params.$orderby = `${schema.defaultSort.field} ${schema.defaultSort.order}`;
      }

      const result = await dataSource.find(schema.objectName, params);
      setData(result.data || []);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [schema, dataSource, hasInlineData]);

  useEffect(() => {
    if (objectSchema || hasInlineData) {
      fetchData();
    }
  }, [objectSchema, hasInlineData, fetchData]);

  if (error) {
    return (
      <div className="p-4 border border-red-300 bg-red-50 rounded-md">
        <h3 className="text-red-800 font-semibold">Error loading table</h3>
        <p className="text-red-600 text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  if (loading && data.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <p className="mt-2 text-sm text-gray-600">Loading {schema.objectName}...</p>
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
        <div className="flex gap-2">
          {operations?.update && onEdit && (
            <button onClick={() => onEdit(row)} className="text-blue-600 hover:text-blue-800 text-sm">
              Edit
            </button>
          )}
          {operations?.delete && onDelete && (
            <button onClick={() => onDelete(row)} className="text-red-600 hover:text-red-800 text-sm">
              Delete
            </button>
          )}
        </div>
      ),
      sortable: false,
    },
  ] : columns;

  const dataTableSchema: any = {
    type: 'data-table',
    caption: schema.title,
    columns: columnsWithActions,
    data,
    pagination: 'showPagination' in schema ? schema.showPagination : true,
    pageSize: schema.pageSize || 10,
    searchable: 'showSearch' in schema ? schema.showSearch : true,
    selectable: schema.selectable,
    sortable: true,
    exportable: operations?.export,
    rowActions: hasActions,
    resizableColumns: schema.resizableColumns !== undefined ? schema.resizableColumns : true,
    className: schema.className,
    onSelectionChange: onRowSelect,
  };

  return <SchemaRenderer schema={dataTableSchema} />;
};
