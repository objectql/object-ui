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
 * Positions, Permissions, Audit Log, Profile management pages, and
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
import { useWorkspaceAdminStatus } from '@object-ui/auth';

interface HubCard {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  countLabel: string;
  count: number | null;
  adminOnly?: boolean;
}

/**
 * One card's count from one `find` result: the row count when the lookup
 * succeeded, `null` when it did not.
 *
 * `null` is not a formatting preference — it is the only shape this page has
 * for "we do not know". The badge renders on `count !== null`, so an unknown
 * count shows no badge at all, while `0` is a claim: the backend answered, and
 * the answer was none. Collapsing a failed lookup into `0` prints a number
 * nothing ever confirmed, and a 500 / 401 / 403 / offline then looks exactly
 * like an empty table (objectui#3679).
 */
function countOrUnknown(result: { data?: unknown[] } | null): number | null {
  return result === null ? null : (result.data?.length ?? 0);
}

export function SystemHubPage() {
  const navigate = useNavigate();
  const { appName } = useParams();
  const basePath = appName ? `/apps/${appName}` : '';
  const dataSource = useAdapter();
  const { isAdmin: isWorkspaceAdmin } = useWorkspaceAdminStatus();

  const [counts, setCounts] = useState<Record<string, number | null>>({
    users: null,
    orgs: null,
    positions: null,
    permissions: null,
    auditLogs: null,
  });
  const [loading, setLoading] = useState(true);

  const fetchCounts = useCallback(async () => {
    if (!dataSource) return;
    setLoading(true);
    try {
      // Every name below must be one the framework actually registers. A name
      // it does NOT register is not a loud failure here: the backend answers
      // `404 OBJECT_NOT_FOUND` and `ObjectStackAdapter.find()` absorbs that on
      // purpose (`packages/data-objectstack/src/index.ts` — it caches the
      // resource in `missingResources` and resolves `{ data: [], total: 0 }`),
      // so a misspelled object renders a perfectly plausible `0` that no
      // administrator can tell apart from "there really are none"
      // (objectui#3670). The `.catch` on each call never even sees that case;
      // it only covers non-404 rejections.
      //
      // Verified against the framework's object registry:
      //   sys_user           packages/platform-objects/src/identity/sys-user.object.ts
      //   sys_organization   packages/platform-objects/src/identity/sys-organization.object.ts
      //   sys_position       packages/plugins/plugin-security/src/objects/sys-position.object.ts
      //   sys_permission_set packages/plugins/plugin-security/src/objects/sys-permission-set.object.ts
      //   sys_audit_log      packages/plugins/plugin-audit/src/objects/sys-audit-log.object.ts
      //
      // Permissions used to ask for `sys_permission`, which the framework does
      // NOT register, so this card read a known-wrong `0` on every deployment
      // (objectui#3670 left it pinned rather than re-aimed). The framework
      // splits that surface in two — `sys_capability` (ADR-0066 layer 1, the
      // definition registry, and the object whose docblock says it is what the
      // ADR "loosely floats" as `sys_permission`) and `sys_permission_set`
      // (ADR-0066 layer 2, the grant container the permissions docs call "the
      // only capability container"). Both exist, so either would have rendered
      // a plausible number and quietly decided which surface this card means.
      // objectui#3655 decided it: `sys_permission_set`, because the card says
      // "Manage permission rules and assignments" and rules-and-assignments is
      // layer 2. The same decision aimed this page's `system/permissions` link
      // at that object, so badge and destination now describe one thing.
      //
      // TODO: Replace with count-specific API endpoint when available
      //
      // Each `.catch` resolves to `null`, NOT to an empty page. What these
      // catches actually cover is the class the adapter does NOT absorb: it
      // rethrows everything that is not a 404, so a 500 / 401 / 403 / offline
      // / timeout lands here. Answering that with `{ data: [] }` used to print
      // a confident `0` — the same pixel as "there really are none", with no
      // error, no retry and no way for an administrator to tell the two apart
      // (objectui#3679). `null` flows into `counts` and the badge's existing
      // `count !== null` branch simply omits the badge.
      //
      // Per call rather than once around the `Promise.all`, because the most
      // reachable failure is a permission denial on ONE object — an admin who
      // may open this hub but cannot read `sys_audit_log` should lose that
      // card's number only, not the four beside it that answered fine.
      //
      // A 404 still does not reach here and still renders `0`: the adapter
      // resolves unregistered objects as an empty page on purpose (see above).
      // That is its contract, not a failure. No card rides on it by mistake any
      // more — every name below is registered — but a deployment that does not
      // install a plugin (e.g. plugin-security, which owns `sys_position` and
      // `sys_permission_set`) still gets `0` rather than "unavailable".
      const [usersRes, orgsRes, positionsRes, permsRes, logsRes] = await Promise.all([
        dataSource.find('sys_user').catch(() => null),
        dataSource.find('sys_organization').catch(() => null),
        dataSource.find('sys_position').catch(() => null),
        dataSource.find('sys_permission_set').catch(() => null),
        dataSource.find('sys_audit_log').catch(() => null),
      ]);
      setCounts({
        users: countOrUnknown(usersRes),
        orgs: countOrUnknown(orgsRes),
        positions: countOrUnknown(positionsRes),
        permissions: countOrUnknown(permsRes),
        auditLogs: countOrUnknown(logsRes),
      });
    } catch {
      // Keep nulls on failure. Only a SYNCHRONOUS throw from `dataSource.find`
      // can arrive here: the `.catch`es above are attached to the returned
      // promises, so nothing makes `Promise.all` reject. That is why this
      // branch is not where the fix went — leaving the counts untouched only
      // says "unknown" because they are still `null`, and `setCounts` above is
      // the only place a lookup's outcome is ever written.
    } finally {
      setLoading(false);
    }
  }, [dataSource]);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  // Metadata: single entry point to the server-driven metadata-admin engine.
  // Per-type cards were removed when the engine started auto-listing every
  // type registered with the framework (`/api/v1/meta`).
  //
  // The two metadata cards below name the engine's CANONICAL routes —
  // `…/metadata` (directory) and `…/metadata/:type` (one type's list), declared
  // by `DefaultAppContent` in `@object-ui/app-shell`. NOT the older
  // `…/component/metadata/{directory,resource?type=}` spelling they used to
  // carry (objectui#3660): app-shell declares that as a legacy *alias* whose
  // route element is `LegacyMetadataRedirect`, i.e. a bare `<Navigate>` onto
  // precisely the targets below. Aiming a card at it bought a redundant hop and
  // a re-render on every click. The alias routes themselves stay declared —
  // bookmarks and external links still land on them — this only stops the hub
  // feeding its own traffic through them (same disposition as objectui#3639,
  // which corrected the console host's two redirects).
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
      href: `${basePath}/metadata`,
      countLabel: '',
      count: null,
    },
    {
      title: 'Datasources',
      description: 'Connect external databases and sync their tables in as objects',
      icon: Boxes,
      href: `${basePath}/metadata/datasource`,
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
      title: 'Positions',
      description: 'Configure positions and access levels',
      icon: Shield,
      href: `${basePath}/system/positions`,
      countLabel: 'positions',
      count: counts.positions,
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
          Manage applications, users, positions, permissions, and system configuration
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
