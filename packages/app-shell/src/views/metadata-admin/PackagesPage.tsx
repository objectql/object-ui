// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * PackagesPage — the package management entry point for Studio.
 *
 * Studio previously exposed packages only through the sidebar `active_package`
 * *filter* dropdown; there was no surface to see all packages, create one, or
 * act on one (publish / revert / enable / disable). This page fills that gap.
 *
 * It is the authoring home for the Studio → package → publish workflow:
 *   1. Create a package (POST /api/v1/packages with a minimal manifest).
 *   2. Author metadata bound to it (via the sidebar scope + ResourceEditPage).
 *   3. Publish it (POST /api/v1/packages/:id/publish).
 *
 * Backed entirely by the existing `/api/v1/packages` REST surface
 * (see framework `http-dispatcher.handlePackages`).
 */

import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Package as PackageIcon,
  Plus,
  RefreshCw,
  Search,
  Upload,
  Download,
  FileUp,
  Undo2,
  Power,
  PowerOff,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import {
  Button,
  Input,
  Badge,
  Switch,
  Label,
  Separator,
  Skeleton,
  Empty,
  EmptyTitle,
  EmptyDescription,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@object-ui/components';

/* -------------------------------------------------------------------------- */
/* Types + API                                                                 */
/* -------------------------------------------------------------------------- */

interface PackageManifest {
  id: string;
  name?: string;
  version?: string;
  type?: string;
  scope?: 'cloud' | 'system' | 'project';
  description?: string;
}

interface InstalledPackage {
  manifest: PackageManifest;
  status?: string;
  enabled?: boolean;
  statusChangedAt?: string;
  errorMessage?: string;
}

const API = '/api/v1/packages';

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { Accept: 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;
  if (!res.ok || payload?.success === false) {
    const msg =
      payload?.error?.message ||
      payload?.error ||
      payload?.message ||
      `Request failed (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : `Request failed (${res.status})`);
  }
  // Runtime wraps successful payloads in { data, ... } or returns the object directly.
  return (payload?.data ?? payload) as T;
}

/* -------------------------------------------------------------------------- */
/* Scope badge                                                                 */
/* -------------------------------------------------------------------------- */

function ScopeBadge({ scope }: { scope?: string }) {
  const s = scope ?? 'project';
  const variant =
    s === 'project' ? 'default' : s === 'system' ? 'secondary' : 'outline';
  return <Badge variant={variant as any}>{s}</Badge>;
}

function StatusBadge({ pkg }: { pkg: InstalledPackage }) {
  const enabled = pkg.enabled !== false && pkg.status !== 'disabled';
  return (
    <Badge variant={enabled ? ('default' as any) : ('outline' as any)}>
      {enabled ? 'enabled' : 'disabled'}
    </Badge>
  );
}

/* -------------------------------------------------------------------------- */
/* Create-package dialog                                                       */
/* -------------------------------------------------------------------------- */

const ID_RE = /^[a-z0-9][a-z0-9._-]{1,254}$/i;
const VERSION_RE = /^\d+\.\d+\.\d+$/;

function CreatePackageDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [id, setId] = React.useState('');
  const [name, setName] = React.useState('');
  const [version, setVersion] = React.useState('0.1.0');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setId('');
      setName('');
      setVersion('0.1.0');
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const idValid = ID_RE.test(id);
  const versionValid = VERSION_RE.test(version);
  const canSubmit = idValid && versionValid && !!name.trim() && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await apiJson(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manifest: {
            id: id.trim(),
            name: name.trim(),
            version: version.trim(),
            type: 'app',
            scope: 'project',
          },
        }),
      });
      onCreated(id.trim());
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create package');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Package</DialogTitle>
          <DialogDescription>
            Create a project-scoped package to author and publish your own
            metadata. The id should be reverse-domain (e.g.{' '}
            <code className="font-mono">com.acme.crm</code>).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="pkg-id">Package ID</Label>
            <Input
              id="pkg-id"
              placeholder="com.acme.crm"
              value={id}
              onChange={(e) => setId(e.target.value)}
              aria-invalid={!!id && !idValid}
            />
            {!!id && !idValid && (
              <p className="text-xs text-destructive">
                Use letters, numbers, dot, dash or underscore (2–255 chars).
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pkg-name">Display name</Label>
            <Input
              id="pkg-name"
              placeholder="Acme CRM"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pkg-version">Version</Label>
            <Input
              id="pkg-version"
              placeholder="0.1.0"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              aria-invalid={!!version && !versionValid}
            />
            {!!version && !versionValid && (
              <p className="text-xs text-destructive">Use semantic version, e.g. 0.1.0</p>
            )}
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {busy ? 'Creating…' : 'Create package'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Detail sheet — manifest + lifecycle actions                                 */
/* -------------------------------------------------------------------------- */

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right break-all">{children}</span>
    </div>
  );
}

function PackageDetailSheet({
  pkg,
  appBase,
  open,
  onOpenChange,
  onChanged,
}: {
  pkg: InstalledPackage | null;
  appBase: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  // ADR-0033 — pending DRAFT items bound to this package. AI-authored metadata
  // lands as drafts that the active-only browsers hide, so without this the
  // package looks empty right after a build. We list them here with a link to
  // the existing per-item review/diff (?review=1) so the user can publish them.
  const [drafts, setDrafts] = React.useState<Array<{ type: string; name: string }> | null>(null);

  React.useEffect(() => {
    setMsg(null);
    setBusy(null);
  }, [pkg?.manifest.id]);

  React.useEffect(() => {
    const pid = pkg?.manifest.id;
    if (!open || !pid) {
      setDrafts(null);
      return;
    }
    let cancelled = false;
    apiJson<{ drafts?: Array<{ type: string; name: string }> }>(
      `/api/v1/meta/_drafts?packageId=${encodeURIComponent(pid)}`,
    )
      .then((r) => {
        if (!cancelled) setDrafts(r?.drafts ?? []);
      })
      .catch(() => {
        if (!cancelled) setDrafts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, pkg?.manifest.id]);

  if (!pkg) return null;
  const id = pkg.manifest.id;
  const enabled = pkg.enabled !== false && pkg.status !== 'disabled';
  const isKernel = pkg.manifest.scope === 'system' || pkg.manifest.scope === 'cloud';

  async function run(action: string, fn: () => Promise<any>, okText: string) {
    setBusy(action);
    setMsg(null);
    try {
      await fn();
      setMsg({ kind: 'ok', text: okText });
      onChanged();
    } catch (e: any) {
      setMsg({ kind: 'err', text: e?.message ?? 'Action failed' });
    } finally {
      setBusy(null);
    }
  }

  const publish = () =>
    run(
      'publish',
      () =>
        apiJson(`${API}/${encodeURIComponent(id)}/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }).then((r: any) => {
          if (r && r.success === false) {
            const n = r.validationErrors?.length ?? 0;
            throw new Error(
              n
                ? `Publish blocked by ${n} validation error(s).`
                : r.validationErrors?.[0]?.message || 'Nothing to publish.',
            );
          }
          return r;
        }),
      'Package published.',
    );

  const revert = () =>
    run(
      'revert',
      () => apiJson(`${API}/${encodeURIComponent(id)}/revert`, { method: 'POST' }),
      'Reverted to last published state.',
    );

  const toggleEnable = () =>
    run(
      'toggle',
      () =>
        apiJson(`${API}/${encodeURIComponent(id)}/${enabled ? 'disable' : 'enable'}`, {
          method: 'PATCH',
        }),
      enabled ? 'Package disabled.' : 'Package enabled.',
    );

  const exportPkg = () =>
    run(
      'export',
      async () => {
        const manifest = await apiJson<any>(`${API}/${encodeURIComponent(id)}/export`);
        const blob = new Blob([JSON.stringify(manifest, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${id}.package.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      },
      'Package exported.',
    );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <PackageIcon className="h-4 w-4" />
            {pkg.manifest.name || id}
          </SheetTitle>
          <SheetDescription className="font-mono text-xs">{id}</SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          <DetailRow label="Version">{pkg.manifest.version || '—'}</DetailRow>
          <DetailRow label="Type">{pkg.manifest.type || '—'}</DetailRow>
          <DetailRow label="Scope">
            <ScopeBadge scope={pkg.manifest.scope} />
          </DetailRow>
          <DetailRow label="Status">
            <StatusBadge pkg={pkg} />
          </DetailRow>
          {pkg.manifest.description && (
            <DetailRow label="Description">{pkg.manifest.description}</DetailRow>
          )}
        </div>

        <Separator className="my-4" />

        <Link
          to={`${appBase}/metadata/object?package=${encodeURIComponent(id)}`}
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          onClick={() => onOpenChange(false)}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Browse this package's metadata
        </Link>

        {drafts && drafts.length > 0 && (
          <>
            <Separator className="my-4" />
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pending changes
                <Badge variant="secondary">{drafts.length}</Badge>
              </p>
              <p className="text-xs text-muted-foreground">
                Drafted, not yet published. Review and publish each to make it live.
              </p>
              <ul className="space-y-1">
                {drafts.map((d) => (
                  <li key={`${d.type}/${d.name}`}>
                    <Link
                      to={`${appBase}/metadata/${encodeURIComponent(d.type)}/${encodeURIComponent(d.name)}?review=1`}
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                      onClick={() => onOpenChange(false)}
                    >
                      <FileUp className="h-3.5 w-3.5" />
                      <span className="font-mono text-xs">{d.type}</span>
                      <span className="text-muted-foreground">·</span>
                      {d.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        <Separator className="my-4" />

        {isKernel ? (
          <p className="text-sm text-muted-foreground">
            This is a platform kernel package. Authoring actions are disabled.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Actions
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={publish} disabled={!!busy}>
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {busy === 'publish' ? 'Publishing…' : 'Publish'}
              </Button>
              <Button size="sm" variant="outline" onClick={revert} disabled={!!busy}>
                <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                Revert
              </Button>
              <Button size="sm" variant="outline" onClick={toggleEnable} disabled={!!busy}>
                {enabled ? (
                  <PowerOff className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <Power className="mr-1.5 h-3.5 w-3.5" />
                )}
                {enabled ? 'Disable' : 'Enable'}
              </Button>
              <Button size="sm" variant="outline" onClick={exportPkg} disabled={!!busy}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {busy === 'export' ? 'Exporting…' : 'Export'}
              </Button>
            </div>
          </div>
        )}

        {msg && (
          <div
            className={`mt-4 rounded-md border p-2 text-sm ${
              msg.kind === 'ok'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : 'border-destructive/40 bg-destructive/10 text-destructive'
            }`}
          >
            {msg.text}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* -------------------------------------------------------------------------- */
/* Main page                                                                   */
/* -------------------------------------------------------------------------- */

export function PackagesPage() {
  const { pathname } = useLocation();
  // App base = path up to (and excluding) `/component/...`, so links to
  // `/apps/:app/metadata/...` work regardless of nesting.
  const appBase = React.useMemo(() => {
    const idx = pathname.indexOf('/component');
    return idx >= 0 ? pathname.slice(0, idx) : pathname;
  }, [pathname]);

  const [packages, setPackages] = React.useState<InstalledPackage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [showKernel, setShowKernel] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<InstalledPackage | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [importing, setImporting] = React.useState(false);
  const [importMsg, setImportMsg] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(
    null,
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<{ packages: InstalledPackage[] }>(API);
      const list = Array.isArray(data?.packages) ? data.packages : [];
      list.sort((a, b) => {
        // User (project) packages first, then by name.
        const sa = a.manifest.scope === 'project' ? 0 : 1;
        const sb = b.manifest.scope === 'project' ? 0 : 1;
        if (sa !== sb) return sa - sb;
        return (a.manifest.name || a.manifest.id).localeCompare(b.manifest.name || b.manifest.id);
      });
      setPackages(list);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load packages');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Keep the open detail sheet in sync with refreshed data.
  React.useEffect(() => {
    if (!selected) return;
    const fresh = packages.find((p) => p.manifest.id === selected.manifest.id);
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [packages, selected]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return packages.filter((p) => {
      const kernel = p.manifest.scope === 'system' || p.manifest.scope === 'cloud';
      if (kernel && !showKernel) return false;
      if (!q) return true;
      return (
        p.manifest.id.toLowerCase().includes(q) ||
        (p.manifest.name || '').toLowerCase().includes(q)
      );
    });
  }, [packages, query, showKernel]);

  const openDetail = (pkg: InstalledPackage) => {
    setSelected(pkg);
    setDetailOpen(true);
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const text = await file.text();
      let manifest: any;
      try {
        manifest = JSON.parse(text);
      } catch {
        throw new Error('Selected file is not valid JSON.');
      }
      if (!manifest || typeof manifest !== 'object' || (!manifest.id && !manifest.name)) {
        throw new Error('Invalid package file: missing "id" or "name".');
      }
      const res = await apiJson<any>('/api/v1/marketplace/install-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifest }),
      });
      setImportMsg({
        kind: 'ok',
        text: `Imported "${res?.manifestId ?? manifest.id}". Refresh the app switcher to use it.`,
      });
      await load();
    } catch (err: any) {
      setImportMsg({ kind: 'err', text: err?.message ?? 'Import failed' });
    } finally {
      setImporting(false);
    }
  };

  const kernelCount = packages.filter(
    (p) => p.manifest.scope === 'system' || p.manifest.scope === 'cloud',
  ).length;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-6">
      {/* Hero */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <PackageIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Packages</h1>
            <p className="text-sm text-muted-foreground">
              Author, publish, and manage the packages installed in this environment.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onImportFile}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            <FileUp className="mr-1.5 h-3.5 w-3.5" />
            {importing ? 'Importing…' : 'Import'}
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Package
          </Button>
        </div>
      </div>

      {importMsg && (
        <div
          className={`mt-4 rounded-md border p-2 text-sm ${
            importMsg.kind === 'ok'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'border-destructive/40 bg-destructive/10 text-destructive'
          }`}
        >
          {importMsg.text}
        </div>
      )}

      {/* Toolbar */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search packages…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {kernelCount > 0 && (
          <div className="flex items-center gap-2">
            <Switch id="show-kernel" checked={showKernel} onCheckedChange={setShowKernel} />
            <Label htmlFor="show-kernel" className="text-sm text-muted-foreground">
              Show platform packages ({kernelCount})
            </Label>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="mt-4 rounded-lg border">
        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 p-4 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8">
            <Empty>
              <EmptyTitle>No packages</EmptyTitle>
              <EmptyDescription>
                {packages.length === 0
                  ? 'Create your first package to start authoring metadata.'
                  : 'No packages match your filters.'}
              </EmptyDescription>
            </Empty>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>ID</TableHead>
                <TableHead className="w-24">Version</TableHead>
                <TableHead className="w-24">Scope</TableHead>
                <TableHead className="w-24">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow
                  key={p.manifest.id}
                  className="cursor-pointer"
                  onClick={() => openDetail(p)}
                >
                  <TableCell className="font-medium">{p.manifest.name || p.manifest.id}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {p.manifest.id}
                  </TableCell>
                  <TableCell>{p.manifest.version || '—'}</TableCell>
                  <TableCell>
                    <ScopeBadge scope={p.manifest.scope} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge pkg={p} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CreatePackageDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={async () => {
          await load();
        }}
      />
      <PackageDetailSheet
        pkg={selected}
        appBase={appBase}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onChanged={() => void load()}
      />
    </div>
  );
}

export default PackagesPage;
