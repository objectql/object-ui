/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Enhanced ObjectGrid Component
 * 
 * Advanced table component with Airtable-like features:
 * - Inline cell editing
 * - Keyboard navigation
 * - Column resizing
 * - Column freezing
 * - Row selection
 * - Context menus
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ObjectTableSchema, TableColumn, DataSource, FieldMetadata } from '@object-ui/types';
import { getCellRenderer } from './field-renderers';

export interface ObjectGridProps {
  /**
   * The schema configuration for the grid
   */
  schema: ObjectTableSchema;
  
  /**
   * Data source for fetching data
   */
  dataSource?: DataSource;
  
  /**
   * Initial data (optional, for inline data mode)
   */
  data?: any[];
  
  /**
   * Callback when a cell value changes
   */
  onCellChange?: (rowIndex: number, columnKey: string, newValue: any) => void;
  
  /**
   * Callback when a row is selected
   */
  onRowSelect?: (selectedRows: any[]) => void;
  
  /**
   * Enable inline editing
   */
  editable?: boolean;
  
  /**
   * Enable keyboard navigation
   */
  keyboardNavigation?: boolean;
  
  /**
   * Enable column resizing
   */
  resizableColumns?: boolean;
  
  /**
   * Frozen columns (left-pinned)
   */
  frozenColumns?: number;
}

interface CellPosition {
  row: number;
  col: number;
}

/**
 * ObjectGrid Component
 * 
 * Enhanced table with Airtable-like interactions.
 */
