/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DetailView } from '../DetailView';
import { InlineEditProvider } from '@object-ui/react';
import type { DetailViewSchema } from '@object-ui/types';

/**
 * DetailView approval-lock band (objectui#2618).
 *
 * The band renders only when the DetailView's own header is suppressed
 * (`showHeader === false`, composed under a Lightning-style page header) and
 * inline editing is enabled. It must engage from the HOST-supplied lock
 * signal (`InlineEditProvider locked`) — not only the record's own
 * `approval_status` field — because some backends track the lock via an open
 * approval *request* and never materialize an `approval_status` on the record.
 * Without this the lock was real (writes rejected with RECORD_LOCKED) yet the
 * band silently never showed.
 */

const baseSchema: DetailViewSchema = {
  type: 'detail-view',
  title: 'Budget',
  objectName: 'budget',
  showHeader: false,
  data: { id: 'B1', name: 'Q3 Budget' },
  sections: [{ title: 'Basics', fields: [{ name: 'name', label: 'Name' }] }],
};

function renderBand(
  providerProps: {
    locked?: boolean;
    lockedReason?: string;
    canEdit?: boolean;
    approvalPending?: boolean;
  },
  data?: Record<string, unknown>,
) {
  return render(
    <InlineEditProvider canEdit={providerProps.canEdit ?? false} {...providerProps}>
      <DetailView schema={{ ...baseSchema, data: { ...baseSchema.data, ...data } }} inlineEdit />
    </InlineEditProvider>,
  );
}

describe('DetailView – approval-lock band (objectui#2618)', () => {
  it('shows the band from the host lock signal even with no approval_status field', () => {
    renderBand({ locked: true });
    // Backend tracks the lock via approval request only → record carries no
    // approval_status, but the host threads `locked` — band must still show.
    expect(screen.getByText('Locked for approval')).toBeInTheDocument();
  });

  it('uses the host-supplied lockedReason as the badge tooltip', () => {
    renderBand({ locked: true, lockedReason: 'Pending manager approval' });
    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('title', 'Pending manager approval');
  });

  it('still shows the band from the record field for field-tracked backends', () => {
    // No host `locked`, but the record materializes approval_status — the
    // legacy field-only signal remains a valid fallback.
    renderBand({ locked: false }, { approval_status: 'pending' });
    expect(screen.getByText('Locked for approval')).toBeInTheDocument();
  });

  it('does not show the band when neither signal indicates a lock', () => {
    renderBand({ locked: false }, { approval_status: 'draft' });
    expect(screen.queryByText('Locked for approval')).not.toBeInTheDocument();
  });
});

/**
 * A pending approval whose node declares `lockRecord: false` (#3794).
 *
 * The server's lock hook returns early on that node, so the record IS editable
 * while the request is open — the whole point of the setting is letting the
 * approver amend the record as part of deciding on it. The band used to render
 * "Locked for approval" here anyway, so approvers never tried to edit and the
 * capability was invisible. The host now threads both signals: `approvalPending`
 * (a request is open) and `locked` (writes are blocked).
 */
describe('DetailView – pending approval that does NOT lock (#3794)', () => {
  it('shows the editable variant, not the lock band', () => {
    renderBand({ locked: false, approvalPending: true, canEdit: true });
    expect(screen.getByText('In approval (editable)')).toBeInTheDocument();
    expect(screen.queryByText('Locked for approval')).not.toBeInTheDocument();
  });

  it('host signals win over the record approval_status mirror', () => {
    // The mirror field only ever says "in approval" — it cannot express the
    // node's lock policy. A host that resolved the pending REQUEST knows better,
    // so its `locked: false` must not be re-locked by the field fallback.
    renderBand(
      { locked: false, approvalPending: true, canEdit: true },
      { approval_status: 'pending' },
    );
    expect(screen.getByText('In approval (editable)')).toBeInTheDocument();
    expect(screen.queryByText('Locked for approval')).not.toBeInTheDocument();
  });

  it('still shows the lock band when the host says the node locks', () => {
    renderBand({ locked: true, approvalPending: true });
    expect(screen.getByText('Locked for approval')).toBeInTheDocument();
    expect(screen.queryByText('In approval (editable)')).not.toBeInTheDocument();
  });

  it('shows no band once the host reports no pending request', () => {
    // Approval finished but the mirror field lags (or was never cleared): the
    // host is authoritative, so no band — neither variant.
    renderBand(
      { locked: false, approvalPending: false, canEdit: true },
      { approval_status: 'pending' },
    );
    expect(screen.queryByText('Locked for approval')).not.toBeInTheDocument();
    expect(screen.queryByText('In approval (editable)')).not.toBeInTheDocument();
  });
});
