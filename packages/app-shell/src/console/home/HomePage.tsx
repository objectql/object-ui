/**
 * HomePage
 *
 * Unified Home Dashboard (Workspace) that displays all available applications,
 * quick actions, recent items, and favorites. Inspired by Airtable/Notion home pages.
 *
 * Features:
 * - Display all active applications as cards
 * - Quick actions for creating apps, importing data, etc.
 * - Recent apps section (from useRecentItems)
 * - Starred/Favorite apps section (from useFavorites)
 * - Responsive grid layout
 * - i18n support
 *
 * @module
 */

import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMetadata } from '../../providers/MetadataProvider';
import { useRecentItems } from '../../hooks/useRecentItems';
import { useFavorites } from '../../hooks/useFavorites';
import { useObjectTranslation } from '@object-ui/i18n';
import { useAuth, useIsWorkspaceAdmin } from '@object-ui/auth';
import { usePermissions } from '@object-ui/permissions';
import { useAgents, isAskAgent, agentHasCapability } from '@object-ui/plugin-chatbot';
import { HomeAppsStrip } from './HomeAppsStrip';
import { HomeActionCenter, HomeContinue, HomeActivity } from './HomeRail';
import { useHomeInbox } from '../../hooks/useHomeInbox';
import { useNavigationContext } from '../../context/NavigationContext';
import {
  appRouteSegment,
  filterActiveApps,
  resolveHostAppSegment,
  resolveNotificationTarget,
} from '../../utils';
import { Empty, EmptyTitle, EmptyDescription, Button } from '@object-ui/components';
import { Sparkles, ShieldAlert, X, UploadCloud, MessageSquareText, Hammer, LayoutTemplate } from 'lucide-react';
import { useMetadataClient } from '../../views/metadata-admin/useMetadata';
import { usePublishAllDrafts } from '../../preview/usePublishAllDrafts';
import { resolveAiApiBase } from '../../hooks/useAiSurface';

/**
 * Which AI home CTAs to surface, driven by the live agent catalog (the single
 * source of truth) — gated PER agent, because the community edition can be in
 * any of three states:
 *  - `askAvailable` — a data/query agent (`ask`/`data_chat`) is deployed → "Ask AI".
 *  - `buildAvailable` — a build/authoring agent is deployed → "Build with AI".
 *    That's a cloud / AI-Studio feature, ABSENT on open-source builds.
 *  - `aiEnabled` — any agent at all (AI is on here in some form).
 * All false while the catalog loads or when AI isn't enabled, so nothing
 * flashes and no AI CTA appears where there's no agent to back it.
 */
function useHomeAiAvailability(): {
  aiEnabled: boolean;
  askAvailable: boolean;
  buildAvailable: boolean;
} {
  const apiBase = useMemo(() => resolveAiApiBase(), []);
  const { agents } = useAgents({ apiBase });
  return {
    aiEnabled: agents.length > 0,
    askAvailable: agents.some((a) => isAskAgent(a.name)),
    // cloud#816 — authoring availability by DECLARED capability (name-check fallback inside).
    buildAvailable: agents.some((a) => agentHasCapability(agents, a.name, 'authoring')),
  };
}

/**
 * [ADR-0066] The system capability every metadata-authoring surface behind the
 * home CTAs ultimately requires. The server is the authority (it refuses the
 * write either way); what follows is only the presentational half.
 */
const AUTHORING_CAPABILITY = 'manage_metadata';

/**
 * May this session author metadata?
 *
 * objectstack#8270 — on the EE single-database multi-tenant deployment a
 * workspace owner holds `org_owner` + `organization_admin` but NOT
 * `manage_metadata`; that absence is the intended hosted posture (maintainer
 * ruling 2026-08-13), not a missing grant. `useIsWorkspaceAdmin` reads ROLES,
 * so it says `true` for that owner and the builder CTAs rendered — the owner
 * followed "Build an app", filled in the new-package dialog, and hit a raw
 * capability refusal at submit. This consumes the answer the server already
 * gives (`GET /api/v1/auth/me/permissions` → `systemPermissions`, surfaced by
 * `MePermissionsProvider`); it does NOT re-derive permission logic client-side.
 *
 * **Unknown → fail OPEN**, the same doctrine `useCapabilityGate` states for
 * ADR-0066 gates (framework#3923): the server enforces regardless, and hiding a
 * permitted user's primary CTA on missing client data is the worse failure.
 * `MePermissionsProvider` now preserves the absent-vs-empty distinction
 * natively (objectui#4656) — `hasCapabilities` itself returns `true` when the
 * backend never reported `systemPermissions` at all (a deployment predating
 * ADR-0066), and gates normally on a real answer, including a genuinely
 * EMPTY one. This hook no longer re-derives that heuristic locally; it just
 * asks the centralized signal. The ruled case is unaffected: the EE owner's
 * set is non-empty (`manage_org_users`, `setup.access`, `setup.write`), so it
 * gates closed. Hosts with no permission provider at all already fail open
 * inside `usePermissions`.
 */
