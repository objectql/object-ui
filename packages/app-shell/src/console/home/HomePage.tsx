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
 * - Empty state guidance for new users
 * - Responsive grid layout
 * - i18n support
 *
 * @module
 */

import { useMemo, useState, useEffect, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMetadata } from '../../providers/MetadataProvider';
import { useRecentItems } from '../../hooks/useRecentItems';
import { useFavorites } from '../../hooks/useFavorites';
import { useObjectTranslation } from '@object-ui/i18n';
import { useAuth, useIsWorkspaceAdmin } from '@object-ui/auth';
import { AppCard } from './AppCard';
import { RecentApps } from './RecentApps';
import { StarredApps } from './StarredApps';
import { Empty, EmptyTitle, EmptyDescription, Button } from '@object-ui/components';
import { Plus, Settings, Sparkles, Star, Clock, ArrowDown, Store, LayoutGrid, ShieldAlert, X, UploadCloud } from 'lucide-react';
import { useMetadataClient } from '../../views/metadata-admin/useMetadata';
import { toast } from 'sonner';

function pickGreetingKey(hour: number): string {
  if (hour < 5) return 'home.greetingNight';
  if (hour < 12) return 'home.greetingMorning';
  if (hour < 18) return 'home.greetingAfternoon';
  if (hour < 23) return 'home.greetingEvening';
  return 'home.greetingNight';
}

/**
 * Friendly onboarding hint shown above the All Apps grid when the user has
 * no starred or recent items yet. Replaces per-section empty states (which
 * would flicker as the backend adapter hydrates).
 */
