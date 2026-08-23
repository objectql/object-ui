// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * objectui#5042, the interface-page seam.
 *
 * `ListView` learned to read the spec's view-level `map` block
 * (`ListMapConfigSchema`), but an ADR-0047 interface page builds the list-view
 * schema itself, and its map binding was assembled from `options.map` alone:
 *
 *     const mapCfg = (view.options as any)?.map ?? (allowedSet.has('map') ? … )
 *
 * So a referenced view declaring the typed block had it dropped one seam ABOVE
 * `ListView`, and the auto-derivation silently stood in for it — the same
 * declared-but-inert shape the card is about, on the path the showcase map page
 * actually renders through.
 *
 * The block is forwarded as `map` rather than folded into `mapCfg` with `??`
 * like the sibling bindings, and the third case here is why: `??` would let a
 * PARTIAL authored block replace the derivation wholesale, so
 * `map: { titleField: 'title' }` alone would drop the auto-derived
 * `locationField` and the page would render no markers at all. Forwarding both
 * lets `ListView` merge them per key, which is the precedence the card settled.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  useNavigate: () => vi.fn(),
}));

vi.mock('@object-ui/i18n', async (importOriginal) => {
  const actual = await (importOriginal as any)();
  return {
    ...actual,
    useObjectTranslation: () => ({ t: (_k: string, o?: any) => o?.defaultValue ?? _k }),
  };
});

vi.mock('@object-ui/auth', async (importOriginal) => {
  const actual = await (importOriginal as any)();
  return { ...actual, useAuth: () => ({}) };
});

// Only the map-config half of the schema this page builds is under test.
vi.mock('@object-ui/plugin-list', () => ({
  ListView: (props: any) => (
    <div
      data-testid="list-view-map-config"
      data-map={JSON.stringify(props?.schema?.map ?? null)}
      data-options-map={JSON.stringify(props?.schema?.options?.map ?? null)}
    />
  ),
}));

let testDataSource: any;
let testObjects: any[];

vi.mock('@object-ui/react', async (importOriginal) => {
  const actual = await (importOriginal as any)();
  return {
    ...actual,
    useAdapter: () => testDataSource,
    useMetadata: () => ({ objects: testObjects }),
  };
});

import { InterfaceListPage } from './InterfaceListPage';

const OBJECT_NAME = 'showcase_task';
const VIEW_ID = `${OBJECT_NAME}.work_map`;

/** An object with a location-typed field, so `defaultMapFromObject` can derive. */
const makeObjectDef = (view: Record<string, unknown>) => ({
  name: OBJECT_NAME,
  fields: {
    title: { type: 'text' },
    location: { type: 'location' },
  },
  listViews: {
    [VIEW_ID]: { name: VIEW_ID, type: 'map', columns: ['title', 'location'], ...view },
  },
});

const page = {
  name: 'showcase_task_map',
  label: 'Work Map',
  interfaceConfig: {
    source: OBJECT_NAME,
    sourceView: 'work_map',
    recordAction: 'none',
    appearance: { allowedVisualizations: ['map'] },
  },
};

async function renderWith(view: Record<string, unknown>) {
  testDataSource = {};
  testObjects = [makeObjectDef(view)];
  render(<InterfaceListPage page={page as any} />);
  await waitFor(() => expect(screen.queryByTestId('list-view-map-config')).not.toBeNull());
  const el = screen.getByTestId('list-view-map-config');
  return {
    map: JSON.parse(el.getAttribute('data-map') || 'null'),
    optionsMap: JSON.parse(el.getAttribute('data-options-map') || 'null'),
  };
}

describe('InterfaceListPage forwards the view-level `map` block (objectui#5042)', () => {
  beforeEach(() => {
    testDataSource = undefined;
    testObjects = [];
  });

  // THE DISCRIMINATING ARM — before the fix `map` was `null` here.
  it('forwards the referenced view’s spec `map` block verbatim', async () => {
    const { map } = await renderWith({
      map: { locationField: 'location', titleField: 'title', zoom: 9 },
    });

    expect(map).toEqual({ locationField: 'location', titleField: 'title', zoom: 9 });
  });

  it('CONTROL: with no view-level block, no `map` key is emitted at all', async () => {
    const { map, optionsMap } = await renderWith({});

    expect(map).toBeNull();
    // …and the ADR-0047 auto-derivation still fires, unchanged.
    expect(optionsMap).toEqual({ locationField: 'location' });
  });

  it('keeps the auto-derived binding ALONGSIDE a partial authored block', async () => {
    // The case that rules out folding the block into `mapCfg` with `??`: the
    // author declared only a marker-title field, and the coordinate binding
    // still has to come from the derivation. `ListView` merges the two per
    // key; a `??` here would have discarded one of them.
    const { map, optionsMap } = await renderWith({ map: { titleField: 'title' } });

    expect(map).toEqual({ titleField: 'title' });
    expect(optionsMap).toEqual({ locationField: 'location' });
  });

  it('CONTROL: the legacy `options.map` bag is still forwarded on its own path', async () => {
    const { map, optionsMap } = await renderWith({
      options: { map: { locationField: 'location', titleField: 'legacy_title' } },
    });

    expect(map).toBeNull();
    expect(optionsMap).toEqual({ locationField: 'location', titleField: 'legacy_title' });
  });
});
