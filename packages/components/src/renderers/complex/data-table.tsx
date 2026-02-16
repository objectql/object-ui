/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Enterprise-level DataTable Component (Airtable-like)
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { ComponentRegistry } from '@object-ui/core';
import type { DataTableSchema } from '@object-ui/types';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableFooter, 
  TableHead, 
  TableRow, 
  TableCell, 
  TableCaption 
} from '../../ui/table';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Checkbox } from '../../ui/checkbox';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { 
  ChevronUp, 
  ChevronDown, 
  ChevronsUpDown,
  Search,
  Download,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  GripVertical,
  Save,
  X,
} from 'lucide-react';

type SortDirection = 'asc' | 'desc' | null;

/**
 * Enterprise-level data table component with Airtable-like features.
 * 
 * Provides comprehensive table functionality including:
 * - Multi-column sorting (ascending/descending/none)
 * - Real-time search across all columns
 * - Pagination with configurable page sizes
 * - Row selection with persistence across pages
 * - CSV export of filtered/sorted data
 * - Row action buttons (edit/delete)
 * 
 * @example
 * ```json
 * {
 *   "type": "data-table",
 *   "pagination": true,
 *   "searchable": true,
 *   "selectable": true,
 *   "sortable": true,
 *   "exportable": true,
 *   "rowActions": true,
 *   "columns": [
 *     { "header": "ID", "accessorKey": "id", "width": "80px" },
 *     { "header": "Name", "accessorKey": "name" }
 *   ],
 *   "data": [
 *     { "id": 1, "name": "John Doe" }
 *   ]
 * }
 * ```
 * 
 * @param {Object} props - Component props
 * @param {DataTableSchema} props.schema - Table schema configuration
 * @returns {JSX.Element} Rendered data table component
 */
