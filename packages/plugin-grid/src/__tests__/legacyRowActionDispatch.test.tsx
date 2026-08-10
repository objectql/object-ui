/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Legacy string `rowActions` must reach the ActionRunner as a real action DEF
 * (objectui#2960).
 *
 * A view declaring `rowActions: ['convert_lead']` used to dispatch the action
 * NAME in the runner's `type` slot — `{ type: 'convert_lead' }`. That matches
 * no built-in type and no registered handler, so it fell through the runner's
 * schema fallback: zero requests, then a green "Action completed successfully"
 * toast. And because an object action declaring `locations: ['list_item']`
 * also injects its own (working) entry, the same action could render twice —
 * one live, one dead.
 *
 * These drive the REAL ObjectGrid through a real ActionProvider and assert the
 * user-visible outcome: the click issues the action's request, and the menu
 * carries one entry per action rather than a working/dead pair.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import React from 'react';

vi.mock('@object-ui/permissions', () => ({
  usePermissions: () => ({ isLoaded: false, checkField: () => true, getObjectApiOperations: () => undefined, can: () => true }),
}));

import { ObjectGrid } from '../ObjectGrid';
import { registerAllFields } from '@object-ui/fields';
import { ActionProvider, SchemaRendererProvider } from '@object-ui/react';

registerAllFields();

const OBJECT = 'lead';
const ROWS = [{ id: '1', name: 'Alice' }];

/**
 * The object's own `convert_lead` action — an api call to a custom route. The
 * label is deliberately NOT the humanization of the name ("Convert Lead"), so
 * an assertion on it can tell the resolved def apart from the legacy path,
 * which could only ever render `formatActionLabel(name)`.
 */
const CONVERT_LEAD = {
  name: 'convert_lead',
  label: 'Convert to Account',
  type: 'api',
  target: '/api/v1/leads/convert',
  locations: ['record_header'],
};

let fetchMock: ReturnType<typeof vi.fn>;

function renderGrid(opts: { objectActions?: unknown[]; schema?: Record<string, unknown> }) {
  const dataSource: any = {
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
    data: { provider: 'value', items: ROWS },
    ...opts.schema,
  };
  return render(
    <ActionProvider>
      <SchemaRendererProvider dataSource={dataSource}>
        <ObjectGrid schema={schema} dataSource={dataSource} />
      </SchemaRendererProvider>
    </ActionProvider>,
  );
}

/** Render, wait for the async schema fetch to settle, then open the row kebab. */
async function openRowMenu(opts: Parameters<typeof renderGrid>[0]) {
  renderGrid(opts);
  await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
  // The promotion depends on `getObjectSchema`, so an assertion taken before
  // it lands would read the pre-fetch (unresolved) state.
  await waitFor(() => expect(screen.getByTestId('row-action-trigger')).toBeInTheDocument());
  await userEvent.click(screen.getByTestId('row-action-trigger'));
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

describe('legacy string rowActions dispatch (objectui#2960)', () => {
  it('issues the resolved action request instead of no-opping', async () => {
    await openRowMenu({
      objectActions: [CONVERT_LEAD],
      schema: { rowActions: ['convert_lead'] },
    });

    await userEvent.click(screen.getByTestId('row-action-convert_lead'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/leads/convert');
  });

  it('renders the object action label, not the humanized name', async () => {
    await openRowMenu({
      objectActions: [CONVERT_LEAD],
      schema: { rowActions: ['convert_lead'] },
    });

    const item = screen.getByTestId('row-action-convert_lead');
    expect(item).toHaveTextContent('Convert to Account');
    expect(item).not.toHaveTextContent('Convert Lead');
  });

  it('does not render a dead duplicate of a list_item action', async () => {
    const listItemDef = { ...CONVERT_LEAD, locations: ['list_item'], label: 'Convert' };
    await openRowMenu({
      objectActions: [listItemDef],
      // The app-shell derives `rowActionDefs` from `locations: ['list_item']`;
      // a view that ALSO names the action in legacy `rowActions` used to get
      // both a working entry and a dead twin.
      schema: { rowActions: ['convert_lead'], rowActionDefs: [listItemDef] },
    });

    expect(screen.getAllByTestId('row-action-convert_lead')).toHaveLength(1);
  });

  it('leaves a name with no declared action to the by-name handler path', async () => {
    // Consumers may register a runner handler under exactly this name, so the
    // entry must still render and still dispatch.
    await openRowMenu({
      objectActions: [CONVERT_LEAD],
      schema: { rowActions: ['crm_only_handler'] },
    });

    expect(screen.getByTestId('row-action-crm_only_handler')).toBeInTheDocument();
    // Nothing resolvable to call — and with the runner's fallback now failing
    // loudly, no request and no success are reported.
    await userEvent.click(screen.getByTestId('row-action-crm_only_handler'));
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });
});
