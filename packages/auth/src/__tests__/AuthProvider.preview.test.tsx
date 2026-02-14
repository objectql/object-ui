/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../AuthProvider';
import { useAuth } from '../useAuth';

// Test component to access auth context
function AuthTestComponent() {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="is-authenticated">{String(auth.isAuthenticated)}</div>
      <div data-testid="is-loading">{String(auth.isLoading)}</div>
      <div data-testid="is-preview-mode">{String(auth.isPreviewMode)}</div>
      <div data-testid="user-id">{auth.user?.id || 'null'}</div>
      <div data-testid="user-name">{auth.user?.name || 'null'}</div>
      <div data-testid="user-role">{auth.user?.role || 'null'}</div>
      <div data-testid="banner-message">{auth.previewMode?.bannerMessage || 'null'}</div>
    </div>
  );
}

describe('AuthProvider with preview mode', () => {
  it('should auto-authenticate with simulated admin user when previewMode is provided', async () => {
    render(
      <AuthProvider authUrl="/api/auth" previewMode={{ simulatedRole: 'admin' }}>
        <AuthTestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
    expect(screen.getByTestId('is-preview-mode').textContent).toBe('true');
    expect(screen.getByTestId('user-id').textContent).toBe('preview-user');
    expect(screen.getByTestId('user-name').textContent).toBe('Preview User');
    expect(screen.getByTestId('user-role').textContent).toBe('admin');
  });

  it('should use custom simulated user name and role', async () => {
    render(
      <AuthProvider
        authUrl="/api/auth"
        previewMode={{
          simulatedRole: 'viewer',
          simulatedUserName: 'Demo Viewer',
          bannerMessage: 'This is a demo.',
        }}
      >
        <AuthTestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
    expect(screen.getByTestId('is-preview-mode').textContent).toBe('true');
    expect(screen.getByTestId('user-name').textContent).toBe('Demo Viewer');
    expect(screen.getByTestId('user-role').textContent).toBe('viewer');
    expect(screen.getByTestId('banner-message').textContent).toBe('This is a demo.');
  });

  it('should not be in preview mode when previewMode is not provided', async () => {
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

    await waitFor(() => {
      expect(screen.getByTestId('is-loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('is-preview-mode').textContent).toBe('false');
    expect(screen.getByTestId('banner-message').textContent).toBe('null');
  });

  it('should apply default values for preview mode config', async () => {
    render(
      <AuthProvider authUrl="/api/auth" previewMode={{}}>
        <AuthTestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('is-preview-mode').textContent).toBe('true');
    expect(screen.getByTestId('user-name').textContent).toBe('Preview User');
    expect(screen.getByTestId('user-role').textContent).toBe('admin');
  });
});
