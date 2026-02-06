/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { 
  ColDef, 
  GridReadyEvent, 
  CellClickedEvent, 
  RowClickedEvent, 
  SelectionChangedEvent, 
  CellValueChangedEvent,
  StatusPanelDef,
  GetContextMenuItemsParams,
  MenuItemDef,
  IServerSideDatasource,
  IServerSideGetRowsParams
} from 'ag-grid-community';
import type { DataSource, FieldMetadata, ObjectSchemaMetadata } from '@object-ui/types';
import type { ObjectAgGridImplProps } from './object-aggrid.types';
import { FIELD_TYPE_TO_FILTER_TYPE } from './object-aggrid.types';
import { createFieldCellRenderer, createFieldCellEditor } from './field-renderers';

/**
 * ObjectAgGridImpl - Metadata-driven AG Grid implementation
 * Fetches object metadata and data from ObjectStack and renders the grid
 */
export default function ObjectAgGridImpl({
  objectName,
  dataSource,
  fields: providedFields,
  fieldNames,
  filters,
  sort,
  pageSize = 10,
  pagination = true,
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
}: ObjectAgGridImplProps) {
  const gridRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [objectSchema, setObjectSchema] = useState<ObjectSchemaMetadata | null>(null);
  const [rowData, setRowData] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch object metadata
  useEffect(() => {
    if (!dataSource) {
      setError(new Error('DataSource is required'));
      setLoading(false);
      return;
    }

    const fetchMetadata = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch object schema/metadata
        const schema = await (dataSource as any).getObjectSchema(objectName);
        setObjectSchema(schema);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        callbacks?.onDataError?.(error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [objectName, dataSource, callbacks]);

  // Fetch data
  useEffect(() => {
    if (!dataSource || !objectSchema) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const queryParams: any = {
          $top: pageSize,
          $skip: 0,
        };

        if (filters) {
          queryParams.$filter = filters;
        }

        if (sort) {
          queryParams.$orderby = sort;
        }

        const result = await dataSource.find(objectName, queryParams);
        setRowData(result.data || []);
        setTotalCount(result.total || 0);
        callbacks?.onDataLoaded?.(result.data || []);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        callbacks?.onDataError?.(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [objectName, dataSource, objectSchema, filters, sort, pageSize, callbacks]);

  // Generate column definitions from metadata
  const columnDefs = useMemo((): ColDef[] => {
    if (!objectSchema?.fields) return [];

    // Use provided fields or get from schema
    const fieldMetadata = providedFields || Object.values(objectSchema.fields);
    
    // Filter fields if fieldNames is provided
    const fieldsToShow = fieldNames 
      ? fieldMetadata.filter(field => fieldNames.includes(field.name))
      : fieldMetadata;

    return fieldsToShow.map(field => {
      const colDef: ColDef = {
        field: field.name,
        headerName: field.label || field.name,
        sortable: field.sortable !== false,
        filter: getFilterType(field),
        editable: editable && !field.readonly,
        // visible_on will be evaluated by the core renderer
        // For now, we just show all fields. Conditional visibility
        // should be handled at a higher level or via dynamic column updates
      };

      // Apply column config defaults
      if (columnConfig) {
        if (columnConfig.resizable !== undefined) {
          colDef.resizable = columnConfig.resizable;
        }
        if (columnConfig.sortable !== undefined && colDef.sortable === undefined) {
          colDef.sortable = columnConfig.sortable;
        }
      }

      // Add custom renderers and formatters based on field type
      applyFieldTypeFormatting(colDef, field);

      return colDef;
    });
  }, [objectSchema, providedFields, fieldNames, editable, columnConfig]);

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
      fileName: exportConfig?.fileName || `${objectName}-export.csv`,
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
  }, [exportConfig, callbacks, rowData, objectName]);

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

  const handleCellValueChanged = useCallback(async (event: CellValueChangedEvent) => {
    callbacks?.onCellValueChanged?.(event);
    
    // Save changes to backend if dataSource supports update
    // Note: Assumes records have an 'id' field as primary key
    // TODO: Make the ID field name configurable via schema
    if (dataSource && event.data && event.data.id) {
      try {
        await dataSource.update(objectName, event.data.id, {
          [event.colDef.field!]: event.newValue
        });
      } catch (err) {
        console.error('Failed to update record:', err);
        // Revert the change
        event.node.setDataValue(event.colDef.field!, event.oldValue);
      }
    }
  }, [callbacks, dataSource, objectName]);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    gridRef.current = params;
  }, []);

  // Merge grid options with props
  const gridOptions = useMemo(() => ({
    pagination,
    paginationPageSize: pageSize,
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
    suppressCellFocus: !editable,
    enableCellTextSelection: true,
    ensureDomOrder: true,
    onCellClicked: handleCellClicked,
    onRowClicked: handleRowClicked,
    onSelectionChanged: handleSelectionChanged,
    onCellValueChanged: handleCellValueChanged,
    onGridReady,
  }), [
    pagination, 
    pageSize, 
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

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={containerStyle}>
        <div className="text-muted-foreground">Loading {objectName}...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center" style={containerStyle}>
        <div className="text-destructive">Error loading data: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="object-aggrid-container">
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
          columnDefs={columnDefs}
          gridOptions={gridOptions}
        />
      </div>
    </div>
  );
}

/**
 * Escape HTML to prevent XSS attacks
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get filter type based on field metadata
 */
function getFilterType(field: FieldMetadata): string | boolean {
  if (field.filterable === false) {
    return false;
  }
  
  return FIELD_TYPE_TO_FILTER_TYPE[field.type] || 'agTextColumnFilter';
}

/**
 * Apply field type-specific formatting to column definition
 * Uses field widgets from @object-ui/fields for consistent rendering
 */
function applyFieldTypeFormatting(colDef: ColDef, field: FieldMetadata): void {
  // Define field types that should use field widgets for rendering
  const fieldWidgetTypes = [
    'text', 'textarea', 'number', 'currency', 'percent',
    'boolean', 'select', 'date', 'datetime', 'time',
    'email', 'phone', 'url', 'password', 'color',
    'rating', 'image', 'avatar', 'lookup', 'slider', 'code'
  ];

  // Use field widget renderer if the type is supported
  if (fieldWidgetTypes.includes(field.type)) {
    colDef.cellRenderer = createFieldCellRenderer(field);
    
    // Add cell editor for editable fields
    if (colDef.editable) {
      colDef.cellEditor = createFieldCellEditor(field);
      
      // Configure editor based on field type
      if (['date', 'datetime', 'select', 'lookup', 'color'].includes(field.type)) {
        colDef.cellEditorPopup = true;
      }
    }
  } else {
    // Fallback to simple rendering for unsupported types
    switch (field.type) {
      case 'lookup':
      case 'master_detail':
        colDef.valueFormatter = (params: any) => {
          if (!params.value) return '';
          // Handle lookup values - could be an object or just an ID
          if (typeof params.value === 'object') {
            return params.value.name || params.value.label || params.value.id || '';
          }
          return String(params.value);
        };
        break;
        
      case 'object':
        colDef.cellRenderer = () => '<span class="text-gray-500 italic">[Object]</span>';
        break;
        
      case 'vector':
        colDef.cellRenderer = () => '<span class="text-gray-500 italic">[Vector]</span>';
        break;
        
      case 'grid':
        colDef.cellRenderer = () => '<span class="text-gray-500 italic">[Grid]</span>';
        break;
        
      default:
        // Default text rendering
        colDef.valueFormatter = (params: any) => {
          return params.value != null ? String(params.value) : '';
        };
    }
  }
}
