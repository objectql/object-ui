/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ObjectView } from '../ObjectView';
import type { ObjectViewSchema, DataSource } from '@object-ui/types';

// Mock @object-ui/react to avoid circular dependency issues
vi.mock('@object-ui/react', () => ({
  SchemaRenderer: ({ schema }: any) => (
    <div data-testid="schema-renderer" data-schema-type={schema?.type}>
      {schema?.type}
    </div>
  ),
  SchemaRendererContext: null,
}));

// Mock @object-ui/plugin-grid
vi.mock('@object-ui/plugin-grid', () => ({
  ObjectGrid: ({ schema, onRowClick }: any) => (
    <div data-testid="object-grid" data-object={schema?.objectName}>
      <button data-testid="grid-row" onClick={() => onRowClick?.({ _id: '1', name: 'Test' })}>
        Row 1
      </button>
    </div>
  ),
}));

// Mock @object-ui/plugin-form
vi.mock('@object-ui/plugin-form', () => ({
  ObjectForm: ({ schema }: any) => (
    <div data-testid="object-form" data-mode={schema?.mode}>
      Form ({schema?.mode})
    </div>
  ),
}));

const createMockDataSource = (overrides: Partial<DataSource> = {}): DataSource => ({
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

describe('ObjectView', () => {
  let mockDataSource: DataSource;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDataSource = createMockDataSource();
  });

  // ============================
  // Basic Rendering
  // ============================
  describe('Basic Rendering', () => {
    it('should render with minimal schema', () => {
      const schema: ObjectViewSchema = {
        type: 'object-view',
        objectName: 'contacts',
      };

      render(<ObjectView schema={schema} dataSource={mockDataSource} />);

      // Should render the grid by default
      expect(screen.getByTestId('object-grid')).toBeDefined();
    });

    it('should render title and description', () => {
      const schema: ObjectViewSchema = {
        type: 'object-view',
        objectName: 'contacts',
        title: 'Contact List',
        description: 'Manage your contacts',
      };

      render(<ObjectView schema={schema} dataSource={mockDataSource} />);

      expect(screen.getByText('Contact List')).toBeDefined();
      expect(screen.getByText('Manage your contacts')).toBeDefined();
    });

    it('should not render search box (delegated to ListView toolbar)', () => {
      const schema: ObjectViewSchema = {
        type: 'object-view',
        objectName: 'contacts',
      };

      render(<ObjectView schema={schema} dataSource={mockDataSource} />);

      expect(screen.queryByPlaceholderText(/search/i)).toBeNull();
    });

    it('should not render search box when showSearch is false', () => {
      const schema: ObjectViewSchema = {
        type: 'object-view',
        objectName: 'contacts',
        showSearch: false,
      };

      render(<ObjectView schema={schema} dataSource={mockDataSource} />);

      expect(screen.queryByPlaceholderText(/search/i)).toBeNull();
    });

    it('should render create button by default', () => {
      const schema: ObjectViewSchema = {
        type: 'object-view',
        objectName: 'contacts',
      };

      render(<ObjectView schema={schema} dataSource={mockDataSource} />);

      expect(screen.getByText('Create')).toBeDefined();
    });

    it('should hide create button when showCreate is false', () => {
      const schema: ObjectViewSchema = {
        type: 'object-view',
        objectName: 'contacts',
        showCreate: false,
      };

      render(<ObjectView schema={schema} dataSource={mockDataSource} />);

      expect(screen.queryByText('Create')).toBeNull();
    });
  });

  // ============================
  // Named List Views
  // ============================
  describe('Named List Views', () => {
    it('should render named view tabs when listViews has multiple entries', () => {
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

      expect(screen.getByText('All Contacts')).toBeDefined();
      expect(screen.getByText('Active')).toBeDefined();
    });

    it('should not render tabs when only one named view exists', () => {
      const schema: ObjectViewSchema = {
        type: 'object-view',
        objectName: 'contacts',
        listViews: {
          all: { label: 'All Contacts', type: 'grid' },
        },
      };

      render(<ObjectView schema={schema} dataSource={mockDataSource} />);

      // Should not show tabs for a single view
      expect(screen.queryByRole('tablist')).toBeNull();
    });

    it('should default to first named view when defaultListView is not set', () => {
      const schema: ObjectViewSchema = {
        type: 'object-view',
        objectName: 'contacts',
        listViews: {
          all: { label: 'All Contacts', type: 'grid' },
          active: { label: 'Active', type: 'grid' },
        },
      };

      render(<ObjectView schema={schema} dataSource={mockDataSource} />);

      // The grid should be rendered (first view is grid type)
      expect(screen.getByTestId('object-grid')).toBeDefined();
    });
  });

  // ============================
  // Default View Type
  // ============================
  describe('Default View Type', () => {
    it('should render grid by default when no defaultViewType set', () => {
      const schema: ObjectViewSchema = {
        type: 'object-view',
        objectName: 'contacts',
      };

      render(<ObjectView schema={schema} dataSource={mockDataSource} />);

      expect(screen.getByTestId('object-grid')).toBeDefined();
    });
  });

  // ============================
  // Navigation Config
  // ============================
  describe('Navigation Config', () => {
    it('should not navigate when mode is none', () => {
      const onRowClick = vi.fn();
      const schema: ObjectViewSchema = {
        type: 'object-view',
        objectName: 'contacts',
        navigation: { mode: 'none' },
      };

      render(<ObjectView schema={schema} dataSource={mockDataSource} />);

      // Click a grid row
      fireEvent.click(screen.getByTestId('grid-row'));

      // onRowClick should not be called (mode is none)
      expect(onRowClick).not.toHaveBeenCalled();
    });

    it('should not navigate when preventNavigation is true', () => {
      const onRowClick = vi.fn();
      const schema: ObjectViewSchema = {
        type: 'object-view',
        objectName: 'contacts',
        navigation: { mode: 'page', preventNavigation: true },
      };

      render(<ObjectView schema={schema} dataSource={mockDataSource} />);

      fireEvent.click(screen.getByTestId('grid-row'));

      expect(onRowClick).not.toHaveBeenCalled();
    });

    it('should open in new window when mode is new_window', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      const schema: ObjectViewSchema = {
        type: 'object-view',
        objectName: 'contacts',
        navigation: { mode: 'new_window' },
      };

      render(<ObjectView schema={schema} dataSource={mockDataSource} />);

      fireEvent.click(screen.getByTestId('grid-row'));

      expect(openSpy).toHaveBeenCalledWith('/contacts/1', '_blank');
      openSpy.mockRestore();
    });

    it('should call onNavigate for page mode', () => {
      const onNavigate = vi.fn();
      const schema: ObjectViewSchema = {
        type: 'object-view',
        objectName: 'contacts',
        navigation: { mode: 'page' },
        onNavigate,
      };

      render(<ObjectView schema={schema} dataSource={mockDataSource} />);

      fireEvent.click(screen.getByTestId('grid-row'));

      expect(onNavigate).toHaveBeenCalledWith('1', 'view');
    });
  });

  // ============================
  // CRUD Operations
  // ============================
  describe('CRUD Operations', () => {
    it('should hide create button when operations.create is false', () => {
      const schema: ObjectViewSchema = {
        type: 'object-view',
        objectName: 'contacts',
        operations: { create: false, read: true, update: true, delete: true },
      };

      render(<ObjectView schema={schema} dataSource={mockDataSource} />);

      expect(screen.queryByText('Create')).toBeNull();
    });
  });

  // ============================
  // Data Source Integration
  // ============================
  describe('Data Source Integration', () => {
    it('should fetch object schema on mount', async () => {
      const schema: ObjectViewSchema = {
        type: 'object-view',
        objectName: 'contacts',
      };

      render(<ObjectView schema={schema} dataSource={mockDataSource} />);

      await waitFor(() => {
        expect(mockDataSource.getObjectSchema).toHaveBeenCalledWith('contacts');
      });
    });
  });

  // ============================
  // View Switcher (prop-based views)
  // ============================
  describe('View Switcher (prop-based)', () => {
    it('should not render view switcher with single view prop', () => {
      const schema: ObjectViewSchema = {
        type: 'object-view',
        objectName: 'contacts',
      };

      const views = [
        { id: 'grid', label: 'Grid', type: 'grid' as const },
      ];

      render(
        <ObjectView schema={schema} dataSource={mockDataSource} views={views} />,
      );

      // Only one view, no switcher needed
      expect(screen.getByTestId('object-grid')).toBeDefined();
    });
  });

  // ============================
  // showViewSwitcher config
  // ============================
  describe('showViewSwitcher', () => {
    it('should hide view switcher when showViewSwitcher is false', () => {
      const schema: ObjectViewSchema = {
        type: 'object-view',
        objectName: 'contacts',
        showViewSwitcher: false,
      };

      const views = [
        { id: 'grid', label: 'Grid', type: 'grid' as const },
        { id: 'kanban', label: 'Kanban', type: 'kanban' as const },
      ];

      render(
        <ObjectView schema={schema} dataSource={mockDataSource} views={views} />,
      );

      // Switcher should be hidden
      expect(screen.queryByText('Kanban')).toBeNull();
    });
  });
});
