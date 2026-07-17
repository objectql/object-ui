/**
 * LoginPage — Console-hosted sign-in surface.
 *
 * Ported from `framework/apps/account/src/routes/login.tsx`. Wraps
 * `<LoginForm>` from `@object-ui/auth` so the visual + a11y behaviour
 * stays in sync with every other auth surface, then layers Console-
 * specific concerns on top:
 *
 *  - SSO hand-off banner when `client_id` + `redirect_uri` are present
 *    in the query string (better-auth's oauth-provider redirects the
 *    unauthenticated user here before issuing a code).
 *  - Post-login orchestration: replay the original `/oauth2/authorize`
 *    request, auto-select the user's single organization, or honour a
 *    safe `?redirect=` target.
 *  - Hides the "Sign up" link when the server reports
 *    `emailPassword.disableSignUp === true`.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, LoginForm, AuthErrorBanner } from '@object-ui/auth';
import { useObjectTranslation } from '@object-ui/i18n';
import { Card } from '@object-ui/components';
import { AuthLayout } from './AuthLayout';
import { followOauthAuthorize } from './followAuthorize';

/** Restrict the post-login redirect to same-origin paths. */
function isSafeRedirect(target: string | null): target is string {
  return !!target && target.startsWith('/') && !target.startsWith('//');
}

/**
 * Prefix a router-relative path with the Console basename for full-page
 * navigations. `window.location.assign` bypasses React Router's `basename`,
 * so a path produced by the router (e.g. `?redirect=/settings` — already
 * basename-stripped) or a literal like `/organizations` would resolve to
 * `http://host/settings`, missing the `/_console` mount and 404-ing.
 * Paths already targeting another absolute SPA mount (`/_studio`,
 * `/_account`, …) pass through untouched.
 */
function withConsoleBase(path: string): string {
  if (path.startsWith('/_')) return path;
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  return base + (path.startsWith('/') ? path : `/${path}`);
}

const DEV_HINT_DISMISSED_KEY = 'os.console.devAdminHintDismissed';

function RouterLink(props: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <Link to={props.href} className={props.className}>
      {props.children}
    </Link>
  );
}

