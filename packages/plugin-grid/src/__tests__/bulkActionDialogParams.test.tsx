/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * BulkActionDialog param widgets.
 *
 * #2185/#2204 pinned the multi-value path (empty-array required-gating → pick
 * many → array patch → label preview) and the date widget. Since the ADR-0059
 * migration (#3064) params render through the SHARED form field widgets
 * (`@object-ui/fields` via `bulkParamToField`), so these tests now assert the
 * form-widget DOM (multiselect toggle chips, native date input) — and the new
 * lookup suite pins the #3064 contract itself: no eager candidate prefetch,
 * fetch errors surfaced with a Retry affordance, and no failure caching
 * (reopening the picker refetches).
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { BulkActionDialog } from '../components/BulkActionDialog';

beforeAll(() => {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn() as any;
  }
  // Radix Popover/cmdk probe pointer capture APIs that jsdom lacks.
  if (!(Element.prototype as any).hasPointerCapture) {
    (Element.prototype as any).hasPointerCapture = () => false;
  }
  if (!(Element.prototype as any).setPointerCapture) {
    (Element.prototype as any).setPointerCapture = () => {};
  }
});

beforeEach(() => {
  // happy-dom lacks matchMedia; the lookup widgets' useIsMobile needs it.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as any;
});

function makeDataSource() {
  const update = vi.fn(async () => ({}));
  const del = vi.fn(async () => ({}));
  return { update, delete: del } as any;
}

describe('BulkActionDialog — multi-select param produces an array patch', () => {
  it('gates required until a value is picked, sends an array, and previews labels', async () => {
    const ds = makeDataSource();
    const def: any = {
      name: 'set_tags',
      label: 'Set tags',
      operation: 'update',
      params: [
        {
          name: 'tags',
          label: 'Tags',
          type: 'select',
          multiple: true,
          required: true,
          options: [
            { label: 'Red', value: 'red' },
            { label: 'Blue', value: 'blue' },
          ],
        },
      ],
    };
    render(
      <BulkActionDialog
        def={def}
        rows={[{ id: 'r1' }, { id: 'r2' }]}
        resource="thing"
        dataSource={ds}
        open
        onClose={() => {}}
      />,
    );

    // Required multi-select with no selection → Next is disabled (empty array
    // must count as "not filled").
    const next = screen.getByRole('button', { name: 'Next' });
    expect(next).toBeDisabled();

    // The shared MultiSelectField renders toggle chips (same as the form) —
    // await them through the lazy-widget Suspense boundary, then pick both.
    fireEvent.click(await screen.findByTestId('multiselect-option-red'));
    fireEvent.click(await screen.findByTestId('multiselect-option-blue'));

    // Now valid → advance to confirm.
    await waitFor(() => expect(next).toBeEnabled());
    fireEvent.click(next);

    // Confirm step shows the human labels (not the raw ids) for the array value.
    const confirmRun = await screen.findByRole('button', { name: 'Run' });
    expect(screen.getByText(/Red, Blue/)).toBeInTheDocument();

    fireEvent.click(confirmRun);

    // Per-row update fires with the multi-value array intact.
    await waitFor(() => expect(ds.update).toHaveBeenCalledTimes(2));
    expect(ds.update).toHaveBeenCalledWith('thing', 'r1', { tags: ['red', 'blue'] });
    expect(ds.update).toHaveBeenCalledWith('thing', 'r2', { tags: ['red', 'blue'] });
  });
});

describe('BulkActionDialog — date param renders a date picker', () => {
  it('renders a native date input rather than a free-text box', async () => {
    const ds = makeDataSource();
    const def: any = {
      name: 'set_due',
      label: 'Set due date',
      operation: 'update',
      params: [{ name: 'due', label: 'Due', type: 'date' }],
    };
    render(
      <BulkActionDialog
        def={def}
        rows={[{ id: 'r1' }]}
        resource="thing"
        dataSource={ds}
        open
        onClose={() => {}}
      />,
    );
    // Radix Dialog portals to document.body, and the widget loads lazily.
    await waitFor(() => {
      expect(document.querySelector('input[type="date"]')).toBeInTheDocument();
    });
  });
});

describe('BulkActionDialog — lookup param uses the shared record picker (#3064)', () => {
  const lookupDef: any = {
    name: 'assign_queue',
    label: 'Assign queue',
    operation: 'update',
    params: [
      { name: 'queue', label: 'Queue', type: 'lookup', object: 'queues', required: true },
    ],
  };

  it('does not prefetch candidates when the dialog opens', async () => {
    const ds = makeDataSource();
    ds.find = vi.fn(async () => ({ data: [], total: 0 }));
    render(
      <BulkActionDialog
        def={lookupDef}
        rows={[{ id: 'r1' }]}
        resource="thing"
        dataSource={ds}
        open
        onClose={() => {}}
      />,
    );
    // The picker trigger renders (lazy widget) with no candidate query issued —
    // the old dialog fired find(object, {$top: 200}) on open.
    await screen.findByTestId('lookup-trigger-queue');
    expect(ds.find).not.toHaveBeenCalled();
  });

  it('surfaces a failed candidate fetch and retries instead of caching the failure', async () => {
    const ds = makeDataSource();
    ds.find = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ data: [{ id: 'q1', name: 'Support queue' }], total: 1 });
    render(
      <BulkActionDialog
        def={lookupDef}
        rows={[{ id: 'r1' }]}
        resource="thing"
        dataSource={ds}
        open
        onClose={() => {}}
      />,
    );

    // Open the picker → the fetch fails → an error state with a Retry
    // affordance renders (previously: a permanent "Loading…" placeholder).
    fireEvent.click(await screen.findByTestId('lookup-trigger-queue'));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('boom');
    expect(ds.find).toHaveBeenCalledTimes(1);

    // Retry refetches (previously: the failure was cached per param name and
    // no further request was ever issued) and the candidates render.
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText('Support queue');
    expect(ds.find).toHaveBeenCalledTimes(2);
  });
});
