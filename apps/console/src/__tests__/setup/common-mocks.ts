/**
 * Common mocks for Console tests.
 *
 * A LOT of Console test files duplicate the same i18n / auth / permissions /
 * lucide-react mocks. Collect them here so new test files can do:
 *
 *   import { applyCommonConsoleMocks } from './setup/common-mocks';
 *   applyCommonConsoleMocks();
 *
 * ...and inherit a sensible baseline. Individual tests can still override any
 * specific mock by calling `vi.mock(..., ...)` after this import.
 *
 * IMPORTANT: `vi.mock` is hoisted by Vitest to the TOP of the importing file,
 * so calling a helper that itself calls `vi.mock` only works when the helper
 * is imported BEFORE any code that resolves the mocked module. Keep this
 * import at the very top of your test file.
 */

import { vi } from 'vitest';
import React from 'react';

/**
 * Apply the default Console test mocks.
 *
 * @param overrides - Optional partial override for any of the individual
 *                    mock factories. Pass `null` for a key to opt out of the
 *                    default mock for that module.
 */
export function applyCommonConsoleMocks(overrides: {
  i18n?: boolean;
  auth?: boolean;
  permissions?: boolean;
  lucide?: boolean;
} = {}) {
  const { i18n = true, auth = true, permissions = true, lucide = true } = overrides;

  if (i18n) {
    vi.mock('@object-ui/i18n', () => ({
      useObjectTranslation: () => ({
        t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
        language: 'en',
        changeLanguage: vi.fn(),
        direction: 'ltr' as const,
        i18n: {},
      }),
      useObjectLabel: () => ({
        objectLabel: (obj: any) => obj?.label ?? obj?.name,
        objectDescription: (obj: any) => obj?.description,
        fieldLabel: (_o: string, _f: string, fallback: string) => fallback,
        appLabel: (app: any) => app?.label ?? app?.name,
        appDescription: (app: any) => app?.description,
      }),
      useSafeFieldLabel: () => ({
        fieldLabel: (_o: string, _f: string, fallback: string) => fallback,
      }),
    }));
  }

  if (auth) {
    vi.mock('@object-ui/auth', () => ({
      useAuth: () => ({
        user: { name: 'Test User', email: 'test@test.com' },
        signOut: vi.fn(),
        organizations: [],
        activeOrganization: null,
        isOrganizationsLoading: false,
        switchOrganization: vi.fn(),
      }),
      getUserInitials: () => 'TU',
      AuthGuard: ({ children }: any) => React.createElement(React.Fragment, null, children),
      PreviewBanner: () => null,
    }));
  }

  if (permissions) {
    vi.mock('@object-ui/permissions', () => ({
      usePermissions: () => ({ can: () => true, cannot: () => false }),
    }));
  }

  if (lucide) {
    // Minimal lucide-react mock using a Proxy so any imported icon resolves to
    // a no-op span without the test file having to enumerate icons.
    vi.mock('lucide-react', () => {
      const MockIcon = ({ className, ...rest }: any) =>
        React.createElement('span', { 'data-testid': 'lucide-icon', className, ...rest });
      return new Proxy(
        { default: MockIcon },
        {
          get: (target: any, prop: string) => (prop in target ? target[prop] : MockIcon),
        },
      );
    });
  }
}
