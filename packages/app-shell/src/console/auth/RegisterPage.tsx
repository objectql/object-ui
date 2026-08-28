/**
 * Register Page for ObjectStack Console
 */

import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { RegisterForm, useAuth, type AuthLinkComponentProps } from '@object-ui/auth';
import { useObjectTranslation } from '@object-ui/i18n';
import { AuthPageLayout } from './AuthPageLayout.js';

const RouterLink = ({ href, className, children }: AuthLinkComponentProps) => (
  <Link to={href} className={className}>{children}</Link>
);

export function RegisterPage() {
  const navigate = useNavigate();
  const { t } = useObjectTranslation();
  const { getAuthConfig, sendVerificationEmail } = useAuth();

  // Defense-in-depth: even if a user lands on /register directly when
  // signup is disabled, bounce them to /login. The server-side
  // `disableSignUp` (set by env `OS_DISABLE_SIGNUP=true` or the
  // `emailAndPassword.disableSignUp` config option) will still 403 any
  // submission, but redirecting here avoids a confusing form.
  const [allowed, setAllowed] = useState<boolean | undefined>(undefined);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resendError, setResendError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAuthConfig()
      .then(cfg => {
        if (cancelled) return;
        if (cfg?.emailPassword?.disableSignUp === true) {
          navigate('/login', { replace: true });
        } else {
          setAllowed(true);
        }
      })
      .catch(() => { if (!cancelled) setAllowed(true); });
    return () => { cancelled = true; };
  }, [getAuthConfig, navigate]);

  if (allowed !== true) {
    // Render nothing until we know the flag — prevents a flash of the form.
    return <AuthPageLayout>{null}</AuthPageLayout>;
  }

  if (pendingEmail) {
    const handleResend = async () => {
      setResendState('sending');
      setResendError(null);
      try {
        await sendVerificationEmail(pendingEmail);
        setResendState('sent');
      } catch (err) {
        setResendState('error');
        setResendError(err instanceof Error ? err.message : String(err));
      }
    };
    return (
      <AuthPageLayout>
        <div className="mx-auto flex w-full flex-col justify-center space-y-7 sm:w-[400px]">
          <div className="flex flex-col items-center space-y-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t('auth.register.verifyInbox.title', { defaultValue: 'Check your inbox' })}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('auth.register.verifyInbox.description', { email: pendingEmail, defaultValue: "We've sent a verification link to {{email}}. Click the link to activate your account." })}
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendState === 'sending'}
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {resendState === 'sending'
                ? t('auth.register.verifyInbox.resending', { defaultValue: 'Sending…' })
                : t('auth.register.verifyInbox.resend', { defaultValue: 'Resend verification email' })}
            </button>
            {resendState === 'sent' && (
              <p className="text-center text-sm text-emerald-600 dark:text-emerald-400">
                {t('auth.register.verifyInbox.resent', { defaultValue: 'Verification email sent.' })}
              </p>
            )}
            {resendState === 'error' && resendError && (
              <p className="text-center text-sm text-destructive">{resendError}</p>
            )}
          </div>

          <p className="px-8 text-center text-sm text-muted-foreground">
            <Link to="/login" className="font-medium text-primary hover:underline">
              {t('auth.register.verifyInbox.backToSignIn', { defaultValue: 'Back to sign in' })}
            </Link>
          </p>
        </div>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout>
      <RegisterForm
        onSuccess={() => navigate('/')}
        onVerificationRequired={(email) => setPendingEmail(email)}
        loginUrl="/login"
        title={t('auth.register.title')}
        description={t('auth.register.description')}
        linkComponent={RouterLink}
        labels={{
          nameLabel: t('auth.register.nameLabel'),
          namePlaceholder: t('auth.register.namePlaceholder'),
          emailLabel: t('auth.register.emailLabel'),
          emailPlaceholder: t('auth.register.emailPlaceholder'),
          passwordLabel: t('auth.register.passwordLabel'),
          passwordPlaceholder: t('auth.register.passwordPlaceholder'),
          confirmPasswordLabel: t('auth.register.confirmPasswordLabel'),
          confirmPasswordPlaceholder: t('auth.register.confirmPasswordPlaceholder'),
          passwordMismatchError: t('auth.register.passwordMismatchError'),
          passwordTooShortError: t('auth.register.passwordTooShortError'),
          submitButton: t('auth.register.submitButton'),
          submittingButton: t('auth.register.submittingButton'),
          hasAccountText: t('auth.register.hasAccountText'),
          signInText: t('auth.register.signInText'),
        }}
      />
    </AuthPageLayout>
  );
}
