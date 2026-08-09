/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `object-timeline` consumes `PageComponentSchema.dataSource` (objectstack#7121).
 *
 * Every branch of the timeline's fetch effect is gated on `schema.objectName`,
 * and nothing mapped the spec's `dataSource.object` onto it: a timeline authored
 * with the binding the spec documents never fetched and rendered an empty rail
 * with no request and no error.
 *
 * This block maps `object` and NOTHING else, which the last two cases pin
 * deliberately: the fetch is `find(objectName, { options: { $top: 100 } })` — no
 * `$filter`, no `$orderby`, a hard-coded window — so a `filter` / `sort` / `limit`
 * written onto the schema would be accepted and dropped, the very defect this
 * wiring removes. A named view is still resolved (a typo reports) and then
 * contributes nothing.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
// Registers `object-timeline` (and the ElementDataSourceGate wiring under test).
import './index';

const HOT_VIEW = {
  name: 'hot',
  label: 'Hot campaigns',
  columns: ['name', 'stage'],
  filter: [['stage', '=', 'live']],
  sort: [{ field: 'name', order: 'desc' }],
  pagination: { pageSize: 7 },
};

const TIMELINE = { startDateField: 'start_date', endDateField: 'end_date', titleField: 'name' };

function makeAdapter(listViews: Record<string, unknown> = { hot: HOT_VIEW }) {
  return {
    find: vi.fn().mockResolvedValue({ data: [] }),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn().mockResolvedValue({
      name: 'campaign',
      fields: {
        name: { type: 'text' },
        stage: { type: 'text' },
        start_date: { type: 'datetime' },
        end_date: { type: 'datetime' },
      },
      listViews,
    }),
  };
}

const renderBlock = (schema: Record<string, unknown>, adapter: ReturnType<typeof makeAdapter>) =>
  render(
    <SchemaRendererProvider dataSource={adapter as any}>
      <SchemaRenderer schema={schema as any} />
    </SchemaRendererProvider>,
  );

describe('object-timeline — dataSource: { object, view } (objectstack#7121)', () => {
  it('queries the object named by the binding', async () => {
    const adapter = makeAdapter();
    renderBlock(
      { type: 'object-timeline', timeline: TIMELINE, dataSource: { object: 'campaign', view: 'hot' } },
      adapter,
    );

    await waitFor(() => expect(adapter.find).toHaveBeenCalled());
    const [object] = adapter.find.mock.calls[0] as [string, any];
    expect(object).toBe('campaign');
  });

  it('reports an unresolvable `view` instead of fetching the whole object', async () => {
    const adapter = makeAdapter();
    const { container } = renderBlock(
      { type: 'object-timeline', timeline: TIMELINE, dataSource: { object: 'campaign', view: 'nope' } },
      adapter,
    );

    await waitFor(() =>
      expect(container.querySelector('[data-testid="object-timeline-datasource-error"]')).not.toBeNull(),
    );
    expect(adapter.find).not.toHaveBeenCalled();
  });

  it('does NOT pretend to honour filter/sort/limit — there is no read site for them', async () => {
    const adapter = makeAdapter();
    renderBlock(
      {
        type: 'object-timeline',
        timeline: TIMELINE,
        dataSource: {
          object: 'campaign',
          view: 'hot',
          filter: [['owner', '=', 'me']],
          sort: [{ field: 'end_date', order: 'asc' }],
          limit: 3,
        },
      },
      adapter,
    );

    await waitFor(() => expect(adapter.find).toHaveBeenCalled());
    const [, params] = adapter.find.mock.calls[0] as [string, any];
    // The honest assertion: the timeline's query carries none of these, because
    // it reads none of them. Recorded here (and in the data-source guide) rather
    // than hidden behind a mapping that writes to keys nobody reads. When the
    // fetch gains the read sites, this case is what has to be rewritten.
    expect(params.$filter).toBeUndefined();
    expect(params.$orderby).toBeUndefined();
    expect(params.options).toEqual({ $top: 100 });
  });

  it('leaves a timeline with NO dataSource exactly as it was', async () => {
    const adapter = makeAdapter();
    renderBlock(
      { type: 'object-timeline', objectName: 'campaign', timeline: TIMELINE },
      adapter,
    );

    await waitFor(() => expect(adapter.find).toHaveBeenCalled());
    const [object, params] = adapter.find.mock.calls[0] as [string, any];
    expect(object).toBe('campaign');
    expect(params.options).toEqual({ $top: 100 });
  });
});
