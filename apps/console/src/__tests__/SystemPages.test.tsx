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

// Import after mocks
import { UserManagementPage } from '../pages/system/UserManagementPage';
import { OrgManagementPage } from '../pages/system/OrgManagementPage';
import { RoleManagementPage } from '../pages/system/RoleManagementPage';
import { AuditLogPage } from '../pages/system/AuditLogPage';

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
