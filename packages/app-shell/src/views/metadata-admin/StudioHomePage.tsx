// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * StudioHomePage — the landing page for the metadata-admin ("Studio")
 * app root (`/apps/:appName/`).
 *
 * Previously the app root resolved to an empty `<Navigate>` target and
 * rendered a blank content area. This page replaces that blank space
 * with a real, data-driven overview built on the same hooks the
 * directory uses:
 *
 *   • Hero band with a time-of-day greeting + headline KPIs.
 *   • KPI cards (types / writable / packages / health) — health card
 *     deep-links to diagnostics when issues exist.
 *   • "Explore" grid — one card per metadata domain, each listing its
 *     top types as count-badged chips that link straight into the list.
 *   • Quick actions — one-click "New …" buttons for writable types.
 *   • Recently viewed — pulls from the shared RecentItemsProvider.
 *
 * All data comes from `/meta/types` + the diagnostics sweep, so the page
 * stays correct regardless of which packages are installed.
 */

import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  Database,
  Layers,
  Workflow,
  Sparkles,
  Settings,
  ShieldCheck,
  Box,
  Package as PackageIcon,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Plus,
  Clock,
  LayoutDashboard,
  FileText,
  BarChart3,
  Table2,
} from 'lucide-react';
import { Button } from '@object-ui/components';
import { useRecentItems, type RecentItem } from '../../context/RecentItemsProvider';
import {
  useMetadataClient,
  useMetadataTypes,
  useGlobalDiagnostics,
  type RichMetadataTypeEntry,
} from './useMetadata';
import { MetadataQuickFind } from './QuickFind';
import {
  translateMetadataType,
  translateMetadataDomain,
  t,
  tFormat,
  detectLocale,
} from './i18n';

const HIDDEN_TYPES = new Set(['field', 'package']);

const DOMAIN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  data: Database,
  ui: Layers,
  automation: Workflow,
  ai: Sparkles,
  system: Settings,
  platform: Settings,
  identity: ShieldCheck,
  security: ShieldCheck,
};

/** Per-domain accent gradients — used for icon chips + chip hover rings. */
const DOMAIN_ACCENT: Record<string, { from: string; to: string; ring: string; text: string }> = {
  data: { from: 'from-sky-500', to: 'to-blue-600', ring: 'hover:ring-sky-400/40', text: 'text-sky-600 dark:text-sky-400' },
  ui: { from: 'from-violet-500', to: 'to-fuchsia-600', ring: 'hover:ring-violet-400/40', text: 'text-violet-600 dark:text-violet-400' },
  automation: { from: 'from-amber-500', to: 'to-orange-600', ring: 'hover:ring-amber-400/40', text: 'text-amber-600 dark:text-amber-400' },
  ai: { from: 'from-pink-500', to: 'to-rose-600', ring: 'hover:ring-pink-400/40', text: 'text-pink-600 dark:text-pink-400' },
  identity: { from: 'from-emerald-500', to: 'to-teal-600', ring: 'hover:ring-emerald-400/40', text: 'text-emerald-600 dark:text-emerald-400' },
  security: { from: 'from-emerald-500', to: 'to-teal-600', ring: 'hover:ring-emerald-400/40', text: 'text-emerald-600 dark:text-emerald-400' },
  system: { from: 'from-slate-500', to: 'to-slate-700', ring: 'hover:ring-slate-400/40', text: 'text-slate-600 dark:text-slate-300' },
  platform: { from: 'from-slate-500', to: 'to-slate-700', ring: 'hover:ring-slate-400/40', text: 'text-slate-600 dark:text-slate-300' },
  other: { from: 'from-slate-400', to: 'to-slate-600', ring: 'hover:ring-slate-400/40', text: 'text-slate-600 dark:text-slate-300' },
};

const DOMAIN_ORDER = ['data', 'ui', 'automation', 'ai', 'identity', 'security', 'system', 'platform', 'other'];

/** Types that are most useful to surface as one-click "New …" actions. */
const QUICK_CREATE_ORDER = ['object', 'view', 'page', 'dashboard', 'report', 'flow', 'action', 'agent'];

