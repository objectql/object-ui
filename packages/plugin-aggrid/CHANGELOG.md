# @object-ui/plugin-aggrid

## 2.0.0

### Major Changes

- b859617: Release v1.0.0 — unify all package versions to 1.0.0

### Patch Changes

- Updated dependencies [b859617]
  - @object-ui/types@2.0.0
  - @object-ui/core@2.0.0
  - @object-ui/react@2.0.0
  - @object-ui/components@2.0.0
  - @object-ui/fields@2.0.0
  - @object-ui/data-objectstack@2.0.0

## 0.4.1

### Patch Changes

- Maintenance release - Documentation and build improvements
- Updated dependencies
  - @object-ui/types@0.3.1
  - @object-ui/core@0.3.1
  - @object-ui/react@0.3.1
  - @object-ui/components@0.3.1

## 0.4.0

### Minor Changes

- **Cell & Row Editing**: Added inline editing support with `editable` prop and `singleClickEdit` option
- **CSV Export**: Built-in export functionality with configurable options
- **Event Callbacks**: Support for `onCellClicked`, `onRowClicked`, `onSelectionChanged`, `onCellValueChanged`, and `onExport` callbacks
- **Status Bar**: Display aggregations (count, sum, avg, min, max) at the bottom of the grid
- **Column Configuration**: Global column settings with `columnConfig` for resizable, sortable, and filterable columns
- **Range Selection**: Enable Excel-like range selection with `enableRangeSelection`
- **Context Menu**: Customizable right-click context menu with built-in and custom actions
- **Enhanced TypeScript Types**: Added `AgGridCallbacks`, `ExportConfig`, `StatusBarConfig`, `ColumnConfig`, and `ContextMenuConfig` types
- **Improved API**: Extended schema with editing, export, status bar, column configuration, and context menu

## 0.3.0

### Minor Changes

- Initial release of AG Grid plugin
- Support for AG Grid Community Edition
- Lazy loading with React.Suspense
- Multiple theme support (Quartz, Alpine, Balham, Material)
- Full pagination, sorting, and filtering support
- TypeScript support with type definitions
- Automatic component registration
- Comprehensive test coverage