function useCanAuthorMetadata(): boolean {
  const { hasCapabilities } = usePermissions();
  return hasCapabilities([AUTHORING_CAPABILITY]);
}

/**
 * One card of the builder cover. Disabled (not hidden) when the session cannot
 * author metadata: a vanished primary CTA reads as a broken page, while a
 * dimmed one plus the reason line below explains the deployment's posture. The
 * reason also rides the native `title` so it is reachable from the card itself.
 */
function BuilderCoverCard({
  icon: Icon,
  title,
  subtitle,
  onClick,
  disabled,
  disabledReason,
  testId,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled: boolean;
  disabledReason: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      onClick={disabled ? undefined : onClick}
      data-testid={testId}
      className={[
        'flex items-start gap-3 rounded-xl border bg-card px-4 py-3.5 text-left transition-colors',
        disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-primary/50 hover:bg-muted/40',
      ].join(' ')}
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{subtitle}</span>
      </span>
    </button>
  );
}

/**
 * Home AI call-to-action(s). "Build with AI" only when a build agent is
 * deployed AND the session may author metadata; "Ask AI" only when a
 * data/query agent is deployed. Renders nothing when neither exists (AI off, or
 * only custom agents — those are reachable via the assistant launcher / FAB).
 * `layout="stack"` is used by the empty-state; the hero uses the default inline
 * row. Availability is passed in so the host fetches the catalog once.
 *
 * "Build with AI" routes to the AI authoring studio, whose output is
 * draft metadata nobody without `manage_metadata` can publish — so it is one of
 * the "any other metadata-authoring CTA" the objectstack#8270 ruling covers.
 * It is HIDDEN rather than disabled: unlike the builder cover it is not the
 * page's structural front door, the cover below already carries the visible
 * reason, and a disabled hero button next to a live "Ask AI" would read as a
 * transient failure. "Ask AI" is read-only and never gated.
 */
function HomeAiActions({
  askAvailable,
  buildAvailable,
  canAuthorMetadata,
  navigate,
  t,
  layout = 'row',
}: {
  askAvailable: boolean;
  buildAvailable: boolean;
  canAuthorMetadata: boolean;
  navigate: (to: string) => void;
  t: (key: string, opts?: any) => string;
  layout?: 'row' | 'stack';
}) {
  const showBuild = buildAvailable && canAuthorMetadata;
  if (!askAvailable && !showBuild) return null;
  const container =
    layout === 'stack'
      ? 'mt-6 flex flex-col sm:flex-row items-center gap-3'
      : 'flex shrink-0 items-center gap-2';
  return (
    <div className={container}>
      {showBuild && (
        <Button onClick={() => navigate('/ai/build')} data-testid="home-build-with-ai">
          <Sparkles className="mr-2 h-4 w-4" />
          {t('home.buildWithAI', { defaultValue: 'Build with AI' })}
        </Button>
      )}
      {askAvailable && (
        <Button
          variant={showBuild ? 'outline' : 'default'}
          onClick={() => navigate('/ai/ask')}
          data-testid="home-ask-ai"
        >
          <MessageSquareText className="mr-2 h-4 w-4" />
          {t('home.askAI', { defaultValue: 'Ask AI' })}
        </Button>
      )}
    </div>
  );
}

function pickGreetingKey(hour: number): string {
  if (hour < 5) return 'home.greetingNight';
  if (hour < 12) return 'home.greetingMorning';
  if (hour < 18) return 'home.greetingAfternoon';
  if (hour < 23) return 'home.greetingEvening';
  return 'home.greetingNight';
}

