/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// In preview mode regardless of the URL plumbing — we are testing the bar's
// own count logic, not the query-flag reader.
vi.mock('../PreviewModeContext', () => ({
  usePreviewDrafts: () => true,
  markPreviewExit: vi.fn(),
  PREVIEW_QUERY_FLAG: 'preview',
}));
vi.mock('@object-ui/i18n', () => ({
  useObjectTranslation: () => ({
    t: (_k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? _k,
  }),
}));
vi.mock('../usePublishAllDrafts', () => ({
  usePublishAllDrafts: () => ({ publishAll: vi.fn(async () => ({ ok: true })), publishing: false }),
}));
vi.mock('../DraftChangesPanel', () => ({ DraftChangesPanel: () => null }));

import { DraftPreviewBar } from '../DraftPreviewBar';

function renderBar() {
  return render(
    <MemoryRouter initialEntries={['/app/x?preview=draft']}>
      <DraftPreviewBar />
    </MemoryRouter>,
  );
}

function mockDrafts(list: unknown) {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => list })) as unknown as typeof fetch;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DraftPreviewBar', () => {
  it('drops the redundant Publish affordance when there are zero pending drafts (auto-publish norm)', async () => {
    mockDrafts([]);
    renderBar();
    // The bar is always the preview-mode indicator…
    expect(screen.getByTestId('draft-preview-bar')).toBeInTheDocument();
    // …but once we KNOW the count is zero, Publish + Changes go away and the
    // copy stops claiming nothing is live.
    await waitFor(() => {
      expect(screen.queryByTestId('draft-preview-publish')).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId('draft-preview-changes')).not.toBeInTheDocument();
    expect(screen.getByTestId('draft-preview-bar')).toHaveTextContent(/no unpublished changes/i);
    expect(screen.getByTestId('draft-preview-exit')).toBeInTheDocument();
  });

  it('keeps Publish + the warning message + Changes(N) when drafts are genuinely pending', async () => {
    mockDrafts([{ type: 'object', name: 'a' }, { type: 'object', name: 'b' }]);
    renderBar();
    await waitFor(() => {
      expect(screen.getByTestId('draft-preview-publish')).toBeInTheDocument();
    });
    expect(screen.getByTestId('draft-preview-changes')).toHaveTextContent('(2)');
    expect(screen.getByTestId('draft-preview-bar')).toHaveTextContent(/Nothing here is live until you publish/i);
  });

  it('keeps Publish visible when the draft count is unknown (fetch failed) — only a known zero relaxes', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, json: async () => null })) as unknown as typeof fetch;
    renderBar();
    // pendingCount stays null → not known-zero → safe default keeps the publish path.
    await waitFor(() => {
      expect(screen.getByTestId('draft-preview-publish')).toBeInTheDocument();
    });
  });
});
