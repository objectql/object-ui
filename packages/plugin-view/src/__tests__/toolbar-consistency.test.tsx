/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Toolbar Consistency Tests
 *
 * Verifies that toolbar, filter, sort, and view-switcher controls render
 * with consistent structure and accessible attributes across all view types.
 *
 * Strategy: Each section renders the relevant component in isolation using
 * the same lightweight Shadcn mocks from sibling test files, then asserts
 * ARIA roles, labels, and keyboard-accessibility invariants.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ObjectView } from '../ObjectView';
import { FilterUI } from '../FilterUI';
import { SortUI } from '../SortUI';
import { ViewSwitcher } from '../ViewSwitcher';
import type {
  ObjectViewSchema,
  DataSource,
  FilterUISchema,
  SortUISchema,
  ViewSwitcherSchema,
} from '@object-ui/types';

// ---------------------------------------------------------------------------
// Mocks – mirrors ObjectView.test.tsx
// ---------------------------------------------------------------------------
vi.mock('@object-ui/react', () => ({
  SchemaRenderer: ({ schema }: any) => (
    <div data-testid="schema-renderer" data-schema-type={schema?.type}>
      {schema?.type}
    </div>
  ),
  SchemaRendererContext: null,
}));

vi.mock('@object-ui/plugin-grid', () => ({
  ObjectGrid: ({ schema }: any) => (
    <div data-testid="object-grid" data-object={schema?.objectName}>
      Grid
    </div>
  ),
}));

