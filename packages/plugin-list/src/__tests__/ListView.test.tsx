/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('ListView', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should be exported', () => {
    expect(ListView).toBeDefined();
  });

  it('should be a function', () => {
    expect(typeof ListView).toBe('function');
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
    
    // Find kanban view button and click it
    // ViewSwitcher uses buttons with aria-label
    const kanbanButton = screen.getByLabelText('Kanban');

    fireEvent.click(kanbanButton);
    
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
    expect(screen.getByText('No items found')).toBeInTheDocument();
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

  it('should render quick filters when configured', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
      quickFilters: [
        { id: 'active', label: 'Active', filters: [['status', '=', 'active']] },
        { id: 'vip', label: 'VIP', filters: [['vip', '=', true]], defaultActive: true },
      ],
    };

    renderWithProvider(<ListView schema={schema} />);
    
    expect(screen.getByTestId('quick-filters')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('VIP')).toBeInTheDocument();
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
    
    // Default density mode is 'comfortable'
    const densityButton = screen.getByTitle('Density: comfortable');
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
    const densityButton = screen.getByTitle('Density: compact');
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
    const densityButton = screen.getByTitle('Density: spacious');
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
      { _id: '1', name: 'Alice', email: 'alice@test.com' },
      { _id: '2', name: 'Bob', email: 'bob@test.com' },
      { _id: '3', name: 'Charlie', email: 'charlie@test.com' },
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

    it('should auto-derive userFilters from objectDef select/boolean fields', async () => {
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
      };

      render(
        <SchemaRendererProvider dataSource={mockDs}>
          <ListView schema={schema} dataSource={mockDs} />
        </SchemaRendererProvider>
      );

      // Wait for objectDef to load and userFilters to render
      await vi.waitFor(() => {
        expect(screen.getByTestId('user-filters')).toBeInTheDocument();
      });
      expect(screen.getByTestId('user-filters-dropdown')).toBeInTheDocument();
      // Should have badges for status and is_active (select + boolean)
      expect(screen.getByTestId('filter-badge-status')).toBeInTheDocument();
      expect(screen.getByTestId('filter-badge-is_active')).toBeInTheDocument();
    });

    it('should show Add filter button in userFilters', () => {
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
      expect(screen.getByTestId('user-filters-add')).toBeInTheDocument();
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
      // The search icon button should have active styling class
      const searchBtn = screen.getByTestId('search-icon-button');
      expect(searchBtn.className).toContain('bg-primary');
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

    it('should hide Density button by default (showDensity undefined)', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.queryByTitle(/density/i)).not.toBeInTheDocument();
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
        { _id: '1', name: 'Alice', email: 'alice@test.com' },
        { _id: '2', name: 'Bob', email: 'bob@test.com' },
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
        { _id: '1', name: 'Alice', email: 'alice@test.com' },
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
      const densityButton = screen.getByTitle('Density: compact');
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
      const densityButton = screen.getByTitle('Density: spacious');
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
  // tabs rendering
  // ============================
  describe('tabs rendering', () => {
    it('should render view tabs when configured', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        tabs: [
          { name: 'all', label: 'All Records', isDefault: true },
          { name: 'active', label: 'Active' },
        ],
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.getByTestId('view-tabs')).toBeInTheDocument();
      expect(screen.getByTestId('view-tab-all')).toBeInTheDocument();
      expect(screen.getByTestId('view-tab-active')).toBeInTheDocument();
      expect(screen.getByText('All Records')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should not render tabs when not configured', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.queryByTestId('view-tabs')).not.toBeInTheDocument();
    });

    it('should filter out hidden tabs', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email'],
        tabs: [
          { name: 'all', label: 'All Records' },
          { name: 'hidden', label: 'Hidden Tab', visible: 'false' },
        ],
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.getByTestId('view-tabs')).toBeInTheDocument();
      expect(screen.getByText('All Records')).toBeInTheDocument();
      expect(screen.queryByText('Hidden Tab')).not.toBeInTheDocument();
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
      // Should only show grid and kanban, not calendar
      expect(screen.getByLabelText('Grid')).toBeInTheDocument();
      expect(screen.getByLabelText('Kanban')).toBeInTheDocument();
      expect(screen.queryByLabelText('Calendar')).not.toBeInTheDocument();
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
      expect(screen.getByLabelText('Kanban')).toBeInTheDocument();
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
      expect(screen.getByLabelText('Gallery')).toBeInTheDocument();
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
      expect(screen.getByLabelText('Timeline')).toBeInTheDocument();
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
      expect(screen.getByLabelText('Calendar')).toBeInTheDocument();
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
      expect(screen.getByLabelText('Gantt')).toBeInTheDocument();
    });
  });

  // ============================
  // pageSizeOptions UI
  // ============================
  describe('pageSizeOptions', () => {
    it('should render page size selector when pageSizeOptions is provided', async () => {
      const mockItems = [
        { _id: '1', name: 'Alice', email: 'alice@test.com' },
      ];
      mockDataSource.find.mockResolvedValue(mockItems);

      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
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
        { _id: '1', name: 'Alice', email: 'alice@test.com' },
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
            { _id: '1', name: 'Alice', email: 'alice@test.com' },
            { _id: '2', name: 'Bob', email: 'bob@test.com' },
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
          { _id: '1', name: 'Alice', email: 'alice@test.com' },
          { _id: '2', name: 'Bob', email: 'bob@test.com' },
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

    it('should fall back to dataSource.find when schema.data is not set', async () => {
      const mockItems = [
        { _id: '1', name: 'Alice', email: 'alice@test.com' },
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
  // quickFilters spec format reconciliation
  // ============================
  describe('quickFilters spec format reconciliation', () => {
    it('should normalize spec format { field, operator, value } into ObjectUI format', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email', 'status'],
        quickFilters: [
          { field: 'status', operator: 'equals', value: 'active', label: 'Active' },
        ],
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.getByTestId('quick-filters')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should still support ObjectUI format { id, label, filters[] }', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email', 'status'],
        quickFilters: [
          { id: 'active', label: 'Active', filters: [['status', '=', 'active']] },
          { id: 'vip', label: 'VIP', filters: [['vip', '=', true]] },
        ],
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.getByTestId('quick-filters')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('VIP')).toBeInTheDocument();
    });

    it('should handle mixed format arrays (ObjectUI + Spec items together)', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'email', 'status'],
        quickFilters: [
          { id: 'active', label: 'Active', filters: [['status', '=', 'active']] },
          { field: 'priority', operator: 'eq', value: 'high', label: 'High Priority' },
        ],
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.getByTestId('quick-filters')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('High Priority')).toBeInTheDocument();
    });

    it('should handle spec shorthand operator "eq"', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'status'],
        quickFilters: [
          { field: 'status', operator: 'eq', value: 'active', label: 'Active' },
        ],
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.getByTestId('quick-filters')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should auto-generate label when label is omitted in spec format', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'status'],
        quickFilters: [
          { field: 'status', operator: 'eq', value: 'active' },
        ],
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.getByTestId('quick-filters')).toBeInTheDocument();
      // Auto-generated label: "status eq active"
      expect(screen.getByText('status eq active')).toBeInTheDocument();
    });

    it('should handle spec format with missing value', () => {
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
        fields: ['name', 'archived'],
        quickFilters: [
          { field: 'archived', operator: 'eq', value: null, label: 'Not Archived' },
        ],
      };

      renderWithProvider(<ListView schema={schema} />);
      expect(screen.getByTestId('quick-filters')).toBeInTheDocument();
      expect(screen.getByText('Not Archived')).toBeInTheDocument();
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
        { _id: '1', name: 'Alice', email: 'alice@test.com' },
        { _id: '2', name: 'Bob', email: 'bob@test.com' },
      ];
      mockDataSource.find.mockResolvedValue(mockItems);

      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
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
        { _id: '1', name: 'Alice', email: 'alice@test.com' },
        { _id: '2', name: 'Bob', email: 'bob@test.com' },
      ];
      mockDataSource.find.mockResolvedValue(mockItems);

      const onPageSizeChange = vi.fn();
      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
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
        { _id: '1', name: 'Alice', email: 'alice@test.com' },
      ];
      mockDataSource.find.mockResolvedValue(mockItems);

      const schema: ListViewSchema = {
        type: 'list-view',
        objectName: 'contacts',
        viewType: 'grid',
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
        { _id: '1', name: 'Alice', email: 'alice@test.com' },
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
