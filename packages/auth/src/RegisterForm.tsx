/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { useAuth } from './useAuth';

export interface RegisterFormProps {
  /** Callback on successful registration */
  onSuccess?: () => void;
  /** Callback on registration error */
  onError?: (error: Error) => void;
  /** Link to login page */
  loginUrl?: string;
  /** Custom title */
  title?: string;
  /** Custom description */
  description?: string;
}

/**
 * Registration form component with name, email, and password fields.
 * Uses Tailwind CSS utility classes for styling.
 *
 * @example
 * ```tsx
 * <RegisterForm
 *   onSuccess={() => navigate('/dashboard')}
 *   loginUrl="/login"
 * />
 * ```
 */
export function RegisterForm({
  onSuccess,
  onError,
  loginUrl = '/login',
  title = 'Create an account',
  description = 'Enter your information to get started',
}: RegisterFormProps) {
  const { signUp, isLoading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    try {
      await signUp(name, email, password);
      onSuccess?.();
    } catch (err) {
      const authError = err instanceof Error ? err : new Error(String(err));
      setError(authError.message);
      onError?.(authError);
    }
  };

  return (
    <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
      <div className="flex flex-col space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive" role="alert">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="register-name" className="text-sm font-medium leading-none">
            Name
          </label>
          <input
            id="register-name"
            type="text"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            disabled={isLoading}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="register-email" className="text-sm font-medium leading-none">
            Email
          </label>
          <input
            id="register-email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={isLoading}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="register-password" className="text-sm font-medium leading-none">
            Password
          </label>
          <input
            id="register-password"
            type="password"
            placeholder="Create a password (min. 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            disabled={isLoading}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="register-confirm-password" className="text-sm font-medium leading-none">
            Confirm Password
          </label>
          <input
            id="register-confirm-password"
            type="password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            disabled={isLoading}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          {isLoading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      {loginUrl && (
        <p className="px-8 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <a href={loginUrl} className="text-primary underline-offset-4 hover:underline">
            Sign in
          </a>
        </p>
      )}
    </div>
  );
}
