// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * MetadataResourceListPage — generic list of items for a metadata type
 * (Phase 3c).
 *
 * Reads `/meta/:type`, applies registry-driven columns + search +
 * source/overlay filters, and renders an ObjectGrid-like table.
 * Each row links to its EditPage at `./:name?type=…`.
 *
 * No virtualisation in MVP — metadata lists are typically < 200 items
 * per type, well under the threshold where it'd matter.
 */

import * as React from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Search, RefreshCw, AlertTriangle, Lock } from 'lucide-react';
import { Button } from '@object-ui/components';
import { Input } from '@object-ui/components';
import { Badge } from '@object-ui/components';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@object-ui/components';
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import { PageShell } from './PageShell';
import { MetadataTypeActions } from './MetadataTypeActions';
import { CreatePackageDialog } from './PackagesPage';
import {
  useMetadataClient,
  useMetadataTypes,
  matchesQuery,
  type RichMetadataTypeEntry,
} from './useMetadata';
import {
  getMetadataResource,
  resolveResourceConfig,
} from './registry';
import { t, tFormat, translateMetadataType, useMetadataLocale } from './i18n';
import { buildPackageScopeOptions } from './package-scope';

export interface MetadataResourceListPageProps {
  type?: string;
}

type ItemRow = {
  /** Raw row from server — may be wrapped in `{ item, source, … }`. */
  raw: any;
  /** Flattened item content for display. */
  item: Record<string, unknown>;
  /**
   * Provenance classification derived from `_packageId` tag:
   *   - 'artifact' = shipped by a real code package
   *   - 'runtime'  = authored at runtime (DB-only, no packageId or sentinel)
   *
   * Server may also pre-classify via a top-level `source` field
   * ('code' / 'overlay' / 'effective'); we honor that when present
   * and fall back to packageId-derived inference otherwise.
   */
  source: 'artifact' | 'runtime';
  /**
   * Load-time Zod validation result attached by the framework
   * (`_diagnostics` on getMetaItems items). Undefined for types
   * without a registered schema.
   */
  diagnostics?: {
    valid: boolean;
    errors?: Array<{ path: string; message: string; code?: string }>;
    warnings?: Array<{ path: string; message: string }>;
  };
};

/**
 * Derive provenance from item._packageId. The `loadMetaFromDb` path
 * tags objects with the synthetic packageId 'sys_metadata' (see
 * framework protocol.ts:3092); treat that sentinel as runtime-authored.
 */
function classifyProvenance(item: Record<string, unknown>, rawSource?: string): 'artifact' | 'runtime' {
  if (rawSource === 'overlay' || rawSource === 'runtime') return 'runtime';
  if (rawSource === 'code' || rawSource === 'artifact') return 'artifact';
  const pkg = item._packageId as string | undefined;
  if (!pkg || pkg === 'sys_metadata') return 'runtime';
  return 'artifact';
}

export function MetadataResourceListPage({ type: typeProp }: MetadataResourceListPageProps) {
  const params = useParams<{ appName?: string; type?: string }>();
  const type = typeProp ?? params.type ?? '';

  if (type === 'package') {
    const appName = params.appName ?? 'studio';
    return <Navigate to={`/apps/${appName}/component/developer/packages`} replace />;
  }

  // If a fully custom ListPage is registered, render it and bail.
  // Done before any other hooks so hook count stays stable across type
  // switches between custom and default list pages.
  const customConfig = getMetadataResource(type);
  if (customConfig?.ListPage) {
    const Custom = customConfig.ListPage;
    return <Custom type={type} />;
  }

  return <DefaultMetadataList type={type} appName={params.appName} />;
}

