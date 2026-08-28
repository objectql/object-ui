// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * SchemaBrowser — the "schema browser" surface of the external-datasource
 * Studio panel (ADR-0015 §6.4).
 *
 * Lists the remote tables a federated datasource exposes (filtered server-side
 * by `external.allowedSchemas`), with an optional client-side text filter and
 * a per-table "Import" action that opens {@link ImportObjectDialog}.
 *
 * Data is fetched on demand (mount + explicit "Refresh"), never on a timer —
 * introspecting a warehouse is expensive, so the user stays in control.
 */

import * as React from 'react';
import { RefreshCw, Loader2, Search, Table2, Download, Columns3 } from 'lucide-react';
import { Button } from '@object-ui/components';
import {
  listRemoteTables,
  ExternalServiceUnavailableError,
  type RemoteTable,
} from './api.js';
import { ImportObjectDialog } from './ImportObjectDialog.js';

export interface SchemaBrowserProps {
  datasource: string;
}

type LoadState = 'idle' | 'loading' | 'loaded' | 'error' | 'unavailable';

export function SchemaBrowser({ datasource }: SchemaBrowserProps) {
  const [state, setState] = React.useState<LoadState>('idle');
  const [tables, setTables] = React.useState<RemoteTable[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [importing, setImporting] = React.useState<RemoteTable | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const rows = await listRemoteTables(datasource);
      setTables(rows);
      setState('loaded');
    } catch (err) {
      if (err instanceof ExternalServiceUnavailableError) {
        setState('unavailable');
      } else {
        setError(err instanceof Error ? err.message : String(err));
        setState('error');
      }
    }
  }, [datasource]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter((t) => {
      const label = [t.schema, t.name].filter(Boolean).join('.').toLowerCase();
      return label.includes(q);
    });
  }, [tables, query]);

  const openImport = (t: RemoteTable) => {
    setImporting(t);
    setDialogOpen(true);
  };

  if (state === 'unavailable') {
    return <UnavailableHint />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter tables…"
            className="w-full rounded border bg-background pl-7 pr-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={state === 'loading'}>
          {state === 'loading' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          <span className="ml-1.5">Refresh</span>
        </Button>
      </div>

      {error && (
        <div className="rounded border border-destructive/40 bg-destructive/5 p-2.5 text-xs text-destructive">
          {error}
        </div>
      )}

      {state === 'loading' && tables.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Introspecting remote schema…
        </div>
      )}

      {state === 'loaded' && filtered.length === 0 && (
        <div className="py-10 text-center text-sm text-muted-foreground">
          {tables.length === 0
            ? 'No remote tables found (check the datasource’s allowedSchemas).'
            : 'No tables match the filter.'}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="rounded border bg-background overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-2.5 py-1.5 text-left font-medium">Table</th>
                <th className="px-2.5 py-1.5 text-right font-medium">Columns</th>
                <th className="px-2.5 py-1.5 text-right font-medium">Rows (est.)</th>
                <th className="px-2.5 py-1.5 w-px" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((t) => {
                const key = [t.schema, t.name].filter(Boolean).join('.');
                return (
                  <tr key={key} className="hover:bg-muted/30">
                    <td className="px-2.5 py-1.5">
                      <span className="inline-flex items-center gap-1.5 font-mono">
                        <Table2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {t.schema && <span className="text-muted-foreground">{t.schema}.</span>}
                        <span className="font-medium">{t.name}</span>
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Columns3 className="h-3 w-3" />
                        {t.columnCount}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                      {typeof t.rowCountEstimate === 'number'
                        ? t.rowCountEstimate.toLocaleString()
                        : '—'}
                    </td>
                    <td className="px-2.5 py-1.5">
                      <Button variant="ghost" size="sm" onClick={() => openImport(t)}>
                        <Download className="h-3.5 w-3.5" />
                        <span className="ml-1.5">Import</span>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ImportObjectDialog
        datasource={datasource}
        table={importing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}

function UnavailableHint() {
  return (
    <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-900 dark:text-amber-200">
      Federation is not enabled on this server. The
      <span className="font-mono"> external-datasource </span>
      service must be registered for table browsing, drafting, and validation
      to work.
    </div>
  );
}
