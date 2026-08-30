/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `ObjectView`'s non-grid fetch reads a `find()` answer as `QueryResult`
 * DECLARES it — and does NOT read `value` (objectui#6840, following
 * objectui#6726).
 *
 * `QueryResult` (`@object-ui/types`) declares exactly one rows member: `data`.
 * objectui#6726 removed the `records` branch from this unwrap ladder and said
 * so explicitly in its own pin — "the `value` branch is a below-the-adapter
 * spelling by the same argument, and it is left standing here ... filed
 * separately rather than fixed on a card that did not measure it." This is that
 * card, and this is that measurement.
 *
 * MEASURED on this tree (objectui#6840) — a producer sweep of its own, NOT
 * objectui#6726's `records` numbers, which say nothing about this key:
 *
 *   cell    every `find()` DEFINITION body reachable by this seam — the 25
 *           bodies in the 24 files that mount plugin-view's `ObjectView`
 *   SUBJECT `value` emitted as an envelope key ....  0 hits / 0 files
 *   CONTROL `data`  emitted as an envelope key ....  6 hits / 6 files
 *   CONTROL `total` emitted as an envelope key ....  6 hits / 6 files
 *
 * Repo-wide the same pass over all 452 `find()` bodies finds `value` emitted 5
 * times, and every one of them is a TEST DOUBLE in `plugin-calendar` (2) or
 * `plugin-kanban` (3) — components that unwrap through `extractRecords`
 * (`core/src/utils/extract-records.ts`), a DIFFERENT seam, which is
 * objectui#6839's subject. None of the five reaches this component. See the PR
 * description for the cross-card reading; ⛔ this card's zero must NOT be
 * carried over to objectui#6839's seam, where the same key is LIVE.
 *
 * `value` IS read below the adapter, on the raw payload — the OData spelling —
 * which is exactly why nothing re-emits it above:
 * `ObjectStackAdapter.normalizeQueryResult`
 * (`data-objectstack/src/index.ts:3381`, `resultObj.records || resultObj.value`)
 * and `ApiDataSource.normalizeQueryResult`
 * (`core/src/adapters/ApiDataSource.ts:398`, the `['data','items','results',
 * 'records','value']` envelope loop) both fold it into `data` before returning.
 * This block calls `dataSource.find()` strictly ABOVE that fold, so the branch
 * was unreachable — and an unreachable tolerant branch is precisely where a
 * non-conforming producer would keep working unrejected (AGENTS.md #0.1).
 *
 * ⛔ The fix is the deletion, NOT widening `QueryResult` to bless `value` —
 * that is a published-type change and the maintainer's call (same floor as
 * objectui#6726).
 *
 * NOTE on shape, so the silence is not read as a verdict: unlike
 * `related-count-store`'s `count` arm, `value` here was NOT a precedence
 * inversion — the ladder already read `data` first, and `value` was its last
 * branch. So there is no "does not outrank `data`" case to pin; the reading is
 * simply that the fallback is gone. Stating that is the point — a fabricated
 * inversion case would have passed both before and after and measured nothing.
 *
 * The rows reach the child as `data={data}`, so that prop is what this pin
 * reads. The `data` and bare-array legs push the SAME rows through the SAME
 * mount, which is what makes the `value` leg a reading rather than a mount that
 * never rendered.
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
const asValue: Envelope = (rows) => ({ value: rows, total: rows.length });

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

describe('ObjectView — the find() envelope its non-grid fetch reads (objectui#6840)', () => {
  it("still reads the contract's `data` member", async () => {
    await waitFor(async () => expect(await deliveredThrough(asData)).toHaveLength(2));
  });

  it('still reads a bare array — the live non-envelope shape fakes answer with', async () => {
    expect(await deliveredThrough(asBareArray)).toHaveLength(2);
  });

  it('does NOT read `value` — not a QueryResult member, it is the OData spelling', async () => {
    // Nothing delivered: the envelope was refused. Before the fix the two rows
    // above reached the board off a key `QueryResult` does not declare — one
    // the adapters below this seam have already folded into `data`.
    expect(await deliveredThrough(asValue)).toHaveLength(0);
  });
});
