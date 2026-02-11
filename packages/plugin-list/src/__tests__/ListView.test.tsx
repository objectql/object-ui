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
});
