/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#5177 — `ListView`'s `case 'map'` flattener used to be a WHOLE-BAG
 * spread (`...(schema.options?.map || {})`), so any key an author wrote in
 * the `map` block landed at the top level of the `object-map` schema it
 * builds — including keys `ObjectMap`'s `FlatMapConfigKeys = Omit<
 * ObjectMapConfig, 'style' >` declares OUT of this flat form. `style` is the
 * specimen the card measured: it is ALSO `BaseSchema.style` (inline CSS,
 * legal on every node), so a `map: { style: '<url>' }` authoring intent
 * arrived at the top level as that CSS-shaped key.
 *
 * These pin the whitelist (`FLAT_MAP_CONFIG_KEYS`, hand-listed in
 * `ListView.tsx` itself — see the comment on that constant for why it is not
 * derived from `ObjectMapConfigSchema` at runtime there) rather than the raw
 * spread: a declared key still travels, `style` does not, and neither does an
 * arbitrary undeclared one. The bottom of this file also pins the hand list
 * against `ObjectMapConfigSchema` directly, so it cannot silently drift.
 * Mirrors `ObjectView.mapFlatten.test.tsx`'s #5177 coverage for the sibling
 * flattener.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';
import { render, waitFor } from '@testing-library/react';
import { ListView, FLAT_MAP_CONFIG_KEYS } from '../ListView';
import { SchemaRendererProvider } from '@object-ui/react';
// Test-only: `ListView.tsx` hand-lists `FLAT_MAP_CONFIG_KEYS` rather than
// importing this schema at runtime, precisely so this module never appears in
// `examples/console-starter`'s walked import graph (see the comment on the
// constant). A test file is explicitly excluded from that walk, so pinning
// against the real declaration HERE is safe.
import { ObjectMapConfigSchema } from '@object-ui/types/zod';

let captured: Array<Record<string, any>> = [];

ComponentRegistry.register(
  'object-map',
  (props: Record<string, any>) => {
    captured.push(props);
    return <div data-testid="map-spy" />;
  },
  { namespace: 'test', label: 'Map spy', category: 'view' },
);

const makeDataSource = () => ({
  find: vi.fn().mockResolvedValue([]),
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getObjectSchema: vi.fn().mockResolvedValue({ name: 'store', fields: {} }),
});

const BASE = {
  type: 'list-view',
  objectName: 'store',
  viewType: 'map',
  columns: ['name'],
} as const;

/** Mount ListView on a `map`-typed view and return the schema handed to `object-map`. */
async function mapSchemaFor(mapOptions: Record<string, unknown>) {
  captured = [];
  const dataSource = makeDataSource() as any;
  render(
    <SchemaRendererProvider dataSource={dataSource}>
      <ListView
        schema={{ ...BASE, options: { map: mapOptions } } as never}
        dataSource={dataSource}
      />
    </SchemaRendererProvider>,
  );
  await waitFor(() => expect(captured.length).toBeGreaterThan(0));
  return captured[captured.length - 1].schema as Record<string, unknown>;
}

describe('ListView flattens `options.map` through a whitelist, not a raw spread (objectui#5177)', () => {
  beforeEach(() => {
    captured = [];
  });

  it('produces an object-map schema and still reaches a declared key', async () => {
    const schema = await mapSchemaFor({ latitudeField: 'lat', longitudeField: 'lng' });

    expect(schema.type).toBe('object-map');
    expect(schema.latitudeField).toBe('lat');
    expect(schema.longitudeField).toBe('lng');
  });

  it('does NOT let `style` in the `map` block reach the top level — the specimen the card measured', async () => {
    const schema = await mapSchemaFor({
      latitudeField: 'lat',
      longitudeField: 'lng',
      style: 'https://tiles.example.com/style.json',
    });

    expect(schema.latitudeField).toBe('lat');
    expect(schema.style).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(schema, 'style')).toBe(false);
  });

  it('does NOT let an arbitrary undeclared key reach the top level', async () => {
    const schema = await mapSchemaFor({ latitudeField: 'lat', totallyUndeclaredKey: 'nope' });

    expect(schema.latitudeField).toBe('lat');
    expect(schema.totallyUndeclaredKey).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(schema, 'totallyUndeclaredKey')).toBe(false);
  });

  it('still emits the `locationField` default when nothing is configured', async () => {
    const schema = await mapSchemaFor({});

    expect(schema.locationField).toBe('location');
  });
});

/**
 * `FLAT_MAP_CONFIG_KEYS` is hand-listed in `ListView.tsx` itself (not derived
 * at runtime — see the comment on the constant for why), so THIS is the
 * mechanism that keeps it from silently drifting off `ObjectMapConfigSchema`
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
