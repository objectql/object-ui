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
  Trash2,
  Copy,
  Inbox,
  Pencil,
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
import { detectLocale, t, tFormat } from './i18n';

/* -------------------------------------------------------------------------- */
/* Types + API                                                                 */
/* -------------------------------------------------------------------------- */

export interface PackageManifest {
  id: string;
  name?: string;
  version?: string;
  type?: string;
  scope?: 'cloud' | 'system' | 'project';
  description?: string;
}

export interface InstalledPackage {
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
  const locale = React.useMemo(() => detectLocale(), []);
  // Writability semantics, aligned with the builder (studio-design/packages-io):
  // a SCOPE-LESS entry is a database base package (writable — authoring lives
  // there), while `project` marks a read-only code package. Defaulting the
  // missing scope to 'project' used to render both with the same badge, which
  // contradicted the builder's 可写/只读 labeling for the very same package.
  if (!scope) {
    return (
      <Badge className="bg-emerald-400/15 text-emerald-600 hover:bg-emerald-400/15 dark:text-emerald-300">
        {t('engine.packages.scope.writable', locale)}
      </Badge>
    );
  }
  const variant =
    scope === 'project' ? 'default' : scope === 'system' ? 'secondary' : 'outline';
  const labelKey =
    scope === 'project'
      ? 'engine.packages.scope.project'
      : scope === 'system'
        ? 'engine.packages.scope.system'
        : scope === 'cloud'
          ? 'engine.packages.scope.cloud'
          : '';
  return <Badge variant={variant as any}>{labelKey ? t(labelKey, locale) : scope}</Badge>;
}

function StatusBadge({ pkg }: { pkg: InstalledPackage }) {
  const locale = React.useMemo(() => detectLocale(), []);
  const enabled = pkg.enabled !== false && pkg.status !== 'disabled';
  return (
    <Badge variant={enabled ? ('default' as any) : ('outline' as any)}>
      {enabled ? t('engine.packages.status.enabled', locale) : t('engine.packages.status.disabled', locale)}
    </Badge>
  );
}

/* -------------------------------------------------------------------------- */
/* Create-package dialog                                                       */
/* -------------------------------------------------------------------------- */

const ID_RE = /^[a-z0-9][a-z0-9._-]{1,254}$/i;
const VERSION_RE = /^\d+\.\d+\.\d+$/;

