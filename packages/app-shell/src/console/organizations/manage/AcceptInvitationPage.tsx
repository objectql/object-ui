/**
 * AcceptInvitationPage
 *
 * Standalone page for accepting or rejecting an organization invitation.
 * Route: /accept-invitation/:invitationId
 *
 * Exported as `DefaultAcceptInvitationPage` and routed by `apps/console`
 * (objectui#3811) as well as by downstream apps. The page paints its own
 * full-viewport shell, so hosts mount it bare — no auth layout around it.
 */

import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@object-ui/components';
import { useAuth } from '@object-ui/auth';
import type { AuthInvitation } from '@object-ui/auth';
import { useObjectTranslation } from '@object-ui/i18n';
import { Loader2, Building2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

type InvitationWithOrg = AuthInvitation & {
  organizationName?: string;
  organizationSlug?: string;
};

export function AcceptInvitationPage() {
  const { t } = useObjectTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { invitationId } = useParams<{ invitationId: string }>();
  const { isAuthenticated, isLoading: isAuthLoading, getInvitation, acceptInvitation, rejectInvitation, switchOrganization } =
    useAuth();

  const [invitation, setInvitation] = useState<InvitationWithOrg | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  // Redirect to login if not authenticated.
  //
  // The return path comes from the ROUTER (`useLocation`), never from
  // `window.location.pathname`: `?redirect=` is a basename-stripped path by
  // contract — a host mounted under `<base href="/console/">` re-prefixes it
  // before navigating (see `apps/console` `LoginPage.withConsoleBase`), so a
  // window-derived path that already carries the mount doubles it into
  // `/console/console/accept-invitation/…`. Under the default `/` mount the two
  // spellings agree, which is why only the basename case can catch it
  // (objectui#3811).
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      navigate('/login?redirect=' + encodeURIComponent(location.pathname + location.search));
    }
  }, [isAuthenticated, isAuthLoading, navigate, location.pathname, location.search]);

  // Fetch invitation details
  useEffect(() => {
    if (!invitationId || !isAuthenticated) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getInvitation(invitationId)
      .then((inv) => {
        if (!cancelled) setInvitation(inv);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Invitation not found or expired');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [invitationId, isAuthenticated, getInvitation]);

  const handleAccept = async () => {
    if (!invitation || !invitationId) return;
    setIsAccepting(true);
    try {
      await acceptInvitation(invitationId);
      await switchOrganization(invitation.organizationId).catch(() => null);
      toast.success(t('organization.accept.accepted', { defaultValue: 'Invitation accepted' }));
      navigate('/home');
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t('organization.accept.acceptFailed', { defaultValue: 'Failed to accept invitation' }),
      );
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!invitationId) return;
    setIsDeclining(true);
    try {
      await rejectInvitation(invitationId);
      toast.success(t('organization.accept.declined', { defaultValue: 'Invitation declined' }));
      navigate('/organizations');
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t('organization.accept.declineFailed', { defaultValue: 'Failed to decline invitation' }),
      );
      setIsDeclining(false);
    }
  };

  // Show spinner while auth is loading
  if (isAuthLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Will redirect if not authenticated — show nothing in the meantime
  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm" data-testid="accept-invitation-page">
        {isLoading ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {t('organization.accept.loading', { defaultValue: 'Loading invitation…' })}
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <XCircle className="h-10 w-10 text-destructive" />
            <h1 className="text-xl font-semibold">
              {t('organization.accept.errorTitle', { defaultValue: 'Invitation unavailable' })}
            </h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => navigate('/organizations')}>
              {t('organization.accept.goToOrgs', { defaultValue: 'Go to organizations' })}
            </Button>
          </div>
        ) : invitation ? (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Building2 className="h-7 w-7 text-primary" />
            </div>

            <div>
              <h1 className="text-xl font-bold">
                {t('organization.accept.title', { defaultValue: 'You have been invited' })}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('organization.accept.description', {
                  defaultValue:
                    'You have been invited to join {{orgName}} as {{role}}.',
                  orgName: invitation.organizationName ?? invitation.organizationId,
                  role: invitation.role,
                })}
              </p>
            </div>

            <div className="w-full rounded-lg border bg-muted/50 p-4 text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t('organization.accept.organization', { defaultValue: 'Organization' })}
                </span>
                <span className="font-medium">
                  {invitation.organizationName ?? invitation.organizationId}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t('organization.accept.role', { defaultValue: 'Role' })}
                </span>
                <span className="font-medium capitalize">{invitation.role}</span>
              </div>
              {invitation.expiresAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('organization.accept.expiresAt', { defaultValue: 'Expires' })}
                  </span>
                  <span className="font-medium">
                    {new Date(invitation.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            <div className="flex w-full gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleDecline}
                disabled={isDeclining || isAccepting}
              >
                {isDeclining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('organization.accept.decline', { defaultValue: 'Decline' })}
              </Button>
              <Button
                className="flex-1"
                onClick={handleAccept}
                disabled={isAccepting || isDeclining}
              >
                {isAccepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <CheckCircle className="mr-2 h-4 w-4" />
                {t('organization.accept.accept', { defaultValue: 'Accept invitation' })}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
