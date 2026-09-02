/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#7210, half 2 — maintainer ruling a′ (2026-09-02), on the calendar.
 *
 * The calendar is the view where a cut is HARDEST to notice from the picture,
 * which is the ruling's whole concern. Its month grid draws at most four
 * events per day cell and a "+N more" affordance, so a month rendered from the
 * first N of a much larger set looks exactly like a full one — the missing
 * records are not missing pixels, they are cells that were never asked about.
 * There is no row count on screen to compare against, so the footnote is the
 * only signal that exists.
 *
 * ⚠️ Environment: jsdom, via this repo's `dom` vitest project. No assertion
 * here depends on container size or on a media query — the note is a sibling
 * in the component's own tree and is present or absent regardless of layout,
 * which is deliberate: `happy-dom` never fires container-size effects and
 * `jsdom` applies media-query rules irrespective of `innerWidth`, so a pin
 * that leaned on either would be unmeasurable rather than merely flaky.
 *
 * REVERSE VERIFICATION — direction predicted before running: removing
 * `$top: NON_GRID_ROW_CEILING_TOP` from `ObjectCalendar`'s record fetch turns
 * the truncation case red at the footnote assertion, while the below-ceiling
 * case stays green.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NON_GRID_ROW_CEILING, NON_GRID_ROW_CEILING_TOP } from '@object-ui/react';
import { ObjectCalendar } from './ObjectCalendar';

vi.mock('@object-ui/plugin-detail', () => ({
  RecordDetailDrawer: () => null,
  deriveRecordPageHref: () => null,
}));

const TOTAL_ROWS = 9876;
const NOW = new Date();

/** Events inside the month the calendar opens on, so they are drawable at all. */
function makeRows(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(NOW.getFullYear(), NOW.getMonth(), (i % 28) + 1);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
    return { id: String(i + 1), subject: `Event ${i + 1}`, start_at: iso, end_at: iso };
  });
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
      name: 'event',
      fields: {
        id: { name: 'id', type: 'text' },
        subject: { name: 'subject', type: 'text' },
        start_at: { name: 'start_at', type: 'date' },
        end_at: { name: 'end_at', type: 'date' },
      },
    })),
  } as any;
}

const schema: any = {
  type: 'calendar',
  objectName: 'event',
  calendar: { titleField: 'subject', startDateField: 'start_at', endDateField: 'end_at' },
  data: { provider: 'object', object: 'event' },
};

describe('objectui#7210 ruling a′ — the calendar caps at the platform ceiling, loudly', () => {
  it('above the ceiling: the query stops at the ceiling and BOTH numbers are named', async () => {
    const calls: Array<Record<string, any>> = [];
    const dataSource = makeDataSource(TOTAL_ROWS, calls);

    render(<ObjectCalendar schema={schema} dataSource={dataSource} />);

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
    const dataSource = makeDataSource(12, calls);

    render(<ObjectCalendar schema={schema} dataSource={dataSource} />);

    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.queryByText(/Loading/i)).toBeNull());
    expect(screen.queryByRole('note')).toBeNull();
  });
});