export function CreatePackageDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const locale = React.useMemo(() => detectLocale(), []);
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
            // No `scope`: runtime-created base packages are writable authoring
            // targets. `scope: 'project'` marks read-only CODE packages — the
            // old hardcode here made Setup-created bases read as 只读 in the
            // builder's switcher/landing while the builder's own creator made
            // writable ones. One creation semantic everywhere now.
          },
        }),
      });
      onCreated(id.trim());
      // Let context selectors (e.g. the sidebar package switcher) pick up the
      // new package without a full page reload.
      try {
        window.dispatchEvent(new CustomEvent('objectui:packages-changed'));
      } catch {
        /* non-DOM env */
      }
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message ?? t('engine.packages.create.failed', locale));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('engine.packages.create.title', locale)}</DialogTitle>
          <DialogDescription>
            {tFormat('engine.packages.create.description', locale, { example: 'com.acme.crm' })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="pkg-id">{t('engine.packages.create.id', locale)}</Label>
            <Input
              id="pkg-id"
              data-testid="package-id-input"
              placeholder="com.acme.crm"
              value={id}
              onChange={(e) => setId(e.target.value)}
              aria-invalid={!!id && !idValid}
            />
            {!!id && !idValid && (
              <p className="text-xs text-destructive">
                {t('engine.packages.create.idInvalid', locale)}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pkg-name">{t('engine.packages.create.name', locale)}</Label>
            <Input
              id="pkg-name"
              data-testid="package-name-input"
              placeholder="Acme CRM"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pkg-version">{t('engine.packages.create.version', locale)}</Label>
            <Input
              id="pkg-version"
              placeholder="0.1.0"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              aria-invalid={!!version && !versionValid}
            />
            {!!version && !versionValid && (
              <p className="text-xs text-destructive">{t('engine.packages.create.versionInvalid', locale)}</p>
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
            {t('engine.cancel', locale)}
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {busy ? t('engine.packages.create.creating', locale) : t('engine.packages.create.submit', locale)}
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

/**
 * Edit an existing package's manifest (name / description / version) via
 * `PATCH /api/v1/packages/:id`. Mirrors CreatePackageDialog's standard-form
 * shape; `id` / `scope` / `type` are immutable and not shown as inputs.
 */
export function EditPackageDialog({
  pkg,
  open,
  onOpenChange,
  onSaved,
}: {
  pkg: InstalledPackage | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: (updated: InstalledPackage) => void;
}) {
  const locale = React.useMemo(() => detectLocale(), []);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [version, setVersion] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open && pkg) {
      setName(pkg.manifest.name ?? '');
      setDescription(pkg.manifest.description ?? '');
      setVersion(pkg.manifest.version ?? '');
      setError(null);
      setBusy(false);
    }
  }, [open, pkg]);

  const versionValid = !version.trim() || VERSION_RE.test(version.trim());
  const canSubmit = !!name.trim() && versionValid && !busy;

  async function submit() {
    if (!canSubmit || !pkg) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiJson<InstalledPackage>(`${API}/${encodeURIComponent(pkg.manifest.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          version: version.trim(),
        }),
      });
      try {
        window.dispatchEvent(new CustomEvent('objectui:packages-changed'));
      } catch {
        /* non-DOM env */
      }
      onSaved(updated);
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message ?? t('engine.packages.edit.failed', locale));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('engine.packages.edit.title', locale)}</DialogTitle>
          <DialogDescription className="font-mono text-xs">{pkg?.manifest.id}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="pkg-edit-name">{t('engine.packages.create.name', locale)}</Label>
            <Input
              id="pkg-edit-name"
              data-testid="package-edit-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pkg-edit-desc">{t('engine.packages.detail.description', locale)}</Label>
            <Input
              id="pkg-edit-desc"
              data-testid="package-edit-desc-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pkg-edit-version">{t('engine.packages.create.version', locale)}</Label>
            <Input
              id="pkg-edit-version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              aria-invalid={!!version.trim() && !versionValid}
            />
            {!!version.trim() && !versionValid && (
              <p className="text-xs text-destructive">{t('engine.packages.create.versionInvalid', locale)}</p>
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
            {t('engine.cancel', locale)}
          </Button>
          <Button onClick={submit} disabled={!canSubmit} data-testid="package-edit-save">
            {busy ? t('engine.packages.edit.saving', locale) : t('engine.packages.edit.save', locale)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PackageDetailSheet({
  pkg,
  appBase,
  open,
  onOpenChange,
  onChanged,
}: {
  pkg: InstalledPackage | null;
  /** Base for metadata-browse / draft-review links. Omit (e.g. in Studio, which
   *  has no console app context) to hide those links; every lifecycle action
   *  still works without it. */
  appBase?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}) {
  const locale = React.useMemo(() => detectLocale(), []);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  // ADR-0033 — pending DRAFT items bound to this package. AI-authored metadata
  // lands as drafts that the active-only browsers hide, so without this the
  // package looks empty right after a build. We list them here with a link to
  // the existing per-item review/diff (?review=1) so the user can publish them.
  const [drafts, setDrafts] = React.useState<Array<{ type: string; name: string }> | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);

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
      setMsg({ kind: 'err', text: e?.message ?? t('engine.packages.detail.actionFailed', locale) });
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
                ? tFormat('engine.packages.detail.publishBlocked', locale, { count: n })
                : r.validationErrors?.[0]?.message || t('engine.packages.detail.nothingToPublish', locale),
            );
          }
          return r;
        }),
      t('engine.packages.detail.published', locale),
    );

  // ADR-0033 — publish every pending draft of this app in one shot, then
  // refresh the pending list (it should now be empty). Distinct from the
  // registry-based `publish` above; this hits `/publish-drafts`.
  const publishDrafts = () =>
    run(
      'publish-drafts',
      () =>
        apiJson<{ publishedCount?: number; failedCount?: number; failed?: Array<{ name?: string }> }>(
          `${API}/${encodeURIComponent(id)}/publish-drafts`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
        ).then(async (r) => {
          try {
            const fresh = await apiJson<{ drafts?: Array<{ type: string; name: string }> }>(
              `/api/v1/meta/_drafts?packageId=${encodeURIComponent(id)}`,
            );
            setDrafts(fresh?.drafts ?? []);
          } catch {
            setDrafts([]);
          }
          if (r?.failedCount) {
            throw new Error(tFormat('engine.packages.detail.publishDraftsPartial', locale, {
              published: r.publishedCount ?? 0,
              failed: r.failedCount,
            }));
          }
          return r;
        }),
      t('engine.packages.detail.publishDraftsOk', locale),
    );

  const revert = () =>
    run(
      'revert',
      () => apiJson(`${API}/${encodeURIComponent(id)}/revert`, { method: 'POST' }),
      t('engine.packages.detail.reverted', locale),
    );

  // ADR-0033 — discard every pending draft of this app in one shot, reverting
  // it to the last published baseline. NON-destructive: published metadata and
  // data are untouched. Distinct from the metadata-service `/revert` above —
  // this hits the robust `/discard-drafts` (sys_metadata) path.
  const discardDrafts = () =>
    run(
      'discard-drafts',
      () =>
        apiJson<{ discardedCount?: number; failedCount?: number }>(
          `${API}/${encodeURIComponent(id)}/discard-drafts`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
        ).then(async (r) => {
          try {
            const fresh = await apiJson<{ drafts?: Array<{ type: string; name: string }> }>(
              `/api/v1/meta/_drafts?packageId=${encodeURIComponent(id)}`,
            );
            setDrafts(fresh?.drafts ?? []);
          } catch {
            setDrafts([]);
          }
          if (r?.failedCount) {
            throw new Error(tFormat('engine.packages.detail.discardDraftsPartial', locale, {
              discarded: r.discardedCount ?? 0,
              failed: r.failedCount,
            }));
          }
          return r;
        }),
      t('engine.packages.detail.discardDraftsOk', locale),
    );

  // ADR-0033 — delete the WHOLE package: every metadata row (active + draft)
  // plus each object's physical table (DESTRUCTIVE). Confirmed, then closes the
  // sheet on success. Errors stay visible (sheet kept open).
  const deleteApp = async () => {
    const ok = window.confirm(
      tFormat('engine.packages.detail.deleteConfirm', locale, { name: pkg?.manifest.name || id }),
    );
    if (!ok) return;
    // ADR-0070 D4 (Q3) — let the user keep records (delete structure only).
    const alsoData = window.confirm(t('engine.packages.detail.deleteKeepData', locale));
    const qs = alsoData ? '' : '?keepData=true';
    setBusy('delete');
    setMsg(null);
    try {
      await apiJson(`${API}/${encodeURIComponent(id)}${qs}`, { method: 'DELETE' });
      onChanged();
      onOpenChange(false);
    } catch (e: any) {
      setMsg({ kind: 'err', text: e?.message ?? t('engine.packages.detail.deleteFailed', locale) });
    } finally {
      setBusy(null);
    }
  };

  // ADR-0070 D4 — duplicate this base into a NEW writable package (re-namespaced).
  const duplicateApp = async () => {
    const target = window.prompt(t('engine.packages.detail.duplicatePrompt', locale), `${id}-copy`);
    if (!target || !target.trim()) return;
    setBusy('duplicate');
    setMsg(null);
    try {
      await apiJson(`${API}/${encodeURIComponent(id)}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPackageId: target.trim(), targetName: `${pkg?.manifest.name ?? id} (copy)` }),
      });
      setMsg({ kind: 'ok', text: t('engine.packages.detail.duplicated', locale) });
      onChanged();
    } catch (e: any) {
      setMsg({ kind: 'err', text: e?.message ?? 'Duplicate failed' });
    } finally {
      setBusy(null);
    }
  };

  // ADR-0070 D5 — adopt every package-less (loose) item in this env INTO this base.
  const adoptOrphans = async () => {
    const ok = window.confirm(
      tFormat('engine.packages.detail.adoptConfirm', locale, { name: pkg?.manifest.name || id }),
    );
    if (!ok) return;
    setBusy('adopt');
    setMsg(null);
    try {
      await apiJson(`${API}/${encodeURIComponent(id)}/adopt-orphans`, { method: 'POST' });
      setMsg({ kind: 'ok', text: t('engine.packages.detail.adopted', locale) });
      onChanged();
    } catch (e: any) {
      setMsg({ kind: 'err', text: e?.message ?? 'Adopt failed' });
    } finally {
      setBusy(null);
    }
  };

  const toggleEnable = () =>
    run(
      'toggle',
      () =>
        apiJson(`${API}/${encodeURIComponent(id)}/${enabled ? 'disable' : 'enable'}`, {
          method: 'PATCH',
        }),
      enabled ? t('engine.packages.detail.disabled', locale) : t('engine.packages.detail.enabled', locale),
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
      t('engine.packages.detail.exported', locale),
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
          <DetailRow label={t('engine.packages.col.version', locale)}>{pkg.manifest.version || '—'}</DetailRow>
          <DetailRow label={t('engine.packages.detail.type', locale)}>{pkg.manifest.type || '—'}</DetailRow>
          <DetailRow label={t('engine.packages.col.scope', locale)}>
            <ScopeBadge scope={pkg.manifest.scope} />
          </DetailRow>
          <DetailRow label={t('engine.packages.col.status', locale)}>
            <StatusBadge pkg={pkg} />
          </DetailRow>
          {pkg.manifest.description && (
            <DetailRow label={t('engine.packages.detail.description', locale)}>{pkg.manifest.description}</DetailRow>
          )}
        </div>

        {appBase && (
          <>
            <Separator className="my-4" />
            <Link
              to={`${appBase}/metadata/object?package=${encodeURIComponent(id)}`}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              onClick={() => onOpenChange(false)}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t('engine.packages.detail.browseMetadata', locale)}
            </Link>
          </>
        )}

        {drafts && drafts.length > 0 && (
          <>
            <Separator className="my-4" />
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('engine.packages.detail.pendingChanges', locale)}
                <Badge variant="secondary">{drafts.length}</Badge>
              </p>
              <p className="text-xs text-muted-foreground">
                {t('engine.packages.detail.pendingHint', locale)}
              </p>
              {!isKernel && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={publishDrafts} disabled={!!busy}>
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    {busy === 'publish-drafts'
                      ? t('engine.packages.detail.publishing', locale)
                      : tFormat('engine.packages.detail.publishApp', locale, { count: drafts.length })}
                  </Button>
                  <Button size="sm" variant="outline" onClick={discardDrafts} disabled={!!busy}>
                    <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                    {busy === 'discard-drafts'
                      ? t('engine.packages.detail.discarding', locale)
                      : tFormat('engine.packages.detail.discardChanges', locale, { count: drafts.length })}
                  </Button>
                </div>
              )}
              <ul className="space-y-1">
                {drafts.map((d) =>
                  appBase ? (
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
                  ) : (
                    <li key={`${d.type}/${d.name}`} className="inline-flex items-center gap-1.5 text-sm">
                      <FileUp className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono text-xs">{d.type}</span>
                      <span className="text-muted-foreground">·</span>
                      {d.name}
                    </li>
                  ),
                )}
              </ul>
            </div>
          </>
        )}

        <Separator className="my-4" />

        {isKernel ? (
          <p className="text-sm text-muted-foreground">
            {t('engine.packages.detail.kernelReadOnly', locale)}
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('engine.packages.detail.actions', locale)}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} disabled={!!busy}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                {t('engine.packages.detail.edit', locale)}
              </Button>
              <Button size="sm" onClick={publish} disabled={!!busy}>
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {busy === 'publish' ? t('engine.packages.detail.publishing', locale) : t('engine.packages.detail.publish', locale)}
              </Button>
              <Button size="sm" variant="outline" onClick={revert} disabled={!!busy}>
                <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                {t('engine.packages.detail.revert', locale)}
              </Button>
              <Button size="sm" variant="outline" onClick={toggleEnable} disabled={!!busy}>
                {enabled ? (
                  <PowerOff className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <Power className="mr-1.5 h-3.5 w-3.5" />
                )}
                {enabled ? t('engine.packages.detail.disable', locale) : t('engine.packages.detail.enable', locale)}
              </Button>
              <Button size="sm" variant="outline" onClick={exportPkg} disabled={!!busy}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {busy === 'export' ? t('engine.packages.detail.exporting', locale) : t('engine.packages.detail.export', locale)}
              </Button>
              <Button size="sm" variant="outline" onClick={duplicateApp} disabled={!!busy}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                {busy === 'duplicate' ? t('engine.packages.detail.duplicating', locale) : t('engine.packages.detail.duplicate', locale)}
              </Button>
              <Button size="sm" variant="outline" onClick={adoptOrphans} disabled={!!busy}>
                <Inbox className="mr-1.5 h-3.5 w-3.5" />
                {busy === 'adopt' ? t('engine.packages.detail.adopting', locale) : t('engine.packages.detail.adoptOrphans', locale)}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={deleteApp}
                disabled={!!busy}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {busy === 'delete' ? t('engine.packages.detail.deleting', locale) : t('engine.packages.detail.deleteApp', locale)}
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

        <EditPackageDialog
          pkg={pkg}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSaved={() => {
            setMsg({ kind: 'ok', text: t('engine.packages.edit.saved', locale) });
            onChanged();
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

/* -------------------------------------------------------------------------- */
/* Main page                                                                   */
/* -------------------------------------------------------------------------- */

export function PackagesPage() {
  const locale = React.useMemo(() => detectLocale(), []);
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
      setError(e?.message ?? t('engine.packages.loadFailed', locale));
    } finally {
      setLoading(false);
    }
  }, [locale]);

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
        throw new Error(t('engine.packages.import.invalidJson', locale));
      }
      if (!manifest || typeof manifest !== 'object' || (!manifest.id && !manifest.name)) {
        throw new Error(t('engine.packages.import.invalidPackage', locale));
      }
      const res = await apiJson<any>('/api/v1/marketplace/install-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifest }),
      });
      setImportMsg({
        kind: 'ok',
        text: tFormat('engine.packages.import.success', locale, { id: res?.manifestId ?? manifest.id }),
      });
      await load();
    } catch (err: any) {
      setImportMsg({ kind: 'err', text: err?.message ?? t('engine.packages.import.failed', locale) });
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
            <h1 className="text-xl font-semibold tracking-tight">{t('engine.packages.title', locale)}</h1>
            <p className="text-sm text-muted-foreground">
              {t('engine.packages.description', locale)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {t('engine.packages.refresh', locale)}
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
            {importing ? t('engine.packages.importing', locale) : t('engine.packages.import', locale)}
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t('engine.packages.new', locale)}
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
            placeholder={t('engine.packages.search', locale)}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {kernelCount > 0 && (
          <div className="flex items-center gap-2">
            <Switch id="show-kernel" checked={showKernel} onCheckedChange={setShowKernel} />
            <Label htmlFor="show-kernel" className="text-sm text-muted-foreground">
              {tFormat('engine.packages.showPlatform', locale, { count: kernelCount })}
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
              <EmptyTitle>{t('engine.packages.empty', locale)}</EmptyTitle>
              <EmptyDescription>
                {packages.length === 0
                  ? t('engine.packages.emptyCreate', locale)
                  : t('engine.packages.emptyFiltered', locale)}
              </EmptyDescription>
            </Empty>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('engine.packages.col.name', locale)}</TableHead>
                <TableHead>ID</TableHead>
                <TableHead className="w-24">{t('engine.packages.col.version', locale)}</TableHead>
                <TableHead className="w-24">{t('engine.packages.col.scope', locale)}</TableHead>
                <TableHead className="w-24">{t('engine.packages.col.status', locale)}</TableHead>
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
