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
export * from './utils/managedBy.js';
export * from './utils/extract-records.js';
export * from './utils/expand-fields.js';
export * from './utils/column-identity.js';
export * from './utils/sort-values.js';
export * from './utils/sort-query.js';
export * from './utils/resolve-view-id.js';
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
// Session-scoped filter placeholders ({current_user_id} / {current_org_id})
// plus `resolveFilterPlaceholders`, the single entry point every surface
// should call so no vocabulary is silently skipped (framework #3574).
export * from './utils/filter-tokens.js';
export * from './utils/dashboard-filters.js';
export * from './utils/merge-filters.js';
export * from './utils/compare-to.js';
export * from './utils/chart-series.js';
export * from './utils/dataset-format.js';
// Pivot lookup-key encoders, shared by every cross-tab renderer so the
// dashboard widget and the report renderer key their buckets identically
// (objectstack#5473 / objectstack#5665).
export * from './utils/dataset-pivot.js';
export * from './utils/record-title.js';
export * from './utils/export-filename.js';
export * from './utils/reference-keys.js';
// Binds a fetched record into an expression scope the way the SERVER binds it
// (a relation is its foreign key, never the expanded record) — see
// `toPredicateRecord` for why an unnormalized one gives the same predicate
// different verdicts on different surfaces.
export * from './utils/predicate-record.js';
// The other half of a view's field appetite: the fields its PREDICATES read,
// which the column-derived `$select` never asked the server for.
export * from './utils/predicate-fields.js';
export * from './utils/normalize-list-view.js';
