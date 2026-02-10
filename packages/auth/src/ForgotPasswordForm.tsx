/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { useAuth } from './useAuth';

export interface ForgotPasswordFormProps {
  /** Callback on successful submission */
  onSuccess?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Link to login page */
  loginUrl?: string;
  /** Custom title */
  title?: string;
  /** Custom description */
  description?: string;
}

/**
 * Forgot password form component.
 * Sends a password reset email to the user.
 *
 * @example
 * ```tsx
 * <ForgotPasswordForm
 *   onSuccess={() => setShowSuccess(true)}
 *   loginUrl="/login"
 * />
 * ```
 */
export function ForgotPasswordForm({
  onSuccess,
  onError,
  loginUrl = '/login',
  title = 'Reset your password',
  description = 'Enter your email address and we\'ll send you a link to reset your password',
}: ForgotPasswordFormProps) {
  const { forgotPassword, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await forgotPassword(email);
      setSubmitted(true);
      onSuccess?.();
    } catch (err) {
      const authError = err instanceof Error ? err : new Error(String(err));
      setError(authError.message);
      onError?.(authError);
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            We&apos;ve sent a password reset link to <strong>{email}</strong>.
            Please check your inbox and follow the instructions.
          </p>
        </div>
        {loginUrl && (
          <p className="px-8 text-center text-sm text-muted-foreground">
            <a href={loginUrl} className="text-primary underline-offset-4 hover:underline">
              Back to sign in
            </a>
          </p>
        )}
      </div>
    );
  }

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
          <label htmlFor="forgot-email" className="text-sm font-medium leading-none">
            Email
          </label>
          <input
            id="forgot-email"
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

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          {isLoading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      {loginUrl && (
        <p className="px-8 text-center text-sm text-muted-foreground">
          Remember your password?{' '}
          <a href={loginUrl} className="text-primary underline-offset-4 hover:underline">
            Sign in
          </a>
        </p>
      )}
    </div>
  );
}
