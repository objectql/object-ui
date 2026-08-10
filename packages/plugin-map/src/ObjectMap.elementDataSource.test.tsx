/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `object-map` consumes `PageComponentSchema.dataSource` (objectstack#7121).
 *
 * The map derives its data config from `schema.objectName` (`getDataConfig`), and
 * nothing mapped the spec's `dataSource.object` onto it: a map authored with the
 * binding the spec documents got a null config and rendered with no markers — no
 * request, no error.
 *
 * `filter` and `sort` DO map here (`$filter` / `$orderby` on the fetch); a column
 * list and a row cap do not, a map projecting the fields its `map` config names
 * and issuing no `$top`.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';

// No WebGL in the test env — same stub the sibling ObjectMap tests use. Every
// assertion here is about the QUERY, not the canvas.
vi.mock('react-map-gl/maplibre', () => ({
  default: ({ children }: any) => <div aria-label="Map">{children}</div>,
  Map: ({ children }: any) => <div aria-label="Map">{children}</div>,
  NavigationControl: () => <div data-testid="nav-control" />,
  Marker: ({ children }: any) => <div data-testid="map-marker">{children}</div>,
  Popup: ({ children }: any) => <div data-testid="map-popup">{children}</div>,
}));

// Registers `object-map` (and the ElementDataSourceGate wiring under test).
import './index';

const HOT_VIEW = {
  name: 'hot',
  label: 'Hot stores',
  columns: ['name', 'rating'],
  filter: [['rating', '=', 'hot']],
  sort: [{ field: 'name', order: 'desc' }],
  pagination: { pageSize: 7 },
};

const MAP = { latitudeField: 'lat', longitudeField: 'lng', titleField: 'name' };

function makeAdapter(listViews: Record<string, unknown> = { hot: HOT_VIEW }) {
  return {
    find: vi.fn().mockResolvedValue({ data: [] }),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn().mockResolvedValue({
      name: 'store',
      fields: {
        name: { type: 'text' },
        rating: { type: 'text' },
        lat: { type: 'number' },
        lng: { type: 'number' },
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

describe('object-map — dataSource: { object, view } (objectstack#7121)', () => {
  it('queries the bound object with the saved view’s filter and sort', async () => {
    const adapter = makeAdapter();
    renderBlock(
      { type: 'object-map', map: MAP, dataSource: { object: 'store', view: 'hot' } },
      adapter,
    );

    await waitFor(() => expect(adapter.find).toHaveBeenCalled());
    const [object, params] = adapter.find.mock.calls[0] as [string, any];
    expect(object).toBe('store');
    expect(params.$filter).toEqual([['rating', '=', 'hot']]);
    expect(params.$orderby).toEqual({ name: 'desc' });
  });

  it('narrows, never widens: the binding’s own filter ANDs with the view’s', async () => {
    const adapter = makeAdapter();
    renderBlock(
      {
        type: 'object-map',
        map: MAP,
        dataSource: { object: 'store', view: 'hot', filter: [['owner', '=', 'me']] },
      },
      adapter,
    );

    await waitFor(() => expect(adapter.find).toHaveBeenCalled());
    const [, params] = adapter.find.mock.calls[0] as [string, any];
    expect(JSON.stringify(params.$filter)).toContain('rating');
    expect(JSON.stringify(params.$filter)).toContain('owner');
  });

  it('reports an unresolvable `view` instead of fetching the whole object', async () => {
    const adapter = makeAdapter();
    const { container } = renderBlock(
      { type: 'object-map', map: MAP, dataSource: { object: 'store', view: 'nope' } },
      adapter,
    );

    await waitFor(() =>
      expect(container.querySelector('[data-testid="object-map-datasource-error"]')).not.toBeNull(),
    );
    expect(adapter.find).not.toHaveBeenCalled();
  });

  it('writes NO row cap: the map fetch issues no $top for one to land on', async () => {
    const adapter = makeAdapter();
    renderBlock(
      { type: 'object-map', map: MAP, dataSource: { object: 'store', view: 'hot', limit: 3 } },
      adapter,
    );

    await waitFor(() => expect(adapter.find).toHaveBeenCalled());
    const [, params] = adapter.find.mock.calls[0] as [string, any];
    expect(params.$top).toBeUndefined();
  });

  it('leaves a map with NO dataSource exactly as it was', async () => {
    const adapter = makeAdapter();
    renderBlock(
      {
        type: 'object-map',
        objectName: 'store',
        map: MAP,
        filter: [['owner', '=', 'me']],
        sort: [{ field: 'name', order: 'asc' }],
      },
      adapter,
    );

    await waitFor(() => expect(adapter.find).toHaveBeenCalled());
    const [object, params] = adapter.find.mock.calls[0] as [string, any];
    expect(object).toBe('store');
    expect(params.$filter).toEqual([['owner', '=', 'me']]);
    expect(params.$orderby).toEqual({ name: 'asc' });
  });
});
