/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `ObjectView`'s non-grid fetch reads a `find()` answer as `QueryResult`
 * DECLARES it — and does NOT read `records` (objectui#6726).
 *
 * `QueryResult` (`@object-ui/types`) declares exactly one rows member: `data`.
 * This block's unwrap was a four-branch ladder — bare array, `data`, `records`,
 * `value` — and the `records` branch sat between the contract's member and the
 * OData one.
 *
 * MEASURED on this tree, no producer emits `records` at this `DataSource.find()`
 * seam: `ObjectStackAdapter.normalizeQueryResult` CONSUMES the server/SDK
 * `records` envelope and returns `{ data, total, page, pageSize, hasMore }`
 * before returning, and every other `find()` implementation in the repo returns
 * `data` or a bare array. The branch was unreachable in practice — and an
 * unreachable tolerant branch is precisely where a non-conforming producer
 * would keep working unrejected (AGENTS.md #0.1).
 *
 * OUT OF THIS CARD'S FENCE, recorded so the silence is not read as a verdict:
 * the `value` branch is a below-the-adapter spelling by the same argument, and
 * it is left standing here. objectui#6726 names `records`; `value` is filed
 * separately rather than fixed on a card that did not measure it.
 *
 * The rows reach the child as `data={data}`, so that prop is what this pin
 * reads. The `data` and bare-array legs push the SAME rows through the SAME
 * mount, which is what makes the `records` leg a reading rather than a mount
 * that never rendered.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { ObjectView } from '../ObjectView';
import type { ObjectViewSchema } from '@object-ui/types';

/** Every `data` prop the view handed to SchemaRenderer, in order. */
const delivered: unknown[][] = [];

vi.mock('@object-ui/react', async (importOriginal) => {
  const React = await import('react');
  return {
    // Inherit the real export surface, then override only what this pin reads.
    // A hand-listed factory freezes the mock at whatever was typed that day, and
    // the next export any module in this file's import graph reads at module
    // scope kills the file during COLLECTION -- zero failed assertions, tests
    // that never ran (objectui#6768 / #6849).
    ...(await importOriginal<Record<string, unknown>>()),
    SchemaRenderer: ({ data }: any) => {
      if (Array.isArray(data)) delivered.push(data);
      return <div data-testid="schema-renderer" />;
    },
    SchemaRendererContext: React.createContext(null),
    subscribeDataChanges: () => () => {},
    notifyDataChanged: () => {},
  };
});
vi.mock('@object-ui/plugin-grid', () => ({ ObjectGrid: () => <div data-testid="object-grid" /> }));
vi.mock('@object-ui/plugin-form', () => ({ ObjectForm: () => <div data-testid="object-form" /> }));

const ROWS = [{ id: 'r1', name: 'Ada' }, { id: 'r2', name: 'Grace' }];

/** How one case wraps its rows on the way back out of `find()`. */
type Envelope = (rows: unknown[]) => unknown;

const asData: Envelope = (rows) => ({ data: rows, total: rows.length });
const asBareArray: Envelope = (rows) => rows;
const asRecords: Envelope = (rows) => ({ records: rows, total: rows.length });

async function deliveredThrough(envelope: Envelope): Promise<unknown[]> {
  delivered.length = 0;
  const ds: any = {
    find: vi.fn().mockResolvedValue(envelope(ROWS)),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn().mockResolvedValue({ name: 'store', fields: {} }),
  };
  render(
    <ObjectView
      schema={{ type: 'object-view', objectName: 'store' } as ObjectViewSchema}
      views={[{ id: 'k', label: 'Board', type: 'kanban' as any }]}
      dataSource={ds}
    />,
  );
  await waitFor(() => expect(ds.find).toHaveBeenCalled());
  await waitFor(() => expect(delivered.length).toBeGreaterThan(0));
  return delivered[delivered.length - 1];
}

beforeEach(() => {
  cleanup();
});

describe('ObjectView — the find() envelope its non-grid fetch reads (objectui#6726)', () => {
  it("reads the contract's `data` member", async () => {
    await waitFor(async () => expect(await deliveredThrough(asData)).toHaveLength(2));
  });

  it('still reads a bare array — the live non-envelope shape fakes answer with', async () => {
    expect(await deliveredThrough(asBareArray)).toHaveLength(2);
  });

  it('does NOT read `records` — not a QueryResult member', async () => {
    // Nothing delivered: the envelope was refused. Before the fix the two rows
    // above reached the board off a key `QueryResult` does not declare.
    expect(await deliveredThrough(asRecords)).toHaveLength(0);
  });
});
