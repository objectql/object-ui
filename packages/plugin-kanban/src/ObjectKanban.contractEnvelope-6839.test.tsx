/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `ObjectKanban` reads its `find()` answer as `QueryResult` DECLARES it — and
 * does NOT read `records` (objectui#6839).
 *
 * ## Why per module, when the read lives in ONE shared helper
 *
 * The board unwraps through `extractRecords` (`@object-ui/core`). A repo-wide
 * "nothing reads `records`" assertion would pass over a module that unwrapped
 * the envelope itself instead — as `plugin-list`'s `ListView` still does — so
 * what this file measures is the ROUTE, at the cards.
 *
 * ## This module is where the `value` arm is LIVE, which is why it is asserted
 *
 * `value` is not a leftover here: THREE `find()` doubles in this package answer
 * `{ value: [...] }` today, and objectui#6840 (which deleted `value` from
 * `ObjectView`'s own ladder on a zero at THAT seam) said in as many words that
 * its zero must not be carried to this one. So the `value` case below is a
 * NON-REGRESSION case — it is what refuses an `extractRecords` that answers
 * `[]` for everything, an implementation strictly worse than the bug.
 *
 * MEASURED for this module: no `find()` in `plugin-kanban`, nor in any app or
 * example mounting a board, emits a `records` envelope. The package's four
 * `records:` object literals are a doc comment, an authoring-metadata
 * description, and two record-VISIBILITY batch route stubs (`fetch`, not
 * `find`). CONTROL, so the zero is a reading: the same sweep finds a live
 * `find()` double emitting `{ records: [...] }` at `plugin-list`'s
 * ObjectGallery, a consumer with its own unwrap ladder.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import React from 'react';
import type { DataSource, ObjectKanbanSchema } from '@object-ui/types';
import { ObjectKanban } from './ObjectKanban';

const schema = {
  type: 'object-kanban',
  objectName: 'opportunity',
  groupBy: 'stage',
  cardTitle: 'name',
  columns: [{ id: 'negotiation', title: 'Negotiation' }],
} satisfies ObjectKanbanSchema;

const ROWS = [
  { id: 'o1', name: 'Northwind renewal', stage: 'negotiation' },
  { id: 'o2', name: 'Contoso expansion', stage: 'negotiation' },
];

const DEF = {
  name: 'opportunity',
  fields: {
    name: { type: 'text', label: 'Name' },
    stage: {
      type: 'picklist',
      label: 'Stage',
      options: [{ value: 'negotiation', label: 'Negotiation' }],
    },
  },
};

/** How one case wraps its rows on the way back out of `find()`. */
type Envelope = (rows: unknown[]) => unknown;

const asData: Envelope = (rows) => ({ data: rows, total: rows.length });
const asBareArray: Envelope = (rows) => rows;
const asValue: Envelope = (rows) => ({ value: rows, total: rows.length });
const asRecords: Envelope = (rows) => ({ records: rows, total: rows.length });

/** Cards the board actually painted, by their `aria-label`. */
function cards(): string[] {
  const list = screen.queryByRole('list', { name: 'Negotiation cards' });
  if (!list) return [];
  return within(list)
    .queryAllByRole('listitem')
    .map((el) => el.getAttribute('aria-label') ?? '');
}

/**
 * Mount the board over a `find()` answering `envelope`, and hand back the cards
 * it drew.
 *
 * ⛔ Call this ONCE per case and NEVER from inside a `waitFor` predicate
 * (objectui#7802) — it renders, and `waitFor` re-runs its callback on DOM
 * mutations, so a predicate that renders feeds itself and leaks a container
 * div per run.
 *
 * ⚠️ Mounted with NO `data` prop: `ObjectKanban` skips its own fetch when
 * external data is supplied, and a board handed its rows directly would answer
 * every case identically — measuring nothing.
 */
async function cardsThrough(envelope: Envelope): Promise<string[]> {
  const find = vi.fn(async () => envelope(ROWS));
  const ds = {
    getObjectSchema: vi.fn(async () => DEF),
    find,
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as DataSource;
  render(<ObjectKanban schema={schema} dataSource={ds} />);
  await waitFor(() => expect(find).toHaveBeenCalled());
  // `find`'s OWN answer, settled — a pure read of the mock's call record that
  // touches no DOM. Without it, "no cards" is satisfied by the mount's initial
  // empty state, which every arm renders identically.
  await find.mock.results[0].value;
  // The column header lands on every arm, refused or not, so it is a mount
  // signal rather than a rows signal — which is exactly what makes it the
  // right thing to wait on before reading the cards.
  await waitFor(() => expect(screen.queryByText('Negotiation')).toBeTruthy());
  return cards();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ObjectKanban — the find() envelope it reads (objectui#6839)', () => {
  it("still reads the contract's `data` member", async () => {
    const drawn = await cardsThrough(asData);
    expect(drawn.length, 'the declared rows member must still draw both cards').toBe(2);
  });

  it('still reads a bare array — the live non-envelope shape fakes answer with', async () => {
    const drawn = await cardsThrough(asBareArray);
    expect(drawn.length, 'the bare-array arm must still draw both cards').toBe(2);
  });

  it('still reads `value` — LIVE at this seam, three doubles in this package emit it', async () => {
    const drawn = await cardsThrough(asValue);
    expect(
      drawn.length,
      'objectui#6840 refused to transfer its `ObjectView` zero here; deleting this arm would '
        + 'break three doubles in this package',
    ).toBe(2);
  });

  it('does NOT read `records` — not a QueryResult member', async () => {
    // Before the fix these two cards drew off a key `QueryResult` does not
    // declare, and did so AHEAD of `data`.
    const drawn = await cardsThrough(asRecords);
    expect(
      drawn,
      'a `records` envelope must reach the board as zero cards, not as the rows it names',
    ).toEqual([]);
  });
});
