/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ColDef } from 'ag-grid-community';
import type { DataSource } from '@object-ui/types';
import type { FieldMetadata } from '@object-ui/types';
import type { AgGridCallbacks, ExportConfig, StatusBarConfig, ColumnConfig, ContextMenuConfig } from './types';

/**
 * Object AgGrid schema for metadata-driven grid
 */
export interface ObjectAgGridSchema {
  type: 'object-aggrid';
  id?: string;
  className?: string;
  
  // Object metadata
  objectName: string;
  dataSource?: DataSource;
  
  // Optional field configuration override
  fields?: FieldMetadata[];
  fieldNames?: string[]; // Show only specific fields
  
  // Query parameters
  filters?: Record<string, any>;
  sort?: Record<string, 'asc' | 'desc'>;
  pageSize?: number;
  
  // Grid configuration (same as aggrid)
  pagination?: boolean;
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
  callbacks?: AgGridCallbacks & {
    onDataLoaded?: (data: any[]) => void;
    onDataError?: (error: Error) => void;
  };
  
  // Styling
  theme?: 'alpine' | 'balham' | 'material' | 'quartz';
  height?: number | string;
}

/**
 * Props for ObjectAgGridImpl component
 */
export interface ObjectAgGridImplProps {
  objectName: string;
  dataSource?: DataSource;
  fields?: FieldMetadata[];
  fieldNames?: string[];
  filters?: Record<string, any>;
  sort?: Record<string, 'asc' | 'desc'>;
  pageSize?: number;
  pagination?: boolean;
  domLayout?: 'normal' | 'autoHeight' | 'print';
  animateRows?: boolean;
  rowSelection?: 'single' | 'multiple';
  theme?: 'alpine' | 'balham' | 'material' | 'quartz';
  height?: number | string;
  className?: string;
  editable?: boolean;
  editType?: 'fullRow';
  singleClickEdit?: boolean;
  stopEditingWhenCellsLoseFocus?: boolean;
  exportConfig?: ExportConfig;
  statusBar?: StatusBarConfig;
  callbacks?: AgGridCallbacks & {
    onDataLoaded?: (data: any[]) => void;
    onDataError?: (error: Error) => void;
  };
  columnConfig?: ColumnConfig;
  enableRangeSelection?: boolean;
  enableCharts?: boolean;
  contextMenu?: ContextMenuConfig;
}

/**
 * Field type to AG Grid column type mapping
 */
export const FIELD_TYPE_TO_AGGRID_TYPE: Record<string, string> = {
  text: 'text',
  textarea: 'text',
  number: 'numericColumn',
  currency: 'numericColumn',
  percent: 'numericColumn',
  boolean: 'text',
  date: 'dateColumn',
  datetime: 'dateColumn',
  time: 'text',
  email: 'text',
  phone: 'text',
  url: 'text',
  select: 'text',
};

/**
 * Field type to AG Grid filter type mapping
 */
export const FIELD_TYPE_TO_FILTER_TYPE: Record<string, string | boolean> = {
  text: 'agTextColumnFilter',
  textarea: 'agTextColumnFilter',
  number: 'agNumberColumnFilter',
  currency: 'agNumberColumnFilter',
  percent: 'agNumberColumnFilter',
  boolean: 'agSetColumnFilter',
  date: 'agDateColumnFilter',
  datetime: 'agDateColumnFilter',
  time: 'agTextColumnFilter',
  email: 'agTextColumnFilter',
  phone: 'agTextColumnFilter',
  url: 'agTextColumnFilter',
  select: 'agSetColumnFilter',
};
