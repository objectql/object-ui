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
// The DOM pass-through whitelist of the SDUI widget prop contract
// (objectui#4425 phase 2): a registered widget's host element receives only
// what `toDomProps` passes — everything else is consumed or dropped.
// `@object-ui/fields` executes the SAME mechanism against its own declared key
// list (`pickDomProps`), so there is one judge, not two.
export * from './utils/dom-props.js';
export * from './utils/filter-converter.js';
export * from './utils/managedBy.js';
export * from './utils/extract-records.js';
export * from './utils/expand-fields.js';
// The RETIREMENT gate (objectui#4914, maintainer ruling B). Homed here rather
// than in `@object-ui/fields` because `@object-ui/components` is one of its six
// consumers and `fields` depends on `components` — see the module's docblock
// for why a second copy was not an option. `@object-ui/fields` re-exports every
// name, so its published surface is unchanged.
export * from './utils/retired-field-types.js';
export * from './utils/unmaterialized-fields.js';
// [#5729] The consumer half of objectstack#10235's ruling: the SERVED
// per-column sortability projection, and the one spelling of its contract
// (`entry exists && sortable: true`). Homed beside the storage-fact set above
// because a consumer that reaches for one must be able to see the other and
// know which one the platform actually served.
export * from './utils/column-sortability.js';
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
// The AUTHORED half of a dataset-bound chart (objectui#4229's data/presentation
// split), shared by the dashboard widget and the report's embedded chart so the
// same spec keys are lowered identically on both (objectui#4877).
export * from './utils/chart-presentation.js';
// The ONE number-display formatter (objectui#4033) — grouping policy, display
// locale and the percent convention. It lived in `@object-ui/i18n` until
// objectui#4576; it is pure, and living above `core` was what kept
// `dataset-format` below from reaching it (so the two drifted). `@object-ui/i18n`
// re-exports these names unchanged, so both import paths name the same symbol.
export * from './utils/number-display.js';
export * from './utils/dataset-format.js';
// Pivot lookup-key encoders, shared by every cross-tab renderer so the
// dashboard widget and the report renderer key their buckets identically
// (objectstack#5473 / objectstack#5665).
export * from './utils/dataset-pivot.js';
export * from './utils/record-title.js';
// The one `colorField` ladder every record view shares (objectui#7243) — the
// gantt, calendar and timeline all resolve an authored option colour here
// instead of each guessing at the raw stored value.
export * from './utils/record-color.js';
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
// The THIRD source of a view's field appetite: the fields it GROUPS BY. The
// spec's `grouping` block is a sibling of `columns`, not a subset, so a grid
// may group by a field it never shows (objectui#7179).
export * from './utils/grouping-fields.js';
export * from './utils/normalize-list-view.js';
// The single home for the VALUE fallback prettifier (a stored value becomes a
// display string when nothing resolves it). `@object-ui/fields` and
// `@object-ui/plugin-charts` each carried a byte-identical private copy;
// both now re-export this one (objectui#5444). Its docstring also records why
// it stays distinct from `humanizeFieldKey`, the KEY fallback.
export * from './utils/humanize-label.js';
