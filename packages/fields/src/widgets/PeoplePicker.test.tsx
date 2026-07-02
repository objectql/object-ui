/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PeoplePicker } from './PeoplePicker';
import { pushRecentLookupId } from './recentLookups';

const users = [
  { id: 'u1', name: 'Amy Lin', email: 'amy@x.io', primary_business_unit_id: { name: 'Sales' } },
  { id: 'u2', name: 'Bob Wu', email: 'bob@x.io' },
  { id: 'u3', name: 'Cara Xu', email: 'cara@x.io' },
];

function makeDataSource() {
  const find = vi.fn(async (_obj: string, params: any) => {
    const idIn = params?.$filter?.id?.$in as any[] | undefined;
    if (idIn) {
      const set = new Set(idIn.map(String));
      const data = users.filter(u => set.has(String(u.id)));
      return { data, total: data.length };
    }
    const search: string | undefined = params?.$search;
    const data = search
      ? users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()))
      : users;
    return { data, total: data.length };
  });
  return { find } as any;
}

const baseProps = {
  open: true,
  objectName: 'sys_user',
  subtitleFields: ['primary_business_unit_id.name', 'email'],
};

beforeEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    /* ignore */
  }
});

describe('PeoplePicker', () => {
  it('lists candidate rows on open and filters by $search', async () => {
    const ds = makeDataSource();
    render(
      <PeoplePicker
        {...baseProps}
        dataSource={ds}
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('Amy Lin')).toBeTruthy());
    expect(screen.getByText('Sales · amy@x.io')).toBeTruthy();
    expect(screen.getAllByTestId('person-row')).toHaveLength(3);

    fireEvent.change(screen.getByTestId('people-picker-search'), { target: { value: 'amy' } });
    await waitFor(() => expect(screen.getAllByTestId('person-row')).toHaveLength(1));
    // Relation subtitle (primary_business_unit_id.name) auto-adds $expand.
    expect(ds.find).toHaveBeenLastCalledWith('sys_user', {
      $top: 25,
      $search: 'amy',
      $expand: ['primary_business_unit_id'],
    });
  });

  it('applies base candidate filters (banned != true)', async () => {
    const ds = makeDataSource();
    render(
      <PeoplePicker
        {...baseProps}
        dataSource={ds}
        lookupFilters={[{ field: 'banned', operator: 'ne', value: true }]}
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(ds.find).toHaveBeenCalledWith('sys_user', {
        $top: 25,
        $filter: { banned: { $ne: true } },
        $expand: ['primary_business_unit_id'],
      }),
    );
  });

  it('single-select commits immediately and closes', async () => {
    const ds = makeDataSource();
    const onSelect = vi.fn();
    const onSelectRecords = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <PeoplePicker
        {...baseProps}
        dataSource={ds}
        onSelect={onSelect}
        onSelectRecords={onSelectRecords}
        onOpenChange={onOpenChange}
      />,
    );
    await waitFor(() => expect(screen.getByText('Amy Lin')).toBeTruthy());

    fireEvent.click(screen.getByText('Amy Lin'));
    expect(onSelect).toHaveBeenCalledWith('u1');
    expect(onSelectRecords).toHaveBeenCalledWith([users[0]]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('multi-select echoes chips and confirms ids + records', async () => {
    const ds = makeDataSource();
    const onSelect = vi.fn();
    const onSelectRecords = vi.fn();
    render(
      <PeoplePicker
        {...baseProps}
        multiple
        dataSource={ds}
        onSelect={onSelect}
        onSelectRecords={onSelectRecords}
        onOpenChange={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText('Amy Lin')).toBeTruthy());

    fireEvent.click(screen.getByText('Amy Lin'));
    fireEvent.click(screen.getByText('Bob Wu'));
    await waitFor(() => expect(screen.getAllByTestId('selection-chip')).toHaveLength(2));

    fireEvent.click(screen.getByText('Confirm'));
    expect(onSelect).toHaveBeenCalledWith(['u1', 'u2']);
    expect(onSelectRecords).toHaveBeenCalledWith([users[0], users[1]]);
  });

  it('surfaces recent contacts in their own section when idle', async () => {
    pushRecentLookupId('sys_user', 'u3');
    const ds = makeDataSource();
    render(
      <PeoplePicker
        {...baseProps}
        dataSource={ds}
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText('Recently used')).toBeTruthy());
    // Cara appears under "Recently used" and is de-duped out of the main list.
    expect(screen.getByText('Cara Xu')).toBeTruthy();
    expect(screen.getByText('All results')).toBeTruthy();
  });
});
