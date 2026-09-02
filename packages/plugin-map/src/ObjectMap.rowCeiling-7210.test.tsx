/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#7210, half 2 — maintainer ruling a′ (2026-09-02), on the map.
 *
 * The map's own defence — it auto-clusters above 100 markers — is exactly what
 * makes a silent cut invisible here: cluster bubbles redraw at whatever counts
 * they are given, so a map of the first N of a much larger set is a plausible
 * map with plausible bubbles, and its CAMERA is fitted to a bounding box that
 * is not the data's. The footnote is the only thing that says so.
 *
 * ⚠️ Environment: jsdom, with `react-map-gl/maplibre` stubbed the way the
 * sibling ObjectMap tests stub it (no WebGL in this lane). Nothing asserted
 * here depends on container size or on the real map's viewport — the note is a
 * sibling in the component's own tree, present or absent regardless of layout.
 *
 * REVERSE VERIFICATION — direction predicted before running: removing
 * `$top: NON_GRID_ROW_CEILING_TOP` from `ObjectMap`'s fetch turns the
 * truncation case red at the footnote assertion, while the below-ceiling case
 * stays green.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NON_GRID_ROW_CEILING, NON_GRID_ROW_CEILING_TOP } from '@object-ui/react';
import { ObjectMap } from './ObjectMap';

vi.mock('react-map-gl/maplibre', () => ({
  default: ({ children }: any) => <div aria-label="Map">{children}</div>,
  Map: ({ children }: any) => <div aria-label="Map">{children}</div>,
  NavigationControl: () => <div data-testid="nav-control" />,
  Marker: ({ children }: any) => <div data-testid="map-marker">{children}</div>,
  Popup: ({ children }: any) => <div data-testid="map-popup">{children}</div>,
}));

const TOTAL_ROWS = 6543;

function makeRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: String(i + 1),
    name: `Place ${i + 1}`,
    latitude: -80 + ((i * 37) % 160),
    longitude: -179 + ((i * 53) % 358),
  }));
}

function makeDataSource(storeSize: number, calls: Array<Record<string, any>>) {
  const store = makeRows(storeSize);
  return {
    find: vi.fn(async (_resource: string, params: any) => {
      calls.push({ ...(params ?? {}) });
      const top = typeof params?.$top === 'number' ? params.$top : store.length;
      return { data: store.slice(0, top), total: store.length };
    }),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn(async () => ({
      name: 'store',
      fields: {
        id: { name: 'id', type: 'text' },
        name: { name: 'name', type: 'text' },
        latitude: { name: 'latitude', type: 'number' },
        longitude: { name: 'longitude', type: 'number' },
      },
    })),
  } as any;
}

const schema: any = {
  type: 'map',
  objectName: 'store',
  map: { latitudeField: 'latitude', longitudeField: 'longitude', titleField: 'name' },
  data: { provider: 'object', object: 'store' },
};

describe('objectui#7210 ruling a′ — the map caps at the platform ceiling, loudly', () => {
  it('above the ceiling: the query stops at the ceiling and BOTH numbers are named', async () => {
    const calls: Array<Record<string, any>> = [];
    const dataSource = makeDataSource(TOTAL_ROWS, calls);

    render(<ObjectMap schema={schema} dataSource={dataSource} />);

    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    for (const params of calls) {
      expect(params.$top).toBe(NON_GRID_ROW_CEILING_TOP);
    }

    const note = await screen.findByRole('note');
    expect(note.getAttribute('data-row-ceiling-note')).toBe('non-grid');
    expect(note.getAttribute('data-ceiling-drawn')).toBe(String(NON_GRID_ROW_CEILING));
    expect(note.getAttribute('data-ceiling-total')).toBe(String(TOTAL_ROWS));
    expect(note.textContent).toContain(String(NON_GRID_ROW_CEILING));
    expect(note.textContent).toContain(String(TOTAL_ROWS));
  });

  it('below the ceiling: there is NO footnote', async () => {
    const calls: Array<Record<string, any>> = [];
    const dataSource = makeDataSource(20, calls);

    render(<ObjectMap schema={schema} dataSource={dataSource} />);

    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.queryByText(/Loading map/i)).toBeNull());
    expect(screen.queryByRole('note')).toBeNull();
  });
});
