/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthCtx, type AuthContextValue } from '../AuthContext';
import { RegisterForm } from '../RegisterForm';

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

describe('RegisterForm', () => {
  it('renders with default title', () => {
    renderWithAuth(<RegisterForm />);
    expect(screen.getByText('Create an account')).toBeTruthy();
  });

  it('renders all form fields', () => {
    renderWithAuth(<RegisterForm />);
    expect(screen.getByLabelText('Name')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.getByLabelText('Confirm Password')).toBeTruthy();
  });

  it('shows loading state', () => {
    renderWithAuth(<RegisterForm />, { isLoading: true });
    expect(screen.getByRole('button', { name: 'Creating account...' })).toBeTruthy();
  });

  it('shows login link', () => {
    renderWithAuth(<RegisterForm loginUrl="/login" />);
    expect(screen.getByText('Sign in')).toBeTruthy();
  });

  it('shows error when passwords do not match', async () => {
    renderWithAuth(<RegisterForm />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Name'), 'John');
    await user.type(screen.getByLabelText('Email'), 'john@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.type(screen.getByLabelText('Confirm Password'), 'different');
    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeTruthy();
    });
  });

  it('shows error when password is too short', async () => {
    renderWithAuth(<RegisterForm />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Name'), 'John');
    await user.type(screen.getByLabelText('Email'), 'john@example.com');
    // Type passwords that match but are under 8 chars
    // Use fireEvent to bypass native minLength validation
    const pwField = screen.getByLabelText('Password');
    const confirmField = screen.getByLabelText('Confirm Password');
    fireEvent.change(pwField, { target: { value: 'short' } });
    fireEvent.change(confirmField, { target: { value: 'short' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Create Account' }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeTruthy();
    });
  });

  it('calls signUp on valid submission', async () => {
    const onSuccess = vi.fn();
    const { ctx } = renderWithAuth(<RegisterForm onSuccess={onSuccess} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Name'), 'John Doe');
    await user.type(screen.getByLabelText('Email'), 'john@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.type(screen.getByLabelText('Confirm Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(ctx.signUp).toHaveBeenCalledWith('John Doe', 'john@example.com', 'password123');
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('shows error on signUp failure', async () => {
    const onError = vi.fn();
    const signUp = vi.fn().mockRejectedValue(new Error('Email taken'));
    renderWithAuth(<RegisterForm onError={onError} />, { signUp });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Name'), 'John');
    await user.type(screen.getByLabelText('Email'), 'john@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.type(screen.getByLabelText('Confirm Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(screen.getByText('Email taken')).toBeTruthy();
    });
    expect(onError).toHaveBeenCalled();
  });
});
