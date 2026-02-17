/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthCtx, type AuthContextValue } from '../AuthContext';
import { UserMenu } from '../UserMenu';

function createAuthContext(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    session: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    isPreviewMode: false,
    previewMode: null,
    signIn: vi.fn().mockResolvedValue(undefined),
    signUp: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    updateUser: vi.fn().mockResolvedValue(undefined),
    forgotPassword: vi.fn().mockResolvedValue(undefined),
    resetPassword: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('UserMenu', () => {
  it('renders nothing when not authenticated', () => {
    const ctx = createAuthContext();
    const { container } = render(
      <AuthCtx.Provider value={ctx}>
        <UserMenu />
      </AuthCtx.Provider>,
    );
    expect(container.children).toHaveLength(0);
  });

  it('renders user info when authenticated', () => {
    const ctx = createAuthContext({
      isAuthenticated: true,
      user: { id: '1', name: 'John Doe', email: 'john@example.com' },
    });
    render(
      <AuthCtx.Provider value={ctx}>
        <UserMenu />
      </AuthCtx.Provider>,
    );
    expect(screen.getByText('John Doe')).toBeTruthy();
    expect(screen.getByText('john@example.com')).toBeTruthy();
  });

  it('shows user initials when no avatar', () => {
    const ctx = createAuthContext({
      isAuthenticated: true,
      user: { id: '1', name: 'John Doe', email: 'john@example.com' },
    });
    render(
      <AuthCtx.Provider value={ctx}>
        <UserMenu />
      </AuthCtx.Provider>,
    );
    expect(screen.getByText('JD')).toBeTruthy();
  });

  it('shows avatar image when provided', () => {
    const ctx = createAuthContext({
      isAuthenticated: true,
      user: { id: '1', name: 'John Doe', email: 'john@example.com', image: '/avatar.jpg' },
    });
    render(
      <AuthCtx.Provider value={ctx}>
        <UserMenu />
      </AuthCtx.Provider>,
    );
    expect(screen.getByAltText('John Doe')).toBeTruthy();
  });

  it('uses custom avatarUrl over user image', () => {
    const ctx = createAuthContext({
      isAuthenticated: true,
      user: { id: '1', name: 'John', email: 'john@example.com', image: '/user.jpg' },
    });
    render(
      <AuthCtx.Provider value={ctx}>
        <UserMenu avatarUrl="/custom.jpg" />
      </AuthCtx.Provider>,
    );
    const img = screen.getByAltText('John') as HTMLImageElement;
    expect(img.src).toContain('custom.jpg');
  });

  it('renders profile and settings buttons', () => {
    const onProfile = vi.fn();
    const onSettings = vi.fn();
    const ctx = createAuthContext({
      isAuthenticated: true,
      user: { id: '1', name: 'Jane', email: 'jane@example.com' },
    });
    render(
      <AuthCtx.Provider value={ctx}>
        <UserMenu onProfile={onProfile} onSettings={onSettings} />
      </AuthCtx.Provider>,
    );
    const profileBtn = screen.getByLabelText('Profile');
    const settingsBtn = screen.getByLabelText('Settings');
    expect(profileBtn).toBeTruthy();
    expect(settingsBtn).toBeTruthy();

    fireEvent.click(profileBtn);
    expect(onProfile).toHaveBeenCalled();

    fireEvent.click(settingsBtn);
    expect(onSettings).toHaveBeenCalled();
  });

  it('calls signOut when sign out button is clicked', () => {
    const ctx = createAuthContext({
      isAuthenticated: true,
      user: { id: '1', name: 'Jane', email: 'jane@example.com' },
    });
    render(
      <AuthCtx.Provider value={ctx}>
        <UserMenu />
      </AuthCtx.Provider>,
    );
    const signOutBtn = screen.getByLabelText('Sign out');
    fireEvent.click(signOutBtn);
    expect(ctx.signOut).toHaveBeenCalled();
  });
});
