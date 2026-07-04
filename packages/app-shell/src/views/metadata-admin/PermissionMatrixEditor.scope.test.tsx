// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ADR-0086 P0 — closed-loop integration test for the package-scoped Access
 * matrix. Drives the REAL `PermissionMatrixEditPage` (load effect + doSave)
 * against a fake metadata client that behaves like the server:
 *
 *   • `list('object', { packageId })` returns only the package's objects, and
 *   • `layered()` reflects the last saved payload (so "reopen" reads it back).
 *
 * It proves both directions the issue asks for:
 *   1. Opening package A's panel shows ONLY package A's objects (no
 *      environment leak — package B's `b_order` never appears).
 *   2. Editing + saving in package A writes back a merged payload in which
 *      package B's row survives byte-for-byte.
 *   3. Reopening still shows only package A's slice.
 */

import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Server state shared with the mocked client ──────────────────────────────
interface Server {
  set: Record<string, unknown>;
  packageObjects: Array<{ name: string; label?: string }>;
  saved: Array<Record<string, unknown>>;
  savedOpts: Array<Record<string, unknown> | undefined>;
}

function makeClient(server: Server) {
  return {
    layered: async () => ({
      effective: server.set,
      code: null,
      overlay: null,
      overlayScope: null,
    }),
    // ADR-0086 P2: the package door reads any pending draft first. This fixture
    // models the published baseline only (no pending draft) → null.
    getDraft: async () => null,
    list: async (type: string, opts?: { packageId?: string }) => {
      if (type === 'object') {
        // The server scopes to the package — the panel must not see anything
        // outside `server.packageObjects` regardless of what the set contains.
        void opts;
        return server.packageObjects.map((o) => ({ item: o }));
      }
      return [];
    },
    save: async (_type: string, _name: string, payload: Record<string, unknown>, opts?: Record<string, unknown>) => {
      server.saved.push(payload);
      server.savedOpts.push(opts);
      server.set = payload; // becomes the new effective (reopen reads this)
      return payload;
    },
  } as any;
}

let clientImpl: any;

vi.mock('./useMetadata', () => ({
  useMetadataClient: () => clientImpl,
  useMetadataTypes: () => ({
    loading: false,
    error: null,
    entries: [{ type: 'permission', label: 'Permission', allowOrgOverride: true }],
  }),
}));

// AssignedUsersSection makes its own adapter calls — irrelevant here.
vi.mock('./AssignedUsersSection', () => ({ AssignedUsersSection: () => null }));

import { PermissionMatrixEditPage } from './PermissionMatrixEditor';

afterEach(cleanup);

function freshServer(): Server {
  return {
    packageObjects: [{ name: 'a_account' }, { name: 'a_contact' }],
    saved: [],
    savedOpts: [],
    set: {
      name: 'sales_perms',
      label: 'Sales',
      isProfile: false,
      systemPermissions: ['api_enabled'],
      objects: {
        a_account: { allowRead: true, allowCreate: true },
        a_contact: { allowRead: true },
        // Package B's row — must never appear, must survive saves.
        b_order: { allowRead: true, allowEdit: true, viewAllRecords: true },
      },
      fields: { 'b_order.total': { readable: true, editable: true } },
    },
  };
}

function renderMatrix() {
  return render(
    <MemoryRouter>
      <PermissionMatrixEditPage type="permission" name="sales_perms" packageId="app.a" />
    </MemoryRouter>,
  );
}

describe('PermissionMatrixEditPage — package scope + slice merge (ADR-0086 P0)', () => {
  it('lists only the package objects, then merges the slice on save', async () => {
    const server = freshServer();
    clientImpl = makeClient(server);
    const view = renderMatrix();

    // 1) Only package A's objects are listed — no 84-object leak.
    await screen.findByText('a_account');
    expect(screen.getByText('a_contact')).toBeInTheDocument();
    expect(screen.queryByText('b_order')).not.toBeInTheDocument();

    // 2) Edit package A: clear a_account's grants via its row "None" button.
    const row = screen.getByText('a_account').closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'None' }));

    // 3) Save.
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    await waitFor(() => expect(server.saved).toHaveLength(1));

    const saved = server.saved[0] as any;
    // Package B's contributed rows are preserved byte-for-byte.
    expect(saved.objects.b_order).toEqual({
      allowRead: true,
      allowEdit: true,
      viewAllRecords: true,
    });
    expect(saved.fields['b_order.total']).toEqual({ readable: true, editable: true });
    // Package A's edit landed; a_contact (untouched, in-scope) retained.
    expect(saved.objects.a_account).toEqual({});
    expect(saved.objects.a_contact).toEqual({ allowRead: true });
    // Set-level identity/extras carried through from the fresh base.
    expect(saved.systemPermissions).toEqual(['api_enabled']);
    // ADR-0086 P2 (D6): the package door writes a DRAFT stamped with the
    // package — not a live record — so the package Publish promotes it.
    expect(server.savedOpts[0]).toMatchObject({ mode: 'draft', packageId: 'app.a' });

    view.unmount();

    // 4) Reopen against the same (now-saved) server: still scoped to A.
    clientImpl = makeClient(server);
    renderMatrix();
    await screen.findByText('a_account');
    expect(screen.queryByText('b_order')).not.toBeInTheDocument();
    // The saved server state still carries package B's row.
    expect((server.set as any).objects.b_order).toEqual({
      allowRead: true,
      allowEdit: true,
      viewAllRecords: true,
    });
  });
});
