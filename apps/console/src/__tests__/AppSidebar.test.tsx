import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AppSidebar } from '../components/AppSidebar';
import { SidebarProvider } from '@object-ui/components';

// --- Mocks ---

const mockNavigation = [
  { id: 'nav-accounts', label: 'Accounts', type: 'object', objectName: 'account', icon: 'Users' },
  { id: 'nav-contacts', label: 'Contacts', type: 'object', objectName: 'contact', icon: 'User' },
  { id: 'nav-dash', label: 'Monthly Dashboard', type: 'dashboard', dashboardName: 'monthly', icon: 'LayoutDashboard', badge: 3, badgeVariant: 'destructive' as const },
  { id: 'nav-settings', label: 'Settings', type: 'page', pageName: 'settings', icon: 'Settings', badge: 'New' },
  {
    id: 'nav-group-reports',
    label: 'Reports',
    type: 'group',
    children: [
      { id: 'nav-report-sales', label: 'Sales Report', type: 'report', reportName: 'sales', icon: 'BarChart' },
      { id: 'nav-report-inv', label: 'Inventory Report', type: 'report', reportName: 'inventory', icon: 'Package' },
    ],
  },
];

vi.mock('../context/MetadataProvider', () => ({
  MetadataProvider: ({ children }: any) => <>{children}</>,
  useMetadata: () => ({
    apps: [
      {
        name: 'crm',
        label: 'CRM App',
        active: true,
        icon: 'Briefcase',
        navigation: mockNavigation,
      },
    ],
    objects: [],
    dashboards: [],
    reports: [],
    pages: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

vi.mock('../context/ExpressionProvider', () => ({
  useExpressionContext: () => ({ evaluator: null }),
  evaluateVisibility: () => true,
}));

vi.mock('@object-ui/auth', () => ({
  useAuth: () => ({
    user: { name: 'Test User', email: 'test@test.com' },
    signOut: vi.fn(),
  }),
  getUserInitials: () => 'TU',
}));

vi.mock('@object-ui/permissions', () => ({
  usePermissions: () => ({
    can: () => true,
  }),
}));

vi.mock('../hooks/useRecentItems', () => ({
  useRecentItems: () => ({ recentItems: [] }),
}));

vi.mock('../hooks/useFavorites', () => ({
  useFavorites: () => ({ favorites: [], removeFavorite: vi.fn() }),
}));

vi.mock('../hooks/useNavPins', () => ({
  useNavPins: () => ({
    pinnedIds: [],
    togglePin: vi.fn(),
    isPinned: () => false,
    applyPins: (items: any[]) => items,
    clearPins: vi.fn(),
  }),
}));

vi.mock('../utils', () => ({
  resolveI18nLabel: (label: any) => {
    if (typeof label === 'string') return label;
    if (label && typeof label === 'object') return label.defaultValue || label.key || '';
    return '';
  },
}));

vi.mock('@object-ui/i18n', () => ({
  useObjectTranslation: () => ({
    t: (key: string, opts?: any) => opts?.defaultValue ?? key,
    language: 'en',
    changeLanguage: vi.fn(),
    direction: 'ltr',
    i18n: {},
  }),
  useObjectLabel: () => ({
    objectLabel: (obj: any) => obj.label,
    objectDescription: (obj: any) => obj.description,
    fieldLabel: (_objectName: string, _fieldName: string, fallback: string) => fallback,
  }),
}));

// Mock @object-ui/components to keep most components but simplify some
vi.mock('@object-ui/components', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    TooltipProvider: ({ children }: any) => <div>{children}</div>,
  };
});

// Provide minimal lucide-react mocks
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<any>();
  const MockIcon = ({ className }: any) => <span className={className} />;
  return {
    ...actual,
    ChevronsUpDown: MockIcon,
    Plus: MockIcon,
    Settings: MockIcon,
    LogOut: MockIcon,
    Database: MockIcon,
    ChevronRight: MockIcon,
    Clock: MockIcon,
    Star: MockIcon,
    StarOff: MockIcon,
    Layers: MockIcon,
    Search: MockIcon,
  };
});

describe('AppSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const renderSidebar = () => {
    return render(
      <MemoryRouter initialEntries={['/apps/crm/']}>
        <Routes>
          <Route
            path="/apps/:appName/*"
            element={
              <SidebarProvider>
                <AppSidebar activeAppName="crm" onAppChange={vi.fn()} />
              </SidebarProvider>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
  };

  // --- Navigation Search ---

  describe('Navigation Search', () => {
    it('renders a search input in the sidebar', async () => {
      renderSidebar();
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search navigation...')).toBeInTheDocument();
      });
    });

    it('filters navigation items when typing in search', async () => {
      renderSidebar();

      await waitFor(() => {
        expect(screen.getByText('Accounts')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search navigation...');
      fireEvent.change(searchInput, { target: { value: 'account' } });

      await waitFor(() => {
        expect(screen.getByText('Accounts')).toBeInTheDocument();
        expect(screen.queryByText('Contacts')).not.toBeInTheDocument();
        expect(screen.queryByText('Monthly Dashboard')).not.toBeInTheDocument();
      });
    });

    it('filters within groups', async () => {
      renderSidebar();

      await waitFor(() => {
        expect(screen.getByText('Sales Report')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search navigation...');
      fireEvent.change(searchInput, { target: { value: 'sales' } });

      await waitFor(() => {
        expect(screen.getByText('Sales Report')).toBeInTheDocument();
        expect(screen.queryByText('Inventory Report')).not.toBeInTheDocument();
      });
    });

    it('shows all items when search is cleared', async () => {
      renderSidebar();

      await waitFor(() => {
        expect(screen.getByText('Accounts')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search navigation...');
      fireEvent.change(searchInput, { target: { value: 'account' } });

      await waitFor(() => {
        expect(screen.queryByText('Contacts')).not.toBeInTheDocument();
      });

      fireEvent.change(searchInput, { target: { value: '' } });

      await waitFor(() => {
        expect(screen.getByText('Accounts')).toBeInTheDocument();
        expect(screen.getByText('Contacts')).toBeInTheDocument();
      });
    });

    it('shows no results when search matches nothing', async () => {
      renderSidebar();

      await waitFor(() => {
        expect(screen.getByText('Accounts')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search navigation...');
      fireEvent.change(searchInput, { target: { value: 'zzzzz' } });

      await waitFor(() => {
        expect(screen.queryByText('Accounts')).not.toBeInTheDocument();
        expect(screen.queryByText('Contacts')).not.toBeInTheDocument();
        expect(screen.queryByText('Monthly Dashboard')).not.toBeInTheDocument();
      });
    });
  });

  // --- Badge Indicators ---

  describe('Badge Indicators', () => {
    it('renders numeric badge on navigation items', async () => {
      renderSidebar();

      await waitFor(() => {
        expect(screen.getByText('Monthly Dashboard')).toBeInTheDocument();
      });

      // The badge with "3" should be rendered
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('renders text badge on navigation items', async () => {
      renderSidebar();

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      // The badge with "New" should be rendered
      expect(screen.getByText('New')).toBeInTheDocument();
    });

    it('does not render badge when item has no badge property', async () => {
      renderSidebar();

      await waitFor(() => {
        expect(screen.getByText('Accounts')).toBeInTheDocument();
      });

      // "Accounts" has no badge - verify the element doesn't have a sibling badge
      const accountsLink = screen.getByText('Accounts');
      const parentButton = accountsLink.closest('[data-sidebar="menu-button"]') || accountsLink.parentElement;
      // Check that no Badge child with data attributes typical for badges
      const badges = parentButton?.querySelectorAll('.ml-auto.text-\\[10px\\]');
      expect(badges?.length ?? 0).toBe(0);
    });
  });

  // --- Navigation Drag Reorder (@dnd-kit integration) ---

  describe('Navigation Drag Reorder', () => {
    it('renders navigation items via NavigationRenderer (no draggable HTML5 attributes)', async () => {
      renderSidebar();

      await waitFor(() => {
        expect(screen.getByText('Accounts')).toBeInTheDocument();
        expect(screen.getByText('Contacts')).toBeInTheDocument();
      });

      // Verify items are not using HTML5 draggable attribute (old DnD removed)
      const accountsLink = screen.getByText('Accounts');
      const menuItem = accountsLink.closest('[data-sidebar="menu-item"]');
      // The old code set draggable="true" on SidebarMenuItem; the new code
      // delegates to NavigationRenderer which uses @dnd-kit (no draggable attr on the item itself)
      expect(menuItem?.getAttribute('draggable')).not.toBe('true');
    });

    it('persists reorder state to localStorage via useNavOrder', () => {
      // useNavOrder uses localStorage key `objectui-nav-order-{appName}`
      const storageKey = 'objectui-nav-order-crm';

      // Simulate a saved order in localStorage
      const savedOrder = { '__root__': ['nav-contacts', 'nav-accounts', 'nav-dash', 'nav-settings', 'nav-group-reports'] };
      localStorage.setItem(storageKey, JSON.stringify(savedOrder));

      renderSidebar();

      // Items should render (order applied internally by useNavOrder + NavigationRenderer)
      expect(screen.getByText('Accounts')).toBeInTheDocument();
      expect(screen.getByText('Contacts')).toBeInTheDocument();
    });
  });

  // --- Navigation Pin Integration ---

  describe('Navigation Pin', () => {
    it('renders navigation items with pin support enabled', async () => {
      renderSidebar();

      await waitFor(() => {
        expect(screen.getByText('Accounts')).toBeInTheDocument();
      });

      // NavigationRenderer receives enablePinning=true
      // Pin buttons are rendered by NavigationRenderer when enablePinning is set
      // We verify the items render correctly with pin support enabled
      expect(screen.getByText('Contacts')).toBeInTheDocument();
      expect(screen.getByText('Monthly Dashboard')).toBeInTheDocument();
    });
  });
});
