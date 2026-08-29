/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `@object-ui/core` — ElementDataSource resolution (objectstack#5576).
 *
 * `PageComponentSchema.dataSource` (the spec's `ElementDataSourceSchema`) is the
 * per-element data binding a page component uses to query a different object
 * than the page's own context:
 *
 * ```json
 * { "object": "account", "view": "hot", "filter": { … }, "sort": [ … ], "limit": 20 }
 * ```
 *
 * This module owns the two pure halves of consuming it — telling the METADATA
 * apart from a runtime data-source adapter, and composing a named saved view
 * with the binding's own keys. Both are needed in two places (the render path in
 * `@object-ui/plugin-list`, and `ViewDataProvider.resolveElementDataSource`), so
 * they live here rather than being written twice.
 *
 * ## Composition semantics
 *
 * The spec's own `describe()` text settles the one case that could go either
 * way. `filter` is documented as "**Additional** filter criteria" — additional
 * to what the named view already restricts — so a view filter and a binding
 * filter COMBINE under `and`; the binding can only narrow the view, never widen
 * it. That is also the safe direction for AI-authored metadata: a typo in a
 * per-element filter cannot silently expose rows the saved view excluded.
 *
 * Nothing else in the binding is described as additional, and the remaining keys
 * are single-valued (one ordering, one cap), so for those the rule is **the view
 * provides the baseline and an explicit key overrides it**:
 *
 * | key        | source                                  | rule                        |
 * |------------|-----------------------------------------|-----------------------------|
 * | `object`   | binding (required)                      | binding wins                |
 * | `columns`  | view only — the binding has no such key | view                        |
 * | `filter`   | view + binding                          | AND-combined ("additional") |
 * | `sort`     | view or binding                         | binding overrides view      |
 * | `limit`    | view (`pagination.pageSize`) or binding | binding overrides view      |
 * | `viewType` | view only                               | view                        |
 *
 * A lone `filter` — only the view has one, or only the binding does — is passed
 * through in the shape it was stored in; only the two-source case is lowered to
 * an ObjectQL AST, because that is what combining requires.
 *
 * `viewType` rides along because `list-view` IS the multi-kind view container
 * (its registry `inputs` enumerate grid/kanban/gallery/…): naming a saved kanban
 * view and rendering a grid would be a silently wrong answer.
 */

import { mergeFilterNodes } from '../utils/filter-converter.js';
import { resolveViewId } from '../utils/resolve-view-id.js';

/** Sort entry, as both the spec's `SortItem` and objectui's view configs spell it. */
export interface ElementDataSourceSort {
  field: string;
  order: 'asc' | 'desc';
}

/**
 * Element-level data source — matches `@objectstack/spec` `ElementDataSourceSchema`.
 *
 * `filter` is typed `unknown` rather than the spec's `FilterCondition` because
 * three shapes legitimately reach a renderer here (a MongoDB-style condition
 * object, an ObjectQL AST node array, a spec `ViewFilterRule[]`) and
 * {@link mergeFilterNodes} is the single sink that lowers all three. Narrowing
 * the type here would only move the cast, not remove it.
 */
export interface ElementDataSourceConfig {
  object: string;
  view?: string;
  filter?: unknown;
  sort?: ElementDataSourceSort[];
  limit?: number;
}

/**
 * The subset of a saved view's config that an `ElementDataSource` `view` name
 * contributes. Deliberately loose: stored view metadata is user data and carries
 * both the spec vocabulary and the legacy objectui spellings that
 * `normalizeListViewSchema` folds at the component boundary.
 */
export type ElementSavedView = Record<string, unknown>;

/** What {@link composeElementDataSource} produces for a renderer to consume. */
export interface ComposedElementDataSource {
  /** Object to query. */
  object: string;
  /** Columns the named view shows; absent when no view was named. */
  columns?: unknown;
  /** View filter AND binding filter, combined; `undefined` when neither. */
  filter?: unknown;
  /** Binding sort if given, else the view's. */
  sort?: unknown;
  /** Binding limit if given, else the view's page size. */
  limit?: number;
  /** The view's render kind (grid / kanban / …), when the view declares one. */
  viewType?: string;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Is this value the spec's `dataSource` METADATA, rather than a runtime
 * data-source adapter?
 *
 * This guard exists because the two collide by name and the collision was live:
 * `SchemaRenderer` spreads every non-metadata schema key onto the component as a
 * React prop, so a spec-compliant `dataSource: { object, view }` on a page
 * component landed on `ListView`'s `dataSource` PROP — which is the injected
 * adapter — and shadowed it. The first `dataSource.find(…)` then threw
 * `dataSource.find is not a function`, which the list reported as
 * "Couldn't load records": writing the binding the spec documents BROKE the
 * component (objectstack#5576).
 *
 * The test is positive on the metadata rather than negative on the adapter: a
 * binding is a plain object with a non-empty string `object` and no `find`
 * method. An adapter never has a string `object`; metadata never has `find`.
 */
export function isElementDataSourceConfig(
  value: unknown,
): value is ElementDataSourceConfig {
  if (!isPlainObject(value)) return false;
  if (typeof (value as { find?: unknown }).find === 'function') return false;
  const object = (value as { object?: unknown }).object;
  return typeof object === 'string' && object.length > 0;
}

/**
 * Flatten every place saved views for one object can live into `id → config`.
 *
 * Two sources are real and both are read, in the order app-shell's `ObjectView`
 * reads them: the object definition's embedded `listViews` / `list_views` map
 * (metadata-defined) and the metadata overlay rows an adapter returns from
 * `listViews()` (user-defined). Later sources win, so a saved view shadows a
 * metadata view of the same id — the same precedence `ObjectView` applies when
 * it dedups its tab list.
 *
 * Accepts a record keyed by view id or an array of view configs (overlay rows
 * are an array and carry their identity in `name`, falling back to `id`).
 */
export function collectSavedViews(
  ...sources: unknown[]
): Record<string, ElementSavedView> {
  const out: Record<string, ElementSavedView> = {};
  for (const source of sources) {
    if (Array.isArray(source)) {
      for (const entry of source) {
        if (!isPlainObject(entry)) continue;
        const id = entry.name ?? entry.id;
        if (typeof id === 'string' && id) out[id] = entry;
      }
    } else if (isPlainObject(source)) {
      for (const [id, entry] of Object.entries(source)) {
        if (isPlainObject(entry)) out[id] = entry;
      }
    }
  }
  return out;
}

/**
 * Find the saved view a `dataSource.view` name refers to.
 *
 * Name matching is {@link resolveViewId}'s — the same short/qualified tolerance
 * the object page applies to a URL-requested view — so a name that works in one
 * surface works in the other. Returns `undefined` when nothing matches; the
 * caller must REPORT that rather than fall back to the object's default view.
 * Silently widening a named view to "all records" is the failure mode this whole
 * binding exists to remove.
 */
export function resolveSavedView(
  views: Record<string, ElementSavedView>,
  requested: string | undefined | null,
  object: string,
): ElementSavedView | undefined {
  const id = resolveViewId(requested, Object.keys(views), object);
  return id === undefined ? undefined : views[id];
}

/** Read a saved view's row cap — `pagination.pageSize`, or a flat `limit`. */
function savedViewLimit(view: ElementSavedView | null | undefined): number | undefined {
  if (!view) return undefined;
  const pagination = view.pagination;
  if (isPlainObject(pagination) && typeof pagination.pageSize === 'number') {
    return pagination.pageSize;
  }
  return typeof view.limit === 'number' ? view.limit : undefined;
}

/**
 * Read a saved view's render kind. `type` is the spec's key (and what
 * `ObjectView` reads); `viewType` is objectui's legacy spelling, folded by
 * `normalizeListViewSchema` downstream but accepted here so a view stored either
 * way resolves to the same kind.
 */
function savedViewType(view: ElementSavedView | null | undefined): string | undefined {
  if (!view) return undefined;
  const kind = view.type ?? view.viewType;
  return typeof kind === 'string' && kind ? kind : undefined;
}

/** Read a saved view's column list — canonical `columns`, legacy `fields`. */
function savedViewColumns(view: ElementSavedView | null | undefined): unknown {
  if (!view) return undefined;
  if (Array.isArray(view.columns)) return view.columns;
  if (Array.isArray(view.fields)) return view.fields;
  return undefined;
}

/**
 * Compose an `ElementDataSource` binding with the saved view it names.
 *
 * Pure — the caller resolves the view (see {@link resolveSavedView}) and owns
 * the "named a view that does not exist" decision. Passing `undefined` /`null`
 * for `view` composes a binding with no view, which is exactly the pre-#5576
 * behaviour for the other four keys.
 *
 * See the module doc for the per-key rule table; `filter` is the only key that
 * combines rather than overrides, because the spec describes the binding's
 * filter as *additional*.
 */
export function composeElementDataSource(
  config: ElementDataSourceConfig,
  view?: ElementSavedView | null,
): ComposedElementDataSource {
  const composed: ComposedElementDataSource = { object: config.object };

  const columns = savedViewColumns(view);
  if (columns !== undefined) composed.columns = columns;

  // "Additional filter criteria" (spec) — the view restricts, the binding
  // restricts further, so two filters COMBINE under `and` via the repo's single
  // combiner. A lone source passes through VERBATIM: lowering a stored filter to
  // an ObjectQL AST belongs at the last hop before the wire and nowhere earlier
  // (see `toFilterNode`'s doc on why), and every consumer of this result hands
  // the value to that hop anyway. Combining is the one case that cannot preserve
  // the input shape — putting two sources under one `and` requires AST — and
  // `mergeFilterNodes` is the sanctioned place for it.
  const viewFilter = view?.filter;
  const filter = viewFilter !== undefined && config.filter !== undefined
    ? mergeFilterNodes(viewFilter, config.filter)
    : (config.filter ?? viewFilter);
  if (filter !== undefined) composed.filter = filter;

  const sort = config.sort ?? view?.sort;
  if (sort !== undefined) composed.sort = sort;

  const limit = config.limit ?? savedViewLimit(view);
  if (limit !== undefined) composed.limit = limit;

  const viewType = savedViewType(view);
  if (viewType !== undefined) composed.viewType = viewType;

  return composed;
}

/**
 * The message shown when `dataSource.view` names a view the object does not
 * have. Built here so the render path and `ViewDataProvider` report the same
 * defect the same way, and so the known-view list (the thing that actually gets
 * an author unstuck) is never omitted by one caller.
 */
export function elementDataSourceViewNotFoundMessage(
  object: string,
  view: string,
  knownViews: readonly string[],
): string {
  const known = knownViews.length
    ? `Known views: ${[...knownViews].sort().join(', ')}.`
    : 'This object has no saved views.';
  return `dataSource.view "${view}" was not found on object "${object}". ${known}`;
}

/* ------------------------------------------------------------------ *
 * The DECLARATION half — one copy, next to the semantics (objectui#6678)
 * ------------------------------------------------------------------ */

/**
 * The spec key this module resolves, spelled once.
 *
 * Every consumer that needs the NAME (the registry injection, its gates, the
 * pins) reads it from here rather than repeating the literal, so "which key is
 * this?" has exactly one answer in the tree.
 */
export const ELEMENT_DATA_SOURCE_KEY = 'dataSource';

/**
 * The authoring-surface declaration of {@link ELEMENT_DATA_SOURCE_KEY} — the one
 * copy, emitted into every registration that wraps the runtime gate.
 *
 * ## Why it lives here and is injected rather than written per block
 *
 * `PageComponentSchema.dataSource` is READ by `ElementDataSourceGate` in
 * `@object-ui/react` on behalf of every object-bound block that wraps itself in
 * it — nine of them at the time of writing. It was declared by NONE: `validateTree`
 * skips `BASE_PROPS` and otherwise looks a prop up in the component's `inputs`,
 * and `dataSource` was in neither. So the html tier reported the one spelling
 * that resolves a saved view — the only one that works — with the identical
 * `unknown-prop` warning it gives the spellings that do nothing, on the tier
 * meant to accept AI-authored pages, where the diagnostic IS the contract
 * (objectui#6678, the reporter of objectui#6598 gave up on exactly this).
 *
 * The maintainer ruling of 2026-08-29 took option B **in the injection form**:
 * emitted mechanically at the wrapping seam, so a block declares the key from
 * the same place that reads it. Nine hand-kept copies is the shape that ruling
 * refused — they drift, and a tenth block would simply forget. Adding the key to
 * `sdui-parser`'s `BASE_PROPS` (option A) was refused too: that set mirrors
 * `BaseSchema`, and silencing `dataSource` on blocks that do NOT read it
 * (`flex`, `card`) would make the diagnostic lie in the other direction.
 *
 * ## Why `object`, and not a bare `'object'` kind
 *
 * The `binding: 'object'` marker is what tells a consumer this input names an
 * OBJECT — `validateTree` records it as a binding site, and the designer offers
 * an object picker rather than a free-text blob. The `type` stays the coarse
 * `'object'` kind because the value is a record; the two words are unrelated and
 * both are correct here.
 */
export const ELEMENT_DATA_SOURCE_INPUT: {
  name: string;
  type: 'object';
  label: string;
  binding: 'object';
  description: string;
} = {
  name: ELEMENT_DATA_SOURCE_KEY,
  type: 'object',
  label: 'Data Source',
  binding: 'object',
  description:
    'Per-element data binding: { object, view, filter, sort, limit }. Overrides the ' +
    'page-level object context for this block; `view` names a saved view of `object`, ' +
    'and `filter` is ANDed with the view’s own rather than replacing it.',
};

/**
 * The renderers that wrap the runtime gate.
 *
 * A `WeakSet` rather than a property on the component: marking must not mutate a
 * `React.forwardRef` exotic object or show up when a test snapshots a
 * registration, and an unregistered renderer must stay collectable.
 */
const elementDataSourceBlocks = new WeakSet<object>();

/**
 * Declare that `renderer` wraps `ElementDataSourceGate`, so its registrations
 * publish {@link ELEMENT_DATA_SOURCE_INPUT}.
 *
 * This is the SEAM, and it is deliberately the only way in: `Registry.register`
 * injects the declaration for exactly the renderers marked here, so the key is
 * published by whatever consumes the gate and by nothing else — which is what
 * keeps the `flex` / `card` direction of the ruling true.
 * `scripts/check-element-data-source-declaration.mjs` fails any source that
 * consumes the gate without passing through it, so a new block cannot forget.
 *
 * ## Two import paths, ONE name and ONE function
 *
 * `@object-ui/react` re-exports this beside `ElementDataSourceGate`, which is
 * where a block that renders the gate should import it from — the seam reads
 * best next to the thing it is about.
 *
 * Import it from HERE instead when the calling module is in a widely-imported
 * package and the call is at MODULE SCOPE, as `element:record_picker`'s
 * registration in `@object-ui/components` is. 101 suites in this repo partially
 * mock `@object-ui/react` by hand-listing the exports they return, and a
 * module-scope read of a name those lists do not carry throws at COLLECTION
 * time — the importing test file fails before it runs a single assertion.
 * Measured: 17 files, all four CI shards, zero failed assertions among them.
 * Nothing mocks `@object-ui/core`, and `@object-ui/components` already imports
 * `ComponentRegistry` from it at module scope, so this path adds no coupling
 * that was not already there.
 */
export function elementDataSourceBlock<C>(renderer: C): C {
  if (renderer && (typeof renderer === 'object' || typeof renderer === 'function')) {
    elementDataSourceBlocks.add(renderer as unknown as object);
  }
  return renderer;
}

/** Whether `renderer` was marked by {@link elementDataSourceBlock}. */
export function isElementDataSourceBlock(renderer: unknown): boolean {
  return (
    !!renderer
    && (typeof renderer === 'object' || typeof renderer === 'function')
    && elementDataSourceBlocks.has(renderer as object)
  );
}
