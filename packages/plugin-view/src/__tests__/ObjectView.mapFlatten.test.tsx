/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The map schema this view PRODUCES — and the one property that makes
 * objectui#5018's precedence flip safe.
 *
 * `generateViewSchema('map')` builds an `object-map` schema by spreading the
 * CONTENTS of `options.map` at the top level (plus a `locationField` that always
 * falls back to `'location'`). The product therefore carries the flat spelling
 * and **no `map` key at all**.
 *
 * That is load-bearing, not incidental. The maintainer ruling on objectui#5018
 * (2026-08-17, 「同意」) made the `map` block outrank the flat spelling inside
 * `ObjectMap.getMapConfig`, reversing the previous order. The flip can only
 * change what a view renders if some schema carries BOTH spellings — so the
 * question "is the flip safe for the producer path" reduces exactly to "does the
 * flattener emit a `map` key", and the answer is pinned here rather than left to
 * be re-derived by whoever next edits this branch.
 *
 * If a future change makes this branch emit `map: {...}` (a reasonable-looking
 * cleanup!), the flat keys it emits alongside would become silently ignored
 * shadows. This test goes red first, which is the point.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ObjectView } from '../ObjectView';
import type { ObjectViewSchema } from '@object-ui/types';

/** Every schema the view hands to SchemaRenderer, in order. */
const rendered: any[] = [];

vi.mock('@object-ui/react', async () => {
  const React = await import('react');
  return {
    SchemaRenderer: ({ schema }: any) => {
      rendered.push(schema);
      return <div data-testid="schema-renderer">{schema?.type}</div>;
    },
    SchemaRendererContext: React.createContext(null),
    subscribeDataChanges: () => () => {},
    notifyDataChanged: () => {},
  };
});
vi.mock('@object-ui/plugin-grid', () => ({ ObjectGrid: () => <div data-testid="object-grid" /> }));
vi.mock('@object-ui/plugin-form', () => ({ ObjectForm: () => <div data-testid="object-form" /> }));

async function renderMapView(mapOptions: Record<string, unknown>) {
  rendered.length = 0;
  const ds: any = {
    find: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn().mockResolvedValue({ name: 'store', fields: {} }),
  };
  render(
    <ObjectView
      schema={{ type: 'object-view', objectName: 'store' } as ObjectViewSchema}
      views={[{ id: 'm', label: 'Map', type: 'map' as any, map: mapOptions }]}
      dataSource={ds}
    />,
  );
  await waitFor(() => expect(rendered.length).toBeGreaterThan(0));
  return rendered[rendered.length - 1];
}

describe('ObjectView flattens `options.map` and emits NO `map` key (objectui#5018)', () => {
  it('produces an object-map schema carrying the FLAT spelling', async () => {
    const schema = await renderMapView({
      latitudeField: 'lat',
      longitudeField: 'lng',
      titleField: 'store_name',
    });

    expect(schema.type).toBe('object-map');
    expect(schema.latitudeField).toBe('lat');
    expect(schema.longitudeField).toBe('lng');
    expect(schema.titleField).toBe('store_name');
  });

  it('emits no `map` key, so the `map`-block-wins rule cannot shadow it', async () => {
    const schema = await renderMapView({
      latitudeField: 'lat',
      longitudeField: 'lng',
    });

    expect(Object.prototype.hasOwnProperty.call(schema, 'map')).toBe(false);
    expect(schema.map).toBeUndefined();
  });

  it('still emits the `locationField` default when nothing is configured', async () => {
    const schema = await renderMapView({});

    expect(schema.locationField).toBe('location');
    expect(Object.prototype.hasOwnProperty.call(schema, 'map')).toBe(false);
  });
});
