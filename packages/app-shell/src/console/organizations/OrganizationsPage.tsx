/**
 * OrganizationsPage
 *
 * Supabase-style landing page that lists the organizations the current user
 * belongs to. Users can search, select (which switches the active
 * organization and navigates to `/home`), or create a new organization.
 * @module
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  Button,
  Input,
  Empty,
  EmptyTitle,
  EmptyDescription,
} from '@object-ui/components';
import { Plus, Search, Loader2 } from 'lucide-react';
import { useAuth } from '@object-ui/auth';
import type { AuthOrganization } from '@object-ui/auth';
import { useObjectTranslation } from '@object-ui/i18n';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CreateWorkspaceDialog } from './CreateWorkspaceDialog';
import { resolveHomeUrl } from './resolveHomeUrl';

function getOrgInitials(name: string): string {
  return name
    .split(/[\s_-]+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function OrganizationsPage() {
  const { t } = useObjectTranslation();
  const navigate = useNavigate();
  // Two deliberate ways to reach this page (vs the auto-skipping post-login
  // redirect): `?manage=1` (avatar menu "My Organizations") shows the picker;
  // `?create=1` (avatar menu "Create workspace") additionally opens the create
  // dialog directly. Both suppress the single-org auto-skip below so a
  // single-org user can actually reach "New organization" / the dialog.
  const [searchParams] = useSearchParams();
  const manageMode = searchParams.get('manage') === '1';
  const wantsCreate = searchParams.get('create') === '1';
  const {
    organizations,
    activeOrganization,
    isOrganizationsLoading,
    switchOrganization,
    getAuthConfig,
  } = useAuth();

  const [query, setQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  // `multiOrgEnabled === false` ⇒ server-side `beforeCreateOrganization` hook
  // blocks creation. Mirror that in the UI so users don't see a button that
  // only ever fails. Default to allowing creation until we've heard back so
  // we don't briefly hide the button on slow networks.
  const [canCreateOrg, setCanCreateOrg] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAuthConfig()
      .then((cfg) => {
        if (cancelled) return;
        if (cfg?.features?.multiOrgEnabled === false) setCanCreateOrg(false);
      })
      .catch(() => {
        /* leave default — server will still enforce */
      });
    return () => {
      cancelled = true;
    };
  }, [getAuthConfig]);

  const orgList = organizations ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orgList;
    return orgList.filter(
      (o) => o.name.toLowerCase().includes(q) || o.slug?.toLowerCase().includes(q),
    );
  }, [orgList, query]);

  const handleSelect = async (org: AuthOrganization) => {
    setSwitchingId(org.id);
    try {
      if (org.id !== activeOrganization?.id) {
        await switchOrganization(org.id);
      }
      window.location.href = resolveHomeUrl();
    } catch (err) {
      console.error('[OrganizationsPage] Failed to switch:', err);
      setSwitchingId(null);
    }
  };

  const handleCreated = (org: AuthOrganization) => {
    setIsCreateOpen(false);
    handleSelect(org);
  };

  /**
   * UX P0-1: auto-skip the picker when the user belongs to exactly one
   * organization. The picker is friction for >90% of users (single-org
   * tenants) and only useful when there's an actual choice. We still mount
   * the page (so direct navigation to `/organizations` works) but redirect
   * once orgs have finished loading.
   *
   * Guarded by a ref so we only auto-redirect once per mount — if the user
   * later creates a second org and returns here, they'll see the picker.
   */
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (autoSelectedRef.current) return;
    if (isOrganizationsLoading) return;
    if (wantsCreate) return; // came to create — don't bounce
    if (orgList.length !== 1) return;
    autoSelectedRef.current = true;
    // Single-org users have no real choice to make. In manage mode (`?manage=1`,
    // used by the Cloud app "Members" nav and the avatar "My Organizations"
    // entry), skip the pointless one-item picker and deep-link straight to that
    // org's member management; otherwise switch into the org and land on home.
    if (manageMode) {
      navigate(`/organizations/${orgList[0].slug}/members`, { replace: true });
    } else {
      void handleSelect(orgList[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOrganizationsLoading, orgList.length, manageMode, wantsCreate]);

  // Open the create dialog when arriving via the header "Create workspace"
  // entry (`?create=1`). Guarded so closing the dialog doesn't re-open it.
  const createOpenedRef = useRef(false);
  useEffect(() => {
    if (wantsCreate && !createOpenedRef.current) {
      createOpenedRef.current = true;
      setIsCreateOpen(true);
    }
  }, [wantsCreate]);

  // Show a spinner while we're either still loading, or about to auto-redirect
  // because there's only one org. This prevents the picker from briefly
  // flashing on screen for single-org users.
  const willAutoSelect =
    !wantsCreate && !isOrganizationsLoading && orgList.length === 1;
  if (isOrganizationsLoading || willAutoSelect) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {t('organizations.heading', { defaultValue: 'Your Organizations' })}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('organizations.subtitle', {
            defaultValue: 'Select an organization to continue, or create a new one.',
          })}
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('organizations.searchPlaceholder', {
              defaultValue: 'Search for an organization',
            })}
            className="pl-9"
            data-testid="organizations-search"
          />
        </div>
        {canCreateOrg && (
          <Button onClick={() => setIsCreateOpen(true)} data-testid="organizations-new">
            <Plus className="mr-2 h-4 w-4" />
            {t('organizations.new', { defaultValue: 'New organization' })}
          </Button>
        )}
      </div>

      {orgList.length === 0 ? (
        <Empty>
          <EmptyTitle>
            {t('organizations.emptyTitle', { defaultValue: 'No organizations yet' })}
          </EmptyTitle>
          <EmptyDescription>
            {t('organizations.emptyDescription', {
              defaultValue: 'Create your first organization to get started.',
            })}
          </EmptyDescription>
          {canCreateOrg && (
            <Button className="mt-6" onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('organizations.new', { defaultValue: 'New organization' })}
            </Button>
          )}
        </Empty>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t('organizations.noMatches', {
            defaultValue: 'No organizations match your search.',
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((org) => {
            const isActive = org.id === activeOrganization?.id;
            const isSwitching = switchingId === org.id;
            return (
              <button
                key={org.id}
                onClick={() => handleSelect(org)}
                disabled={isSwitching}
                className="group flex items-center gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                data-testid={`organization-card-${org.slug}`}
              >
                <Avatar className="h-10 w-10 rounded-md shrink-0">
                  {org.logo && <AvatarImage src={org.logo} alt={org.name} />}
                  <AvatarFallback className="rounded-md bg-primary/10 text-primary text-sm font-medium">
                    {getOrgInitials(org.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{org.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {isActive
                      ? t('organizations.current', { defaultValue: 'Current organization' })
                      : org.slug}
                  </div>
                </div>
                <span
                  className="text-xs text-primary underline-offset-4 hover:underline shrink-0"
                  onClick={(e) => { e.stopPropagation(); navigate(`/organizations/${org.slug}/members`); }}
                >
                  {t('organizations.manage', { defaultValue: 'Manage' })}
                </span>
                {isSwitching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </button>
            );
          })}
        </div>
      )}

      <CreateWorkspaceDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}
