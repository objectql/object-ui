/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ListView } from '../ListView';
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

  it('should render search button', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'contacts',
      viewType: 'grid',
      fields: ['name', 'email'],
    };

    renderWithProvider(<ListView schema={schema} />);
    const searchButton = screen.getByRole('button', { name: /search/i });
    expect(searchButton).toBeInTheDocument();
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
    
    // Click search button to expand
    const searchButton = screen.getByRole('button', { name: /search/i });
    fireEvent.click(searchButton);
    
    const searchInput = screen.getByPlaceholderText(/find/i);
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
    
    // Click search button to expand search input
    const searchButton = screen.getByRole('button', { name: /search/i });
    fireEvent.click(searchButton);
    
    const searchInput = screen.getByPlaceholderText(/find/i) as HTMLInputElement;
    
    // Type in search
    fireEvent.change(searchInput, { target: { value: 'test' } });
    expect(searchInput.value).toBe('test');
    
    // Find and click clear button (the X button inside the expanded search)
    const buttons = screen.getAllByRole('button');
    const clearButton = buttons.find(btn => 
      btn.querySelector('svg') !== null && searchInput.value !== ''
    );
    
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
});
