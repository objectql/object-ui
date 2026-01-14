// Enterprise-level DataTable Component (Airtable-like)
import React, { useState, useMemo, useRef, useEffect } from 'react';
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
} from '@/ui/table';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Checkbox } from '@/ui/checkbox';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select';
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
    columns: initialColumns = [],
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
    className,
  } = schema;

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
  
  // Refs for column resizing
  const resizingColumn = useRef<string | null>(null);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(0);

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

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          {searchable && (
            <div className="relative max-w-sm flex-1">
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
        
        <div className="flex items-center gap-2">
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

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          {caption && <TableCaption>{caption}</TableCaption>}
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-12">
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
                
                return (
                  <TableHead
                    key={col.accessorKey}
                    className={`${col.className || ''} ${sortable && col.sortable !== false ? 'cursor-pointer select-none' : ''} ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'border-l-2 border-primary' : ''} relative group`}
                    style={{ 
                      width: columnWidth,
                      minWidth: columnWidth 
                    }}
                    draggable={reorderableColumns}
                    onDragStart={(e) => handleColumnDragStart(e, index)}
                    onDragOver={(e) => handleColumnDragOver(e, index)}
                    onDrop={(e) => handleColumnDrop(e, index)}
                    onDragEnd={handleColumnDragEnd}
                    onClick={() => sortable && col.sortable !== false && handleSort(col.accessorKey)}
                  >
                    <div className="flex items-center justify-between">
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
                <TableHead className="w-24 text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}
                  className="h-24 text-center text-muted-foreground"
                >
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, rowIndex) => {
                const globalIndex = (currentPage - 1) * pageSize + rowIndex;
                const rowId = getRowId(row, globalIndex);
                const isSelected = selectedRowIds.has(rowId);
                
                return (
                  <TableRow key={rowId} data-state={isSelected ? 'selected' : undefined}>
                    {selectable && (
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleSelectRow(rowId, checked as boolean)}
                        />
                      </TableCell>
                    )}
                    {columns.map((col, colIndex) => {
                      const columnWidth = columnWidths[col.accessorKey] || col.width;
                      return (
                        <TableCell 
                          key={colIndex} 
                          className={col.cellClassName}
                          style={{
                            width: columnWidth,
                            minWidth: columnWidth,
                            maxWidth: columnWidth
                          }}
                        >
                          {row[col.accessorKey]}
                        </TableCell>
                      );
                    })}
                    {rowActions && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
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
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && sortedData.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
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
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages} ({sortedData.length} total)
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
