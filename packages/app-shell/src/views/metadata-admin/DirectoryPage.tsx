// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * MetadataDirectoryPage — registry-driven landing page (Phase 3c).
 *
 * Replaces the Phase 3b placeholder. Improvements:
 *   • Search across type id + label + description.
 *   • Domain filter chips with counts.
 *   • "Writable only" toggle for admins triaging permissions work.
 *   • Tiles show: label, machine name, item count (lazy fetched per
 *     type when in view), badges (writable / overlay), description.
 *
 * Item counts are lazy — we only fetch when the user lands on a
 * domain that has it. For MVP we just show "—" until the user clicks
 * into a type. Pre-fetching all 27 counts on page load is wasteful.
 */

import * as React from 'react';
import { Link } from 'react-router-dom';
import { Search, Database, Layers, Workflow, Sparkles, Settings, ShieldCheck, Box, AlertTriangle, Package as PackageIcon } from 'lucide-react';
import { Input } from '@object-ui/components';
import { Button } from '@object-ui/components';
import { Badge } from '@object-ui/components';
import { Kbd } from '@object-ui/components';
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@object-ui/components';
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

const DOMAIN_ORDER = [
  'data',
  'ui',
  'automation',
  'ai',
  'identity',
  'security',
  'system',
  'platform',
  'other',
];

/**
 * Types intentionally hidden from the directory + list views.
 *
 * `field` is managed in-context via the parent object's edit form
 * (master-detail widget). A flat global list of every field across
 * every object is rarely useful and clutters the admin surface.
 */
const HIDDEN_TYPES = new Set(['field']);

