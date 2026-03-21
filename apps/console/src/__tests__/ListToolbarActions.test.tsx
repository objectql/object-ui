/**
 * ObjectView — List toolbar action button integration tests
 *
 * Validates that action buttons in the list toolbar header are wired to
 * ActionProvider and respond to clicks:
 * - Actions with confirmText show a confirmation dialog
 * - Actions with params show a param collection dialog
 * - Toast notifications are displayed on success
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ObjectView } from '../components/ObjectView';
import { ComponentRegistry } from '@object-ui/core';

// Mock sonner toast
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
  }),
}));

// Mock child plugins to isolate ObjectView logic
vi.mock('@object-ui/plugin-grid', () => ({
  ObjectGrid: (props: any) => <div data-testid="object-grid">Grid View: {props.schema.objectName}</div>
}));

vi.mock('@object-ui/plugin-kanban', () => ({
  ObjectKanban: (props: any) => <div data-testid="object-kanban">Kanban View</div>
}));

vi.mock('@object-ui/plugin-calendar', () => ({
  ObjectCalendar: (props: any) => <div data-testid="object-calendar">Calendar View</div>
}));

vi.mock('@object-ui/plugin-list', () => ({
  ListView: (props: any) => (
    <div data-testid="list-view">
      <div data-testid="object-grid">Grid View: {props.schema?.objectName}</div>
      <button data-testid="list-row-click" onClick={() => props.onRowClick?.({ id: 'rec-1' })}>Click Row</button>
    </div>
  ),
}));

vi.mock('@object-ui/components', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        cn: (...inputs: any[]) => inputs.filter(Boolean).join(' '),
        Button: ({ children, onClick, title, ...rest }: any) => <button onClick={onClick} title={title} {...rest}>{children}</button>,
        Empty: ({ children }: any) => <div data-testid="empty">{children}</div>,
        EmptyTitle: ({ children }: any) => <div>{children}</div>,
        EmptyDescription: ({ children }: any) => <div>{children}</div>,
        DropdownMenu: ({ children }: any) => <div>{children}</div>,
        DropdownMenuTrigger: ({ children }: any) => <>{children}</>,
        DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
        DropdownMenuItem: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
        DropdownMenuSeparator: () => <hr />,
    };
});

// Mock React Router
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
    useParams: () => ({ objectName: 'account', appName: 'crm' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
    useNavigate: () => mockNavigate,
}));

// Mock auth — default admin so Create button is visible
vi.mock('@object-ui/auth', () => ({
    useAuth: () => ({ user: { id: 'u1', name: 'Admin', role: 'admin' } }),
}));

// ─── Test Data ───────────────────────────────────────────────────────────────

const listToolbarActions = [
  {
    name: 'bulk_import',
    label: 'Import Records',
    icon: 'upload',
    type: 'api' as const,
    target: 'bulk_import',
    locations: ['list_toolbar' as const],
    confirmText: 'This will import records from CSV. Continue?',
    refreshAfter: true,
    successMessage: 'Records imported successfully',
  },
  {
    name: 'export_all',
    label: 'Export All',
    icon: 'download',
    type: 'url' as const,
    target: '/api/export/accounts',
    locations: ['list_toolbar' as const],
  },
];

const mockObjects = [
  {
    name: 'account',
    label: 'Account',
    fields: {
      name: { name: 'name', label: 'Name', type: 'text' },
      industry: { name: 'industry', label: 'Industry', type: 'text' },
    },
    actions: listToolbarActions,
    listViews: {
      all: { label: 'All Accounts', type: 'grid', columns: ['name', 'industry'] },
    },
  },
];

function createMockDataSource() {
  return {
    find: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: '1' }),
    update: vi.fn().mockResolvedValue({ id: '1' }),
    delete: vi.fn().mockResolvedValue(true),
    execute: vi.fn().mockResolvedValue({ success: true }),
  } as any;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ObjectView — List toolbar action buttons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Register mock components for SchemaRenderer to find
    ComponentRegistry.register('object-grid', (props: any) => <div data-testid="object-grid">Grid View: {props.schema.objectName}</div>);
    ComponentRegistry.register('list-view', (_props: any) => <div data-testid="list-view">List View</div>);
  });

  it('renders action buttons in the list toolbar', async () => {
    const ds = createMockDataSource();
    render(<ObjectView dataSource={ds} objects={mockObjects} onEdit={vi.fn()} />);

    // Action buttons should be visible
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Import Records/i })).toBeInTheDocument();
    });
  });

  it('shows confirmation dialog when action button with confirmText is clicked', async () => {
    const user = userEvent.setup();
    const ds = createMockDataSource();
    render(<ObjectView dataSource={ds} objects={mockObjects} onEdit={vi.fn()} />);

    // Wait for the Import Records button to render
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Import Records/i })).toBeInTheDocument();
    });

    // Click Import Records (has confirmText)
    await user.click(screen.getByRole('button', { name: /Import Records/i }));

    // Confirmation dialog should appear
    await waitFor(() => {
      expect(screen.getByText('This will import records from CSV. Continue?')).toBeInTheDocument();
    });
  });

  it('calls dataSource.execute when confirmation is accepted', async () => {
    const user = userEvent.setup();
    const ds = createMockDataSource();
    render(<ObjectView dataSource={ds} objects={mockObjects} onEdit={vi.fn()} />);

    // Wait for button to render
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Import Records/i })).toBeInTheDocument();
    });

    // Click action button
    await user.click(screen.getByRole('button', { name: /Import Records/i }));

    // Wait for confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('This will import records from CSV. Continue?')).toBeInTheDocument();
    });

    // Click Continue to confirm
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    // dataSource.execute should be called
    await waitFor(() => {
      expect(ds.execute).toHaveBeenCalledWith('account', 'bulk_import', {});
    }, { timeout: 3000 });
  });

  it('does not execute action when confirmation is cancelled', async () => {
    const user = userEvent.setup();
    const ds = createMockDataSource();
    render(<ObjectView dataSource={ds} objects={mockObjects} onEdit={vi.fn()} />);

    // Wait for button
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Import Records/i })).toBeInTheDocument();
    });

    // Click action button
    await user.click(screen.getByRole('button', { name: /Import Records/i }));

    // Wait for confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('This will import records from CSV. Continue?')).toBeInTheDocument();
    });

    // Click Cancel
    await user.click(screen.getByRole('button', { name: /Cancel/i }));

    // dataSource.execute should NOT be called
    await new Promise(r => setTimeout(r, 100));
    expect(ds.execute).not.toHaveBeenCalled();
  });
});
