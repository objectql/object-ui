/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * What the record page reads off an approval, after the hook stopped deciding
 * (objectui#3055).
 *
 * The hook used to own a `canDecide` + `approve`/`reject` pair that the record
 * header wired to two hand-written buttons. Those are gone: the header renders
 * `sys_approval_request`'s declared actions instead, so all this hook owes it is
 * (a) the request those actions run against, `viewer` block intact, and (b) the
 * pending request that drives the status band and the record lock.
 *
 * `liveRequest` is deliberately wider than `pendingRequest`: an ADR-0044
 * `returned` request has no lock and no approver, but it is exactly the state in
 * which the submitter reworks the record — on this page — and resubmits.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRecordApprovals } from './useRecordApprovals';

const REQUEST = {
  id: 'req_1',
  process_name: 'flow:qif_approval',
  object_name: 'qif',
  record_id: 'QIF202607310002',
  status: 'pending',
  submitter_id: 'u_qc',
  pending_approvers: ['position:qc_director'],
  lock_record: true,
  decision_output_defs: [
    { key: 'parallel_positions', label: '并行会审岗位', type: 'position', multiple: true },
  ],
  viewer: { can_act: true, is_submitter: false, can_override: false },
};

/** Every request the fake backend returns for the record. */
let rows: any[];

beforeEach(() => {
  rows = [REQUEST];
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ data: rows }) }) as any),
  );
});

const mount = () => renderHook(() => useRecordApprovals('qif', 'QIF202607310002'));

describe('useRecordApprovals — the state the record header consumes (objectui#3055)', () => {
  it('surfaces the server-computed `viewer` block untouched', async () => {
    // The declared actions' `visible` CEL gates on this and nothing else — a
    // group approver resolves here where a client-side `pending_approvers`
    // membership test never could.
    const { result } = mount();
    await waitFor(() => expect(result.current.liveRequest).not.toBeNull());
    expect(result.current.liveRequest?.viewer).toEqual({
      can_act: true, is_submitter: false, can_override: false,
    });
  });

  it('carries the node declaration the decide dialogs build their pickers from', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.liveRequest).not.toBeNull());
    expect(result.current.liveRequest?.decision_output_defs).toEqual(REQUEST.decision_output_defs);
  });

  it('treats a `returned` request as live but NOT as pending', async () => {
    // The record is unlocked for rework (no `pendingRequest`), yet the header
    // must still offer Resubmit / Recall — which is what `liveRequest` feeds.
    rows = [{ ...REQUEST, status: 'returned', lock_record: false }];
    const { result } = mount();
    await waitFor(() => expect(result.current.liveRequest).not.toBeNull());
    expect(result.current.liveRequest?.status).toBe('returned');
    expect(result.current.pendingRequest).toBeNull();
  });

  it('prefers the pending request when an earlier round is still on the record', async () => {
    rows = [{ ...REQUEST, id: 'req_0', status: 'returned' }, REQUEST];
    const { result } = mount();
    await waitFor(() => expect(result.current.liveRequest).not.toBeNull());
    expect(result.current.liveRequest?.id).toBe('req_1');
  });

  it('has no live request once the approval is finished', async () => {
    rows = [{ ...REQUEST, status: 'approved', completed_at: '2026-07-31T02:00:00Z' }];
    const { result } = mount();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.liveRequest).toBeNull();
    expect(result.current.pendingRequest).toBeNull();
    // The finished request is still readable for the status band.
    expect(result.current.latestRequest?.status).toBe('approved');
  });

  it('never posts a decision itself', async () => {
    // The decide call belongs to the declared `type:'api'` action now; this
    // hook only ever GETs. A POST from here would be the second implementation
    // coming back.
    const { result } = mount();
    await waitFor(() => expect(result.current.liveRequest).not.toBeNull());
    const calls = (globalThis.fetch as any).mock.calls as any[][];
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every(([, init]) => (init?.method ?? 'GET') === 'GET')).toBe(true);
  });
});
