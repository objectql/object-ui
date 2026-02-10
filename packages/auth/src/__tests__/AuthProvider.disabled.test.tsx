/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../AuthProvider';
import { useAuth } from '../useAuth';
import { useContext } from 'react';
import { AuthCtx } from '../AuthContext';

// Test component to access auth context
function AuthTestComponent() {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="is-authenticated">{String(auth.isAuthenticated)}</div>
      <div data-testid="is-loading">{String(auth.isLoading)}</div>
      <div data-testid="user-id">{auth.user?.id || 'null'}</div>
      <div data-testid="user-name">{auth.user?.name || 'null'}</div>
    </div>
  );
}

describe('AuthProvider with enabled prop', () => {
  it('should bypass authentication when enabled=false', async () => {
    render(
      <AuthProvider authUrl="/api/auth" enabled={false}>
        <AuthTestComponent />
      </AuthProvider>
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('is-loading').textContent).toBe('false');
    });

    // Should be authenticated with guest user
    expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
    expect(screen.getByTestId('user-id').textContent).toBe('guest');
    expect(screen.getByTestId('user-name').textContent).toBe('Guest User');
  });

  it('should use normal auth flow when enabled=true (default)', async () => {
    // Mock client that returns null session
    const mockClient = {
      getSession: async () => null,
      signIn: async () => ({ user: { id: '1', name: 'Test', email: 'test@example.com' }, session: { token: 'token' } }),
      signUp: async () => ({ user: { id: '1', name: 'Test', email: 'test@example.com' }, session: { token: 'token' } }),
      signOut: async () => {},
      updateUser: async () => ({ id: '1', name: 'Test', email: 'test@example.com' }),
      forgotPassword: async () => {},
      resetPassword: async () => {},
    };

    render(
      <AuthProvider authUrl="/api/auth" client={mockClient}>
        <AuthTestComponent />
      </AuthProvider>
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('is-loading').textContent).toBe('false');
    });

    // Should NOT be authenticated (no session)
    expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
    expect(screen.getByTestId('user-id').textContent).toBe('null');
  });

  it('should create a guest session with token when auth is disabled', async () => {
    function SessionTestComponent() {
      const context = useContext(AuthCtx);
      return (
        <div>
          <div data-testid="session-token">{context?.session?.token || 'null'}</div>
          <div data-testid="has-expiry">{String(!!context?.session?.expiresAt)}</div>
        </div>
      );
    }

    render(
      <AuthProvider authUrl="/api/auth" enabled={false}>
        <SessionTestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('session-token').textContent).toBe('guest-token');
    });

    expect(screen.getByTestId('has-expiry').textContent).toBe('true');
  });
});
