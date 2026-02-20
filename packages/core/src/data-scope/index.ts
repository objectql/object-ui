/**
 * @object-ui/core - DataScope Module
 *
 * Runtime data scope management for row-level security and
 * reactive data state within the UI component tree.
 *
 * @module data-scope
 * @packageDocumentation
 */

export {
  DataScopeManager,
  defaultDataScopeManager,
  type RowLevelFilter,
  type DataScopeConfig,
} from './DataScopeManager.js';

export {
  ViewDataProvider,
  type ViewDataConfig,
  type ElementDataSourceConfig,
  type DataFetcher,
  type ResolvedData,
} from './ViewDataProvider.js';
