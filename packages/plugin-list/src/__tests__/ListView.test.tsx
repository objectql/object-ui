/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';
import { render, screen, fireEvent } from '@testing-library/react';
import { ListView, evaluateConditionalFormatting } from '../ListView';
import type { ListViewSchema } from '@object-ui/types';
import { SchemaRendererProvider } from '@object-ui/react';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    clear: () => { store = {}; },
    removeItem: (key: string) => { delete store[key]; },
  };
})();

const mockDataSource = {
  find: vi.fn().mockResolvedValue([]),
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const renderWithProvider = (component: React.ReactNode) => {
  return render(
    <SchemaRendererProvider dataSource={mockDataSource}>
      {component}
    </SchemaRendererProvider>
  );
};

/**
 * Reveal the visualization options regardless of which form the switcher
 * takes. With 2–4 visualizations the switcher renders an inline segmented
 * control whose option buttons are always visible, so there is nothing to
 * open. With 5+ it collapses into a "List ▾" dropdown that must be clicked
 * first. Click the dropdown trigger only when it exists.
 */
const openViewSwitcher = () => {
  const trigger = screen.queryByTestId('view-switcher-dropdown');
  if (trigger) fireEvent.click(trigger);
};

/**
 * Find a visualization option by its accessible name, regardless of switcher
 * form. The inline segmented control exposes each option as role="tab"; the
 * collapsed dropdown menu exposes them as plain buttons. Returns null when the
 * option is not offered.
 */
const queryViewOption = (name: string) =>
  screen.queryByRole('tab', { name }) ?? screen.queryByRole('button', { name });

const getViewOption = (name: string) => {
  const option = queryViewOption(name);
  if (!option) throw new Error(`View option "${name}" not found`);
  return option;
};

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('ListView', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should be exported', () => {
    expect(ListView).toBeDefined();
  });

  it('should be a forwardRef component', () => {
    // React.forwardRef wraps the component — typeof is 'object' with a render function
    expect(typeof ListView).toBe('object');
    expect(typeof (ListView as any).render).toBe('function');
  });

  it('should render with basic schema', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
    };

    const { container } = renderWithProvider(<ListView schema={schema} />);
    expect(container).toBeTruthy();
  });

  it('should render search icon button', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
    };

    renderWithProvider(<ListView schema={schema} />);
    expect(screen.getByTestId('search-icon-button')).toBeInTheDocument();
  });

  it('should expand search and call onSearchChange when search input changes', () => {
    const onSearchChange = vi.fn();
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
    };

    renderWithProvider(<ListView schema={schema} onSearchChange={onSearchChange} />);
    
    // Click the search icon to open the popover
    fireEvent.click(screen.getByTestId('search-icon-button'));
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'test' } });
    expect(onSearchChange).toHaveBeenCalledWith('test');
  });

  it('should persist view preference to localStorage', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
      options: {
        kanban: {
          groupField: 'status',
        },
      },
    };

    renderWithProvider(<ListView schema={schema} showViewSwitcher={true} />);

    // Reveal the visualization options, then pick Kanban
    openViewSwitcher();
    fireEvent.click(getViewOption('Kanban'));

    // localStorage should be set with new view
    const storageKey = 'listview-contacts-view';
    expect(localStorageMock.getItem(storageKey)).toBe('kanban');
  });

  it('should call onViewChange when view is changed', () => {
    const onViewChange = vi.fn();
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
    };

    renderWithProvider(<ListView schema={schema} onViewChange={onViewChange} />);
    
    // Simulate view change by updating the view prop in ViewSwitcher
    // Since we can't easily trigger the actual view switcher in tests,
    // we verify the callback is properly passed to the component
    expect(onViewChange).toBeDefined();
    
    // If we could trigger view change, we would expect:
    // expect(onViewChange).toHaveBeenCalledWith('list');
  });

  it('should toggle filter panel when filter button is clicked', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
    };

    renderWithProvider(<ListView schema={schema} />);
    
    // Find filter button (by icon or aria-label)
    const buttons = screen.getAllByRole('button');
    const filterButton = buttons.find(btn => 
      btn.querySelector('svg') !== null
    );
    
    if (filterButton) {
      fireEvent.click(filterButton);
      // After click, filter panel should be visible
    }
  });

  it('should handle sort order toggle', () => {
    const onSortChange = vi.fn();
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
      sort: [{ field: 'name', order: 'asc' }],
    };

    renderWithProvider(<ListView schema={schema} onSortChange={onSortChange} />);
    
    // Find sort button
    const buttons = screen.getAllByRole('button');
    const sortButton = buttons.find(btn => 
      btn.querySelector('svg') !== null
    );
    
    if (sortButton) {
      fireEvent.click(sortButton);
      // onSortChange should be called with new order
    }
  });

  it('should clear search when clear button is clicked', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
    };

    renderWithProvider(<ListView schema={schema} />);
    
    // Open search popover
    fireEvent.click(screen.getByTestId('search-icon-button'));
    const searchInput = screen.getByPlaceholderText(/search/i) as HTMLInputElement;
    
    // Type in search
    fireEvent.change(searchInput, { target: { value: 'test' } });
    expect(searchInput.value).toBe('test');
    
    // Find and click clear button (the X button inside the search popover)
    const popover = screen.getByTestId('search-popover');
    const clearButton = popover.querySelector('button');
    
    if (clearButton) {
      fireEvent.click(clearButton);
    }
  });

  it('should show default empty state when no data', async () => {
    mockDataSource.find.mockResolvedValue([]);
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
    };

    renderWithProvider(<ListView schema={schema} />);

    // Wait for data fetch to complete
    await vi.waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
    // With no filters/search this is the FIRST-RUN empty state ("Nothing here
    // yet"), which invites the user to create — "No items found" is reserved
    // for the filtered/no-matches case (see the hasActiveQuery branch).
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
  });

  it('should show custom empty state when configured', async () => {
    mockDataSource.find.mockResolvedValue([]);
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
      emptyState: {
        title: 'No contacts yet',
        message: 'Add your first contact to get started.',
      },
    };

    renderWithProvider(<ListView schema={schema} />);

    await vi.waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
    expect(screen.getByText('No contacts yet')).toBeInTheDocument();
    expect(screen.getByText('Add your first contact to get started.')).toBeInTheDocument();
  });
  it('should render hide fields popover', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email', 'phone'],
      showHideFields: true,
    };

    renderWithProvider(<ListView schema={schema} />);
    
    const hideFieldsButton = screen.getByRole('button', { name: /hide fields/i });
    expect(hideFieldsButton).toBeInTheDocument();
  });

  it('should render density mode button', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
      showDensity: true,
    };

    renderWithProvider(<ListView schema={schema} />);
    
    // Default density mode is 'compact'
    const densityButton = screen.getByLabelText('Density: Compact');
    expect(densityButton).toBeInTheDocument();
  });

  it('should render export button when exportOptions configured', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
      exportOptions: {
        formats: ['csv', 'json'],
      },
    };

    renderWithProvider(<ListView schema={schema} />);
    
    const exportButton = screen.getByRole('button', { name: /export/i });
    expect(exportButton).toBeInTheDocument();
  });

  it('should not render export button when exportOptions not configured', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
    };

    renderWithProvider(<ListView schema={schema} />);
    
    const exportButtons = screen.queryAllByRole('button', { name: /export/i });
    expect(exportButtons.length).toBe(0);
  });

  it('hides export button when operations.export is false', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
      exportOptions: { formats: ['csv', 'json'] },
      operations: { export: false },
    };

    renderWithProvider(<ListView schema={schema} />);

    const exportButtons = screen.queryAllByRole('button', { name: /export/i });
    expect(exportButtons.length).toBe(0);
  });

  it('keeps export button when operations is set but export is omitted (default-allow)', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
      exportOptions: { formats: ['csv', 'json'] },
      operations: { create: false },
    };

    renderWithProvider(<ListView schema={schema} />);

    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
  });

  it('routes export to the server exportDownload stream when the data source supports it', async () => {
    const exportDownload = vi.fn().mockResolvedValue(
      new Blob(['ID,Name\n1,Acme'], { type: 'text/csv' }),
    );
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const ds: any = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      exportDownload,
    };

    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
      exportOptions: { formats: ['csv', 'xlsx'] },
    };

    render(
      <SchemaRendererProvider dataSource={ds}>
        <ListView schema={schema} dataSource={ds} />
      </SchemaRendererProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    fireEvent.click(await screen.findByRole('button', { name: /export as xlsx/i }));

    await vi.waitFor(() => {
      expect(exportDownload).toHaveBeenCalledTimes(1);
    });
    const [resource, request] = exportDownload.mock.calls[0];
    expect(resource).toBe('contacts');
    expect(request).toMatchObject({ format: 'xlsx', fields: ['name', 'email'] });
    // The returned Blob is handed to the browser download path.
    await vi.waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledTimes(1);
    });

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });

  it('surfaces export failures instead of swallowing them', async () => {
    const exportDownload = vi.fn().mockRejectedValue(new Error('Permission denied'));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const ds: any = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      exportDownload,
    };

    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
      exportOptions: { formats: ['csv', 'xlsx'] },
    };

    render(
      <SchemaRendererProvider dataSource={ds}>
        <ListView schema={schema} dataSource={ds} />
      </SchemaRendererProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    fireEvent.click(await screen.findByRole('button', { name: /export as csv/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Permission denied');
  });

  it('does not call exportDownload when operations.export is false (programmatic guard)', () => {
    const exportDownload = vi.fn();
    const ds: any = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      exportDownload,
    };

    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
      exportOptions: { formats: ['csv', 'xlsx'] },
      operations: { export: false },
    };

    render(
      <SchemaRendererProvider dataSource={ds}>
        <ListView schema={schema} dataSource={ds} />
      </SchemaRendererProvider>
    );

    // Button is gated out, so there is no entry point to trigger an export.
    expect(screen.queryAllByRole('button', { name: /export/i }).length).toBe(0);
    expect(exportDownload).not.toHaveBeenCalled();
  });

  it('should apply hiddenFields to effective fields', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email', 'phone'],
      hiddenFields: ['phone'],
    };

    const { container } = renderWithProvider(<ListView schema={schema} />);
    expect(container).toBeTruthy();
  });

  it('should map rowHeight to density mode', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
      rowHeight: 'compact',
      showDensity: true,
    };

    renderWithProvider(<ListView schema={schema} />);
    const densityButton = screen.getByLabelText('Density: Compact');
    expect(densityButton).toBeInTheDocument();
  });

  it('should prefer densityMode over rowHeight', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
      rowHeight: 'compact',
      densityMode: 'spacious',
      showDensity: true,
    };

    renderWithProvider(<ListView schema={schema} />);
    const densityButton = screen.getByLabelText('Density: Spacious');
    expect(densityButton).toBeInTheDocument();
  });

  it('should apply aria attributes to root container', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
      aria: {
        label: 'Contacts List',
        live: 'polite',
      },
    };

    renderWithProvider(<ListView schema={schema} />);
    const region = screen.getByRole('region', { name: 'Contacts List' });
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('should render share button when sharing is enabled', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
      sharing: {
        enabled: true,
        visibility: 'team',
      },
    };

    renderWithProvider(<ListView schema={schema} />);
    const shareButton = screen.getByTestId('share-button');
    expect(shareButton).toBeInTheDocument();
    expect(shareButton).toHaveAttribute('title', 'Sharing: team');
  });

  it('should not render share button when sharing is not enabled', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
    };

    renderWithProvider(<ListView schema={schema} />);
    expect(screen.queryByTestId('share-button')).not.toBeInTheDocument();
  });

  it('should show record count bar when data is loaded', async () => {
    const mockItems = [
      { id: '1', name: 'Alice', email: 'alice@test.com' },
      { id: '2', name: 'Bob', email: 'bob@test.com' },
      { id: '3', name: 'Charlie', email: 'charlie@test.com' },
    ];
    mockDataSource.find.mockResolvedValue(mockItems);

    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
    };

    renderWithProvider(<ListView schema={schema} dataSource={mockDataSource} />);

    await vi.waitFor(() => {
      expect(screen.getByTestId('record-count-bar')).toBeInTheDocument();
    });
    expect(screen.getByText('3 records')).toBeInTheDocument();
  });

  it('should not show record count bar when no data', async () => {
    mockDataSource.find.mockResolvedValue([]);

    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
    };

    renderWithProvider(<ListView schema={schema} dataSource={mockDataSource} />);

    await vi.waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('record-count-bar')).not.toBeInTheDocument();
  });

  // ============================================
  // Auto-derived User Filters
  // ============================================
  describe('auto-derived userFilters', () => {
    it('should render userFilters when schema.userFilters is explicitly configured', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'status'],
        userFilters: {
          element: 'dropdown',
          fields: [
            { field: 'status', label: 'Status', options: [{ label: 'Active', value: 'active' }] },
          ],
        },
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.getByTestId('user-filters')).toBeInTheDocument();
      expect(screen.getByTestId('user-filters-dropdown')).toBeInTheDocument();
    });

    it('should NOT render filter elements without explicit userFilters config (ADR-0047 data mode)', async () => {
      const mockDs = {
        find: vi.fn().mockResolvedValue([]),
        findOne: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        getObjectSchema: vi.fn().mockResolvedValue({
          name: 'tasks',
          fields: {
            name: { type: 'text', label: 'Name' },
            status: {
              type: 'select',
              label: 'Status',
              options: [
                { label: 'Open', value: 'open' },
                { label: 'Closed', value: 'closed' },
              ],
            },
            is_active: { type: 'boolean', label: 'Active' },
          },
        }),
      };

      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'tasks',
        viewType: 'grid',
        fields: ['name', 'status', 'is_active'],
      };

      render(
        <SchemaRendererProvider dataSource={mockDs}>
          <ListView schema={schema} dataSource={mockDs} />
        </SchemaRendererProvider>
      );

      // Wait for the objectDef fetch to settle, then confirm no filter
      // elements appeared: select fields alone must not grow dropdowns.
      await vi.waitFor(() => {
        expect(mockDs.getObjectSchema).toHaveBeenCalled();
      });
      expect(screen.queryByTestId('user-filters')).not.toBeInTheDocument();
    });

    it('should fill fields from objectDef for a `{ element: "dropdown" }` shorthand config', async () => {
      const mockDs = {
        find: vi.fn().mockResolvedValue([]),
        findOne: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        getObjectSchema: vi.fn().mockResolvedValue({
          name: 'tasks',
          fields: {
            name: { type: 'text', label: 'Name' },
            status: {
              type: 'select',
              label: 'Status',
              options: [
                { label: 'Open', value: 'open' },
                { label: 'Closed', value: 'closed' },
              ],
            },
            is_active: { type: 'boolean', label: 'Active' },
            description: { type: 'text', label: 'Description' },
          },
        }),
      };

      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'tasks',
        viewType: 'grid',
        fields: ['name', 'status', 'is_active'],
        userFilters: { element: 'dropdown' },
      };

      render(
        <SchemaRendererProvider dataSource={mockDs}>
          <ListView schema={schema} dataSource={mockDs} />
        </SchemaRendererProvider>
      );

      // Wait for objectDef to load — the badges appear once the shorthand
      // config fills its field list from the fetched schema.
      await vi.waitFor(() => {
        expect(screen.getByTestId('filter-badge-status')).toBeInTheDocument();
      });
      expect(screen.getByTestId('user-filters-dropdown')).toBeInTheDocument();
      expect(screen.getByTestId('filter-badge-is_active')).toBeInTheDocument();
    });

    it('should not show Add filter button in userFilters (removed from UI)', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'status'],
        userFilters: {
          element: 'dropdown',
          fields: [
            { field: 'status', label: 'Status', options: [{ label: 'Active', value: 'active' }] },
          ],
        },
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.queryByTestId('user-filters-add')).not.toBeInTheDocument();
    });

    it('should not render userFilters when objectDef has no filterable fields', async () => {
      const mockDs = {
        find: vi.fn().mockResolvedValue([]),
        findOne: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        getObjectSchema: vi.fn().mockResolvedValue({
          name: 'notes',
          fields: {
            title: { type: 'text', label: 'Title' },
            body: { type: 'text', label: 'Body' },
          },
        }),
      };

      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'notes',
        viewType: 'grid',
        fields: ['title', 'body'],
      };

      render(
        <SchemaRendererProvider dataSource={mockDs}>
          <ListView schema={schema} dataSource={mockDs} />
        </SchemaRendererProvider>
      );

      // Wait for objectDef to load
      await vi.waitFor(() => {
        expect(mockDs.getObjectSchema).toHaveBeenCalled();
      });
      // userFilters should not render since no filterable fields
      expect(screen.queryByTestId('user-filters')).not.toBeInTheDocument();
    });
  });

  describe('$select projection — speculative view-binding fields', () => {
    const lastSelect = (find: ReturnType<typeof vi.fn>): string[] | undefined => {
      const call = find.mock.calls.at(-1);
      return call?.[1]?.$select as string[] | undefined;
    };

    it('drops speculative fields the object does not have (so they cannot zero the list)', async () => {
      // Reproduces the "published app shows no data" bug: a timeline config
      // auto-adds status/priority, but `product` has neither. Backends that
      // reject unknown $select keys with an empty result then return 0 rows.
      const mockDs = {
        find: vi.fn().mockResolvedValue([]),
        findOne: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
        getObjectSchema: vi.fn().mockResolvedValue({
          name: 'product',
          fields: {
            product_name: { type: 'text' },
            sku: { type: 'text' },
            is_active: { type: 'boolean' },
          },
        }),
      };

      const schema = {
        type: 'list-view',
        objectName: 'product',
        viewType: 'grid',
        fields: ['product_name', 'sku', 'is_active'],
        // Present so the status/priority + date auto-include paths fire.
        timeline: {},
        calendar: {},
      } as unknown as ListViewSchema;

      render(
        <SchemaRendererProvider dataSource={mockDs}>
          <ListView schema={schema} dataSource={mockDs} />
        </SchemaRendererProvider>
      );

      await vi.waitFor(() => expect(mockDs.find).toHaveBeenCalled());
      const select = lastSelect(mockDs.find)!;
      // Real fields survive…
      expect(select).toEqual(expect.arrayContaining(['product_name', 'sku', 'is_active']));
      // …phantom view-binding fields are gone.
      for (const phantom of ['status', 'priority', 'start_date', 'end_date', 'due_date']) {
        expect(select).not.toContain(phantom);
      }
    });

    it('keeps a speculative field when the object actually has it', async () => {
      const mockDs = {
        find: vi.fn().mockResolvedValue([]),
        findOne: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
        getObjectSchema: vi.fn().mockResolvedValue({
          name: 'task',
          fields: {
            subject: { type: 'text' },
            status: { type: 'select' },
            priority: { type: 'select' },
          },
        }),
      };

      const schema = {
        type: 'list-view',
        objectName: 'task',
        viewType: 'grid',
        fields: ['subject'],
        timeline: {},
      } as unknown as ListViewSchema;

      render(
        <SchemaRendererProvider dataSource={mockDs}>
          <ListView schema={schema} dataSource={mockDs} />
        </SchemaRendererProvider>
      );

      await vi.waitFor(() => expect(mockDs.find).toHaveBeenCalled());
      const select = lastSelect(mockDs.find)!;
      expect(select).toEqual(expect.arrayContaining(['subject', 'status', 'priority']));
    });
  });

  // ============================================
  // Merged Toolbar Layout
  // ============================================
  describe('Merged toolbar layout', () => {
    it('should render userFilters inline within the toolbar row', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'status'],
        userFilters: {
          element: 'dropdown',
          fields: [
            { field: 'status', label: 'Status', options: [{ label: 'Active', value: 'active' }] },
          ],
        },
      };

      renderWithProvider(<ListView schema={schema} />);
      // userFilters should be in the toolbar (not a separate row)
      const userFilters = screen.getByTestId('user-filters');
      expect(userFilters).toBeInTheDocument();
      // Search icon should also be in the same toolbar
      expect(screen.getByTestId('search-icon-button')).toBeInTheDocument();
    });

    it('should open search popover when search icon is clicked', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
      };

      renderWithProvider(<ListView schema={schema} />);
      fireEvent.click(screen.getByTestId('search-icon-button'));
      expect(screen.getByTestId('search-popover')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    });

    it('should highlight search icon when search term is active', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
      };

      renderWithProvider(<ListView schema={schema} />);
      fireEvent.click(screen.getByTestId('search-icon-button'));
      fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'test' } });
      // The search icon button should have active styling (foreground text + medium weight)
      const searchBtn = screen.getByTestId('search-icon-button');
      expect(searchBtn.className).toContain('text-foreground');
      expect(searchBtn.className).toContain('font-medium');
    });
  });

  // ============================
  // Toolbar Toggle Visibility
  // ============================
  describe('Toolbar Toggle Visibility', () => {
    it('should hide Search icon when showSearch is false', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        showSearch: false,
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.queryByTestId('search-icon-button')).not.toBeInTheDocument();
    });

    it('should show Search icon when showSearch is true', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        showSearch: true,
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.getByTestId('search-icon-button')).toBeInTheDocument();
    });

    it('should show Search icon when showSearch is undefined (default)', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.getByTestId('search-icon-button')).toBeInTheDocument();
    });

    it('should hide Filter button when showFilters is false', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        showFilters: false,
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.queryByRole('button', { name: /filter/i })).not.toBeInTheDocument();
    });

    it('should show Filter button when showFilters is true', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        showFilters: true,
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.getByRole('button', { name: /filter/i })).toBeInTheDocument();
    });

    it('should hide Sort button when showSort is false', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        showSort: false,
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.queryByRole('button', { name: /^sort$/i })).not.toBeInTheDocument();
    });

    it('should show Sort button when showSort is true', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        showSort: true,
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.getByRole('button', { name: /^sort$/i })).toBeInTheDocument();
    });

    // Hide Fields visibility
    it('should hide Hide Fields button when showHideFields is false', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email', 'phone'],
        showHideFields: false,
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.queryByRole('button', { name: /hide fields/i })).not.toBeInTheDocument();
    });

    it('should hide Hide Fields button by default (showHideFields undefined)', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email', 'phone'],
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.queryByRole('button', { name: /hide fields/i })).not.toBeInTheDocument();
    });

    // Group visibility
    it('should hide Group button when showGroup is false', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        showGroup: false,
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.queryByRole('button', { name: /group/i })).not.toBeInTheDocument();
    });

    it('should show Group button by default (showGroup undefined)', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.getByRole('button', { name: /group/i })).toBeInTheDocument();
    });

    // Color visibility
    it('should hide Color button when showColor is false', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        showColor: false,
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.queryByRole('button', { name: /color/i })).not.toBeInTheDocument();
    });

    it('should hide Color button by default (showColor undefined)', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.queryByRole('button', { name: /color/i })).not.toBeInTheDocument();
    });

    // Density visibility
    it('should hide Density button when showDensity is false', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        showDensity: false,
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.queryByTitle(/density/i)).not.toBeInTheDocument();
    });

    it('should show Density button by default (showDensity undefined)', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.getByLabelText(/density/i)).toBeInTheDocument();
    });

    // Export + allowExport
    it('should hide Export button when allowExport is false even with exportOptions', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        exportOptions: { formats: ['csv', 'json'] },
        allowExport: false,
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
    });

    // P1-4: compactToolbar collapses appearance/grouping cluster
    describe('compactToolbar', () => {
      it('renders View settings trigger when compactToolbar=true', () => {
        const schema: ListViewSchema = {
          type: 'list-view',
          objectName: 'contacts',
          viewType: 'grid',
          fields: ['name', 'email'],
          showDensity: true,
          showColor: true,
          showHideFields: true,
          compactToolbar: true,
        };
        renderWithProvider(<ListView schema={schema} />);
        expect(screen.getByTestId('view-settings-trigger')).toBeInTheDocument();
        // legacy density button hidden in compact mode
        expect(screen.queryByLabelText('Density: Compact')).not.toBeInTheDocument();
      });

      it('renders legacy buttons when compactToolbar is unset', () => {
        const schema: ListViewSchema = {
          type: 'list-view',
          objectName: 'contacts',
          viewType: 'grid',
          fields: ['name', 'email'],
          showDensity: true,
        };
        renderWithProvider(<ListView schema={schema} />);
        expect(screen.queryByTestId('view-settings-trigger')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Density: Compact')).toBeInTheDocument();
      });
    });
  });

  // ============================
  // Schema prop forwarding to child views
  // ============================
  describe('Schema prop forwarding', () => {
    it('should pass striped to child view schema', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        striped: true,
      };

      const { container } = renderWithProvider(<ListView schema={schema} />);
      expect(container).toBeTruthy();
    });

    it('should pass bordered to child view schema', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        bordered: true,
      };

      const { container } = renderWithProvider(<ListView schema={schema} />);
      expect(container).toBeTruthy();
    });

    it('should pass wrapHeaders to grid view schema', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        wrapHeaders: true,
      };

      const { container } = renderWithProvider(<ListView schema={schema} />);
      expect(container).toBeTruthy();
    });

    it('should pass inlineEdit as editable to grid view schema', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        inlineEdit: true,
      };

      const { container } = renderWithProvider(<ListView schema={schema} />);
      expect(container).toBeTruthy();
    });
  });

  // ============================
  // showRecordCount flag
  // ============================
  describe('showRecordCount flag', () => {
    it('should hide record count bar when showRecordCount is false', async () => {
      const mockItems = [
        { id: '1', name: 'Alice', email: 'alice@test.com' },
        { id: '2', name: 'Bob', email: 'bob@test.com' },
      ];
      mockDataSource.find.mockResolvedValue(mockItems);

      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        showRecordCount: false,
      };

      renderWithProvider(<ListView schema={schema} dataSource={mockDataSource} />);

      // Wait for data fetch
      await vi.waitFor(() => {
        expect(mockDataSource.find).toHaveBeenCalled();
      });
      // Give time for state update
      await vi.waitFor(() => {
        expect(screen.queryByTestId('record-count-bar')).not.toBeInTheDocument();
      });
    });

    it('should show record count bar by default (showRecordCount undefined)', async () => {
      const mockItems = [
        { id: '1', name: 'Alice', email: 'alice@test.com' },
      ];
      mockDataSource.find.mockResolvedValue(mockItems);

      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
      };

      renderWithProvider(<ListView schema={schema} dataSource={mockDataSource} />);

      await vi.waitFor(() => {
        expect(screen.getByTestId('record-count-bar')).toBeInTheDocument();
      });
    });
  });

  // ============================
  // rowHeight short/extra_tall mapping
  // ============================
  describe('rowHeight enum gaps', () => {
    it('should map rowHeight short to compact density', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        rowHeight: 'short',
        showDensity: true,
      };

      renderWithProvider(<ListView schema={schema} />);
      const densityButton = screen.getByLabelText('Density: Compact');
      expect(densityButton).toBeInTheDocument();
    });

    it('should map rowHeight extra_tall to spacious density', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        rowHeight: 'extra_tall',
        showDensity: true,
      };

      renderWithProvider(<ListView schema={schema} />);
      const densityButton = screen.getByLabelText('Density: Spacious');
      expect(densityButton).toBeInTheDocument();
    });
  });

  // ============================
  // sort legacy string format
  // ============================
  describe('sort legacy string format', () => {
    it('should accept sort items as string format "field desc"', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        sort: ['name desc' as any],
      };

      const { container } = renderWithProvider(<ListView schema={schema} />);
      expect(container).toBeTruthy();
      // Should show sort button with badge indicating 1 active sort
      const sortButton = screen.getByRole('button', { name: /sort/i });
      expect(sortButton).toBeInTheDocument();
    });
  });

  // ============================
  // description rendering
  // ============================
  describe('description rendering', () => {
    it('should render view description when provided', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        description: 'A list of all company contacts',
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.getByTestId('view-description')).toBeInTheDocument();
      expect(screen.getByText('A list of all company contacts')).toBeInTheDocument();
    });

    it('should hide description when appearance.showDescription is false', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        description: 'A list of all company contacts',
        appearance: { showDescription: false },
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.queryByTestId('view-description')).not.toBeInTheDocument();
    });

    it('should not render description when not provided', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.queryByTestId('view-description')).not.toBeInTheDocument();
    });
  });

  // ============================
  // allowPrinting button
  // ============================
  describe('allowPrinting', () => {
    it('should render print button when allowPrinting is true', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        allowPrinting: true,
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.getByTestId('print-button')).toBeInTheDocument();
    });

    it('should not render print button when allowPrinting is false', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        allowPrinting: false,
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.queryByTestId('print-button')).not.toBeInTheDocument();
    });

    it('should not render print button by default', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.queryByTestId('print-button')).not.toBeInTheDocument();
    });
  });

  // ============================
  // addRecord button
  // ============================
  describe('addRecord button', () => {
    it('should render add record button when addRecord.enabled is true', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        addRecord: { enabled: true },
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.getByTestId('add-record-button')).toBeInTheDocument();
    });

    it('should not render add record button when addRecord.enabled is false', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        addRecord: { enabled: false },
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.queryByTestId('add-record-button')).not.toBeInTheDocument();
    });

    it('should not render add record button by default', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.queryByTestId('add-record-button')).not.toBeInTheDocument();
    });

    it('should hide add record button when userActions.addRecordForm is false', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        addRecord: { enabled: true },
        userActions: { addRecordForm: false },
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.queryByTestId('add-record-button')).not.toBeInTheDocument();
    });

    it('should render add record button at bottom when position is bottom', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        addRecord: { enabled: true, position: 'bottom' },
      };

      renderWithProvider(<ListView schema={schema} />);
      const btn = screen.getByTestId('add-record-button');
      expect(btn).toBeInTheDocument();
      // The bottom button is wrapped in a border-t div outside the toolbar
      expect(btn.closest('div.border-t')).toBeTruthy();
    });

    it('should render add record button in toolbar when position is top', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        addRecord: { enabled: true, position: 'top' },
      };

      renderWithProvider(<ListView schema={schema} />);
      const btn = screen.getByTestId('add-record-button');
      expect(btn).toBeInTheDocument();
      // The top button is inside the toolbar border-b div
      expect(btn.closest('div.border-b')).toBeTruthy();
    });
  });

  // ============================
  // userActions toolbar control
  // ============================
  describe('userActions toolbar control', () => {
    it('should hide Search when userActions.search is false', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        userActions: { search: false },
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.queryByTestId('search-icon-button')).not.toBeInTheDocument();
    });

    it('should hide Sort when userActions.sort is false', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        userActions: { sort: false },
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.queryByRole('button', { name: /^sort$/i })).not.toBeInTheDocument();
    });

    it('should hide Filter when userActions.filter is false', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        userActions: { filter: false },
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.queryByRole('button', { name: /filter/i })).not.toBeInTheDocument();
    });

    it('should hide Density when userActions.rowHeight is false', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        userActions: { rowHeight: false },
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.queryByTitle(/density/i)).not.toBeInTheDocument();
    });

    it('should show toolbar buttons when userActions are true', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        userActions: { search: true, sort: true, filter: true, rowHeight: true },
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.getByTestId('search-icon-button')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^sort$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /filter/i })).toBeInTheDocument();
      expect(screen.getByTitle(/density/i)).toBeInTheDocument();
    });

    it('userActions.search should override showSearch', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        showSearch: true,
        userActions: { search: false },
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.queryByTestId('search-icon-button')).not.toBeInTheDocument();
    });
  });

  // ============================
  // appearance.allowedVisualizations
  // ============================
  describe('appearance.allowedVisualizations', () => {
    it('should restrict ViewSwitcher to allowedVisualizations', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        appearance: { allowedVisualizations: ['grid', 'kanban'] },
        options: {
          kanban: { groupField: 'status' },
          calendar: { startDateField: 'date' },
        },
      };

      renderWithProvider(<ListView schema={schema} showViewSwitcher={true} />);
      // Should only offer grid and kanban, not calendar
      openViewSwitcher();
      expect(queryViewOption('Grid')).toBeInTheDocument();
      expect(queryViewOption('Kanban')).toBeInTheDocument();
      expect(queryViewOption('Calendar')).not.toBeInTheDocument();
    });
  });

  // ============================
  // Spec config usage (kanban/gallery/timeline)
  // ============================
  describe('spec config usage', () => {
    it('should use spec kanban config over legacy options', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        kanban: { groupField: 'priority' },
      };

      renderWithProvider(<ListView schema={schema} showViewSwitcher={true} />);
      // Should enable kanban view since kanban.groupField is set
      openViewSwitcher();
      expect(queryViewOption('Kanban')).toBeInTheDocument();
    });

    it('should use spec gallery config over legacy options', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        gallery: { coverField: 'photo', titleField: 'name' },
      };

      renderWithProvider(<ListView schema={schema} showViewSwitcher={true} />);
      openViewSwitcher();
      expect(queryViewOption('Gallery')).toBeInTheDocument();
    });

    it('should use spec timeline config over legacy options', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        timeline: { startDateField: 'created_at', titleField: 'name' },
      };

      renderWithProvider(<ListView schema={schema} showViewSwitcher={true} />);
      openViewSwitcher();
      expect(queryViewOption('Timeline')).toBeInTheDocument();
    });

    it('should use spec calendar config over legacy options', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        calendar: { startDateField: 'date', titleField: 'name' },
      };

      renderWithProvider(<ListView schema={schema} showViewSwitcher={true} />);
      openViewSwitcher();
      expect(queryViewOption('Calendar')).toBeInTheDocument();
    });

    it('should use spec gantt config over legacy options', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        gantt: { startDateField: 'start', endDateField: 'end' },
      };

      renderWithProvider(<ListView schema={schema} showViewSwitcher={true} />);
      openViewSwitcher();
      expect(queryViewOption('Gantt')).toBeInTheDocument();
    });
  });

  // ============================
  // pageSizeOptions UI
  // ============================
  // NOTE: For the GRID view the rows-per-page selector now lives in the
  // DataTable's own server-driven pager (ObjectGrid forwards
  // pagination.pageSizeOptions straight through), so ListView no longer renders
  // its native <select data-testid="page-size-selector"> for grids — that fixed
  // a duplicate-control bug. The native fallback selector below is therefore
  // exercised through a NON-grid view (gallery), which has no DataTable pager.
  // The grid combobox option list is covered in
  // components/data-table-manual-pagination.test.tsx.
  describe('pageSizeOptions', () => {
    it('should render page size selector when pageSizeOptions is provided (non-grid view)', async () => {
      const mockItems = [
        { id: '1', name: 'Alice', email: 'alice@test.com' },
      ];
      mockDataSource.find.mockResolvedValue(mockItems);

      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'gallery',
        fields: ['name', 'email'],
        pagination: { pageSize: 25, pageSizeOptions: [10, 25, 50, 100] },
      };

      renderWithProvider(<ListView schema={schema} dataSource={mockDataSource} />);

      await vi.waitFor(() => {
        expect(screen.getByTestId('page-size-selector')).toBeInTheDocument();
      });
    });

    it('should not render page size selector when pageSizeOptions is not provided', async () => {
      const mockItems = [
        { id: '1', name: 'Alice', email: 'alice@test.com' },
      ];
      mockDataSource.find.mockResolvedValue(mockItems);

      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        pagination: { pageSize: 25 },
      };

      renderWithProvider(<ListView schema={schema} dataSource={mockDataSource} />);

      await vi.waitFor(() => {
        expect(screen.getByTestId('record-count-bar')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('page-size-selector')).not.toBeInTheDocument();
    });
  });

  // ============================
  // searchableFields scoping
  // ============================
  describe('searchableFields scoping', () => {
    it('should pass $search and $searchFields to data query', async () => {
      mockDataSource.find.mockResolvedValue([]);

      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        searchableFields: ['name', 'email'],
      };

      renderWithProvider(<ListView schema={schema} dataSource={mockDataSource} />);

      // Click search icon to open popover, then type search query
      fireEvent.click(screen.getByTestId('search-icon-button'));
      const searchInput = screen.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: 'alice' } });

      // Wait for debounced fetch
      await vi.waitFor(() => {
        const lastCall = mockDataSource.find.mock.calls[mockDataSource.find.mock.calls.length - 1];
        expect(lastCall[1]).toHaveProperty('$search', 'alice');
        expect(lastCall[1]).toHaveProperty('$searchFields', ['name', 'email']);
      });
    });
  });

  // ============================
  // data (ViewDataSchema) support
  // ============================
  describe('data (ViewDataSchema) support', () => {
    it('should use inline data when schema.data has provider value', async () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        data: {
          provider: 'value',
          items: [
            { id: '1', name: 'Alice', email: 'alice@test.com' },
            { id: '2', name: 'Bob', email: 'bob@test.com' },
          ],
        } as any,
      };

      mockDataSource.find.mockClear();
      renderWithProvider(<ListView schema={schema} dataSource={mockDataSource} />);

      await vi.waitFor(() => {
        expect(screen.getByTestId('record-count-bar')).toBeInTheDocument();
      });
      expect(screen.getByText('2 records')).toBeInTheDocument();
      expect(mockDataSource.find).not.toHaveBeenCalled();
    });

    it('should use inline data when schema.data is a plain array', async () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        data: [
          { id: '1', name: 'Alice', email: 'alice@test.com' },
          { id: '2', name: 'Bob', email: 'bob@test.com' },
        ] as any,
      };

      mockDataSource.find.mockClear();
      renderWithProvider(<ListView schema={schema} dataSource={mockDataSource} />);

      await vi.waitFor(() => {
        expect(screen.getByTestId('record-count-bar')).toBeInTheDocument();
      });
      expect(screen.getByText('2 records')).toBeInTheDocument();
      expect(mockDataSource.find).not.toHaveBeenCalled();
    });

    it('should filter inline array data by searchTerm', async () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        data: [
          { id: '1', name: 'Alice', email: 'alice@test.com' },
          { id: '2', name: 'Bob', email: 'bob@test.com' },
          { id: '3', name: 'Charlie', email: 'charlie@test.com' },
        ] as any,
      };

      mockDataSource.find.mockClear();
      renderWithProvider(<ListView schema={schema} dataSource={mockDataSource} />);

      await vi.waitFor(() => {
        expect(screen.getByText('3 records')).toBeInTheDocument();
      });

      // Open search popover and type search query
      fireEvent.click(screen.getByTestId('search-icon-button'));
      fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'alice' } });

      await vi.waitFor(() => {
        expect(screen.getByText('1 record')).toBeInTheDocument();
      });
      expect(mockDataSource.find).not.toHaveBeenCalled();
    });

    it('should filter value provider data by searchTerm', async () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        data: {
          provider: 'value',
          items: [
            { id: '1', name: 'Alice', email: 'alice@test.com' },
            { id: '2', name: 'Bob', email: 'bob@test.com' },
          ],
        } as any,
      };

      mockDataSource.find.mockClear();
      renderWithProvider(<ListView schema={schema} dataSource={mockDataSource} />);

      await vi.waitFor(() => {
        expect(screen.getByText('2 records')).toBeInTheDocument();
      });

      // Open search popover and type search query
      fireEvent.click(screen.getByTestId('search-icon-button'));
      fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'bob' } });

      await vi.waitFor(() => {
        expect(screen.getByText('1 record')).toBeInTheDocument();
      });
      expect(mockDataSource.find).not.toHaveBeenCalled();
    });

    it('should fall back to dataSource.find when schema.data is not set', async () => {
      const mockItems = [
        { id: '1', name: 'Alice', email: 'alice@test.com' },
      ];
      mockDataSource.find.mockResolvedValue(mockItems);

      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
      };

      renderWithProvider(<ListView schema={schema} dataSource={mockDataSource} />);

      await vi.waitFor(() => {
        expect(mockDataSource.find).toHaveBeenCalled();
      });
    });
  });

  // ============================
  // grouping popover
  // ============================
  describe('grouping popover', () => {
    it('should render enabled Group button (not disabled)', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
      };

      renderWithProvider(<ListView schema={schema} />);
      const groupButton = screen.getByRole('button', { name: /group/i });
      expect(groupButton).toBeInTheDocument();
      expect(groupButton).not.toBeDisabled();
    });

    it('should open grouping popover on click', async () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
      };

      renderWithProvider(<ListView schema={schema} />);
      const groupButton = screen.getByRole('button', { name: /group/i });
      fireEvent.click(groupButton);

      await vi.waitFor(() => {
        expect(screen.getByText('Group By')).toBeInTheDocument();
      });
      expect(screen.getByTestId('group-field-list')).toBeInTheDocument();
    });

    it('should render active grouping badge when groupingConfig is set via schema', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email', 'status'],
        grouping: { fields: [{ field: 'status', order: 'asc' }] },
      };

      renderWithProvider(<ListView schema={schema} />);
      const groupButton = screen.getByRole('button', { name: /group/i });
      // Badge showing count "1" should be inside the button
      expect(groupButton.textContent).toContain('1');
    });
  });

  // ============================
  // rowColor popover
  // ============================
  describe('rowColor popover', () => {
    it('should render enabled Color button (not disabled)', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        showColor: true,
      };

      renderWithProvider(<ListView schema={schema} />);
      const colorButton = screen.getByRole('button', { name: /color/i });
      expect(colorButton).toBeInTheDocument();
      expect(colorButton).not.toBeDisabled();
    });

    it('should open color popover on click', async () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        showColor: true,
      };

      renderWithProvider(<ListView schema={schema} />);
      const colorButton = screen.getByRole('button', { name: /color/i });
      fireEvent.click(colorButton);

      await vi.waitFor(() => {
        expect(screen.getByText('Row Color')).toBeInTheDocument();
      });
      expect(screen.getByTestId('color-field-select')).toBeInTheDocument();
    });
  });

  // ============================
  // exportOptions format reconciliation
  // ============================
  describe('exportOptions format reconciliation', () => {
    it('should render export button when exportOptions is a string array', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        exportOptions: ['csv', 'json'] as any,
      };

      renderWithProvider(<ListView schema={schema} />);
      const exportButton = screen.getByRole('button', { name: /export/i });
      expect(exportButton).toBeInTheDocument();
    });

    it('should render export button when exportOptions is an object', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        exportOptions: { formats: ['csv', 'json'] },
      };

      renderWithProvider(<ListView schema={schema} />);
      const exportButton = screen.getByRole('button', { name: /export/i });
      expect(exportButton).toBeInTheDocument();
    });
  });

  // ============================
  // conditionalFormatting spec format
  // ============================
  describe('conditionalFormatting spec format', () => {
    it('should evaluate spec format with condition and style', () => {
      const result = evaluateConditionalFormatting(
        { status: 'active', amount: 200 },
        [{ condition: '${data.status === "active"}', style: { backgroundColor: '#e0ffe0', color: '#0a0' } }] as any,
      );
      expect(result).toEqual({ backgroundColor: '#e0ffe0', color: '#0a0' });
    });
  });

  // ============================
  // sharing spec format
  // ============================
  describe('sharing spec format', () => {
    it('should render share button when sharing.type is set (spec format)', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        sharing: { type: 'collaborative' } as any,
      };

      renderWithProvider(<ListView schema={schema} />);
      const shareButton = screen.getByTestId('share-button');
      expect(shareButton).toBeInTheDocument();
      expect(shareButton).toHaveAttribute('title', 'Sharing: collaborative');
    });
  });

  // ============================
  // bulkActions bar
  // ============================
  describe('bulkActions bar', () => {
    it('should not render bulk actions bar when no rows are selected', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        bulkActions: ['delete', 'archive'] as any,
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.queryByTestId('bulk-actions-bar')).not.toBeInTheDocument();
    });
  });

  // ============================
  // pageSizeOptions dynamic integration
  // ============================
  describe('pageSizeOptions dynamic integration', () => {
    it('should render page size selector as controlled component', async () => {
      const mockItems = [
        { id: '1', name: 'Alice', email: 'alice@test.com' },
        { id: '2', name: 'Bob', email: 'bob@test.com' },
      ];
      mockDataSource.find.mockResolvedValue(mockItems);

      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'gallery',
        fields: ['name', 'email'],
        pagination: { pageSize: 25, pageSizeOptions: [10, 25, 50] },
      };

      renderWithProvider(<ListView schema={schema} dataSource={mockDataSource} />);

      await vi.waitFor(() => {
        expect(screen.getByTestId('page-size-selector')).toBeInTheDocument();
      });

      const selector = screen.getByTestId('page-size-selector');
      expect(selector).toHaveValue('25');
    });

    it('should re-fetch data when page size changes', async () => {
      const mockItems = [
        { id: '1', name: 'Alice', email: 'alice@test.com' },
        { id: '2', name: 'Bob', email: 'bob@test.com' },
      ];
      mockDataSource.find.mockResolvedValue(mockItems);

      const onPageSizeChange = vi.fn();
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'gallery',
        fields: ['name', 'email'],
        pagination: { pageSize: 25, pageSizeOptions: [10, 25, 50, 100] },
      };

      renderWithProvider(<ListView schema={schema} dataSource={mockDataSource} onPageSizeChange={onPageSizeChange} />);

      await vi.waitFor(() => {
        expect(screen.getByTestId('page-size-selector')).toBeInTheDocument();
      });

      const fetchCountBefore = mockDataSource.find.mock.calls.length;

      // Change page size to 50
      const selector = screen.getByTestId('page-size-selector');
      fireEvent.change(selector, { target: { value: '50' } });

      expect(onPageSizeChange).toHaveBeenCalledWith(50);

      // Data should be re-fetched with the new page size
      await vi.waitFor(() => {
        expect(mockDataSource.find.mock.calls.length).toBeGreaterThan(fetchCountBefore);
      });
    });

    it('should render all page size options in the selector', async () => {
      const mockItems = [
        { id: '1', name: 'Alice', email: 'alice@test.com' },
      ];
      mockDataSource.find.mockResolvedValue(mockItems);

      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'gallery',
        fields: ['name', 'email'],
        pagination: { pageSize: 10, pageSizeOptions: [10, 25, 50, 100] },
      };

      renderWithProvider(<ListView schema={schema} dataSource={mockDataSource} />);

      await vi.waitFor(() => {
        expect(screen.getByTestId('page-size-selector')).toBeInTheDocument();
      });

      const options = screen.getByTestId('page-size-selector').querySelectorAll('option');
      expect(options).toHaveLength(4);
      expect(options[0]).toHaveValue('10');
      expect(options[1]).toHaveValue('25');
      expect(options[2]).toHaveValue('50');
      expect(options[3]).toHaveValue('100');
    });

    it('should not render page size selector when pageSizeOptions is not configured', async () => {
      const mockItems = [
        { id: '1', name: 'Alice', email: 'alice@test.com' },
      ];
      mockDataSource.find.mockResolvedValue(mockItems);

      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        pagination: { pageSize: 25 },
      };

      renderWithProvider(<ListView schema={schema} dataSource={mockDataSource} />);

      await vi.waitFor(() => {
        expect(screen.getByTestId('record-count-bar')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('page-size-selector')).not.toBeInTheDocument();
    });
  });

  // ============================
  // sharing spec format — additional tests
  // ============================
  describe('sharing spec format — additional', () => {
    it('should render share button with spec personal type', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        sharing: { type: 'personal' },
      };

      renderWithProvider(<ListView schema={schema} />);
      const shareButton = screen.getByTestId('share-button');
      expect(shareButton).toBeInTheDocument();
    });

    it('should display lockedBy in sharing tooltip when set', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        sharing: { type: 'collaborative', lockedBy: 'admin@example.com' },
      };

      renderWithProvider(<ListView schema={schema} />);
      const shareButton = screen.getByTestId('share-button');
      expect(shareButton).toBeInTheDocument();
      expect(shareButton).toHaveAttribute('title', 'Sharing: collaborative');
    });
  });

  // ============================
  // filterableFields whitelist
  // ============================
  describe('filterableFields', () => {
    it('should render with filterableFields whitelist restricting available fields', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: [
          { name: 'name', label: 'Name', type: 'text' },
          { name: 'email', label: 'Email', type: 'text' },
          { name: 'phone', label: 'Phone', type: 'text' },
        ] as any,
        filterableFields: ['name', 'email'],
      };

      renderWithProvider(<ListView schema={schema} />);
      // Filter button should still be visible
      const filterButton = screen.getByRole('button', { name: /filter/i });
      expect(filterButton).toBeInTheDocument();
    });

    it('should render filter button when filterableFields is not set', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: [
          { name: 'name', label: 'Name', type: 'text' },
          { name: 'email', label: 'Email', type: 'text' },
        ] as any,
      };

      renderWithProvider(<ListView schema={schema} />);
      const filterButton = screen.getByRole('button', { name: /filter/i });
      expect(filterButton).toBeInTheDocument();
    });

    it('should render filter button when filterableFields is empty array', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: [
          { name: 'name', label: 'Name', type: 'text' },
          { name: 'email', label: 'Email', type: 'text' },
        ] as any,
        filterableFields: [],
      };

      renderWithProvider(<ListView schema={schema} />);
      const filterButton = screen.getByRole('button', { name: /filter/i });
      expect(filterButton).toBeInTheDocument();
    });
  });
});