export function LoginPage() {
  const { t } = useObjectTranslation();
  const [params] = useSearchParams();
  const redirect = params.get('redirect');
  const {
    user,
    isLoading,
    organizations,
    isOrganizationsLoading,
    activeOrganization,
    switchOrganization,
    getAuthConfig,
  } = useAuth();

  const [signUpDisabled, setSignUpDisabled] = useState(false);
  // Dev-only seeded-admin hint (15.1 third-party eval): the runtime seeds
  // admin@objectos.ai on an empty dev DB, but nothing on this page said so —
  // new users clicked "Sign up" and landed in an empty non-admin workspace.
  // The server reports the credentials via /auth/config `devSeedAdmin` ONLY
  // in development while the account still carries the default password, so
  // production can never render this. Dismissal is remembered per browser.
  const [devSeedAdmin, setDevSeedAdmin] = useState<{ email: string; password?: string } | null>(
    null,
  );
  const [devHintDismissed, setDevHintDismissed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(DEV_HINT_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const dismissDevHint = () => {
    setDevHintDismissed(true);
    try {
      window.localStorage.setItem(DEV_HINT_DISMISSED_KEY, '1');
    } catch {
      /* private mode — hide for this session only */
    }
  };
  const [autoSelectingOrg, setAutoSelectingOrg] = useState(false);
  // The OAuth hand-off fetch must fire at most once even though the post-login
  // effect re-runs as org state settles (it navigates away on success).
  const ssoHandoffStartedRef = useRef(false);

  // `isLoading` from useAuth() is overloaded: it is true both during the
  // initial session check AND during every in-flight signIn. The full-page
  // spinner below should only cover the initial bootstrap (and post-login
  // orchestration when `user` is set) — never an in-flight signIn. Latch once
  // the first session check resolves so a failed login does not unmount
  // <LoginForm>, which would otherwise discard the error banner it holds in
  // local state and silently reset the fields.
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  useLayoutEffect(() => {
    if (!isLoading) setHasBootstrapped(true);
  }, [isLoading]);

  // Detect SSO hand-off so we can surface the relying-party host.
  const ssoTarget = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const sp = new URLSearchParams(window.location.search);
    const redirectUri = sp.get('redirect_uri');
    if (!sp.has('client_id') || !redirectUri) return null;
    try {
      return new URL(redirectUri).host;
    } catch {
      return null;
    }
  }, []);

  // Surface an OAuth/SSO callback failure. better-auth redirects a failed
  // callback (expired hand-off, replayed `state`, IdP error, …) to its
  // error URL with `?error=<code>` — the runtime points that at this login
  // page (framework AuthManager `onAPIError.errorURL`). Without this banner
  // the user who just SUCCEEDED at typing their password on the IdP lands
  // back on a login form with zero explanation (objectui#2458 item 1).
  const callbackError = useMemo(() => {
    const code = params.get('error');
    if (!code) return null;
    const description = params.get('error_description');
    return { code, description };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Read public auth config once to know whether sign-up is gated off and
  // whether the dev-seeded admin credentials should be surfaced.
  useEffect(() => {
    let cancelled = false;
    getAuthConfig()
      .then((cfg) => {
        if (cancelled) return;
        setSignUpDisabled(cfg?.emailPassword?.disableSignUp === true);
        const seed = (cfg as { devSeedAdmin?: { email?: unknown; password?: unknown } } | null)
          ?.devSeedAdmin;
        setDevSeedAdmin(
          seed && typeof seed.email === 'string'
            ? {
                email: seed.email,
                password: typeof seed.password === 'string' ? seed.password : undefined,
              }
            : null,
        );
      })
      .catch(() => {
        /* leave defaults — server-side gate is the source of truth */
      });
    return () => {
      cancelled = true;
    };
  }, [getAuthConfig]);

  // Post-login orchestration — fires once we observe an authenticated user.
  useEffect(() => {
    if (!user) return;

    // 1. OAuth provider hand-off (see file header). Replay the signed
    //    authorize params so the IdP issues the code, then FOLLOW the redirect
    //    it hands back. better-auth's oauth-provider answers a same-origin
    //    fetch with `200 { redirect: true, url }` (NOT a 302), so a plain
    //    navigation to /authorize would just render that JSON and strand the
    //    user on this spinner — we must fetch + navigate ourselves.
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      if (sp.has('client_id') && sp.has('redirect_uri')) {
        if (!ssoHandoffStartedRef.current) {
          ssoHandoffStartedRef.current = true;
          followOauthAuthorize(window.location.search);
        }
        return;
      }
    }

    // 2. Auto-select a single org so post-login redirect doesn't bounce
    //    off `RequireOrganization`.
    if (!activeOrganization) {
      if (isOrganizationsLoading || autoSelectingOrg) return;
      if (organizations.length === 1) {
        setAutoSelectingOrg(true);
        switchOrganization(organizations[0].id)
          .catch(() => undefined)
          .finally(() => setAutoSelectingOrg(false));
        return;
      }
      if (organizations.length === 0) {
        // No org yet — let the Console pick (CreateWorkspaceDialog or the
        // org list, depending on `multiOrgEnabled`). Send to root.
        window.location.assign(withConsoleBase(isSafeRedirect(redirect) ? redirect : '/'));
        return;
      }
      // Multiple orgs, no active selection — surface the picker.
      window.location.assign(withConsoleBase('/organizations'));
      return;
    }

    if (autoSelectingOrg) return;

    window.location.assign(withConsoleBase(isSafeRedirect(redirect) ? redirect : '/'));
  }, [
    user,
    activeOrganization,
    organizations,
    isOrganizationsLoading,
    autoSelectingOrg,
    redirect,
    switchOrganization,
  ]);

  if ((isLoading && !hasBootstrapped) || user) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
          <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          <span>{t('auth.login.signingIn', { defaultValue: 'Signing you in…' })}</span>
        </div>
      </AuthLayout>
    );
  }

  // Build search-aware sign-up URL so the redirect param survives the
  // bounce from /login → /register → /login.
  const registerUrl = redirect
    ? `/register?redirect=${encodeURIComponent(redirect)}`
    : '/register';

  return (
    <AuthLayout formWidth="md">
      <div className="flex flex-col gap-6">
        {callbackError ? (
          <AuthErrorBanner
            message={
              t('auth.login.errors.oauthCallbackFailed', {
                defaultValue:
                  'Single sign-on could not be completed — the sign-in link expired or was already used. Please try again.',
              }) + (callbackError.description ? ` (${callbackError.description})` : ` (${callbackError.code})`)
            }
          />
        ) : null}
        {ssoTarget ? (
          <div
            role="status"
            className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground"
          >
            <span className="mt-0.5 inline-block size-2 shrink-0 rounded-full bg-primary" />
            <span>
              {t('auth.login.ssoHandoff', {
                target: ssoTarget,
                defaultValue: `Continue to ${ssoTarget}`,
              })}
            </span>
          </div>
        ) : null}
        {devSeedAdmin && !devHintDismissed ? (
          <div
            role="status"
            data-testid="dev-admin-hint"
            className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
          >
            <span className="mt-0.5 inline-block size-2 shrink-0 rounded-full bg-amber-500" />
            <div className="flex-1">
              <div className="font-medium">
                {t('auth.login.devAdminHint.title', { defaultValue: 'Development instance' })}
              </div>
              <div className="text-muted-foreground">
                {t('auth.login.devAdminHint.body', {
                  defaultValue: 'Sign in with the seeded dev admin:',
                })}{' '}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  {devSeedAdmin.email}
                </code>
                {devSeedAdmin.password ? (
                  <>
                    {' / '}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                      {devSeedAdmin.password}
                    </code>
                  </>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={dismissDevHint}
              aria-label={t('auth.login.devAdminHint.dismiss', { defaultValue: 'Dismiss' })}
              className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5 fill-current">
                <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
              </svg>
            </button>
          </div>
        ) : null}
        <Card className="border-border/60 px-4 py-8 shadow-sm shadow-primary/5 backdrop-blur supports-[backdrop-filter]:bg-card/95">
          <LoginFormCard
            registerUrl={signUpDisabled ? undefined : registerUrl}
            redirect={redirect}
          />
        </Card>
      </div>
    </AuthLayout>
  );
}

function LoginFormCard({
  registerUrl,
  redirect,
}: {
  registerUrl?: string;
  redirect: string | null;
}) {
  const { t } = useObjectTranslation();
  const navigate = useNavigate();
  // LoginForm doesn't expose the submitted email, so we capture it here
  // to forward into the verify-email-prompt redirect. A ref is used instead
  // of state so capturing each keystroke doesn't re-render this subtree
  // (which would otherwise recompute every translated label and re-render
  // <LoginForm> on every character typed into the email field).
  const lastEmailRef = useRef('');

  useEffect(() => {
    const handler = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target?.id === 'login-email') lastEmailRef.current = target.value;
    };
    document.addEventListener('input', handler, true);
    return () => document.removeEventListener('input', handler, true);
  }, []);

  return (
    <LoginForm
      onError={(err) => {
        const message = err.message || '';
        const code = (err as Error & { code?: string }).code;
        const lower = message.toLowerCase();
        const isEmailUnverified =
          code === 'EMAIL_NOT_VERIFIED' ||
          (lower.includes('email') &&
            (lower.includes('verif') || lower.includes('not verified')));
        if (isEmailUnverified) {
          const sp = new URLSearchParams();
          if (lastEmailRef.current) sp.set('email', lastEmailRef.current);
          if (redirect) sp.set('redirect', redirect);
          navigate(`/verify-email-prompt?${sp.toString()}`);
        }
      }}
      title={t('auth.login.title', { defaultValue: 'Sign in to your account' })}
      description={t('auth.login.description', {
        defaultValue: 'Enter your email and password to continue',
      })}
      registerUrl={registerUrl}
      forgotPasswordUrl="/forgot-password"
      linkComponent={RouterLink}
      errorMessages={{
        INVALID_EMAIL_OR_PASSWORD: t('auth.login.errors.invalidCredentials', {
          defaultValue: 'Invalid email or password',
        }),
        EMAIL_NOT_VERIFIED: t('auth.login.errors.emailNotVerified', {
          defaultValue: 'Please verify your email address before signing in.',
        }),
      }}
      labels={{
        emailLabel: t('auth.login.emailLabel', { defaultValue: 'Email' }),
        emailPlaceholder: t('auth.login.emailPlaceholder', { defaultValue: 'name@example.com' }),
        emailOrPhoneLabel: t('auth.login.emailOrPhoneLabel', { defaultValue: 'Email or phone number' }),
        emailOrPhonePlaceholder: t('auth.login.emailOrPhonePlaceholder', {
          defaultValue: 'name@example.com or +1 555 000 0000',
        }),
        passwordLabel: t('auth.login.passwordLabel', { defaultValue: 'Password' }),
        passwordPlaceholder: t('auth.login.passwordPlaceholder', { defaultValue: 'Enter your password' }),
        forgotPasswordText: t('auth.login.forgotPasswordText', { defaultValue: 'Forgot password?' }),
        submitButton: t('auth.login.submitButton', { defaultValue: 'Sign In' }),
        submittingButton: t('auth.login.submittingButton', { defaultValue: 'Signing in…' }),
        noAccountText: t('auth.login.noAccountText', { defaultValue: "Don't have an account?" }),
        signUpText: t('auth.login.signUpText', { defaultValue: 'Sign up' }),
        phoneLabel: t('auth.login.phoneLabel', { defaultValue: 'Phone number' }),
        phonePlaceholder: t('auth.login.phonePlaceholder', { defaultValue: '+1 555 000 0000' }),
        otpCodeLabel: t('auth.login.otpCodeLabel', { defaultValue: 'Verification code' }),
        otpCodePlaceholder: t('auth.login.otpCodePlaceholder', { defaultValue: '6-digit code' }),
        sendOtpButton: t('auth.login.sendOtpButton', { defaultValue: 'Get code' }),
        // `{seconds}` (single braces) is the component's own hole — kept out
        // of i18next's `{{…}}` interpolation on purpose.
        resendOtpCountdownText: t('auth.login.resendOtpCountdownText', {
          defaultValue: 'Resend in {seconds}s',
        }),
        usePhoneOtpText: t('auth.login.usePhoneOtpText', {
          defaultValue: 'Sign in with verification code',
        }),
        usePasswordSignInText: t('auth.login.usePasswordSignInText', {
          defaultValue: 'Sign in with password instead',
        }),
      }}
    />
  );
}

export default LoginPage;

