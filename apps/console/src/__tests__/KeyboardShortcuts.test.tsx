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
