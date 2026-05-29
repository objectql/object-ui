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

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, LoginForm } from '@object-ui/auth';
import { useObjectTranslation } from '@object-ui/i18n';
import { Card } from '@object-ui/components';
import { AuthLayout } from './AuthLayout';

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
  const [autoSelectingOrg, setAutoSelectingOrg] = useState(false);

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

  // Read public auth config once to know whether sign-up is gated off.
  useEffect(() => {
    let cancelled = false;
    getAuthConfig()
      .then((cfg) => {
        if (cancelled) return;
        setSignUpDisabled(cfg?.emailPassword?.disableSignUp === true);
      })
      .catch(() => {
        /* leave default (false) — server-side gate is the source of truth */
      });
    return () => {
      cancelled = true;
    };
  }, [getAuthConfig]);

  // Post-login orchestration — fires once we observe an authenticated user.
  useEffect(() => {
    if (!user) return;

    // 1. OAuth provider hand-off (see file header). Replay the signed
    //    authorize params verbatim so the IdP can issue the code.
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      if (sp.has('client_id') && sp.has('redirect_uri')) {
        window.location.assign(`/api/v1/auth/oauth2/authorize${window.location.search}`);
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

  if (isLoading || user) {
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
      labels={{
        emailLabel: t('auth.login.emailLabel', { defaultValue: 'Email' }),
        emailPlaceholder: t('auth.login.emailPlaceholder', { defaultValue: 'name@example.com' }),
        passwordLabel: t('auth.login.passwordLabel', { defaultValue: 'Password' }),
        passwordPlaceholder: t('auth.login.passwordPlaceholder', { defaultValue: 'Enter your password' }),
        forgotPasswordText: t('auth.login.forgotPasswordText', { defaultValue: 'Forgot password?' }),
        submitButton: t('auth.login.submitButton', { defaultValue: 'Sign In' }),
        submittingButton: t('auth.login.submittingButton', { defaultValue: 'Signing in…' }),
        noAccountText: t('auth.login.noAccountText', { defaultValue: "Don't have an account?" }),
        signUpText: t('auth.login.signUpText', { defaultValue: 'Sign up' }),
      }}
    />
  );
}

export default LoginPage;

