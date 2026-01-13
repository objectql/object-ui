// Enterprise-level DataTable Component (Airtable-like)
import React, { useState, useMemo } from 'react';
import { ComponentRegistry } from '@object-ui/core';
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
} from 'lucide-react';

type SortDirection = 'asc' | 'desc' | null;

interface Column {
  header: string;
  accessorKey: string;
  className?: string;
  cellClassName?: string;
  width?: string | number;
  sortable?: boolean;
  filterable?: boolean;
}

interface DataTableSchema {
  caption?: string;
  columns: Column[];
  data: any[];
  pagination?: boolean;
  pageSize?: number;
  searchable?: boolean;
  selectable?: boolean;
  sortable?: boolean;
  exportable?: boolean;
  rowActions?: boolean;
  onRowEdit?: (row: any) => void;
  onRowDelete?: (row: any) => void;
  onSelectionChange?: (selectedRows: any[]) => void;
  className?: string;
}

const DataTableRenderer = ({ schema }: { schema: DataTableSchema }) => {
  const {
    caption,
    columns = [],
    data = [],
    pagination = true,
    pageSize: initialPageSize = 10,
    searchable = true,
    selectable = false,
    sortable = true,
    exportable = false,
    rowActions = false,
    className,
  } = schema;

  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<any>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

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

  // Generate unique row ID
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
              {columns.map((col, index) => (
                <TableHead
                  key={index}
                  className={`${col.className || ''} ${sortable && col.sortable !== false ? 'cursor-pointer select-none' : ''}`}
                  style={{ width: col.width }}
                  onClick={() => sortable && col.sortable !== false && handleSort(col.accessorKey)}
                >
                  <div className="flex items-center">
                    {col.header}
                    {sortable && col.sortable !== false && getSortIcon(col.accessorKey)}
                  </div>
                </TableHead>
              ))}
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
                    {columns.map((col, colIndex) => (
                      <TableCell key={colIndex} className={col.cellClassName}>
                        {row[col.accessorKey]}
                      </TableCell>
                    ))}
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
      description: 'Array of { header, accessorKey, className, width, sortable, filterable }',
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
