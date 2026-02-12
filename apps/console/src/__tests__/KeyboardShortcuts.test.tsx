/**
 * Tests for KeyboardShortcutsDialog component
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { KeyboardShortcutsDialog } from '../components/KeyboardShortcutsDialog';

// Mock @object-ui/components Dialog
vi.mock('@object-ui/components', () => ({
  Dialog: ({ open, children }: any) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
}));

// Mock i18n — return the key's last segment as display text
vi.mock('@object-ui/i18n', () => ({
  useObjectTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'console.shortcuts.title': 'Keyboard Shortcuts',
        'console.shortcuts.description': 'Quick reference for all available keyboard shortcuts.',
        'console.shortcuts.groups.general': 'General',
        'console.shortcuts.groups.navigation': 'Navigation',
        'console.shortcuts.groups.dataViews': 'Data Views',
        'console.shortcuts.groups.preferences': 'Preferences',
        'console.shortcuts.openCommandPalette': 'Open command palette',
        'console.shortcuts.showShortcuts': 'Show keyboard shortcuts',
        'console.shortcuts.closeDialog': 'Close dialog / panel',
        'console.shortcuts.toggleSidebar': 'Toggle sidebar',
        'console.shortcuts.focusSearch': 'Focus search',
        'console.shortcuts.createRecord': 'Create new record',
        'console.shortcuts.refreshData': 'Refresh data',
        'console.shortcuts.editRecord': 'Edit selected record',
        'console.shortcuts.toggleDarkMode': 'Toggle dark mode',
      };
      return translations[key] ?? key;
    },
    language: 'en',
    direction: 'ltr',
  }),
}));

describe('KeyboardShortcutsDialog', () => {
  it('renders without errors', () => {
    const { container } = render(<KeyboardShortcutsDialog />);
    // Dialog should be closed initially
    expect(container.querySelector('[data-testid="dialog"]')).toBeNull();
  });

  it('opens when ? key is pressed', () => {
    render(<KeyboardShortcutsDialog />);

    fireEvent.keyDown(document, { key: '?' });

    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  it('shows shortcut categories', () => {
    render(<KeyboardShortcutsDialog />);
    fireEvent.keyDown(document, { key: '?' });

    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Data Views')).toBeInTheDocument();
    expect(screen.getByText('Preferences')).toBeInTheDocument();
  });

  it('does not open when ? is pressed in an input', () => {
    const { container } = render(
      <div>
        <input data-testid="input" />
        <KeyboardShortcutsDialog />
      </div>
    );

    const input = screen.getByTestId('input');
    fireEvent.keyDown(input, { key: '?' });

    expect(container.querySelector('[data-testid="dialog"]')).toBeNull();
  });
});
