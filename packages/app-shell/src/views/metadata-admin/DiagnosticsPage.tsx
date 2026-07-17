// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * MetadataDiagnosticsPage — governance overview.
 *
 * Renders the cross-type `/meta/diagnostics` sweep: every metadata
 * item that fails load-time Zod validation, grouped by type, with a
 * deep-link to its edit page. The framework computes this server-side
 * (see `protocol.getMetaDiagnostics`); the client just paints it.
 *
 * Counterpart surfaces:
 *   • DirectoryPage tile badges — per-type aggregate
 *   • ResourceListPage row badges — per-item flag inside one type
 *   • ResourceEditPage banner + inline SchemaForm errors — full
 *     drill-down for a single item
 *
 * This page is the only one that shows everything in one view, so
 * ops can answer "what's broken across the whole app?" without
 * clicking into 27 type pages.
 */

import * as React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@object-ui/components';
import { Badge } from '@object-ui/components';
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import {
  useMetadataClient,
  useMetadataTypes,
  useGlobalDiagnostics,
  type MetadataDiagnosticsEntry,
} from './useMetadata';
import { t, tFormat, translateMetadataType, useMetadataLocale } from './i18n';

type Severity = 'error' | 'warning';

export function MetadataDiagnosticsPage() {
  const client = useMetadataClient();
  const locale = useMetadataLocale();
  const [severity, setSeverity] = React.useState<Severity>('error');
  const { loading, error, summary, reload } = useGlobalDiagnostics(client, severity);
  const { entries: typesEntries } = useMetadataTypes(client);

  // Index by type so we can look up the human label per-type without
  // scanning the typesEntries array each row.
  const typeLabel = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of typesEntries) {
      m[e.type] = translateMetadataType(e.type, locale, e.label);
    }
    return m;
  }, [typesEntries, locale]);

  // Group entries by type, ordered by descending count.
  const groups = React.useMemo(() => {
    const map: Record<string, MetadataDiagnosticsEntry[]> = {};
    for (const e of summary.entries) (map[e.type] ??= []).push(e);
    return Object.entries(map).sort(([, a], [, b]) => b.length - a.length);
  }, [summary]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-5 pb-4 border-b bg-background">
        <nav className="text-xs text-muted-foreground mb-2">
          <Link to=".." className="hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" />
            {t('engine.diagnostics.back', locale)}
          </Link>
        </nav>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {t('engine.diagnostics.title', locale)}
          </h1>
          <Badge
            variant="outline"
            className="text-[11px] border-destructive/40 text-destructive bg-destructive/[0.06]"
          >
            {tFormat('engine.diagnostics.summary', locale, {
              count: summary.total,
              items: summary.scannedItems,
              types: summary.scannedTypes,
            })}
          </Badge>
          <div className="flex-1" />
          <div
            role="tablist"
            className="inline-flex items-center rounded-md border bg-muted/40 p-0.5 text-xs"
          >
            {(['error', 'warning'] as Severity[]).map((s) => (
              <button
                key={s}
                role="tab"
                type="button"
                aria-selected={severity === s}
                onClick={() => setSeverity(s)}
                className={
                  'px-2.5 py-1 rounded transition-colors ' +
                  (severity === s
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground')
                }
              >
                {t(`engine.diagnostics.severity.${s}`, locale)}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={reload}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            {t('engine.diagnostics.refresh', locale)}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
          {t('engine.diagnostics.description', locale)}
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {loading && (
          <div className="text-sm text-muted-foreground">
            {t('engine.diagnostics.loading', locale)}
          </div>
        )}
        {!loading && error && (
          <div className="text-sm text-destructive border border-destructive/30 rounded p-3 bg-destructive/[0.06]">
            {tFormat('engine.diagnostics.loadFailed', locale, { error })}
          </div>
        )}
        {!loading && !error && groups.length === 0 && (
          <Empty>
            <EmptyTitle>{t('engine.diagnostics.cleanTitle', locale)}</EmptyTitle>
            <EmptyDescription>
              {tFormat('engine.diagnostics.cleanHint', locale, {
                items: summary.scannedItems,
                types: summary.scannedTypes,
              })}
            </EmptyDescription>
          </Empty>
        )}
        {groups.map(([type, rows]) => (
          <section key={type} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Link
                to={`../${encodeURIComponent(type)}`}
                className="hover:text-foreground hover:underline"
              >
                {typeLabel[type] ?? type}
              </Link>
              <span className="font-mono normal-case tracking-normal text-[10px] opacity-70">
                {type}
              </span>
              <Badge
                variant="outline"
                className="text-[10px] border-destructive/40 text-destructive bg-destructive/[0.06]"
              >
                {rows.length}
              </Badge>
            </h2>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium w-[28%]">
                      {t('engine.diagnostics.col.name', locale)}
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      {t('engine.diagnostics.col.issues', locale)}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row) => {
                    const errs = row.diagnostics.errors ?? [];
                    const warns = row.diagnostics.warnings ?? [];
                    const head = (severity === 'warning' && errs.length === 0 ? warns : errs).slice(0, 3);
                    const rest = Math.max(0, (errs.length || warns.length) - head.length);
                    return (
                      <tr key={row.name} className="hover:bg-accent/50 align-top">
                        <td className="px-3 py-2 align-top">
                          <Link
                            to={`../${encodeURIComponent(type)}/${encodeURIComponent(row.name)}`}
                            className="text-primary hover:underline font-mono"
                          >
                            {row.name}
                          </Link>
                          {errs.length > 0 && (
                            <Badge
                              variant="outline"
                              className="ml-2 text-[10px] border-destructive/40 text-destructive"
                            >
                              {tFormat('engine.diagnostics.errorN', locale, { count: errs.length })}
                            </Badge>
                          )}
                          {warns.length > 0 && (
                            <Badge
                              variant="outline"
                              className="ml-2 text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-300"
                            >
                              {tFormat('engine.diagnostics.warnN', locale, { count: warns.length })}
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <ul className="space-y-0.5 font-mono text-[11px]">
                            {head.map((d, i) => (
                              <li key={i} className="truncate">
                                <span className="text-muted-foreground">
                                  {d.path || '(root)'}
                                </span>
                                <span className="text-muted-foreground">: </span>
                                {d.message}
                              </li>
                            ))}
                            {rest > 0 && (
                              <li className="text-muted-foreground">
                                {tFormat('engine.diagnostics.more', locale, { count: rest })}
                              </li>
                            )}
                          </ul>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
