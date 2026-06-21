// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * DatasourceManagerPage — Studio surface for runtime datasources (managed by
 * the framework `datasource-admin` service, which lives outside the generic
 * metadata-admin engine). Lists datasources, tests connections, and — the
 * headline — **syncs objects from a datasource**: introspect remote tables
 * (`GET /datasources/:name/remote-tables`), pick which to import, generate an
 * object definition for each (`POST …/object-draft`), and create it through
 * the normal metadata channel (`MetadataClient.save('object', …)`).
 */

import * as React from 'react';
import { toast } from 'sonner';
import { Loader2, Database, RefreshCw, Plug, Boxes } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@object-ui/components';
import { createAuthenticatedFetch } from '@object-ui/auth';
import { MetadataClient } from '@object-ui/data-objectstack';

interface DatasourceRow {
  name: string;
  label?: string;
  driver?: string;
  status?: string;
  origin?: string;
  active?: boolean;
}
interface RemoteTable { name: string; schema?: string; columnCount?: number }

const SERVER = ((import.meta as { env?: Record<string, string> }).env?.VITE_SERVER_URL || '').replace(/\/+$/, '');

export function DatasourceManagerPage(): React.ReactElement {
  const authFetch = React.useMemo(() => createAuthenticatedFetch(), []);
  const metaClient = React.useMemo(() => new MetadataClient({ baseUrl: SERVER }), []);

  const [rows, setRows] = React.useState<DatasourceRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);

  const api = React.useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await authFetch(`${SERVER}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
      const text = await res.text();
      let body: any = text;
      try { body = JSON.parse(text); } catch { /* keep text */ }
      if (!res.ok) throw new Error((body && (body.message || body.error)) || `HTTP ${res.status}`);
      return body;
    },
    [authFetch],
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await api('/api/v1/datasources');
      setRows(Array.isArray(data?.datasources) ? data.datasources : []);
    } catch (err) {
      toast.error(`Load datasources: ${(err as Error).message}`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => { void load(); }, [load]);

  const test = async (name: string) => {
    setBusy(`test:${name}`);
    try {
      const r = await api(`/api/v1/datasources/${encodeURIComponent(name)}/test`, { method: 'POST', body: '{}' });
      toast.success(r?.ok === false ? `${name}: ${r?.error ?? 'failed'}` : `${name}: connection ok${r?.latencyMs != null ? ` (${r.latencyMs}ms)` : ''}`);
      void load();
    } catch (err) {
      toast.error(`${name}: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  // ── Sync dialog ──────────────────────────────────────────────────────────
  const [syncName, setSyncName] = React.useState<string | null>(null);
  const [tables, setTables] = React.useState<RemoteTable[] | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [syncing, setSyncing] = React.useState(false);

  const openSync = async (name: string) => {
    setSyncName(name);
    setTables(null);
    setSelected(new Set());
    try {
      const data = await api(`/api/v1/datasources/${encodeURIComponent(name)}/remote-tables`);
      setTables(Array.isArray(data?.tables) ? data.tables : []);
    } catch (err) {
      toast.error(`Introspect ${name}: ${(err as Error).message}`);
      setTables([]);
    }
  };

  const toggle = (t: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });

  const runSync = async () => {
    if (!syncName || selected.size === 0) return;
    setSyncing(true);
    let ok = 0;
    const failures: string[] = [];
    for (const table of selected) {
      try {
        const { draft } = await api(`/api/v1/datasources/${encodeURIComponent(syncName)}/object-draft`, {
          method: 'POST',
          body: JSON.stringify({ table }),
        });
        await metaClient.save('object', draft.name, draft.definition);
        ok += 1;
      } catch (err) {
        failures.push(`${table}: ${(err as Error).message}`);
      }
    }
    setSyncing(false);
    if (ok) toast.success(`Synced ${ok} object${ok > 1 ? 's' : ''} from ${syncName}.`);
    if (failures.length) toast.error(`Failed: ${failures.join('; ')}`);
    setSyncName(null);
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Database className="h-5 w-5" /> Datasources
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Connect external databases and sync their tables in as objects.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={'mr-1.5 h-4 w-4' + (loading ? ' animate-spin' : '')} /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 py-16 text-center text-sm text-muted-foreground">
          No datasources yet. Create one via the API/CLI, then sync its tables here.
        </div>
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {rows.map((ds) => (
            <div key={ds.name} className="flex items-center gap-3 px-4 py-3">
              <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{ds.label || ds.name}</span>
                  <code className="text-[11px] text-muted-foreground">{ds.name}</code>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{ds.driver}</span>
                  {ds.status && <span>· {ds.status}</span>}
                  {ds.origin && <span>· {ds.origin}</span>}
                </div>
              </div>
              <Button variant="ghost" size="sm" disabled={busy === `test:${ds.name}`} onClick={() => void test(ds.name)}>
                {busy === `test:${ds.name}` ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plug className="mr-1.5 h-4 w-4" />} Test
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void openSync(ds.name)}>
                <Boxes className="mr-1.5 h-4 w-4" /> Sync objects
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!syncName} onOpenChange={(o) => { if (!o) setSyncName(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sync objects from “{syncName}”</DialogTitle>
            <DialogDescription>Pick the remote tables to import as objects. Each becomes an object definition.</DialogDescription>
          </DialogHeader>
          {tables == null ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Introspecting…</div>
          ) : tables.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No remote tables found on this datasource.</p>
          ) : (
            <div className="max-h-[50vh] space-y-1 overflow-y-auto">
              {tables.map((t) => {
                const key = t.schema ? `${t.schema}.${t.name}` : t.name;
                return (
                  <label key={key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
                    <input type="checkbox" checked={selected.has(t.name)} onChange={() => toggle(t.name)} className="h-4 w-4" />
                    <span className="flex-1">{key}</span>
                    {t.columnCount != null && <span className="text-[11px] text-muted-foreground">{t.columnCount} cols</span>}
                  </label>
                );
              })}
            </div>
          )}
          <div className="mt-2 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSyncName(null)}>Cancel</Button>
            <Button size="sm" disabled={syncing || selected.size === 0} onClick={() => void runSync()}>
              {syncing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Boxes className="mr-1.5 h-4 w-4" />}
              Create {selected.size || ''} object{selected.size === 1 ? '' : 's'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
