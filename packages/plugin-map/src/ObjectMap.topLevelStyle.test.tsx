/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `BaseSchema.style` is inline CSS and NEVER a MapLibre style (objectui#5017).
 *
 * `getMapConfig` used to resolve the map style from three spellings with the
 * top-level `style` FIRST:
 *
 *     (schema as any).style || schema.mapStyle || schema.map?.style
 *
 * `style` is declared on the base face as a record of CSS properties
 * (`packages/types/src/zod/base.zod.ts`), which every node may legally carry, so
 * `style: { height: '400px' }` on a map node was handed to MapGL's `mapStyle`
 * prop — unvalidated (the `safeParse` only ever looked at `schema.map`) and
 * undiagnosed. `@object-ui/types` had already named the map's key `mapStyle`
 * (NOT `style`) to avoid precisely this collision, so the consumer was
 * contradicting the declaration it was named after.
 *
 * What this file pins is the invariant, not the implementation: a CSS-meaning
 * `style` is never consumed as a map style. That survives whatever
 * canonicalization objectui#5018's follow-ups settle on, because it is a
 * statement about the OTHER key.
 *
 * The string half matters just as much and is easy to lose: `ObjectView` /
 * `ListView` flatten `options.map`'s CONTENTS to the top level, so a view
 * authored with `map: { style: '<url>' }` reaches this component as a top-level
 * STRING `style`. That shape is not spec-authorable — `@objectstack/spec@17`'s
 * list-view schemas are strict and declare no `map` block at all, so a view
 * carrying one fails validation with `unrecognized_keys` — but it IS
 * runtime-reachable, which is why it gets a dev diagnostic rather than silence.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ObjectMap } from './ObjectMap';

let capturedProps: any = null;

vi.mock('react-map-gl/maplibre', () => ({
  default: (props: any) => {
    capturedProps = props;
    return <div aria-label="Map">{props.children}</div>;
  },
  Map: ({ children }: any) => <div aria-label="Map">{children}</div>,
  NavigationControl: () => <div data-testid="nav-control" />,
  Marker: ({ children }: any) => <div data-testid="map-marker">{children}</div>,
  Popup: ({ children }: any) => <div data-testid="map-popup">{children}</div>,
}));

const DEMO_STYLE = 'https://demotiles.maplibre.org/style.json';
const mockData = [{ id: '1', name: 'Loc 1', latitude: 40, longitude: -74 }];
const DECLARED_MAP = {
  latitudeField: 'latitude',
  longitudeField: 'longitude',
  titleField: 'name',
};

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  capturedProps = null;
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

async function renderMap(schema: any) {
  render(<ObjectMap schema={schema} />);
  await waitFor(() => expect(screen.queryByText('Loading map...')).toBeNull());
}

/** The warnings this file cares about, one string per call. */
function styleWarnings(): string[] {
  return (warnSpy.mock.calls as unknown[][])
    .map((args): string => String(args[0]))
    .filter((msg: string) => msg.includes('objectui#5017'));
}

