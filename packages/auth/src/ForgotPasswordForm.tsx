/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { useAuth } from './useAuth';
import type { AuthLinkComponentProps } from './types';

/** Translatable labels for the ForgotPasswordForm */
export interface ForgotPasswordFormLabels {
  emailLabel?: string;
  emailPlaceholder?: string;
  submitButton?: string;
  submittingButton?: string;
  successTitle?: string;
  successDescription?: string;
  backToSignInText?: string;
  rememberPasswordText?: string;
  signInText?: string;
}

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
  /** Custom link component for SPA navigation (e.g. React Router's Link) */
  linkComponent?: React.ComponentType<AuthLinkComponentProps>;
  /** Override default labels for i18n */
  labels?: ForgotPasswordFormLabels;
}

const DefaultLink = ({ href, className, children }: AuthLinkComponentProps) => (
  <a href={href} className={className}>{children}</a>
);

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
  linkComponent: LinkComp = DefaultLink,
  labels = {},
}: ForgotPasswordFormProps) {
  const { forgotPassword, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const l = {
    emailLabel: labels.emailLabel ?? 'Email',
    emailPlaceholder: labels.emailPlaceholder ?? 'name@example.com',
    submitButton: labels.submitButton ?? 'Send Reset Link',
    submittingButton: labels.submittingButton ?? 'Sending...',
    successTitle: labels.successTitle ?? 'Check your email',
    successDescription: labels.successDescription ?? "We've sent a password reset link to {{email}}. Please check your inbox.",
    backToSignInText: labels.backToSignInText ?? 'Back to sign in',
    rememberPasswordText: labels.rememberPasswordText ?? 'Remember your password?',
    signInText: labels.signInText ?? 'Sign in',
  };

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
    const successMsg = l.successDescription.includes('{{email}}')
      ? l.successDescription.replace('{{email}}', email)
      : `${l.successDescription} ${email}`;
    return (
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[380px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{l.successTitle}</h1>
          <p className="text-sm text-muted-foreground">{successMsg}</p>
        </div>
        {loginUrl && (
          <p className="px-8 text-center text-sm text-muted-foreground">
            <LinkComp href={loginUrl} className="text-primary underline-offset-4 hover:underline">
              {l.backToSignInText}
            </LinkComp>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[380px]">
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
            {l.emailLabel}
          </label>
          <input
            id="forgot-email"
            type="email"
            placeholder={l.emailPlaceholder}
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
          {isLoading ? l.submittingButton : l.submitButton}
        </button>
      </form>

      {loginUrl && (
        <p className="px-8 text-center text-sm text-muted-foreground">
          {l.rememberPasswordText}{' '}
          <LinkComp href={loginUrl} className="text-primary underline-offset-4 hover:underline">
            {l.signInText}
          </LinkComp>
        </p>
      )}
    </div>
  );
}
