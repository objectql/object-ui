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
import { useAgents, isBuildAgent, isAskAgent } from '@object-ui/plugin-chatbot';
import { HomeAppsStrip } from './HomeAppsStrip';
import { HomeActionCenter, HomeContinue, HomeActivity } from './HomeRail';
import { useHomeInbox } from '../../hooks/useHomeInbox';
import { appRouteSegment } from '../../utils';
import { Empty, EmptyTitle, EmptyDescription, Button } from '@object-ui/components';
import { Sparkles, ShieldAlert, X, UploadCloud, MessageSquareText, Hammer, LayoutTemplate } from 'lucide-react';
import { useMetadataClient } from '../../views/metadata-admin/useMetadata';
import { usePublishAllDrafts } from '../../preview/usePublishAllDrafts';
import { resolveAiApiBase } from '../../hooks/useAiSurface';
import { getRuntimeConfig } from '../../runtime-config';

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
    buildAvailable: agents.some((a) => isBuildAgent(a.name)),
  };
}

/**
 * Home AI call-to-action(s). "Build with AI" only when a build agent is
 * deployed; "Ask AI" only when a data/query agent is deployed. Renders nothing
 * when neither exists (AI off, or only custom agents — those are reachable via
 * the assistant launcher / FAB). `layout="stack"` is used by the empty-state;
 * the hero uses the default inline row. Availability is passed in so the host
 * fetches the catalog once.
 */
function HomeAiActions({
  askAvailable,
  buildAvailable,
  navigate,
  t,
  layout = 'row',
}: {
  askAvailable: boolean;
  buildAvailable: boolean;
  navigate: (to: string) => void;
  t: (key: string, opts?: any) => string;
  layout?: 'row' | 'stack';
}) {
  if (!askAvailable && !buildAvailable) return null;
  const container =
    layout === 'stack'
      ? 'mt-6 flex flex-col sm:flex-row items-center gap-3'
      : 'flex shrink-0 items-center gap-2';
  return (
    <div className={container}>
      {buildAvailable && (
        <Button onClick={() => navigate('/ai/build')} data-testid="home-build-with-ai">
          <Sparkles className="mr-2 h-4 w-4" />
          {t('home.buildWithAI', { defaultValue: 'Build with AI' })}
        </Button>
      )}
      {askAvailable && (
        <Button
          variant={buildAvailable ? 'outline' : 'default'}
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
  const { hasLocalPassword } = useAuth();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('os:recovery-pw-dismissed') === '1') return;
    let cancelled = false;
    Promise.resolve(hasLocalPassword?.())
      .then((has) => { if (!cancelled && has === false) setShow(true); })
      .catch(() => { /* unknown → don't nag */ });
    return () => { cancelled = true; };
  }, [hasLocalPassword]);
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
  const { pendingApprovalsCount, notifications, activities } = useHomeInbox();
  // AI CTA gating, per agent: "Build with AI" only when a build agent is
  // deployed (cloud / AI Studio); "Ask AI" only when a data agent is; neither
  // when AI isn't enabled. Community builds typically land in the ask-only state.
  const { askAvailable, buildAvailable } = useHomeAiAvailability();

  const activeApps = apps.filter((a: any) => a.active !== false && a.hidden !== true);

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
        */}
        {isAdmin ? (
          <Empty>
            <EmptyTitle>{t('home.welcome', { product: getRuntimeConfig().branding.productName, defaultValue: 'Welcome to {{product}}' })}</EmptyTitle>
            <EmptyDescription>
              {buildAvailable
                ? t('home.welcomeAdminDescription', {
                    defaultValue:
                      'Describe your business in one sentence — AI generates the objects, screens, APIs and agent tools. Or set things up yourself from the Administration menu on the left.',
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
                  'There are no applications available to you yet. Please contact your workspace administrator.',
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
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => navigate('/studio')}
                className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3.5 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Hammer className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">
                    {t('home.build.title', { defaultValue: 'Build an app' })}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {t('home.build.subtitle', {
                      defaultValue: 'Start from scratch — design objects, forms, automations and interfaces.',
                    })}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/apps/setup/system/marketplace')}
                className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3.5 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <LayoutTemplate className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">
                    {t('home.template.title', { defaultValue: 'Start with a template' })}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {t('home.template.subtitle', {
                      defaultValue: 'Install a template app from the marketplace and customize it.',
                    })}
                  </span>
                </span>
              </button>
            </div>
          )}

          {/* Your apps — compact, scalable launcher (favorites first) */}
          <HomeAppsStrip
            apps={activeApps}
            favorites={favorites}
            onOpen={(app) => navigate(`/apps/${appRouteSegment(app) ?? app.name}`)}
            onBrowseMarketplace={() => navigate('/apps/setup/system/marketplace')}
            isAdmin={isAdmin}
          />

          {/* Action center — what needs the user; leads the dashboard */}
          <div className="mb-6">
            <HomeActionCenter
              pendingApprovalsCount={pendingApprovalsCount}
              notifications={notifications}
              onOpenApprovals={() => navigate('/apps/setup/system/approvals')}
              onOpenNotification={(n) => navigate(n.actionUrl || '/apps/setup/sys_inbox_message?view=mine')}
              t={t}
            />
          </div>

          {/* Continue where you left off + ambient activity */}
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <HomeContinue items={recentApps} onOpen={(href) => navigate(href)} t={t} />
            <HomeActivity items={activities} onViewAll={() => navigate('/apps/setup/sys_activity')} t={t} />
          </div>
        </div>
      </div>
    </div>
  );
}
