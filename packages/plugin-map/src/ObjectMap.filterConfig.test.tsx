/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `filter` is the query filter — NOT a container for the map's configuration
 * (objectui#4034, source thread objectstack#7138).
 *
 * `getMapConfig` used to probe every filter for a `map` key and, on a hit, use
 * it as the MapConfig (`schema.filter.map` / `schema.filter.map.style`) — a
 * shape that predates the declared `{ name: 'map', type: 'object' }` input. Two
 * readings of `filter` in one block; the declared one is `schema.map`.
 *
 * The probe was written as `'map' in schema.filter`, and `in` walks the
 * PROTOTYPE CHAIN — so for the ordinary array-shaped filter it matched
 * `Array.prototype.map` and handed the component a *function* as its map
 * config. Spreading a function yields `{}`, so the declared `schema.map` was
 * dropped on the floor and every record failed `extractCoordinates`: a map with
 * both `filter` and `map` authored rendered ZERO markers, silently. That is the
 * live half of this card — reachable through fully documented authoring, not
 * only through the legacy shape.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ObjectMap } from './ObjectMap';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';

// Registers `object-map` + the ElementDataSourceGate wiring (objectstack#7121).
// Imported at module scope, not in a hook: the binding case below renders
// through the registry (AGENTS.md — dynamic import in a hook is lint-blocked).
import './index';

let capturedProps: any = null;

vi.mock('react-map-gl/maplibre', () => ({
  default: (props: any) => {
    capturedProps = props;
    return <div aria-label="Map">{props.children}</div>;
  },
  Map: ({ children }: any) => <div aria-label="Map">{children}</div>,
  NavigationControl: () => <div data-testid="nav-control" />,
  Marker: ({ children, longitude, latitude }: any) => (
    <div data-testid="map-marker" data-lat={latitude} data-lng={longitude}>
      {children}
    </div>
  ),
  Popup: ({ children }: any) => <div data-testid="map-popup">{children}</div>,
}));

/** Rows whose coordinates live under NON-default field names. */
const ROWS = [{ id: '1', name: 'HQ', lat: 40, lng: -74 }];
/** The same place, spelled the way the DEFAULT config expects. */
const ROWS_DEFAULT_SPELLING = [{ id: '1', name: 'HQ', latitude: 40, longitude: -74 }];

const DECLARED_MAP = { latitudeField: 'lat', longitudeField: 'lng', titleField: 'name' };

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  capturedProps = null;
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

const renderMap = async (schema: Record<string, unknown>) => {
  const utils = render(<ObjectMap schema={schema as any} />);
  await waitFor(() => expect(screen.queryByText('Loading map...')).toBeNull());
  return utils;
};

const warnings = () => warnSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');

// ---------------------------------------------------------------------------
// (a) The legacy shape is no longer consumed — and does not vanish silently.
// ---------------------------------------------------------------------------
describe('legacy `filter.map` is not map configuration (objectui#4034)', () => {
  it('ignores a MapConfig stashed under `filter.map` and falls to the default config', async () => {
    await renderMap({
      type: 'object-map',
      data: { provider: 'value', items: ROWS },
      filter: { map: DECLARED_MAP },
    });

    // The stash named `lat`/`lng`; it is not read, so the default config
    // (`latitude`/`longitude`) applies and finds no coordinates on these rows.
    expect(screen.queryAllByTestId('map-marker')).toHaveLength(0);
  });

  it('really is the DEFAULT config that applies, not "no config at all"', async () => {
    await renderMap({
      type: 'object-map',
      data: { provider: 'value', items: ROWS_DEFAULT_SPELLING },
      filter: { map: { latitudeField: 'lat', longitudeField: 'lng' } },
    });

    // Same legacy stash, rows spelled the default way: the default config is
    // live and places the marker. (Pre-fix this rendered nothing — the stash
    // won and looked for `lat`/`lng`.)
    const markers = screen.getAllByTestId('map-marker');
    expect(markers).toHaveLength(1);
    expect(markers[0]).toHaveAttribute('data-lat', '40');
  });

  it('warns in dev, naming the legacy shape and pointing at `schema.map`', async () => {
    await renderMap({
      type: 'object-map',
      data: { provider: 'value', items: ROWS },
      filter: { map: { titleField: 'name', zoom: 4 } },
    });

    expect(warnSpy).toHaveBeenCalled();
    expect(warnings()).toContain('[ObjectMap]');
    expect(warnings()).toContain('filter.map');
    expect(warnings()).toContain('schema.map');
    expect(warnings()).toContain('objectui#4034');
  });

  it('stops reading the `filter.map.style` half too', async () => {
    await renderMap({
      type: 'object-map',
      data: { provider: 'value', items: ROWS_DEFAULT_SPELLING },
      filter: { map: { style: 'https://legacy.example.com/style.json' } },
    });

    expect(capturedProps.mapStyle).toBe('https://demotiles.maplibre.org/style.json');
  });
});

