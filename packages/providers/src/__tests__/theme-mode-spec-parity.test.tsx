/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Theme mode ↔ spec vocabulary parity + behavior (#2942).
 *
 * The spec's OS-following mode is `auto` (`ThemeModeSchema`,
 * `ui/theme.zod.ts`); this provider branched on its pre-spec `system`
 * spelling only, so `mode: 'auto'` fell into `classList.add('auto')` — a
 * class no Tailwind variant matches. The page locked to the light theme,
 * the OS preference was ignored, and nothing errored.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { ThemeModeSchema } from '@objectstack/spec/ui';
import { ThemeProvider } from '../ThemeProvider';

function mockMatchMedia(prefersDark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: prefersDark,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })),
  });
}

describe('ThemeProvider covers the spec theme-mode vocabulary', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    window.localStorage?.clear?.();
    mockMatchMedia(true);
  });

  it('reads a non-empty enum from the spec', () => {
    const raw = (ThemeModeSchema as unknown as { options?: readonly string[] }).options;
    expect(Array.isArray(raw) && raw.length > 0, 'could not read ThemeModeSchema.options').toBe(true);
  });

  it('every spec mode resolves to a real light/dark class — never a dead literal', () => {
    const raw = (ThemeModeSchema as unknown as { options?: readonly string[] }).options ?? [];
    for (const mode of raw) {
      document.documentElement.className = '';
      const { unmount } = render(
        <ThemeProvider defaultTheme={mode as never} storageKey={`t-${mode}`}>
          <div />
        </ThemeProvider>,
      );
      const classes = [...document.documentElement.classList];
      expect(
        classes.some((c) => c === 'light' || c === 'dark'),
        `mode '${mode}' must resolve to light/dark, got [${classes.join(', ')}]`,
      ).toBe(true);
      expect(classes, `mode '${mode}' leaked a dead class`).not.toContain(mode === 'auto' ? 'auto' : '__never__');
      unmount();
    }
  });

  it("'auto' follows the OS preference (dark here)", () => {
    render(
      <ThemeProvider defaultTheme={'auto' as never} storageKey="t-auto-dark">
        <div />
      </ThemeProvider>,
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it("legacy 'system' keeps following the OS preference", () => {
    render(
      <ThemeProvider defaultTheme="system" storageKey="t-system">
        <div />
      </ThemeProvider>,
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