export function MetadataDirectoryPage() {
  const client = useMetadataClient();
  const { loading, error, entries } = useMetadataTypes(client);
  const {
    byType: invalidByType,
    warnByType,
    summary: diagSummary,
    countsByType,
    packagesByType,
    allPackages,
  } = useGlobalDiagnostics(client, 'warning');
  const locale = React.useMemo(() => detectLocale(), []);

  const [query, setQuery] = React.useState('');
  const [domainFilter, setDomainFilter] = React.useState<string>('all');
  const [writableOnly, setWritableOnly] = React.useState(false);
  const [packageFilter, setPackageFilter] = React.useState<string>('all');

  // Counts per domain for the filter chip bar.
  const domainCounts = React.useMemo(() => {
    const visible = entries.filter((e) => !HIDDEN_TYPES.has(e.type));
    const c: Record<string, number> = { all: visible.length };
    for (const e of visible) {
      const d = e.domain ?? 'other';
      c[d] = (c[d] ?? 0) + 1;
    }
    return c;
  }, [entries]);

  const writableCount = entries.filter(
    (e) => !HIDDEN_TYPES.has(e.type) && (e.allowOrgOverride || e.allowRuntimeCreate),
  ).length;

  const filtered = entries.filter((e) => {
    if (HIDDEN_TYPES.has(e.type)) return false;
    if (writableOnly && !(e.allowOrgOverride || e.allowRuntimeCreate)) return false;
    if (domainFilter !== 'all' && (e.domain ?? 'other') !== domainFilter) return false;
    if (packageFilter !== 'all') {
      const pkgs = packagesByType[e.type] ?? [];
      if (!pkgs.includes(packageFilter)) return false;
    }
    if (query) {
      const q = query.toLowerCase();
      const hit =
        e.type.toLowerCase().includes(q) ||
        (e.label ?? '').toLowerCase().includes(q) ||
        translateMetadataType(e.type, locale, e.label).toLowerCase().includes(q) ||
        (e.description ?? '').toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  });

  // Group filtered by domain for display.
  const grouped = React.useMemo(() => {
    const map: Record<string, RichMetadataTypeEntry[]> = {};
    for (const e of filtered) (map[e.domain ?? 'other'] ??= []).push(e);
    return Object.entries(map).sort(([a], [b]) => {
      const ai = DOMAIN_ORDER.indexOf(a);
      const bi = DOMAIN_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [filtered]);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">{t('engine.directory.loading', locale)}</div>;
  }
  if (error) {
    return (
      <div className="p-6 text-sm text-destructive">{t('engine.directory.loadFailed', locale)}: {error}</div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b bg-background">
        <h1 className="text-xl font-semibold">{t('engine.directory.title', locale)}</h1>
        <p
          className="text-sm text-muted-foreground mt-1 max-w-3xl"
          dangerouslySetInnerHTML={{
            __html: tFormat('engine.directory.description', locale, {
              count: `<strong class="text-foreground">${entries.filter((e) => !HIDDEN_TYPES.has(e.type)).length}</strong>`,
              writable: writableCount,
            }),
          }}
        />

        {/* Filter row */}
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-lg">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={t('engine.directory.search', locale)}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button
            variant={writableOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setWritableOnly((w) => !w)}
          >
            {t('engine.directory.writableOnly', locale)} ({writableCount})
          </Button>
          {allPackages.length > 0 && (
            <Select value={packageFilter} onValueChange={setPackageFilter}>
              <SelectTrigger className="h-8 w-[220px] text-xs">
                <PackageIcon className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                <SelectValue placeholder={t('engine.directory.allPackages', locale)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('engine.directory.allPackages', locale)} ({allPackages.length})
                </SelectItem>
                {allPackages.map((p) => (
                  <SelectItem key={p} value={p}>
                    <span className="font-mono text-xs">{p}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {diagSummary.total > 0 && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Link to="./_diagnostics">
                <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                {tFormat('engine.directory.diagnosticsLink', locale, { count: diagSummary.total })}
              </Link>
            </Button>
          )}
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            {t('engine.directory.quickFind', locale)} <Kbd>⌘</Kbd><Kbd>⇧</Kbd><Kbd>M</Kbd>
          </div>
        </div>

        {/* Domain chips */}
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          <DomainChip
            domain="all"
            label={t('engine.directory.all', locale)}
            active={domainFilter === 'all'}
            count={domainCounts.all ?? 0}
            onClick={() => setDomainFilter('all')}
          />
          {DOMAIN_ORDER.filter((d) => domainCounts[d]).map((d) => (
            <DomainChip
              key={d}
              domain={d}
              label={translateMetadataDomain(d, locale)}
              active={domainFilter === d}
              count={domainCounts[d] ?? 0}
              onClick={() => setDomainFilter(d)}
            />
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {filtered.length === 0 && (
          <Empty>
            <EmptyTitle>{t('engine.directory.noMatches', locale)}</EmptyTitle>
            <EmptyDescription>
              {t('engine.directory.noMatchesHint', locale)}
            </EmptyDescription>
          </Empty>
        )}
        {grouped.map(([domain, group]) => {
          const Icon = DOMAIN_ICONS[domain] ?? Box;
          return (
            <section key={domain} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5" />
                {translateMetadataDomain(domain, locale)} ({group.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.map((e) => {
                  // When a package filter is active, show the count
                  // *constrained to that package* so the tile number
                  // matches what the user will see after clicking
                  // into the list page.
                  const totalCount = countsByType[e.type] ?? 0;
                  const showFiltered = packageFilter !== 'all';
                  return (
                    <TypeTile
                      key={e.type}
                      entry={e}
                      locale={locale}
                      invalidCount={invalidByType[e.type] ?? 0}
                      warnCount={warnByType[e.type] ?? 0}
                      itemCount={totalCount}
                      packageFilter={showFiltered ? packageFilter : undefined}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Mount Cmd+Shift+M quickfind palette globally while this page
          is on screen. The palette itself is a Dialog so it can render
          anywhere in the tree. */}
      <MetadataQuickFind />
    </div>
  );
}

function DomainChip({
  domain,
  label,
  active,
  count,
  onClick,
}: {
  domain: string;
  label?: string;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'px-2.5 py-1 rounded-full text-xs border transition-colors ' +
        (active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background hover:bg-accent border-border text-muted-foreground')
      }
    >
      {label ?? domain} <span className="opacity-70 ml-0.5">({count})</span>
    </button>
  );
}

function TypeTile({
  entry,
  locale,
  invalidCount = 0,
  warnCount = 0,
  itemCount = 0,
  packageFilter,
}: {
  entry: RichMetadataTypeEntry;
  locale?: string;
  invalidCount?: number;
  warnCount?: number;
  itemCount?: number;
  /** When set, navigate into the list page pre-filtered to this package. */
  packageFilter?: string;
}) {
  // Prefer the locale-table translation; fall back to server's `label` (typically English).
  const label = translateMetadataType(entry.type, locale, entry.label);
  const href = packageFilter
    ? `./${encodeURIComponent(entry.type)}?package=${encodeURIComponent(packageFilter)}`
    : `./${encodeURIComponent(entry.type)}`;
  return (
    <Link
      to={href}
      className={
        'block p-4 border rounded-lg hover:bg-accent transition-colors ' +
        (invalidCount > 0
          ? 'border-destructive/40 hover:border-destructive'
          : 'hover:border-primary')
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate flex items-center gap-1.5">
            {invalidCount > 0 && (
              <span
                title={tFormat('engine.directory.invalidTooltip', locale ?? 'en', { count: invalidCount })}
                aria-label={tFormat('engine.directory.invalidTooltip', locale ?? 'en', { count: invalidCount })}
              >
                <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
              </span>
            )}
            {label}
          </div>
          <code className="text-xs text-muted-foreground font-mono">
            {entry.type}
          </code>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge
            variant="secondary"
            className="text-[10px] tabular-nums"
            title={tFormat('engine.directory.itemCountTooltip', locale ?? 'en', { count: itemCount })}
          >
            {itemCount}
          </Badge>
          {invalidCount > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] border-destructive/40 text-destructive bg-destructive/[0.06]"
              title={tFormat('engine.directory.invalidTooltip', locale ?? 'en', { count: invalidCount })}
            >
              {invalidCount}
            </Badge>
          )}
          {warnCount > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/[0.06]"
              title={tFormat('engine.directory.warnTooltip', locale ?? 'en', { count: warnCount })}
            >
              {warnCount}
            </Badge>
          )}
          {entry.allowOrgOverride ? (
            <Badge
              className={
                'text-[10px] ' +
                (entry.overrideSource === 'env'
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                  : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100')
              }
              title={
                entry.overrideSource === 'env'
                  ? 'Writable via OBJECTSTACK_METADATA_WRITABLE env var'
                  : 'Writable per ADR-0005 overlay opt-in'
              }
            >
              {t('engine.badge.writable', locale)}
            </Badge>
          ) : entry.allowRuntimeCreate ? (
            <Badge
              className="text-[10px] bg-sky-100 text-sky-800 hover:bg-sky-100"
              title="Code-shipped items are locked; new items can be created at runtime"
            >
              {t('engine.badge.createOnly', locale)}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              {t('engine.badge.readOnly', locale)}
            </Badge>
          )}
        </div>
      </div>
      {entry.description && (
        <div className="text-xs text-muted-foreground mt-2 line-clamp-2">
          {entry.description}
        </div>
      )}
    </Link>
  );
}
