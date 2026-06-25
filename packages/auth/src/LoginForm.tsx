/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { SocialSignInButtons } from './SocialSignInButtons';
import type { AuthLinkComponentProps } from './types';
import {
  AUTH_FIELD_LABEL_CLASS,
  AUTH_INPUT_CLASS,
  AUTH_LINK_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  AuthDivider,
  AuthErrorBanner,
  AuthFormHeader,
  AuthSpinner,
} from './authStyles';

/** Translatable labels for the LoginForm */
export interface LoginFormLabels {
  emailLabel?: string;
  emailPlaceholder?: string;
  passwordLabel?: string;
  passwordPlaceholder?: string;
  forgotPasswordText?: string;
  submitButton?: string;
  submittingButton?: string;
  noAccountText?: string;
  signUpText?: string;
  /** Divider label between social sign-in and email/password (defaults to "or") */
  orText?: string;
  /** Label for the SSO sign-in button (defaults to "Sign in with SSO") */
  ssoButton?: string;
}

export interface LoginFormProps {
  /** Callback on successful login */
  onSuccess?: () => void;
  /** Callback on login error */
  onError?: (error: Error) => void;
  /** Link to registration page */
  registerUrl?: string;
  /** Link to forgot password page */
  forgotPasswordUrl?: string;
  /** Custom title */
  title?: string;
  /** Custom description */
  description?: string;
  /** Custom icon shown above the title (defaults to a small lock disc) */
  icon?: React.ReactNode;
  /** Custom link component for SPA navigation (e.g. React Router's Link) */
  linkComponent?: React.ComponentType<AuthLinkComponentProps>;
  /** Override default labels for i18n */
  labels?: LoginFormLabels;
  /**
   * Map of better-auth error `code` → localized message. When a sign-in error
   * carries a known code (e.g. `INVALID_EMAIL_OR_PASSWORD`), the mapped string
   * is shown instead of the raw English server message. Unknown codes fall
   * back to the server message.
   */
  errorMessages?: Record<string, string>;
  /** Hide the icon disc above the form title. Defaults to false. */
  hideIcon?: boolean;
}

const DefaultLink = ({ href, className, children }: AuthLinkComponentProps) => (
  <a href={href} className={className}>{children}</a>
);

const DefaultLockIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-6 w-6"
    aria-hidden="true"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

/**
 * Login form component with email/password authentication.
 * Uses Tailwind CSS utility classes for styling. Drop inside an `AuthShell`
 * for a polished split-screen experience.
 *
 * @example
 * ```tsx
 * <LoginForm
 *   onSuccess={() => navigate('/dashboard')}
 *   registerUrl="/register"
 *   forgotPasswordUrl="/forgot-password"
 * />
 * ```
 */
