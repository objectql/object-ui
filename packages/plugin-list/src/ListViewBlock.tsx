/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useContext, useMemo } from 'react';
import { isElementDataSourceConfig, mergeFilterNodes } from '@object-ui/core';
import { SchemaRendererContext, useElementDataSource } from '@object-ui/react';
import { ListView, type ListViewHandle, type ListViewProps } from './ListView';

/**
 * Registry entry point for `<ListView>` — two bridges in one component.
 *
 * ## 1. The data-source ADAPTER (#3144)
 *
 * `ListView` reads `props.dataSource` (the injected adapter), and
 * `SchemaRenderer` never passes it — it only puts the data source on
 * `SchemaRendererContext`. Registering the component bare meant that on the
 * registry/SDUI path (a metadata page, a `kind:'react'` page, the designer
 * preview) it received no data source at all: its `getObjectSchema` effect
 * returned immediately, nothing was ever fetched, and it rendered the "Nothing
 * here" empty state — while its registry `inputs` declared `objectName`
 * **required**. The app never showed this because the console reaches ListView
 * through `ObjectView`'s `renderListView` render-prop, which passes a data
 * source itself. That is the objectstack#4413 shape (a declared binding nothing
 * can consume), caught by
 * `apps/console/src/__tests__/public-block-binding-reach.test.tsx` rather than by
 * hand. `object-form`, `object-kanban` and `object-calendar` carry the same
 * one-line bridge.
 *
 * An explicit `dataSource` prop still wins — hosts that pass their own (as
 * `ObjectView` does) are unaffected. `useContext` rather than
 * `useSchemaContext()` because the latter throws outside a provider, and a bare
 * `<ListView>` with a host-supplied data source must keep working.
 *
 * ## 2. The spec's per-element data BINDING (objectstack#5576)
 *
 * `PageComponentSchema.dataSource` — `{ object, view?, filter?, sort?, limit? }` —
 * is how a page component declares what to query. It was published and unread:
 * `resolveElementDataSource` dropped `view`, had no caller outside its own test,
 * and nothing mapped `object` onto `objectName`. Worse, the binding and the
 * adapter above collide by NAME, so a page that wrote the binding the spec
 * documents got the plain `{ object, view }` object where the adapter belongs:
 * the first `dataSource.find(…)` threw `dataSource.find is not a function` and
 * the list rendered **"Couldn't load records"**. Three `list-view` components on
 * one home page, the two without `dataSource` fine and the spec-compliant one
 * broken, is the single-variable reproduction in the issue.
 *
 * `SchemaRenderer` no longer spreads the schema's `dataSource` as a prop, which
 * removes the collision at its source. This component completes the other half:
 * it maps the binding onto the props `ListView` actually reads, resolving a named
 * saved view through {@link useElementDataSource}.
 *
 * ### Precedence
 *
 * Two kinds of value arrive, and they do not have the same standing:
 *
 *  - **`dataSource.*` keys are authoritative.** The author wrote them on THIS
 *    placement, and the spec says the binding "overrides page-level object
 *    context". They beat the component's own same-named key.
 *  - **View-sourced values are a baseline.** A `view` is a *reference*; a key
 *    written on the component itself is more specific than the view it points at,
 *    so the component's key wins. ("view provides the baseline, explicit keys
 *    override".)
 *  - **`filter` never overrides — it combines.** The spec describes the
 *    binding's filter as "*Additional* filter criteria", so component filter,
 *    view filter and binding filter all AND together through
 *    `mergeFilterNodes`. A binding can only narrow what the view already
 *    restricts, never widen it: a mistyped per-element filter cannot expose rows
 *    the saved view excluded. (`ListView` then ANDs the user's own toolbar
 *    filters onto this, unchanged.)
 *
 * An authored-but-EMPTY `columns` counts as "not authored": `[]` is what the
 * designer emits for an unconfigured column list, and supplying the columns is
 * exactly why a view was named. Any non-empty `columns` on the component wins.
 *
 * ### An unresolvable `view` fails loudly
 *
 * When the named view does not exist we render a configuration error instead of
 * falling back to the object's default view. Silently widening a named view to
 * "all records" is the failure class the binding exists to remove, and it is the
 * one an AI-authored page hides best: the page looks like it works. Same posture
 * (and same shape of panel) as `SchemaRenderer`'s "Unknown component type" —
 * authored metadata pointing at something that is not there.
 */
const ListViewBlock = React.forwardRef<ListViewHandle, ListViewProps>((props, ref) => {
  const context = useContext(SchemaRendererContext as React.Context<any>);

  // Defence in depth for the collision above: even though SchemaRenderer no
  // longer spreads it, a host (or an older cached bundle) handing us the spec
  // BINDING under this prop name must never be mistaken for an adapter.
  const explicitAdapter = isElementDataSourceConfig(props.dataSource)
    ? undefined
    : props.dataSource;
  const adapter = explicitAdapter ?? context?.dataSource;

  const binding = useElementDataSource(props.schema, adapter);

  const schema = useMemo(() => {
    const composed = binding.composed;
    if (!composed) return props.schema;

    const base = props.schema as Record<string, any>;
    const next: Record<string, any> = { ...base };

    next.objectName = composed.object;

    const authoredColumns = Array.isArray(base.columns) && base.columns.length > 0
      ? base.columns
      : undefined;
    if (authoredColumns === undefined && composed.columns !== undefined) {
      next.columns = composed.columns;
    }

    // Component filter AND (view filter AND binding filter). `composed.filter`
    // already carries the latter pair; a single surviving source comes back
    // unwrapped, so the common "only the view filters" case stays flat.
    const filter = mergeFilterNodes(base.filter, composed.filter);
    if (filter !== undefined) next.filter = filter;
    else delete next.filter;

    // `composed.sort` is the binding's sort when it declared one, else the
    // view's — so the component's own `sort` may only win over the latter.
    if (composed.sort !== undefined) {
      const viewSuppliedSort = binding.config?.sort === undefined;
      if (!viewSuppliedSort || base.sort === undefined) next.sort = composed.sort;
    }

    if (composed.limit !== undefined) {
      const viewSuppliedLimit = binding.config?.limit === undefined;
      const authoredPageSize = base.pagination?.pageSize;
      if (!viewSuppliedLimit || authoredPageSize === undefined) {
        next.pagination = { ...(base.pagination ?? {}), pageSize: composed.limit };
      }
    }

    if (composed.viewType !== undefined && base.viewType === undefined) {
      next.viewType = composed.viewType;
    }

    return next as ListViewProps['schema'];
  }, [props.schema, binding.composed, binding.config]);

  if (binding.status === 'missing') {
    return (
      <div
        className="p-4 border border-red-500 rounded text-red-500 bg-red-50 my-2"
        role="alert"
        data-testid="list-view-datasource-error"
      >
        <p className="font-medium">This list view&rsquo;s data source could not be resolved</p>
        <p className="text-sm mt-1">{binding.error}</p>
      </div>
    );
  }

  if (binding.status === 'loading') {
    return (
      <div
        className="p-2 text-sm text-muted-foreground animate-pulse"
        role="status"
        aria-live="polite"
        data-testid="list-view-resolving-view"
      >
        Loading view&hellip;
      </div>
    );
  }

  return <ListView ref={ref} {...props} schema={schema} dataSource={adapter} />;
});
ListViewBlock.displayName = 'ListViewBlock';

export { ListViewBlock };
