/**
 * Login Page for ObjectStack Console
 */

import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LoginForm, useAuth, type AuthLinkComponentProps } from '@object-ui/auth';
import { useObjectTranslation } from '@object-ui/i18n';
import { AuthPageLayout } from './AuthPageLayout.js';

const RouterLink = ({ href, className, children }: AuthLinkComponentProps) => (
  <Link to={href} className={className}>{children}</Link>
);

export function LoginPage() {
  const navigate = useNavigate();
  const { t } = useObjectTranslation();
  const { getAuthConfig } = useAuth();

  // Hide the "Sign up" link when the deployment has disabled
  // self-service registration (env `OS_DISABLE_SIGNUP=true` or
  // `emailAndPassword.disableSignUp` in objectstack.config.ts). We start
  // undefined so we don't flicker the link on first paint, and pass
  // `undefined` (LoginForm hides the link) once we know signup is off.
  const [signUpDisabled, setSignUpDisabled] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    getAuthConfig()
      .then(cfg => { if (!cancelled) setSignUpDisabled(cfg?.emailPassword?.disableSignUp === true); })
      .catch(() => { if (!cancelled) setSignUpDisabled(false); });
    return () => { cancelled = true; };
  }, [getAuthConfig]);

  return (
    <AuthPageLayout>
      <LoginForm
        onSuccess={() => navigate('/')}
        registerUrl={signUpDisabled ? undefined : '/register'}
        forgotPasswordUrl="/forgot-password"
        title={t('auth.login.title')}
        description={t('auth.login.description')}
        linkComponent={RouterLink}
        labels={{
          emailLabel: t('auth.login.emailLabel'),
          emailPlaceholder: t('auth.login.emailPlaceholder'),
          passwordLabel: t('auth.login.passwordLabel'),
          passwordPlaceholder: t('auth.login.passwordPlaceholder'),
          forgotPasswordText: t('auth.login.forgotPasswordText'),
          submitButton: t('auth.login.submitButton'),
          submittingButton: t('auth.login.submittingButton'),
          noAccountText: t('auth.login.noAccountText'),
          signUpText: t('auth.login.signUpText'),
        }}
      />
    </AuthPageLayout>
  );
}
