// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * DatasourceResourcePage — the `datasource` metadata type's custom ListPage,
 * registered into the metadata-admin engine (`registerMetadataResource`) and
 * reached via the engine route `…/component/metadata/resource?type=datasource`
 * (and the setup left-nav "Datasources" item → `system/metadata/datasource`).
 *
 * datasource is a *side-effectful* metadata type: its records are managed by
 * the framework `datasource-admin` service (secret encryption + connection-pool
 * registration + origin gating), so create/edit/delete + test go through that
 * service's REST (`/api/v1/datasources/*`) rather than the generic sys_metadata
 * write path. The engine still owns the route, shell, and registry slot.
 *
 * Capabilities:
 *  - **List** datasources (driver/status/origin).
 *  - **Create / edit** a connection with a typed form generated from the
 *    selected driver's JSON-Schema `configSchema` (`GET /datasources/drivers`).
 *    Credential fields (`format: 'password'`) are routed to the top-level
 *    `secret` so they are encrypted into `sys_secret` and never persisted in
 *    `config` metadata. Edit prefills from `GET /datasources/:name` (which
 *    returns `config` + a `hasSecret` flag, never the credential itself).
 *  - **Test** a connection (saved → `POST …/:name/test`; draft in the editor →
 *    `POST …/test`).
 *  - **Sync objects**: introspect remote tables (`GET …/remote-tables`), pick
 *    which to import, generate an object definition for each (`POST …/object-draft`),
 *    and create it through the normal metadata channel (`MetadataClient.save('object', …)`).
 *  - **Delete** a runtime datasource (`DELETE …/:name`; blocked by the backend
 *    while objects are still bound).
 *
 * Code-defined (`origin: 'code'`) datasources are read-only: edit/delete are
 * hidden for them.
 */

