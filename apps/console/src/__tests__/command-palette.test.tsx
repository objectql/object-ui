/**
 * CommandPalette Tests
 *
 * Tests that the command palette searches across all entity types:
 * objects, dashboards, pages, and reports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CommandPalette } from '../components/CommandPalette';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock @object-ui/components Command primitives
vi.mock('@object-ui/components', () => ({
  CommandDialog: ({ open, children }: any) =>
    open ? <div data-testid="command-dialog">{children}</div> : null,
  CommandInput: ({ placeholder }: any) => (
    <input data-testid="command-input" placeholder={placeholder} />
  ),
  CommandList: ({ children }: any) => <div data-testid="command-list">{children}</div>,
  CommandEmpty: ({ children }: any) => <div data-testid="command-empty">{children}</div>,
  CommandGroup: ({ heading, children }: any) => (
    <div data-testid={`command-group-${heading}`} data-heading={heading}>
      <span>{heading}</span>
      {children}
    </div>
  ),
  CommandItem: ({ children, onSelect, value }: any) => (
    <div data-testid={`command-item-${value}`} data-value={value} onClick={onSelect} role="option">
      {children}
    </div>
  ),
  CommandSeparator: () => <hr data-testid="command-separator" />,
}));

// Mock Lucide icons - use importOriginal to handle the dynamic `import * as LucideIcons`
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
  };
});

// Mock theme provider
vi.mock('../components/theme-provider', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}));

// Mock expression provider
vi.mock('../context/ExpressionProvider', () => ({
  useExpressionContext: () => ({ evaluator: {} }),
  evaluateVisibility: () => true,
}));

// Mock i18n
vi.mock('@object-ui/i18n', () => ({
  useObjectTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'console.commandPalette.placeholder': 'Type a command or search...',
        'console.commandPalette.noResults': 'No results found.',
        'console.commandPalette.objects': 'Objects',
        'console.commandPalette.dashboards': 'Dashboards',
        'console.commandPalette.pages': 'Pages',
        'console.commandPalette.reports': 'Reports',
        'console.commandPalette.switchApp': 'Switch App',
        'console.commandPalette.preferences': 'Preferences',
        'console.commandPalette.lightTheme': 'Light',
        'console.commandPalette.darkTheme': 'Dark',
        'console.commandPalette.systemTheme': 'System',
        'console.commandPalette.current': '(current)',
        'console.commandPalette.actions': 'Actions',
        'console.commandPalette.openFullSearch': 'Open full search',
      };
      return map[key] ?? key;
    },
    language: 'en',
    direction: 'ltr',
  }),
}));

// Fixtures
const navigation = [
  { id: 'nav-contact', label: 'Contacts', type: 'object', objectName: 'contact', icon: 'Users' },
  { id: 'nav-deal', label: 'Deals', type: 'object', objectName: 'deal', icon: 'Briefcase' },
  {
    id: 'nav-sales-dashboard',
    label: 'Sales Dashboard',
    type: 'dashboard',
    dashboardName: 'sales_overview',
  },
  {
    id: 'nav-help-page',
    label: 'Help Center',
    type: 'page',
    pageName: 'help',
  },
  {
    id: 'nav-monthly-report',
    label: 'Monthly Report',
    type: 'report',
    reportName: 'monthly',
  },
];

const apps = [
  { name: 'crm', label: 'CRM', active: true, navigation },
];

const activeApp = apps[0];

function renderPalette(overrideProps: Partial<React.ComponentProps<typeof CommandPalette>> = {}) {
  return render(
    <MemoryRouter initialEntries={['/apps/crm']}>
      <Routes>
        <Route
          path="/apps/:appName"
          element={
            <CommandPalette
              apps={apps}
              activeApp={activeApp}
              objects={[]}
              onAppChange={vi.fn()}
              {...overrideProps}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens with ⌘+K keyboard shortcut', () => {
    renderPalette();

    // Dialog should be closed initially
    expect(screen.queryByTestId('command-dialog')).not.toBeInTheDocument();

    // Trigger ⌘+K
    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    expect(screen.getByTestId('command-dialog')).toBeInTheDocument();
  });

  it('opens with Ctrl+K keyboard shortcut', () => {
    renderPalette();

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

    expect(screen.getByTestId('command-dialog')).toBeInTheDocument();
  });

  it('toggles closed on second ⌘+K', () => {
    renderPalette();

    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(screen.getByTestId('command-dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(screen.queryByTestId('command-dialog')).not.toBeInTheDocument();
  });

  describe('Entity type groups', () => {
    beforeEach(() => {
      renderPalette();
      fireEvent.keyDown(document, { key: 'k', metaKey: true });
    });

    it('displays Objects group with object navigation items', () => {
      expect(screen.getByTestId('command-group-Objects')).toBeInTheDocument();
      expect(screen.getByText('Contacts')).toBeInTheDocument();
      expect(screen.getByText('Deals')).toBeInTheDocument();
    });

    it('displays Dashboards group', () => {
      expect(screen.getByTestId('command-group-Dashboards')).toBeInTheDocument();
      expect(screen.getByText('Sales Dashboard')).toBeInTheDocument();
    });

    it('displays Pages group', () => {
      expect(screen.getByTestId('command-group-Pages')).toBeInTheDocument();
      expect(screen.getByText('Help Center')).toBeInTheDocument();
    });

    it('displays Reports group', () => {
      expect(screen.getByTestId('command-group-Reports')).toBeInTheDocument();
      expect(screen.getByText('Monthly Report')).toBeInTheDocument();
    });
  });

  describe('Theme preferences', () => {
    it('shows light, dark, and system theme options', () => {
      renderPalette();
      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      expect(screen.getByTestId('command-group-Preferences')).toBeInTheDocument();
      expect(screen.getByText('Light')).toBeInTheDocument();
      expect(screen.getByText('Dark')).toBeInTheDocument();
      expect(screen.getByText('System')).toBeInTheDocument();
    });
  });

  describe('App switching', () => {
    it('shows app switching section when multiple apps exist', () => {
      const multiApps = [
        { name: 'crm', label: 'CRM', active: true, navigation },
        { name: 'hr', label: 'HR', active: true, navigation: [] },
      ];

      renderPalette({ apps: multiApps });
      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      expect(screen.getByTestId('command-group-Switch App')).toBeInTheDocument();
      expect(screen.getByText('CRM')).toBeInTheDocument();
      expect(screen.getByText('HR')).toBeInTheDocument();
    });

    it('does not show app switching when only one app exists', () => {
      renderPalette();
      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      expect(screen.queryByTestId('command-group-Switch App')).not.toBeInTheDocument();
    });
  });

  describe('Search action', () => {
    it('shows full search action', () => {
      renderPalette();
      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      expect(screen.getByTestId('command-group-Actions')).toBeInTheDocument();
      expect(screen.getByText('Open full search')).toBeInTheDocument();
    });
  });

  describe('Nested navigation', () => {
    it('flattens grouped navigation items', () => {
      const groupedNav = [
        {
          id: 'group1',
          type: 'group',
          label: 'Sales',
          children: [
            { id: 'nav-lead', label: 'Leads', type: 'object', objectName: 'lead' },
          ],
        },
        { id: 'nav-activity-dash', label: 'Activity', type: 'dashboard', dashboardName: 'activity' },
      ];

      const app = { name: 'crm', label: 'CRM', active: true, navigation: groupedNav };

      renderPalette({ apps: [app], activeApp: app });
      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      expect(screen.getByText('Leads')).toBeInTheDocument();
      expect(screen.getByText('Activity')).toBeInTheDocument();
    });
  });

  describe('Empty navigation', () => {
    it('does not render entity groups when navigation is empty', () => {
      const emptyApp = { name: 'empty', label: 'Empty', active: true, navigation: [] };

      renderPalette({ apps: [emptyApp], activeApp: emptyApp });
      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      expect(screen.queryByTestId('command-group-Objects')).not.toBeInTheDocument();
      expect(screen.queryByTestId('command-group-Dashboards')).not.toBeInTheDocument();
      expect(screen.queryByTestId('command-group-Pages')).not.toBeInTheDocument();
      expect(screen.queryByTestId('command-group-Reports')).not.toBeInTheDocument();
      // Preferences and actions should still show
      expect(screen.getByTestId('command-group-Preferences')).toBeInTheDocument();
    });
  });
});
