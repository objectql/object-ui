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
  providerProps: { locked?: boolean; lockedReason?: string; canEdit?: boolean },
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