const DataTableRenderer = ({ schema }: { schema: DataTableSchema }) => {
  const {
    caption,
    columns: rawColumns = [],
    data = [],
    pagination = true,
    pageSize: initialPageSize = 10,
    searchable = true,
    selectable = false,
    sortable = true,
    exportable = false,
    rowActions = false,
    resizableColumns = true,
    reorderableColumns = true,
    editable = false,
    rowClassName,
    className,
    frozenColumns = 0,
  } = schema;

  // Normalize columns to support legacy keys (label/name) from existing JSONs
  const initialColumns = useMemo(() => {
    return rawColumns.map((col: any) => ({
      ...col,
      header: col.header || col.label,
      accessorKey: col.accessorKey || col.name
    }));
  }, [rawColumns]);

  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<any>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [columns, setColumns] = useState(initialColumns);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [draggedColumn, setDraggedColumn] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnKey: string } | null>(null);
  const [editValue, setEditValue] = useState<any>('');
  // Track pending changes for multi-cell editing: rowIndex -> { columnKey -> newValue }
  const [pendingChanges, setPendingChanges] = useState<Map<number, Record<string, any>>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  
  // Refs for column resizing
  const resizingColumn = useRef<string | null>(null);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(0);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Update columns when schema changes
  useEffect(() => {
    setColumns(initialColumns);
  }, [initialColumns]);

  // Filtering
  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    
    return data.filter((row) =>
      columns.some((col) => {
        const value = row[col.accessorKey];
        return value?.toString().toLowerCase().includes(searchQuery.toLowerCase());
      })
    );
  }, [data, searchQuery, columns]);

  // Sorting
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];
      
      if (aValue === bValue) return 0;
      
      const comparison = aValue < bValue ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = pagination
    ? sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : sortedData;

  /**
   * Generates a unique identifier for each row to maintain stable selection state
   * across pagination and sorting operations.
   * 
   * @param {any} row - The data row object
   * @param {number} index - The row's index in the dataset
   * @returns {string | number} Unique row identifier (uses 'id' field if available, falls back to index)
   */
  const getRowId = (row: any, index: number) => {
    // Try to use 'id' field, fall back to index
    return row.id !== undefined ? row.id : `row-${index}`;
  };

  // Handlers
  const handleSort = (columnKey: string) => {
    if (!sortable) return;
    
    if (sortColumn === columnKey) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortColumn(null);
      }
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    const newSelected = new Set<any>();
    if (checked) {
      paginatedData.forEach((row, idx) => {
        const globalIndex = (currentPage - 1) * pageSize + idx;
        const rowId = getRowId(row, globalIndex);
        newSelected.add(rowId);
      });
    }
    setSelectedRowIds(newSelected);
    
    // Call callback if provided
    if (schema.onSelectionChange) {
      const selectedData = sortedData.filter((row, idx) => {
        const rowId = getRowId(row, idx);
        return newSelected.has(rowId);
      });
      schema.onSelectionChange(selectedData);
    }
  };

  const handleSelectRow = (rowId: any, checked: boolean) => {
    const newSelected = new Set(selectedRowIds);
    if (checked) {
      newSelected.add(rowId);
    } else {
      newSelected.delete(rowId);
    }
    setSelectedRowIds(newSelected);
    
    // Call callback if provided
    if (schema.onSelectionChange) {
      const selectedData = sortedData.filter((row, idx) => {
        const id = getRowId(row, idx);
        return newSelected.has(id);
      });
      schema.onSelectionChange(selectedData);
    }
  };

  const handleExport = () => {
    const csvContent = [
      columns.map(col => col.header).join(','),
      ...sortedData.map(row =>
        columns.map(col => JSON.stringify(row[col.accessorKey] || '')).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'table-export.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getSortIcon = (columnKey: string) => {
    if (sortColumn !== columnKey) {
      return <ChevronsUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    if (sortDirection === 'asc') {
      return <ChevronUp className="h-4 w-4 ml-1" />;
    }
    return <ChevronDown className="h-4 w-4 ml-1" />;
  };

  // Column resizing handlers
  const handleResizeStart = (e: React.MouseEvent, columnKey: string) => {
    if (!resizableColumns) return;
    e.preventDefault();
    e.stopPropagation();
    
    resizingColumn.current = columnKey;
    startX.current = e.clientX;
    
    const headerCell = (e.target as HTMLElement).closest('th');
    if (headerCell) {
      startWidth.current = headerCell.offsetWidth;
    }
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizingColumn.current) return;
    
    const diff = e.clientX - startX.current;
    const newWidth = Math.max(50, startWidth.current + diff); // Min width 50px
    
    setColumnWidths(prev => ({
      ...prev,
      [resizingColumn.current!]: newWidth
    }));
  };

  const handleResizeEnd = () => {
    resizingColumn.current = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };

  // Column reordering handlers
  const handleColumnDragStart = (e: React.DragEvent, index: number) => {
    if (!reorderableColumns) return;
    setDraggedColumn(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleColumnDragOver = (e: React.DragEvent, index: number) => {
    if (!reorderableColumns) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(index);
  };

  const handleColumnDrop = (e: React.DragEvent, dropIndex: number) => {
    if (!reorderableColumns || draggedColumn === null) return;
    e.preventDefault();
    
    if (draggedColumn === dropIndex) {
      setDraggedColumn(null);
      setDragOverColumn(null);
      return;
    }

    const newColumns = [...columns];
    const [removed] = newColumns.splice(draggedColumn, 1);
    newColumns.splice(dropIndex, 0, removed);
    
    setColumns(newColumns);
    setDraggedColumn(null);
    setDragOverColumn(null);
    
    // Call callback if provided
    if (schema.onColumnsReorder) {
      schema.onColumnsReorder(newColumns);
    }
  };

  const handleColumnDragEnd = () => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  // Cell editing handlers
  const startEdit = (rowIndex: number, columnKey: string) => {
    if (!editable) return;
    
    const column = columns.find(col => col.accessorKey === columnKey);
    if (column?.editable === false) return;
    
    setEditingCell({ rowIndex, columnKey });
    
    // Check if there's a pending change for this cell, otherwise use current data value
    const rowChanges = pendingChanges.get(rowIndex);
    const currentValue = paginatedData[rowIndex][columnKey];
    const valueToEdit = rowChanges?.[columnKey] ?? currentValue ?? '';
    setEditValue(valueToEdit);
  };

  const saveEdit = (force: boolean = false) => {
    if (!editingCell) return;
    
    // Don't save if we're in cancelled state (unless forced)
    if (!force && editingCell === null) return;
    
    const { rowIndex, columnKey } = editingCell;
    const globalIndex = (currentPage - 1) * pageSize + rowIndex;
    const row = sortedData[globalIndex];
    
    // Update pending changes
    const newPendingChanges = new Map(pendingChanges);
    const rowChanges = newPendingChanges.get(rowIndex) || {};
    rowChanges[columnKey] = editValue;
    newPendingChanges.set(rowIndex, rowChanges);
    setPendingChanges(newPendingChanges);
    
    // Call the legacy onCellChange callback if provided
    if (schema.onCellChange) {
      schema.onCellChange(globalIndex, columnKey, editValue, row);
    }
    
    setEditingCell(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveRow = async (rowIndex: number) => {
    const globalIndex = (currentPage - 1) * pageSize + rowIndex;
    const row = sortedData[globalIndex];
    const rowChanges = pendingChanges.get(rowIndex);
    
    if (!rowChanges || Object.keys(rowChanges).length === 0) return;
    
    setIsSaving(true);
    try {
      if (schema.onRowSave) {
        await schema.onRowSave(globalIndex, rowChanges, row);
      }
      
      // Clear pending changes for this row
      const newPendingChanges = new Map(pendingChanges);
      newPendingChanges.delete(rowIndex);
      setPendingChanges(newPendingChanges);
    } catch (error) {
      console.error('Failed to save row:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const cancelRowChanges = (rowIndex: number) => {
    const newPendingChanges = new Map(pendingChanges);
    newPendingChanges.delete(rowIndex);
    setPendingChanges(newPendingChanges);
  };

  const saveBatch = async () => {
    if (pendingChanges.size === 0) return;
    
    setIsSaving(true);
    try {
      const changesToSave = Array.from(pendingChanges.entries()).map(([rowIndex, changes]) => {
        const globalIndex = (currentPage - 1) * pageSize + rowIndex;
        const row = sortedData[globalIndex];
        return { rowIndex: globalIndex, changes, row };
      });
      
      if (schema.onBatchSave) {
        await schema.onBatchSave(changesToSave);
      }
      
      // Clear all pending changes
      setPendingChanges(new Map());
    } catch (error) {
      console.error('Failed to save batch:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const cancelAllChanges = () => {
    setPendingChanges(new Map());
  };

  const handleCellKeyDown = (e: React.KeyboardEvent, rowIndex: number, columnKey: string) => {
    // Copy cell value with Ctrl+C / Cmd+C
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !editingCell) {
      e.preventDefault();
      const globalIdx = (currentPage - 1) * pageSize + rowIndex;
      const row = sortedData[globalIdx];
      if (row) {
        const value = row[columnKey];
        const text = value != null ? String(value) : '';
        navigator.clipboard.writeText(text).catch(() => {
          // Fallback for environments without clipboard API
        });
      }
      return;
    }

    if (!editable) return;
    
    const column = columns.find(col => col.accessorKey === columnKey);
    if (column?.editable === false) return;
    
    if (e.key === 'Enter' && !editingCell) {
      e.preventDefault();
      startEdit(rowIndex, columnKey);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  // Auto-focus on edit input when entering edit mode
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, []);

  // Check if all rows on current page are selected
  const allPageRowsSelected = paginatedData.length > 0 && paginatedData.every((row, idx) => {
    const globalIndex = (currentPage - 1) * pageSize + idx;
    const rowId = getRowId(row, globalIndex);
    return selectedRowIds.has(rowId);
  });
  
  const somePageRowsSelected = paginatedData.some((row, idx) => {
    const globalIndex = (currentPage - 1) * pageSize + idx;
    const rowId = getRowId(row, globalIndex);
    return selectedRowIds.has(rowId);
  }) && !allPageRowsSelected;

  const hasPendingChanges = pendingChanges.size > 0;
  const showToolbar = searchable || exportable || (selectable && selectedRowIds.size > 0) || hasPendingChanges;

  return (
    <div className={`flex flex-col h-full gap-2 sm:gap-4 ${className || ''}`}>
      {/* Toolbar */}
      {showToolbar && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4 flex-none">
          <div className="flex items-center gap-2 flex-1">
            {searchable && (
              <div className="relative w-full sm:max-w-sm flex-1">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8"
                />
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {hasPendingChanges && (
              <>
                <div className="text-sm text-muted-foreground">
                  {pendingChanges.size} row{pendingChanges.size > 1 ? 's' : ''} modified
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelAllChanges}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel All
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={saveBatch}
                  disabled={isSaving}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save All ({pendingChanges.size})
                </Button>
              </>
            )}
            
            {exportable && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={sortedData.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            )}
            
            {selectable && selectedRowIds.size > 0 && (
              <div className="text-sm text-muted-foreground">
                {selectedRowIds.size} selected
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table - horizontal scroll indicator via inset shadow on mobile */}
      <div className="rounded-md border flex-1 min-h-0 overflow-auto relative bg-background [-webkit-overflow-scrolling:touch] shadow-[inset_-8px_0_8px_-8px_rgba(0,0,0,0.08)]">
        <Table>
          {caption && <TableCaption>{caption}</TableCaption>}
          <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
            <TableRow>
              {selectable && (
                <TableHead className={cn("w-12 bg-background", frozenColumns > 0 && "sticky left-0 z-20")}>
                  <Checkbox
                    checked={allPageRowsSelected ? true : somePageRowsSelected ? 'indeterminate' : false}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
              )}
              {columns.map((col, index) => {
                const columnWidth = columnWidths[col.accessorKey] || col.width;
                const isDragging = draggedColumn === index;
                const isDragOver = dragOverColumn === index;
                const isFrozen = frozenColumns > 0 && index < frozenColumns;
                const frozenOffset = isFrozen
                  ? columns.slice(0, index).reduce((sum, c, i) => {
                      if (i < frozenColumns) {
                        const w = columnWidths[c.accessorKey] || c.width;
                        return sum + (typeof w === 'number' ? w : w ? parseInt(String(w), 10) || 150 : 150);
                      }
                      return sum;
                    }, selectable ? 48 : 0)
                  : undefined;
                
                return (
                  <TableHead
                    key={col.accessorKey}
                    className={cn(
                      col.className,
                      sortable && col.sortable !== false && 'cursor-pointer select-none',
                      isDragging && 'opacity-50',
                      isDragOver && 'border-l-2 border-primary',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      'relative group bg-background',
                      isFrozen && 'sticky z-20',
                      isFrozen && index === frozenColumns - 1 && 'border-r-2 border-border shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]',
                    )}
                    style={{ 
                      width: columnWidth,
                      minWidth: columnWidth,
                      ...(isFrozen && { left: frozenOffset }),
                    }}
                    draggable={reorderableColumns}
                    onDragStart={(e) => handleColumnDragStart(e, index)}
                    onDragOver={(e) => handleColumnDragOver(e, index)}
                    onDrop={(e) => handleColumnDrop(e, index)}
                    onDragEnd={handleColumnDragEnd}
                    onClick={() => sortable && col.sortable !== false && handleSort(col.accessorKey)}
                  >
                    <div className={cn(
                      "flex items-center",
                      col.align === 'right' ? 'justify-end' : 'justify-between'
                    )}>
                      <div className="flex items-center gap-1">
                        {reorderableColumns && (
                          <GripVertical className="h-4 w-4 opacity-0 group-hover:opacity-50 cursor-grab active:cursor-grabbing flex-shrink-0" />
                        )}
                        <span>{col.header}</span>
                        {sortable && col.sortable !== false && getSortIcon(col.accessorKey)}
                      </div>
                      {resizableColumns && col.resizable !== false && (
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary opacity-0 hover:opacity-100 transition-opacity"
                          onMouseDown={(e) => handleResizeStart(e, col.accessorKey)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </div>
                  </TableHead>
                );
              })}
              {rowActions && (
                <TableHead className="w-24 text-right bg-background">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}
                  className="h-96 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Search className="h-8 w-8 text-muted-foreground/50" />
                    <p>No results found</p>
                    <p className="text-xs text-muted-foreground/50">Try adjusting your filters or search query.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {paginatedData.map((row, rowIndex) => {
                  const globalIndex = (currentPage - 1) * pageSize + rowIndex;
                  const rowId = getRowId(row, globalIndex);
                  const isSelected = selectedRowIds.has(rowId);
                  const rowHasChanges = pendingChanges.has(rowIndex);
                  const rowChanges = pendingChanges.get(rowIndex) || {};
                  
                  return (
                    <TableRow 
                      key={rowId} 
                      data-state={isSelected ? 'selected' : undefined}
                      className={cn(
                        schema.onRowClick && "cursor-pointer",
                        rowHasChanges && "bg-amber-50 dark:bg-amber-950/20",
                        rowClassName && rowClassName(row, rowIndex)
                      )}
                      onClick={(e) => {
                        if (schema.onRowClick && !e.defaultPrevented) {
                           // Simple heuristic to avoid triggering on interactive elements if they didn't stop propagation
                           const target = e.target as HTMLElement;
                           if (target.closest('button') || target.closest('[role="checkbox"]') || target.closest('a')) {
                             return;
                           }
                           schema.onRowClick(row);
                        }
                      }}
                    >
                      {selectable && (
                        <TableCell className={cn(frozenColumns > 0 && "sticky left-0 z-10 bg-background")}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectRow(rowId, checked as boolean)}
                          />
                        </TableCell>
                      )}
                      {columns.map((col, colIndex) => {
                        const columnWidth = columnWidths[col.accessorKey] || col.width;
                        const originalValue = row[col.accessorKey];
                        const hasPendingChange = rowChanges[col.accessorKey] !== undefined;
                        const cellValue = hasPendingChange ? rowChanges[col.accessorKey] : originalValue;
                        const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.columnKey === col.accessorKey;
                        const isEditable = editable && col.editable !== false;
                        const isFrozen = frozenColumns > 0 && colIndex < frozenColumns;
                        const frozenOffset = isFrozen
                          ? columns.slice(0, colIndex).reduce((sum, c, i) => {
                              if (i < frozenColumns) {
                                const w = columnWidths[c.accessorKey] || c.width;
                                return sum + (typeof w === 'number' ? w : w ? parseInt(String(w), 10) || 150 : 150);
                              }
                              return sum;
                            }, selectable ? 48 : 0)
                          : undefined;
                        
                        return (
                          <TableCell 
                            key={colIndex} 
                            className={cn(
                              col.cellClassName,
                              col.align === 'right' && 'text-right',
                              col.align === 'center' && 'text-center',
                              isEditable && !isEditing && "cursor-text hover:bg-muted/50",
                              hasPendingChange && "font-semibold text-amber-700 dark:text-amber-400",
                              isFrozen && 'sticky z-10 bg-background',
                              isFrozen && colIndex === frozenColumns - 1 && 'border-r-2 border-border shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]',
                            )}
                            style={{
                              width: columnWidth,
                              minWidth: columnWidth,
                              maxWidth: columnWidth,
                              ...(isFrozen && { left: frozenOffset }),
                            }}
                            onDoubleClick={() => isEditable && startEdit(rowIndex, col.accessorKey)}
                            onKeyDown={(e) => handleCellKeyDown(e, rowIndex, col.accessorKey)}
                            tabIndex={0}
                          >
                            {isEditing ? (
                              <Input
                                ref={editInputRef}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={handleEditKeyDown}
                                className="h-8 px-2 py-1"
                              />
                            ) : typeof col.cell === 'function' ? (
                              col.cell(cellValue, row)
                            ) : (
                              cellValue
                            )}
                          </TableCell>
                        );
                      })}
                      {rowActions && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {rowHasChanges && (schema.onRowSave || schema.onBatchSave) ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => cancelRowChanges(rowIndex)}
                                  disabled={isSaving}
                                  title="Cancel changes"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => saveRow(rowIndex)}
                                  disabled={isSaving}
                                  title="Save row"
                                >
                                  <Save className="h-4 w-4 text-green-600" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => schema.onRowEdit?.(row)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => schema.onRowDelete?.(row)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {/* Filler rows to maintain height consistency */}
                {paginatedData.length > 0 && Array.from({ length: Math.max(0, pageSize - paginatedData.length) }).map((_, i) => (
                  <TableRow key={`empty-${i}`} className="hover:bg-transparent">
                    <TableCell colSpan={columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)} className="h-[52px] p-0" />
                  </TableRow>
                ))}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && sortedData.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-muted-foreground">Rows per page:</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-muted-foreground">
              Page {currentPage} of {totalPages} <span className="hidden sm:inline">({sortedData.length} total)</span>
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Register the component
ComponentRegistry.register('data-table', DataTableRenderer, {
  namespace: 'ui',
  label: 'Data Table',
  icon: 'table',
  inputs: [
    { name: 'caption', type: 'string', label: 'Caption' },
    {
      name: 'columns',
      type: 'array',
      label: 'Columns',
      description: 'Array of { header, accessorKey, className, width, sortable, filterable, resizable }',
      required: true,
    },
    {
      name: 'data',
      type: 'array',
      label: 'Data',
      description: 'Array of data objects',
      required: true,
    },
    { name: 'pagination', type: 'boolean', label: 'Enable Pagination', defaultValue: true },
    { name: 'pageSize', type: 'number', label: 'Page Size', defaultValue: 10 },
    { name: 'searchable', type: 'boolean', label: 'Enable Search', defaultValue: true },
    { name: 'selectable', type: 'boolean', label: 'Enable Row Selection', defaultValue: false },
    { name: 'sortable', type: 'boolean', label: 'Enable Sorting', defaultValue: true },
    { name: 'exportable', type: 'boolean', label: 'Enable Export', defaultValue: false },
    { name: 'rowActions', type: 'boolean', label: 'Show Row Actions', defaultValue: false },
    { name: 'resizableColumns', type: 'boolean', label: 'Enable Column Resizing', defaultValue: true },
    { name: 'reorderableColumns', type: 'boolean', label: 'Enable Column Reordering', defaultValue: true },
    { name: 'className', type: 'string', label: 'CSS Class' },
  ],
  defaultProps: {
    caption: 'Enterprise Data Table',
    pagination: true,
    pageSize: 10,
    searchable: true,
    selectable: true,
    sortable: true,
    exportable: true,
    rowActions: true,
    resizableColumns: true,
    reorderableColumns: true,
    columns: [
      { header: 'ID', accessorKey: 'id', width: '80px' },
      { header: 'Name', accessorKey: 'name' },
      { header: 'Email', accessorKey: 'email' },
      { header: 'Status', accessorKey: 'status' },
      { header: 'Role', accessorKey: 'role' },
    ],
    data: [
      { id: 1, name: 'John Doe', email: 'john@example.com', status: 'Active', role: 'Admin' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'Active', role: 'User' },
      { id: 3, name: 'Bob Johnson', email: 'bob@example.com', status: 'Inactive', role: 'User' },
      { id: 4, name: 'Alice Williams', email: 'alice@example.com', status: 'Active', role: 'Manager' },
      { id: 5, name: 'Charlie Brown', email: 'charlie@example.com', status: 'Active', role: 'User' },
      { id: 6, name: 'Diana Prince', email: 'diana@example.com', status: 'Active', role: 'Admin' },
      { id: 7, name: 'Ethan Hunt', email: 'ethan@example.com', status: 'Inactive', role: 'User' },
      { id: 8, name: 'Fiona Gallagher', email: 'fiona@example.com', status: 'Active', role: 'User' },
      { id: 9, name: 'George Wilson', email: 'george@example.com', status: 'Active', role: 'Manager' },
      { id: 10, name: 'Hannah Montana', email: 'hannah@example.com', status: 'Active', role: 'User' },
      { id: 11, name: 'Ivan Drago', email: 'ivan@example.com', status: 'Inactive', role: 'User' },
      { id: 12, name: 'Julia Roberts', email: 'julia@example.com', status: 'Active', role: 'Admin' },
    ],
  },
});