function GettingStartedHint({ t }: { t: (key: string, opts?: any) => string }) {
  return (
    <section
      data-testid="home-getting-started"
      className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20 text-amber-600 dark:text-amber-400">
            <Star className="h-5 w-5" />
          </span>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <Clock className="h-5 w-5" />
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">
            {t('home.gettingStarted.title', { defaultValue: 'Make this home yours' })}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            {t('home.gettingStarted.description', {
              defaultValue:
                'Star an app to pin it here for one-click access. Anything you open will show up under Recently Accessed automatically.',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span>{t('home.gettingStarted.cta', { defaultValue: 'Browse all applications' })}</span>
          <ArrowDown className="h-3.5 w-3.5" />
        </div>
      </div>
    </section>
  );
}

/**
 * Compact at-a-glance metric pill shown under the hero greeting — gives
 * the workspace a sense of scale ("3 apps · 6 recent · 2 starred") the
 * moment the page loads.
 */
function StatPill({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  value: number;
  label: string;
  tone: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm shadow-sm">
      <Icon className={`h-4 w-4 ${tone}`} />
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
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
  const [publishing, setPublishing] = useState(false);
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

  // One-click publish: promote every pending draft BY REFERENCE so a brand-new
  // user reaches "it's live" without hunting for a designer. (Pre-PMF activation
  // > the draft-review gate.) Publishing per-(type,name) — not per-package —
  // means a draft with no `packageId` binding still publishes, instead of the
  // banner dead-ending with "no draft packages" while the count stays stuck.
  const publish = async () => {
    setPublishing(true);
    try {
      const pending = drafts.length
        ? drafts
        : (((await client.listDrafts?.({})) as any[]) || [])
            .filter((d) => d && typeof d.type === 'string' && typeof d.name === 'string')
            .map((d) => ({ type: d.type, name: d.name }));
      if (pending.length === 0) throw new Error('nothing to publish');
      for (const d of pending) {
        await client.publishDraft(d.type, d.name);
      }
      toast.success(t('home.pendingDrafts.published', { defaultValue: 'Published! Your changes are live.' }));
      setDrafts([]);
      // Surface the now-live app — reload so the populated home shows it.
      setTimeout(() => { try { window.location.reload(); } catch { /* ignore */ } }, 700);
    } catch (e) {
      toast.error(`${t('home.pendingDrafts.publishFailed', { defaultValue: 'Publish failed' })}: ${(e as Error).message}`);
      setPublishing(false);
    }
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

  const activeApps = apps.filter((a: any) => a.active !== false && a.hidden !== true);

  const recentApps = recentItems
    .filter(item => item.type === 'object' || item.type === 'dashboard' || item.type === 'page' || item.type === 'record')
    .slice(0, 6);

  const starredApps = favorites
    .filter(item => item.type === 'object' || item.type === 'dashboard' || item.type === 'page' || item.type === 'record')
    .slice(0, 8);

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
        <Empty>
          <EmptyTitle>{t('home.welcome', { defaultValue: 'Welcome to ObjectUI' })}</EmptyTitle>
          <EmptyDescription>
            {t('home.welcomeDescription', {
              defaultValue:
                'Get started by creating your first application or configure your system settings.',
            })}
          </EmptyDescription>
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
            {/*
              AI-first magic moment: the primary CTA deep-links into the AI
              workspace preselecting the metadata-authoring agent, so a brand-new
              user goes straight from "describe your business" to a generated
              backend. Manual create / settings stay as secondary paths.
            */}
            <Button onClick={() => navigate('/ai?agent=metadata_assistant')} data-testid="build-with-ai-btn">
              <Sparkles className="mr-2 h-4 w-4" />
              {t('home.buildWithAI', { defaultValue: 'Build with AI' })}
            </Button>
            <Button variant="outline" onClick={() => navigate('/create-app')} data-testid="create-first-app-btn">
              <Plus className="mr-2 h-4 w-4" />
              {t('home.createFirstApp', { defaultValue: 'Create Your First App' })}
            </Button>
            <Button variant="outline" onClick={() => navigate('/apps/setup')} data-testid="go-to-settings-btn">
              <Settings className="mr-2 h-4 w-4" />
              {t('home.systemSettings', { defaultValue: 'System Settings' })}
            </Button>
          </div>
        </Empty>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full bg-background">
      {/*
        Content-first neutral canvas (Linear/Vercel-console style): no ambient
        color wash. Hierarchy comes from typography, spacing, and hairline
        borders + micro-shadows on cards — the only brand-color highlight is
        the gradient display name in the hero.
      */}

      <PendingDraftsBanner t={t} />
      <RecoveryPasswordReminder t={t} />

      {/* Hero */}
      <section className="px-4 sm:px-6 lg:px-8 pt-10 pb-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-3">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="uppercase tracking-wider">{t('home.title', { defaultValue: 'Home' })}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-pretty">
            <span className="text-foreground">
              {greeting}
              {displayName ? ', ' : ''}
            </span>
            {displayName && (
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent dark:from-indigo-400 dark:via-violet-400 dark:to-fuchsia-400">
                {displayName}
              </span>
            )}
            <span className="text-foreground/40">.</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground mt-2 max-w-2xl">
            {t('home.heroTagline', { defaultValue: 'Pick up where you left off, or explore something new.' })}
          </p>

          {/* AI-first action: keep the magic moment one click away even after
              the workspace has apps — describe a need, let AI build it. */}
          <div className="mt-5">
            <Button onClick={() => navigate('/ai?agent=metadata_assistant')} data-testid="home-build-with-ai">
              <Sparkles className="mr-2 h-4 w-4" />
              {t('home.buildWithAI', { defaultValue: 'Build with AI' })}
            </Button>
          </div>

          {/* At-a-glance stat pills */}
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <StatPill
              icon={LayoutGrid}
              tone="text-indigo-600 dark:text-indigo-400"
              value={activeApps.length}
              label={t('home.stats.apps', { defaultValue: 'Applications' })}
            />
            {recentItems.length > 0 && (
              <StatPill
                icon={Clock}
                tone="text-sky-600 dark:text-sky-400"
                value={recentItems.length}
                label={t('home.recentApps.title', { defaultValue: 'Recently Accessed' })}
              />
            )}
            {favorites.length > 0 && (
              <StatPill
                icon={Star}
                tone="text-amber-500 dark:text-amber-400"
                value={favorites.length}
                label={t('home.starredApps.title', { defaultValue: 'Starred' })}
              />
            )}
          </div>
        </div>
      </section>

      {/* Main content */}
      <div className="px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-7xl mx-auto space-y-10">
          {starredApps.length === 0 && recentApps.length === 0 && (
            <GettingStartedHint t={t} />
          )}
          {starredApps.length > 0 && <StarredApps items={starredApps} />}
          {recentApps.length > 0 && <RecentApps items={recentApps} />}

          <section>
            <div className="flex items-end justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                  <LayoutGrid className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {t('home.allApps', { defaultValue: 'All Applications' })}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {activeApps.length}
                    {' · '}
                    {t('home.stats.apps', { defaultValue: 'Applications' })}
                  </p>
                </div>
              </div>
              {isAdmin && (
                <Button
                  variant="outline"
                  onClick={() => navigate('/apps/setup/system/marketplace')}
                  data-testid="browse-marketplace-btn"
                >
                  <Store className="mr-2 h-4 w-4" />
                  {t('home.browseMarketplace', { defaultValue: 'Browse App Marketplace' })}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {activeApps.map((app: any, idx: number) => (
                <AppCard
                  key={app.name}
                  app={app}
                  index={idx}
                  onClick={() => navigate(`/apps/${app.name}`)}
                  isFavorite={favorites.some(f => f.id === `app:${app.name}`)}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