import * as React from 'react';
import { toast } from 'sonner';
import {
  Loader2,
  Database,
  RefreshCw,
  Plug,
  Boxes,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  Label,
  Switch,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@object-ui/components';
import { createAuthenticatedFetch } from '@object-ui/auth';
import { useMetadataClient } from '../useMetadata';

interface DatasourceRow {
  name: string;
  label?: string;
  driver?: string;
  status?: string;
  origin?: string;
  active?: boolean;
}
interface RemoteTable { name: string; schema?: string; columnCount?: number }

interface JsonProp {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  format?: string;
  enum?: unknown[];
}
interface DriverEntry {
  id: string;
  label: string;
  description?: string;
  configSchema?: { properties?: Record<string, JsonProp>; required?: string[] };
}

interface EditorForm {
  name: string;
  label: string;
  driver: string;
  schemaMode: string;
  config: Record<string, unknown>;
  secret: string;
}

const SCHEMA_MODES = [
  { value: 'managed', label: 'Managed (ObjectStack owns the schema)' },
  { value: 'external', label: 'External (read existing schema as-is)' },
  { value: 'validate-only', label: 'Validate only' },
];

const SERVER = ((import.meta as { env?: Record<string, string> }).env?.VITE_SERVER_URL || '').replace(/\/+$/, '');

const isPassword = (p: JsonProp) => p.format === 'password';

/** Build the default config (password props excluded — they live in `secret`). */
function defaultConfig(driver: DriverEntry | undefined): Record<string, unknown> {
  const props = driver?.configSchema?.properties ?? {};
  const cfg: Record<string, unknown> = {};
  for (const [key, prop] of Object.entries(props)) {
    if (isPassword(prop)) continue;
    if (prop.default !== undefined) cfg[key] = prop.default;
  }
  return cfg;
}

export function DatasourceResourcePage(_props: { type?: string }): React.ReactElement {
  const authFetch = React.useMemo(() => createAuthenticatedFetch(), []);
  const metaClient = useMetadataClient();

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

  const remove = async (name: string) => {
    if (!window.confirm(`Delete datasource “${name}”? This cannot be undone.`)) return;
    setBusy(`del:${name}`);
    try {
      await api(`/api/v1/datasources/${encodeURIComponent(name)}`, { method: 'DELETE' });
      toast.success(`Deleted ${name}.`);
      void load();
    } catch (err) {
      toast.error(`Delete ${name}: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  // ── Connection editor (create / edit) ─────────────────────────────────────
  const [drivers, setDrivers] = React.useState<DriverEntry[]>([]);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<EditorForm | null>(null);
  const [hasSecret, setHasSecret] = React.useState(false);
  const [savingEditor, setSavingEditor] = React.useState(false);
  const [testMsg, setTestMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [testingDraft, setTestingDraft] = React.useState(false);

  const ensureDrivers = React.useCallback(async (): Promise<DriverEntry[]> => {
    if (drivers.length) return drivers;
    try {
      const data = await api('/api/v1/datasources/drivers');
      const list = Array.isArray(data?.drivers) ? (data.drivers as DriverEntry[]) : [];
      setDrivers(list);
      return list;
    } catch (err) {
      toast.error(`Load drivers: ${(err as Error).message}`);
      return [];
    }
  }, [api, drivers]);

  const selectedDriver = React.useMemo(
    () => drivers.find((d) => d.id === form?.driver),
    [drivers, form?.driver],
  );

  const openCreate = async () => {
    const list = await ensureDrivers();
    const first = list.find((d) => d.id !== 'memory') ?? list[0];
    setEditing(null);
    setHasSecret(false);
    setTestMsg(null);
    setForm({
      name: '',
      label: '',
      driver: first?.id ?? '',
      schemaMode: 'managed',
      config: defaultConfig(first),
      secret: '',
    });
    setEditorOpen(true);
  };

  const openEdit = async (row: DatasourceRow) => {
    const list = await ensureDrivers();
    setBusy(`edit:${row.name}`);
    try {
      const data = await api(`/api/v1/datasources/${encodeURIComponent(row.name)}`);
      const ds = data?.datasource ?? {};
      setEditing(row.name);
      setHasSecret(Boolean(ds.hasSecret));
      setTestMsg(null);
      setForm({
        name: ds.name ?? row.name,
        label: ds.label ?? '',
        driver: ds.driver ?? row.driver ?? (list[0]?.id ?? ''),
        schemaMode: ds.schemaMode ?? 'managed',
        config: { ...(ds.config ?? {}) },
        secret: '',
      });
      setEditorOpen(true);
    } catch (err) {
      toast.error(`Open ${row.name}: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const onDriverChange = (id: string) => {
    setForm((f) => (f ? { ...f, driver: id, config: defaultConfig(drivers.find((d) => d.id === id)), secret: '' } : f));
    setTestMsg(null);
  };

  const setConfigValue = (key: string, value: unknown) =>
    setForm((f) => (f ? { ...f, config: { ...f.config, [key]: value } } : f));

  /** Assemble the request body, splitting the credential into `secret`. */
  const draftBody = (f: EditorForm) => {
    const body: Record<string, unknown> = {
      label: f.label || undefined,
      driver: f.driver,
      schemaMode: f.schemaMode,
      config: f.config,
    };
    if (f.secret) body.secret = f.secret;
    return body;
  };

  const testDraft = async () => {
    if (!form) return;
    setTestingDraft(true);
    setTestMsg(null);
    try {
      const r = await api('/api/v1/datasources/test', { method: 'POST', body: JSON.stringify({ driver: form.driver, config: form.config, ...(form.secret ? { secret: form.secret } : {}) }) });
      const res = r?.result ?? r;
      if (res?.ok === false) setTestMsg({ ok: false, text: res?.error ?? 'Connection failed' });
      else setTestMsg({ ok: true, text: `Connection ok${res?.latencyMs != null ? ` (${res.latencyMs}ms)` : ''}` });
    } catch (err) {
      setTestMsg({ ok: false, text: (err as Error).message });
    } finally {
      setTestingDraft(false);
    }
  };

  const saveEditor = async () => {
    if (!form) return;
    setSavingEditor(true);
    try {
      if (editing) {
        await api(`/api/v1/datasources/${encodeURIComponent(editing)}`, { method: 'PATCH', body: JSON.stringify(draftBody(form)) });
        toast.success(`Updated ${editing}.`);
      } else {
        await api('/api/v1/datasources', { method: 'POST', body: JSON.stringify({ name: form.name, ...draftBody(form) }) });
        toast.success(`Created ${form.name}.`);
      }
      setEditorOpen(false);
      void load();
    } catch (err) {
      toast.error(`Save: ${(err as Error).message}`);
    } finally {
      setSavingEditor(false);
    }
  };

  const nameValid = editing ? true : /^[a-z_][a-z0-9_]*$/.test(form?.name ?? '');
  const canSave = !!form && !!form.driver && nameValid && !savingEditor;

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

  const renderField = (key: string, prop: JsonProp) => {
    const label = prop.title || key;
    const required = (selectedDriver?.configSchema?.required ?? []).includes(key);
    if (isPassword(prop)) {
      return (
        <div key={key} className="space-y-1">
          <Label className="text-xs">{label}{required && !editing ? ' *' : ''}</Label>
          <Input
            type="password"
            value={form?.secret ?? ''}
            placeholder={editing && hasSecret ? '•••••••• (leave blank to keep)' : ''}
            onChange={(e) => setForm((f) => (f ? { ...f, secret: e.target.value } : f))}
          />
          {prop.description && <p className="text-[11px] text-muted-foreground">{prop.description}</p>}
        </div>
      );
    }
    const value = form?.config[key];
    if (prop.type === 'boolean') {
      return (
        <div key={key} className="flex items-center justify-between gap-2 py-1">
          <div>
            <Label className="text-xs">{label}</Label>
            {prop.description && <p className="text-[11px] text-muted-foreground">{prop.description}</p>}
          </div>
          <Switch checked={Boolean(value)} onCheckedChange={(c) => setConfigValue(key, c)} />
        </div>
      );
    }
    if (Array.isArray(prop.enum)) {
      return (
        <div key={key} className="space-y-1">
          <Label className="text-xs">{label}{required ? ' *' : ''}</Label>
          <Select value={value != null ? String(value) : ''} onValueChange={(v) => setConfigValue(key, v)}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {prop.enum.map((opt) => <SelectItem key={String(opt)} value={String(opt)}>{String(opt)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    }
    const isNum = prop.type === 'number' || prop.type === 'integer';
    return (
      <div key={key} className="space-y-1">
        <Label className="text-xs">{label}{required ? ' *' : ''}</Label>
        <Input
          type={isNum ? 'number' : 'text'}
          value={value != null ? String(value) : ''}
          onChange={(e) => setConfigValue(key, isNum ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value)}
        />
        {prop.description && <p className="text-[11px] text-muted-foreground">{prop.description}</p>}
      </div>
    );
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={'mr-1.5 h-4 w-4' + (loading ? ' animate-spin' : '')} /> Refresh
          </Button>
          <Button size="sm" onClick={() => void openCreate()}>
            <Plus className="mr-1.5 h-4 w-4" /> New datasource
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 py-16 text-center text-sm text-muted-foreground">
          No datasources yet. Click <span className="font-medium">New datasource</span> to connect one.
        </div>
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {rows.map((ds) => {
            const isCode = ds.origin === 'code';
            return (
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
                {!isCode && (
                  <>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" disabled={busy === `edit:${ds.name}`} onClick={() => void openEdit(ds)}>
                      {busy === `edit:${ds.name}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete" disabled={busy === `del:${ds.name}`} onClick={() => void remove(ds.name)}>
                      {busy === `del:${ds.name}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / edit connection */}
      <Dialog open={editorOpen} onOpenChange={(o) => { if (!o) setEditorOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit “${editing}”` : 'New datasource'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update the connection. Leave the credential blank to keep the current one.' : 'Connect an external database. Credentials are encrypted and never stored in metadata.'}
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {!editing && (
                <div className="space-y-1">
                  <Label className="text-xs">Name *</Label>
                  <Input
                    value={form.name}
                    placeholder="my_database"
                    onChange={(e) => setForm((f) => (f ? { ...f, name: e.target.value } : f))}
                  />
                  {!nameValid && form.name.length > 0 && (
                    <p className="text-[11px] text-destructive">Lowercase letters, digits, and underscores; must not start with a digit.</p>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Label</Label>
                <Input value={form.label} placeholder="Human-friendly name" onChange={(e) => setForm((f) => (f ? { ...f, label: e.target.value } : f))} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Driver *</Label>
                <Select value={form.driver} onValueChange={onDriverChange} disabled={!!editing}>
                  <SelectTrigger><SelectValue placeholder="Choose a driver" /></SelectTrigger>
                  <SelectContent>
                    {drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {selectedDriver?.description && <p className="text-[11px] text-muted-foreground">{selectedDriver.description}</p>}
              </div>

              {/* Driver-specific connection fields */}
              {Object.entries(selectedDriver?.configSchema?.properties ?? {}).map(([k, p]) => renderField(k, p))}

              <div className="space-y-1">
                <Label className="text-xs">Schema mode</Label>
                <Select value={form.schemaMode} onValueChange={(v) => setForm((f) => (f ? { ...f, schemaMode: v } : f))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SCHEMA_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {testMsg && (
                <div className={'flex items-center gap-1.5 text-xs ' + (testMsg.ok ? 'text-emerald-600' : 'text-destructive')}>
                  {testMsg.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {testMsg.text}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" size="sm" disabled={!form?.driver || testingDraft} onClick={() => void testDraft()}>
              {testingDraft ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plug className="mr-1.5 h-4 w-4" />} Test connection
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditorOpen(false)}>Cancel</Button>
              <Button size="sm" disabled={!canSave} onClick={() => void saveEditor()}>
                {savingEditor && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {editing ? 'Save changes' : 'Create datasource'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sync objects */}
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
