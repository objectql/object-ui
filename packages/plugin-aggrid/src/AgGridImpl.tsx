/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useMemo, useRef, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, GridOptions, GridReadyEvent, CellClickedEvent, RowClickedEvent, SelectionChangedEvent, CellValueChangedEvent, StatusPanelDef, GetContextMenuItemsParams, MenuItemDef } from 'ag-grid-community';
import type { AgGridCallbacks, ExportConfig, StatusBarConfig, ColumnConfig, ContextMenuConfig } from './types';

export interface AgGridImplProps {
  rowData?: any[];
  columnDefs?: ColDef[];
  gridOptions?: GridOptions;
  pagination?: boolean;
  paginationPageSize?: number;
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
  callbacks?: AgGridCallbacks;
  columnConfig?: ColumnConfig;
  enableRangeSelection?: boolean;
  enableCharts?: boolean;
  contextMenu?: ContextMenuConfig;
}

/**
 * AgGridImpl - The heavy implementation that imports AG Grid
 * This component is lazy-loaded to avoid including AG Grid in the initial bundle
 */
export default function AgGridImpl({
  rowData = [],
  columnDefs = [],
  gridOptions = {},
  pagination = false,
  paginationPageSize = 10,
  domLayout = 'normal',
  animateRows = true,
  rowSelection,
  theme = 'quartz',
  height = 500,
  className = '',
  editable = false,
  editType,
  singleClickEdit = false,
  stopEditingWhenCellsLoseFocus = true,
  exportConfig,
  statusBar,
  callbacks,
  columnConfig,
  enableRangeSelection = false,
  enableCharts = false,
  contextMenu,
}: AgGridImplProps) {
  const gridRef = useRef<any>(null);

  // Build status bar panels
  const statusPanels = useMemo((): StatusPanelDef[] | undefined => {
    if (!statusBar?.enabled) return undefined;
    
    const aggregations = statusBar.aggregations || ['count', 'sum', 'avg'];
    const panels: StatusPanelDef[] = [];
    
    if (aggregations.includes('count')) {
      panels.push({ statusPanel: 'agAggregationComponent', statusPanelParams: { aggFuncs: ['count'] } });
    }
    if (aggregations.includes('sum')) {
      panels.push({ statusPanel: 'agAggregationComponent', statusPanelParams: { aggFuncs: ['sum'] } });
    }
    if (aggregations.includes('avg')) {
      panels.push({ statusPanel: 'agAggregationComponent', statusPanelParams: { aggFuncs: ['avg'] } });
    }
    if (aggregations.includes('min')) {
      panels.push({ statusPanel: 'agAggregationComponent', statusPanelParams: { aggFuncs: ['min'] } });
    }
    if (aggregations.includes('max')) {
      panels.push({ statusPanel: 'agAggregationComponent', statusPanelParams: { aggFuncs: ['max'] } });
    }
    
    return panels;
  }, [statusBar]);

  // CSV Export handler
  const handleExportCSV = useCallback(() => {
    if (!gridRef.current?.api) return;
    
    const params = {
      fileName: exportConfig?.fileName || 'export.csv',
      skipColumnHeaders: exportConfig?.skipColumnHeaders || false,
      allColumns: exportConfig?.allColumns || false,
      onlySelected: exportConfig?.onlySelected || false,
    };
    
    gridRef.current.api.exportDataAsCsv(params);
    
    if (callbacks?.onExport) {
      const data = exportConfig?.onlySelected 
        ? gridRef.current.api.getSelectedRows()
        : rowData;
      callbacks.onExport(data || [], 'csv');
    }
  }, [exportConfig, callbacks, rowData]);

  // Context Menu handler
  const getContextMenuItems = useCallback((params: GetContextMenuItemsParams): (string | MenuItemDef)[] => {
    if (!contextMenu?.enabled) return [];
    
    const items: (string | MenuItemDef)[] = [];
    const defaultItems = contextMenu.items || ['copy', 'copyWithHeaders', 'separator', 'export'];
    
    defaultItems.forEach(item => {
      if (item === 'export') {
        items.push({
          name: 'Export CSV',
          icon: '<span>📥</span>',
          action: () => handleExportCSV(),
        });
      } else if (item === 'autoSizeAll') {
        items.push({
          name: 'Auto-size All Columns',
          action: () => {
            if (gridRef.current?.api) {
              gridRef.current.api.autoSizeAllColumns();
            }
          },
        });
      } else if (item === 'resetColumns') {
        items.push({
          name: 'Reset Columns',
          action: () => {
            if (gridRef.current?.api) {
              gridRef.current.api.resetColumnState();
            }
          },
        });
      } else {
        items.push(item);
      }
    });
    
    // Add custom items
    if (contextMenu.customItems) {
      if (items.length > 0) {
        items.push('separator');
      }
      contextMenu.customItems.forEach(customItem => {
        items.push({
          name: customItem.name,
          disabled: customItem.disabled,
          action: () => {
            // Trigger dedicated context menu action callback
            if (callbacks?.onContextMenuAction) {
              callbacks.onContextMenuAction(customItem.action, params.node?.data);
            }
          },
        });
      });
    }
    
    return items;
  }, [contextMenu, handleExportCSV, callbacks]);

  // Event handlers
  const handleCellClicked = useCallback((event: CellClickedEvent) => {
    callbacks?.onCellClicked?.(event);
  }, [callbacks]);

  const handleRowClicked = useCallback((event: RowClickedEvent) => {
    callbacks?.onRowClicked?.(event);
  }, [callbacks]);

  const handleSelectionChanged = useCallback((event: SelectionChangedEvent) => {
    callbacks?.onSelectionChanged?.(event);
  }, [callbacks]);

  const handleCellValueChanged = useCallback((event: CellValueChangedEvent) => {
    callbacks?.onCellValueChanged?.(event);
  }, [callbacks]);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    gridRef.current = params;
  }, []);

  // Make columns editable if global editable flag is set
  const processedColumnDefs = useMemo(() => {
    if (!columnDefs) return [];
    
    return columnDefs.map(col => {
      const processed: ColDef = { ...col };
      
      // Apply editable setting
      if (editable && col.editable !== false) {
        processed.editable = true;
      }
      
      // Apply column config defaults
      if (columnConfig) {
        if (columnConfig.resizable !== undefined && col.resizable === undefined) {
          processed.resizable = columnConfig.resizable;
        }
        if (columnConfig.sortable !== undefined && col.sortable === undefined) {
          processed.sortable = columnConfig.sortable;
        }
        if (columnConfig.filterable !== undefined && col.filter === undefined) {
          processed.filter = columnConfig.filterable;
        }
      }
      
      return processed;
    });
  }, [columnDefs, editable, columnConfig]);

  // Merge grid options with props
  const mergedGridOptions = useMemo(() => ({
    ...gridOptions,
    pagination,
    paginationPageSize,
    domLayout,
    animateRows,
    rowSelection,
    editType,
    singleClickEdit,
    stopEditingWhenCellsLoseFocus,
    statusBar: statusPanels ? { statusPanels } : undefined,
    enableRangeSelection,
    enableCharts,
    getContextMenuItems: contextMenu?.enabled ? getContextMenuItems : undefined,
    // Default options for better UX
    suppressCellFocus: !editable,
    enableCellTextSelection: true,
    ensureDomOrder: true,
    // Virtual scrolling optimizations for large datasets
    rowBuffer: gridOptions.rowBuffer ?? 10,
    debounceVerticalScrollbar: gridOptions.debounceVerticalScrollbar ?? (rowData.length > 1000),
    // Event handlers
    onCellClicked: handleCellClicked,
    onRowClicked: handleRowClicked,
    onSelectionChanged: handleSelectionChanged,
    onCellValueChanged: handleCellValueChanged,
    onGridReady,
  }), [
    gridOptions, 
    pagination, 
    paginationPageSize, 
    domLayout, 
    animateRows, 
    rowSelection,
    editType,
    singleClickEdit,
    stopEditingWhenCellsLoseFocus,
    statusPanels,
    enableRangeSelection,
    enableCharts,
    contextMenu,
    getContextMenuItems,
    editable,
    rowData.length,
    handleCellClicked,
    handleRowClicked,
    handleSelectionChanged,
    handleCellValueChanged,
    onGridReady,
  ]);

  // Compute container style
  const containerStyle = useMemo(() => ({
    height: typeof height === 'number' ? `${height}px` : height,
    width: '100%',
  }), [height]);

  // Determine theme class and build complete class list
  const themeClass = `ag-theme-${theme}`;
  const classList = [
    themeClass,
    'rounded-xl',
    'border',
    'border-border',
    'overflow-hidden',
    'shadow-lg',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className="ag-grid-container">
      {exportConfig?.enabled && (
        <div className="mb-2 flex gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            Export CSV
          </button>
        </div>
      )}
      <div 
        className={classList}
        style={containerStyle}
      >
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={processedColumnDefs}
          gridOptions={mergedGridOptions}
        />
      </div>
    </div>
  );
}
