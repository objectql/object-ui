/**
 * RegisterPage — Console-hosted sign-up surface.
 *
 * Ported from `framework/apps/account/src/routes/register.tsx`. Wraps
 * `<RegisterForm>` from `@object-ui/auth` and layers Console-specific
 * concerns:
 *
 *  - Bounces to `/login` if `emailPassword.disableSignUp === true`
 *    (defense-in-depth; the server-side gate is the source of truth).
 *  - Routes to `/verify-email-prompt` when the server requires email
 *    verification before sign-in.
 *  - Replays an `/oauth2/authorize` query string when the user landed
 *    here mid-SSO so the IdP can continue the flow post-signup.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, RegisterForm } from '@object-ui/auth';
import { useObjectTranslation } from '@object-ui/i18n';
import { Card } from '@object-ui/components';
import { AuthLayout } from './AuthLayout';
import { followOauthAuthorize } from './followAuthorize';

function isSafeRedirect(target: string | null): target is string {
  return !!target && target.startsWith('/') && !target.startsWith('//');
}

/** Prefix a router-relative path with the Console basename for full-page
 * navigations (see LoginPage for the detailed rationale). */
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

export function RegisterPage() {
  const { t } = useObjectTranslation();
  const navigate = useNavigate();
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

  const [signUpDisabled, setSignUpDisabled] = useState<boolean | null>(null);
  const [autoSelectingOrg, setAutoSelectingOrg] = useState(false);
  // Fire the OAuth hand-off fetch at most once (see LoginPage).
  const ssoHandoffStartedRef = useRef(false);

  // See LoginPage: `isLoading` is overloaded (initial session check + every
  // in-flight signUp). Latch once the first check resolves so a failed
  // registration does not unmount <RegisterForm> and discard the error banner
  // it holds in local state.
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  useLayoutEffect(() => {
    if (!isLoading) setHasBootstrapped(true);
  }, [isLoading]);

  // Probe public auth config — bounce to /login if sign-up is gated off.
  useEffect(() => {
    let cancelled = false;
    getAuthConfig()
      .then((cfg) => {
        if (cancelled) return;
        const disabled = cfg?.emailPassword?.disableSignUp === true;
        setSignUpDisabled(disabled);
        if (disabled) {
          const search = redirect ? `?redirect=${encodeURIComponent(redirect)}` : '';
          navigate(`/login${search}`, { replace: true });
        }
      })
      .catch(() => {
        if (!cancelled) setSignUpDisabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [getAuthConfig, navigate, redirect]);

  // Post-signup orchestration mirrors LoginPage exactly.
  useEffect(() => {
    if (!user) return;

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
        window.location.assign(withConsoleBase(isSafeRedirect(redirect) ? redirect : '/'));
        return;
      }
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

  if (signUpDisabled === null || (isLoading && !hasBootstrapped) || user) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
          <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      </AuthLayout>
    );
  }

  const loginUrl = redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login';

  return (
    <AuthLayout formWidth="md">
      <Card className="border-border/60 px-4 py-8 shadow-sm shadow-primary/5 backdrop-blur supports-[backdrop-filter]:bg-card/95">
      <RegisterForm
        title={t('auth.register.title', { defaultValue: 'Create your account' })}
        description={t('auth.register.description', {
          defaultValue: 'Sign up to get started',
        })}
        loginUrl={loginUrl}
        linkComponent={RouterLink}
        errorMessages={{
          USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: t('auth.register.errors.userExists', {
            defaultValue: 'An account with this email already exists. Try signing in instead.',
          }),
          USER_ALREADY_EXISTS: t('auth.register.errors.userExists', {
            defaultValue: 'An account with this email already exists. Try signing in instead.',
          }),
        }}
        onVerificationRequired={(email) => {
          const sp = new URLSearchParams();
          sp.set('email', email);
          if (redirect) sp.set('redirect', redirect);
          navigate(`/verify-email-prompt?${sp.toString()}`, { replace: true });
        }}
        labels={{
          nameLabel: t('auth.register.nameLabel', { defaultValue: 'Name' }),
          namePlaceholder: t('auth.register.namePlaceholder', { defaultValue: 'John Doe' }),
          emailLabel: t('auth.register.emailLabel', { defaultValue: 'Email' }),
          emailPlaceholder: t('auth.register.emailPlaceholder', { defaultValue: 'name@example.com' }),
          passwordLabel: t('auth.register.passwordLabel', { defaultValue: 'Password' }),
          passwordPlaceholder: t('auth.register.passwordPlaceholder', {
            defaultValue: 'Create a password (min. 8 characters)',
          }),
          confirmPasswordLabel: t('auth.register.confirmPasswordLabel', {
            defaultValue: 'Confirm password',
          }),
          confirmPasswordPlaceholder: t('auth.register.confirmPasswordPlaceholder', {
            defaultValue: 'Confirm your password',
          }),
          passwordMismatchError: t('auth.register.passwordMismatchError', {
            defaultValue: 'Passwords do not match',
          }),
          passwordTooShortError: t('auth.register.passwordTooShortError', {
            defaultValue: 'Password must be at least 8 characters',
          }),
          submitButton: t('auth.register.submitButton', { defaultValue: 'Create account' }),
          submittingButton: t('auth.register.submittingButton', { defaultValue: 'Creating account…' }),
          hasAccountText: t('auth.register.hasAccountText', { defaultValue: 'Already have an account?' }),
          signInText: t('auth.register.signInText', { defaultValue: 'Sign in' }),
        }}
      />
      </Card>
    </AuthLayout>
  );
}

export default RegisterPage;
