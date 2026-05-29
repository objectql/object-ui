/**
 * SetupPage — first-run owner-bootstrap surface.
 *
 * Ported from `framework/apps/account/src/routes/setup.tsx`. Renders only
 * when the server reports `hasOwner: false`. Creates the first owner
 * account + names the auto-provisioned personal organization.
 *
 * `useAuth()` doesn't expose bootstrap-status, so we call the REST
 * endpoint directly. Org rename uses `useAuth().updateOrganization()`.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@object-ui/auth';
import { useObjectTranslation } from '@object-ui/i18n';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@object-ui/components';

const AUTH_BASE = `${import.meta.env.VITE_SERVER_URL || ''}/api/v1/auth`;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function SetupPage() {
  const { t } = useObjectTranslation();
  const navigate = useNavigate();
  const {
    user,
    signUp,
    organizations,
    refreshOrganizations,
    updateOrganization,
    createOrganization,
    switchOrganization,
  } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bootstrapped, setBootstrapped] = useState<boolean | null>(null);

  // Probe bootstrap-status on mount. If an owner already exists, bounce
  // to /login — this page must never be reachable in a normal deployment.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${AUTH_BASE}/bootstrap-status`, {
          credentials: 'include',
        });
        const data: { hasOwner?: boolean } = res.ok
          ? await res.json().catch(() => ({}))
          : {};
        if (!cancelled) setBootstrapped(data.hasOwner === true);
      } catch {
        if (!cancelled) setBootstrapped(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (bootstrapped === true && !user) {
      navigate('/login', { replace: true });
    }
  }, [bootstrapped, user, navigate]);

  useEffect(() => {
    if (user) {
      window.location.assign('/');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signUp(name, email, password);

      // The Security plugin auto-creates a personal "<User>'s Workspace"
      // on signup so multi-tenant RLS has something to hang on. Don't
      // create a second org — rename the auto-created one to the user's
      // chosen name (or create a fresh one if the plugin is disabled).
      const trimmedName = orgName.trim();
      if (trimmedName) {
        try {
          await refreshOrganizations();
          const personal = organizations[0];
          let activeOrgId: string | undefined;
          if (personal?.id) {
            await updateOrganization(personal.id, {
              name: trimmedName,
              slug: slugify(trimmedName),
            });
            activeOrgId = personal.id;
          } else {
            const created = await createOrganization({
              name: trimmedName,
              slug: slugify(trimmedName),
            });
            activeOrgId = created?.id;
          }
          if (activeOrgId) {
            await switchOrganization(activeOrgId).catch(() => undefined);
          }
        } catch (err) {
          // Non-fatal — user can rename / create from settings later.
          console.warn('[setup] organization rename/create failed', err);
        }
      }

      window.location.assign('/');
    } catch (err) {
      toast.error(
        t('auth.setup.failed', { defaultValue: 'Setup failed' }),
        { description: (err as Error).message },
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (bootstrapped === null) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center bg-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground/20 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-muted p-6">
      <div className="flex w-full max-w-md flex-col gap-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>
              {t('auth.setup.welcomeTitle', { defaultValue: 'Welcome to ObjectStack' })}
            </CardTitle>
            <CardDescription>
              {t('auth.setup.description', {
                defaultValue:
                  'Create the first owner account to finish setting up this deployment.',
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">
                  {t('auth.setup.yourName', { defaultValue: 'Your name' })}
                </Label>
                <Input
                  id="name"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="orgName">
                  {t('auth.setup.orgName', { defaultValue: 'Organization name' })}
                </Label>
                <Input
                  id="orgName"
                  required
                  placeholder={t('auth.setup.orgNamePlaceholder', {
                    defaultValue: 'Acme Inc.',
                  })}
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">
                  {t('auth.setup.emailLabel', { defaultValue: 'Email' })}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('auth.setup.emailPlaceholder', { defaultValue: 'name@example.com' })}
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">
                  {t('auth.setup.passwordLabel', { defaultValue: 'Password' })}
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder={t('auth.setup.passwordHint', {
                    defaultValue: 'Minimum 8 characters',
                  })}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="mt-2 w-full" disabled={submitting}>
                {submitting
                  ? t('auth.setup.submitting', { defaultValue: 'Setting up…' })
                  : t('auth.setup.submit', { defaultValue: 'Create owner account' })}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default SetupPage;
