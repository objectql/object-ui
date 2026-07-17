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
import { looksLikePhoneIdentifier, normalizePhoneIdentifier } from './phone-identifier';
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
  /** Identifier label when phone+password is enabled (defaults to "Email or phone number"). */
  emailOrPhoneLabel?: string;
  /** Identifier placeholder when phone+password is enabled. */
  emailOrPhonePlaceholder?: string;
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
  /**
   * Break-glass link shown under the federated button when SSO-only
   * ("enforced") mode hides the password form (defaults to "Use a password
   * instead"). Reveals the email/password form for the env owner / local admin.
   */
  usePasswordText?: string;
  /** Link to collapse the revealed break-glass form back to SSO-only (defaults to "Back to single sign-on"). */
  backToSsoText?: string;
  /** Phone-OTP mode (framework#2780) — phone field label (defaults to "Phone number"). */
  phoneLabel?: string;
  /** Phone-OTP mode — phone field placeholder (defaults to "+1 555 000 0000"). */
  phonePlaceholder?: string;
  /** Phone-OTP mode — code field label (defaults to "Verification code"). */
  otpCodeLabel?: string;
  /** Phone-OTP mode — code field placeholder (defaults to "6-digit code"). */
  otpCodePlaceholder?: string;
  /** Phone-OTP mode — "send code" button (defaults to "Get code"). */
  sendOtpButton?: string;
  /** Phone-OTP mode — resend countdown, `{seconds}` hole (defaults to "Resend in {seconds}s"). */
  resendOtpCountdownText?: string;
  /** Link that switches to phone-OTP sign-in (defaults to "Sign in with verification code"). */
  usePhoneOtpText?: string;
  /** Link that switches back to password sign-in (defaults to "Sign in with password instead"). */
  usePasswordSignInText?: string;
  /** Description shown above the form in SSO-only mode (defaults to "Sign in with your organization's single sign-on"). */
  ssoOnlyDescription?: string;
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
  const { signIn, isLoading, getAuthConfig, sendPhoneOtp, signInWithPhoneOtp, signInWithPhonePassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Phone-OTP sign-in (framework#2780). Only offered when the server reports
  // `features.phoneNumberOtp` — i.e. the phoneNumber plugin is on AND a
  // deliverable SMS service is wired — so the mode never renders as a dead
  // entry point whose code can never arrive.
  const [phoneOtpEnabled, setPhoneOtpEnabled] = useState(false);
  // Phone + password sign-in (framework#2780). Offered when the server reports
  // `features.phoneNumber` — the phoneNumber plugin is on. Unlike OTP this needs
  // no SMS service, so it's gated on the coarser flag: the password-mode
  // identifier field then accepts an email OR a phone number.
  const [phonePasswordEnabled, setPhonePasswordEnabled] = useState(false);
  const [mode, setMode] = useState<'password' | 'phone-otp'>('password');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  // Seconds until another code may be requested — mirrors the server's
  // per-number cooldown so the button doesn't invite guaranteed 429s.
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [hasSocialProviders, setHasSocialProviders] = useState(false);
  // Enterprise SSO is opt-in server-side (`@better-auth/sso`). Mirror the
  // social-provider pattern below: ask the server whether SSO is wired and
  // only render the "Sign in with SSO" button when it is. Defaults to hidden,
  // so a server that doesn't report `features.sso` (or a failed config fetch)
  // never shows a button whose `/sign-in/sso` route 404s at click time.
  const [ssoEnabled, setSsoEnabled] = useState(false);
  // SSO-only ("enforced") mode: the server locks the team login to the IdP.
  // Hide the local password form + sign-up; show the federated button(s) plus
  // an understated break-glass link. `emailPassword.enabled === false` is a
  // belt-and-suspenders fallback for older servers that signal the lock that
  // way. Defaults to false (a failed config fetch never hides the form).
  const [ssoEnforced, setSsoEnforced] = useState(false);
  // Break-glass: reveal the password form for the env owner / local admin even
  // under enforced mode (e.g. during an IdP outage).
  const [showPasswordFallback, setShowPasswordFallback] = useState(false);
  // In-flight `/sign-in/sso` round-trip — the button needs its own pending
  // state because SSO routing is a raw fetch, not the shared `signIn` (whose
  // `isLoading` drives the password submit button).
  const [ssoSubmitting, setSsoSubmitting] = useState(false);
  // Config not resolved yet: render a spinner INSTEAD of the password-form
  // defaults. Painting the defaults first showed an SSO-only deployment a
  // password wall (no SSO button, no enforced collapse) whenever the config
  // fetch was slow/failed on first load — and platform-SSO JIT users have no
  // password at all (#2625). A FAILED fetch (after the client's retries)
  // still falls back to the password form: break-glass beats lock-out.
  const [configPending, setConfigPending] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => getAuthConfig())
      .then((config) => {
        if (cancelled) return;
        setSsoEnabled(config?.features?.sso === true);
        setPhoneOtpEnabled(config?.features?.phoneNumberOtp === true);
        setPhonePasswordEnabled(config?.features?.phoneNumber === true);
        setSsoEnforced(
          config?.features?.ssoEnforced === true ||
            config?.emailPassword?.enabled === false,
        );
      })
      .catch(() => {
        // SSO is an enhancement, not required — leave the buttons/form hidden
        // or shown at their safe defaults.
      })
      .finally(() => {
        if (!cancelled) setConfigPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [getAuthConfig]);

  // Under enforced mode the password form is collapsed until the user opts into
  // the break-glass path; otherwise it's always shown.
  const passwordFormVisible = !ssoEnforced || showPasswordFallback;

  const l = {
    emailLabel: labels.emailLabel ?? 'Email',
    emailPlaceholder: labels.emailPlaceholder ?? 'name@example.com',
    emailOrPhoneLabel: labels.emailOrPhoneLabel ?? 'Email or phone number',
    emailOrPhonePlaceholder: labels.emailOrPhonePlaceholder ?? 'name@example.com or +1 555 000 0000',
    passwordLabel: labels.passwordLabel ?? 'Password',
    passwordPlaceholder: labels.passwordPlaceholder ?? 'Enter your password',
    forgotPasswordText: labels.forgotPasswordText ?? 'Forgot password?',
    submitButton: labels.submitButton ?? 'Sign In',
    submittingButton: labels.submittingButton ?? 'Signing in…',
    noAccountText: labels.noAccountText ?? "Don't have an account?",
    signUpText: labels.signUpText ?? 'Sign up',
    orText: labels.orText ?? 'or',
    ssoButton: labels.ssoButton ?? 'Sign in with SSO',
    usePasswordText: labels.usePasswordText ?? 'Use a password instead',
    backToSsoText: labels.backToSsoText ?? 'Back to single sign-on',
    ssoOnlyDescription:
      labels.ssoOnlyDescription ?? "Sign in with your organization's single sign-on",
    phoneLabel: labels.phoneLabel ?? 'Phone number',
    phonePlaceholder: labels.phonePlaceholder ?? '+1 555 000 0000',
    otpCodeLabel: labels.otpCodeLabel ?? 'Verification code',
    otpCodePlaceholder: labels.otpCodePlaceholder ?? '6-digit code',
    sendOtpButton: labels.sendOtpButton ?? 'Get code',
    resendOtpCountdownText: labels.resendOtpCountdownText ?? 'Resend in {seconds}s',
    usePhoneOtpText: labels.usePhoneOtpText ?? 'Sign in with verification code',
    usePasswordSignInText: labels.usePasswordSignInText ?? 'Sign in with password instead',
  };

  // Tick the resend cooldown down once per second while it's armed.
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setTimeout(() => setOtpCooldown((s) => (s > 1 ? s - 1 : 0)), 1000);
    return () => clearTimeout(timer);
  }, [otpCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (mode === 'phone-otp') {
        await signInWithPhoneOtp(phone.trim(), otpCode.trim());
      } else if (phonePasswordEnabled && looksLikePhoneIdentifier(email)) {
        // Unified identifier: a phone-shaped entry routes to phone+password.
        // Normalize identically to the backend (strip formatting, no country
        // code) or the phoneNumber lookup fails.
        await signInWithPhonePassword(normalizePhoneIdentifier(email) ?? email.trim(), password);
      } else {
        await signIn(email, password);
      }
      onSuccess?.();
    } catch (err) {
      const authError = err instanceof Error ? err : new Error(String(err));
      const code = (authError as Error & { code?: string }).code;
      setError((code && errorMessages?.[code]) || authError.message);
      onError?.(authError);
    }
  };

  /**
   * Request a sign-in OTP for the entered number. A 429 (per-number cooldown
   * / hourly cap, framework#2780) surfaces the server's honest "retry in Ns"
   * message; any other failure surfaces as-is.
   */
  const handleSendOtp = async () => {
    if (!phone.trim() || otpSending || otpCooldown > 0) return;
    setError(null);
    setOtpSending(true);
    try {
      await sendPhoneOtp(phone.trim());
      setOtpSent(true);
      setOtpCooldown(60);
    } catch (err) {
      const authError = err instanceof Error ? err : new Error(String(err));
      const code = (authError as Error & { code?: string }).code;
      setError((code && errorMessages?.[code]) || authError.message);
      onError?.(authError);
    } finally {
      setOtpSending(false);
    }
  };

  const switchMode = (next: 'password' | 'phone-otp') => {
    setMode(next);
    setError(null);
  };

  /**
   * Federated SSO sign-in: routes the entered email to its configured IdP
   * (better-auth `@better-auth/sso`, by email domain) and redirects the
   * browser to the provider's authorization endpoint. Falls back to an inline
   * error when no provider matches the domain.
   */
  const handleSso = async () => {
    if (ssoSubmitting) return;
    setError(null);
    // SSO routes by email domain — a phone-shaped identifier can't map to an IdP.
    if (looksLikePhoneIdentifier(email)) {
      setError('Enter your email address to sign in with SSO.');
      return;
    }
    setSsoSubmitting(true);
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
        // Navigating to the IdP — keep the pending state through teardown.
        window.location.href = data.url;
        return;
      }
      setError(data.message || 'No SSO provider is configured for this email domain.');
      setSsoSubmitting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSsoSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full flex-col justify-center space-y-7 sm:w-[400px]">
      <AuthFormHeader
        icon={hideIcon ? undefined : (icon ?? <DefaultLockIcon />)}
        title={title}
        description={ssoEnforced && !showPasswordFallback ? l.ssoOnlyDescription : description}
      />

      <div className="space-y-5">
        {configPending ? (
          /* Auth config still resolving — hold the layout instead of painting
             the password-form defaults that may be wrong for this server. */
          <div className="flex justify-center py-10" role="status" aria-live="polite" data-testid="login-config-loading">
            <AuthSpinner />
          </div>
        ) : (
        <>
        <SocialSignInButtons mode="sign-in" onProvidersResolved={(hasProviders) => setHasSocialProviders(hasProviders)} />

        {passwordFormVisible ? (
        mode === 'phone-otp' ? (
        /* Phone-OTP sign-in (framework#2780): request a code, then verify.
           Server-side the number is guarded by a per-number cooldown +
           hourly cap — the resend button mirrors it with a countdown. */
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* No divider here: SocialSignInButtons already renders its own
              "or continue with email" divider under the provider buttons —
              stacking a second "or" line read as a rendering glitch (#2625). */}
          {error && <AuthErrorBanner message={error} />}

          <div className="space-y-2">
            <label htmlFor="login-phone" className={AUTH_FIELD_LABEL_CLASS}>
              {l.phoneLabel}
            </label>
            <input
              id="login-phone"
              type="tel"
              placeholder={l.phonePlaceholder}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoComplete="tel"
              disabled={isLoading}
              className={AUTH_INPUT_CLASS}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="login-otp" className={AUTH_FIELD_LABEL_CLASS}>
              {l.otpCodeLabel}
            </label>
            <div className="flex gap-2">
              <input
                id="login-otp"
                type="text"
                inputMode="numeric"
                placeholder={l.otpCodePlaceholder}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                required
                autoComplete="one-time-code"
                disabled={isLoading}
                className={AUTH_INPUT_CLASS}
              />
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={otpSending || otpCooldown > 0 || !phone.trim() || isLoading}
                className="shrink-0 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
              >
                {otpSending && <AuthSpinner />}
                {otpCooldown > 0
                  ? l.resendOtpCountdownText.replace('{seconds}', String(otpCooldown))
                  : l.sendOtpButton}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !otpSent}
            className={AUTH_PRIMARY_BUTTON_CLASS}
          >
            {isLoading && <AuthSpinner />}
            {isLoading ? l.submittingButton : l.submitButton}
          </button>

          <button
            type="button"
            onClick={() => switchMode('password')}
            className="w-full text-center text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
          >
            {l.usePasswordSignInText}
          </button>
        </form>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* No divider here: SocialSignInButtons already renders its own
              "or continue with email" divider under the provider buttons —
              stacking a second "or" line read as a rendering glitch (#2625). */}
          {error && <AuthErrorBanner message={error} />}

          <div className="space-y-2">
            <label htmlFor="login-email" className={AUTH_FIELD_LABEL_CLASS}>
              {phonePasswordEnabled ? l.emailOrPhoneLabel : l.emailLabel}
            </label>
            <input
              id="login-email"
              // `text` (not `email`) when a phone number is also accepted, so the
              // browser doesn't reject a phone-shaped value on native validation.
              type={phonePasswordEnabled ? 'text' : 'email'}
              inputMode={phonePasswordEnabled ? 'text' : 'email'}
              placeholder={phonePasswordEnabled ? l.emailOrPhonePlaceholder : l.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
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
              disabled={isLoading || ssoSubmitting}
              aria-busy={ssoSubmitting}
              className="flex w-full items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
            >
              {ssoSubmitting && <AuthSpinner />}
              {l.ssoButton}
            </button>
          )}

          {phoneOtpEnabled && (
            <button
              type="button"
              onClick={() => switchMode('phone-otp')}
              className="w-full text-center text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
            >
              {l.usePhoneOtpText}
            </button>
          )}

          {/* Break-glass form was opened under enforced mode — let the user
              collapse back to the SSO-only view. */}
          {ssoEnforced && showPasswordFallback && (
            <button
              type="button"
              onClick={() => setShowPasswordFallback(false)}
              className="w-full text-center text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
            >
              {l.backToSsoText}
            </button>
          )}
        </form>
        )
        ) : (
          /* SSO-only ("enforced"): the federated button(s) above are the path.
             Surface any social-sign-in error and an understated break-glass
             link to the password form for the env owner / local admin. */
          <div className="space-y-4">
            {error && <AuthErrorBanner message={error} />}
            <button
              type="button"
              onClick={() => setShowPasswordFallback(true)}
              className="w-full text-center text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
            >
              {l.usePasswordText}
            </button>
          </div>
        )}
        </>
        )}
      </div>

      {registerUrl && !ssoEnforced && (
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
