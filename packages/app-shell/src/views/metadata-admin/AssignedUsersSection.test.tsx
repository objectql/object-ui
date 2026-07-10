// Copyright (c) 2026 ObjectStack. Licensed under the MIT license.
//
// objectui#2382 — the 已分配用户 section must count EFFECTIVE holders:
// direct grants ∪ holders of every position bound to the set. A
// direct-grants-only list told the admin "0 users" for any
// normally-administered set (positions are THE distribution channel in
// ADR-0090), right before they edit or delete it.

import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AssignedUsersSection } from './AssignedUsersSection';

vi.mock('@object-ui/react', () => ({
  useAdapter: () => mockAdapter,
}));
vi.mock('@object-ui/fields', () => ({
  RecordPickerDialog: () => null,
}));

const data: Record<string, any[]> = {
  sys_permission_set: [{ id: 'ps_1', name: 'showcase_contributor' }],
  sys_user_permission_set: [{ id: 'grant_1', permission_set_id: 'ps_1', user_id: 'u_direct' }],
  sys_position_permission_set: [
    { id: 'bind_1', position_id: 'pos_contrib', permission_set_id: 'ps_1' },
    { id: 'bind_2', position_id: 'pos_everyone', permission_set_id: 'ps_1' },
  ],
  sys_position: [
    { id: 'pos_contrib', name: 'contributor', label: 'Contributor' },
    { id: 'pos_everyone', name: 'everyone', label: 'Everyone' },
  ],
  sys_user_position: [
    { id: 'up_1', user_id: 'u_held', position: 'contributor' },
    // The direct grantee ALSO holds the position — must merge into one row.
    { id: 'up_2', user_id: 'u_direct', position: 'contributor' },
  ],
  sys_user: [
    { id: 'u_direct', name: 'Direct Dana', email: 'dana@example.com' },
    { id: 'u_held', name: 'Held Henry', email: 'henry@example.com' },
  ],
};

const mockAdapter = {
  find: vi.fn(async (object: string, query: any) => {
    const rows = data[object] ?? [];
    const filter = query?.$filter ?? {};
    return rows.filter((r) =>
      Object.entries(filter).every(([k, v]: [string, any]) => {
        if (v && typeof v === 'object' && Array.isArray(v.$in)) return v.$in.includes(r[k]);
        return r[k] === v;
      }),
    );
  }),
  create: vi.fn(),
  delete: vi.fn(),
};

describe('AssignedUsersSection — effective holders (objectui#2382)', () => {
  it('lists direct grantees AND position-held users, with via badges', async () => {
    render(<AssignedUsersSection permissionSetName="showcase_contributor" />);

    await waitFor(() => expect(screen.getByText('Direct Dana')).toBeTruthy());
    // Position-held user appears even with no direct grant.
    expect(screen.getByText('Held Henry')).toBeTruthy();
    // Count = deduped users (u_direct merged), not junction rows.
    expect(screen.getByText('2')).toBeTruthy();
    // Attribution badges.
    expect(screen.getAllByText('direct').length).toBeGreaterThan(0);
    expect(screen.getAllByText('via position contributor').length).toBeGreaterThan(0);
  });

  it('surfaces the everyone-anchor binding as a note instead of enumerating members', async () => {
    render(<AssignedUsersSection permissionSetName="showcase_contributor" />);
    await waitFor(() =>
      expect(screen.getByText(/every signed-in member holds this set/i)).toBeTruthy(),
    );
  });

  it('keeps the remove affordance only on direct grants', async () => {
    render(<AssignedUsersSection permissionSetName="showcase_contributor" />);
    await waitFor(() => expect(screen.getByText('Held Henry')).toBeTruthy());
    // One removable (direct grant) row → exactly one Remove button.
    expect(screen.getAllByLabelText('Remove')).toHaveLength(1);
  });
});
