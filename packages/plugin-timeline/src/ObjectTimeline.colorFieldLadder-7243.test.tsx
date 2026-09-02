/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#7243 — the CONTROL of the three-renderer fixture set.
 *
 * `plugin-timeline` was already the reference implementation: it built a
 * value -> option map off `objectSchema.fields[colorField].options` and read
 * `option.color`. This file pins that observable behaviour so the resolver can
 * be LIFTED into `@object-ui/core#createFieldColorResolver` without moving it
 * — every case below is green BEFORE the lift and green AFTER, which is what
 * makes gantt's and calendar's red-to-green readings mean something.
 *
 * The one deliberate widening the lift carries is recorded here too: the hex
 * literal test accepts the 8-digit `#rrggbbaa` spelling, which the timeline's
 * private regex (3 or 6 digits) did not. `plugin-calendar`'s own hex test
 * already accepted 8 digits, so the two in-repo spellings disagreed; the
 * shared rung takes the wider one because the narrow one is the only spelling
 * under which a VALID CSS colour could fall through to a derived colour in
 * gantt. It can only turn "no colour" into the author's colour — never the
 * reverse.
 *
 * The assertions read the items `ObjectTimeline` composes for
 * `TimelineRenderer`; that `color` is what the renderer turns into the
 * marker's `borderColor` / translucent `backgroundColor`.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ObjectTimeline } from './ObjectTimeline';

let lastItems: any[] = [];

vi.mock('./renderer', () => ({
  TimelineRenderer: ({ schema }: any) => {
    lastItems = schema.items ?? [];
    return <div data-testid="timeline-renderer" data-item-count={String(lastItems.length)} />;
  },
}));

/** The authored option colours — identical to the gantt and calendar fixtures. */
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
    status: { name: 'status', type: 'select', options: STATUS_OPTIONS },
    accent: { name: 'accent', type: 'text' },
  },
};

const ROW = {
  id: '1',
  subject: 'Ship it',
  status: 'open',
  accent: '#123456',
  starts_at: '2026-01-01T09:00:00Z',
};

function makeDataSource(rows: any[]) {
  return {
    find: vi.fn(async () => ({ data: rows, total: rows.length })),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn(async () => OBJECT_SCHEMA),
  } as any;
}

async function colorsFor(colorField: string, rows: any[] = [ROW]) {
  lastItems = [];
  const schema: any = {
    type: 'timeline',
    objectName: 'duly_task',
    titleField: 'subject',
    startDateField: 'starts_at',
    colorField,
  };
  render(<ObjectTimeline schema={schema} dataSource={makeDataSource(rows)} />);
  await waitFor(() => expect(lastItems.length).toBe(rows.length));
  return lastItems.map((i) => i.color);
}

describe('objectui#7243 — timeline colorField ladder (control: green before and after)', () => {
  it('rung 1: a select field paints the AUTHORED option colour', async () => {
    expect(await colorsFor('status')).toEqual(['#7c3aed']);
  });

  it('rung 1: an unmatched value in an optioned field takes no option colour', async () => {
    const rows = [{ ...ROW, status: 'archived' }];
    expect(await colorsFor('status', rows)).toEqual([undefined]);
  });

  it('rung 2: 3- and 6-digit hex literals pass through', async () => {
    expect(await colorsFor('accent', [{ ...ROW, accent: '#abc' }])).toEqual(['#abc']);
    expect(await colorsFor('accent', [{ ...ROW, accent: '#123456' }])).toEqual(['#123456']);
  });

  it('rung 2: rgb() and hsl() literals pass through', async () => {
    expect(await colorsFor('accent', [{ ...ROW, accent: 'rgb(1, 2, 3)' }])).toEqual(['rgb(1, 2, 3)']);
    expect(await colorsFor('accent', [{ ...ROW, accent: 'hsl(1 2% 3%)' }])).toEqual(['hsl(1 2% 3%)']);
  });

  it('a value that is neither an option nor a colour literal yields no colour', async () => {
    expect(await colorsFor('accent', [{ ...ROW, accent: 'in_progress' }])).toEqual([undefined]);
  });

  it('an empty value yields no colour', async () => {
    expect(await colorsFor('accent', [{ ...ROW, accent: '' }])).toEqual([undefined]);
  });
});

/**
 * The ONE case in this file that is not a control: it was red before the lift
 * and is green after. Kept separate so the block above can be read as the pure
 * before/after control it is.
 */
describe('objectui#7243 — the lift widens the hex spelling by one form', () => {
  it('rung 2: an 8-digit #rrggbbaa literal now passes through too', async () => {
    expect(await colorsFor('accent', [{ ...ROW, accent: '#aabbccdd' }])).toEqual(['#aabbccdd']);
  });
});
