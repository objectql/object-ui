/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `object-gantt` consumes `PageComponentSchema.dataSource` (objectstack#7121).
 *
 * The gantt derives its whole data config from `schema.objectName`
 * (`getDataConfig`), and nothing mapped the spec's `dataSource.object` onto it:
 * a gantt authored with the binding the spec documents got a NULL data config,
 * so `resolveDataSource` had nothing to read through — an empty chart, no
 * request, no error.
 *
 * `filter` and `sort` DO map here (`$filter` / `$orderby` on the reload), while a
 * column list and a row cap do not — a gantt projects the fields its `gantt`
 * config names and its reload issues no `$top` at all. Those keys are left
 * unmapped rather than parked on a key nothing reads.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

// The bar canvas is irrelevant here — every assertion is about the QUERY. Same
// stub the sibling ObjectGantt tests use, for the same reason.
vi.mock('./GanttView', () => ({
  GanttView: ({ tasks }: any) => <div data-testid="gantt-view">{tasks.length}</div>,
}));

vi.mock('@object-ui/plugin-detail', () => ({
  RecordDetailDrawer: () => null,
  deriveRecordPageHref: () => null,
}));

// Registers `object-gantt` (and the ElementDataSourceGate wiring under test).
import './index';

const HOT_VIEW = {
  name: 'hot',
  label: 'Hot tasks',
  columns: ['name', 'priority'],
  filter: [['priority', '=', 'high']],
  sort: [{ field: 'name', order: 'desc' }],
  pagination: { pageSize: 7 },
};

const GANTT = { startDateField: 'start_date', endDateField: 'end_date', titleField: 'name' };

function makeAdapter(listViews: Record<string, unknown> = { hot: HOT_VIEW }) {
  return {
    find: vi.fn().mockResolvedValue({ data: [] }),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn().mockResolvedValue({
      name: 'task',
      fields: {
        name: { type: 'text' },
        priority: { type: 'text' },
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

describe('object-gantt — dataSource: { object, view } (objectstack#7121)', () => {
  it('queries the bound object with the saved view’s filter and sort', async () => {
    const adapter = makeAdapter();
    renderBlock(
      { type: 'object-gantt', gantt: GANTT, dataSource: { object: 'task', view: 'hot' } },
      adapter,
    );

    await waitFor(() => expect(adapter.find).toHaveBeenCalled());
    const [object, params] = adapter.find.mock.calls[0] as [string, any];
    expect(object).toBe('task');
    expect(params.$filter).toEqual([['priority', '=', 'high']]);
    expect(params.$orderby).toEqual({ name: 'desc' });
  });

  it('narrows, never widens: the binding’s own filter ANDs with the view’s', async () => {
    const adapter = makeAdapter();
    renderBlock(
      {
        type: 'object-gantt',
        gantt: GANTT,
        dataSource: {
          object: 'task',
          view: 'hot',
          filter: [['owner', '=', 'me']],
        },
      },
      adapter,
    );

    await waitFor(() => expect(adapter.find).toHaveBeenCalled());
    const [, params] = adapter.find.mock.calls[0] as [string, any];
    // Both sources survive — the binding is "additional filter criteria", so it
    // cannot drop the view's restriction.
    expect(JSON.stringify(params.$filter)).toContain('priority');
    expect(JSON.stringify(params.$filter)).toContain('owner');
  });

  it('reports an unresolvable `view` instead of fetching the whole object', async () => {
    const adapter = makeAdapter();
    const { container } = renderBlock(
      { type: 'object-gantt', gantt: GANTT, dataSource: { object: 'task', view: 'nope' } },
      adapter,
    );

    await waitFor(() =>
      expect(container.querySelector('[data-testid="object-gantt-datasource-error"]')).not.toBeNull(),
    );
    expect(adapter.find).not.toHaveBeenCalled();
  });

  it('writes NO row cap: the gantt reload issues no $top for one to land on', async () => {
    const adapter = makeAdapter();
    renderBlock(
      { type: 'object-gantt', gantt: GANTT, dataSource: { object: 'task', view: 'hot', limit: 3 } },
      adapter,
    );

    await waitFor(() => expect(adapter.find).toHaveBeenCalled());
    const [, params] = adapter.find.mock.calls[0] as [string, any];
    // Not an oversight — `limit` is unmapped because there is no read site. The
    // assertion is here so a future mapping addition has to be deliberate.
    expect(params.$top).toBeUndefined();
    expect(params.options).toBeUndefined();
  });

  it('leaves a gantt with NO dataSource exactly as it was', async () => {
    const adapter = makeAdapter();
    renderBlock(
      {
        type: 'object-gantt',
        objectName: 'task',
        gantt: GANTT,
        filter: [['owner', '=', 'me']],
        sort: [{ field: 'end_date', order: 'asc' }],
      },
      adapter,
    );

    await waitFor(() => expect(adapter.find).toHaveBeenCalled());
    const [object, params] = adapter.find.mock.calls[0] as [string, any];
    expect(object).toBe('task');
    expect(params.$filter).toEqual([['owner', '=', 'me']]);
    expect(params.$orderby).toEqual({ end_date: 'asc' });
  });
});
