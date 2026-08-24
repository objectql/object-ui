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

import { getRecordDisplayName } from '@object-ui/core';
import { InterfaceListPage, defaultMapFromObject } from './InterfaceListPage';

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
    // …and the ADR-0047 auto-derivation still fires. `titleField` joined the
    // product in objectui#5909: this fixture object's display field is `title`,
    // NOT `name`, so without it `ObjectMap` would title every marker off the
    // literal `'name'` key and render `undefined`.
    expect(optionsMap).toEqual({ locationField: 'location', titleField: 'title' });
  });

  it('keeps the auto-derived binding ALONGSIDE a partial authored block', async () => {
    // The case that rules out folding the block into `mapCfg` with `??`: the
    // author declared only a marker-title field, and the coordinate binding
    // still has to come from the derivation. `ListView` merges the two per
    // key; a `??` here would have discarded one of them.
    const { map, optionsMap } = await renderWith({ map: { titleField: 'title' } });

    expect(map).toEqual({ titleField: 'title' });
    expect(optionsMap).toEqual({ locationField: 'location', titleField: 'title' });
  });

  it('CONTROL: the legacy `options.map` bag is still forwarded on its own path', async () => {
    const { map, optionsMap } = await renderWith({
      options: { map: { locationField: 'location', titleField: 'legacy_title' } },
    });

    expect(map).toBeNull();
    expect(optionsMap).toEqual({ locationField: 'location', titleField: 'legacy_title' });
  });
});

/**
 * objectui#5909 — the derived marker-title binding.
 *
 * ## What the siblings actually do (measured, because the card asserted it)
 *
 * The card's argument is that this deriver is the odd one out among "every
 * sibling deriver". Measured on this file, it is not: NO deriver binds a title.
 * Each binds its viz's own required field and stops —
 * `defaultKanbanFromObject → { groupByField }`,
 * `defaultCalendarFromObject → { startDateField }`,
 * `defaultGalleryFromObject → { coverField }`,
 * `defaultGanttFromObject → { startDateField, endDateField, progressField? }` —
 * and `defaultMapFromObject` bound `{ locationField }`, its own required field.
 *
 * The real asymmetry is one layer down, at the renderers. `ObjectKanban`,
 * `ObjectCalendar` and `ObjectGantt` resolve their item title through
 * `@object-ui/core#getRecordDisplayName` (ADR-0079), so they need nothing
 * derived. `ObjectMap` alone does not: `getMapConfig` fills an absent
 * `titleField` with the literal `'name'` and the marker title is a plain
 * `record[titleField]` read — `undefined` for every record of an object whose
 * display field is not `name`.
 *
 * So these arms pin the binding against the SAME ADR-0079 field ranking the
 * sibling renderers use, rather than against a rule invented here.
 */
describe('defaultMapFromObject derives the marker title (objectui#5909)', () => {
  const loc = { type: 'location' };

  // THE DISCRIMINATING ARM. An object whose display field is `title`, not
  // `name` — the exact case the card reports. Before the fix the product was
  // `{ locationField: 'location' }` and `getMapConfig` fell through to `'name'`.
  it('binds the display field when it is NOT `name`', () => {
    expect(defaultMapFromObject({ fields: { title: { type: 'text' }, location: loc } })).toEqual({
      locationField: 'location',
      titleField: 'title',
    });
  });

  // The declared pointer outranks the field scan. This arm is what makes the
  // `nameField` step load-bearing rather than decorative: `deriveTitleField`
  // alone ranks `title` above `headline` here, so an implementation that called
  // only the scan would answer `title` and fail.
  it('prefers the object’s declared `nameField` over the field scan', () => {
    expect(
      defaultMapFromObject({
        nameField: 'headline',
        fields: { headline: { type: 'text' }, title: { type: 'text' }, location: loc },
      }),
    ).toEqual({ locationField: 'location', titleField: 'headline' });
  });

  it('accepts the deprecated `displayNameField` / `NAME_FIELD_KEY` aliases', () => {
    const fields = { headline: { type: 'text' }, title: { type: 'text' }, location: loc };
    expect(defaultMapFromObject({ displayNameField: 'headline', fields })?.titleField).toBe('headline');
    expect(defaultMapFromObject({ NAME_FIELD_KEY: 'headline', fields })?.titleField).toBe('headline');
  });

  it('picks up the `*_name` affix convention', () => {
    expect(defaultMapFromObject({ fields: { site_name: { type: 'text' }, location: loc } })).toEqual({
      locationField: 'location',
      titleField: 'site_name',
    });
  });

  // CONTROL — an object whose display field IS `name` keeps the binding it
  // effectively had. This arm alone would pass on the defect, which is why it
  // is not the only one.
  it('CONTROL: still binds `name` when that IS the display field', () => {
    expect(defaultMapFromObject({ fields: { name: { type: 'text' }, location: loc } })).toEqual({
      locationField: 'location',
      titleField: 'name',
    });
  });

  // Omitted, not fabricated: every field here is title-INELIGIBLE (geo, date),
  // so nothing resolves and the key stays absent rather than being invented.
  it('omits `titleField` entirely when no field is title-eligible', () => {
    const derived = defaultMapFromObject({
      fields: { location: { type: 'geolocation' }, due: { type: 'date' } },
    });
    expect(derived).toEqual({ locationField: 'location' });
    expect(derived && 'titleField' in derived).toBe(false);
  });

  it('CONTROL: no location field still derives nothing at all', () => {
    expect(defaultMapFromObject({ fields: { title: { type: 'text' } } })).toBeUndefined();
  });

  // ANTI-DRIFT. The binding is a field NAME; `getRecordDisplayName` is the
  // canonical per-record resolver every sibling renderer calls. Reading the
  // record at the derived field must land on the same string the canonical
  // resolver returns, or a map and a kanban over one object would disagree
  // about what a record is called. Scoped to the steps a static binding can
  // carry — the declared pointer and the type-aware field scan; `titleFormat`
  // (a render-only template) and the record-key probe are out of reach by
  // construction and are not asserted here.
  it.each([
    ['display field is `title`', { fields: { title: { type: 'text' }, location: loc } }, { title: 'Fix the roof', location: 'x' }],
    ['declared nameField', { nameField: 'headline', fields: { headline: { type: 'text' }, title: { type: 'text' }, location: loc } }, { headline: 'Roof', title: 'Ignored', location: 'x' }],
    ['affix convention', { fields: { site_name: { type: 'text' }, location: loc } }, { site_name: 'Depot 4', location: 'x' }],
    ['display field is `name`', { fields: { name: { type: 'text' }, location: loc } }, { name: 'HQ', location: 'x' }],
  ])('agrees with getRecordDisplayName — %s', (_label, objectDef, record) => {
    const titleField = defaultMapFromObject(objectDef)?.titleField;
    expect(titleField).toBeTruthy();
    expect((record as any)[titleField as string]).toBe(getRecordDisplayName(objectDef, record));
  });
});
