/**
 * ObjectUI — useElementDataSource
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Runtime half of consuming `PageComponentSchema.dataSource` — the spec's
 * `ElementDataSourceSchema` per-element data binding (objectstack#5576).
 *
 * `@object-ui/core` owns the pure half (telling the binding apart from a runtime
 * adapter, matching a view name, composing the view with the binding's own keys).
 * This hook owns the part that needs React and a data source: FETCHING the
 * object's saved views so `view` can be resolved to real columns/filter/sort.
 *
 * It lives in `@object-ui/react` rather than in the one plugin that consumes it
 * today because the binding is declared on EVERY page component: `list-view`
 * reads it here, `element:record_picker` already reads `schema.dataSource` (and
 * still ignores `view`), and the remaining object-bound blocks will need the same
 * resolution. One resolver in the runtime layer, not one per plugin.
 */

import { useContext, useEffect, useMemo, useState, type Context } from 'react';
import {
  collectSavedViews,
  composeElementDataSource,
  elementDataSourceViewNotFoundMessage,
  isElementDataSourceConfig,
  resolveSavedView,
  type ComposedElementDataSource,
  type ElementDataSourceConfig,
  type ElementSavedView,
} from '@object-ui/core';
import { SchemaRendererContext } from '../context/SchemaRendererContext.js';

/**
 * Where a resolution attempt stands. Distinguishing `loading` from `missing`
 * matters: a component that treated "not resolved yet" as "does not exist" would
 * flash the configuration error on every mount.
 */
export type ElementDataSourceStatus =
  /** The node carries no `dataSource` binding — nothing to resolve. */
  | 'absent'
  /** Binding present, no `view` named — composition is already final. */
  | 'ready'
  /** A `view` was named and the saved views are still being fetched. */
  | 'loading'
  /** The named `view` was found and composed in. */
  | 'resolved'
  /** The named `view` does not exist on the object (or could not be read). */
  | 'missing';

export interface UseElementDataSourceResult {
  status: ElementDataSourceStatus;
  /** The binding as authored, or `undefined` when the node carries none. */
  config?: ElementDataSourceConfig;
  /**
   * Binding composed with the resolved view. Present for `ready` and
   * `resolved`; withheld for `loading` and `missing` so a caller cannot render a
   * half-resolved query by accident.
   */
  composed?: ComposedElementDataSource;
  /** The saved view that was applied, when one was. */
  view?: ElementSavedView;
  /** Author-facing explanation, set only for `missing`. */
  error?: string;
}

/** A data source able to answer "what saved views does this object have?". */
interface ViewCapableDataSource {
  listViews?: (object: string) => Promise<unknown>;
  getObjectSchema?: (object: string) => Promise<unknown>;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object';

/**
 * Read every saved view for `object` from the two places they live, in the same
 * precedence app-shell's `ObjectView` uses: the object definition's embedded
 * `listViews` / `list_views` map first, then the metadata-overlay rows
 * `listViews()` returns — so a user-saved view shadows a metadata one of the
 * same id.
 *
 * `capable` is false when there is no data source, or it exposes neither read —
 * "this object has no view called X" and "nobody here can answer that question"
 * are different facts and must not be reported as the same one. Both are still
 * reported; only the message differs.
 *
 * A REJECTION from either source is swallowed to an empty contribution rather
 * than propagated: one unavailable source must not make an existing view in the
 * OTHER source read as missing.
 */
async function fetchSavedViews(
  dataSource: ViewCapableDataSource | null | undefined,
  object: string,
): Promise<{ capable: boolean; views: Record<string, ElementSavedView> }> {
  const canReadObjectDef = typeof dataSource?.getObjectSchema === 'function';
  const canReadOverlay = typeof dataSource?.listViews === 'function';
  if (!canReadObjectDef && !canReadOverlay) return { capable: false, views: {} };

  const embedded = canReadObjectDef
    ? dataSource!.getObjectSchema!(object).then(
        (def) => (isRecord(def) ? (def.listViews ?? def.list_views) : undefined),
        () => undefined,
      )
    : Promise.resolve(undefined);

  const overlay = canReadOverlay
    ? dataSource!.listViews!(object).then((rows) => rows, () => undefined)
    : Promise.resolve(undefined);

  const [embeddedViews, overlayViews] = await Promise.all([embedded, overlay]);
  return { capable: true, views: collectSavedViews(embeddedViews, overlayViews) };
}

/**
 * Resolve a schema node's `dataSource` binding, fetching the named saved view.
 *
 * @param schema      The component's schema node (its `dataSource` is read).
 * @param dataSource  Explicit adapter; falls back to `SchemaRendererContext`.
 *
 * @example
 * ```tsx
 * const binding = useElementDataSource(schema, adapter);
 * if (binding.status === 'missing') return <ConfigError message={binding.error} />;
 * if (binding.status === 'loading') return <Skeleton />;
 * const objectName = binding.composed?.object ?? schema.objectName;
 * ```
 */
export function useElementDataSource(
  schema: unknown,
  dataSource?: unknown,
): UseElementDataSourceResult {
  const context = useContext(SchemaRendererContext as Context<any>);
  const adapter = (dataSource ?? context?.dataSource ?? null) as ViewCapableDataSource | null;

  const config = useMemo(() => {
    const raw = isRecord(schema) ? (schema as Record<string, unknown>).dataSource : undefined;
    return isElementDataSourceConfig(raw) ? raw : undefined;
  }, [schema]);

  const object = config?.object;
  const viewName = config?.view;

  /**
   * Which (object, view) pair a stored resolution belongs to.
   *
   * The state carries its own key instead of being CLEARED when the binding
   * changes, so the effect never calls `setState` synchronously in its body
   * (`react-hooks/set-state-in-effect`, an error in this repo — and the cascading
   * render it names is real: every mount would render twice). A resolution whose
   * key no longer matches simply does not count, which reads as `loading` below
   * — the same answer clearing would have produced, without the extra render.
   */
  const requestKey = object && viewName ? JSON.stringify([object, viewName]) : '';

  // `view: null` = resolved to nothing (missing). `null` state = never resolved.
  const [resolved, setResolved] = useState<
    { key: string; view: ElementSavedView | null; error?: string } | null
  >(null);

  useEffect(() => {
    if (!object || !viewName) return;
    let cancelled = false;
    fetchSavedViews(adapter, object).then(({ capable, views }) => {
      if (cancelled) return;
      if (!capable) {
        setResolved({
          key: requestKey,
          view: null,
          error:
            `dataSource.view "${viewName}" cannot be resolved: this data source ` +
            `cannot list the saved views of object "${object}".`,
        });
        return;
      }
      const view = resolveSavedView(views, viewName, object);
      setResolved(
        view
          ? { key: requestKey, view }
          : {
              key: requestKey,
              view: null,
              error: elementDataSourceViewNotFoundMessage(
                object,
                viewName,
                Object.keys(views),
              ),
            },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [adapter, object, viewName, requestKey]);

  return useMemo<UseElementDataSourceResult>(() => {
    if (!config) return { status: 'absent' };
    if (!config.view) {
      return { status: 'ready', config, composed: composeElementDataSource(config) };
    }
    if (resolved?.key !== requestKey) return { status: 'loading', config };
    if (resolved.view === null) return { status: 'missing', config, error: resolved.error };
    return {
      status: 'resolved',
      config,
      view: resolved.view,
      composed: composeElementDataSource(config, resolved.view),
    };
  }, [config, resolved, requestKey]);
}
