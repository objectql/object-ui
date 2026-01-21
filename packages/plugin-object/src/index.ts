/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/plugin-object
 * 
 * ObjectQL plugin for Object UI.
 * Provides seamless integration with ObjectQL backends through smart components
 * that automatically generate UI from ObjectQL object schemas.
 * 
 * @packageDocumentation
 */

export { ObjectTable } from './ObjectTable';
export type { ObjectTableProps } from './ObjectTable';

export { ObjectForm } from './ObjectForm';
export type { ObjectFormProps } from './ObjectForm';

export { ObjectView } from './ObjectView';
export type { ObjectViewProps } from './ObjectView';

// Re-export related types from @object-ui/types
export type {
  ObjectTableSchema,
  ObjectFormSchema,
  ObjectViewSchema,
  ObjectQLComponentSchema,
} from '@object-ui/types';