describe('ObjectMap — top-level `style` is inline CSS, not a map style (objectui#5017)', () => {
  it('never hands a CSS-meaning `style` object to MapGL', async () => {
    await renderMap({
      type: 'map',
      // Legal `BaseSchema.style`: a record of CSS properties. Every node may
      // carry it. Before #5017 this exact object became MapGL's `mapStyle`.
      style: { height: '400px', border: '1px solid red' },
      map: DECLARED_MAP,
      data: { provider: 'value', items: mockData },
    });

    expect(capturedProps.mapStyle).toBe(DEMO_STYLE);
    expect(typeof capturedProps.mapStyle).toBe('string');
  });

  it('does not let a CSS-meaning `style` outrank the declared `mapStyle`', async () => {
    await renderMap({
      type: 'map',
      style: { height: '400px' },
      mapStyle: 'https://tiles.example.com/style.json',
      map: DECLARED_MAP,
      data: { provider: 'value', items: mockData },
    });

    expect(capturedProps.mapStyle).toBe('https://tiles.example.com/style.json');
  });

  it('does not let a CSS-meaning `style` outrank the declared `map.style`', async () => {
    await renderMap({
      type: 'map',
      style: { height: '400px' },
      map: { ...DECLARED_MAP, style: 'https://tiles.example.com/style.json' },
      data: { provider: 'value', items: mockData },
    });

    expect(capturedProps.mapStyle).toBe('https://tiles.example.com/style.json');
  });

  it('says nothing about a legal inline-CSS `style` — dropping it IS the fix', async () => {
    await renderMap({
      type: 'map',
      style: { height: '400px' },
      map: DECLARED_MAP,
      data: { provider: 'value', items: mockData },
    });

    expect(styleWarnings()).toEqual([]);
  });

  it('drops a top-level STRING `style` and says so, naming both declared spellings', async () => {
    await renderMap({
      type: 'map',
      style: 'https://tiles.example.com/style.json',
      map: DECLARED_MAP,
      data: { provider: 'value', items: mockData },
    });

    expect(capturedProps.mapStyle).toBe(DEMO_STYLE);

    const warnings = styleWarnings();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('https://tiles.example.com/style.json');
    expect(warnings[0]).toContain('mapStyle');
    expect(warnings[0]).toContain('map: { style:');
  });

  it('warns once per distinct dropped URL, not once per render', async () => {
    const schema = {
      type: 'map',
      style: 'https://repeat.example.com/style.json',
      map: DECLARED_MAP,
      data: { provider: 'value', items: mockData },
    };
    await renderMap(schema);
    await renderMap(schema);

    expect(styleWarnings()).toHaveLength(1);
  });

  it('leaves the two declared spellings untouched', async () => {
    await renderMap({
      type: 'map',
      mapStyle: 'https://top.example.com/style.json',
      map: DECLARED_MAP,
      data: { provider: 'value', items: mockData },
    });
    expect(capturedProps.mapStyle).toBe('https://top.example.com/style.json');

    await renderMap({
      type: 'map',
      map: { ...DECLARED_MAP, style: 'https://block.example.com/style.json' },
      data: { provider: 'value', items: mockData },
    });
    expect(capturedProps.mapStyle).toBe('https://block.example.com/style.json');
  });
});

/**
 * The producer-side shape, pinned on the consumer side.
 *
 * `ObjectView.generateViewSchema('map')` / `ListView`'s `case 'map'` build their
 * `object-map` schema as `{ type: 'object-map', ...baseProps, locationField,
 * ...(options.map || {}) }` — the CONTENTS of the `map` block at the top level
 * and no `map` key at all. That product shape is pinned at the producer by
 * `plugin-view/src/__tests__/ObjectView.mapFlatten.test.tsx` (objectui#5018);
 * measured against this branch it flattens `map: { style: '<url>' }` into a
 * top-level string `style`, and `map: { mapStyle: '<url>' }` into a top-level
 * `mapStyle`.
 *
 * So this describe block feeds those two literal products to the consumer. It is
 * the half the producer's pin cannot state: what the flattened key MEANS once it
 * arrives. Without it, #5017's deletion looks like a pure subtraction with no
 * reachable caller — it is not; the caller is spec-invalid, not absent.
 */
describe('ObjectMap — the ObjectView/ListView flatten product (objectui#5017)', () => {
  it('ignores the `style` a flattened `map: { style }` lands at the top level', async () => {
    await renderMap({
      type: 'object-map',
      objectName: 'store',
      className: 'h-full w-full',
      locationField: 'location',
      latitudeField: 'latitude',
      longitudeField: 'longitude',
      // `...(options.map || {})` put the block's `style` here.
      style: 'https://flattened.example.com/style.json',
      data: { provider: 'value', items: mockData },
    });

    expect(capturedProps.mapStyle).toBe(DEMO_STYLE);
    expect(styleWarnings()).toHaveLength(1);
    expect(styleWarnings()[0]).toContain('options.map` is FLATTENED');
  });

  it('honours the flattened `mapStyle`, which is the spelling that survives', async () => {
    await renderMap({
      type: 'object-map',
      objectName: 'store',
      className: 'h-full w-full',
      locationField: 'location',
      latitudeField: 'latitude',
      longitudeField: 'longitude',
      // `map: { mapStyle: '<url>' }` on the view flattens to exactly this.
      mapStyle: 'https://flattened.example.com/style.json',
      data: { provider: 'value', items: mockData },
    });

    expect(capturedProps.mapStyle).toBe('https://flattened.example.com/style.json');
    expect(styleWarnings()).toEqual([]);
  });
});
