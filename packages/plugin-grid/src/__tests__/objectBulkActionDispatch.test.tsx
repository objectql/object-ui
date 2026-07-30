/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * An object-declared bulk action must reach the ActionRunner as a real action
 * DEF, applied to every selected record (objectui#3002).
 *
 * Before this, `bulkActions: ['push_down']` dispatched the action NAME in the
 * runner's `type` slot — `{ type: 'push_down', params: { records } }` — which
 * matches no built-in type and no handler, so it fell through the runner's
 * schema fallback (green success toast pre-#2996, a loud failure after it).
 * Either way the action never ran. And an object could not declare a bulk
 * action at all: `bulkActionDefs` was passed through from view JSON verbatim,
 * never derived from `objectDef.actions`.
 *
 * These drive the REAL ObjectGrid through a real ActionProvider and assert the
 * user-visible outcome: selecting rows and clicking the button issues one
 * request per selected record.
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

vi.mock('@object-ui/permissions', () => ({
  usePermissions: () => ({ isLoaded: false, checkField: () => true, getObjectApiOperations: () => undefined }),
}));

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
const ROWS = [
  { id: 'r1', name: 'Plan A' },
  { id: 'r2', name: 'Plan B' },
];

/**
 * The object's own bulk action. The label is deliberately NOT the humanization
 * of the name ("Push Down"), so an assertion on it distinguishes the resolved
 * def from the legacy path — which could only ever render `formatActionLabel`.
 */
const PUSH_DOWN = {
  name: 'push_down',
  label: '下推',
  type: 'api',
  target: '/api/v1/plans/push',
  recordIdParam: 'planId',
  bulkEnabled: true,
};

let fetchMock: ReturnType<typeof vi.fn>;

function renderGrid(opts: {
  objectActions?: unknown[];
  schema?: Record<string, unknown>;
  handlers?: Record<string, any>;
}) {
  const dataSource: any = {
    find: vi.fn(async () => ({ data: ROWS.map(r => ({ ...r })), total: ROWS.length, hasMore: false, pageSize: 50 })),
    getObjectSchema: async (name: string) => ({
      name,
      fields: { id: { type: 'text' }, name: { type: 'text', label: 'Name' } },
      ...(opts.objectActions ? { actions: opts.objectActions } : {}),
    }),
  };
  const schema: any = {
    type: 'object-grid',
    objectName: OBJECT,
    columns: [{ field: 'name', label: 'Name' }],
    pagination: { pageSize: 50 },
    ...opts.schema,
  };
  render(
    <ActionProvider handlers={opts.handlers ?? {}}>
      <ObjectGrid schema={schema} dataSource={dataSource} />
    </ActionProvider>,
  );
  return dataSource;
}

/** Render, wait for rows + the async schema fetch, then select every row. */
async function renderAndSelectAll(opts: Parameters<typeof renderGrid>[0]) {
  const ds = renderGrid(opts);
  await waitFor(() => expect(screen.getByText('Plan A')).toBeInTheDocument());
  // The derivation depends on `getObjectSchema`, so an assertion taken before
  // it lands would read the pre-fetch (underived) state.
  await waitFor(() => expect(document.querySelector('thead [role="checkbox"]')).toBeTruthy());
  fireEvent.click(document.querySelector('thead [role="checkbox"]') as HTMLElement);
  return ds;
}

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: () => 'application/json' },
    json: async () => ({ success: true }),
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('object-declared bulk actions (objectui#3002)', () => {
  it('surfaces a bulkEnabled object action with no view declaration at all', async () => {
    await renderAndSelectAll({ objectActions: [PUSH_DOWN] });

    const button = await screen.findByTestId('bulk-action-push_down');
    // The object action's own label, not `formatActionLabel('push_down')`.
    expect(button).toHaveTextContent('下推');
  });

  it('issues one request per selected record instead of no-opping', async () => {
    await renderAndSelectAll({ objectActions: [PUSH_DOWN] });

    fireEvent.click(await screen.findByTestId('bulk-action-push_down'));
    // No params on this action → the dialog opens straight on confirm.
    fireEvent.click(await screen.findByRole('button', { name: 'Run' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/plans/push');
    // Each dispatch carries ITS OWN record under `_rowRecord` — the same
    // row-context key the list_item path attaches, which is what lets the
    // host's api handler perform `recordIdParam` injection unchanged.
    const sentIds = fetchMock.mock.calls
      .map(c => JSON.parse((c[1] as any).body)._rowRecord.id)
      .sort();
    expect(sentIds).toEqual(['r1', 'r2']);
  });

  it('resolves a legacy bulkActions name to the declared action', async () => {
    // The reported shape: the object never flagged the action, the view names it.
    const unflagged = { ...PUSH_DOWN, bulkEnabled: undefined };
    await renderAndSelectAll({
      objectActions: [unflagged],
      schema: { bulkActions: ['push_down'] },
    });

    const button = await screen.findByTestId('bulk-action-push_down');
    expect(button).toHaveTextContent('下推');

    fireEvent.click(button);
    fireEvent.click(await screen.findByRole('button', { name: 'Run' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('reports per-record failures instead of counting them as successes', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { get: () => 'application/json' },
      json: async () => ({ error: 'precondition not met' }),
    });
    await renderAndSelectAll({ objectActions: [PUSH_DOWN] });

    fireEvent.click(await screen.findByTestId('bulk-action-push_down'));
    fireEvent.click(await screen.findByRole('button', { name: 'Run' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    // The result panel attributes a failure to each record — a runAction that
    // resolved regardless would report "Succeeded 2 / 2", the #2960 lie in bulk
    // form (and exactly what `operation: 'custom'` did before it could run).
    await waitFor(() => expect(screen.getByText(/Succeeded 0 \/ 2/)).toBeInTheDocument());
    expect(screen.getByTestId('bulk-error-row-r1')).toHaveTextContent('HTTP 422');
    expect(screen.getByTestId('bulk-error-row-r2')).toBeInTheDocument();
    // A derived def re-dispatches for one record, so the row keeps its Retry.
    expect(screen.getByTestId('bulk-error-retry-r1')).toBeInTheDocument();
  });

  it('renders one button when a legacy name repeats a derived action', async () => {
    await renderAndSelectAll({
      objectActions: [PUSH_DOWN],
      schema: { bulkActions: ['push_down'] },
    });

    await waitFor(() => expect(screen.getAllByTestId('bulk-action-push_down')).toHaveLength(1));
  });

  it('keeps an unresolvable legacy name alongside the derived defs', async () => {
    // A name the object never declared may still have a runner handler
    // registered under it; hiding it because some OTHER def exists dropped
    // half the bar's buttons.
    const handler = vi.fn(async () => ({ success: true }));
    await renderAndSelectAll({
      objectActions: [PUSH_DOWN],
      schema: { bulkActions: ['crm_only_handler'] },
      handlers: { crm_only_handler: handler },
    });

    expect(await screen.findByTestId('bulk-action-push_down')).toBeInTheDocument();
    const legacy = await screen.findByTestId('bulk-action-crm_only_handler');
    fireEvent.click(legacy);
    await waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
  });
});
