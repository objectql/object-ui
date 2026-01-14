/**
 * @object-ui/data-objectql
 * 
 * ObjectQL Data Source Adapter for Object UI
 * 
 * This package provides seamless integration between Object UI components
 * and ObjectQL API backends, implementing the universal DataSource interface.
 * 
 * @packageDocumentation
 */

export { 
  ObjectQLDataSource, 
  createObjectQLDataSource,
  type ObjectQLConfig,
  type ObjectQLQueryParams,
} from './ObjectQLDataSource';

export { 
  useObjectQL,
  useObjectQLQuery,
  useObjectQLMutation,
  type UseObjectQLOptions,
  type UseObjectQLQueryOptions,
  type UseObjectQLMutationOptions,
} from './hooks';