const RECENT_ICONS: Record<RecentItem['type'], React.ComponentType<{ className?: string }>> = {
  object: Table2,
  dashboard: LayoutDashboard,
  page: FileText,
  report: BarChart3,
  record: Box,
  metadata: Layers,
};

function greetingKey(): string {
  const h = new Date().getHours();
  if (h < 12) return 'engine.home.greetingMorning';
  if (h < 18) return 'engine.home.greetingAfternoon';
  return 'engine.home.greetingEvening';
}

function relativeTime(iso: string, locale: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const zh = locale.startsWith('zh');
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return zh ? '刚刚' : 'just now';
  if (mins < 60) return zh ? `${mins} 分钟前` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return zh ? `${hrs} 小时前` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return zh ? `${days} 天前` : `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return zh ? `${weeks} 周前` : `${weeks}w ago`;
}

export function StudioHomePage() {
  const client = useMetadataClient();
  const { loading, entries } = useMetadataTypes(client);
  const { recentItems } = useRecentItems();
  const locale = React.useMemo(() => detectLocale(), []);
  const [searchParams, setSearchParams] = useSearchParams();

  const [projectPackages, setProjectPackages] = React.useState<
    { id: string; name: string }[] | null
  >(null);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await client.list<any>('package');
        if (cancelled) return;
        const SYSTEM_SCOPES = new Set(['system', 'cloud']);
        const rows = (list ?? [])
          .map((raw) => {
            const item =
              raw && typeof raw === 'object' && 'item' in raw ? raw.item : raw;
            const m = ((item as any)?.manifest ?? item ?? {}) as Record<string, unknown>;
            return {
              id: m.id as string,
              scope: m.scope as string,
              name: (m.name as string) || (m.id as string),
            };
          })
          .filter((p) => p.id && !SYSTEM_SCOPES.has(p.scope));
        rows.sort((a, b) => a.name.localeCompare(b.name));
        setProjectPackages(rows.map((p) => ({ id: p.id, name: p.name })));
      } catch {
        if (!cancelled) setProjectPackages([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  const urlPackage = searchParams.get('package');
  const activePackage = React.useMemo(() => {
    if (!projectPackages) return null;
    if (urlPackage && projectPackages.some((p) => p.id === urlPackage)) return urlPackage;
    return projectPackages[0]?.id ?? null;
  }, [projectPackages, urlPackage]);

  React.useEffect(() => {
    if (!projectPackages || projectPackages.length === 0) return;
    if (urlPackage && projectPackages.some((p) => p.id === urlPackage)) return;
    const next = new URLSearchParams(searchParams);
    next.set('package', projectPackages[0].id);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPackages, urlPackage]);

  const packageSuffix = activePackage ? `?package=${encodeURIComponent(activePackage)}` : '';
  const metadataHref = `metadata${packageSuffix}`;
  const packagesHref = `component/developer/packages${packageSuffix}`;
  const {
    summary: diagSummary,
    countsByType,
    packagesByType,
    loading: diagLoading,
  } = useGlobalDiagnostics(client, 'warning', activePackage ?? undefined);

  const visible = React.useMemo(
    () =>
      entries.filter((e) => {
        if (HIDDEN_TYPES.has(e.type)) return false;
        if (!activePackage) return false;
        return (packagesByType[e.type] ?? []).includes(activePackage);
      }),
    [activePackage, entries, packagesByType],
  );
  const writable = React.useMemo(
    () => visible.filter((e) => e.allowOrgOverride || e.allowRuntimeCreate),
    [visible],
  );

  // Group visible types by domain, sorted by count desc within each group.
  const grouped = React.useMemo(() => {
    const map: Record<string, RichMetadataTypeEntry[]> = {};
    for (const e of visible) (map[e.domain ?? 'other'] ??= []).push(e);
    for (const list of Object.values(map)) {
      list.sort((a, b) => (countsByType[b.type] ?? 0) - (countsByType[a.type] ?? 0));
    }
    return Object.entries(map).sort(
      ([a], [b]) =>
        (DOMAIN_ORDER.indexOf(a) === -1 ? 99 : DOMAIN_ORDER.indexOf(a)) -
        (DOMAIN_ORDER.indexOf(b) === -1 ? 99 : DOMAIN_ORDER.indexOf(b)),
    );
  }, [visible, countsByType]);

  const quickCreate = React.useMemo(() => {
    const byType = new Map(writable.map((e) => [e.type, e]));
    return QUICK_CREATE_ORDER.map((ty) => byType.get(ty)).filter(Boolean) as RichMetadataTypeEntry[];
  }, [writable]);

  const issues = diagSummary.total;
  const healthy = !loading && !diagLoading && issues === 0;

  if (loading || projectPackages === null || (activePackage && diagLoading)) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
        {t('engine.home.loading', locale)}
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-gradient-to-b from-muted/40 to-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-6 space-y-6">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-7 py-8 text-white shadow-xl shadow-violet-500/20">
          {/* Decorative blurred blobs + dot grid */}
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-fuchsia-300/20 blur-3xl" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
              backgroundSize: '18px 18px',
            }}
          />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                <Sparkles className="h-4 w-4" />
                {t(greetingKey(), locale)}
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Studio</h1>
              <p className="mt-2 text-sm leading-relaxed text-white/85 sm:text-base">
                {t('engine.home.subtitle', locale)}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <Button
                  asChild
                  size="sm"
                  variant="ghost"
                  className="bg-white/10 text-white shadow-sm ring-1 ring-white/25 hover:bg-white/20 hover:text-white"
                >
                  <Link to={metadataHref}>
                    <Layers className="mr-1.5 h-4 w-4" />
                    {t('engine.home.browseAll', locale)}
                  </Link>
                </Button>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm">
                  <Search className="h-3.5 w-3.5" />
                  {t('engine.directory.quickFind', locale)} ⌘⇧M
                </span>
              </div>
            </div>

            {/* Inline glass KPI pills */}
            <div className="grid grid-cols-3 gap-3">
              <HeroPill value={visible.length} label={t('engine.home.statTypes', locale)} />
              <HeroPill value={writable.length} label={t('engine.home.statWritable', locale)} />
              <HeroPill value={projectPackages.length} label={t('engine.home.statPackages', locale)} />
            </div>
          </div>
        </section>

        {/* ── KPI cards ────────────────────────────────────────── */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={Layers}
            from="from-indigo-500"
            to="to-violet-600"
            value={visible.length}
            label={t('engine.home.statTypes', locale)}
            to_link={metadataHref}
          />
          <StatCard
            icon={CheckCircle2}
            from="from-sky-500"
            to="to-blue-600"
            value={writable.length}
            label={t('engine.home.statWritable', locale)}
            to_link={metadataHref}
          />
          <StatCard
            icon={PackageIcon}
            from="from-emerald-500"
            to="to-teal-600"
            value={projectPackages.length}
            label={t('engine.home.statPackages', locale)}
            to_link={packagesHref}
          />
          {/* Health card — swaps colour + meaning based on diagnostics. */}
          <Link
            to={healthy ? metadataHref : `metadata/_diagnostics${packageSuffix}`}
            className={
              'group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg ' +
              (healthy
                ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/30'
                : 'border-amber-300 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/30')
            }
          >
            <div className="flex items-center justify-between">
              <div
                className={
                  'flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ' +
                  (healthy ? 'from-emerald-500 to-teal-600' : 'from-amber-500 to-orange-600')
                }
              >
                {healthy ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tabular-nums">
                {healthy ? t('engine.home.allHealthy', locale) : issues}
              </div>
              <div className="text-xs text-muted-foreground">
                {healthy
                  ? t('engine.home.allHealthyHint', locale)
                  : t('engine.home.statIssues', locale)}
              </div>
            </div>
          </Link>
        </section>

        {/* ── Quick actions ────────────────────────────────────── */}
        {quickCreate.length > 0 && (
          <section>
            <SectionHeader
              icon={Plus}
              title={t('engine.home.quickActions', locale)}
              hint={t('engine.home.quickActionsHint', locale)}
            />
            <div className="mt-3 flex flex-wrap gap-2.5">
              {quickCreate.map((e) => (
                <Button
                  key={e.type}
                  asChild
                  variant="outline"
                  size="sm"
                  className="group rounded-full border-transparent bg-muted hover:bg-primary/10 hover:text-primary"
                >
                  <Link to={`metadata/${encodeURIComponent(e.type)}/new${packageSuffix}`}>
                    <Plus className="mr-1 h-3.5 w-3.5 text-primary transition-transform group-hover:rotate-90" />
                    {tFormat('engine.home.newItem', locale, {
                      label: translateMetadataType(e.type, locale, e.label),
                    })}
                  </Link>
                </Button>
              ))}
            </div>
          </section>
        )}

        {/* ── Explore + Recent ─────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Explore domains */}
          <section className="lg:col-span-2">
            <SectionHeader
              icon={Layers}
              title={t('engine.home.explore', locale)}
              hint={t('engine.home.exploreHint', locale)}
            />
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {grouped.map(([domain, group]) => (
                <DomainCard
                  key={domain}
                  domain={domain}
                  group={group}
                  countsByType={countsByType}
                  locale={locale}
                  packageSuffix={packageSuffix}
                />
              ))}
            </div>
          </section>

          {/* Recently viewed */}
          <section>
            <SectionHeader icon={Clock} title={t('engine.home.recent', locale)} />
            <div className="mt-3 rounded-2xl border bg-card p-2">
              {recentItems.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                  {t('engine.home.recentEmpty', locale)}
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {recentItems.slice(0, 8).map((item) => {
                    const Icon = RECENT_ICONS[item.type] ?? Box;
                    return (
                      <li key={item.id}>
                        <Link
                          to={item.href}
                          className="group flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-accent"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{item.label}</span>
                            <span className="block text-[11px] text-muted-foreground">
                              {relativeTime(item.visitedAt, locale)}
                            </span>
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Mount the ⌘⇧M quick-find palette while the home page is on screen. */}
      <MetadataQuickFind />
    </div>
  );
}

function HeroPill({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-white/15 px-4 py-3 text-center backdrop-blur-sm ring-1 ring-white/20">
      <div className="text-2xl font-bold tabular-nums leading-none">{value}</div>
      <div className="mt-1 text-[11px] font-medium text-white/80">{label}</div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  from,
  to,
  value,
  label,
  to_link,
}: {
  icon: React.ComponentType<{ className?: string }>;
  from: string;
  to: string;
  value: number;
  label: string;
  to_link: string;
}) {
  return (
    <Link
      to={to_link}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
    >
      <div className="flex items-center justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${from} ${to} text-white shadow-sm`}>
          <Icon className="h-5 w-5" />
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </Link>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline gap-2.5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </h2>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function DomainCard({
  domain,
  group,
  countsByType,
  locale,
  packageSuffix,
}: {
  domain: string;
  group: RichMetadataTypeEntry[];
  countsByType: Record<string, number>;
  locale: string;
  packageSuffix: string;
}) {
  const Icon = DOMAIN_ICONS[domain] ?? Box;
  const accent = DOMAIN_ACCENT[domain] ?? DOMAIN_ACCENT.other;
  const top = group.slice(0, 6);
  const more = group.length - top.length;
  return (
    <div className={`group rounded-2xl border bg-card p-4 ring-1 ring-transparent transition-all hover:-translate-y-0.5 hover:shadow-lg ${accent.ring}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${accent.from} ${accent.to} text-white shadow-sm`}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{translateMetadataDomain(domain, locale)}</div>
          <div className="text-[11px] text-muted-foreground">
            {group.length} {t('engine.home.typesLower', locale)}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {top.map((e) => (
          <Link
            key={e.type}
            to={`metadata/${encodeURIComponent(e.type)}${packageSuffix}`}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-2 py-1 text-xs transition-colors hover:border-primary/50 hover:bg-accent"
          >
            <span className="truncate max-w-[10rem]">{translateMetadataType(e.type, locale, e.label)}</span>
            <span className="tabular-nums text-[10px] text-muted-foreground">{countsByType[e.type] ?? 0}</span>
          </Link>
        ))}
        {more > 0 && (
          <Link
            to={`metadata${packageSuffix}`}
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${accent.text} hover:underline`}
          >
            +{more}
          </Link>
        )}
      </div>
    </div>
  );
}
