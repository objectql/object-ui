/**
 * System Admin Pages Integration Tests
 *
 * Tests that system pages (User, Org, Role, AuditLog) fetch data
 * via useAdapter() and render records from the API.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

// --- Shared mock adapter ---
const mockFind = vi.fn().mockResolvedValue({ data: [], total: 0 });
const mockCreate = vi.fn().mockResolvedValue({ id: 'new-1' });
const mockDelete = vi.fn().mockResolvedValue({});

vi.mock('../context/AdapterProvider', () => ({
  useAdapter: () => ({
    find: mockFind,
    create: mockCreate,
    delete: mockDelete,
    update: vi.fn(),
    findOne: vi.fn(),
  }),
}));

vi.mock('@object-ui/auth', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Admin', role: 'admin' } }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ appName: 'test-app' }),
  };
});

const mockRefresh = vi.fn().mockResolvedValue(undefined);
vi.mock('../context/MetadataProvider', () => ({
  useMetadata: () => ({
    apps: [
      { name: 'crm', label: 'CRM', description: 'Customer management', active: true, isDefault: true },
      { name: 'hr', label: 'HR', description: 'Human resources', active: false, isDefault: false },
    ],
    objects: [],
    dashboards: [],
    reports: [],
    pages: [],
    loading: false,
    error: null,
    refresh: mockRefresh,
  }),
}));

// Import after mocks
import { UserManagementPage } from '../pages/system/UserManagementPage';
import { OrgManagementPage } from '../pages/system/OrgManagementPage';
import { RoleManagementPage } from '../pages/system/RoleManagementPage';
import { AuditLogPage } from '../pages/system/AuditLogPage';
import { SystemHubPage } from '../pages/system/SystemHubPage';
import { AppManagementPage } from '../pages/system/AppManagementPage';
import { PermissionManagementPage } from '../pages/system/PermissionManagementPage';

function wrap(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UserManagementPage', () => {
  it('should call dataSource.find("sys_user") on mount', async () => {
    mockFind.mockResolvedValueOnce({
      data: [{ id: '1', name: 'Alice', email: 'alice@test.com', role: 'admin', status: 'active', lastLoginAt: '' }],
    });
    wrap(<UserManagementPage />);
    await waitFor(() => {
      expect(mockFind).toHaveBeenCalledWith('sys_user');
    });
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('should show empty state when no users', async () => {
    mockFind.mockResolvedValueOnce({ data: [] });
    wrap(<UserManagementPage />);
    await waitFor(() => {
      expect(screen.getByText('No users found.')).toBeInTheDocument();
    });
  });

  it('should call create when Add User is clicked', async () => {
    mockFind.mockResolvedValue({ data: [] });
    mockCreate.mockResolvedValueOnce({ id: 'new-user' });
    wrap(<UserManagementPage />);
    await waitFor(() => {
      expect(screen.getByText('No users found.')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Add User'));
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith('sys_user', expect.objectContaining({ name: 'New User' }));
    });
  });
});

describe('OrgManagementPage', () => {
  it('should call dataSource.find("sys_org") on mount', async () => {
    mockFind.mockResolvedValueOnce({
      data: [{ id: '1', name: 'Acme', slug: 'acme', plan: 'pro', status: 'active', memberCount: 5 }],
    });
    wrap(<OrgManagementPage />);
    await waitFor(() => {
      expect(mockFind).toHaveBeenCalledWith('sys_org');
    });
    expect(screen.getByText('Acme')).toBeInTheDocument();
  });

  it('should show empty state when no organizations', async () => {
    mockFind.mockResolvedValueOnce({ data: [] });
    wrap(<OrgManagementPage />);
    await waitFor(() => {
      expect(screen.getByText('No organizations found.')).toBeInTheDocument();
    });
  });
});

describe('RoleManagementPage', () => {
  it('should call dataSource.find("sys_role") on mount', async () => {
    mockFind.mockResolvedValueOnce({
      data: [{ id: '1', name: 'Admin', description: 'Full access', isSystem: true, userCount: 3 }],
    });
    wrap(<RoleManagementPage />);
    await waitFor(() => {
      expect(mockFind).toHaveBeenCalledWith('sys_role');
    });
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('should show empty state when no roles', async () => {
    mockFind.mockResolvedValueOnce({ data: [] });
    wrap(<RoleManagementPage />);
    await waitFor(() => {
      expect(screen.getByText('No roles found.')).toBeInTheDocument();
    });
  });
});

describe('AuditLogPage', () => {
  it('should call dataSource.find("sys_audit_log") on mount', async () => {
    mockFind.mockResolvedValueOnce({
      data: [{ id: '1', action: 'create', resource: 'user', userName: 'Admin', ipAddress: '127.0.0.1', createdAt: '2026-01-01' }],
    });
    wrap(<AuditLogPage />);
    await waitFor(() => {
      expect(mockFind).toHaveBeenCalledWith('sys_audit_log', expect.objectContaining({ $orderby: { createdAt: 'desc' } }));
    });
    expect(screen.getByText('create')).toBeInTheDocument();
  });

  it('should show empty state when no logs', async () => {
    mockFind.mockResolvedValueOnce({ data: [] });
    wrap(<AuditLogPage />);
    await waitFor(() => {
      expect(screen.getByText('No audit logs found.')).toBeInTheDocument();
    });
  });
});

describe('SystemHubPage', () => {
  it('should render System Settings heading and all hub cards', async () => {
    mockFind.mockResolvedValue({ data: [] });
    wrap(<SystemHubPage />);
    expect(screen.getByText('System Settings')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('hub-card-applications')).toBeInTheDocument();
      expect(screen.getByTestId('hub-card-users')).toBeInTheDocument();
      expect(screen.getByTestId('hub-card-organizations')).toBeInTheDocument();
      expect(screen.getByTestId('hub-card-roles')).toBeInTheDocument();
      expect(screen.getByTestId('hub-card-permissions')).toBeInTheDocument();
      expect(screen.getByTestId('hub-card-audit-log')).toBeInTheDocument();
      expect(screen.getByTestId('hub-card-profile')).toBeInTheDocument();
    });
  });

  it('should fetch counts from dataSource on mount', async () => {
    mockFind.mockResolvedValue({ data: [{ id: '1' }] });
    wrap(<SystemHubPage />);
    await waitFor(() => {
      expect(mockFind).toHaveBeenCalledWith('sys_user');
      expect(mockFind).toHaveBeenCalledWith('sys_org');
      expect(mockFind).toHaveBeenCalledWith('sys_role');
      expect(mockFind).toHaveBeenCalledWith('sys_permission');
      expect(mockFind).toHaveBeenCalledWith('sys_audit_log');
    });
  });

  it('should navigate to section when card is clicked', async () => {
    mockFind.mockResolvedValue({ data: [] });
    wrap(<SystemHubPage />);
    await waitFor(() => {
      expect(screen.getByTestId('hub-card-users')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('hub-card-users'));
    expect(mockNavigate).toHaveBeenCalledWith('/apps/test-app/system/users');
  });
});

describe('AppManagementPage', () => {
  it('should render app list from metadata', () => {
    wrap(<AppManagementPage />);
    expect(screen.getByText('Applications')).toBeInTheDocument();
    expect(screen.getByTestId('app-card-crm')).toBeInTheDocument();
    expect(screen.getByTestId('app-card-hr')).toBeInTheDocument();
  });

  it('should filter apps by search query', () => {
    wrap(<AppManagementPage />);
    fireEvent.change(screen.getByTestId('app-search-input'), { target: { value: 'CRM' } });
    expect(screen.getByTestId('app-card-crm')).toBeInTheDocument();
    expect(screen.queryByTestId('app-card-hr')).not.toBeInTheDocument();
  });

  it('should show empty state when no matching apps', () => {
    wrap(<AppManagementPage />);
    fireEvent.change(screen.getByTestId('app-search-input'), { target: { value: 'nonexistent' } });
    expect(screen.getByTestId('no-apps-message')).toBeInTheDocument();
  });

  it('should navigate to create-app on New App button click', () => {
    wrap(<AppManagementPage />);
    fireEvent.click(screen.getByTestId('create-app-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/apps/test-app/create-app');
  });
});

describe('PermissionManagementPage', () => {
  it('should call dataSource.find("sys_permission") on mount', async () => {
    mockFind.mockResolvedValueOnce({
      data: [{ id: '1', name: 'manage_users', resource: 'user', action: 'manage', description: 'Full user access' }],
    });
    wrap(<PermissionManagementPage />);
    await waitFor(() => {
      expect(mockFind).toHaveBeenCalledWith('sys_permission');
    });
    expect(screen.getByText('manage_users')).toBeInTheDocument();
  });

  it('should show empty state when no permissions', async () => {
    mockFind.mockResolvedValueOnce({ data: [] });
    wrap(<PermissionManagementPage />);
    await waitFor(() => {
      expect(screen.getByText('No permissions found.')).toBeInTheDocument();
    });
  });

  it('should call create when Add Permission is clicked', async () => {
    mockFind.mockResolvedValue({ data: [] });
    mockCreate.mockResolvedValueOnce({ id: 'new-perm' });
    wrap(<PermissionManagementPage />);
    await waitFor(() => {
      expect(screen.getByText('No permissions found.')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Add Permission'));
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith('sys_permission', expect.objectContaining({ name: 'New Permission' }));
    });
  });

  it('should filter permissions by search query', async () => {
    mockFind.mockResolvedValue({
      data: [
        { id: '1', name: 'manage_users', resource: 'user', action: 'manage', description: '' },
        { id: '2', name: 'read_reports', resource: 'report', action: 'read', description: '' },
      ],
    });
    wrap(<PermissionManagementPage />);
    await waitFor(() => {
      expect(screen.getByText('manage_users')).toBeInTheDocument();
      expect(screen.getByText('read_reports')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByTestId('permission-search-input'), { target: { value: 'report' } });
    await waitFor(() => {
      expect(screen.queryByText('manage_users')).not.toBeInTheDocument();
      expect(screen.getByText('read_reports')).toBeInTheDocument();
    });
  });
});
