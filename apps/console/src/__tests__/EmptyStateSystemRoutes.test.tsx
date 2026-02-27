/**
 * Empty State & System Routes Tests
 *
 * Validates the empty state behavior when no apps are configured
 * and the availability of system routes and create-app entry points.
 *
 * Requirements:
 * - "Create App" button always visible in empty state (even on error)
 * - "System Settings" link always visible in empty state
 * - System routes accessible without app context
 * - Login/Register/Forgot password always accessible
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AppContent } from '../App';

// --- Mocks ---

// Mock MetadataProvider with NO apps (empty state)
vi.mock('../context/MetadataProvider', () => ({
  MetadataProvider: ({ children }: any) => <>{children}</>,
  useMetadata: () => ({
    apps: [],
    objects: [],
    dashboards: [],
    reports: [],
    pages: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

// Mock AdapterProvider
const MockAdapterInstance = {
  find: vi.fn().mockResolvedValue([]),
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  connect: vi.fn().mockResolvedValue(true),
  onConnectionStateChange: vi.fn().mockReturnValue(() => {}),
  getConnectionState: vi.fn().mockReturnValue('connected'),
  discovery: {},
};

vi.mock('../context/AdapterProvider', () => ({
  AdapterProvider: ({ children }: any) => <>{children}</>,
  useAdapter: () => MockAdapterInstance,
}));

vi.mock('../dataSource', () => {
  const MockAdapter = class {
    find = vi.fn().mockResolvedValue([]);
    findOne = vi.fn();
    create = vi.fn();
    update = vi.fn();
    delete = vi.fn();
    connect = vi.fn().mockResolvedValue(true);
    onConnectionStateChange = vi.fn().mockReturnValue(() => {});
    getConnectionState = vi.fn().mockReturnValue('connected');
    discovery = {};
  };
  return {
    ObjectStackAdapter: MockAdapter,
    ObjectStackDataSource: MockAdapter,
  };
});

// Mock child components to simplify testing
vi.mock('../components/ObjectView', () => ({
  ObjectView: () => <div data-testid="object-view">Object View</div>,
}));

vi.mock('@object-ui/components', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    TooltipProvider: ({ children }: any) => <div>{children}</div>,
    Dialog: ({ children, open }: any) => open ? <div data-testid="dialog">{children}</div> : null,
    DialogContent: ({ children }: any) => <div>{children}</div>,
  };
});

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    Database: () => <span data-testid="icon-database" />,
    Settings: () => <span data-testid="icon-settings" />,
    Plus: () => <span />,
    Search: () => <span />,
    ChevronsUpDown: () => <span />,
    LogOut: () => <span />,
    ChevronRight: () => <span />,
    Clock: () => <span />,
    Star: () => <span />,
    StarOff: () => <span />,
    Pencil: () => <span />,
  };
});

// System pages mocks
vi.mock('../pages/system/SystemHubPage', () => ({
  SystemHubPage: () => <div data-testid="system-hub-page">System Hub</div>,
}));

vi.mock('../pages/system/AppManagementPage', () => ({
  AppManagementPage: () => <div data-testid="app-management-page">App Management</div>,
}));

vi.mock('../pages/system/UserManagementPage', () => ({
  UserManagementPage: () => <div data-testid="user-management-page">User Management</div>,
}));

vi.mock('../pages/system/OrgManagementPage', () => ({
  OrgManagementPage: () => <div data-testid="org-management-page">Org Management</div>,
}));

vi.mock('../pages/system/RoleManagementPage', () => ({
  RoleManagementPage: () => <div data-testid="role-management-page">Role Management</div>,
}));

vi.mock('../pages/system/PermissionManagementPage', () => ({
  PermissionManagementPage: () => <div data-testid="permission-management-page">Permission Management</div>,
}));

vi.mock('../pages/system/AuditLogPage', () => ({
  AuditLogPage: () => <div data-testid="audit-log-page">Audit Log</div>,
}));

vi.mock('../pages/system/ProfilePage', () => ({
  ProfilePage: () => <div data-testid="profile-page">Profile</div>,
}));

vi.mock('../pages/CreateAppPage', () => ({
  CreateAppPage: () => <div data-testid="create-app-page">Create App Page</div>,
}));

describe('Empty State — No Apps Configured', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderApp = (initialRoute = '/apps/_new/') => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/apps/:appName/*" element={<AppContent />} />
        </Routes>
      </MemoryRouter>,
    );
  };

  it('shows "Create Your First App" button in empty state', async () => {
    renderApp();
    await waitFor(() => {
      expect(screen.getByTestId('create-first-app-btn')).toBeInTheDocument();
    }, { timeout: 5000 });
    expect(screen.getByText('No Apps Configured')).toBeInTheDocument();
  });

  it('shows "System Settings" button in empty state', async () => {
    renderApp();
    await waitFor(() => {
      expect(screen.getByTestId('go-to-settings-btn')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('shows descriptive text about creating apps or visiting settings', async () => {
    renderApp();
    await waitFor(() => {
      expect(screen.getByText(/Create your first app or visit System Settings/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});

describe('System Routes Within App Context (No Active App)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderApp = (initialRoute: string) => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/apps/:appName/*" element={<AppContent />} />
        </Routes>
      </MemoryRouter>,
    );
  };

  it('renders system hub page at /apps/_new/system when no active app', async () => {
    renderApp('/apps/_new/system');
    await waitFor(() => {
      expect(screen.getByTestId('system-hub-page')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders create app page at /apps/_new/create-app when no active app', async () => {
    renderApp('/apps/_new/create-app');
    await waitFor(() => {
      expect(screen.getByTestId('create-app-page')).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});
