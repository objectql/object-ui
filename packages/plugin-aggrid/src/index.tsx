/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { Suspense } from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { Skeleton } from '@object-ui/components';

// Import AG Grid CSS - These must be imported at the entry point for Next.js
// Importing them in the lazy-loaded component doesn't work properly
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import 'ag-grid-community/styles/ag-theme-balham.css';
import 'ag-grid-community/styles/ag-theme-material.css';

// Export types for external use
export type { AgGridSchema, SimpleColumnDef, AgGridCallbacks, ExportConfig, StatusBarConfig, ColumnConfig, ContextMenuConfig } from './types';

// 🚀 Lazy load the implementation file
// This ensures AG Grid is only loaded when the component is actually rendered
const LazyAgGrid = React.lazy(() => import('./AgGridImpl'));

export interface AgGridRendererProps {
  schema: {
    type: string;
    id?: string;
    className?: string;
    rowData?: any[];
    columnDefs?: any[];
    gridOptions?: any;
    pagination?: boolean;
    paginationPageSize?: number;
    domLayout?: 'normal' | 'autoHeight' | 'print';
    animateRows?: boolean;
    rowSelection?: 'single' | 'multiple';
    theme?: 'alpine' | 'balham' | 'material' | 'quartz';
    height?: number | string;
    editable?: boolean;
    editType?: 'fullRow';
    singleClickEdit?: boolean;
    stopEditingWhenCellsLoseFocus?: boolean;
    exportConfig?: any;
    statusBar?: any;
    callbacks?: any;
    columnConfig?: any;
    enableRangeSelection?: boolean;
    enableCharts?: boolean;
    contextMenu?: any;
  };
}

/**
 * AgGridRenderer - The public API for the AG Grid component
 * This wrapper handles lazy loading internally using React.Suspense
 */
export const AgGridRenderer: React.FC<AgGridRendererProps> = ({ schema }) => {
  return (
    <Suspense fallback={<Skeleton className="w-full h-[500px]" />}>
      <LazyAgGrid
        rowData={schema.rowData}
        columnDefs={schema.columnDefs}
        gridOptions={schema.gridOptions}
        pagination={schema.pagination}
        paginationPageSize={schema.paginationPageSize}
        domLayout={schema.domLayout}
        animateRows={schema.animateRows}
        rowSelection={schema.rowSelection}
        theme={schema.theme}
        height={schema.height}
        className={schema.className}
        editable={schema.editable}
        editType={schema.editType}
        singleClickEdit={schema.singleClickEdit}
        stopEditingWhenCellsLoseFocus={schema.stopEditingWhenCellsLoseFocus}
        exportConfig={schema.exportConfig}
        statusBar={schema.statusBar}
        callbacks={schema.callbacks}
        columnConfig={schema.columnConfig}
        enableRangeSelection={schema.enableRangeSelection}
        enableCharts={schema.enableCharts}
        contextMenu={schema.contextMenu}
      />
    </Suspense>
  );
};

