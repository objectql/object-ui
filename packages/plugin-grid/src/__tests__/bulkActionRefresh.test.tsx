/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Regression (#2159): after selecting rows and running a string bulk action
 * (e.g. 下推 / 派工 declared via `batchActions`), the operation succeeded on the
 * server but the list never refreshed — it stayed on stale data, and the
 * selection toolbar was left in place.
 *
 * Root cause: `dispatchBulkAction`'s non-delete branch fired `executeAction`
 * and stopped there — no `refreshKey` bump, no selection reset. Only the
 * BulkActionDialog (rich def) and delete branches refreshed. This drives the
 * full path (header checkbox → BulkActionBar → dispatchBulkAction →
 * ActionRunner custom handler) against an in-memory fake server, so a passing
 * test means the grid refetches after the action and a failing one pinpoints
 * the missing refresh.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { ObjectGrid } from '../ObjectGrid';
import { registerAllFields } from '@object-ui/fields';
import { ActionProvider } from '@object-ui/react';

registerAllFields();

beforeAll(() => {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn() as any;
  }
});

const OBJECT = 'os_prod_plan';

// A fake server backed by a mutable store, so a bulk action can mutate records
// and a subsequent find() returns the new value — exactly like a real backend.
function makeDataSource() {
  const store: Record<string, any> = {
    r1: { id: 'r1', name: 'Plan A', status: 'draft' },
    r2: { id: 'r2', name: 'Plan B', status: 'draft' },
  };
  const find = vi.fn(async () => {
    const data = Object.values(store).map((r) => ({ ...r }));
    return { data, total: data.length, hasMore: false, pageSize: 50 };
  });
  return {
    store,
    find,
    getObjectSchema: async (name: string) => ({
      name,
      fields: {
        id: { type: 'text' },
        name: { type: 'text' },
        status: { type: 'text' },
      },
    }),
  } as any;
}

function renderGrid(dataSource: any, handlers: Record<string, any>) {
  const schema: any = {
    type: 'object-grid',
    objectName: OBJECT,
    // String bulk action — the path 下推 / 派工 travels.
    batchActions: ['approve'],
    columns: [
      { field: 'name', label: 'Name' },
      { field: 'status', label: 'Status' },
    ],
    pagination: { pageSize: 50 },
  };
  return render(
    <ActionProvider handlers={handlers}>
      <ObjectGrid schema={schema} dataSource={dataSource} />
    </ActionProvider>,
  );
}

describe('ObjectGrid — string bulk action refreshes the list on success', () => {
  it('refetches and clears the selection after a batchAction succeeds', async () => {
    const ds = makeDataSource();
    // A custom bulk action that mutates the "server" and reports success.
    const approve = vi.fn(async () => {
      Object.values(ds.store).forEach((r: any) => { r.status = 'approved'; });
      return { success: true };
    });
    renderGrid(ds, { approve });

    await waitFor(() => expect(screen.getByText('Plan A')).toBeInTheDocument());
    // Initial "draft" is on screen; no "approved" yet.
    expect(screen.getAllByText('draft').length).toBeGreaterThan(0);
    const findCallsBefore = ds.find.mock.calls.length;

    // Select all rows on the page (header checkbox), then run the bulk action.
    const headerCheckbox = document.querySelector('thead [role="checkbox"]') as HTMLElement;
    expect(headerCheckbox).toBeTruthy();
    fireEvent.click(headerCheckbox);

    const approveBtn = await screen.findByTestId('bulk-action-approve');
    fireEvent.click(approveBtn);

    // The handler ran against the selected records.
    await waitFor(() => expect(approve).toHaveBeenCalledTimes(1));

    // The list refetched — the grid reflects the server state (draft → approved).
    await waitFor(() =>
      expect(ds.find.mock.calls.length).toBeGreaterThan(findCallsBefore),
    );
    await waitFor(() => expect(screen.getAllByText('approved').length).toBeGreaterThan(0));

    // And the selection toolbar reset (no stuck "N selected" bar).
    await waitFor(() =>
      expect(screen.queryByTestId('bulk-actions-bar')).not.toBeInTheDocument(),
    );
  });

  it('does NOT refresh or clear selection when the bulk action fails', async () => {
    const ds = makeDataSource();
    // A failing action must leave the selection intact (so the user can retry)
    // and must not trigger a phantom refresh.
    const approve = vi.fn(async () => ({ success: false, error: 'nope' }));
    renderGrid(ds, { approve });

    await waitFor(() => expect(screen.getByText('Plan A')).toBeInTheDocument());
    const findCallsBefore = ds.find.mock.calls.length;

    const headerCheckbox = document.querySelector('thead [role="checkbox"]') as HTMLElement;
    fireEvent.click(headerCheckbox);
    const approveBtn = await screen.findByTestId('bulk-action-approve');
    fireEvent.click(approveBtn);

    await waitFor(() => expect(approve).toHaveBeenCalledTimes(1));

    // Give any (unwanted) refetch a chance to fire, then assert none did and the
    // selection bar is still present.
    await new Promise((r) => setTimeout(r, 50));
    expect(ds.find.mock.calls.length).toBe(findCallsBefore);
    expect(screen.queryByTestId('bulk-actions-bar')).toBeInTheDocument();
  });
});
