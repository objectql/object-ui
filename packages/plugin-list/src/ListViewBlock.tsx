/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useContext } from 'react';
import { isElementDataSourceConfig } from '@object-ui/core';
import {
  ElementDataSourceGate,
  SchemaRendererContext,
  type ElementDataSourceMapping,
} from '@object-ui/react';
import { ListView, type ListViewHandle, type ListViewProps } from './ListView';

/**
 * Which schema keys `ListView` actually reads, so the composed binding lands on
 * those and nothing else.
 *
 * `list-view` is the block that reads all five: `columns` is a FIELD projection
 * here (so a saved view's column list belongs on it), `filter` and `sort` go to
 * the query, the row cap is read as `pagination.pageSize`, and `viewType` picks
 * which view kind renders — its registry `inputs` enumerate grid/kanban/gallery,
 * so naming a saved kanban view and rendering a grid would be a silently wrong
 * answer.
 */
const LIST_VIEW_DATA_SOURCE: ElementDataSourceMapping = {
  columns: true,
  filter: true,
  sort: true,
  limit: 'pagination.pageSize',
  viewType: true,
};

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
 * saved view through `ElementDataSourceGate`.
 *
 * ### Where the precedence table lives (objectui#4038)
 *
 * It is NOT here. objectstack#5576 landed this block's own ~45-line copy of
 * "binding overrides the component key / a view is only a baseline / `filter`
 * AND-combines / an empty `columns` counts as unauthored / the row cap lands on
 * `pagination.pageSize` / `viewType` only when undeclared", and objectstack#6953
 * then lifted that same table into `@object-ui/react` when the other eight
 * object-bound blocks needed it. Two copies of one table is how the spec's
 * "*additional* filter criteria" quietly becomes two dialects — the next person
 * to change the rules changes one side. So the table now lives ONCE, in
 * {@link ElementDataSourceGate}, and this block contributes only the part that is
 * genuinely its own: {@link LIST_VIEW_DATA_SOURCE}, the names of the keys it
 * reads. The behaviour is unchanged in both directions — that objectstack#5576's
 * whole suite passes here untouched is the acceptance criterion of the
 * convergence, not a happy accident.
 *
 * An unresolvable `view` still fails loudly (the gate renders the configuration
 * error rather than falling back to the object's default view): silently widening
 * a named view to "all records" is the failure class the binding exists to
 * remove, and the one an AI-authored page hides best.
 */
const ListViewBlock = React.forwardRef<ListViewHandle, ListViewProps>((props, ref) => {
  const context = useContext(SchemaRendererContext as React.Context<any>);

  // Defence in depth for the collision above: even though SchemaRenderer no
  // longer spreads it, a host (or an older cached bundle) handing us the spec
  // BINDING under this prop name must never be mistaken for an adapter. The gate
  // carries the same guard for its own resolution; this one also decides what
  // `ListView` itself receives as its adapter, which the gate cannot do for us.
  const explicitAdapter = isElementDataSourceConfig(props.dataSource)
    ? undefined
    : props.dataSource;
  const adapter = explicitAdapter ?? context?.dataSource;

  return (
    <ElementDataSourceGate
      schema={props.schema}
      mapping={LIST_VIEW_DATA_SOURCE}
      dataSource={adapter}
      testId="list-view"
      errorTitle="This list view’s data source could not be resolved"
    >
      {(schema) => <ListView ref={ref} {...props} schema={schema} dataSource={adapter} />}
    </ElementDataSourceGate>
  );
});
ListViewBlock.displayName = 'ListViewBlock';

export { ListViewBlock };