// Register the component with the ComponentRegistry
ComponentRegistry.register(
  'aggrid',
  AgGridRenderer,
  {
    label: 'AG Grid',
    icon: 'Table',
    category: 'plugin',
    inputs: [
      { 
        name: 'rowData', 
        type: 'array', 
        label: 'Row Data',
        description: 'Array of objects to display in the grid',
        required: true
      },
      { 
        name: 'columnDefs', 
        type: 'array', 
        label: 'Column Definitions',
        description: 'Array of column definitions',
        required: true
      },
      { 
        name: 'pagination', 
        type: 'boolean', 
        label: 'Enable Pagination',
        defaultValue: false
      },
      { 
        name: 'paginationPageSize', 
        type: 'number', 
        label: 'Page Size',
        defaultValue: 10,
        description: 'Number of rows per page when pagination is enabled'
      },
      {
        name: 'theme',
        type: 'enum',
        label: 'Theme',
        enum: [
          { label: 'Quartz', value: 'quartz' },
          { label: 'Alpine', value: 'alpine' },
          { label: 'Balham', value: 'balham' },
          { label: 'Material', value: 'material' }
        ],
        defaultValue: 'quartz'
      },
      {
        name: 'rowSelection',
        type: 'enum',
        label: 'Row Selection',
        enum: [
          { label: 'None', value: undefined },
          { label: 'Single', value: 'single' },
          { label: 'Multiple', value: 'multiple' }
        ],
        defaultValue: undefined,
        advanced: true
      },
      {
        name: 'domLayout',
        type: 'enum',
        label: 'DOM Layout',
        enum: [
          { label: 'Normal', value: 'normal' },
          { label: 'Auto Height', value: 'autoHeight' },
          { label: 'Print', value: 'print' }
        ],
        defaultValue: 'normal',
        advanced: true
      },
      { 
        name: 'animateRows', 
        type: 'boolean', 
        label: 'Animate Rows',
        defaultValue: true,
        advanced: true
      },
      { 
        name: 'height', 
        type: 'number', 
        label: 'Height (px)',
        defaultValue: 500
      },
      { 
        name: 'editable', 
        type: 'boolean', 
        label: 'Enable Editing',
        defaultValue: false,
        description: 'Allow cells to be edited inline',
        advanced: true
      },
      { 
        name: 'singleClickEdit', 
        type: 'boolean', 
        label: 'Single Click Edit',
        defaultValue: false,
        description: 'Start editing on single click instead of double click',
        advanced: true
      },
      { 
        name: 'exportConfig', 
        type: 'code', 
        label: 'Export Config (JSON)',
        description: 'Configure CSV/Excel export: { enabled: true, fileName: "data.csv" }',
        advanced: true
      },
      { 
        name: 'statusBar', 
        type: 'code', 
        label: 'Status Bar Config (JSON)',
        description: 'Configure status bar: { enabled: true, aggregations: ["count", "sum", "avg"] }',
        advanced: true
      },
      { 
        name: 'callbacks', 
        type: 'code', 
        label: 'Event Callbacks (JSON)',
        description: 'Event handlers for cell clicks, selection changes, etc.',
        advanced: true
      },
      { 
        name: 'columnConfig', 
        type: 'code', 
        label: 'Column Config (JSON)',
        description: 'Global column settings: { resizable: true, sortable: true, filterable: true }',
        advanced: true
      },
      { 
        name: 'enableRangeSelection', 
        type: 'boolean', 
        label: 'Enable Range Selection',
        defaultValue: false,
        description: 'Allow selecting ranges of cells (like Excel)',
        advanced: true
      },
      { 
        name: 'enableCharts', 
        type: 'boolean', 
        label: 'Enable Charts',
        defaultValue: false,
        description: 'Enable integrated charting (requires AG Grid Enterprise)',
        advanced: true
      },
      { 
        name: 'contextMenu', 
        type: 'code', 
        label: 'Context Menu Config (JSON)',
        description: 'Configure right-click menu: { enabled: true, items: ["copy", "export"] }',
        advanced: true
      },
      { 
        name: 'gridOptions', 
        type: 'code', 
        label: 'Grid Options (JSON)',
        description: 'Advanced AG Grid options',
        advanced: true
      },
      { 
        name: 'className', 
        type: 'string', 
        label: 'CSS Class' 
      }
    ],
    defaultProps: {
      rowData: [
        { make: 'Tesla', model: 'Model Y', price: 64950, electric: true },
        { make: 'Ford', model: 'F-Series', price: 33850, electric: false },
        { make: 'Toyota', model: 'Corolla', price: 29600, electric: false },
        { make: 'Mercedes', model: 'EQA', price: 48890, electric: true },
        { make: 'Fiat', model: '500', price: 15774, electric: false },
        { make: 'Nissan', model: 'Juke', price: 20675, electric: false },
        { make: 'Vauxhall', model: 'Corsa', price: 18460, electric: false },
        { make: 'Volvo', model: 'XC90', price: 72835, electric: false },
        { make: 'Mercedes', model: 'GLA', price: 47825, electric: false },
        { make: 'Ford', model: 'Puma', price: 27420, electric: false },
        { make: 'Volkswagen', model: 'Golf', price: 28850, electric: false },
        { make: 'Kia', model: 'Sportage', price: 31095, electric: false }
      ],
      columnDefs: [
        { field: 'make', headerName: 'Make', sortable: true, filter: true },
        { field: 'model', headerName: 'Model', sortable: true, filter: true },
        { 
          field: 'price', 
          headerName: 'Price', 
          sortable: true, 
          filter: 'number',
          valueFormatter: (params: any) => params.value != null ? '$' + params.value.toLocaleString() : ''
        },
        { 
          field: 'electric', 
          headerName: 'Electric', 
          sortable: true, 
          filter: true,
          cellRenderer: (params: any) => params.value === true ? '⚡ Yes' : 'No'
        }
      ],
      pagination: true,
      paginationPageSize: 10,
      theme: 'quartz',
      height: 500,
      animateRows: true,
      domLayout: 'normal'
    }
  }
);

// Standard Export Protocol - for manual integration
export const aggridComponents = {
  'aggrid': AgGridRenderer,
};