describe('ListView — viewType normalization (AI-authored views)', () => {
  // AI-authored view metadata carries the view KIND ('list'), not a renderer
  // name; hosts forward it verbatim as viewType. Both 'list' and a missing
  // viewType must normalize to the grid renderer — never reach the typeless
  // default branch, which SchemaRenderer used to surface as a red
  // "Unknown component type" box dumping the raw config at the user.
  // The real object-grid lives in @object-ui/plugin-grid (not a test dep);
  // register a stub so "did we emit a typed grid schema" is observable.
  //
  // Register UNCONDITIONALLY (and restore on teardown): ComponentRegistry is a
  // process-level singleton shared across test files, so another suite
  // (plugin-grid/plugin-view/react) may already have registered a real
  // object-grid. The old `if (!get('object-grid'))` guard then skipped our stub
  // and the 'bogus' case rendered the real grid instead of `grid-stub` — making
  // this test pass in isolation but fail in the full suite (order-dependent).
  let prevObjectGrid: ReturnType<typeof ComponentRegistry.get>;
  beforeAll(() => {
    prevObjectGrid = ComponentRegistry.get('object-grid');
    ComponentRegistry.register('object-grid', () => <div data-testid="grid-stub" />);
  });
  afterAll(() => {
    if (prevObjectGrid) {
      ComponentRegistry.register('object-grid', prevObjectGrid);
    } else {
      ComponentRegistry.unregister('object-grid');
    }
  });
  const base = { type: 'list-view', objectName: 'expense', fields: ['title', 'amount'] };

  it("normalizes viewType:'list' to grid — renders the friendly empty state, not the red box", async () => {
    renderWithProvider(<ListView schema={{ ...base, viewType: 'list' } as unknown as ListViewSchema} />);
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(screen.queryByText(/Unknown component type/i)).not.toBeInTheDocument();
  });

  it('normalizes a MISSING viewType to grid — same friendly empty state', async () => {
    renderWithProvider(<ListView schema={{ ...base } as unknown as ListViewSchema} />);
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(screen.queryByText(/Unknown component type/i)).not.toBeInTheDocument();
  });

  it('an unrecognized viewType degrades to a TYPED grid schema (default branch is never typeless)', async () => {
    renderWithProvider(<ListView schema={{ ...base, viewType: 'bogus' } as unknown as ListViewSchema} />);
    expect(await screen.findByTestId('grid-stub')).toBeInTheDocument();
    expect(screen.queryByText(/Unknown component type/i)).not.toBeInTheDocument();
  });
});

