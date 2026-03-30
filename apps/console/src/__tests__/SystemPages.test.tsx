/**
 * System Admin Pages Integration Tests
 *
 * Tests that system pages render the correct page header and delegate
 * data rendering to the ObjectView component from @object-ui/plugin-view,
 * configured with the appropriate object metadata from systemObjects.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

// --- Capture ObjectView props for assertion ---
let lastObjectViewProps: any = null;

vi.mock('@object-ui/plugin-view', () => ({
  ObjectView: (props: any) => {
    lastObjectViewProps = props;
    return (
      <div
        data-testid="plugin-object-view"
        data-objectname={props.schema?.objectName}
        data-operations={JSON.stringify(props.schema?.operations)}
      />
    );
  },
}));

// --- Shared mock adapter ---
const mockFind = vi.fn().mockResolvedValue({ data: [], total: 0 });
const mockCreate = vi.fn().mockResolvedValue({ id: 'new-1' });
const mockDelete = vi.fn().mockResolvedValue({});

const mockAdapter = {
  find: mockFind,
  create: mockCreate,
  delete: mockDelete,
  update: vi.fn(),
  findOne: vi.fn(),
  getObjectSchema: vi.fn().mockResolvedValue({ name: 'test', fields: {} }),
};

vi.mock('../context/AdapterProvider', () => ({
  useAdapter: () => mockAdapter,
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
  lastObjectViewProps = null;
});

describe('UserManagementPage', () => {
  it('should render ObjectView with sys_user object and page header', () => {
    wrap(<UserManagementPage />);
    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByText('Manage system users and their roles')).toBeInTheDocument();
    expect(screen.getByTestId('plugin-object-view')).toBeInTheDocument();
    expect(screen.getByTestId('plugin-object-view').dataset.objectname).toBe('sys_user');
  });

  it('should pass the adapter as dataSource to ObjectView', () => {
    wrap(<UserManagementPage />);
    expect(lastObjectViewProps.dataSource).toBe(mockAdapter);
  });

  it('should enable CRUD operations for admin users', () => {
    wrap(<UserManagementPage />);
    const ops = lastObjectViewProps.schema.operations;
    expect(ops).toEqual({ create: true, update: true, delete: true });
  });

  it('should configure table columns from systemObjects metadata', () => {
    wrap(<UserManagementPage />);
    expect(lastObjectViewProps.schema.table.columns).toEqual(
      ['name', 'email', 'role', 'status', 'lastLoginAt']
    );
  });
});

describe('OrgManagementPage', () => {
  it('should render ObjectView with sys_org object and page header', () => {
    wrap(<OrgManagementPage />);
    expect(screen.getByText('Organization Management')).toBeInTheDocument();
    expect(screen.getByText('Manage organizations and their members')).toBeInTheDocument();
    expect(screen.getByTestId('plugin-object-view').dataset.objectname).toBe('sys_org');
  });

  it('should configure table columns from systemObjects metadata', () => {
    wrap(<OrgManagementPage />);
    expect(lastObjectViewProps.schema.table.columns).toEqual(
      ['name', 'slug', 'plan', 'status', 'memberCount']
    );
  });
});

describe('RoleManagementPage', () => {
  it('should render ObjectView with sys_role object and page header', () => {
    wrap(<RoleManagementPage />);
    expect(screen.getByText('Role Management')).toBeInTheDocument();
    expect(screen.getByText('Define roles and assign permissions')).toBeInTheDocument();
    expect(screen.getByTestId('plugin-object-view').dataset.objectname).toBe('sys_role');
  });

  it('should configure table columns from systemObjects metadata', () => {
    wrap(<RoleManagementPage />);
    expect(lastObjectViewProps.schema.table.columns).toEqual(
      ['name', 'description', 'isSystem', 'userCount']
    );
  });
});

describe('AuditLogPage', () => {
  it('should render ObjectView with sys_audit_log object and page header', () => {
    wrap(<AuditLogPage />);
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
    expect(screen.getByText('View system activity and user actions')).toBeInTheDocument();
    expect(screen.getByTestId('plugin-object-view').dataset.objectname).toBe('sys_audit_log');
  });

  it('should disable all mutation operations (read-only)', () => {
    wrap(<AuditLogPage />);
    const ops = lastObjectViewProps.schema.operations;
    expect(ops).toEqual({ create: false, update: false, delete: false });
  });

  it('should configure table columns from systemObjects metadata', () => {
    wrap(<AuditLogPage />);
    expect(lastObjectViewProps.schema.table.columns).toEqual(
      ['action', 'resource', 'userName', 'ipAddress', 'createdAt']
    );
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
  it('should render ObjectView with sys_permission object and page header', () => {
    wrap(<PermissionManagementPage />);
    expect(screen.getByText('Permissions')).toBeInTheDocument();
    expect(screen.getByText('Manage permission rules and assignments')).toBeInTheDocument();
    expect(screen.getByTestId('plugin-object-view').dataset.objectname).toBe('sys_permission');
  });

  it('should enable CRUD operations for admin users', () => {
    wrap(<PermissionManagementPage />);
    const ops = lastObjectViewProps.schema.operations;
    expect(ops).toEqual({ create: true, update: true, delete: true });
  });

  it('should configure table columns from systemObjects metadata', () => {
    wrap(<PermissionManagementPage />);
    expect(lastObjectViewProps.schema.table.columns).toEqual(
      ['name', 'resource', 'action', 'description']
    );
  });

  it('should enable search and filters', () => {
    wrap(<PermissionManagementPage />);
    expect(lastObjectViewProps.schema.showSearch).toBe(true);
    expect(lastObjectViewProps.schema.showFilters).toBe(true);
  });
});
