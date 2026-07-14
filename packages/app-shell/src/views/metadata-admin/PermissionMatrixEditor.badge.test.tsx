// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * A4 (framework#2920) — the provenance badge in the Studio permission matrix is
 * a TRI-STATE (platform / package / admin-custom), mirroring the unified sys_*
 * `managed_by` vocabulary. This guards each branch of the ternary.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

function makeClient(set: Record<string, unknown>) {
  return {
    layered: async () => ({ effective: set, code: null, overlay: null, overlayScope: null }),
    getDraft: async () => null,
    list: async (type: string) => (type === 'object' ? [{ item: { name: 'a_account' } }] : []),
    get: async (type: string) => (type === 'object' ? { fields: [] } : null),
    save: async (_t: string, _n: string, payload: Record<string, unknown>) => payload,
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
vi.mock('./AssignedUsersSection', () => ({ AssignedUsersSection: () => null }));

import { PermissionMatrixEditPage } from './PermissionMatrixEditor';

afterEach(cleanup);

function baseSet(extra: Record<string, unknown>) {
  return { name: 'sales_perms', label: 'Sales', isProfile: false, objects: {}, fields: {}, ...extra };
}

async function renderWith(extra: Record<string, unknown>) {
  clientImpl = makeClient(baseSet(extra));
  render(
    <MemoryRouter>
      <PermissionMatrixEditPage type="permission" name="sales_perms" />
    </MemoryRouter>,
  );
  // Wait for the load to settle (the label input renders after the fetch).
  await screen.findByDisplayValue('Sales');
}

describe('PermissionMatrixEditPage — provenance tri-state badge (A4 framework#2920)', () => {
  it('managedBy "platform" renders the Platform badge', async () => {
    await renderWith({ managedBy: 'platform' });
    expect(screen.getByText('Platform')).toBeInTheDocument();
    expect(screen.queryByText('Custom')).not.toBeInTheDocument();
  });

  it('managedBy "package" renders the Package badge', async () => {
    await renderWith({ managedBy: 'package' });
    expect(screen.getByText('Package')).toBeInTheDocument();
  });

  it('managedBy "admin" renders the Custom badge', async () => {
    await renderWith({ managedBy: 'admin' });
    expect(screen.getByText('Custom')).toBeInTheDocument();
    expect(screen.queryByText('Platform')).not.toBeInTheDocument();
  });

  it('legacy managedBy "user" still falls through to Custom (read compat)', async () => {
    await renderWith({ managedBy: 'user' });
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });
});