export function LoginForm({
  onSuccess,
  onError,
  registerUrl = '/register',
  forgotPasswordUrl = '/forgot-password',
  title = 'Sign in to your account',
  description = 'Enter your email and password to continue',
  icon,
  hideIcon = false,
  linkComponent: LinkComp = DefaultLink,
  labels = {},
  errorMessages,
}: LoginFormProps) {
  const { signIn, isLoading, getAuthConfig } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasSocialProviders, setHasSocialProviders] = useState(false);
  // Enterprise SSO is opt-in server-side (`@better-auth/sso`). Mirror the
  // social-provider pattern below: ask the server whether SSO is wired and
  // only render the "Sign in with SSO" button when it is. Defaults to hidden,
  // so a server that doesn't report `features.sso` (or a failed config fetch)
  // never shows a button whose `/sign-in/sso` route 404s at click time.
  const [ssoEnabled, setSsoEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => getAuthConfig())
      .then((config) => {
        if (!cancelled) setSsoEnabled(config?.features?.sso === true);
      })
      .catch(() => {
        // SSO is an enhancement, not required — leave the button hidden.
      });
    return () => {
      cancelled = true;
    };
  }, [getAuthConfig]);

  const l = {
    emailLabel: labels.emailLabel ?? 'Email',
    emailPlaceholder: labels.emailPlaceholder ?? 'name@example.com',
    passwordLabel: labels.passwordLabel ?? 'Password',
    passwordPlaceholder: labels.passwordPlaceholder ?? 'Enter your password',
    forgotPasswordText: labels.forgotPasswordText ?? 'Forgot password?',
    submitButton: labels.submitButton ?? 'Sign In',
    submittingButton: labels.submittingButton ?? 'Signing in…',
    noAccountText: labels.noAccountText ?? "Don't have an account?",
    signUpText: labels.signUpText ?? 'Sign up',
    orText: labels.orText ?? 'or',
    ssoButton: labels.ssoButton ?? 'Sign in with SSO',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await signIn(email, password);
      onSuccess?.();
    } catch (err) {
      const authError = err instanceof Error ? err : new Error(String(err));
      const code = (authError as Error & { code?: string }).code;
      setError((code && errorMessages?.[code]) || authError.message);
      onError?.(authError);
    }
  };

  /**
   * Federated SSO sign-in: routes the entered email to its configured IdP
   * (better-auth `@better-auth/sso`, by email domain) and redirects the
   * browser to the provider's authorization endpoint. Falls back to an inline
   * error when no provider matches the domain.
   */
  const handleSso = async () => {
    setError(null);
    try {
      const base = window.location.pathname.replace(/\/login(?:\/.*)?$/, '');
      const res = await fetch('/api/v1/auth/sign-in/sso', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, callbackURL: base + '/home' }),
        credentials: 'include',
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
      if (res.ok && typeof data.url === 'string') {
        window.location.href = data.url;
        return;
      }
      setError(data.message || 'No SSO provider is configured for this email domain.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="mx-auto flex w-full flex-col justify-center space-y-7 sm:w-[400px]">
      <AuthFormHeader
        icon={hideIcon ? undefined : (icon ?? <DefaultLockIcon />)}
        title={title}
        description={description}
      />

      <div className="space-y-5">
        <SocialSignInButtons mode="sign-in" onProvidersResolved={(hasProviders) => setHasSocialProviders(hasProviders)} />

        <form onSubmit={handleSubmit} className="space-y-4">
          {hasSocialProviders && <AuthDivider label={l.orText} />}

          {error && <AuthErrorBanner message={error} />}

          <div className="space-y-2">
            <label htmlFor="login-email" className={AUTH_FIELD_LABEL_CLASS}>
              {l.emailLabel}
            </label>
            <input
              id="login-email"
              type="email"
              placeholder={l.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={isLoading}
              className={AUTH_INPUT_CLASS}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className={AUTH_FIELD_LABEL_CLASS}>
                {l.passwordLabel}
              </label>
              {forgotPasswordUrl && (
                <LinkComp
                  href={forgotPasswordUrl}
                  className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
                >
                  {l.forgotPasswordText}
                </LinkComp>
              )}
            </div>
            <input
              id="login-password"
              type="password"
              placeholder={l.passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={isLoading}
              className={AUTH_INPUT_CLASS}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={AUTH_PRIMARY_BUTTON_CLASS}
          >
            {isLoading && <AuthSpinner />}
            {isLoading ? l.submittingButton : l.submitButton}
          </button>

          {ssoEnabled && (
            <button
              type="button"
              onClick={handleSso}
              disabled={isLoading}
              className="flex w-full items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
            >
              {l.ssoButton}
            </button>
          )}
        </form>
      </div>

      {registerUrl && (
        <p className="px-8 text-center text-sm text-muted-foreground">
          {l.noAccountText}{' '}
          <LinkComp href={registerUrl} className={AUTH_LINK_CLASS}>
            {l.signUpText}
          </LinkComp>
        </p>
      )}
    </div>
  );
}
