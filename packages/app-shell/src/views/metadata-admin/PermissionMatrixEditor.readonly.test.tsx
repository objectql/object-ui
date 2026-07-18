// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Read-only gates for the permission matrix.
 *
 * The Studio Access pillar embeds `PermissionMatrixEditPage` for the current
 * package; when that package is READ-ONLY the pillar passes `readOnly`, and
 * the matrix must actually lock — before this gate existed the top bar showed
 * the package "Read-only" chip while the matrix below it stayed editable with
 * a live Save button.
 *
 * Two independent gates share one `writable` switch inside the editor:
 *   • host gate — `readOnly` prop (read-only package in Studio), and
 *   • type gate — `allowOrgOverride: false` on the metadata type
 *     (environment-level OS_METADATA_WRITABLE).
 * Either one must disable every checkbox / bulk button / input, hide Save,
 * and show a read-only badge — worded for ITS reason, so the badge never
 * contradicts the surrounding surface.
 */

import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Fake metadata client (same shape as the scope suite's fixture) ──────────
const server = {
  set: {
    name: 'sales_perms',
    label: 'Sales',
    objects: {
      a_account: { allowRead: true, allowCreate: true },
    },
    fields: {},
  } as Record<string, unknown>,
  saved: [] as Array<Record<string, unknown>>,
};

function makeClient() {
  return {
    layered: async () => ({
      effective: server.set,
      code: null,
      overlay: null,
      overlayScope: null,
    }),
    getDraft: async () => null,
    list: async (type: string) =>
      type === 'object' ? [{ item: { name: 'a_account', label: 'Account' } }] : [],
    get: async (type: string) =>
      type === 'object'
        ? { fields: [{ name: 'name', label: 'Name' }] }
        : null,
    save: async (_t: string, _n: string, payload: Record<string, unknown>) => {
      server.saved.push(payload);
      return payload;
    },
  } as any;
}

// Flipped per-test to drive the TYPE-level gate (resolveResourceConfig reads
// allowOrgOverride straight off the server entry).
let allowOrgOverride = true;
// One stable client per test — the editor's load effect depends on the client
// reference, so a fresh object per render would re-trigger it forever.
let clientImpl: any;

vi.mock('./useMetadata', () => ({
  useMetadataClient: () => clientImpl,
  useMetadataTypes: () => ({
    loading: false,
    error: null,
    entries: [{ type: 'permission', label: 'Permission', allowOrgOverride }],
  }),
}));

import { PermissionMatrixEditPage } from './PermissionMatrixEditor';

afterEach(() => {
  cleanup();
  allowOrgOverride = true;
  server.saved = [];
});

function renderMatrix(props?: { readOnly?: boolean }) {
  clientImpl = makeClient();
  return render(
    <MemoryRouter>
      <PermissionMatrixEditPage
        type="permission"
        name="sales_perms"
        packageId="app.a"
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('PermissionMatrixEditPage — read-only package gate (host readOnly)', () => {
  it('locks the whole matrix and hides Save when readOnly is set', async () => {
    renderMatrix({ readOnly: true });
    await screen.findByText('Account');

    // Save is gone — a read-only package must not offer a live draft write.
    expect(screen.queryByRole('button', { name: /^Save$/ })).toBeNull();

    // Every object-level grant checkbox is disabled…
    for (const box of screen.getAllByRole('checkbox')) {
      expect(box).toBeDisabled();
    }
    // …and so are the row bulk-set buttons.
    const row = screen.getByText('Account').closest('tr')!;
    for (const name of ['R', 'CRUD', 'All', 'None']) {
      expect(within(row).getByRole('button', { name })).toBeDisabled();
    }

    // Identity inputs collapse by default (objectui#2600 B1) — expand the
    // strip (summary shows the label "Sales"), then confirm they are locked
    // too in a read-only package.
    fireEvent.click(screen.getByRole('button', { name: /Sales/ }));
    expect(screen.getByDisplayValue('sales_perms')).toBeDisabled();
    expect(screen.getByDisplayValue('Sales')).toBeDisabled();

    // Field-level R/W under an expanded row is equally read-only.
    fireEvent.click(screen.getByRole('button', { name: /Account/ }));
    expect(await screen.findByLabelText('a_account.name readable')).toBeDisabled();
    expect(screen.getByLabelText('a_account.name editable')).toBeDisabled();
  });

  it('shows the package read-only badge, not the environment wording', async () => {
    renderMatrix({ readOnly: true });
    await screen.findByText('Account');

    // Same wording as the Studio top-bar package chip — the screen agrees
    // with itself about WHY it is read-only.
    const badge = screen.getByText('Read-only', { exact: true });
    expect(badge).toHaveAttribute('title', expect.stringContaining('Read-only package'));
    expect(screen.queryByText(/OS_METADATA_WRITABLE/)).toBeNull();
  });

  it('stays fully editable when readOnly is not set (regression)', async () => {
    renderMatrix();
    await screen.findByText('Account');

    expect(screen.getByRole('button', { name: /^Save$/ })).toBeEnabled();
    expect(screen.getByLabelText('a_account Read')).toBeEnabled();
    expect(screen.queryByText('Read-only', { exact: true })).toBeNull();
    expect(screen.queryByText(/OS_METADATA_WRITABLE/)).toBeNull();
  });
});

describe('PermissionMatrixEditPage — type-level gate keeps its own wording', () => {
  it('allowOrgOverride=false hides Save and shows the environment badge', async () => {
    allowOrgOverride = false;
    renderMatrix();
    await screen.findByText('Account');

    expect(screen.queryByRole('button', { name: /^Save$/ })).toBeNull();
    expect(screen.getByLabelText('a_account Read')).toBeDisabled();
    // Env-gate reason, untouched by the package gate.
    expect(screen.getByText(/OS_METADATA_WRITABLE/)).toBeInTheDocument();
  });
});
