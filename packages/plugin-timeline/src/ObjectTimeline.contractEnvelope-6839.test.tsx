/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `ObjectTimeline` reads its `find()` answer as `QueryResult` DECLARES it — and
 * does NOT read `records` (objectui#6839).
 *
 * ## Why per module, when the read lives in ONE shared helper
 *
 * objectui#6726 repaired seven consumers that each carried their OWN copy of
 * the read, so its per-module pins answered "were all seven repaired". Here
 * there is one read site (`extractRecords`, `@object-ui/core`), and the
 * per-module question is a different one: does THIS module actually route its
 * answer through the helper? A module that unwrapped the envelope itself — as
 * `plugin-list`'s `ListView` still does — would inherit nothing from the
 * helper's own pin, and a repo-wide "nothing reads `records`" assertion would
 * pass over it in silence. This file measures the route, at the rows.
 *
 * MEASURED for this module: no `find()` in `plugin-timeline`, nor in any app or
 * example that mounts a timeline, emits a `records` envelope. CONTROL, so the
 * zero is a reading — the same sweep finds `records` envelopes at other seams,
 * including one live `find()` double (`plugin-list`'s ObjectGallery) and the
 * record-visibility batch route stubs in this repo's own sibling packages.
 *
 * ⚠️ The refusal case below is ALSO satisfied by an `extractRecords` that
 * returns `[]` for everything — an implementation strictly worse than the bug.
 * The `data` and bare-array cases are the ones that refuse it: they push the
 * SAME rows through the SAME mount, so an arm that delivers nothing delivered
 * nothing because the envelope was refused.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup, screen } from '@testing-library/react';
import React from 'react';

// The timeline's own visualisation is orthogonal to what this file observes
// (how many rows reached it), and rendering it pulls a chart's worth of DOM
// per case. The rows arrive as `schema.items`.
vi.mock('./renderer', () => ({
  TimelineRenderer: ({ schema }: any) => (
    <div data-testid="timeline-renderer" data-item-count={String((schema.items ?? []).length)} />
  ),
}));

import { ObjectTimeline } from './ObjectTimeline';

const OBJECT = 'duty_task';
const ROWS = [
  { id: 't1', subject: 'Ship it', starts_at: '2026-01-01T09:00:00Z' },
  { id: 't2', subject: 'Ship it again', starts_at: '2026-01-02T09:00:00Z' },
];

/** How one case wraps its rows on the way back out of `find()`. */
type Envelope = (rows: unknown[]) => unknown;

const asData: Envelope = (rows) => ({ data: rows, total: rows.length });
const asBareArray: Envelope = (rows) => rows;
const asRecords: Envelope = (rows) => ({ records: rows, total: rows.length });

const schema: any = {
  type: 'timeline',
  objectName: OBJECT,
  titleField: 'subject',
  startDateField: 'starts_at',
};

/** Mount the timeline over a `find()` answering `envelope`, return rows drawn. */
async function itemsThrough(envelope: Envelope): Promise<number> {
  const ds: Record<string, any> = {
    find: vi.fn(async () => envelope(ROWS)),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn(async (name: string) => ({
      name,
      fields: {
        id: { type: 'text', label: 'Id' },
        subject: { type: 'text', label: 'Subject' },
        starts_at: { type: 'datetime', label: 'Start' },
      },
    })),
  };
  render(<ObjectTimeline schema={schema} dataSource={ds as any} />);
  await waitFor(() => expect(ds.find).toHaveBeenCalled());
  // `find`'s OWN answer, settled — a pure read of the mock's call record that
  // touches no DOM. Without it the assertion can be satisfied by the mount's
  // initial empty state, which every arm renders identically.
  await ds.find.mock.results[0].value;
  await waitFor(() =>
    expect(screen.getByTestId('timeline-renderer').getAttribute('data-item-count')).not.toBeNull(),
  );
  return Number(screen.getByTestId('timeline-renderer').getAttribute('data-item-count'));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ObjectTimeline — the find() envelope it reads (objectui#6839)', () => {
  it("still reads the contract's `data` member", async () => {
    // ⛔ Never call `itemsThrough` from inside a `waitFor` predicate
    // (objectui#7802): it renders, and `waitFor` re-runs its callback on DOM
    // mutations, so the predicate feeds itself and leaks a container div per
    // run. The render happens once, out here, and the case reads its answer.
    expect(await itemsThrough(asData), 'the declared rows member must still draw').toBe(2);
  });

  it('still reads a bare array — the live non-envelope shape fakes answer with', async () => {
    expect(await itemsThrough(asBareArray), 'the bare-array arm must still draw').toBe(2);
  });

  it('does NOT read `records` — not a QueryResult member', async () => {
    // Before the fix these two rows drew off a key `QueryResult` does not
    // declare, and did so AHEAD of `data`.
    expect(
      await itemsThrough(asRecords),
      'a `records` envelope must reach the rail as zero rows, not as the rows it names',
    ).toBe(0);
  });
});
