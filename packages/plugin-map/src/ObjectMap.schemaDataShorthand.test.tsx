/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * objectui#5305 — the fetch effect used to carry a SECOND short-circuit beside
 * the `props.data` one #5003/#5297 fixed: it read `schema.data` directly and
 * tested whether that value was itself an array. eslint reported the read as
 * `missing dependency: schema.data`.
 *
 * The measurement that chose the fix: `schema.data` was never actually stale.
 * `getDataConfig(schema)` already returns `schema.data` verbatim, and the
 * result is memoized on `JSON.stringify(rawDataConfig)` into `dataConfig` —
 * which IS one of the effect's declared dependencies. So the effect re-ran on
 * every authored-rows change even before this change; the direct read was a
 * DUPLICATE of a value already threaded, not an un-threaded one.
 *
 * That is why the array handling moved into `getDataConfig` rather than being
 * deleted (it is a live convention in six sibling blocks — ObjectGrid's own
 * `getDataConfig`, ListView, ObjectTree, ObjectChart, ObjectDataTable,
 * calendar-view-renderer) or being papered over with a redundant dependency.
 *
 * These tests pin the behaviour the normalization must preserve, so a later
 * "simplification" of `getDataConfig` cannot quietly turn the shorthand into a
 * silently empty map.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ObjectMap } from './ObjectMap';
import type { DataSource } from '@object-ui/types';

vi.mock('react-map-gl/maplibre', () => ({
  default: (props: any) => <div aria-label="Map">{props.children}</div>,
  Map: ({ children }: any) => <div aria-label="Map">{children}</div>,
  NavigationControl: () => <div data-testid="nav-control" />,
  Marker: ({ children, longitude, latitude }: any) => (
    <div data-testid="map-marker" data-lat={latitude} data-lng={longitude}>
      {children}
    </div>
  ),
  Popup: ({ children }: any) => <div data-testid="map-popup">{children}</div>,
}));

const MAP_CONFIG = { latitudeField: 'latitude', longitudeField: 'longitude', titleField: 'name' };

const ROWS = [
  { id: '1', name: 'Loc 1', latitude: 40, longitude: -74 },
  { id: '2', name: 'Loc 2', latitude: 41, longitude: -75 },
];

const SECOND_ROWS = [{ id: '9', name: 'Loc 9', latitude: 51, longitude: -1 }];

const makeDataSource = (): DataSource =>
  ({
    find: vi.fn().mockResolvedValue({ data: [] }),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn().mockResolvedValue({ fields: {} }),
  }) as unknown as DataSource;

describe('ObjectMap — array-shorthand `schema.data` (objectui#5305)', () => {
  it('renders rows authored as a bare array under `data`', async () => {
    const schema: any = { type: 'object-map', map: MAP_CONFIG, data: ROWS };

    render(<ObjectMap schema={schema} />);

    await waitFor(() => expect(screen.queryByText('Loading map...')).toBeNull());
    await waitFor(() => expect(screen.getAllByTestId('map-marker')).toHaveLength(2));

    const markers = screen.getAllByTestId('map-marker');
    expect(markers[0]).toHaveAttribute('data-lat', '40');
    expect(markers[1]).toHaveAttribute('data-lng', '-75');
  });

  it('treats the shorthand as inline data — no `find`, no `getObjectSchema`', async () => {
    // The shorthand normalizes to `{ provider: 'value' }`, so it must take the
    // same no-fetch path the declared value provider takes. Before this change
    // the array left `dataConfig.provider` undefined, which made
    // `hasInlineData` false and sent the sibling effect off to fetch object
    // metadata whose only read site is the object-provider fetch branch this
    // schema never reaches.
    const dataSource = makeDataSource();
    const schema: any = {
      type: 'object-map',
      objectName: 'locations',
      map: MAP_CONFIG,
      data: ROWS,
    };

    render(<ObjectMap schema={schema} dataSource={dataSource} />);

    await waitFor(() => expect(screen.getAllByTestId('map-marker')).toHaveLength(2));
    await new Promise((r) => setTimeout(r, 0));

    expect(dataSource.find).not.toHaveBeenCalled();
    expect(dataSource.getObjectSchema).not.toHaveBeenCalled();
  });

  it('does not go stale — new authored rows re-run the effect', async () => {
    // The substance behind the `missing dependency` report. `schema.data` is
    // read only by `getDataConfig` now, and reaches the effect through the
    // `dataConfig` dependency, so a changed row set must still repaint.
    const schema: any = { type: 'object-map', map: MAP_CONFIG, data: ROWS };
    const { rerender } = render(<ObjectMap schema={schema} />);

    await waitFor(() => expect(screen.getAllByTestId('map-marker')).toHaveLength(2));

    rerender(<ObjectMap schema={{ ...schema, data: SECOND_ROWS }} />);

    await waitFor(() => expect(screen.getAllByTestId('map-marker')).toHaveLength(1));
    expect(screen.getAllByTestId('map-marker')[0]).toHaveAttribute('data-lat', '51');
  });

  it('leaves the declared `{ provider: value, items }` form untouched', async () => {
    const schema: any = {
      type: 'object-map',
      map: MAP_CONFIG,
      data: { provider: 'value', items: ROWS },
    };

    render(<ObjectMap schema={schema} />);

    await waitFor(() => expect(screen.queryByText('Loading map...')).toBeNull());
    await waitFor(() => expect(screen.getAllByTestId('map-marker')).toHaveLength(2));
  });

  it('still prefers the `data` PROP over an array-shorthand schema (objectui#5003 order)', async () => {
    const schema: any = { type: 'object-map', map: MAP_CONFIG, data: ROWS };

    render(<ObjectMap schema={schema} data={SECOND_ROWS} />);

    await waitFor(() => expect(screen.getAllByTestId('map-marker')).toHaveLength(1));
    expect(screen.getAllByTestId('map-marker')[0]).toHaveAttribute('data-lat', '51');
  });
});
