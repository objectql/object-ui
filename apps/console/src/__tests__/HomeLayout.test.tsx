/**
 * Tests for HomeLayout — unified sidebar nav shell for /home.
 * Validates: layout rendering, sidebar presence, navigation context.
 *
 * Note: Radix DropdownMenu portal rendering is limited in jsdom,
 * so we test the trigger and visible elements rather than dropdown contents.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { HomeLayout } from '../pages/home/HomeLayout';

// --- Mocks ---

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockSignOut = vi.fn();
vi.mock('@object-ui/auth', () => ({
  useAuth: () => ({
    user: { name: 'Alice Dev', email: 'alice@test.com', image: null },
    signOut: mockSignOut,
    isAuthenticated: true,
  }),
  getUserInitials: () => 'AD',
}));

vi.mock('@object-ui/i18n', () => ({
  useObjectTranslation: () => ({
    t: (_key: string, opts?: any) => opts?.defaultValue ?? _key,
    language: 'en',
    changeLanguage: vi.fn(),
    direction: 'ltr',
    i18n: {},
  }),
  useObjectLabel: () => ({
    objectLabel: ({ name, label }: any) => label || name,
  }),
}));

// Mock @object-ui/components to keep most components
vi.mock('@object-ui/components', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    TooltipProvider: ({ children }: any) => <div>{children}</div>,
  };
});

// Mock UnifiedSidebar entirely — HomeLayout tests verify layout composition,
// not the sidebar's internal rendering. This also avoids SidebarProvider
// dependency when AppShell is mocked as a plain div.
vi.mock('../components/UnifiedSidebar', () => ({
  UnifiedSidebar: () => <nav data-testid="unified-sidebar" />,
}));

// Mock @object-ui/layout AppShell
vi.mock('@object-ui/layout', () => ({
  AppShell: ({ children, sidebar }: any) => (
    <div data-testid="app-shell">
      <div data-testid="sidebar">{sidebar}</div>
      <div data-testid="content">{children}</div>
    </div>
  ),
  useAppShellBranding: () => {},
}));

// Mock NavigationContext
const mockSetContext = vi.fn();
vi.mock('../context/NavigationContext', () => ({
  useNavigationContext: () => ({
    context: 'home',
    setContext: mockSetContext,
    currentAppName: undefined,
    setCurrentAppName: vi.fn(),
  }),
}));

// Mock MetadataProvider
vi.mock('../context/MetadataProvider', () => ({
  useMetadata: () => ({
    apps: [],
    objects: [],
    loading: false,
  }),
}));

// Mock other required contexts
vi.mock('../context/ExpressionProvider', () => ({
  useExpressionContext: () => ({
    evaluator: {},
  }),
  evaluateVisibility: () => true,
}));

vi.mock('@object-ui/permissions', () => ({
  usePermissions: () => ({
    can: () => true,
  }),
}));

vi.mock('../hooks/useRecentItems', () => ({
  useRecentItems: () => ({
    recentItems: [],
    addRecentItem: vi.fn(),
  }),
}));

vi.mock('../hooks/useFavorites', () => ({
  useFavorites: () => ({
    favorites: [],
    addFavorite: vi.fn(),
    removeFavorite: vi.fn(),
  }),
}));

vi.mock('../hooks/useNavPins', () => ({
  useNavPins: () => ({
    togglePin: vi.fn(),
    applyPins: (items: any[]) => items,
  }),
}));

vi.mock('../hooks/useResponsiveSidebar', () => ({
  useResponsiveSidebar: () => {},
}));

describe('HomeLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderLayout = (children: React.ReactNode = <div>Page Content</div>) => {
    return render(
      <MemoryRouter initialEntries={['/home']}>
        <HomeLayout>{children}</HomeLayout>
      </MemoryRouter>,
    );
  };

  it('renders the AppShell with sidebar and content', () => {
    renderLayout();
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('sets navigation context to "home" on mount', () => {
    renderLayout();
    expect(mockSetContext).toHaveBeenCalledWith('home');
  });

  it('renders children inside the layout', () => {
    renderLayout(<div data-testid="child-content">Hello World</div>);
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });
});
