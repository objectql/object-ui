# @object-ui/plugin-aggrid

## 3.0.1

### Patch Changes

- Updated dependencies [adf2cc0]
  - @object-ui/react@3.0.1
  - @object-ui/components@3.0.1
  - @object-ui/fields@3.0.1
  - @object-ui/types@3.0.1
  - @object-ui/core@3.0.1
  - @object-ui/data-objectstack@3.0.1

## 3.0.0

### Minor Changes

- 87979c3: Upgrade to @objectstack v3.0.0 and console bundle optimization
  - Upgraded all @objectstack/\* packages from ^2.0.7 to ^3.0.0
  - Breaking change migrations: Hub → Cloud namespace, definePlugin removed, PaginatedResult.value → .records, PaginatedResult.count → .total, client.meta.getObject() → client.meta.getItem()
  - Console bundle optimization: split monolithic 3.7 MB chunk into 17 granular cacheable chunks (95% main entry reduction)
  - Added gzip + brotli pre-compression via vite-plugin-compression2
  - Lazy MSW loading for build:server (~150 KB gzip saved)
  - Added bundle analysis with rollup-plugin-visualizer

### Patch Changes

- Updated dependencies [87979c3]
  - @object-ui/types@3.0.0
  - @object-ui/core@3.0.0
  - @object-ui/react@3.0.0
  - @object-ui/components@3.0.0
  - @object-ui/fields@3.0.0
  - @object-ui/data-objectstack@3.0.0

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