// ---------------------------------------------------------------------------
// (b) Control — the declared shape keeps working, green on both sides.
// ---------------------------------------------------------------------------
describe('the declared `map` input is what configures the map (control)', () => {
  it('applies `schema.map` and places the marker', async () => {
    await renderMap({
      type: 'object-map',
      data: { provider: 'value', items: ROWS },
      map: DECLARED_MAP,
    });

    const markers = screen.getAllByTestId('map-marker');
    expect(markers).toHaveLength(1);
    expect(markers[0]).toHaveAttribute('data-lat', '40');
    expect(markers[0]).toHaveAttribute('data-lng', '-74');
  });

  it('reads `map.style`, and says nothing about a schema with no legacy shape', async () => {
    await renderMap({
      type: 'object-map',
      data: { provider: 'value', items: ROWS },
      map: { ...DECLARED_MAP, style: 'https://tiles.example.com/style.json' },
    });

    expect(capturedProps.mapStyle).toBe('https://tiles.example.com/style.json');
    expect(warnings()).not.toContain('[ObjectMap]');
  });

  it('keeps the top-level `latitudeField` branch intact', async () => {
    await renderMap({
      type: 'object-map',
      data: { provider: 'value', items: ROWS },
      latitudeField: 'lat',
      longitudeField: 'lng',
      titleField: 'name',
    });

    expect(screen.getAllByTestId('map-marker')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// (c) Control — `filter` keeps its ONE meaning: it filters. Untouched by the fix.
// ---------------------------------------------------------------------------
describe('`filter` still reaches the query unchanged (control)', () => {
  const makeDataSource = () => ({
    find: vi.fn().mockResolvedValue({ data: [] }),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn().mockResolvedValue({ name: 'store', fields: {} }),
  });

  const sentFilter = async (filter: unknown) => {
    const ds = makeDataSource();
    render(
      <ObjectMap
        schema={{ type: 'object-map', objectName: 'store', map: DECLARED_MAP, filter } as any}
        dataSource={ds as any}
      />,
    );
    await waitFor(() => expect(ds.find).toHaveBeenCalled());
    return (ds.find.mock.calls[0] as [string, any])[1].$filter;
  };

  it('passes an array filter through verbatim', async () => {
    expect(await sentFilter([['owner', '=', 'me']])).toEqual([['owner', '=', 'me']]);
  });

  it('passes an object filter through verbatim', async () => {
    expect(await sentFilter({ status: 'active' })).toEqual({ status: 'active' });
  });

  it('does NOT strip a `map` key out of the filter — the filter is the author’s', async () => {
    // The block stops *interpreting* `filter.map` as configuration; it does not
    // rewrite the query. A field genuinely named `map` still filters on it.
    expect(await sentFilter({ map: { latitudeField: 'lat' } })).toEqual({
      map: { latitudeField: 'lat' },
    });
  });
});

// ---------------------------------------------------------------------------
// (d) The live defect + the post-#7121 merged-`and` binding path.
// ---------------------------------------------------------------------------
describe('an ordinary filter no longer eats the map config', () => {
  it('applies `schema.map` when an array filter is authored alongside it', async () => {
    await renderMap({
      type: 'object-map',
      data: { provider: 'value', items: ROWS },
      map: DECLARED_MAP,
      filter: [['owner', '=', 'me']],
    });

    // Pre-fix: `'map' in [...]` matched `Array.prototype.map`, the config became
    // the spread of a function (`{}`), and this rendered zero markers.
    const markers = screen.getAllByTestId('map-marker');
    expect(markers).toHaveLength(1);
    expect(markers[0]).toHaveAttribute('data-lat', '40');
  });

  it('does not warn about a filter that merely has array-ness (no own `map` key)', async () => {
    await renderMap({
      type: 'object-map',
      data: { provider: 'value', items: ROWS },
      map: DECLARED_MAP,
      filter: [['owner', '=', 'me']],
    });

    expect(warnings()).not.toContain('[ObjectMap]');
  });

  it('survives the merged `and` node a dataSource binding produces (objectstack#7121)', async () => {
    const adapter = {
      find: vi.fn().mockResolvedValue({ data: ROWS }),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getObjectSchema: vi.fn().mockResolvedValue({
        name: 'store',
        fields: { name: { type: 'text' }, rating: { type: 'text' } },
        listViews: { hot: { name: 'hot', label: 'Hot', filter: [['rating', '=', 'hot']] } },
      }),
    };

    render(
      <SchemaRendererProvider dataSource={adapter as any}>
        <SchemaRenderer
          schema={
            {
              type: 'object-map',
              map: DECLARED_MAP,
              filter: [['owner', '=', 'me']],
              dataSource: { object: 'store', view: 'hot' },
            } as any
          }
        />
      </SchemaRendererProvider>,
    );

    await waitFor(() => expect(adapter.find).toHaveBeenCalled());
    const sent = (adapter.find.mock.calls[0] as [string, any])[1].$filter;

    // Measured shape of the merge (objectstack#7121 + `mergeFilterNodes`):
    expect(sent).toEqual(['and', [['owner', '=', 'me']], [['rating', '=', 'hot']]]);

    // Exactly why the deleted probe misfired, pinned so it cannot come back:
    // the merged node has NO own `map` key, yet `'map' in` it is true.
    expect(Object.prototype.hasOwnProperty.call(sent, 'map')).toBe(false);
    expect('map' in (sent as object)).toBe(true);

    // …and the declared config still reaches the markers.
    await waitFor(() => expect(screen.getAllByTestId('map-marker')).toHaveLength(1));
    expect(screen.getAllByTestId('map-marker')[0]).toHaveAttribute('data-lat', '40');
    expect(warnings()).not.toContain('[ObjectMap]');
  });
});
