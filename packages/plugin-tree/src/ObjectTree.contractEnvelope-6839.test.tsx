/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `ObjectTree` reads its `find()` answer as `QueryResult` DECLARES it — and
 * does NOT read `records` (objectui#6839).
 *
 * ⭐ This module reaches the shared reader INDIRECTLY, and that is the whole
 * reason it needs its own pin. It does not call `extractRecords` at all: it
 * hands its `find()` answer to `applyNonGridRowCeiling` (`@object-ui/react`),
 * which unwraps it. A card that enumerated the helper's direct callers would
 * not list this file, and a repo-wide "nothing reads `records`" assertion would
 * pass over it in silence — so the route itself is what is measured here, at
 * the rows the forest draws.
 *
 * MEASURED for this module: no `find()` in `plugin-tree`, nor in any app or
 * example mounting a tree, emits a `records` envelope — the package's single
 * `records:` occurrence is a `buildForest(records: any[], …)` parameter name.
 * CONTROL, so the zero is a reading: the same sweep finds a live `find()`
 * double emitting `{ records: [...] }` at `plugin-list`'s ObjectGallery, a
 * consumer with its own unwrap ladder.
 *
 * ⚠️ The refusal case is ALSO satisfied by an `extractRecords` that returns
 * `[]` for everything — an implementation strictly worse than the bug. The
 * `data` and bare-array cases refuse it: same rows, same mount.
 */

import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ObjectTree } from './ObjectTree';

// objectui#6892 slice 9 — inherit the real surface through `<any>` rather than
// `typeof import('@object-ui/plugin-detail')`. `plugin-tree` does NOT declare
// that package and `ObjectTree`'s module graph reaches zero of its modules, so
// a type-position `import()` of it would be a real specifier to
// `check-phantom-dependencies`, which would then correctly demand a dependency
// the runtime does not have.
vi.mock('@object-ui/plugin-detail', async (importOriginal) => ({
  ...((await importOriginal<any>()) as Record<string, unknown>),
  RecordDetailDrawer: () => null,
  deriveRecordPageHref: () => null,
}));

const ROWS = [
  { id: '1', name: 'Root', parent_id: null },
  { id: '2', name: 'Child', parent_id: '1' },
];

const schema: any = {
  type: 'object-tree',
  objectName: 'node',
  tree: { parentField: 'parent_id', labelField: 'name' },
  data: { provider: 'object', object: 'node' },
};

/** How one case wraps its rows on the way back out of `find()`. */
type Envelope = (rows: unknown[]) => unknown;

const asData: Envelope = (rows) => ({ data: rows, total: rows.length });
const asBareArray: Envelope = (rows) => rows;
const asRecords: Envelope = (rows) => ({ records: rows, total: rows.length });

/**
 * Mount the tree over a `find()` answering `envelope`, and hand back what it
 * settled on: the number of rows it drew, or `'empty-state'` when it drew its
 * own "No records" panel instead.
 *
 * The two outcomes are DIFFERENT DOM, not a count of 0 — `ObjectTree` returns
 * early on an empty forest and never mounts the table. Reporting which one
 * happened is what keeps a refused envelope distinguishable from a mount that
 * never rendered.
 *
 * ⛔ Call ONCE per case, never inside a `waitFor` predicate (objectui#7802):
 * it renders, and `waitFor` re-runs its callback on DOM mutations, so a
 * predicate that renders feeds itself and leaks a container div per run.
 */
async function settledOn(envelope: Envelope): Promise<number | 'empty-state'> {
  const find = vi.fn(async () => envelope(ROWS));
  const ds: any = {
    find,
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn(async () => ({
      name: 'node',
      fields: {
        id: { name: 'id', type: 'text' },
        name: { name: 'name', type: 'text' },
        parent_id: { name: 'parent_id', type: 'text' },
      },
    })),
  };
  const { container } = render(<ObjectTree schema={schema} dataSource={ds} />);
  await waitFor(() => expect(find).toHaveBeenCalled());
  // `find`'s OWN answer, settled — a pure read of the mock's call record that
  // touches no DOM. Without it "no rows" is satisfied by the mount's initial
  // empty state, which every arm renders identically.
  await find.mock.results[0].value;
  await waitFor(() =>
    expect(
      container.querySelector('[data-testid="object-tree"]') ??
        screen.queryByText('No records'),
    ).not.toBeNull(),
  );
  return container.querySelector('[data-testid="object-tree"]')
    ? container.querySelectorAll('tbody tr').length
    : 'empty-state';
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ObjectTree — the find() envelope it reads (objectui#6839)', () => {
  it("still reads the contract's `data` member", async () => {
    expect(await settledOn(asData), 'the declared rows member must still draw').toBe(2);
  });

  it('still reads a bare array — the live non-envelope shape fakes answer with', async () => {
    expect(await settledOn(asBareArray), 'the bare-array arm must still draw').toBe(2);
  });

  it('does NOT read `records` — not a QueryResult member', async () => {
    // Before the fix these two nodes drew off a key `QueryResult` does not
    // declare, and did so AHEAD of `data`. The tree now settles on its own
    // "No records" panel — a DIFFERENT node from the table, which is what makes
    // this a reading of the refusal rather than of a mount that never happened.
    expect(
      await settledOn(asRecords),
      'a `records` envelope must reach the forest as no rows at all, not as the rows it names',
    ).toBe('empty-state');
  });
});
