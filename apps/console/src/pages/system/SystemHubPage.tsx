/**
 * System Hub Page
 *
 * @deprecated This hand-written card hub is superseded by the
 * metadata-driven left-side menu. ObjectStack is a metadata-driven
 * platform: every administrable surface (objects, metadata types such as
 * `datasource`) is reached through an app's `navigation[]` (defined in
 * framework `packages/platform-objects/src/apps/*.app.ts`) and rendered by
 * the standard `UnifiedSidebar` → `NavigationRenderer`. New admin surfaces
 * must be added as nav items (`type:'object'` or `type:'component'` with
 * `componentRef:'metadata:resource'`), NOT as bespoke cards/pages here.
 *
 * Unified entry point for all system administration functions.
 * Displays card-based overview linking to Apps, Users, Organizations,
 * Roles, Permissions, Audit Log, Profile management pages, and
 * dynamically generated metadata type cards from the registry.
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
} from '@object-ui/components';
import {
  Users,
  Building2,
  Shield,
  Key,
  ScrollText,
  User,
  Loader2,
  Settings as SettingsIcon,
  Store,
  Bot,
  Terminal,
  Database,
  LayoutGrid,
  Boxes,
} from 'lucide-react';
import { useAdapter } from '@object-ui/app-shell';
import { useIsWorkspaceAdmin } from '@object-ui/auth';

interface HubCard {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  countLabel: string;
  count: number | null;
  adminOnly?: boolean;
}

export function SystemHubPage() {
  const navigate = useNavigate();
  const { appName } = useParams();
  const basePath = appName ? `/apps/${appName}` : '';
  const dataSource = useAdapter();
  const isWorkspaceAdmin = useIsWorkspaceAdmin();

  const [counts, setCounts] = useState<Record<string, number | null>>({
    users: null,
    orgs: null,
    roles: null,
    permissions: null,
    auditLogs: null,
  });
  const [loading, setLoading] = useState(true);

  const fetchCounts = useCallback(async () => {
    if (!dataSource) return;
    setLoading(true);
    try {
      // TODO: Replace with count-specific API endpoint when available
      const [usersRes, orgsRes, rolesRes, permsRes, logsRes] = await Promise.all([
        dataSource.find('sys_user').catch(() => ({ data: [] })),
        dataSource.find('sys_org').catch(() => ({ data: [] })),
        dataSource.find('sys_role').catch(() => ({ data: [] })),
        dataSource.find('sys_permission').catch(() => ({ data: [] })),
        dataSource.find('sys_audit_log').catch(() => ({ data: [] })),
      ]);
      setCounts({
        users: usersRes.data?.length ?? 0,
        orgs: orgsRes.data?.length ?? 0,
        roles: rolesRes.data?.length ?? 0,
        permissions: permsRes.data?.length ?? 0,
        auditLogs: logsRes.data?.length ?? 0,
      });
    } catch {
      // Keep nulls on failure
    } finally {
      setLoading(false);
    }
  }, [dataSource]);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  // Metadata: single entry point to the server-driven metadata-admin engine.
  // Per-type cards were removed when the engine started auto-listing every
  // type registered with the framework (`/api/v1/meta`).
  const metadataTypeCards: HubCard[] = [
    {
      title: 'Applications',
      description: 'Manage all configured applications',
      icon: LayoutGrid,
      href: `${basePath}/system/apps`,
      countLabel: '',
      count: null,
    },
    {
      title: 'Metadata',
      description: 'Browse and edit every metadata type the platform exposes',
      icon: Database,
      href: `${basePath}/component/metadata/directory`,
      countLabel: '',
      count: null,
    },
    {
      title: 'Datasources',
      description: 'Connect external databases and sync their tables in as objects',
      icon: Boxes,
      href: `${basePath}/system/datasources`,
      countLabel: '',
      count: null,
    },
  ];

  // System admin cards (non-metadata, always present)
  const systemCards: HubCard[] = [
    {
      title: 'Users',
      description: 'Manage system users and accounts',
      icon: Users,
      href: `${basePath}/system/users`,
      countLabel: 'users',
      count: counts.users,
    },
    {
      title: 'Organizations',
      description: 'Manage organizations and teams',
      icon: Building2,
      href: `${basePath}/system/organizations`,
      countLabel: 'organizations',
      count: counts.orgs,
    },
    {
      title: 'Roles',
      description: 'Configure roles and access levels',
      icon: Shield,
      href: `${basePath}/system/roles`,
      countLabel: 'roles',
      count: counts.roles,
    },
    {
      title: 'Permissions',
      description: 'Manage permission rules and assignments',
      icon: Key,
      href: `${basePath}/system/permissions`,
      countLabel: 'permissions',
      count: counts.permissions,
    },
    {
      title: 'Audit Log',
      description: 'View system activity and changes',
      icon: ScrollText,
      href: `${basePath}/system/audit-log`,
      countLabel: 'entries',
      count: counts.auditLogs,
    },
    {
      title: 'AI Approvals',
      description: 'Review actions AI agents propose before they execute',
      icon: Bot,
      href: `${basePath}/system/ai-approvals`,
      countLabel: '',
      count: null,
    },
    {
      title: 'App Marketplace',
      description: 'Browse and install approved apps from the ObjectStack catalog',
      icon: Store,
      href: `${basePath}/system/marketplace`,
      countLabel: '',
      count: null,
      adminOnly: true,
    },
    {
      title: 'Settings',
      description: 'Configure mail, branding, feature flags, and more',
      icon: SettingsIcon,
      href: `${basePath}/system/settings`,
      countLabel: '',
      count: null,
    },
    {
      title: 'Developer',
      description: 'API console, flow runs, and public form management',
      icon: Terminal,
      href: `${basePath}/developer`,
      countLabel: '',
      count: null,
    },
    {
      title: 'Profile',
      description: 'View and edit your account settings',
      icon: User,
      href: `${basePath}/system/profile`,
      countLabel: '',
      count: null,
    },
  ];

  const cards: HubCard[] = [...metadataTypeCards, ...systemCards].filter(
    (c) => !c.adminOnly || isWorkspaceAdmin,
  );

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">System Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage applications, users, roles, permissions, and system configuration
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading statistics...
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.title}
              className="cursor-pointer transition-colors hover:bg-accent/50"
              onClick={() => navigate(card.href)}
              data-testid={`hub-card-${card.title.toLowerCase().replace(/\s+/g, '-')}`}
              role="link"
              tabIndex={0}
              aria-label={`${card.title}: ${card.description}`}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(card.href);
                }
              }}
            >
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base">{card.title}</CardTitle>
                  <CardDescription className="text-xs">{card.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {card.count !== null && (
                  <Badge variant="secondary">
                    {card.count} {card.countLabel}
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
