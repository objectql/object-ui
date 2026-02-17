/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthCtx, type AuthContextValue } from '../AuthContext';
import { ForgotPasswordForm } from '../ForgotPasswordForm';

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

describe('ForgotPasswordForm', () => {
  it('renders with default title', () => {
    renderWithAuth(<ForgotPasswordForm />);
    expect(screen.getByText('Reset your password')).toBeTruthy();
  });

  it('renders email field', () => {
    renderWithAuth(<ForgotPasswordForm />);
    expect(screen.getByLabelText('Email')).toBeTruthy();
  });

  it('shows loading state', () => {
    renderWithAuth(<ForgotPasswordForm />, { isLoading: true });
    expect(screen.getByRole('button', { name: 'Sending...' })).toBeTruthy();
  });

  it('shows login link', () => {
    renderWithAuth(<ForgotPasswordForm loginUrl="/login" />);
    expect(screen.getByText('Sign in')).toBeTruthy();
  });

  it('shows success message after submission', async () => {
    const onSuccess = vi.fn();
    const { ctx } = renderWithAuth(<ForgotPasswordForm onSuccess={onSuccess} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    await waitFor(() => {
      expect(ctx.forgotPassword).toHaveBeenCalledWith('test@example.com');
      expect(screen.getByText('Check your email')).toBeTruthy();
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('shows error on failure', async () => {
    const onError = vi.fn();
    const forgotPassword = vi.fn().mockRejectedValue(new Error('User not found'));
    renderWithAuth(<ForgotPasswordForm onError={onError} />, { forgotPassword });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    await waitFor(() => {
      expect(screen.getByText('User not found')).toBeTruthy();
    });
    expect(onError).toHaveBeenCalled();
  });
});
