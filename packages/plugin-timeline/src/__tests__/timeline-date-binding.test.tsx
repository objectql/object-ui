/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#3129 — the timeline must bucket records by the date field its
 * config names.
 *
 * Deliberately does NOT mock `./renderer`. `ObjectTimeline.test.tsx` replaces
 * it with a stub that prints only `item.title`, so every assertion there passes
 * whether or not the date binding resolved — which is exactly how a timeline
 * that renders all of its records under "No date" shipped green. The date lives
 * in the bucket header the real renderer emits, so these tests read that.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ObjectTimeline } from '../ObjectTimeline';

vi.mock('@object-ui/react', async (importOriginal) => {
  const actual = await (importOriginal() as Promise<Record<string, unknown>>);
  return {
    ...actual,
    useDataScope: () => undefined,
    useNavigationOverlay: () => ({
      isOverlay: false,
      handleClick: vi.fn(),
      selectedRecord: null,
      isOpen: false,
      close: vi.fn(),
      setIsOpen: vi.fn(),
      mode: 'overlay',
      view: undefined,
    }),
    useObjectLabel: () => ({
      fieldOptionLabel: (_o: string, _f: string, _v: string, fb: string) => fb,
      translateOptions: (_o: string, _f: string, opts: unknown[]) => opts,
      fieldLabel: (_o: string, _f: string, fb: string) => fb,
    }),
  };
});

/** Two campaigns comfortably in the future, so both land in the "Later" bucket. */
const rows = [
  { id: '1', name: 'Spring Launch', start_date: '2099-09-01', end_date: '2099-09-30' },
  { id: '2', name: 'Summer Push', start_date: '2099-10-01', end_date: '2099-10-31' },
];

/** The bucket headers the vertical renderer emits above each group. */
const bucketLabels = () =>
  Array.from(document.querySelectorAll('section > header > span:first-child')).map(
    (el) => el.textContent,
  );

async function renderTimeline(schema: Record<string, unknown>) {
  render(<ObjectTimeline schema={schema as never} data={rows} />);
  await waitFor(() => expect(screen.getByText('Spring Launch')).toBeDefined());
}

describe('ObjectTimeline — honours the configured date field (objectui#3129)', () => {
  it('buckets by the nested spec key `timeline.startDateField`', async () => {
    await renderTimeline({
      type: 'object-timeline',
      objectName: 'crm_campaign',
      titleField: 'name',
      timeline: { startDateField: 'start_date', endDateField: 'end_date', titleField: 'name' },
    });
    expect(bucketLabels()).toEqual(['Later']);
  });

  it('buckets by the nested LEGACY alias `timeline.dateField`', async () => {
    // `ListViewTimelineConfig` has always declared `dateField` on the nested
    // config, and both `ObjectView` read-sites resolve it — but this renderer
    // only ever read the FLAT `schema.dateField`, so the alias fell through to
    // the caller's default (`created_at` / `due_date`). That field is normally
    // absent from the projection, so every record landed under "No date".
    await renderTimeline({
      type: 'object-timeline',
      objectName: 'crm_campaign',
      titleField: 'name',
      timeline: { dateField: 'start_date', titleField: 'name' },
      // What ListView/ObjectView pass alongside it when the alias goes
      // unresolved — the whole point is that the nested config must win.
      startDateField: 'created_at',
    });
    expect(bucketLabels()).toEqual(['Later']);
  });

  it('still honours the flat legacy props when no nested config is given', async () => {
    await renderTimeline({
      type: 'object-timeline',
      objectName: 'crm_campaign',
      titleField: 'name',
      startDateField: 'start_date',
      endDateField: 'end_date',
    });
    expect(bucketLabels()).toEqual(['Later']);
  });

  it('reports "No date" only when the named field really is absent', async () => {
    // The honest negative: a binding that names a field the rows do not carry
    // must still degrade to the no-date bucket rather than inventing an axis.
    await renderTimeline({
      type: 'object-timeline',
      objectName: 'crm_campaign',
      titleField: 'name',
      timeline: { startDateField: 'due_date', titleField: 'name' },
    });
    expect(bucketLabels()).toEqual(['No date']);
  });
});