function DefaultMetadataList({ type, appName }: { type: string; appName?: string }) {
  const navigate = useNavigate();
  const client = useMetadataClient();
  const { entries: typesEntries } = useMetadataTypes(client);
  const entry: RichMetadataTypeEntry | undefined = typesEntries.find((t) => t.type === type);
  const config = resolveResourceConfig(type, entry);

  const [items, setItems] = React.useState<ItemRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [sourceFilter, setSourceFilter] = React.useState<string>('all');
  const [searchParams, setSearchParams] = useSearchParams();
  const [refreshKey, setRefreshKey] = React.useState(0);

  // Studio is scoped to a single *project* package at a time. Load the
  // installed packages and keep only project-scoped ones — anything not
  // tagged `system`/`cloud` (a missing scope counts as project). System
  // metadata therefore never leaks: the scope selector never offers a
  // system package and an unscoped view is not allowed.
  const [projectPackages, setProjectPackages] = React.useState<
    { id: string; name: string }[] | null
  >(null);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await client.list<any>('package');
        if (cancelled) return;
        setProjectPackages(buildPackageScopeOptions(list));
      } catch {
        if (!cancelled) setProjectPackages([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  // Resolve the CURRENT APP's package so the list defaults to the scope the
  // admin is actually working in (e.g. opening Pages from the Showcase app
  // shows that app's pages, not an alphabetically-first empty template). The
  // route segment may be the app `name` or its package id, so match both.
  const [appPackage, setAppPackage] = React.useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    if (!appName) { setAppPackage(null); return; }
    (async () => {
      try {
        const apps = await client.list<any>('app');
        if (cancelled) return;
        const match = (apps ?? [])
          .map((raw) => (raw && typeof raw === 'object' && 'item' in raw ? (raw as any).item : raw))
          .find((a: any) => a?.name === appName || a?._packageId === appName);
        setAppPackage((match as any)?._packageId ?? null);
      } catch {
        if (!cancelled) setAppPackage(null);
      }
    })();
    return () => { cancelled = true; };
  }, [client, appName]);

  // Resolve the active package from the URL, validated against the project
  // package set. `null` while packages are still loading (fail closed).
  const urlPackage = searchParams.get('package');
  const activePackage = React.useMemo(() => {
    if (!projectPackages) return null;
    if (urlPackage && projectPackages.some((p) => p.id === urlPackage)) return urlPackage;
    if (projectPackages.length === 0) return null;
    // No valid URL package: prefer the CURRENT APP's package (the scope the
    // admin is working in) when it's a valid project package — this is what
    // makes "Pages" in the Showcase app default to Showcase's pages.
    if (appPackage && projectPackages.some((p) => p.id === appPackage)) return appPackage;
    // Otherwise prefer the project package that actually OWNS rows of this
    // metadata type, so the list never opens empty on an alphabetically-first
    // package that happens to own none. Falls back to the first package.
    const counts = new Map<string, number>();
    for (const row of items) {
      const pkg = (row.item as any)?._packageId;
      if (pkg && pkg !== 'sys_metadata') counts.set(pkg, (counts.get(pkg) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestN = 0;
    for (const p of projectPackages) {
      const n = counts.get(p.id) ?? 0;
      if (n > bestN) { best = p.id; bestN = n; }
    }
    return best ?? projectPackages[0]?.id ?? null;
  }, [projectPackages, urlPackage, items, appPackage]);

  // Repair `?package=` so the sidebar selector, deep-links and create/edit
  // navigation all agree on the active scope. Runs once packages resolve
  // and the URL holds no valid project package.
  React.useEffect(() => {
    if (!projectPackages || projectPackages.length === 0) return;
    if (urlPackage && projectPackages.some((p) => p.id === urlPackage)) return;
    // If the current app's package is known we can repair immediately; otherwise
    // wait for rows so `activePackage` can resolve to the package that owns this
    // type (repairing to the alphabetical-first package before then would lock
    // the list onto an empty scope).
    const appPkgValid = !!(appPackage && projectPackages.some((p) => p.id === appPackage));
    if (!appPkgValid && items.length === 0) return;
    if (!activePackage) return;
    const next = new URLSearchParams(searchParams);
    next.set('package', activePackage);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPackages, urlPackage, items, activePackage, appPackage]);

  // Carry the active package into create/edit navigation as `?package=` so
  // the editor binds newly-saved rows to that software package.
  const pkgSuffix = activePackage
    ? `?package=${encodeURIComponent(activePackage)}`
    : '';

  // ADR-0070 D3 — never start a create that would orphan the item. When a real
  // writable base exists, create into it (defaulting away from the Local/null
  // scope); when none exists yet, prompt to create a base first.
  const [showCreateBase, setShowCreateBase] = React.useState(false);
  const handleCreate = React.useCallback(() => {
    const bases = projectPackages ?? [];
    if (projectPackages !== null && bases.length === 0) {
      setShowCreateBase(true);
      return;
    }
    if (bases.length > 0 && !activePackage) {
      navigate(`./new?package=${encodeURIComponent(bases[0].id)}`);
      return;
    }
    navigate(`./new${pkgSuffix}`);
  }, [projectPackages, activePackage, pkgSuffix, navigate]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const list = await client.list<any>(type);
        if (cancelled) return;
        const rows: ItemRow[] = (list ?? []).map((raw) => {
          const item = (raw && typeof raw === 'object' && 'item' in raw ? raw.item : raw) ?? {};
          // _diagnostics may live on the unwrapped item (default) or on the
          // outer envelope when callers reshape rows; check both.
          const diagnostics =
            (item as any)?._diagnostics ?? (raw as any)?._diagnostics ?? undefined;
          return {
            raw,
            item,
            source: classifyProvenance(item, raw?.source),
            diagnostics,
          };
        });
        setItems(rows);
        setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? String(err));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, type, refreshKey]);

  const searchableFields = config.searchableFields ?? ['name', 'label', 'description'];
  // Structural scope — every row this package could ever show for this
  // type, before the user's search box / source dropdown narrow it. Header
  // counts, the source filter, and the empty-state copy all key off this so
  // a package with zero items of a type reads as "暂无…条目", not "no match
  // for an (empty) query" just because *other* packages own rows of the
  // same type (server list() is not package-scoped; we scope client-side).
  const scopedItems = React.useMemo(
    () =>
      items.filter((row) => {
        // Per-type hide hook (e.g. `view` drops the bare aggregated
        // container the framework keeps for runtime dual-read).
        if (config.listFilter && !config.listFilter(row.item)) return false;
        // Mandatory project-package scope: show nothing until a concrete
        // project package is active, then only rows tagged with it. The
        // 'sys_metadata' sentinel and untagged rows never match.
        if (!activePackage) return false;
        const pkg = (row.item as any)?._packageId;
        // Only rows tagged with the active writable base match. Untagged /
        // `sys_metadata`-provenance legacy rows have no scope of their own
        // (ADR-0070 D5 — the package-less "Local / Custom" scope is removed).
        return pkg === activePackage;
      }),
    [items, activePackage, config],
  );

  // User-driven filters (search query + source provenance) on top of scope.
  const filtered = scopedItems.filter((row) => {
    if (!matchesQuery(row.item, query, searchableFields)) return false;
    if (sourceFilter !== 'all' && row.source !== sourceFilter) return false;
    return true;
  });

  // Compute source + invalid counts for filter / header stats.
  const sourceCounts = React.useMemo(() => {
    const c = { all: scopedItems.length, artifact: 0, runtime: 0 };
    for (const r of scopedItems) {
      c[r.source]++;
    }
    return c;
  }, [scopedItems]);

  const invalidCount = React.useMemo(
    () => scopedItems.filter((r) => r.diagnostics && r.diagnostics.valid === false).length,
    [scopedItems],
  );

  // Items with warnings but no errors — softer, advisory tier. We
  // count rows (not warning instances) for consistency with `invalid`.
  const warnOnlyCount = React.useMemo(
    () =>
      scopedItems.filter(
        (r) =>
          r.diagnostics &&
          r.diagnostics.valid !== false &&
          (r.diagnostics.warnings?.length ?? 0) > 0,
      ).length,
    [scopedItems],
  );

  const columns = config.listColumns ?? defaultColumns(config.primaryKey ?? 'name');
  const locale = useMetadataLocale();
  const typeLabel = translateMetadataType(type, locale, entry?.label ?? type);

  // Localise default column labels — registered columns keep their
  // hand-authored labels (consumers may want bespoke wording).
  const localizeColumnLabel = (col: { key: string; label: string }) => {
    const tryKey = `engine.list.col.${col.key}`;
    const translated = t(tryKey, locale);
    return translated === tryKey ? col.label : translated;
  };

  return (
    <PageShell
      entry={entry ?? { type, label: type }}
      stats={[
        { label: t('engine.list.items', locale), value: scopedItems.length },
        { label: t('engine.list.filtered', locale), value: filtered.length },
        ...(invalidCount > 0
          ? [
              {
                label: t('engine.list.invalid', locale),
                value: (
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {invalidCount}
                  </span>
                ),
              },
            ]
          : []),
        ...(warnOnlyCount > 0
          ? [
              {
                label: t('engine.list.warnings', locale),
                value: (
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {warnOnlyCount}
                  </span>
                ),
              },
            ]
          : []),
      ]}
      actions={
        <>
          {/* Declarative type-level actions (GAP-1) scoped to the list
              toolbar. Per-row (`list_item`) actions are not surfaced here
              yet — they need the row's recordId from the grid. */}
          <MetadataTypeActions
            entry={entry}
            location="list_toolbar"
            onAfter={() => setRefreshKey((k) => k + 1)}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
            title={t('engine.list.refresh', locale)}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {(entry?.allowOrgOverride || entry?.allowRuntimeCreate) && (
            <Button
              size="sm"
              variant={config.createFields ? 'default' : 'outline'}
              onClick={handleCreate}
              title={
                config.createFields
                  ? tFormat('engine.list.createHint', locale, { type: typeLabel })
                  : undefined
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              {t('engine.list.create', locale)}
            </Button>
          )}
        </>
      }
    >
      <div className="p-6 space-y-4">
        <CreatePackageDialog
          open={showCreateBase}
          onOpenChange={setShowCreateBase}
          onCreated={(id) => navigate(`./new?package=${encodeURIComponent(id)}`)}
        />
        {/* Filter row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={t('engine.list.search', locale)}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('engine.list.allSources', locale)} ({sourceCounts.all})</SelectItem>
              <SelectItem value="artifact">{t('engine.list.source.artifact', locale)} ({sourceCounts.artifact})</SelectItem>
              <SelectItem value="runtime">{t('engine.list.source.runtime', locale)} ({sourceCounts.runtime})</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Body */}
        {(loading || projectPackages === null) && (
          <div className="text-sm text-muted-foreground">{t('engine.edit.loading', locale)} {type}…</div>
        )}
        {error && (
          <div className="text-sm text-destructive border border-destructive/30 rounded p-3 bg-destructive/5">
            {error}
          </div>
        )}
        {!loading && !error && projectPackages !== null && projectPackages.length === 0 && (
          <Empty>
            <EmptyTitle>No project packages installed</EmptyTitle>
            <EmptyDescription>
              Studio only shows metadata that belongs to a project software package.
              Install or create a project package to manage its metadata here.
            </EmptyDescription>
          </Empty>
        )}
        {!loading && !error && projectPackages !== null && projectPackages.length > 0 && filtered.length === 0 && (
          <Empty>
            <EmptyTitle>
              {scopedItems.length === 0
                ? tFormat('engine.list.emptyType', locale, { type: typeLabel })
                : tFormat('engine.list.emptyQuery', locale, { query })}
            </EmptyTitle>
            <EmptyDescription>
              {config.emptyStateHint ??
                (entry?.allowOrgOverride || entry?.allowRuntimeCreate
                  ? tFormat('engine.list.createHint', locale, { type: typeLabel })
                  : t('engine.list.readOnlyHint', locale))}
            </EmptyDescription>
            {scopedItems.length === 0 && (entry?.allowOrgOverride || entry?.allowRuntimeCreate) && (
              <div className="mt-4">
                <Button onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t('engine.list.create', locale)}
                </Button>
              </div>
            )}
          </Empty>
        )}
        {!loading && filtered.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className="px-3 py-2 text-left font-medium"
                      style={c.width ? { width: c.width } : undefined}
                    >
                      {localizeColumnLabel(c)}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium w-[80px]">{t('engine.list.col.source', locale)}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((row, i) => {
                  const pk = config.primaryKey ?? 'name';
                  const name = String(row.item[pk] ?? `(unnamed-${i})`);
                  // ADR-0048 — link to this row's OWNING package so the editor
                  // resolves the right item even in the unscoped "all" list
                  // where two packages may ship the same name. Falls back to the
                  // workspace suffix for runtime/overlay-only rows (no real
                  // package, or the `sys_metadata` rehydration sentinel).
                  const rowPkg = (row.item as any)._packageId as string | undefined;
                  const rowEditSuffix = rowPkg && rowPkg !== 'sys_metadata'
                    ? `?package=${encodeURIComponent(rowPkg)}`
                    : pkgSuffix;
                  const invalid = row.diagnostics?.valid === false;
                  const errorList = row.diagnostics?.errors ?? [];
                  const warnList = (row.diagnostics as any)?.warnings ?? [];
                  const warnOnly = !invalid && warnList.length > 0;
                  const errorTitle = invalid
                    ? errorList
                        .slice(0, 3)
                        .map((e) => `${e.path || '(root)'}: ${e.message}`)
                        .join('\n') +
                      (errorList.length > 3 ? `\n+${errorList.length - 3} more` : '')
                    : warnOnly
                      ? warnList
                          .slice(0, 3)
                          .map((w: any) => `${w.path || '(root)'}: ${w.message}`)
                          .join('\n') +
                        (warnList.length > 3 ? `\n+${warnList.length - 3} more` : '')
                      : '';
                  return (
                    <tr
                      key={name + i}
                      className={
                        'hover:bg-accent/50 ' +
                        (invalid
                          ? 'bg-destructive/[0.04]'
                          : warnOnly
                            ? 'bg-amber-500/[0.05]'
                            : '')
                      }
                    >
                      {columns.map((c, ci) => {
                        const value = row.item[c.key];
                        const cell = c.render ? c.render(value, row.item) : defaultCell(value);
                        return (
                          <td key={c.key} className="px-3 py-2 align-top">
                            {ci === 0 ? (
                              <span className="inline-flex items-center gap-1.5">
                                {invalid && (
                                  <span
                                    className="inline-flex"
                                    aria-label={t('engine.list.invalidTitle', locale)}
                                    title={`${tFormat('engine.list.invalidCount', locale, { count: errorList.length })}\n${errorTitle}`}
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                                  </span>
                                )}
                                {warnOnly && (
                                  <span
                                    className="inline-flex"
                                    aria-label={t('engine.list.warnTitle', locale)}
                                    title={`${tFormat('engine.list.warnCount', locale, { count: warnList.length })}\n${errorTitle}`}
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                  </span>
                                )}
                                <Link
                                  to={`./${encodeURIComponent(name)}${rowEditSuffix}`}
                                  className="text-primary hover:underline font-mono"
                                >
                                  {cell}
                                </Link>
                              </span>
                            ) : (
                              cell
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right align-top">
                        {(row.item._lock as string | undefined) && row.item._lock !== 'none' && (
                          <span
                            className="inline-flex items-center mr-1 text-amber-600 dark:text-amber-400"
                            title={
                              (row.item._lockReason as string | undefined)
                              ?? `_lock=${String(row.item._lock)}`
                            }
                          >
                            <Lock className="h-3 w-3" />
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className={
                            'text-[10px] ' +
                            (row.source === 'artifact'
                              ? 'border-sky-500/50 text-sky-700 dark:text-sky-300'
                              : 'border-emerald-500/50 text-emerald-700 dark:text-emerald-300')
                          }
                          title={
                            row.source === 'artifact'
                              ? `${t('engine.list.source.artifactDesc', locale)}${row.item._packageId ? ` (${row.item._packageId})` : ''}`
                              : t('engine.list.source.runtimeDesc', locale)
                          }
                        >
                          {t(`engine.list.source.${row.source}`, locale)}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function defaultColumns(primaryKey: string): NonNullable<import('./registry').MetadataResourceConfig['listColumns']> {
  return [
    { key: primaryKey, label: primaryKey, width: '30%' },
    { key: 'label', label: 'Label', width: '30%' },
    { key: 'description', label: 'Description' },
  ];
}

function defaultCell(value: unknown): React.ReactNode {
  if (value == null || value === '') {
    return <span className="text-muted-foreground">—</span>;
  }
  if (typeof value === 'boolean') return value ? '✓' : '✗';
  if (typeof value === 'object') {
    try {
      return (
        <code className="font-mono text-xs">
          {JSON.stringify(value).slice(0, 60)}
        </code>
      );
    } catch {
      return String(value);
    }
  }
  return String(value);
}
