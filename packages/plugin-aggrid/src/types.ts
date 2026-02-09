/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ColDef, GridOptions, CellClickedEvent, RowClickedEvent, SelectionChangedEvent, CellValueChangedEvent } from 'ag-grid-community';

/**
 * Event callback types
 */
export interface AgGridCallbacks {
  onCellClicked?: (event: CellClickedEvent) => void;
  onRowClicked?: (event: RowClickedEvent) => void;
  onSelectionChanged?: (event: SelectionChangedEvent) => void;
  onCellValueChanged?: (event: CellValueChangedEvent) => void;
  onExport?: (data: any[], format: 'csv' | 'excel') => void;
  onContextMenuAction?: (action: string, rowData: any) => void;
}

/**
 * Export configuration
 */
export interface ExportConfig {
  enabled?: boolean;
  fileName?: string;
  skipColumnHeaders?: boolean;
  allColumns?: boolean;
  onlySelected?: boolean;
  format?: 'csv' | 'excel';
}

/**
 * Tree data configuration
 */
export interface TreeDataConfig {
  enabled?: boolean;
  /** Field that contains the hierarchy path (array of strings) */
  pathField?: string;
  /** Field that contains parent ID for parent-child relationships */
  parentIdField?: string;
  /** Field that contains the unique ID */
  idField?: string;
  /** Whether to expand all rows by default */
  expandAll?: boolean;
  /** Depth to expand to by default */
  expandDepth?: number;
}

/**
 * Row grouping configuration
 */
export interface RowGroupingConfig {
  enabled?: boolean;
  /** Fields to group by */
  groupByFields?: string[];
  /** Whether to show group row count */
  showRowCount?: boolean;
  /** Whether to allow user to change grouping */
  userGroupable?: boolean;
  /** Aggregation functions for grouped columns */
  aggregations?: Record<string, 'sum' | 'avg' | 'count' | 'min' | 'max' | 'first' | 'last'>;
}

/**
 * Excel export configuration
 */
export interface ExcelExportConfig {
  enabled?: boolean;
  fileName?: string;
  sheetName?: string;
  includeHeaders?: boolean;
  includeGrouping?: boolean;
  onlySelected?: boolean;
  /** Custom column widths */
  columnWidths?: Record<string, number>;
}

/**
 * Status bar configuration
 */
export interface StatusBarConfig {
  enabled?: boolean;
  aggregations?: ('sum' | 'avg' | 'count' | 'min' | 'max')[];
}

/**
 * Column configuration enhancements
 */
export interface ColumnConfig {
  resizable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
}

/**
 * Context menu configuration
 */
export interface ContextMenuConfig {
  enabled?: boolean;
  items?: ('copy' | 'copyWithHeaders' | 'paste' | 'separator' | 'export' | 'autoSizeAll' | 'resetColumns' | string)[];
  customItems?: Array<{
    name: string;
    action: string;
    disabled?: boolean;
  }>;
}

/**
 * AG Grid schema for ObjectUI
 */
export interface AgGridSchema {
  type: 'aggrid';
  id?: string;
  className?: string;
  
  // Data
  rowData?: any[];
  
  // Column definitions
  columnDefs?: ColDef[];
  
  // Grid configuration
  gridOptions?: GridOptions;
  
  // Common options
  pagination?: boolean;
  paginationPageSize?: number;
  domLayout?: 'normal' | 'autoHeight' | 'print';
  animateRows?: boolean;
  rowSelection?: 'single' | 'multiple';
  
  // Editing
  editable?: boolean;
  editType?: 'fullRow';
  singleClickEdit?: boolean;
  stopEditingWhenCellsLoseFocus?: boolean;
  
  // Export
  exportConfig?: ExportConfig;
  
  // Status bar
  statusBar?: StatusBarConfig;
  
  // Column features
  columnConfig?: ColumnConfig;
  enableRangeSelection?: boolean;
  enableCharts?: boolean;
  
  // Context menu
  contextMenu?: ContextMenuConfig;
  
  // Tree data
  treeData?: TreeDataConfig;
  
  // Row grouping
  rowGrouping?: RowGroupingConfig;
  
  // Excel export
  excelExport?: ExcelExportConfig;
  
  // Event callbacks
  callbacks?: AgGridCallbacks;
  
  // Styling
  theme?: 'alpine' | 'balham' | 'material' | 'quartz';
  height?: number | string;
}

/**
 * Column definition with simplified schema
 */
export interface SimpleColumnDef {
  field: string;
  headerName?: string;
  width?: number;
  sortable?: boolean;
  filter?: boolean | 'text' | 'number' | 'date';
  editable?: boolean;
  cellRenderer?: string;
  valueFormatter?: (params: any) => string;
}
