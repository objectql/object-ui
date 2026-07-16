/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export type { SchemaNode, ComponentRendererProps } from './types/index.js';
export * from './registry/Registry.js';
export * from './registry/public-blocks.js';
export * from './registry/PluginSystem.js';
export * from './registry/PluginScopeImpl.js';
export * from './registry/WidgetRegistry.js';
export * from './validation/index.js';
export * from './builder/schema-builder.js';
export * from './utils/filter-converter.js';
export * from './utils/extract-records.js';
export * from './utils/expand-fields.js';
export * from './evaluator/index.js';
export * from './actions/index.js';
export * from './query/index.js';
export * from './adapters/index.js';
export * from './theme/index.js';
export * from './data-scope/index.js';
export * from './errors/index.js';
export * from './utils/debug.js';
export * from './utils/debug-collector.js';
export * from './utils/merge-views-into-objects.js';
export * from './utils/freeze-schema.js';
export * from './protocols/index.js';
export * from './styling/scoped-styles.js';
export * from './runtime/capabilities.js';

/**
 * @deprecated Import `composeStacks` from `@objectstack/spec` instead.
 *
 * This re-export is kept only for backward compatibility and will be removed
 * in the next major version of `@object-ui/core`.
 */
export { composeStacks } from '@objectstack/spec';
export * from './utils/drill-down.js';
export * from './utils/date-macros.js';
export * from './utils/dashboard-filters.js';
export * from './utils/merge-filters.js';
export * from './utils/compare-to.js';
export * from './utils/chart-series.js';
export * from './utils/dataset-format.js';
export * from './utils/record-title.js';
export * from './utils/export-filename.js';
export * from './utils/reference-keys.js';
