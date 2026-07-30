/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { partitionBulkRows } from '../bulkEligibility';

const ROWS = [
  { id: 'r1', done: false, owner: 'u1' },
  { id: 'r2', done: true, owner: 'u2' },
  { id: 'r3', done: false, owner: 'u2' },
];

afterEach(() => vi.restoreAllMocks());

describe('partitionBulkRows', () => {
  it('passes everything through when the def declares no visible', () => {
    const { eligible, skipped } = partitionBulkRows({ name: 'push' }, ROWS);

    // By reference — the ungated case must not bust downstream memos.
    expect(eligible).toBe(ROWS);
    expect(skipped).toBe(0);
  });

  it('evaluates a row-scoped predicate PER RECORD', () => {
    const { eligible, skipped } = partitionBulkRows({ name: 'mark_done', visible: '!record.done' }, ROWS);

    expect(eligible.map(r => r.id)).toEqual(['r1', 'r3']);
    expect(skipped).toBe(1);
  });

  it('answers the inverse predicate correctly too', () => {
    // The regression this exists for: with no record in scope BOTH
    // `!record.done` and `record.done` evaluated `true`, so one of them was
    // necessarily wrong and nothing could tell which.
    const { eligible } = partitionBulkRows({ name: 'reopen', visible: 'record.done' }, ROWS);

    expect(eligible.map(r => r.id)).toEqual(['r2']);
  });

  it('binds the host scope alongside the record', () => {
    const { eligible } = partitionBulkRows(
      { name: 'mine', visible: 'record.owner == current_user.id' },
      ROWS,
      { scope: { current_user: { id: 'u2' } } },
    );

    expect(eligible.map(r => r.id)).toEqual(['r2', 'r3']);
  });

  it('gives a record-free predicate the same verdict for every row', () => {
    // This is what makes a plain feature/permission gate keep behaving as a
    // BUTTON-level gate without the fold having to detect record references.
    const on = partitionBulkRows({ name: 'x', visible: 'features.bulk_ops' }, ROWS, {
      scope: { features: { bulk_ops: true } },
    });
    const off = partitionBulkRows({ name: 'x', visible: 'features.bulk_ops' }, ROWS, {
      scope: { features: { bulk_ops: false } },
    });

    expect(on.eligible).toHaveLength(3);
    expect(off.eligible).toHaveLength(0);
    expect(off.skipped).toBe(3);
  });

  it('fails CLOSED and warns when a predicate faults', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { eligible, skipped } = partitionBulkRows(
      { name: 'broken', visible: 'record.missing.deep == 1' },
      ROWS,
    );

    expect(eligible).toEqual([]);
    expect(skipped).toBe(3);
    // Diagnosable rather than a silent hide.
    expect(warn).toHaveBeenCalled();
  });

  it('accepts the { dialect, source } envelope', () => {
    const { eligible } = partitionBulkRows(
      { name: 'mark_done', visible: { dialect: 'cel', source: '!record.done' } },
      ROWS,
    );

    expect(eligible.map(r => r.id)).toEqual(['r1', 'r3']);
  });

  it('handles an empty selection without faulting', () => {
    const { eligible, skipped } = partitionBulkRows({ name: 'x', visible: '!record.done' }, []);

    expect(eligible).toEqual([]);
    expect(skipped).toBe(0);
  });
});
