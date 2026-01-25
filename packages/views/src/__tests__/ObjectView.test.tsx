/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ObjectView } from '../ObjectView';
import type { ObjectViewSchema, DataSource } from '@object-ui/types';

// Mock child components
vi.mock('../ObjectGrid', () => ({
  ObjectGrid: ({ schema, onRowClick, onEdit, onDelete }: any) => (
    <div data-testid="object-grid">
      <div data-testid="table-object-name">{schema.objectName}</div>
      <button onClick={() => onRowClick?.({ _id: '1', name: 'Test' })} data-testid="row-click-btn">
        Click Row
      </button>
      <button onClick={() => onEdit?.({ _id: '1', name: 'Test' })} data-testid="edit-btn">
        Edit
      </button>
      <button onClick={() => onDelete?.({ _id: '1', name: 'Test' })} data-testid="delete-btn">
        Delete
      </button>
    </div>
  ),
}));

vi.mock('../ObjectForm', () => ({
  ObjectForm: ({ schema }: any) => (
    <div data-testid="object-form">
      <div data-testid="form-mode">{schema.mode}</div>
      <div data-testid="form-object-name">{schema.objectName}</div>
      <button onClick={() => schema.onSuccess?.()} data-testid="form-submit">
        Submit
      </button>
      <button onClick={() => schema.onCancel?.()} data-testid="form-cancel">
        Cancel
      </button>
    </div>
  ),
}));

// Mock UI components
vi.mock('@object-ui/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: any) => (
    <div data-testid="dialog" data-open={open}>
      {open && children}
      <button onClick={() => onOpenChange(false)} data-testid="dialog-close">Close Dialog</button>
    </div>
  ),
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <div data-testid="dialog-title">{children}</div>,
  DialogDescription: ({ children }: any) => <div data-testid="dialog-description">{children}</div>,
}));

vi.mock('@object-ui/components/ui/drawer', () => ({
  Drawer: ({ children, open, onOpenChange }: any) => (
    <div data-testid="drawer" data-open={open}>
      {open && children}
      <button onClick={() => onOpenChange(false)} data-testid="drawer-close">Close Drawer</button>
    </div>
  ),
  DrawerContent: ({ children }: any) => <div data-testid="drawer-content">{children}</div>,
  DrawerHeader: ({ children }: any) => <div data-testid="drawer-header">{children}</div>,
  DrawerTitle: ({ children }: any) => <div data-testid="drawer-title">{children}</div>,
  DrawerDescription: ({ children }: any) => <div data-testid="drawer-description">{children}</div>,
  DrawerClose: ({ children }: any) => <div data-testid="drawer-close-component">{children}</div>,
}));

