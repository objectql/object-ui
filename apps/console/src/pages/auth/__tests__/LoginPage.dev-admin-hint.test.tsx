/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * LoginPage — dev-seeded admin credentials hint (framework 15.1 third-party
 * eval): the runtime seeds `admin@objectos.ai` on an empty dev DB but the
 * login page never said so, sending new users to "Sign up" and into an empty
 * non-admin workspace. The server exposes `devSeedAdmin` on /auth/config ONLY
 * in development while the default password still verifies; the page renders
 * it as a dismissible banner and must render nothing when the field is
 * absent (production).
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@object-ui/auth';
import type { AuthClient } from '@object-ui/auth';
import { LoginPage } from '../LoginPage';

afterEach(cleanup);
beforeEach(() => {
  window.localStorage.clear();
});

function createMockClient(config: Record<string, unknown>): AuthClient {
  return {
    getSession: vi.fn().mockResolvedValue(null),
    getConfig: vi.fn().mockResolvedValue(config),
  } as unknown as AuthClient;
}

function renderLogin(config: Record<string, unknown>) {
  window.history.replaceState({}, '', '/login');
  return render(
    <AuthProvider authUrl="/api/v1/auth" client={createMockClient(config)}>
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    </AuthProvider>,
  );
}

const DEV_SEED = { devSeedAdmin: { email: 'admin@objectos.ai', password: 'admin123' } };

describe('LoginPage — dev-seeded admin hint', () => {
  it('renders the credentials when the server reports devSeedAdmin', async () => {
    renderLogin(DEV_SEED);

    const hint = await screen.findByTestId('dev-admin-hint');
    expect(hint.textContent).toContain('admin@objectos.ai');
    expect(hint.textContent).toContain('admin123');
  });

  it('renders nothing without devSeedAdmin (production config)', async () => {
    renderLogin({ emailPassword: { disableSignUp: false } });

    // Let the config effect settle, then assert absence.
    await waitFor(() => expect(screen.queryByTestId('dev-admin-hint')).toBeNull());
  });

  it('dismisses on click and stays dismissed via localStorage', async () => {
    renderLogin(DEV_SEED);
    const user = userEvent.setup();

    await screen.findByTestId('dev-admin-hint');
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByTestId('dev-admin-hint')).toBeNull();
    expect(window.localStorage.getItem('os.console.devAdminHintDismissed')).toBe('1');

    // A re-render (new visit) must respect the stored dismissal.
    cleanup();
    renderLogin(DEV_SEED);
    await waitFor(() => expect(screen.queryByTestId('dev-admin-hint')).toBeNull());
  });
});