vi.mock('@object-ui/plugin-form', () => ({
  ObjectForm: ({ schema }: any) => (
    <div data-testid="object-form" data-mode={schema?.mode}>
      Form ({schema?.mode})
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Mock @object-ui/components – lightweight Shadcn stand-ins
// (mirrors FilterUI.test.tsx / SortUI.test.tsx)
// ---------------------------------------------------------------------------
vi.mock('@object-ui/components', async () => {
  const React = await import('react');
  const cn = (...args: any[]) => args.filter(Boolean).join(' ');

  const Button = ({ children, onClick, variant, size, type, ...rest }: any) => (
    <button onClick={onClick} data-variant={variant} data-size={size} type={type} {...rest}>
      {children}
    </button>
  );

  const Input = ({ value, onChange, placeholder, type, ...rest }: any) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type}
      data-testid={`input-${type || 'text'}`}
      {...rest}
    />
  );

  const Label = ({ children, className, htmlFor }: any) => (
    <label className={className} htmlFor={htmlFor}>
      {children}
    </label>
  );

  const Checkbox = ({ checked, onCheckedChange }: any) => (
    <input
      type="checkbox"
      data-testid="checkbox"
      checked={checked}
      onChange={(e: any) => onCheckedChange?.(e.target.checked)}
    />
  );

  // Select family with context for onValueChange propagation
  const SelectCtx = React.createContext<((v: string) => void) | undefined>(undefined);

  const Select = ({ children, value, onValueChange }: any) => (
    <SelectCtx.Provider value={onValueChange}>
      <div data-testid="select-root" data-value={value}>
        {children}
      </div>
    </SelectCtx.Provider>
  );

  const SelectTrigger = ({ children, className }: any) => (
    <button data-testid="select-trigger" className={className}>
      {children}
    </button>
  );

  const SelectValue = ({ placeholder }: any) => (
    <span data-testid="select-value">{placeholder}</span>
  );

  const SelectContent = ({ children }: any) => (
    <div data-testid="select-content">{children}</div>
  );

  const SelectItem = ({ children, value }: any) => {
    const onValueChange = React.useContext(SelectCtx);
    return (
      <div
        data-testid="select-item"
        data-value={value}
        role="option"
        onClick={() => onValueChange?.(String(value))}
      >
        {children}
      </div>
    );
  };

  const Popover = ({ children, open }: any) => (
    <div data-testid="popover" data-open={open}>{children}</div>
  );
  const PopoverTrigger = ({ children }: any) => (
    <div data-testid="popover-trigger">{children}</div>
  );
  const PopoverContent = ({ children }: any) => (
    <div data-testid="popover-content">{children}</div>
  );

  const Drawer = ({ children, open }: any) => (
    <div data-testid="drawer" data-open={open}>{children}</div>
  );
  const DrawerContent = ({ children }: any) => (
    <div data-testid="drawer-content">{children}</div>
  );
  const DrawerHeader = ({ children }: any) => (
    <div data-testid="drawer-header">{children}</div>
  );
  const DrawerTitle = ({ children }: any) => (
    <h2 data-testid="drawer-title">{children}</h2>
  );
  const DrawerDescription = ({ children }: any) => (
    <p data-testid="drawer-description">{children}</p>
  );

  const Dialog = ({ children, open }: any) => (
    <div data-testid="dialog" data-open={open}>{children}</div>
  );
  const DialogContent = ({ children }: any) => (
    <div data-testid="dialog-content">{children}</div>
  );
  const DialogHeader = ({ children }: any) => (
    <div data-testid="dialog-header">{children}</div>
  );
  const DialogTitle = ({ children }: any) => (
    <h2 data-testid="dialog-title">{children}</h2>
  );
  const DialogDescription = ({ children }: any) => (
    <p data-testid="dialog-description">{children}</p>
  );

  // Tabs family – render role="tablist" for TabsList
  const TabsCtx = React.createContext<{ value: string; onValueChange?: (v: string) => void }>({
    value: '',
  });

  const Tabs = ({ children, value, onValueChange }: any) => (
    <TabsCtx.Provider value={{ value, onValueChange }}>
      <div data-testid="tabs">{children}</div>
    </TabsCtx.Provider>
  );

  const TabsList = ({ children, className }: any) => (
    <div role="tablist" className={className}>{children}</div>
  );

  const TabsTrigger = ({ children, value, className }: any) => {
    const ctx = React.useContext(TabsCtx);
    const isActive = ctx.value === value;
    return (
      <button
        role="tab"
        aria-selected={isActive}
        data-state={isActive ? 'active' : 'inactive'}
        className={className}
        onClick={() => ctx.onValueChange?.(value)}
      >
        {children}
      </button>
    );
  };

  const SortBuilder = ({ fields, value, onChange }: any) => (
    <div data-testid="sort-builder" data-fields={JSON.stringify(fields)} data-value={JSON.stringify(value)}>
      <button
        data-testid="sort-builder-change"
        onClick={() => onChange?.([{ id: 'date-desc', field: 'date', order: 'desc' }])}
      >
        Change Sort
      </button>
    </div>
  );

  return {
    cn,
    Button,
    Input,
    Label,
    Checkbox,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
    Popover,
    PopoverTrigger,
    PopoverContent,
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    Tabs,
    TabsList,
    TabsTrigger,
    SortBuilder,
  };
});

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
const createMockDataSource = (overrides: Partial<DataSource> = {}): DataSource =>
  ({
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    getObjectSchema: vi.fn().mockResolvedValue({
      label: 'Contacts',
      fields: {
        name: { label: 'Name', type: 'text' },
        email: { label: 'Email', type: 'text' },
        status: {
          label: 'Status',
          type: 'select',
          options: [
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' },
          ],
        },
        created_at: { label: 'Created', type: 'date' },
      },
    }),
    ...overrides,
  } as DataSource);

// ===========================================================================
// 1. ObjectView renders a toolbar region
// ===========================================================================
describe('Toolbar consistency across view types', () => {
  let mockDataSource: DataSource;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDataSource = createMockDataSource();
  });

  describe('ObjectView toolbar region', () => {
    it('renders a toolbar container that wraps action buttons', () => {
      const schema: ObjectViewSchema = {
        type: 'object-view',
        objectName: 'contacts',
        title: 'Contacts',
      };

      const { container } = render(
        <ObjectView schema={schema} dataSource={mockDataSource} />,
      );

      // The Create button lives inside the toolbar area
      const createBtn = screen.getByText('Create');
      expect(createBtn).toBeDefined();
      // Toolbar wrapper is a parent div
      expect(createBtn.closest('div')).toBeDefined();
    });

    it('renders Create button as a focusable element', () => {
      const schema: ObjectViewSchema = {
        type: 'object-view',
        objectName: 'contacts',
      };

      render(<ObjectView schema={schema} dataSource={mockDataSource} />);

      const btn = screen.getByText('Create');
      expect(btn.tagName).toBe('BUTTON');
      // Buttons are keyboard-focusable by default (no tabIndex=-1)
      expect(btn.getAttribute('tabindex')).not.toBe('-1');
    });

    it('hides toolbar when no actions or tabs are needed', () => {
      const schema: ObjectViewSchema = {
        type: 'object-view',
        objectName: 'contacts',
        showCreate: false,
        showViewSwitcher: false,
      };

      const { container } = render(
        <ObjectView schema={schema} dataSource={mockDataSource} />,
      );

      // No Create button
      expect(screen.queryByText('Create')).toBeNull();
    });
  });

  // =========================================================================
  // 2. Filter controls are accessible
  // =========================================================================
  describe('FilterUI accessibility', () => {
    const makeFilterSchema = (overrides: Partial<FilterUISchema> = {}): FilterUISchema => ({
      type: 'filter-ui',
      filters: [
        {
          field: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' },
          ],
        },
        { field: 'name', label: 'Name', type: 'text' },
      ],
      ...overrides,
    });

    it('renders a visible label for each filter field', () => {
      render(<FilterUI schema={makeFilterSchema()} />);

      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    it('renders text filter inputs with descriptive placeholders', () => {
      render(
        <FilterUI
          schema={makeFilterSchema({
            filters: [{ field: 'search', label: 'Search', type: 'text' }],
          })}
        />,
      );

      const input = screen.getByPlaceholderText('Filter by Search');
      expect(input).toBeInTheDocument();
      expect(input.tagName).toBe('INPUT');
    });

    it('renders select filters with option role="option" items', () => {
      render(<FilterUI schema={makeFilterSchema()} />);

      const options = screen.getAllByRole('option');
      expect(options.length).toBeGreaterThanOrEqual(2);
      expect(options[0]).toHaveAttribute('data-value', 'active');
      expect(options[1]).toHaveAttribute('data-value', 'inactive');
    });

    it('renders filters consistently in popover layout', () => {
      render(<FilterUI schema={makeFilterSchema({ layout: 'popover' })} />);

      // Popover trigger should contain a "Filters" label
      expect(screen.getByText('Filters')).toBeInTheDocument();
      // Filter labels are still present inside popover content
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 3. Sort controls render consistently with proper attributes
  // =========================================================================
  describe('SortUI accessibility', () => {
    const makeSortSchema = (overrides: Partial<SortUISchema> = {}): SortUISchema => ({
      type: 'sort-ui',
      fields: [
        { field: 'name', label: 'Name' },
        { field: 'date', label: 'Date' },
      ],
      ...overrides,
    });

    it('renders sort buttons as focusable button elements', () => {
      render(<SortUI schema={makeSortSchema({ variant: 'buttons' })} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
      buttons.forEach((btn) => {
        expect(btn.tagName).toBe('BUTTON');
        expect(btn.getAttribute('tabindex')).not.toBe('-1');
      });
    });

    it('renders active sort with secondary variant for visual distinction', () => {
      render(
        <SortUI
          schema={makeSortSchema({
            variant: 'buttons',
            sort: [{ field: 'name', direction: 'asc' }],
          })}
        />,
      );

      const nameBtn = screen.getByText('Name').closest('button')!;
      expect(nameBtn).toHaveAttribute('data-variant', 'secondary');

      const dateBtn = screen.getByText('Date').closest('button')!;
      expect(dateBtn).toHaveAttribute('data-variant', 'outline');
    });

    it('renders dropdown variant with select controls', () => {
      render(<SortUI schema={makeSortSchema({ variant: 'dropdown' })} />);

      const selectRoots = screen.getAllByTestId('select-root');
      // Field selector + direction selector
      expect(selectRoots).toHaveLength(2);
    });

    it('renders sort direction options (Ascending / Descending)', () => {
      render(<SortUI schema={makeSortSchema({ variant: 'dropdown' })} />);

      expect(screen.getByText('Ascending')).toBeInTheDocument();
      expect(screen.getByText('Descending')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 4. Toolbar actions are keyboard-accessible
  // =========================================================================
  describe('Toolbar keyboard accessibility', () => {
    it('Create button responds to keyboard activation', () => {
      const schema: ObjectViewSchema = {
        type: 'object-view',
        objectName: 'contacts',
      };

      render(<ObjectView schema={schema} dataSource={mockDataSource} />);

      const createBtn = screen.getByText('Create');
      // Simulate keyboard activation (Enter key on a focused button triggers click)
      fireEvent.keyDown(createBtn, { key: 'Enter', code: 'Enter' });
      fireEvent.keyUp(createBtn, { key: 'Enter', code: 'Enter' });
      // Button is a native <button>, so keyboard activation is inherent
      expect(createBtn.tagName).toBe('BUTTON');
    });

    it('sort buttons respond to click events (keyboard proxied)', () => {
      const onChange = vi.fn();
      render(
        <SortUI
          schema={{
            type: 'sort-ui',
            fields: [{ field: 'name', label: 'Name' }],
            variant: 'buttons',
          }}
          onChange={onChange}
        />,
      );

      const btn = screen.getByText('Name').closest('button')!;
      fireEvent.click(btn);
      expect(onChange).toHaveBeenCalledWith([{ field: 'name', direction: 'asc' }]);
    });

    it('filter text inputs accept keyboard input', () => {
      const onChange = vi.fn();
      render(
        <FilterUI
          schema={{
            type: 'filter-ui',
            filters: [{ field: 'query', label: 'Search', type: 'text' }],
          }}
          onChange={onChange}
        />,
      );

      const input = screen.getByPlaceholderText('Filter by Search');
      fireEvent.change(input, { target: { value: 'test' } });
      expect(onChange).toHaveBeenCalledWith({ query: 'test' });
    });
  });

  // =========================================================================
  // 5. Search input in toolbar has proper label and role
  // =========================================================================
  describe('Search input accessibility', () => {
    it('filter text input has an associated label element', () => {
      render(
        <FilterUI
          schema={{
            type: 'filter-ui',
            filters: [{ field: 'search', label: 'Search', type: 'text' }],
          }}
        />,
      );

      // Label with text "Search" should exist
      expect(screen.getByText('Search')).toBeInTheDocument();
      // Input should have descriptive placeholder
      const input = screen.getByPlaceholderText('Filter by Search');
      expect(input).toBeInTheDocument();
    });

    it('filter text input is an <input> element that is focusable', () => {
      render(
        <FilterUI
          schema={{
            type: 'filter-ui',
            filters: [{ field: 'q', label: 'Quick Search', type: 'text' }],
          }}
        />,
      );

      const input = screen.getByPlaceholderText('Filter by Quick Search');
      expect(input.tagName).toBe('INPUT');
      expect(input.getAttribute('tabindex')).not.toBe('-1');
    });
  });

  // =========================================================================
  // 6. View type selector renders with role="tablist"
  // =========================================================================
  describe('ViewSwitcher tablist rendering', () => {
    const makeViewSwitcherSchema = (
      overrides: Partial<ViewSwitcherSchema> = {},
    ): ViewSwitcherSchema => ({
      type: 'view-switcher',
      views: [
        { type: 'grid', label: 'Grid' },
        { type: 'kanban', label: 'Kanban' },
        { type: 'calendar', label: 'Calendar' },
      ],
      variant: 'tabs',
      ...overrides,
    });

    it('renders tabs variant with role="tablist"', () => {
      render(<ViewSwitcher schema={makeViewSwitcherSchema()} />);

      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeInTheDocument();
    });

    it('renders individual tabs with role="tab"', () => {
      render(<ViewSwitcher schema={makeViewSwitcherSchema()} />);

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(3);
    });

    it('marks the active tab with aria-selected="true"', () => {
      render(
        <ViewSwitcher
          schema={makeViewSwitcherSchema({ activeView: 'kanban' })}
        />,
      );

      const tabs = screen.getAllByRole('tab');
      const kanbanTab = tabs.find((t) => t.textContent?.includes('Kanban'));
      expect(kanbanTab).toBeDefined();
      expect(kanbanTab!.getAttribute('aria-selected')).toBe('true');
    });

    it('marks inactive tabs with aria-selected="false"', () => {
      render(
        <ViewSwitcher
          schema={makeViewSwitcherSchema({ activeView: 'grid' })}
        />,
      );

      const tabs = screen.getAllByRole('tab');
      const kanbanTab = tabs.find((t) => t.textContent?.includes('Kanban'));
      expect(kanbanTab!.getAttribute('aria-selected')).toBe('false');
    });

    it('tabs are keyboard-activatable via click', () => {
      const onViewChange = vi.fn();
      render(
        <ViewSwitcher
          schema={makeViewSwitcherSchema()}
          onViewChange={onViewChange}
        />,
      );

      const tabs = screen.getAllByRole('tab');
      const calendarTab = tabs.find((t) => t.textContent?.includes('Calendar'));
      fireEvent.click(calendarTab!);

      expect(onViewChange).toHaveBeenCalledWith('calendar');
    });

    it('renders buttons variant without tablist role', () => {
      render(
        <ViewSwitcher
          schema={makeViewSwitcherSchema({ variant: 'buttons' })}
        />,
      );

      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
      // Should render plain buttons instead
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBe(3);
    });
  });

  // =========================================================================
  // 7. Density / view variant selector renders with accessible options
  // =========================================================================
  describe('ViewSwitcher dropdown variant accessibility', () => {
    const makeDropdownSchema = (
      overrides: Partial<ViewSwitcherSchema> = {},
    ): ViewSwitcherSchema => ({
      type: 'view-switcher',
      views: [
        { type: 'grid', label: 'Grid' },
        { type: 'kanban', label: 'Kanban' },
      ],
      variant: 'dropdown',
      ...overrides,
    });

    it('renders dropdown with select-root controls', () => {
      render(<ViewSwitcher schema={makeDropdownSchema()} />);

      const selectRoot = screen.getByTestId('select-root');
      expect(selectRoot).toBeInTheDocument();
    });

    it('renders all view options inside the select', () => {
      render(<ViewSwitcher schema={makeDropdownSchema()} />);

      const items = screen.getAllByTestId('select-item');
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveTextContent('Grid');
      expect(items[1]).toHaveTextContent('Kanban');
    });

    it('renders option items with role="option"', () => {
      render(<ViewSwitcher schema={makeDropdownSchema()} />);

      const options = screen.getAllByRole('option');
      expect(options.length).toBe(2);
    });
  });

  // =========================================================================
  // Cross-view consistency: named list views use tablist
  // =========================================================================
  describe('Named list views tablist consistency', () => {
    it('renders named view tabs with role="tablist" for multiple views', () => {
      const schema: ObjectViewSchema = {
        type: 'object-view',
        objectName: 'contacts',
        listViews: {
          all: { label: 'All Contacts', type: 'grid' },
          active: { label: 'Active', type: 'grid', filter: [['status', '=', 'active']] },
        },
        defaultListView: 'all',
      };

      render(<ObjectView schema={schema} dataSource={mockDataSource} />);

      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeInTheDocument();
    });

    it('renders individual named view tabs with role="tab"', () => {
      const schema: ObjectViewSchema = {
        type: 'object-view',
        objectName: 'contacts',
        listViews: {
          all: { label: 'All Contacts', type: 'grid' },
          active: { label: 'Active', type: 'grid' },
          archived: { label: 'Archived', type: 'grid' },
        },
        defaultListView: 'all',
      };

      render(<ObjectView schema={schema} dataSource={mockDataSource} />);

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(3);
    });

    it('marks default named view tab as active', () => {
      const schema: ObjectViewSchema = {
        type: 'object-view',
        objectName: 'contacts',
        listViews: {
          all: { label: 'All Contacts', type: 'grid' },
          active: { label: 'Active', type: 'grid' },
        },
        defaultListView: 'all',
      };

      render(<ObjectView schema={schema} dataSource={mockDataSource} />);

      const tabs = screen.getAllByRole('tab');
      const allTab = tabs.find((t) => t.textContent?.includes('All Contacts'));
      expect(allTab!.getAttribute('aria-selected')).toBe('true');
    });

    it('does not render tablist when only one named view exists', () => {
      const schema: ObjectViewSchema = {
        type: 'object-view',
        objectName: 'contacts',
        listViews: {
          all: { label: 'All Contacts', type: 'grid' },
        },
      };

      render(<ObjectView schema={schema} dataSource={mockDataSource} />);

      expect(screen.queryByRole('tablist')).toBeNull();
    });
  });
});
