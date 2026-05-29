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

import { useMemo, type ComponentType } from 'react';
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
import { Plus, Settings, Sparkles, Star, Clock, ArrowDown, Store, LayoutGrid } from 'lucide-react';

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
      className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-6 sm:p-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-fuchsia-500/5"
      />
      <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
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
    <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-3 py-1.5 text-sm backdrop-blur-sm">
      <Icon className={`h-4 w-4 ${tone}`} />
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
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
            <Button onClick={() => navigate('/create-app')} data-testid="create-first-app-btn">
              <Plus className="mr-2 h-4 w-4" />
              {t('home.createFirstApp', { defaultValue: 'Create Your First App' })}
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                onClick={() => navigate('/apps/setup/system/marketplace')}
                data-testid="browse-marketplace-empty-btn"
              >
                <Store className="mr-2 h-4 w-4" />
                {t('home.browseMarketplace', { defaultValue: 'Browse App Marketplace' })}
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate('/apps/setup')} data-testid="go-to-settings-btn">
              <Settings className="mr-2 h-4 w-4" />
              {t('home.systemSettings', { defaultValue: 'System Settings' })}
            </Button>
          </div>
        </Empty>
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-full bg-gradient-to-b from-background via-background to-muted/40">
      {/* Decorative ambient blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] overflow-hidden">
        <div className="absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-primary/30 blur-3xl opacity-70 dark:opacity-40" />
        <div className="absolute -top-20 right-[-6rem] h-[26rem] w-[36rem] rounded-full bg-sky-400/30 blur-3xl opacity-70 dark:opacity-35" />
        <div className="absolute top-32 left-1/3 h-[18rem] w-[24rem] rounded-full bg-fuchsia-400/25 blur-3xl opacity-60 dark:opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
      </div>

      {/* Hero */}
      <section className="px-4 sm:px-6 lg:px-8 pt-10 pb-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-3">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
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
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 ring-1 ring-indigo-500/20 text-indigo-600 dark:text-indigo-400">
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