/**
 * Pending-drafts banner — closes the AI magic-moment loop. After the metadata
 * assistant drafts objects/views/apps (ADR-0033 draft-gated authoring), nothing
 * is live until the human publishes. Without this, a user who just had AI build
 * their whole system landed back on an empty-looking home with no trace of it
 * and no path to publish. This surfaces the pending drafts and routes to the
 * designer to review + publish. Disappears automatically once published
 * (listDrafts → 0).
 */
function PendingDraftsBanner({ t }: { t: (key: string, opts?: any) => string }) {
  const client = useMetadataClient();
  const [drafts, setDrafts] = useState<Array<{ type: string; name: string }>>([]);
  // Shared one-click publish (also used by the ADR-0037 draft-preview bar):
  // packages via the probed publish-drafts path, orphans by reference, health
  // surfaced in toasts. See usePublishAllDrafts for the full story.
  const { publishAll, publishing } = usePublishAllDrafts(t);
  const count = drafts.length;

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(client.listDrafts?.({}))
      .then((rows) => {
        if (cancelled || !Array.isArray(rows)) return;
        setDrafts(
          rows
            .filter((d: any) => d && typeof d.type === 'string' && typeof d.name === 'string')
            .map((d: any) => ({ type: d.type, name: d.name })),
        );
      })
      .catch(() => { /* drafts unsupported / error → don't show */ });
    return () => { cancelled = true; };
  }, [client]);

  const publish = async () => {
    const result = await publishAll();
    if (!result.ok) return;
    setDrafts([]);
    // Surface the now-live app — reload so the populated home shows it.
    setTimeout(() => { try { window.location.reload(); } catch { /* ignore */ } }, 700);
  };

  if (count <= 0) return null;
  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 rounded-xl border border-indigo-300/60 dark:border-indigo-700/50 bg-indigo-50 dark:bg-indigo-950/30 px-4 py-3">
          <UploadCloud className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
          <p className="flex-1 min-w-0 text-sm text-indigo-900 dark:text-indigo-200">
            {t('home.pendingDrafts.message', { count, defaultValue: 'You have {{count}} unpublished change(s) — publish to make them live.' })}
          </p>
          <Button size="sm" onClick={publish} disabled={publishing} data-testid="pending-drafts-publish">
            {publishing
              ? t('home.pendingDrafts.publishing', { defaultValue: 'Publishing…' })
              : t('home.pendingDrafts.cta', { defaultValue: 'Publish' })}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Dismissible nudge to set a local recovery password — shown when the user
 * signed in via SSO and has no local credential yet. We no longer force this
 * before the first session (it walled off the magic moment); this gentle,
 * one-time reminder preserves instance self-sufficiency without the friction.
 */
