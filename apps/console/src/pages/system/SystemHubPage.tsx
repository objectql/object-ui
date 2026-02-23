/**
 * System Hub Page
 *
 * Unified entry point for all system administration functions.
 * Displays card-based overview linking to Apps, Users, Organizations,
 * Roles, Permissions, Audit Log, and Profile management pages.
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
  LayoutGrid,
  Users,
  Building2,
  Shield,
  Key,
  ScrollText,
  User,
  Loader2,
} from 'lucide-react';
import { useAdapter } from '../../context/AdapterProvider';
import { useMetadata } from '../../context/MetadataProvider';

interface HubCard {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  countLabel: string;
  count: number | null;
}

export function SystemHubPage() {
  const navigate = useNavigate();
  const { appName } = useParams();
  const basePath = `/apps/${appName}`;
  const dataSource = useAdapter();
  const { apps } = useMetadata();

  const [counts, setCounts] = useState<Record<string, number | null>>({
    apps: null,
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
      const [usersRes, orgsRes, rolesRes, permsRes, logsRes] = await Promise.all([
        dataSource.find('sys_user').catch(() => ({ data: [] })),
        dataSource.find('sys_org').catch(() => ({ data: [] })),
        dataSource.find('sys_role').catch(() => ({ data: [] })),
        dataSource.find('sys_permission').catch(() => ({ data: [] })),
        dataSource.find('sys_audit_log').catch(() => ({ data: [] })),
      ]);
      setCounts({
        apps: apps?.length ?? 0,
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
  }, [dataSource, apps]);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  const cards: HubCard[] = [
    {
      title: 'Applications',
      description: 'Manage all configured applications',
      icon: LayoutGrid,
      href: `${basePath}/system/apps`,
      countLabel: 'apps',
      count: counts.apps,
    },
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
      title: 'Profile',
      description: 'View and edit your account settings',
      icon: User,
      href: `${basePath}/system/profile`,
      countLabel: '',
      count: null,
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">System Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage applications, users, roles, permissions, and system configuration
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
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
