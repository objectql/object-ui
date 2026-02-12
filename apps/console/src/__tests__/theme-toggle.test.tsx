/**
 * Theme Toggle Tests
 *
 * Tests that dark/light theme toggle is consistent across pages with no flash.
 * Validates ThemeProvider behavior: localStorage persistence, class application,
 * and system preference detection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ThemeProvider, useTheme } from '../components/theme-provider';

// Test helper component that exposes theme controls
function ThemeConsumer() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <button onClick={() => setTheme('light')}>Set Light</button>
      <button onClick={() => setTheme('dark')}>Set Dark</button>
      <button onClick={() => setTheme('system')}>Set System</button>
    </div>
  );
}

// Helpers
const STORAGE_KEY = 'test-ui-theme';
let matchMediaListeners: Array<(e: MediaQueryListEvent) => void> = [];

function mockMatchMedia(prefersDark: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = [];
  matchMediaListeners = listeners;

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
      media: query,
      addEventListener: (_type: string, cb: any) => listeners.push(cb),
      removeEventListener: (_type: string, cb: any) => {
        const idx = listeners.indexOf(cb);
        if (idx >= 0) listeners.splice(idx, 1);
      },
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial render', () => {
    it('defaults to system theme when no localStorage value exists', () => {
      render(
        <ThemeProvider storageKey={STORAGE_KEY}>
          <ThemeConsumer />
        </ThemeProvider>,
      );

      expect(screen.getByTestId('current-theme')).toHaveTextContent('system');
    });

    it('applies "light" class to <html> when system prefers light', () => {
      mockMatchMedia(false);
      render(
        <ThemeProvider storageKey={STORAGE_KEY}>
          <ThemeConsumer />
        </ThemeProvider>,
      );

      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('applies "dark" class to <html> when system prefers dark', () => {
      mockMatchMedia(true);
      render(
        <ThemeProvider storageKey={STORAGE_KEY}>
          <ThemeConsumer />
        </ThemeProvider>,
      );

      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('light')).toBe(false);
    });

    it('reads theme from localStorage if present', () => {
      localStorage.setItem(STORAGE_KEY, 'dark');
      render(
        <ThemeProvider storageKey={STORAGE_KEY}>
          <ThemeConsumer />
        </ThemeProvider>,
      );

      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('Theme switching', () => {
    it('switches to dark theme and updates <html> class', async () => {
      const user = userEvent.setup();
      render(
        <ThemeProvider storageKey={STORAGE_KEY}>
          <ThemeConsumer />
        </ThemeProvider>,
      );

      await user.click(screen.getByText('Set Dark'));

      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('light')).toBe(false);
    });

    it('switches to light theme and updates <html> class', async () => {
      const user = userEvent.setup();
      localStorage.setItem(STORAGE_KEY, 'dark');

      render(
        <ThemeProvider storageKey={STORAGE_KEY}>
          <ThemeConsumer />
        </ThemeProvider>,
      );

      await user.click(screen.getByText('Set Light'));

      expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('switches to system theme and applies system preference', async () => {
      const user = userEvent.setup();
      mockMatchMedia(true); // system prefers dark
      localStorage.setItem(STORAGE_KEY, 'light');

      render(
        <ThemeProvider storageKey={STORAGE_KEY}>
          <ThemeConsumer />
        </ThemeProvider>,
      );

      await user.click(screen.getByText('Set System'));

      expect(screen.getByTestId('current-theme')).toHaveTextContent('system');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('localStorage persistence', () => {
    it('persists theme choice to localStorage', async () => {
      const user = userEvent.setup();
      render(
        <ThemeProvider storageKey={STORAGE_KEY}>
          <ThemeConsumer />
        </ThemeProvider>,
      );

      await user.click(screen.getByText('Set Dark'));
      expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');

      await user.click(screen.getByText('Set Light'));
      expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
    });

    it('uses custom storage key when provided', async () => {
      const user = userEvent.setup();
      const customKey = 'my-app-theme';
      render(
        <ThemeProvider storageKey={customKey}>
          <ThemeConsumer />
        </ThemeProvider>,
      );

      await user.click(screen.getByText('Set Dark'));
      expect(localStorage.getItem(customKey)).toBe('dark');
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe('No flash on theme application', () => {
    it('removes previous theme class before adding new one', async () => {
      const user = userEvent.setup();
      render(
        <ThemeProvider storageKey={STORAGE_KEY}>
          <ThemeConsumer />
        </ThemeProvider>,
      );

      // Start with light
      await user.click(screen.getByText('Set Light'));
      expect(document.documentElement.classList.contains('light')).toBe(true);

      // Switch to dark — light must be removed
      await user.click(screen.getByText('Set Dark'));
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('light')).toBe(false);

      // Switch back to light — dark must be removed
      await user.click(screen.getByText('Set Light'));
      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('never has both light and dark classes simultaneously', async () => {
      const user = userEvent.setup();
      render(
        <ThemeProvider storageKey={STORAGE_KEY}>
          <ThemeConsumer />
        </ThemeProvider>,
      );

      const themes = ['Set Dark', 'Set Light', 'Set System', 'Set Dark', 'Set Light'];
      for (const theme of themes) {
        await user.click(screen.getByText(theme));
        const hasLight = document.documentElement.classList.contains('light');
        const hasDark = document.documentElement.classList.contains('dark');
        // Exactly one theme class should be applied (light XOR dark)
        expect(hasLight !== hasDark).toBe(true);
      }
    });
  });

  describe('Default state', () => {
    it('provides a default setTheme that is a no-op outside ThemeProvider', () => {
      // useTheme falls back to initialState when used outside ThemeProvider
      // The default setTheme is a no-op (returns null)
      render(<ThemeConsumer />);

      // The default theme should be "system" from initialState
      expect(screen.getByTestId('current-theme')).toHaveTextContent('system');
    });
  });

  describe('Consistency across pages', () => {
    it('maintains theme when ThemeProvider re-renders with new children', async () => {
      const user = userEvent.setup();

      // Simulate Page 1
      const { rerender } = render(
        <ThemeProvider storageKey={STORAGE_KEY}>
          <div data-testid="page-1">
            <ThemeConsumer />
          </div>
        </ThemeProvider>,
      );

      await user.click(screen.getByText('Set Dark'));
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      // Simulate navigation to Page 2 — re-render with new children
      rerender(
        <ThemeProvider storageKey={STORAGE_KEY}>
          <div data-testid="page-2">
            <ThemeConsumer />
          </div>
        </ThemeProvider>,
      );

      // Theme should persist
      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('light')).toBe(false);
    });
  });
});
