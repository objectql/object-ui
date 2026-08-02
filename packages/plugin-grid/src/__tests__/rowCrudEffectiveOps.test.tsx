/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ObjectGrid row-level CRUD + bulk delete vs the server's effective API
 * operation set (#3720 — the fourth face of #3391).
 *
 * The main list's row kebab is a chain of its own: it never went through
 * `resolveEffectiveCrudAffordances`, so the toolbar (objectui#2823), detail/form
 * (#3546) and related-list rounds all missed it. `ObjectView` wires
 * `onEdit`/`onDelete` unconditionally and view JSON rarely declares
 * `operations`, so the gate was effectively "always on" — the row Edit/Delete
 * AND the (destructive) bulk delete rendered even for a caller whose effective
 * set carried neither `update` nor `delete`.
 *
 * These probe the REAL ObjectGrid through `usePermissions`, asserting the
 * user-visible outcome (menu items / selection checkboxes / bulk button).
 * The matrix mirrors objectui#2876 and keeps the `userActions` opt-out control
 * group: it proves the assertions can actually observe "hidden", so a hidden
 * result under a restricted effective set is not a false positive.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import React from 'react';

// Stable stub identity: ObjectGrid carries `perms` in `useMemo` dependency
// arrays (the real `usePermissions` memoizes for exactly that reason), so a
// fresh object per call would churn those memos every render. `vi.hoisted`
// builds it before the hoisted `vi.mock` factory runs; the accessor reads
// mutable state so a test can swap the effective set without changing identity.
const { permsStub, state } = vi.hoisted(() => {
  const state: { effectiveOps: string[] | undefined } = { effectiveOps: undefined };
  return {
    state,
    // `isLoaded: false` keeps the FIELD-level filter out of the way so the
    // object-level gate is the only variable under test.
    permsStub: {
      isLoaded: false,
      checkField: () => true,
      getObjectApiOperations: () => state.effectiveOps,
    },
  };
});

vi.mock('@object-ui/permissions', () => ({ usePermissions: () => permsStub }));

import { ObjectGrid } from '../ObjectGrid';
import { registerAllFields } from '@object-ui/fields';
import { ActionProvider, SchemaRendererProvider } from '@object-ui/react';

registerAllFields();

const OBJECT = 'test_object';
const ROWS = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
];

const FULL = ['get', 'list', 'create', 'update', 'delete'];
const READ_ONLY = ['get', 'list'];

interface Case {
  /** Server-resolved effective operation set; `undefined` = no annotation. */
  effectiveOps?: string[];
  /** ADR-0103 lifecycle bucket on the fetched object schema. */
  managedBy?: string;
  userActions?: Record<string, unknown>;
  /** Extra view-schema keys (e.g. an author-declared `bulkActions`). */
  schema?: Record<string, unknown>;
}

function renderGrid(c: Case) {
  state.effectiveOps = c.effectiveOps;
  const dataSource: any = {
    getObjectSchema: async (name: string) => ({
      name,
      ...(c.managedBy ? { managedBy: c.managedBy } : {}),
      ...(c.userActions ? { userActions: c.userActions } : {}),
      fields: { id: { type: 'text' }, name: { type: 'text', label: 'Name' } },
    }),
  };
  const schema: any = {
    type: 'object-grid',
    objectName: OBJECT,
    columns: [{ field: 'name', label: 'Name' }],
    data: { provider: 'value', items: ROWS },
    ...c.schema,
  };
  return render(
    <ActionProvider>
      <SchemaRendererProvider dataSource={dataSource}>
        <ObjectGrid
          schema={schema}
          dataSource={dataSource}
          onEdit={() => {}}
          onDelete={() => {}}
          onBulkDelete={() => {}}
        />
      </SchemaRendererProvider>
    </ActionProvider>,
  );
}

/**
 * Render the grid and report what the row kebab surfaces. Waits for the async
 * `getObjectSchema` fetch so the affordance verdict is the settled one — an
 * assertion taken before it lands would read the pre-fetch (all-open) state.
 */
async function rowKebab(c: Case): Promise<{ edit: boolean; delete: boolean }> {
  renderGrid(c);
  await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
  // Let the schema fetch settle before reading the (possibly empty) menu.
  await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument());
  const triggers = screen.queryAllByTestId('row-action-trigger');
  // No trigger at all = the menu had nothing to show (RowActionMenu renders
  // the "⋮" only when at least one entry survives its gates).
  if (triggers.length === 0) return { edit: false, delete: false };
  await userEvent.click(triggers[0]);
  return {
    edit: screen.queryAllByTestId('row-action-builtin-edit').length > 0,
    delete: screen.queryAllByTestId('row-action-builtin-delete').length > 0,
  };
}

/** Whether the grid offers multi-select (the entry point to bulk delete). */
async function hasSelection(c: Case): Promise<boolean> {
  renderGrid(c);
  await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
  await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument());
  return screen.queryAllByRole('checkbox').length > 0;
}

beforeEach(() => { state.effectiveOps = undefined; });
afterEach(() => { cleanup(); });

