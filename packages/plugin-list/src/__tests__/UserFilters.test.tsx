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
import { I18nProvider } from '@object-ui/i18n';
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

describe('UserFilters — dropdown chip label fallback', () => {
  it('falls back to the objectDef field label when the view omits f.label', () => {
    // Compile can strip `label` off userFilters.fields; the chip must not
    // degrade to the raw snake_case key when the object still knows the label.
    render(
      <UserFilters
        config={{ element: 'dropdown', fields: [{ field: 'status' }] }}
        objectDef={objectDef}
        data={[]}
        onFilterChange={() => {}}
      />,
    );

    expect(screen.getByTestId('filter-badge-status').textContent).toContain('Status');
    expect(screen.getByTestId('filter-badge-status').textContent).not.toContain('status');
  });

  it('prefers an author-supplied f.label over the objectDef label', () => {
    render(
      <UserFilters
        config={{ element: 'dropdown', fields: [{ field: 'status', label: 'Stage' }] }}
        objectDef={objectDef}
        data={[]}
        onFilterChange={() => {}}
      />,
    );

    expect(screen.getByTestId('filter-badge-status').textContent).toContain('Stage');
  });

  it('renders the author-supplied label verbatim (issue repro: explicit label must not degrade to key)', () => {
    // Mirrors the reported config: fields carry an explicit Chinese label.
    // The chip must show the label, never the snake_case field key.
    render(
      <UserFilters
        config={{
          element: 'dropdown',
          fields: [
            { field: 'project_type', label: '项目类型' },
            { field: 'manager', label: '管理责任人' },
          ],
        }}
        objectDef={{ name: 'projects', fields: { project_type: { type: 'select' }, manager: { type: 'lookup' } } }}
        data={[]}
        onFilterChange={() => {}}
      />,
    );

    expect(screen.getByTestId('filter-badge-project_type').textContent).toContain('项目类型');
    expect(screen.getByTestId('filter-badge-project_type').textContent).not.toContain('project_type');
    expect(screen.getByTestId('filter-badge-manager').textContent).toContain('管理责任人');
  });

  it('falls back to the raw field key when neither a label nor an objectDef entry exists', () => {
    render(
      <UserFilters
        config={{ element: 'dropdown', fields: [{ field: 'orphan_field', options: [{ label: 'X', value: 'x' }] }] }}
        objectDef={objectDef}
        data={[]}
        onFilterChange={() => {}}
      />,
    );

    expect(screen.getByTestId('filter-badge-orphan_field').textContent).toContain('orphan_field');
  });
});

describe('UserFilters — i18n resolver overrides an explicit author label (regression)', () => {
  // A tenant's translation bundle often carries auto-extracted skeleton entries
  // where the value equals the field key (e.g. `os i18n extract` emits
  // `fields.<obj>.<field> = "<field>"` when the field has no authored label).
  // The dropdown chip runs the author-supplied `f.label` through the
  // convention-based `fieldLabel` resolver as the *fallback*, but the resolver
  // returns any matching bundle entry — including a key-valued skeleton — which
  // then OVERRIDES the explicit label. This is the mechanism behind the reported
  // symptom: chips render raw snake_case keys despite the config declaring
  // Chinese labels.
  const withBundle = (bundle: Record<string, unknown>) =>
    function Wrapper({ children }: { children: React.ReactNode }) {
      return (
        <I18nProvider
          config={{
            defaultLanguage: 'en',
            detectBrowserLanguage: false,
            resources: { en: bundle },
          }}
        >
          {children}
        </I18nProvider>
      );
    };

  it('keeps the explicit label when the bundle only holds a key-valued skeleton', () => {
    render(
      <UserFilters
        config={{ element: 'dropdown', fields: [{ field: 'project_type', label: '项目类型' }] }}
        objectDef={{ name: 'projects', fields: { project_type: { type: 'select' } } }}
        data={[]}
        onFilterChange={() => {}}
      />,
      // Bundle mirrors an extracted skeleton: value === field key. Before the fix
      // this clobbered '项目类型' with 'project_type' (the reported symptom).
      { wrapper: withBundle({ crm: { fields: { projects: { project_type: 'project_type' } } } }) },
    );

    const chip = screen.getByTestId('filter-badge-project_type').textContent;
    expect(chip).toContain('项目类型');
    expect(chip).not.toContain('project_type');
  });

  it('a real translation still wins (resolver working as intended)', () => {
    render(
      <UserFilters
        config={{ element: 'dropdown', fields: [{ field: 'project_type', label: 'Project Type' }] }}
        objectDef={{ name: 'projects', fields: { project_type: { type: 'select' } } }}
        data={[]}
        onFilterChange={() => {}}
      />,
      { wrapper: withBundle({ crm: { fields: { projects: { project_type: '项目类型' } } } }) },
    );

    expect(screen.getByTestId('filter-badge-project_type').textContent).toContain('项目类型');
  });
});
