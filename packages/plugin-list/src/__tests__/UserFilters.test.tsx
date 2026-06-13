/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserFilters } from '../UserFilters';

const objectDef = {
  name: 'tasks',
  fields: {
    status: {
      type: 'select',
      label: 'Status',
      options: [
        { label: 'To Do', value: 'todo' },
        { label: 'Done', value: 'done' },
      ],
    },
    points: {
      type: 'select',
      label: 'Points',
      options: [
        { label: 'One', value: 1 },
        { label: 'Two', value: 2 },
      ],
    },
    is_active: { type: 'boolean', label: 'Active' },
  },
};

describe('UserFilters — selection persistence (ADR-0047)', () => {
  it('restores dropdown selections from initialSelections and emits conditions on mount', () => {
    const onFilterChange = vi.fn();
    render(
      <UserFilters
        config={{ element: 'dropdown', fields: [{ field: 'status' }] }}
        objectDef={objectDef}
        data={[]}
        onFilterChange={onFilterChange}
        initialSelections={{ status: ['todo'] }}
      />,
    );

    // Badge shows the restored selection count
    expect(screen.getByTestId('filter-badge-status').textContent).toContain('1');
    // The restored selection was emitted as a query condition
    expect(onFilterChange).toHaveBeenCalledWith([['status', 'in', ['todo']]]);
  });

  it('coerces URL-restored string values to typed option values', () => {
    const onFilterChange = vi.fn();
    render(
      <UserFilters
        config={{ element: 'dropdown', fields: [{ field: 'points' }, { field: 'is_active' }] }}
        objectDef={objectDef}
        data={[]}
        onFilterChange={onFilterChange}
        initialSelections={{ points: ['2'], is_active: ['true'] }}
      />,
    );

    const emitted = onFilterChange.mock.calls.at(-1)?.[0];
    expect(emitted).toEqual(
      expect.arrayContaining([
        ['points', 'in', [2]],
        ['is_active', 'in', [true]],
      ]),
    );
  });

  it('fires onSelectionsChange with raw selections when the user changes a dropdown', () => {
    const onSelectionsChange = vi.fn();
    render(
      <UserFilters
        config={{ element: 'dropdown', fields: [{ field: 'status' }] }}
        objectDef={objectDef}
        data={[]}
        onFilterChange={() => {}}
        onSelectionsChange={onSelectionsChange}
      />,
    );

    fireEvent.click(screen.getByTestId('filter-badge-status'));
    fireEvent.click(screen.getByText('To Do'));
    expect(onSelectionsChange).toHaveBeenCalledWith({ status: ['todo'] });

    // Clearing via the badge × empties the selection
    fireEvent.click(screen.getByTestId('filter-clear-status'));
    expect(onSelectionsChange).toHaveBeenLastCalledWith({ status: [] });
  });

  it('restores the active tab from initialSelections._tab and emits its filters', () => {
    const onFilterChange = vi.fn();
    render(
      <UserFilters
        config={{
          element: 'tabs',
          tabs: [
            { name: 'all', label: 'All', isDefault: true },
            { name: 'urgent', label: 'Urgent', filter: [{ field: 'priority', operator: 'equals', value: 'urgent' }] },
          ],
        }}
        objectDef={objectDef}
        data={[]}
        onFilterChange={onFilterChange}
        initialSelections={{ _tab: ['urgent'] }}
      />,
    );

    // Restored tab wins over the isDefault tab and emits its preset filter
    expect(onFilterChange).toHaveBeenCalledWith([['priority', '=', 'urgent']]);
  });

  it('reports tab switches through onSelectionsChange', () => {
    const onSelectionsChange = vi.fn();
    render(
      <UserFilters
        config={{
          element: 'tabs',
          tabs: [
            { name: 'all', label: 'All', isDefault: true },
            { name: 'urgent', label: 'Urgent', filter: [{ field: 'priority', operator: 'equals', value: 'urgent' }] },
          ],
        }}
        objectDef={objectDef}
        data={[]}
        onFilterChange={() => {}}
        onSelectionsChange={onSelectionsChange}
      />,
    );

    fireEvent.click(screen.getByTestId('filter-tab-urgent'));
    expect(onSelectionsChange).toHaveBeenCalledWith({ _tab: ['urgent'] });
  });
});
