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
  autoSize?: boolean;
  resizable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  groupable?: boolean;
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
    icon?: string;
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
