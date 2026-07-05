/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import '@testing-library/jest-dom/vitest';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@object-ui/i18n', () => ({
  useObjectTranslation: () => ({
    t: (_k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? _k,
  }),
}));

import { DraftChangesPanel, computeChangeDetail } from '../DraftChangesPanel';

afterEach(() => {
  vi.restoreAllMocks();
});

/* ─────────────── computeChangeDetail (pure) ─────────────── */

describe('computeChangeDetail', () => {
  it('classifies a NEW item: every field added, top-level keys changed', () => {
    const draft = {
      name: 'ticket',
      label: 'Ticket',
      fields: { status: { type: 'select' }, title: { type: 'text' } },
    };
    const d = computeChangeDetail(null, draft);
    expect(d.fields?.added.sort()).toEqual(['status', 'title']);
    expect(d.fields?.changed).toEqual([]);
    expect(d.fields?.removed).toEqual([]);
    expect(d.changedKeys).toEqual(['label', 'name']);
  });

  it('diffs an UPDATE: added / changed (with keys) / removed fields, unchanged keys dropped', () => {
    const published = {
      name: 'ticket',
      label: 'Ticket',
      fields: {
        title: { type: 'text', label: 'Title' },
        old_notes: { type: 'textarea' },
      },
    };
    const draft = {
      name: 'ticket',
      label: 'Repair Ticket', // changed
      fields: {
        title: { type: 'text', label: 'Subject' }, // label changed
        status: { type: 'select' }, // added
        // old_notes removed
      },
    };
    const d = computeChangeDetail(published, draft);
    expect(d.fields?.added).toEqual(['status']);
    expect(d.fields?.changed).toEqual([{ name: 'title', keys: ['label'] }]);
    expect(d.fields?.removed).toEqual(['old_notes']);
    expect(d.changedKeys).toEqual(['label']); // `name` unchanged, `fields` handled separately
  });

  it('handles field-less metadata types with a plain top-level key diff', () => {
    const published = { name: 'crm', label: 'CRM', navigation: [{ id: 'a' }] };
    const draft = { name: 'crm', label: 'CRM', navigation: [{ id: 'a' }, { id: 'b' }] };
    const d = computeChangeDetail(published, draft);
    expect(d.fields).toBeNull();
    expect(d.changedKeys).toEqual(['navigation']);
  });

  it('reports no differences when draft matches published', () => {
    const body = { name: 'x', fields: { a: { type: 'text' } } };
    const d = computeChangeDetail(body, structuredClone(body));
    expect(d.fields?.added).toEqual([]);
    expect(d.fields?.changed).toEqual([]);
    expect(d.fields?.removed).toEqual([]);
    expect(d.changedKeys).toEqual([]);
  });
});

/* ─────────────── panel behaviour ─────────────── */

const PUBLISHED_TICKET = {
  name: 'ticket',
  label: 'Ticket',
  fields: { title: { type: 'text' } },
};
const DRAFT_TICKET = {
  name: 'ticket',
  label: 'Ticket',
  fields: { title: { type: 'text' }, status: { type: 'select' } },
};

/** Route fetches by URL shape: _drafts list, published type list, item reads. */
function mockRoutes() {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
    if (url.includes('/_drafts')) {
      return ok([{ type: 'object', name: 'ticket', packageId: 'com.x' }]);
    }
    if (url.includes('state=draft')) {
      return ok({ type: 'object', name: 'ticket', item: DRAFT_TICKET });
    }
    if (/\/meta\/object\/ticket/.test(url)) {
      return ok(PUBLISHED_TICKET);
    }
    if (/\/meta\/object(\?|$)/.test(url)) {
      return ok([{ name: 'ticket' }]);
    }
    return { ok: false, status: 404, json: async () => ({}) };
  }) as unknown as typeof fetch;
}

function renderPanel(extra: Partial<React.ComponentProps<typeof DraftChangesPanel>> = {}) {
  return render(
    <DraftChangesPanel open onOpenChange={() => {}} packageId="com.x" {...extra} />,
  );
}

describe('DraftChangesPanel', () => {
  it('shows no publish footer without onPublish (read-only review, e.g. preview bar)', async () => {
    mockRoutes();
    renderPanel();
    await waitFor(() => expect(screen.getByText('ticket')).toBeInTheDocument());
    expect(screen.queryByTestId('draft-changes-publish')).not.toBeInTheDocument();
  });

  it('renders the confirm footer and forwards the click to onPublish', async () => {
    mockRoutes();
    const onPublish = vi.fn();
    renderPanel({ onPublish });
    await waitFor(() => expect(screen.getByTestId('draft-changes-publish')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('draft-changes-publish'));
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it('disables the confirm button while publishing', async () => {
    mockRoutes();
    renderPanel({ onPublish: vi.fn(), publishing: true });
    await waitFor(() => expect(screen.getByTestId('draft-changes-publish')).toBeInTheDocument());
    expect(screen.getByTestId('draft-changes-publish')).toBeDisabled();
  });

  it('expands an entry into a lazily-fetched field-level diff', async () => {
    mockRoutes();
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('draft-entry-toggle')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('draft-entry-toggle'));
    await waitFor(() => expect(screen.getByTestId('draft-entry-detail')).toBeInTheDocument());
    // status is added in the draft; title unchanged → only the + row shows.
    expect(screen.getByText('+ status')).toBeInTheDocument();
    expect(screen.queryByText(/~ title/)).not.toBeInTheDocument();
  });
});
