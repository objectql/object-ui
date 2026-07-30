/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ViewSwitcher } from '../ViewSwitcher';
import type { ViewSwitcherSchema, ViewType } from '@object-ui/types';

// Mock @object-ui/react to avoid circular dependency issues; mirrors
// ObjectView.test.tsx, including the data-invalidation bus that
// @object-ui/components imports at module-eval time.
vi.mock('@object-ui/react', async () => {
  const React = await import('react');
  return {
    SchemaRenderer: ({ schema }: any) => (
      <div data-testid="schema-renderer" data-schema-type={schema?.type}>
        {schema?.type}
      </div>
    ),
    SchemaRendererContext: React.createContext(null),
    subscribeDataChanges: () => () => {},
    notifyDataChanged: () => {},
  };
});

// Every member of `ViewType`. Declared as `ViewType[]` rather than inferred, so
// adding a member to the union without extending this list is a compile error
// here too — the same guard `DEFAULT_VIEW_LABELS` / `DEFAULT_VIEW_ICONS` get
// from being `Record<ViewType, ...>` (#2916).
const ALL_VIEW_TYPES: ViewType[] = [
  'list',
  'detail',
  'grid',
  'kanban',
  'calendar',
  'timeline',
  'map',
  'gallery',
  'gantt',
  'chart',
  'tree',
];

function schemaFor(types: ViewType[]): ViewSwitcherSchema {
  return {
    type: 'view-switcher',
    variant: 'buttons',
    views: types.map(type => ({ type })),
  };
}

describe('ViewSwitcher default view labels and icons', () => {
  it('renders a non-empty label and an icon for every ViewType', () => {
    render(<ViewSwitcher schema={schemaFor(ALL_VIEW_TYPES)} />);

    for (const type of ALL_VIEW_TYPES) {
      // A missing entry falls back to the raw type key for the label and to no
      // icon at all, which is what a hole in either Record<ViewType, ...> map
      // looked like on screen.
      const button = screen
        .getAllByRole('button')
        .find(b => b.textContent?.trim().toLowerCase() === type || b.textContent?.trim() === type);
      expect(button, `no button rendered for view type "${type}"`).toBeDefined();
      expect(button!.querySelector('svg'), `view type "${type}" rendered without an icon`).not.toBeNull();
    }
  });

  it('labels the chart view "Chart" rather than falling back to the type key', () => {
    render(<ViewSwitcher schema={schemaFor(['chart'])} />);

    expect(screen.getByText('Chart')).toBeInTheDocument();
    expect(screen.queryByText('chart')).toBeNull();
  });

  it('still lets an explicit label and icon override the defaults', () => {
    render(
      <ViewSwitcher
        schema={{
          type: 'view-switcher',
          variant: 'buttons',
          views: [{ type: 'chart', label: 'Revenue', icon: 'pie-chart' }],
        }}
      />
    );

    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.queryByText('Chart')).toBeNull();
  });
});
