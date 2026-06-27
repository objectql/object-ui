/**
 * WorkspaceSwitcher
 *
 * Header-left organization (workspace) switcher — the standard place users
 * expect "which org am I in / switch org" to live (Linear/Vercel/GitHub style).
 *
 * - Single-org users (the vast majority): just the org name, NO dropdown. There
 *   is nothing to switch to, so a one-item menu would be pure friction.
 * - Multi-org users: the active org name + a dropdown to switch orgs inline
 *   (full-page reload so the active-org context refreshes app-wide, mirroring
 *   OrganizationsPage), plus shortcuts to manage members / create a workspace.
 * - No org context at all: renders nothing.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@object-ui/auth';
import type { AuthOrganization } from '@object-ui/auth';
import { useObjectTranslation } from '@object-ui/i18n';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@object-ui/components';
import { ChevronsUpDown, Check, Plus, Users } from 'lucide-react';
import { resolveHomeUrl } from '../console/organizations/resolveHomeUrl';

function getOrgInitials(name: string): string {
  return name
    .split(/[\s_-]+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function OrgBadge({ name }: { name: string }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">
      {getOrgInitials(name)}
    </span>
  );
}

export function WorkspaceSwitcher() {
  const { t } = useObjectTranslation();
  const navigate = useNavigate();
  const { organizations, activeOrganization, switchOrganization, getAuthConfig } = useAuth();
  const [multiOrgDisabled, setMultiOrgDisabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAuthConfig?.()
      .then((cfg) => {
        if (!cancelled) setMultiOrgDisabled(cfg?.features?.multiOrgEnabled === false);
      })
      .catch(() => {
        /* leave default — create entry stays available */
      });
    return () => {
      cancelled = true;
    };
  }, [getAuthConfig]);

  const orgList = organizations ?? [];
  const current = activeOrganization ?? orgList[0] ?? null;

  // No organization context (e.g. a brand-new user before provisioning) — show
  // nothing rather than an empty switcher.
  if (!current) return null;

  // Single-org: static label, no dropdown.
  if (orgList.length <= 1) {
    return (
      <span
        className="ml-2 hidden max-w-[12rem] items-center gap-1.5 sm:inline-flex"
        data-testid="workspace-name"
      >
        <OrgBadge name={current.name} />
        <span className="truncate text-sm font-medium text-foreground/80">{current.name}</span>
      </span>
    );
  }

  const handleSwitch = async (org: AuthOrganization) => {
    if (org.id === current.id) return;
    try {
      await switchOrganization(org.id);
      // switchOrganization only updates state; reload to home so the new active
      // org propagates to every data scope app-wide (same as OrganizationsPage).
      window.location.href = resolveHomeUrl();
    } catch (err) {
      console.error('[WorkspaceSwitcher] switch failed', err);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="ml-2 inline-flex max-w-[14rem] items-center gap-1.5 rounded-md px-1.5 py-1 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
        data-testid="workspace-switcher"
      >
        <OrgBadge name={current.name} />
        <span className="hidden truncate sm:inline">{current.name}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t('organization.switcher.label', { defaultValue: 'Switch organization' })}
        </DropdownMenuLabel>
        {orgList.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => handleSwitch(org)}
            className="cursor-pointer gap-2"
          >
            <OrgBadge name={org.name} />
            <span className="flex-1 truncate">{org.name}</span>
            {org.id === current.id && <Check className="h-4 w-4 shrink-0" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigate(`/organizations/${current.slug}/members`)}
          className="cursor-pointer gap-2"
          data-testid="workspace-manage-members"
        >
          <Users className="h-4 w-4" />
          {t('organization.switcher.manageMembers', { defaultValue: 'Manage members' })}
        </DropdownMenuItem>
        {!multiOrgDisabled && (
          <DropdownMenuItem
            onClick={() => navigate('/organizations?create=1')}
            className="cursor-pointer gap-2"
            data-testid="workspace-create"
          >
            <Plus className="h-4 w-4" />
            {t('organizations.create', { defaultValue: 'Create workspace' })}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
