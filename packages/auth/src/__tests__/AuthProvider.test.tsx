/**
 * Tests for AuthProvider, useAuth, and AuthGuard
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../AuthProvider';
import { useAuth } from '../useAuth';
import { AuthGuard } from '../AuthGuard';
import type { AuthClient } from '../types';

function createMockClient(overrides: Partial<AuthClient> = {}): AuthClient {
  return {
    signIn: vi.fn().mockResolvedValue({
      user: { id: '1', name: 'Test User', email: 'test@test.com' },
      session: { token: 'tok123' },
    }),
    signUp: vi.fn().mockResolvedValue({
      user: { id: '2', name: 'New User', email: 'new@test.com' },
      session: { token: 'tok456' },
    }),
    signOut: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn().mockResolvedValue(null),
    forgotPassword: vi.fn().mockResolvedValue(undefined),
    resetPassword: vi.fn().mockResolvedValue(undefined),
    updateUser: vi.fn().mockResolvedValue({ id: '1', name: 'Updated', email: 'test@test.com' }),
    ...overrides,
  };
}

function TestConsumer() {
  const { user, isAuthenticated, isLoading, error } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="user-name">{user?.name ?? 'none'}</span>
      <span data-testid="error">{error?.message ?? 'none'}</span>
    </div>
  );
}

describe('AuthProvider', () => {
  it('starts in loading state and resolves to unauthenticated when no session', async () => {
    const client = createMockClient();

    render(
      <AuthProvider authUrl="/api/auth" client={client}>
        <TestConsumer />
      </AuthProvider>,
    );

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(screen.getByTestId('user-name').textContent).toBe('none');
  });

  it('resolves to authenticated when session exists', async () => {
    const client = createMockClient({
      getSession: vi.fn().mockResolvedValue({
        user: { id: '1', name: 'Alice', email: 'alice@test.com' },
        session: { token: 'session-tok' },
      }),
    });

    render(
      <AuthProvider authUrl="/api/auth" client={client}>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('true');
    expect(screen.getByTestId('user-name').textContent).toBe('Alice');
  });

  it('sets error state when getSession fails', async () => {
    const client = createMockClient({
      getSession: vi.fn().mockRejectedValue(new Error('Session fetch failed')),
    });

    render(
      <AuthProvider authUrl="/api/auth" client={client}>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('error').textContent).toBe('Session fetch failed');
  });

  it('calls onAuthStateChange when auth state changes', async () => {
    const onAuthStateChange = vi.fn();
    const client = createMockClient();

    render(
      <AuthProvider authUrl="/api/auth" client={client} onAuthStateChange={onAuthStateChange}>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(onAuthStateChange).toHaveBeenCalled();
  });
});

describe('useAuth', () => {
  it('returns safe defaults when used outside AuthProvider', () => {
    function OutsideConsumer() {
      const auth = useAuth();
      return <span data-testid="outside">{String(auth.isAuthenticated)}</span>;
    }

    render(<OutsideConsumer />);
    expect(screen.getByTestId('outside').textContent).toBe('false');
  });

  it('signIn updates user state', async () => {
    const client = createMockClient();

    function SignInConsumer() {
      const { signIn, user, isAuthenticated } = useAuth();
      return (
        <div>
          <button onClick={() => signIn('test@test.com', 'pass')}>Sign In</button>
          <span data-testid="auth">{String(isAuthenticated)}</span>
          <span data-testid="name">{user?.name ?? 'none'}</span>
        </div>
      );
    }

    render(
      <AuthProvider authUrl="/api/auth" client={client}>
        <SignInConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth').textContent).toBe('false');
    });

    await act(async () => {
      await userEvent.click(screen.getByText('Sign In'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth').textContent).toBe('true');
    });
    expect(screen.getByTestId('name').textContent).toBe('Test User');
    expect(client.signIn).toHaveBeenCalledWith({ email: 'test@test.com', password: 'pass' });
  });

  it('signOut clears user state', async () => {
    const client = createMockClient({
      getSession: vi.fn().mockResolvedValue({
        user: { id: '1', name: 'Test', email: 'test@test.com' },
        session: { token: 'tok' },
      }),
    });

    function SignOutConsumer() {
      const { signOut, isAuthenticated } = useAuth();
      return (
        <div>
          <button onClick={() => signOut()}>Sign Out</button>
          <span data-testid="auth">{String(isAuthenticated)}</span>
        </div>
      );
    }

    render(
      <AuthProvider authUrl="/api/auth" client={client}>
        <SignOutConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth').textContent).toBe('true');
    });

    await act(async () => {
      await userEvent.click(screen.getByText('Sign Out'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth').textContent).toBe('false');
    });
  });
});

describe('AuthGuard', () => {
  it('shows loading fallback while loading', () => {
    const client = createMockClient({
      getSession: () => new Promise(() => {}), // Never resolves
    });

    render(
      <AuthProvider authUrl="/api/auth" client={client}>
        <AuthGuard loadingFallback={<span>Loading...</span>} fallback={<span>Not auth</span>}>
          <span>Protected</span>
        </AuthGuard>
      </AuthProvider>,
    );

    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('shows fallback when not authenticated', async () => {
    const client = createMockClient();

    render(
      <AuthProvider authUrl="/api/auth" client={client}>
        <AuthGuard fallback={<span>Not authenticated</span>}>
          <span>Protected content</span>
        </AuthGuard>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Not authenticated')).toBeTruthy();
    });
  });

  it('shows children when authenticated', async () => {
    const client = createMockClient({
      getSession: vi.fn().mockResolvedValue({
        user: { id: '1', name: 'Test', email: 'test@test.com' },
        session: { token: 'tok' },
      }),
    });

    render(
      <AuthProvider authUrl="/api/auth" client={client}>
        <AuthGuard fallback={<span>Not auth</span>}>
          <span>Protected content</span>
        </AuthGuard>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Protected content')).toBeTruthy();
    });
  });

  it('enforces role requirements', async () => {
    const client = createMockClient({
      getSession: vi.fn().mockResolvedValue({
        user: { id: '1', name: 'Test', email: 'test@test.com', role: 'member' },
        session: { token: 'tok' },
      }),
    });

    render(
      <AuthProvider authUrl="/api/auth" client={client}>
        <AuthGuard requiredRoles={['admin']} fallback={<span>Access denied</span>}>
          <span>Admin content</span>
        </AuthGuard>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Access denied')).toBeTruthy();
    });
  });

  it('allows access when user has required role', async () => {
    const client = createMockClient({
      getSession: vi.fn().mockResolvedValue({
        user: { id: '1', name: 'Admin', email: 'admin@test.com', role: 'admin' },
        session: { token: 'tok' },
      }),
    });

    render(
      <AuthProvider authUrl="/api/auth" client={client}>
        <AuthGuard requiredRoles={['admin']} fallback={<span>Access denied</span>}>
          <span>Admin content</span>
        </AuthGuard>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Admin content')).toBeTruthy();
    });
  });

  it('allows access when user has one of the required roles', async () => {
    const client = createMockClient({
      getSession: vi.fn().mockResolvedValue({
        user: { id: '1', name: 'Manager', email: 'mgr@test.com', roles: ['manager', 'viewer'] },
        session: { token: 'tok' },
      }),
    });

    render(
      <AuthProvider authUrl="/api/auth" client={client}>
        <AuthGuard requiredRoles={['admin', 'manager']} fallback={<span>Access denied</span>}>
          <span>Manager content</span>
        </AuthGuard>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Manager content')).toBeTruthy();
    });
  });
});