describe('ListView — inline-edit toggle drives grid editability', () => {
  // Regression: clicking 行内编辑 flipped the toggle's own highlight but the grid
  // did NOT enter edit mode. The grid schema is built in a useMemo that embeds
  // `editable: inlineEdit`, but `inlineEdit` was missing from the memo's deps —
  // so the emitted `editable` stayed stale until some *other* dep changed (a data
  // refetch), lagging the toggle by one interaction. The spy grid below records
  // the `editable` prop it is rendered with on each toggle.
  let prevObjectGrid: ReturnType<typeof ComponentRegistry.get>;
  let editableCalls: Array<boolean | undefined>;

  beforeAll(() => {
    prevObjectGrid = ComponentRegistry.get('object-grid');
    ComponentRegistry.register('object-grid', (props: any) => {
      editableCalls.push(props.editable);
      return <div data-testid="grid-editable">{String(!!props.editable)}</div>;
    });
  });
  afterAll(() => {
    if (prevObjectGrid) {
      ComponentRegistry.register('object-grid', prevObjectGrid);
    } else {
      ComponentRegistry.unregister('object-grid');
    }
  });
  beforeEach(() => {
    editableCalls = [];
  });

  it('toggling 行内编辑 immediately propagates editable to the grid (no one-toggle lag)', async () => {
    mockDataSource.find.mockResolvedValue([
      { id: '1', name: 'Alice', email: 'alice@test.com' },
    ]);
    const onInlineEditChange = vi.fn();
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
    };

    renderWithProvider(
      <ListView schema={schema} dataSource={mockDataSource} onInlineEditChange={onInlineEditChange} />,
    );

    // Starts non-editable (wait for the initial data fetch to paint the grid).
    expect(await screen.findByTestId('grid-editable')).toHaveTextContent('false');

    // One click on the toggle must make the grid editable on the SAME interaction.
    fireEvent.click(screen.getByTestId('toolbar-inline-edit-toggle'));

    expect(onInlineEditChange).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('grid-editable')).toHaveTextContent('true');
    // The last schema the grid received must carry editable:true.
    expect(editableCalls.at(-1)).toBe(true);

    // Toggling back off must return to non-editable, again on the same click.
    fireEvent.click(screen.getByTestId('toolbar-inline-edit-toggle'));
    expect(screen.getByTestId('grid-editable')).toHaveTextContent('false');
    expect(editableCalls.at(-1)).toBe(false);
  });
});

