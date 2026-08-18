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
import { ObjectView, FLAT_MAP_CONFIG_KEYS } from '../ObjectView';
import type { ObjectViewSchema } from '@object-ui/types';
// Test-only: `ObjectView.tsx` hand-lists `FLAT_MAP_CONFIG_KEYS` rather than
// importing this schema at runtime, precisely so this module never appears in
// `examples/console-starter`'s walked import graph (see the comment on the
// constant). A test file is explicitly excluded from that walk, so pinning
// against the real declaration HERE is safe.
import { ObjectMapConfigSchema } from '@object-ui/types/zod';

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

/**
 * objectui#5177 — the flatten above used to be a WHOLE-BAG spread
 * (`...(viewOptions.map || {})`), so any key an author wrote in the `map`
 * block landed at the top level, including keys `ObjectMap`'s
 * `FlatMapConfigKeys = Omit<ObjectMapConfig, 'style'>` declares OUT of this
 * flat form. `style` is the specimen the card measured: it collides with
 * `BaseSchema.style` (inline CSS, legal on every node), so a `map: { style:
 * '<url>' }` authoring intent arrived as a top-level CSS-shaped key.
 *
 * These pin the whitelist (`FLAT_MAP_CONFIG_KEYS`, derived from
 * `ObjectMapConfigSchema` in `@object-ui/types/zod`) rather than the raw
 * spread: a declared key still travels, `style` does not, and neither does an
 * arbitrary undeclared one.
 */
describe('ObjectView flattens `map` through a whitelist, not a raw spread (objectui#5177)', () => {
  it('still reaches a declared key (locationField) in the flattened product', async () => {
    const schema = await renderMapView({ locationField: 'geo' });

    expect(schema.locationField).toBe('geo');
  });

  it('does NOT let `style` in the `map` block reach the top level — the specimen the card measured', async () => {
    const schema = await renderMapView({
      latitudeField: 'lat',
      longitudeField: 'lng',
      style: 'https://tiles.example.com/style.json',
    });

    expect(schema.latitudeField).toBe('lat');
    expect(schema.style).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(schema, 'style')).toBe(false);
  });

  it('does NOT let an arbitrary undeclared key reach the top level', async () => {
    const schema = await renderMapView({
      latitudeField: 'lat',
      totallyUndeclaredKey: 'nope',
    });

    expect(schema.latitudeField).toBe('lat');
    expect(schema.totallyUndeclaredKey).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(schema, 'totallyUndeclaredKey')).toBe(false);
  });
});

/**
 * `FLAT_MAP_CONFIG_KEYS` is hand-listed in `ObjectView.tsx` itself (not
 * derived at runtime — see the comment on the constant for why), so THIS is
 * the mechanism that keeps it from silently drifting off `ObjectMapConfigSchema`
 * — the same role `packages/core/src/actions/__tests__/actionKeys.pin.test.ts`
 * plays for `SPEC_ACTION_KEYS`. A key added to or removed from the schema
 * fails this test by name, without requiring a runtime import of
 * `@object-ui/types/zod` from production code that reaches
 * `examples/console-starter`.
 */
describe('FLAT_MAP_CONFIG_KEYS pins against ObjectMapConfigSchema (objectui#5177)', () => {
  it('matches the schema minus `style`, so the hand list cannot silently drift', () => {
    const declared = Object.keys(ObjectMapConfigSchema.shape)
      .filter((key) => key !== 'style')
      .sort();
    expect([...FLAT_MAP_CONFIG_KEYS].sort()).toEqual(declared);
  });
});
