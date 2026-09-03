/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#7243 — the same `colorField` used to mean three different things
 * across gantt / calendar / timeline. This file pins the calendar's half.
 *
 * BEFORE: `ObjectCalendar` handed `CalendarView` the RAW record value, so an
 * authored option colour never reached the event — `"open"` fell through to
 * `resolveEventColor`'s deterministic 8-stop hash and produced a palette class
 * unrelated to the colour the author declared on the field's option.
 *
 * AFTER: the shared ladder (`@object-ui/core#createFieldColorResolver`) runs
 * first, so a select field's option colour arrives as a hex and
 * `resolveEventColor` paints THAT.
 *
 * The hash is NOT retired — it stays as the last rung, unchanged, for values
 * no option colours it (a category label on a schemaless / inline-data
 * calendar). That is deliberate: retiring it would repaint every existing
 * calendar whose `colorField` points at a plain categorical field, which is a
 * behaviour change well beyond this card, and `CalendarView`'s soft-tint class
 * pairs are theme-aware where a derived solid hex would not be.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ObjectCalendar } from './ObjectCalendar';
import { __resolveEventColorForTest as resolveEventColor } from './CalendarView';

vi.mock('@object-ui/plugin-detail', () => ({
  RecordDetailDrawer: () => null,
  deriveRecordPageHref: () => null,
}));

let lastEvents: any[] = [];

vi.mock('./CalendarView', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    CalendarView: ({ events }: any) => {
      lastEvents = events;
      return <div data-testid="calendar-view" data-event-count={String(events.length)} />;
    },
  };
});

/** The authored option colours — identical to the gantt and timeline fixtures. */
const STATUS_OPTIONS = [
  { value: 'open', label: 'Open', color: '#7c3aed' },
  { value: 'done', label: 'Done', color: '#059669' },
];

const OBJECT_SCHEMA = {
  name: 'duly_task',
  fields: {
    id: { name: 'id', type: 'text' },
    subject: { name: 'subject', type: 'text' },
    starts_at: { name: 'starts_at', type: 'datetime' },
    ends_at: { name: 'ends_at', type: 'datetime' },
    status: { name: 'status', type: 'select', options: STATUS_OPTIONS },
    category: { name: 'category', type: 'text' },
  },
};

const ROWS = [
  {
    id: '1',
    subject: 'Ship it',
    status: 'open',
    category: 'email',
    starts_at: '2026-01-01T09:00:00Z',
    ends_at: '2026-01-01T10:00:00Z',
  },
];

function makeDataSource(rows: any[] = ROWS, objectSchema: any = OBJECT_SCHEMA) {
  return {
    find: vi.fn(async () => ({ data: rows, total: rows.length })),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn(async () => objectSchema),
  } as any;
}

async function colorsFor(colorField: string, rows: any[] = ROWS, objectSchema: any = OBJECT_SCHEMA) {
  lastEvents = [];
  const schema: any = {
    type: 'object-calendar',
    objectName: 'duly_task',
    calendar: {
      startDateField: 'starts_at',
      endDateField: 'ends_at',
      titleField: 'subject',
      colorField,
    },
  };
  render(<ObjectCalendar schema={schema} dataSource={makeDataSource(rows, objectSchema)} />);
  await waitFor(() => expect(lastEvents.length).toBe(rows.length));
  return lastEvents.map((e) => e.color);
}

describe('objectui#7243 — calendar colorField ladder', () => {
  it('rung 1: a select field paints the AUTHORED option colour', async () => {
    expect(await colorsFor('status')).toEqual(['#7c3aed']);
  });

  it('the authored colour reaches the DOM as a real colour, not a hashed class', () => {
    expect(resolveEventColor('#7c3aed')).toEqual({ className: 'text-white', inlineColor: '#7c3aed' });
    // What the pre-fix raw value produced instead: a palette class, no colour.
    expect(resolveEventColor('open').inlineColor).toBeUndefined();
  });

  it('last rung: a value no option colours still reaches the hash unchanged', async () => {
    expect(await colorsFor('category')).toEqual(['email']);
    expect(resolveEventColor('email').className).toMatch(/^bg-/);
  });
});