describe('ObjectGrid row CRUD vs the effective API operation set (#3720)', () => {
  // The exact matrix from the issue: A baseline, B the bug, C control group.
  it('A — full effective set keeps row Edit/Delete and multi-select', async () => {
    expect(await rowKebab({ effectiveOps: FULL })).toEqual({ edit: true, delete: true });
    cleanup();
    expect(await hasSelection({ effectiveOps: FULL })).toBe(true);
  });

  it('B — a read-only effective set hides row Edit/Delete and multi-select', async () => {
    expect(await rowKebab({ effectiveOps: READ_ONLY })).toEqual({ edit: false, delete: false });
    cleanup();
    expect(await hasSelection({ effectiveOps: READ_ONLY })).toBe(false);
  });

  it('C — control group: the userActions opt-out is observably honored', async () => {
    // Proves the assertions above can actually observe "hidden" — without this
    // control a passing B could just be a broken probe.
    expect(await rowKebab({ effectiveOps: FULL, userActions: { edit: false, delete: false } }))
      .toEqual({ edit: false, delete: false });
  });

  it('gates update and delete independently', async () => {
    expect(await rowKebab({ effectiveOps: ['get', 'list', 'update'] }))
      .toEqual({ edit: true, delete: false });
    cleanup();
    expect(await rowKebab({ effectiveOps: ['get', 'list', 'delete'] }))
      .toEqual({ edit: false, delete: true });
  });

  it('a missing effective set preserves the pre-#3720 behavior', async () => {
    // Unrestricted object / old backend / no PermissionProvider.
    expect(await rowKebab({ effectiveOps: undefined })).toEqual({ edit: true, delete: true });
    cleanup();
    expect(await hasSelection({ effectiveOps: undefined })).toBe(true);
  });

  it('intersects, never unions — a server grant cannot re-open a userActions opt-out', async () => {
    expect(await rowKebab({ effectiveOps: FULL, userActions: { edit: false, delete: false } }))
      .toEqual({ edit: false, delete: false });
  });

  it('intersects, never unions — a userActions opt-in cannot survive a server denial', async () => {
    expect(await rowKebab({ effectiveOps: READ_ONLY, userActions: { edit: true, delete: true } }))
      .toEqual({ edit: false, delete: false });
  });
});

describe('ObjectGrid row CRUD vs the ADR-0103 bucket lock (#3720)', () => {
  it('engine-owned buckets no longer leak generic row Edit/Delete', async () => {
    expect(await rowKebab({ managedBy: 'system' })).toEqual({ edit: false, delete: false });
    cleanup();
    expect(await rowKebab({ managedBy: 'append-only' })).toEqual({ edit: false, delete: false });
  });

  it('platform / config objects are untouched', async () => {
    expect(await rowKebab({ managedBy: 'platform' })).toEqual({ edit: true, delete: true });
    cleanup();
    expect(await rowKebab({ managedBy: 'config' })).toEqual({ edit: true, delete: true });
  });

  it('a userActions opt-in re-opens a bucket-locked object (sys_user-style edit)', async () => {
    expect(await rowKebab({ managedBy: 'better-auth', userActions: { edit: true } }))
      .toEqual({ edit: true, delete: false });
  });
});

describe('ObjectGrid bulk delete vs the object delete verdict (#3720)', () => {
  it('drops an author-declared bulkActions delete when the server denies it', async () => {
    // `bulkActions: ['delete']` is a WIRING declaration, not a permission
    // grant — the destructive button must not outlive the effective set.
    renderGrid({ effectiveOps: READ_ONLY, schema: { bulkActions: ['delete'] } });
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument());
    expect(screen.queryAllByRole('checkbox').length).toBe(0);
  });

  it('keeps a declared bulkActions delete when the effective set allows it', async () => {
    renderGrid({ effectiveOps: FULL, schema: { bulkActions: ['delete'] } });
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    const boxes = screen.queryAllByRole('checkbox');
    expect(boxes.length).toBeGreaterThan(0);
    await userEvent.click(boxes[boxes.length - 1]);
    await waitFor(() => expect(screen.getByTestId('bulk-action-delete')).toBeInTheDocument());
  });

  it('keeps NON-delete bulk actions when the server denies delete', async () => {
    // Custom ids route through the action runner with their own gates — the
    // delete verdict must not take them down with it.
    renderGrid({ effectiveOps: READ_ONLY, schema: { bulkActions: ['delete', 'notify'] } });
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    const boxes = screen.queryAllByRole('checkbox');
    expect(boxes.length).toBeGreaterThan(0);
    await userEvent.click(boxes[boxes.length - 1]);
    await waitFor(() => expect(screen.getByTestId('bulk-action-notify')).toBeInTheDocument());
    expect(screen.queryByTestId('bulk-action-delete')).not.toBeInTheDocument();
  });

  it('drops a bulkActionDefs entry whose operation is delete', async () => {
    renderGrid({
      effectiveOps: READ_ONLY,
      schema: {
        bulkActionDefs: [
          { name: 'purge', label: 'Purge', operation: 'delete' },
          { name: 'reassign', label: 'Reassign', operation: 'update' },
        ],
      },
    });
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    const boxes = screen.queryAllByRole('checkbox');
    expect(boxes.length).toBeGreaterThan(0);
    await userEvent.click(boxes[boxes.length - 1]);
    await waitFor(() => expect(screen.getByTestId('bulk-action-reassign')).toBeInTheDocument());
    expect(screen.queryByTestId('bulk-action-purge')).not.toBeInTheDocument();
  });
});
