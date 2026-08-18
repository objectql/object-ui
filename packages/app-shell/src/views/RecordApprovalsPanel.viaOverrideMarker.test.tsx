/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The timeline marks an admin override (objectui#5178).
 *
 * framework#4466 added `sys_approval_action.via_override` precisely because
 * "an override and an ordinary approval were byte-for-byte identical" in the
 * audit trail — and its own *Expected* said the marker should be surfaced in
 * the timeline. That half never landed: the column was written by the service,
 * projected by `rowFromAction`, sent by
 * `GET /approvals/requests/:id/actions` — and read by nothing. Measured on
 * objectui `main` @ `a2a974779`, `via_override` had ZERO hits repo-wide.
 *
 * So this pins the read: an override row says so, and — just as important — a
 * row that is NOT an override, and a row too old to know, both stay silent.
 * A marker that appears on ordinary approvals is worse than no marker.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import type { ApprovalRequestLite } from '../hooks/useRecordApprovals';

vi.mock('@object-ui/auth', () => ({ createAuthenticatedFetch: () => vi.fn() }));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { RecordApprovalsPanel } from './RecordApprovalsPanel';

const REQUEST: ApprovalRequestLite = {
  id: 'req_1',
  process_name: 'flow:budget',
  process_label: 'Budget Approval',
  object_name: 'budget',
  record_id: 'rec_1',
  status: 'approved',
  submitter_id: 'u_submitter',
  submitted_at: '2026-08-01T08:00:00Z',
  completed_at: '2026-08-03T08:00:00Z',
};

/**
 * One thread carrying all three states of the column at once, so the assertions
 * below are about the ROW and not about the panel happening to render a chip
 * somewhere. The two approvals are otherwise identical — same action, same
 * step — which is exactly the indistinguishability being fixed.
 */
const ACTIONS = [
  {
    id: 'a1', request_id: 'req_1', action: 'submit',
    actor_id: 'u_submitter', actor_name: 'Zhou Ming', created_at: '2026-08-01T08:00:00Z',
  },
  {
    id: 'a2', request_id: 'req_1', action: 'approve', step_name: 'stage_one',
    actor_id: 'u_qa_head', actor_name: 'Qian Hua', created_at: '2026-08-02T08:00:00Z',
    via_override: false,
  },
  {
    id: 'a3', request_id: 'req_1', action: 'approve', step_name: 'stage_two',
    actor_id: 'u_admin', actor_name: 'Sun Wei', created_at: '2026-08-03T08:00:00Z',
    via_override: true,
  },
  {
    id: 'a4', request_id: 'req_1', action: 'approve', step_name: 'stage_zero',
    actor_id: 'u_legacy', actor_name: 'Old Row', created_at: '2026-07-01T08:00:00Z',
    // No `via_override` at all — written before framework#4466 added the column.
  },
];

function stubApi(rows: any[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (/\/approvals\/requests\/[^/]+\/actions$/.test(String(url))) {
        return { ok: true, json: async () => ({ data: rows }) } as any;
      }
      return { ok: false, status: 404, json: async () => ({}) } as any;
    }),
  );
}

async function renderPanel(rows: any[] = ACTIONS) {
  stubApi(rows);
  const view = render(
    <RecordApprovalsPanel
      approvals={{ available: true, requests: [REQUEST], pendingRequest: null }}
      currentUserId="u_viewer"
    />,
  );
  await screen.findByTestId('record-approvals-panel');
  return view;
}

/** The `<li>` a given actor's row renders into. */
function rowFor(actorName: string): HTMLElement {
  const cell = screen.getByText(actorName);
  const li = cell.closest('li');
  if (!li) throw new Error(`no timeline row for ${actorName}`);
  return li as HTMLElement;
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RecordApprovalsPanel — via_override marker (objectui#5178)', () => {
  it('marks the override row, and only the override row', async () => {
    await renderPanel();
    // Exactly one chip in the whole timeline, on the row that earned it.
    expect(screen.getAllByTestId('via-override-chip')).toHaveLength(1);
    expect(within(rowFor('Sun Wei')).getByTestId('via-override-chip')).toBeTruthy();
  });

  it('leaves a checked-and-NOT-override approval unmarked', async () => {
    await renderPanel();
    // `via_override: false` is a positive statement that this was an ordinary
    // approval. Marking it would be a false accusation in an audit surface.
    expect(within(rowFor('Qian Hua')).queryByTestId('via-override-chip')).toBeNull();
  });

  it('leaves a pre-column row unmarked — "not recorded" is not "not an override"', async () => {
    await renderPanel();
    expect(within(rowFor('Old Row')).queryByTestId('via-override-chip')).toBeNull();
  });

  it('still reads as an approval — the marker annotates, it does not replace', async () => {
    await renderPanel();
    const row = rowFor('Sun Wei');
    expect(row.textContent).toContain('Approved');
    expect(row.textContent).toContain('Sun Wei');
    expect(row.textContent).toContain('Admin override');
  });

  it('gives the override row a different timeline dot from an ordinary approval', async () => {
    // The "byte-for-byte identical" complaint is about a glance down the
    // timeline, not only about reading one row's text.
    await renderPanel();
    const dot = (actor: string) => rowFor(actor).querySelector('span[aria-hidden]')?.className ?? '';
    expect(dot('Sun Wei')).toContain('bg-amber-500');
    expect(dot('Qian Hua')).toContain('bg-emerald-500');
    expect(dot('Sun Wei')).not.toBe(dot('Qian Hua'));
  });

  it('renders no chip at all for a thread with no overrides', async () => {
    await renderPanel(ACTIONS.filter((a) => a.via_override !== true));
    expect(screen.queryAllByTestId('via-override-chip')).toHaveLength(0);
  });
});
