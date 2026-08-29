/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Mapping half of consuming `PageComponentSchema.dataSource` — the spec's
 * `ElementDataSourceSchema` per-element data binding (objectstack#5576 landed
 * the resolution; objectstack#6953 wires it to the remaining blocks).
 *
 * `@object-ui/core` owns the pure half (telling the binding apart from a runtime
 * adapter, matching a view name, composing the view with the binding's own
 * keys). {@link useElementDataSource} owns the fetch half. This module owns the
 * LAST hop: writing the composed result onto the schema keys a given block
 * actually reads, and rendering the two non-final states.
 *
 * It exists because that hop was the part every block would otherwise copy.
 * `dataSource` is declared on EVERY page component, so eight blocks need the
 * same precedence table (below) with only the KEY NAMES differing — which is a
 * mapping description, not eight algorithms. A per-block copy is how the two
 * halves drift: one block ANDs the filters and the next replaces them, and the
 * spec's "additional filter criteria" quietly becomes two dialects.
 *
 * `plugin-list`'s `ListViewBlock` carried the ORIGINAL copy of the table
 * (objectstack#5576, which predates this module) and was collapsed onto this one
 * by objectui#4038 — on the acceptance criterion that objectstack#5576's whole
 * suite passes against this implementation untouched, which it does. Every
 * object-bound block now reads the rules below from here, so this is the one
 * place a change to them belongs.
 *
 * ## Precedence — one table, applied everywhere
 *
 * Three kinds of value arrive and they do not have the same standing:
 *
 *  - **`dataSource.*` keys are authoritative.** The author wrote them on THIS
 *    placement and the spec says the binding "overrides page-level object
 *    context", so they beat the component's own same-named key.
 *  - **View-sourced values are a baseline.** A `view` is a *reference*; a key
 *    written on the component itself is more specific than the view it points
 *    at, so the component's key wins over one the view supplied.
 *  - **`filter` never overrides — it combines.** The spec describes the
 *    binding's filter as "*Additional* filter criteria", so component filter,
 *    view filter and binding filter all AND together through
 *    {@link mergeFilterNodes}. A binding can only narrow what the view already
 *    restricts, never widen it: a mistyped per-element filter cannot expose rows
 *    the saved view excluded.
 *
 * An authored-but-EMPTY `columns` counts as "not authored": `[]` is what the
 * designer emits for an unconfigured column list, and supplying the columns is
 * exactly why a view was named.
 *
 * ## What a mapping may NOT do
 *
 * {@link ElementDataSourceMapping} names only keys the target block genuinely
 * reads. Writing a composed key onto a schema key the block ignores would
 * reproduce the very defect this wiring removes — a value accepted and dropped —
 * one layer further in, where it is even harder to see. A block with no row cap
 * therefore leaves `limit` unmapped rather than parking it somewhere plausible,
 * and the gap is recorded at the call site instead of being papered over here.
 *
 * ## A block with no ADAPTER fails loudly too (objectui#5378)
 *
 * The section below is about an unresolvable view NAME. The coarser failure —
 * no runtime adapter reached the block at all — used to render an empty shell
 * in exactly the same silence, and that is what `requiresDataSource` +
 * {@link NoDataSourcePanel} now report. Measured on the published
 * getting-started guide: all five of its blocks resolved no adapter, fetched
 * nothing, and said nothing. The two panels are deliberately the same shape;
 * they answer "which view?" and "which data source?", and an author who sees
 * either one is being told where to look.
 *
 * ## An unresolvable `view` fails loudly
 *
 * When the named view does not exist the gate renders a configuration error
 * instead of letting the block fall back to the object's default scope. Silently
 * widening a named view to "all records" is the failure class the binding exists
 * to remove, and it is the one an AI-authored page hides best: the page looks
 * like it works.
 */

import * as React from 'react';
import {
  isElementDataSourceConfig,
  markElementDataSourceBlock,
  mergeFilterNodes,
  type ElementDataSourceConfig,
} from '@object-ui/core';
import {
  useElementDataSource,
  type ElementDataSourceStatus,
} from '../hooks/useElementDataSource.js';
import { SchemaRendererContext } from '../context/SchemaRendererContext.js';

/**
 * Where a block's row cap lives. Three spellings are real in this repo and each
 * is the ONLY one its block reads: `list-view`/`object-grid` read
 * `pagination.pageSize` (falling back to a flat `pageSize`), and
 * `record:related_list` reads the spec's flat `limit`.
 */
export type ElementDataSourceLimitKey = 'limit' | 'pageSize' | 'pagination.pageSize';

/**
 * Which schema keys a block reads, so the composed binding lands on those and
 * nothing else.
 *
 * Every field is opt-IN. The default mapping writes only the object name,
 * because that is the one key every object-bound block in this repo reads; a
 * block that also reads a filter, a sort, a column list or a row cap says so
 * here, naming the key it reads.
 */
export interface ElementDataSourceMapping {
  /**
   * Schema key the binding's `object` lands on — `'objectName'` for every
   * object-bound block in this repo, which is the default. `false` maps nothing
   * (for a block that reads the composed object itself, like
   * `element:record_picker`, whose object lives under `properties`).
   */
  object?: string | false;
  /**
   * Set when the block renders a FIELD column list a saved view can supply.
   * Leave unset for a block whose `columns` mean something else — an
   * `object-kanban`'s `columns` are its swimlane groups, not fields, and a
   * view's field list written there would render a broken board.
   */
  columns?: boolean;
  /** Set when the block reads `schema.filter` as its query filter. */
  filter?: boolean;
  /** Set when the block reads `schema.sort` as its query ordering. */
  sort?: boolean;
  /** The key a row cap lands on; omit for a block that enforces no cap. */
  limit?: ElementDataSourceLimitKey;
  /**
   * Set when the block renders several view kinds off `schema.viewType`
   * (`list-view` is the only such container: its registry `inputs` enumerate
   * grid/kanban/gallery/…, so naming a saved kanban view and rendering a grid
   * would be a silently wrong answer).
   */
  viewType?: boolean;
}

export interface UseElementDataSourceSchemaResult<S> {
  /** Resolution state; see {@link ElementDataSourceStatus}. */
  status: ElementDataSourceStatus;
  /**
   * The schema with the composed binding applied. Returned by REFERENCE when
   * there is nothing to apply, so a block that carries no binding never sees a
   * new schema identity (which would remount it and refetch on every render).
   */
  schema: S;
  /** The binding as authored, or `undefined` when the node carries none. */
  config?: ElementDataSourceConfig;
  /** Author-facing explanation, set only for `missing`. */
  error?: string;
}

const readLimit = (base: Record<string, any>, key: ElementDataSourceLimitKey): unknown => {
  if (key === 'pagination.pageSize') return base.pagination?.pageSize;
  return base[key];
};

const writeLimit = (
  next: Record<string, any>,
  base: Record<string, any>,
  key: ElementDataSourceLimitKey,
  limit: number,
): void => {
  if (key === 'pagination.pageSize') {
    next.pagination = { ...(base.pagination ?? {}), pageSize: limit };
    return;
  }
  next[key] = limit;
};

/**
 * Resolve a block's `dataSource` binding and apply it to the block's own schema
 * keys, per {@link ElementDataSourceMapping}.
 *
 * @param schema     The block's schema node (its `dataSource` is read).
 * @param mapping    Which schema keys this block reads.
 * @param dataSource Explicit adapter; falls back to `SchemaRendererContext`.
 *
 * @example
 * ```tsx
 * const bound = useElementDataSourceSchema(schema, { filter: true, sort: true });
 * if (bound.status === 'missing') return <ElementDataSourceErrorPanel message={bound.error} />;
 * return <ObjectCalendar schema={bound.schema} />;
 * ```
 */
export function useElementDataSourceSchema<S>(
  schema: S,
  mapping: ElementDataSourceMapping = {},
  dataSource?: unknown,
): UseElementDataSourceSchemaResult<S> {
  // Defence in depth for the collision the binding and the adapter share by
  // NAME: even though `SchemaRenderer` no longer spreads `schema.dataSource` as
  // a prop, a host (or an older cached bundle) handing us the spec BINDING under
  // this argument must never be mistaken for an adapter — that is how a
  // spec-compliant page reported "this data source cannot list the saved views".
  // Same guard `ListViewBlock` carries, applied for every block at once.
  const adapter = isElementDataSourceConfig(dataSource) ? undefined : dataSource;
  const binding = useElementDataSource(schema, adapter);
  const { object: objectKey = 'objectName', columns, filter, sort, limit, viewType } = mapping;

  const mapped = React.useMemo(() => {
    const composed = binding.composed;
    if (!composed) return schema;

    const base = (schema ?? {}) as Record<string, any>;
    const next: Record<string, any> = { ...base };

    if (objectKey !== false) next[objectKey] = composed.object;

    if (columns) {
      // `[]` is the designer's "not configured yet", and supplying the columns
      // is the reason a view was named — so an empty authored list yields.
      const authored = Array.isArray(base.columns) && base.columns.length > 0;
      if (!authored && composed.columns !== undefined) next.columns = composed.columns;
    }

    if (filter) {
      // Component filter AND (view filter AND binding filter). `composed.filter`
      // already carries the latter pair; a single surviving source comes back
      // unwrapped, so the common "only the view filters" case stays flat.
      const merged = mergeFilterNodes(base.filter, composed.filter);
      if (merged !== undefined) next.filter = merged;
      else delete next.filter;
    }

    // `composed.sort`/`composed.limit` are the BINDING's when it declared one,
    // else the view's — so the component's own key may only win over the latter.
    if (sort && composed.sort !== undefined) {
      const fromView = binding.config?.sort === undefined;
      if (!fromView || base.sort === undefined) next.sort = composed.sort;
    }

    if (limit && composed.limit !== undefined) {
      const fromView = binding.config?.limit === undefined;
      if (!fromView || readLimit(base, limit) === undefined) {
        writeLimit(next, base, limit, composed.limit);
      }
    }

    if (viewType && composed.viewType !== undefined && base.viewType === undefined) {
      next.viewType = composed.viewType;
    }

    return next as S;
  }, [schema, binding.composed, binding.config, objectKey, columns, filter, sort, limit, viewType]);

  return React.useMemo(
    () => ({
      status: binding.status,
      schema: mapped,
      config: binding.config,
      error: binding.error,
    }),
    [binding.status, binding.config, binding.error, mapped],
  );
}

export interface ElementDataSourceStatusPanelProps {
  /**
   * `data-testid` stem, normally the block's registry key — the panels append
   * `-datasource-error` / `-resolving-view`, so a test names the block it is
   * asserting about rather than a shared anonymous id.
   */
  testId: string;
  /** Panel heading; defaults to a block-neutral sentence. */
  title?: string;
  /** The author-facing explanation from {@link useElementDataSourceSchema}. */
  message?: string;
}

/**
 * The "named view does not resolve" panel. Same posture (and shape) as
 * `SchemaRenderer`'s "Unknown component type": authored metadata pointing at
 * something that is not there, reported where the author can see it.
 */
export function ElementDataSourceErrorPanel({
  testId,
  title = 'This component’s data source could not be resolved',
  message,
}: ElementDataSourceStatusPanelProps): React.ReactElement {
  return (
    <div
      className="p-4 border border-red-500 rounded text-red-500 bg-red-50 my-2"
      role="alert"
      data-testid={`${testId}-datasource-error`}
    >
      <p className="font-medium">{title}</p>
      {message ? <p className="text-sm mt-1">{message}</p> : null}
    </div>
  );
}

/**
 * The "saved views are still being fetched" placeholder. Distinct from the error
 * panel because a component that treated "not resolved yet" as "does not exist"
 * would flash a configuration error on every mount.
 */
export function ElementDataSourceLoadingPanel({
  testId,
}: Pick<ElementDataSourceStatusPanelProps, 'testId'>): React.ReactElement {
  return (
    <div
      className="p-2 text-sm text-muted-foreground animate-pulse"
      role="status"
      aria-live="polite"
      data-testid={`${testId}-resolving-view`}
    >
      Loading view&hellip;
    </div>
  );
}

/**
 * The adapter this block would use, resolved the one way every block in the
 * family resolves it: an explicit value first, the `SchemaRendererProvider`
 * context second.
 *
 * The `isElementDataSourceConfig` guard is the same one
 * {@link useElementDataSourceSchema} applies — a host handing us the spec
 * BINDING under this name is handing us metadata, not an adapter, and counting
 * it as one is how "no data source" reads as "resolved".
 *
 * `T` is what the CALLER expects to have been injected, and the assertion is
 * the caller's, not this hook's: an adapter arrives here as a `dataSource` prop
 * or a context value that nothing in this package can narrow, so the type has
 * to be declared by whoever knows which interface their block consumes. Leave
 * it off and you get `unknown`, which is the honest default.
 */
export function useResolvedDataSource<T = unknown>(explicit?: unknown): T | undefined {
  const context = React.useContext(SchemaRendererContext as React.Context<any>);
  const named = isElementDataSourceConfig(explicit) ? undefined : explicit;
  return (named ?? context?.dataSource ?? undefined) as T | undefined;
}

/**
 * The author-facing sentence a block with no adapter says out loud.
 *
 * One wording for the whole object-bound family, because the reader's mistake
 * is the same one every time and the fix is the same one every time: the
 * adapter is injected by an ANCESTOR (`SchemaRendererProvider`), so nothing
 * written on the block itself can supply it. Naming the block and the object
 * it was about to read is what turns "nothing happened" into an address.
 */
export function noDataSourceMessage(blockKey: string, objectName?: unknown): string {
  const target =
    typeof objectName === 'string' && objectName.trim().length > 0
      ? `“${objectName}”`
      : 'its object';
  return (
    `“${blockKey}” has no data source, so it cannot read ${target}. ` +
    `Inject one from an ancestor — <SchemaRendererProvider dataSource={…}> from ` +
    `@object-ui/react — or hand this block a dataSource of its own.`
  );
}

/**
 * The "this block resolved no adapter" panel — objectui#5378 item 2, and the
 * #5349 shape it belongs to.
 *
 * Until this existed, a block that resolved no adapter rendered an EMPTY SHELL:
 * `object-grid` painted a header-only table, `object-form` a field-less card,
 * `detail-view` nothing at all — no error, no warning, no empty state that
 * explained itself. Measured on the published getting-started guide
 * (`content/docs/guide/building-crud-app.md`), every one of its five blocks was
 * in that state and the page reported success while fetching nothing.
 *
 * The empty shell is the defect, not a side effect of it: it is indistinguishable
 * from "the query ran and matched no rows", which is the reading an author (very
 * often an AI author) takes, and it points at the DATA when the fault is in the
 * WIRING one level up. Same posture as {@link ElementDataSourceErrorPanel}: the
 * metadata is answerable, so the answer is rendered where the author can see it.
 */
export function NoDataSourcePanel({
  testId,
  title = 'No data source resolved',
  message,
}: ElementDataSourceStatusPanelProps): React.ReactElement {
  return (
    <div
      className="p-4 border border-red-500 rounded text-red-500 bg-red-50 my-2"
      role="alert"
      data-testid={`${testId}-no-data-source`}
    >
      <p className="font-medium">{title}</p>
      {message ? <p className="text-sm mt-1">{message}</p> : null}
    </div>
  );
}

/**
 * The wrapping seam — mark `renderer` as one that wraps {@link
 * ElementDataSourceGate}, so its registrations DECLARE the `dataSource` key this
 * gate READS (objectui#6678).
 *
 * ```tsx
 * export const ObjectMapRenderer = elementDataSourceBlock<React.FC<any>>(({ schema }) => (
 *   <ElementDataSourceGate schema={schema} testId="object-map" …>
 *     {(bound) => <ObjectMap schema={bound} />}
 *   </ElementDataSourceGate>
 * ));
 * ```
 *
 * ## What this closes
 *
 * `PageComponentSchema.dataSource` is the one spelling that resolves a saved
 * view for an object-bound block. It works — and because no registration
 * declared it, `sdui-parser`'s `validateTree` reported it with the SAME
 * `unknown-prop` warning it gives the spellings that do nothing. On the tier
 * built to accept AI-authored pages the diagnostic IS the contract, so the
 * tier's only signal pointed away from the one key that works.
 *
 * ## Why a seam and not nine declarations
 *
 * Maintainer ruling, 2026-08-29: option B **in the injection form**. Nine
 * hand-written copies across nine packages is the shape that ruling refused —
 * they drift, and the tenth block forgets. Passing through here is the only
 * thing a block does; `Registry.register` emits the declaration
 * (`withElementDataSourceInput`), and `ELEMENT_DATA_SOURCE_INPUT` in
 * `@object-ui/core` is its single copy, beside the binding's own semantics.
 *
 * ## And it cannot be forgotten
 *
 * `scripts/check-element-data-source-declaration.mjs` fails any source that
 * renders `ElementDataSourceGate` for a registration without passing that
 * registration's renderer through this function. That is the mechanical half of
 * "a tenth block gets it automatically"; this function is the seam it enforces.
 *
 * Returns the renderer UNCHANGED (the mark is held in a `WeakSet`), so it is safe
 * over a `React.forwardRef` object, over `React.memo`, and over a component that
 * something else already re-exports by reference.
 */
export function elementDataSourceBlock<C>(renderer: C): C {
  return markElementDataSourceBlock(renderer);
}

export interface ElementDataSourceGateProps<S> {
  /** The block's schema node. */
  schema: S;
  /** Which schema keys this block reads; see {@link ElementDataSourceMapping}. */
  mapping?: ElementDataSourceMapping;
  /** Explicit adapter; falls back to `SchemaRendererContext`. */
  dataSource?: unknown;
  /** `data-testid` stem for the two status panels — the block's registry key. */
  testId: string;
  /** Heading for the unresolvable-view panel. */
  errorTitle?: string;
  /**
   * Whether THIS placement cannot do its job without a runtime adapter — when
   * true and none resolves, the gate renders {@link NoDataSourcePanel} instead
   * of the block (objectui#5378 item 2).
   *
   * The gate cannot compute this and does not try. "Needs an adapter" is a
   * statement about the block's own fallbacks, and every block in the family
   * has different ones: an `object-grid` carrying inline `data` rows needs no
   * adapter, an `object-form` with inline `customFields` needs none, a
   * `detail-view` handed a `data` record needs none. A predicate guessed HERE
   * would paint a configuration error over a block that is working, which is a
   * worse failure than the silence this replaces — so the call site, which
   * knows its own fallbacks, states it.
   */
  requiresDataSource?: boolean;
  /** Explanation for the no-adapter panel; see {@link noDataSourceMessage}. */
  noDataSourceMessage?: string;
  /**
   * Renders the block with the bound schema. Called during the gate's own
   * render, so it must RETURN AN ELEMENT and never call hooks itself — the
   * block's hooks belong to the block.
   */
  children: (schema: S) => React.ReactElement | null;
}

/**
 * Wrap an object-bound block so its `dataSource` binding reaches the keys it
 * reads, and so the two non-final resolution states render once, the same way,
 * for every block.
 *
 * The block itself is not mounted while a named view is unresolved: rendering it
 * against a half-resolved query is how a page shows a wider answer than the one
 * that was authored.
 */
export function ElementDataSourceGate<S>({
  schema,
  mapping,
  dataSource,
  testId,
  errorTitle,
  requiresDataSource,
  noDataSourceMessage: noDataSourceText,
  children,
}: ElementDataSourceGateProps<S>): React.ReactElement | null {
  const bound = useElementDataSourceSchema(schema, mapping, dataSource);
  const adapter = useResolvedDataSource(dataSource);

  // Reported BEFORE the view state, because with no adapter every downstream
  // answer is a symptom of this one: `useElementDataSource` cannot list the
  // object's saved views either, so a block carrying a `view` would otherwise
  // report "this data source cannot list the saved views" — true, and pointing
  // at the view name instead of at the missing injection.
  if (requiresDataSource && adapter == null) {
    return <NoDataSourcePanel testId={testId} message={noDataSourceText} />;
  }

  if (bound.status === 'missing') {
    return <ElementDataSourceErrorPanel testId={testId} title={errorTitle} message={bound.error} />;
  }
  if (bound.status === 'loading') {
    return <ElementDataSourceLoadingPanel testId={testId} />;
  }
  return children(bound.schema);
}