function RecoveryPasswordReminder({ t }: { t: (key: string, opts?: any) => string }) {
  const navigate = useNavigate();
  const { hasLocalPassword, getAuthConfig } = useAuth();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('os:recovery-pw-dismissed') === '1') return;
    // Don't nag on the very first landing: let a brand-new SSO user reach
    // their magic moment (build their first app) before asking them to set a
    // recovery password. Record the first home visit; show the reminder only
    // from the next one on. (The component already intends 'not before the
    // first session'; previously the code still fired on the very first screen.)
    if (typeof localStorage !== 'undefined' && localStorage.getItem('os:recovery-pw-first-seen') !== '1') {
      try { localStorage.setItem('os:recovery-pw-first-seen', '1'); } catch { /* ignore */ }
      return;
    }
    let cancelled = false;
    Promise.all([
      Promise.resolve(hasLocalPassword?.()),
      Promise.resolve(getAuthConfig?.()).catch(() => null),
    ])
      .then(([has, config]: [unknown, any]) => {
        if (cancelled) return;
        // Skip on SSO-enforced envs: password login is disabled there, so a
        // recovery password can't be used — nudging for one is misleading and
        // gives a false sense of security. Same signal LoginForm uses.
        const passwordUnavailable =
          config?.features?.ssoEnforced === true || config?.emailPassword?.enabled === false;
        if (has === false && !passwordUnavailable) setShow(true);
      })
      .catch(() => { /* unknown → don't nag */ });
    return () => { cancelled = true; };
  }, [hasLocalPassword, getAuthConfig]);
  const dismiss = () => {
    try { localStorage.setItem('os:recovery-pw-dismissed', '1'); } catch { /* ignore */ }
    setShow(false);
  };
  if (!show) return null;
  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 rounded-xl border border-amber-300/60 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="flex-1 min-w-0 text-sm text-amber-900 dark:text-amber-200">
            {t('home.recoveryReminder.message', { defaultValue: 'Set a recovery password so you can still sign in if single sign-on is ever unavailable.' })}
          </p>
          <Button size="sm" variant="outline" onClick={() => navigate('/set-password')} data-testid="recovery-pw-set">
            {t('home.recoveryReminder.cta', { defaultValue: 'Set password' })}
          </Button>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t('home.recoveryReminder.dismiss', { defaultValue: 'Dismiss' })}
            className="shrink-0 rounded-md p-1 text-amber-700/70 hover:text-amber-900 dark:text-amber-300/70 dark:hover:text-amber-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { t } = useObjectTranslation();
  const { apps, loading } = useMetadata();
  const { recentItems } = useRecentItems();
  const { favorites } = useFavorites();
  const { user } = useAuth();
  const isAdmin = useIsWorkspaceAdmin();
  const { pendingApprovalsCount, notifications, unreadTopicCount, notificationsStatus, activities } =
    useHomeInbox();
  // Home renders OUTSIDE the `/apps/:appName/*` router, so there is no
  // `params.appName` to read — `currentAppName` (published by ConsoleLayout on
  // every app mount) is the only "which app is the user in" signal available
  // here, and it is undefined on a cold landing straight at `/home`.
  const { currentAppName } = useNavigationContext();
  // AI CTA gating, per agent: "Build with AI" only when a build agent is
  // deployed (cloud / AI Studio); "Ask AI" only when a data agent is; neither
  // when AI isn't enabled. Community builds typically land in the ask-only state.
  const { askAvailable, buildAvailable } = useHomeAiAvailability();
  // objectstack#8270 — the authoring CTAs below are gated on the SERVER's
  // capability answer, not on the admin ROLE: on the EE multi-tenant deploy an
  // `org_owner` is an admin (`isAdmin === true`) yet deliberately holds no
  // `manage_metadata`, so role alone offered a front door the backend refuses.
  const canAuthorMetadata = useCanAuthorMetadata();
  // Shown wherever an authoring entry point is withheld, so the posture is
  // explained on screen instead of surfacing as a refusal after a filled-in
  // dialog. Localized in all ten packs.
  const authoringGateReason = t('home.build.noCapability', {
    defaultValue:
      "Building apps isn't available in this workspace — it requires the “Manage Metadata” permission, which your account doesn't have.",
  });

  const activeApps = filterActiveApps(apps);

  /**
   * Which app hosts the app-independent pages this page links into — the
   * Approvals Inbox (objectstack#7231), the full inbox and the activity list
   * (objectui#4074). The resolution and the reasoning live in
   * `utils/appRoute.ts` so Home and the top-bar bell (`InboxPopover`) cannot
   * drift into two different answers for the same question.
   *
   * `currentAppName` is the only "which app is the user in" signal available
   * here — Home renders OUTSIDE the `/apps/:appName/*` router, so there is no
   * `params.appName` to read, and the remembered name is stale by construction
   * (undefined on a cold landing at `/home`, and it outlives the app it names).
   * That is exactly why the resolution re-checks it against the live list.
   *
   * The helper's `setup` last resort is NOT the zero-app case here:
   * `activeApps.length === 0` returns the welcome empty state below, which
   * renders no action center, so these producers never run there.
   */
  const hostAppSegment = resolveHostAppSegment(activeApps, currentAppName);

  const recentApps = recentItems
    .filter(item => item.type === 'object' || item.type === 'dashboard' || item.type === 'page' || item.type === 'record')
    .slice(0, 6);

  const greeting = useMemo(() => t(pickGreetingKey(new Date().getHours()), { defaultValue: 'Welcome' }), [t]);
  const displayName = (user?.name?.trim() || user?.email?.split('@')[0] || '').trim();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="text-muted-foreground">{t('home.loading', { defaultValue: 'Loading workspace…' })}</div>
      </div>
    );
  }

  if (activeApps.length === 0) {
    return (
      <div className="flex flex-col flex-1">
        <PendingDraftsBanner t={t} />
        <RecoveryPasswordReminder t={t} />
        <div className="flex flex-1 items-center justify-center p-6">
        {/*
          Role-aware empty state. ADMINS get the AI-first magic moment as the
          single primary CTA — "describe your business" → generated backend.
          System administration is one click away in the left "Administration"
          nav (UnifiedSidebar), so we no longer crowd the center with a System
          Settings button, and manual "Create App" is deprecated entirely.
          NON-ADMINS can't author the workspace, so they get a quiet "no apps
          yet — ask your admin" state instead of build CTAs they can't use.
          An admin WITHOUT `manage_metadata` (objectstack#8270 — the EE hosted
          posture) is a third case: telling them to "set up your first
          application from the Administration menu" is the same dead end as the
          builder CTAs, so they get the reason instead of the instruction. AI
          "Ask" stays offered — it reads data and needs no authoring capability.
        */}
        {isAdmin && !canAuthorMetadata ? (
          <Empty>
            <EmptyTitle>{t('home.noAppsTitle', { defaultValue: 'No applications yet' })}</EmptyTitle>
            <EmptyDescription data-testid="home-authoring-gate-reason-empty">
              {authoringGateReason}
            </EmptyDescription>
            <HomeAiActions
              askAvailable={askAvailable}
              buildAvailable={buildAvailable}
              canAuthorMetadata={canAuthorMetadata}
              navigate={navigate}
              t={t}
              layout="stack"
            />
          </Empty>
        ) : isAdmin ? (
          <Empty>
            {/*
              No `product` argument: `home.welcome` reads `Build your business
              system with AI` in en, with no `{{product}}` hole, so i18next
              dropped the branded name in silence (objectui#3845). The argument
              is a leftover from an earlier `Welcome to {{product}}` value; if
              white-label deployments should see their own name in the hero, that
              is a copy change to the ten packs, not an argument at this call site.
            */}
            <EmptyTitle>{t('home.welcome', { defaultValue: 'Build your business system with AI' })}</EmptyTitle>
            <EmptyDescription>
              {buildAvailable
                ? t('home.welcomeAdminDescription', {
                    defaultValue:
                      'Describe your business in one sentence — AI generates the objects, screens, APIs and agent tools. Or set things up yourself from the menu on the left.',
                  })
                : askAvailable
                  ? t('home.welcomeAdminDescriptionNoBuild', {
                      defaultValue:
                        'Set up your first application from the Administration menu on the left. Once you have data, the AI assistant can help you explore it.',
                    })
                  : t('home.welcomeAdminDescriptionNoAi', {
                      defaultValue:
                        'Set up your first application from the Administration menu on the left.',
                    })}
            </EmptyDescription>
            <HomeAiActions
              askAvailable={askAvailable}
              buildAvailable={buildAvailable}
              canAuthorMetadata={canAuthorMetadata}
              navigate={navigate}
              t={t}
              layout="stack"
            />
          </Empty>
        ) : (
          <Empty>
            <EmptyTitle>{t('home.noAppsTitle', { defaultValue: 'No applications yet' })}</EmptyTitle>
            <EmptyDescription>
              {t('home.noAppsDescription', {
                defaultValue:
                  'Your workspace is being set up — apps your admin shares with you will show up here.',
              })}
            </EmptyDescription>
          </Empty>
        )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full bg-background">
      <PendingDraftsBanner t={t} />
      <RecoveryPasswordReminder t={t} />

      <div className="px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        <div className="max-w-7xl mx-auto">
          {/* Greeting + global search + AI */}
          <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-pretty">
                <span className="text-foreground">
                  {greeting}
                  {displayName ? ', ' : ''}
                </span>
                {displayName && <span className="text-primary">{displayName}</span>}
                <span className="text-foreground/40">.</span>
              </h1>
              <p className="mt-1 text-sm sm:text-base text-muted-foreground">
                {t('home.heroTagline', { defaultValue: 'Pick up where you left off, or explore something new.' })}
              </p>
            </div>
            <HomeAiActions
              askAvailable={askAvailable}
              buildAvailable={buildAvailable}
              canAuthorMetadata={canAuthorMetadata}
              navigate={navigate}
              t={t}
            />
          </div>

          {/* Builder cover — guided creation entries (Airtable-style Home). The
            * application builder's front door lives HERE, not in a separate
            * builder app: build from scratch → /studio (pick/create a writable
            * package), or start from a template via the marketplace. Shown to
            * builders/admins only; end users just see their apps below. */}
          {isAdmin && (
            <div className="mb-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <BuilderCoverCard
                  icon={Hammer}
                  title={t('home.build.title', { defaultValue: 'Build an app' })}
                  subtitle={t('home.build.subtitle', {
                    defaultValue: 'Start from scratch — design objects, forms, automations and interfaces.',
                  })}
                  onClick={() => navigate('/studio')}
                  disabled={!canAuthorMetadata}
                  disabledReason={authoringGateReason}
                  testId="home-build-app"
                />
                <BuilderCoverCard
                  icon={LayoutTemplate}
                  title={t('home.template.title', { defaultValue: 'Start with a template' })}
                  subtitle={t('home.template.subtitle', {
                    defaultValue: 'Install a template app from the marketplace and customize it.',
                  })}
                  onClick={() => navigate('/apps/setup/system/marketplace')}
                  disabled={!canAuthorMetadata}
                  disabledReason={authoringGateReason}
                  testId="home-start-template"
                />
              </div>
              {/* The "visible reason" the ruling requires: the cover stays in
                  place (so the page doesn't read as broken) and says, on
                  screen and in the user's language, why it is inert. */}
              {!canAuthorMetadata && (
                <p
                  className="mt-2 text-xs text-muted-foreground"
                  data-testid="home-authoring-gate-reason"
                >
                  {authoringGateReason}
                </p>
              )}
            </div>
          )}

          {/* Your apps — compact, scalable launcher (favorites first) */}
          <HomeAppsStrip
            apps={activeApps}
            favorites={favorites}
            onOpen={(app) => navigate(`/apps/${appRouteSegment(app) ?? app.name}`)}
            /* Deliberately NOT resolved through `hostAppSegment` (objectui#4074
               scope guard): the marketplace is an admin-only surface that lives
               in the setup app, so `setup` here is the target, not an oversight
               — unlike the app-independent `sys_*` pages below. */
            onBrowseMarketplace={() => navigate('/apps/setup/system/marketplace')}
            isAdmin={isAdmin}
            /* objectstack#8270 — this button targets the SAME marketplace route
               as the gated "Start with a template" cover card above, so leaving
               it live would make that gate cosmetic: the withheld dead end is
               still one click away. Gated together, hidden here (a secondary
               strip-header link, with the cover's reason line already on
               screen). */
            canAuthorMetadata={canAuthorMetadata}
          />

          {/* Action center — what needs the user; leads the dashboard */}
          <div className="mb-6">
            <HomeActionCenter
              pendingApprovalsCount={pendingApprovalsCount}
              notifications={notifications}
              /* The badge's total — every unread topic, not the capped list
                 (#4329); the same number the bell above shows. */
              unreadTopicCount={unreadTopicCount}
              notificationsStatus={notificationsStatus}
              onOpenApprovals={() => navigate(`/apps/${hostAppSegment}/system/approvals`)}
              /* `action_url` is APP-RELATIVE (`/{object}/{id}`, ADR-0030 L5),
                 so it has to be hosted under an app before it is a route —
                 navigating it verbatim is objectui#5179, where the console
                 catch-all forwarded the unmatched path to `/` and the landing
                 resolver dropped the user on the default app's home with the
                 notification already marked read. `resolveNotificationTarget`
                 is shared with the top-bar bell so the two cannot answer this
                 differently. The fallback arm runs whenever a notification
                 carries no link at all; `?view=mine` selects the user-scoped
                 view, so the full page matches what the card showed
                 (objectui#4074). */
              onOpenNotification={(n) => {
                const target = resolveNotificationTarget(n.actionUrl, hostAppSegment);
                if (!target) {
                  navigate(`/apps/${hostAppSegment}/sys_inbox_message?view=mine`);
                  return;
                }
                if (target.kind === 'external') {
                  window.open(target.url, '_blank', 'noopener,noreferrer');
                  return;
                }
                navigate(target.path);
              }}
              t={t}
            />
          </div>

          {/* Continue where you left off + ambient activity */}
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <HomeContinue items={recentApps} onOpen={(href) => navigate(href)} t={t} />
            <HomeActivity items={activities} onViewAll={() => navigate(`/apps/${hostAppSegment}/sys_activity`)} t={t} />
          </div>
        </div>
      </div>
    </div>
  );
}