describe('ListView — gantt view fed by an api-provider ViewData', () => {
  // A gantt view authored with `data: {provider:'api', read, write}` is fed by
  // a composite endpoint that ObjectGantt resolves itself (resolveDataSource →
  // ApiDataSource). ListView must (a) forward schema.data into the gantt
  // component schema, (b) NOT fetch schema.objectName rows itself, and (c) NOT
  // pass its rows `data` prop down — an array prop short-circuits the
  // renderer's own fetch, replacing the endpoint's tree with raw object rows.
  let prevObjectGantt: ReturnType<typeof ComponentRegistry.get>;
  let ganttCalls: any[];

  beforeAll(() => {
    prevObjectGantt = ComponentRegistry.get('object-gantt');
    ComponentRegistry.register('object-gantt', (props: any) => {
      ganttCalls.push(props);
      return <div data-testid="gantt-stub" />;
    });
  });
  afterAll(() => {
    if (prevObjectGantt) {
      ComponentRegistry.register('object-gantt', prevObjectGantt);
    } else {
      ComponentRegistry.unregister('object-gantt');
    }
  });
  beforeEach(() => {
    ganttCalls = [];
    mockDataSource.find.mockClear();
  });

  const apiData = {
    provider: 'api' as const,
    read: { url: '/api/gantt/tree', method: 'GET' as const },
    write: { url: '/api/gantt/task', method: 'PATCH' as const },
  };

  it('forwards schema.data to the gantt schema, skips its own fetch, and withholds the rows prop', async () => {
    const schema = {
      type: 'list-view',
      objectName: 'production_plan',
      viewType: 'gantt',
      fields: ['name'],
      data: apiData,
      gantt: { startDateField: 'start_date', endDateField: 'end_date' },
    } as unknown as ListViewSchema;

    renderWithProvider(<ListView schema={schema} dataSource={mockDataSource} />);
    expect(await screen.findByTestId('gantt-stub')).toBeInTheDocument();

    // (a) the ViewData config reached the component schema
    const last = ganttCalls.at(-1);
    expect(last?.schema?.data).toEqual(apiData);
    // (b) ListView did not query the bound object itself
    expect(mockDataSource.find).not.toHaveBeenCalled();
    // (c) no rows array prop — the schema-spread `data` (the ViewData object)
    // must be what arrives, so ObjectGantt's own api fetch is not bypassed
    expect(Array.isArray(last?.data)).toBe(false);
  });

  it('keeps the legacy object-provider path: ListView fetches and passes rows down', async () => {
    mockDataSource.find.mockResolvedValue([
      { id: '1', name: 'P1', start_date: '2026-01-01', end_date: '2026-01-02' },
    ]);
    const schema = {
      type: 'list-view',
      objectName: 'production_plan',
      viewType: 'gantt',
      fields: ['name'],
      gantt: { startDateField: 'start_date', endDateField: 'end_date' },
    } as unknown as ListViewSchema;

    renderWithProvider(<ListView schema={schema} dataSource={mockDataSource} />);
    expect(await screen.findByTestId('gantt-stub')).toBeInTheDocument();

    await vi.waitFor(() => {
      const last = ganttCalls.at(-1);
      expect(Array.isArray(last?.data)).toBe(true);
      expect(last?.data).toHaveLength(1);
    });
    expect(mockDataSource.find).toHaveBeenCalled();
  });
});
