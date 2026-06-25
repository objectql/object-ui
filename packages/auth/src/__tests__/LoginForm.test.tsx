/**
 * Tests for LoginForm — specifically the server-gated "Sign in with SSO"
 * button. The button must only render when the server's `/auth/config`
 * reports `features.sso`, mirroring how social providers are gated. Otherwise
 * a self-hosted / local deployment (where `@better-auth/sso` isn't wired)
 * shows a button whose `/sign-in/sso` route 404s, surfacing the misleading
 * "No SSO provider is configured for this email domain." only at click time.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../AuthProvider';
import { LoginForm } from '../LoginForm';
import type { AuthClient, AuthPublicConfig } from '../types';

const SSO_BUTTON = { name: 'Sign in with SSO' } as const;

function createMockClient(
  config: AuthPublicConfig,
  overrides: Partial<AuthClient> = {},
): AuthClient {
  return {
    signIn: vi.fn().mockResolvedValue({
      user: { id: '1', name: 'Test User', email: 'test@test.com' },
      session: { token: 'tok123' },
    }),
    signUp: vi.fn().mockResolvedValue({ user: { id: '2' }, session: null, requiresVerification: false }),
    signOut: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn().mockResolvedValue(null),
    forgotPassword: vi.fn().mockResolvedValue(undefined),
    resetPassword: vi.fn().mockResolvedValue(undefined),
    updateUser: vi.fn().mockResolvedValue({ id: '1', name: 'Updated', email: 'test@test.com' }),
    getConfig: vi.fn().mockResolvedValue(config),
    ...overrides,
  } as unknown as AuthClient;
}

function renderLogin(client: AuthClient) {
  return render(
    <AuthProvider authUrl="/api/auth" client={client}>
      <LoginForm />
    </AuthProvider>,
  );
}

describe('LoginForm — server-gated SSO button', () => {
  it('hides the SSO button when the server does not report features.sso', async () => {
    renderLogin(createMockClient({ features: { sso: false } }));

    // Email/password form is always present…
    await screen.findByLabelText('Email');
    // …but the SSO button must not render.
    expect(screen.queryByRole('button', SSO_BUTTON)).toBeNull();
  });

  it('hides the SSO button when features is absent entirely (older server)', async () => {
    renderLogin(createMockClient({}));

    await screen.findByLabelText('Email');
    expect(screen.queryByRole('button', SSO_BUTTON)).toBeNull();
  });

  it('shows the SSO button only when the server reports features.sso = true', async () => {
    renderLogin(createMockClient({ features: { sso: true } }));

    await waitFor(() => {
      expect(screen.getByRole('button', SSO_BUTTON)).toBeTruthy();
    });
  });

  it('keeps the button hidden when the config fetch fails (SSO is an enhancement)', async () => {
    renderLogin(
      createMockClient({}, { getConfig: vi.fn().mockRejectedValue(new Error('boom')) }),
    );

    await screen.findByLabelText('Email');
    expect(screen.queryByRole('button', SSO_BUTTON)).toBeNull();
  });
});
