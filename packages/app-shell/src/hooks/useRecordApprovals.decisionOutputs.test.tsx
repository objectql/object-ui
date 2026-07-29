/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * What the record header actually POSTs when an approver decides
 * (objectui#2955).
 *
 * The hook used to send `{ actorId, comment }` and nothing else, so an approval
 * node that declared `decisionOutputs` lost them on this surface: the flow
 * resumed with `vars.<node>.<key>` missing, and the next node's `expression`
 * approver either faulted (`EXPRESSION_FAILED`) or fell through to
 * `onEmptyApprovers`. Nothing surfaced to the approver.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useRecordApprovals } from './useRecordApprovals';

const PENDING = {
  id: 'req_1',
  process_name: 'flow:showcase_dynamic_approval',
  object_name: 'showcase_announcement',
  record_id: 'a1',
  status: 'pending',
  pending_approvers: ['user_1'],
  decision_output_defs: [
    { key: 'parallel_positions', label: '并行会审岗位', type: 'position', multiple: true },
  ],
};

/** POST bodies captured per decide call. */
let posts: Array<{ url: string; body: any }>;

beforeEach(() => {
  posts = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push({ url: String(url), body: JSON.parse(String(init.body)) });
        return { ok: true, json: async () => ({ request: { ...PENDING, status: 'approved' } }) } as any;
      }
      return { ok: true, json: async () => ({ data: [PENDING] }) } as any;
    }),
  );
});

const mount = async () => {
  const view = renderHook(() => useRecordApprovals('showcase_announcement', 'a1', 'user_1'));
  await waitFor(() => expect(view.result.current.canDecide).toBe(true));
  return view;
};

describe('useRecordApprovals — decision outputs in the decide body (objectui#2955)', () => {
  it('posts the collected outputs under the nested `outputs` key', async () => {
    const { result } = await mount();
    await act(async () => {
      await result.current.approve({
        comment: 'ok',
        outputs: { parallel_positions: ['pos_1', 'pos_2'] },
      });
    });
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toContain('/approvals/requests/req_1/approve');
    expect(posts[0].body).toEqual({
      actorId: 'user_1',
      comment: 'ok',
      outputs: { parallel_positions: ['pos_1', 'pos_2'] },
    });
  });

  it('rejects with outputs too — a send-back can route the next round as well', async () => {
    const { result } = await mount();
    await act(async () => {
      await result.current.reject({ outputs: { parallel_positions: ['pos_1'] } });
    });
    expect(posts[0].url).toContain('/approvals/requests/req_1/reject');
    expect(posts[0].body).toEqual({
      actorId: 'user_1',
      outputs: { parallel_positions: ['pos_1'] },
    });
  });

  it('omits `outputs` entirely when the node declares none', async () => {
    // The unchanged body for every approval without `decisionOutputs` — the
    // service must not start seeing an empty object where nothing was sent.
    const { result } = await mount();
    await act(async () => {
      await result.current.approve({ comment: 'ok', outputs: {} });
    });
    expect(posts[0].body).toEqual({ actorId: 'user_1', comment: 'ok' });
    expect('outputs' in posts[0].body).toBe(false);
  });

  it('surfaces the node declaration so the header can build its pickers', async () => {
    const { result } = await mount();
    expect(result.current.pendingRequest?.decision_output_defs).toEqual(
      PENDING.decision_output_defs,
    );
  });
});