vi.mock('@object-ui/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@object-ui/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

describe('ObjectView', () => {
  let mockDataSource: DataSource;
  let mockSchema: ObjectViewSchema;

  beforeEach(() => {
    // Mock data source
    mockDataSource = {
      find: vi.fn().mockResolvedValue({
        data: [
          { _id: '1', name: 'John Doe', email: 'john@example.com' },
          { _id: '2', name: 'Jane Smith', email: 'jane@example.com' },
        ],
        total: 2,
      }),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      bulk: vi.fn(),
      getObjectSchema: vi.fn().mockResolvedValue({
        name: 'users',
        label: 'Users',
        fields: {
          name: {
            type: 'text',
            label: 'Name',
            required: true,
          },
          email: {
            type: 'email',
            label: 'Email',
            required: true,
          },
        },
      }),
    } as any;

    // Mock schema
    mockSchema = {
      type: 'object-view',
      objectName: 'users',
      title: 'User Management',
      description: 'Manage users in your system',
    };
  });

  it('renders the component with title and description', async () => {
    render(<ObjectView schema={mockSchema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByText('User Management')).toBeInTheDocument();
      expect(screen.getByText('Manage users in your system')).toBeInTheDocument();
    });
  });

  it('renders the object table', async () => {
    render(<ObjectView schema={mockSchema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByTestId('object-grid')).toBeInTheDocument();
      expect(screen.getByTestId('table-object-name')).toHaveTextContent('users');
    });
  });

  it('shows search box by default', async () => {
    render(<ObjectView schema={mockSchema} dataSource={mockDataSource} />);

    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(/Search/i);
      expect(searchInput).toBeInTheDocument();
    });
  });

  it('shows create button by default', async () => {
    render(<ObjectView schema={mockSchema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByText('Create')).toBeInTheDocument();
    });
  });

  it('hides search box when showSearch is false', async () => {
    const schema = { ...mockSchema, showSearch: false };
    render(<ObjectView schema={schema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/Search/i)).not.toBeInTheDocument();
    });
  });

  it('hides create button when showCreate is false', async () => {
    const schema = { ...mockSchema, showCreate: false };
    render(<ObjectView schema={schema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.queryByText('Create')).not.toBeInTheDocument();
    });
  });

  it('opens drawer when create button is clicked (default layout)', async () => {
    const user = userEvent.setup();
    render(<ObjectView schema={mockSchema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByText('Create')).toBeInTheDocument();
    });

    const createButton = screen.getByText('Create');
    await user.click(createButton);

    await waitFor(() => {
      const drawer = screen.getByTestId('drawer');
      expect(drawer).toHaveAttribute('data-open', 'true');
      expect(screen.getByTestId('form-mode')).toHaveTextContent('create');
    });
  });

  it('opens modal when create button is clicked (modal layout)', async () => {
    const user = userEvent.setup();
    const schema = { ...mockSchema, layout: 'modal' as const };
    render(<ObjectView schema={schema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByText('Create')).toBeInTheDocument();
    });

    const createButton = screen.getByText('Create');
    await user.click(createButton);

    await waitFor(() => {
      const dialog = screen.getByTestId('dialog');
      expect(dialog).toHaveAttribute('data-open', 'true');
      expect(screen.getByTestId('form-mode')).toHaveTextContent('create');
    });
  });

  it('opens drawer when edit button is clicked', async () => {
    const user = userEvent.setup();
    render(<ObjectView schema={mockSchema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByTestId('object-grid')).toBeInTheDocument();
    });

    const editButton = screen.getByTestId('edit-btn');
    await user.click(editButton);

    await waitFor(() => {
      const drawer = screen.getByTestId('drawer');
      expect(drawer).toHaveAttribute('data-open', 'true');
      expect(screen.getByTestId('form-mode')).toHaveTextContent('edit');
    });
  });

  it('opens drawer when row is clicked', async () => {
    const user = userEvent.setup();
    render(<ObjectView schema={mockSchema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByTestId('object-grid')).toBeInTheDocument();
    });

    const rowButton = screen.getByTestId('row-click-btn');
    await user.click(rowButton);

    await waitFor(() => {
      const drawer = screen.getByTestId('drawer');
      expect(drawer).toHaveAttribute('data-open', 'true');
      expect(screen.getByTestId('form-mode')).toHaveTextContent('view');
    });
  });

  it('closes form when form submit is successful', async () => {
    const user = userEvent.setup();
    render(<ObjectView schema={mockSchema} dataSource={mockDataSource} />);

    // Open create form
    await waitFor(() => {
      expect(screen.getByText('Create')).toBeInTheDocument();
    });
    const createButton = screen.getByText('Create');
    await user.click(createButton);

    // Wait for form to open
    await waitFor(() => {
      expect(screen.getByTestId('drawer')).toHaveAttribute('data-open', 'true');
    });

    // Submit form
    const submitButton = screen.getByTestId('form-submit');
    await user.click(submitButton);

    // Wait for drawer to close
    await waitFor(() => {
      expect(screen.getByTestId('drawer')).toHaveAttribute('data-open', 'false');
    });
  });

  it('closes form when form cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<ObjectView schema={mockSchema} dataSource={mockDataSource} />);

    // Open create form
    await waitFor(() => {
      expect(screen.getByText('Create')).toBeInTheDocument();
    });
    const createButton = screen.getByText('Create');
    await user.click(createButton);

    // Wait for form to open
    await waitFor(() => {
      expect(screen.getByTestId('drawer')).toHaveAttribute('data-open', 'true');
    });

    // Cancel form
    const cancelButton = screen.getByTestId('form-cancel');
    await user.click(cancelButton);

    // Wait for drawer to close
    await waitFor(() => {
      expect(screen.getByTestId('drawer')).toHaveAttribute('data-open', 'false');
    });
  });

  it('calls onNavigate for page layout mode', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const schema = {
      ...mockSchema,
      layout: 'page' as const,
      onNavigate,
    };
    render(<ObjectView schema={schema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByText('Create')).toBeInTheDocument();
    });

    const createButton = screen.getByText('Create');
    await user.click(createButton);

    expect(onNavigate).toHaveBeenCalledWith('new', 'edit');
  });

  it('toggles filter panel when filter button is clicked', async () => {
    const user = userEvent.setup();
    render(<ObjectView schema={mockSchema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    // Filter panel should not be visible initially
    expect(screen.queryByText(/Filter functionality will be integrated/)).not.toBeInTheDocument();

    // Click filters button
    const filtersButton = screen.getByText('Filters');
    await user.click(filtersButton);

    // Filter panel should now be visible
    await waitFor(() => {
      expect(screen.getByText(/Filter functionality will be integrated/)).toBeInTheDocument();
    });

    // Click filters button again
    await user.click(filtersButton);

    // Filter panel should be hidden
    await waitFor(() => {
      expect(screen.queryByText(/Filter functionality will be integrated/)).not.toBeInTheDocument();
    });
  });
});
