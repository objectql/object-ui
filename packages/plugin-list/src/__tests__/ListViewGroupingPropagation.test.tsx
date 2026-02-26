/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Capture the schema prop passed to SchemaRenderer
let capturedSchema: any = null;

vi.mock('@object-ui/react', () => ({
  SchemaRenderer: (props: any) => {
    capturedSchema = props.schema;
    return <div data-testid="schema-renderer" data-schema-type={props.schema?.type}>{props.schema?.type}</div>;
  },
  useNavigationOverlay: () => ({
    isOverlay: false,
    handleClick: vi.fn(),
    selectedRecord: null,
    isOpen: false,
    close: vi.fn(),
    setIsOpen: vi.fn(),
    mode: 'page' as const,
    width: undefined,
    view: undefined,
    open: vi.fn(),
  }),
  useDensityMode: () => ['comfortable', vi.fn()] as const,
  SchemaRendererProvider: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@object-ui/components', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
  Input: (props: any) => <input {...props} />,
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  PopoverContent: ({ children }: any) => <div>{children}</div>,
  FilterBuilder: () => null,
  SortBuilder: () => null,
  NavigationOverlay: () => null,
}));

vi.mock('@object-ui/mobile', () => ({
  usePullToRefresh: () => ({ pullRef: { current: null } }),
}));

vi.mock('@object-ui/core', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    ExpressionEvaluator: {
      evaluate: vi.fn((expr: string) => expr),
    },
  };
});

vi.mock('@object-ui/i18n', () => ({
  useObjectTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('../ViewSwitcher', () => ({
  ViewSwitcher: ({ currentView, onViewChange }: any) => (
    <div data-testid="view-switcher">
      <button aria-label="Grid" onClick={() => onViewChange('grid')}>Grid</button>
      <button aria-label="Kanban" onClick={() => onViewChange('kanban')}>Kanban</button>
      <button aria-label="Gallery" onClick={() => onViewChange('gallery')}>Gallery</button>
    </div>
  ),
  ViewType: {},
}));

vi.mock('../UserFilters', () => ({
  UserFilters: () => null,
}));

vi.mock('lucide-react', () => ({
  Search: () => <span>Search</span>,
  SlidersHorizontal: () => <span>Sliders</span>,
  ArrowUpDown: () => <span>Sort</span>,
  X: () => <span>X</span>,
  EyeOff: () => <span>EyeOff</span>,
  Group: () => <span>Group</span>,
  Paintbrush: () => <span>Color</span>,
  Ruler: () => <span>Ruler</span>,
  Inbox: () => <span>Inbox</span>,
  Download: () => <span>Download</span>,
  AlignJustify: () => <span>Density</span>,
  Share2: () => <span>Share</span>,
  Printer: () => <span>Print</span>,
  Plus: () => <span>Plus</span>,
  icons: {},
}));

import { ListView } from '../ListView';

const groupingConfig = {
  fields: [{ field: 'category', order: 'asc' as const, collapsed: false }],
};

const testData = [
  { id: '1', name: 'Product A', category: 'Electronics' },
  { id: '2', name: 'Product B', category: 'Tools' },
];

describe('ListView grouping config propagation', () => {
  beforeEach(() => {
    capturedSchema = null;
  });

  it('passes grouping config to grid view schema', () => {
    render(
      <ListView
        schema={{
          type: 'list-view',
          objectName: 'products',
          viewType: 'grid',
          fields: ['name', 'category'],
          grouping: groupingConfig,
          data: testData,
        }}
      />,
    );

    expect(capturedSchema).toBeDefined();
    expect(capturedSchema.type).toBe('object-grid');
    expect(capturedSchema.grouping).toEqual(groupingConfig);
  });

  it('passes grouping config to kanban view schema', () => {
    render(
      <ListView
        schema={{
          type: 'list-view',
          objectName: 'products',
          viewType: 'kanban',
          fields: ['name', 'category'],
          grouping: groupingConfig,
          data: testData,
          kanban: { groupField: 'status' },
        }}
        showViewSwitcher={true}
      />,
    );

    // Switch to kanban view
    const kanbanBtn = screen.getByLabelText('Kanban');
    fireEvent.click(kanbanBtn);

    expect(capturedSchema).toBeDefined();
    expect(capturedSchema.type).toBe('object-kanban');
    expect(capturedSchema.grouping).toEqual(groupingConfig);
  });

  it('passes grouping config to gallery view schema', () => {
    render(
      <ListView
        schema={{
          type: 'list-view',
          objectName: 'products',
          viewType: 'gallery',
          fields: ['name', 'category'],
          grouping: groupingConfig,
          data: testData,
        }}
        showViewSwitcher={true}
      />,
    );

    // Switch to gallery view
    const galleryBtn = screen.getByLabelText('Gallery');
    fireEvent.click(galleryBtn);

    expect(capturedSchema).toBeDefined();
    expect(capturedSchema.type).toBe('object-gallery');
    expect(capturedSchema.grouping).toEqual(groupingConfig);
  });

  it('updates grid schema when user toggles grouping via toolbar', async () => {
    render(
      <ListView
        schema={{
          type: 'list-view',
          objectName: 'products',
          viewType: 'grid',
          fields: ['name', 'category'],
          data: testData,
        }}
      />,
    );

    // Initially no grouping
    expect(capturedSchema).toBeDefined();
    expect(capturedSchema.type).toBe('object-grid');
    expect(capturedSchema.grouping).toBeUndefined();

    // Open Group popover
    const groupButton = screen.getByRole('button', { name: /group/i });
    fireEvent.click(groupButton);

    // Select the 'category' field checkbox in the group field list
    const fieldList = screen.getByTestId('group-field-list');
    const checkboxes = fieldList.querySelectorAll('input[type="checkbox"]');
    // Find the checkbox for 'category'
    const categoryCheckbox = Array.from(checkboxes).find(cb => {
      const label = cb.closest('label');
      return label?.textContent?.includes('category');
    });
    expect(categoryCheckbox).toBeDefined();
    fireEvent.click(categoryCheckbox!);

    // Schema should now include grouping config
    expect(capturedSchema.grouping).toBeDefined();
    expect(capturedSchema.grouping.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'category' }),
      ]),
    );

    // Toggle off — click the checkbox again
    fireEvent.click(categoryCheckbox!);
    expect(capturedSchema.grouping).toBeUndefined();
  });

  it('does not pass grouping when no grouping config exists', () => {
    render(
      <ListView
        schema={{
          type: 'list-view',
          objectName: 'products',
          viewType: 'grid',
          fields: ['name', 'category'],
          data: testData,
        }}
      />,
    );

    expect(capturedSchema).toBeDefined();
    expect(capturedSchema.type).toBe('object-grid');
    expect(capturedSchema.grouping).toBeUndefined();
  });
});
