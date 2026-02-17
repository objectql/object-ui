/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthCtx, type AuthContextValue } from '../AuthContext';
import { LoginForm } from '../LoginForm';

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

function renderWithAuth(ui: React.ReactElement, authOverrides: Partial<AuthContextValue> = {}) {
  const ctx = createAuthContext(authOverrides);
  return {
    ctx,
    ...render(<AuthCtx.Provider value={ctx}>{ui}</AuthCtx.Provider>),
  };
}

describe('LoginForm', () => {
  it('renders with default title and description', () => {
    renderWithAuth(<LoginForm />);
    expect(screen.getByText('Sign in to your account')).toBeTruthy();
    expect(screen.getByText('Enter your email and password to continue')).toBeTruthy();
  });

  it('renders with custom title and description', () => {
    renderWithAuth(<LoginForm title="Custom Login" description="Custom desc" />);
    expect(screen.getByText('Custom Login')).toBeTruthy();
    expect(screen.getByText('Custom desc')).toBeTruthy();
  });

  it('renders email and password fields', () => {
    renderWithAuth(<LoginForm />);
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
  });

  it('renders sign in button', () => {
    renderWithAuth(<LoginForm />);
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeTruthy();
  });

  it('shows loading state', () => {
    renderWithAuth(<LoginForm />, { isLoading: true });
    expect(screen.getByRole('button', { name: 'Signing in...' })).toBeTruthy();
  });

  it('renders registration and forgot password links', () => {
    renderWithAuth(<LoginForm registerUrl="/register" forgotPasswordUrl="/forgot" />);
    expect(screen.getByText('Sign up')).toBeTruthy();
    expect(screen.getByText('Forgot password?')).toBeTruthy();
  });

  it('calls signIn on form submission', async () => {
    const onSuccess = vi.fn();
    const { ctx } = renderWithAuth(<LoginForm onSuccess={onSuccess} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(ctx.signIn).toHaveBeenCalledWith('test@example.com', 'password123');
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('shows error on failed sign in', async () => {
    const onError = vi.fn();
    const signIn = vi.fn().mockRejectedValue(new Error('Invalid credentials'));
    renderWithAuth(<LoginForm onError={onError} />, { signIn });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText('Invalid credentials')).toBeTruthy();
    });
    expect(onError).toHaveBeenCalled();
  });

  it('handles non-Error rejection', async () => {
    const signIn = vi.fn().mockRejectedValue('string error');
    renderWithAuth(<LoginForm />, { signIn });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });
});