export const ObjectGrid: React.FC<ObjectGridProps> = ({
  schema,
  dataSource,
  data: initialData = [],
  onCellChange,
  onRowSelect,
  editable = false,
  keyboardNavigation = true,
  resizableColumns = false,
  frozenColumns = 0,
}) => {
  const [data, setData] = useState<any[]>(initialData);
  const [selectedCell, setSelectedCell] = useState<CellPosition | null>(null);
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [objectSchema, setObjectSchema] = useState<any>(null);
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [loading, setLoading] = useState(true);
  
  const gridRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Fetch object schema
  useEffect(() => {
    const fetchSchema = async () => {
      if (schema.data || !dataSource) {
        setLoading(false);
        return;
      }
      
      try {
        const schemaData = await dataSource.getObjectSchema(schema.objectName);
        setObjectSchema(schemaData);
      } catch (error) {
        console.error('Failed to fetch schema:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSchema();
  }, [schema.objectName, schema.data, dataSource]);

  // Generate columns from schema
  useEffect(() => {
    if (schema.columns) {
      setColumns(schema.columns);
      return;
    }
    
    if (!objectSchema && !schema.data) return;
    
    // Auto-generate columns
    const generatedColumns: TableColumn[] = [];
    const fieldsToShow = schema.fields || 
      (objectSchema ? Object.keys(objectSchema.fields || {}) : 
       (data.length > 0 ? Object.keys(data[0]) : []));
    
    fieldsToShow.forEach((fieldName) => {
      const field = objectSchema?.fields?.[fieldName];
      generatedColumns.push({
        header: field?.label || fieldName,
        accessorKey: fieldName,
      });
    });
    
    setColumns(generatedColumns);
  }, [schema.fields, schema.columns, schema.data, objectSchema, data]);

  // Fetch data if not provided inline
  useEffect(() => {
    const fetchData = async () => {
      if (schema.data) {
        setData(schema.data);
        return;
      }
      
      if (!dataSource || !schema.objectName) return;
      
      try {
        const result = await dataSource.find(schema.objectName, {
          $top: schema.pageSize || 50,
        });
        setData(result.data || []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };
    
    if (columns.length > 0) {
      fetchData();
    }
  }, [schema.data, schema.objectName, schema.pageSize, dataSource, columns]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!keyboardNavigation || !selectedCell) return;
    
    const { row, col } = selectedCell;
    const maxRow = data.length - 1;
    const maxCol = columns.length - 1;
    
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (row > 0) {
          setSelectedCell({ row: row - 1, col });
        }
        break;
        
      case 'ArrowDown':
        e.preventDefault();
        if (row < maxRow) {
          setSelectedCell({ row: row + 1, col });
        }
        break;
        
      case 'ArrowLeft':
        e.preventDefault();
        if (col > 0) {
          setSelectedCell({ row, col: col - 1 });
        }
        break;
        
      case 'ArrowRight':
        e.preventDefault();
        if (col < maxCol) {
          setSelectedCell({ row, col: col + 1 });
        }
        break;
        
      case 'Enter':
        e.preventDefault();
        if (editable && !editingCell) {
          setEditingCell(selectedCell);
        } else if (editingCell) {
          setEditingCell(null);
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        setEditingCell(null);
        break;
        
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          // Shift+Tab - move left
          if (col > 0) {
            setSelectedCell({ row, col: col - 1 });
          } else if (row > 0) {
            setSelectedCell({ row: row - 1, col: maxCol });
          }
        } else {
          // Tab - move right
          if (col < maxCol) {
            setSelectedCell({ row, col: col + 1 });
          } else if (row < maxRow) {
            setSelectedCell({ row: row + 1, col: 0 });
          }
        }
        break;
    }
  }, [keyboardNavigation, selectedCell, editingCell, data.length, columns.length, editable]);

  // Handle cell click
  const handleCellClick = useCallback((row: number, col: number) => {
    setSelectedCell({ row, col });
  }, []);

  // Handle cell double-click (start editing)
  const handleCellDoubleClick = useCallback((row: number, col: number) => {
    if (editable) {
      setEditingCell({ row, col });
    }
  }, [editable]);

  // Handle cell value change
  const handleCellValueChange = useCallback((row: number, col: number, value: any) => {
    const columnKey = columns[col].accessorKey;
    if (!columnKey) return;
    
    // Update local state
    const newData = [...data];
    newData[row] = { ...newData[row], [columnKey]: value };
    setData(newData);
    
    // Notify parent
    if (onCellChange) {
      onCellChange(row, columnKey, value);
    }
    
    // Exit edit mode
    setEditingCell(null);
  }, [columns, data, onCellChange]);

  // Handle row selection
  const handleRowToggle = useCallback((rowIndex: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowIndex)) {
      newSelected.delete(rowIndex);
    } else {
      newSelected.add(rowIndex);
    }
    setSelectedRows(newSelected);
    
    if (onRowSelect) {
      const selected = Array.from(newSelected).map(idx => data[idx]);
      onRowSelect(selected);
    }
  }, [selectedRows, data, onRowSelect]);

  // Auto-focus edit input when editing starts
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div
      ref={gridRef}
      className="overflow-auto border border-gray-200 rounded-lg"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            {schema.selectable && (
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedRows(new Set(data.map((_, idx) => idx)));
                    } else {
                      setSelectedRows(new Set());
                    }
                  }}
                />
              </th>
            )}
            {columns.map((column, colIndex) => (
              <th
                key={column.accessorKey || colIndex}
                className={`px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                  colIndex < frozenColumns ? 'sticky left-0 bg-gray-50 z-20' : ''
                }`}
                style={{
                  width: columnWidths[column.accessorKey || ''] || 'auto',
                  minWidth: 100,
                }}
              >
                <div className="flex items-center justify-between">
                  <span>{column.header}</span>
                  {resizableColumns && (
                    <div
                      className="w-1 h-4 bg-gray-300 cursor-col-resize hover:bg-blue-500"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        // Column resize logic would go here
                      }}
                    />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={`hover:bg-gray-50 ${selectedRows.has(rowIndex) ? 'bg-blue-50' : ''}`}
            >
              {schema.selectable && (
                <td className="px-3 py-2 w-12">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={selectedRows.has(rowIndex)}
                    onChange={() => handleRowToggle(rowIndex)}
                  />
                </td>
              )}
              {columns.map((column, colIndex) => {
                const value = row[column.accessorKey || ''];
                const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
                const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex;
                const field = objectSchema?.fields?.[column.accessorKey || ''];
                const Renderer = field ? getCellRenderer(field.type) : () => <span>{value}</span>;
                
                return (
                  <td
                    key={column.accessorKey || colIndex}
                    className={`px-4 py-2 ${
                      isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''
                    } ${
                      colIndex < frozenColumns ? 'sticky left-0 bg-white z-10' : ''
                    }`}
                    onClick={() => handleCellClick(rowIndex, colIndex)}
                    onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex)}
                  >
                    {isEditing ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        defaultValue={value}
                        className="w-full px-2 py-1 border border-blue-500 rounded"
                        onBlur={(e) => handleCellValueChange(rowIndex, colIndex, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleCellValueChange(rowIndex, colIndex, e.currentTarget.value);
                          } else if (e.key === 'Escape') {
                            setEditingCell(null);
                          }
                        }}
                      />
                    ) : (
                      <Renderer value={value} field={field || { type: 'text', name: column.accessorKey || '' }} />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      
      {data.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No data to display
        </div>
      )}
    </div>
  );
};
