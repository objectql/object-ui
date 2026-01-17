/**
 * @object-ui/data-object
 * 
 * ObjectQL-specific components for Object UI.
 * Provides seamless integration with ObjectQL backends through smart components
 * that automatically generate UI from ObjectQL object schemas.
 * 
 * @packageDocumentation
 */

export { ObjectTable } from './ObjectTable';
export type { ObjectTableProps } from './ObjectTable';

export { ObjectForm } from './ObjectForm';
export type { ObjectFormProps } from './ObjectForm';

// Re-export related types from @object-ui/types
export type {
  ObjectTableSchema,
  ObjectFormSchema,
  ObjectQLComponentSchema,
} from '@object-ui/types';
