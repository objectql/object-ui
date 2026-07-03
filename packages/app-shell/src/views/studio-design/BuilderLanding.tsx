// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * BuilderLanding — the application builder's front door.
 *
 * The journey from login: Home → Studio app → 「应用构建」 (this page, embedded
 * in the app chrome via the `studio:builder` component ref) → pick or create a
 * writable base package → the full-screen pillar builder
 * (`/studio/:packageId/:tab`). Also served standalone at bare `/studio` so the
 * builder is bookmarkable.
 *
 * Writable bases (where authoring happens) lead; read-only code packages are
 * listed secondary for browsing. Writability is the shared display heuristic
 * from packages-io — the ADR-0070 D4 gate stays the server-side authority.
 */

import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, Hammer, Lock, Plus, Loader2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { toFieldNameLoose } from '../metadata-admin/previews/object-fields-io';
import { fetchPackages, createBasePackage, duplicatePackage, PACKAGE_ID_RE, type PkgEntry } from './packages-io';

export function BuilderLanding(): React.ReactElement {
  const navigate = useNavigate();
  const [pkgs, setPkgs] = React.useState<PkgEntry[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newId, setNewId] = React.useState('');
  const [idTouched, setIdTouched] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetchPackages()
      .then((list) => {
        if (!cancelled) setPkgs(list);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const open = (id: string) => navigate(`/studio/${encodeURIComponent(id)}/data`);

  const doCreate = async () => {
    const name = newName.trim();
    const id = newId.trim();
    if (!name || !PACKAGE_ID_RE.test(id)) return;
    setBusy(true);
    setError(null);
    try {
      await createBasePackage(id, name);
      open(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const writable = pkgs?.filter((p) => p.writable) ?? [];
  const readonly = pkgs?.filter((p) => !p.writable) ?? [];

  // 复制为可写副本 (ADR-0070 D4): a read-only code package is a STARTING POINT,
  // not a dead end — duplicate re-namespaces it into a new writable base and
  // drops the user straight into its builder. This is also the real substance
  // behind Home's "Start with a template".
  const [dupFor, setDupFor] = React.useState<string | null>(null);
  const [dupName, setDupName] = React.useState('');
  const [dupId, setDupId] = React.useState('');
  const [dupBusy, setDupBusy] = React.useState(false);
  const [dupErr, setDupErr] = React.useState<string | null>(null);

  const startDup = (p: PkgEntry) => {
    setDupFor(p.id);
    setDupName(`${p.name} 副本`);
    setDupId(`${p.id}-copy`);
    setDupErr(null);
  };
  const doDup = async () => {
    if (!dupFor) return;
    const id = dupId.trim();
    const name = dupName.trim();
    if (!PACKAGE_ID_RE.test(id) || !name) return;
    setDupBusy(true);
    setDupErr(null);
    try {
      await duplicatePackage(dupFor, id, name);
      toast.success(`已复制为可写软件包「${name}」`);
      open(id);
    } catch (e) {
      setDupErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDupBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <div className="mb-1 flex items-center gap-2">
        <Hammer className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold">应用构建</h1>
      </div>
      <p className="mb-5 text-xs leading-5 text-muted-foreground">
        在一个<b>可写软件包</b>里设计对象、表单、自动化与界面;编辑存为草稿,整包一次发布。
        源码加载的软件包为只读(仅可浏览)。
      </p>

      {error && (
        <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-[11px] text-destructive">
          {error}
        </div>
      )}

      <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        我的软件包(可写)
      </h2>
      <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {pkgs === null && <p className="text-[11px] text-muted-foreground">加载中…</p>}
        {pkgs !== null && writable.length === 0 && (
          <p className="text-[11px] text-muted-foreground">还没有可写软件包 — 从右侧新建一个开始。</p>
        )}
        {writable.map((p) => (
          <div key={p.id} className="rounded-lg border bg-background">
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <button
                type="button"
                onClick={() => open(p.id)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              >
                <Boxes className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{p.name}</span>
                  <span className="block truncate font-mono text-[10px] text-muted-foreground">{p.id}</span>
                </span>
              </button>
              <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-300">
                可写
              </span>
              {/* ADR-0070 D4 — duplicate base 只对可写 base 有意义:它复制的是
                * sys_metadata 里的行;code 包的定制走模板/市场安装,不在这里。 */}
              <button
                type="button"
                onClick={() => (dupFor === p.id ? setDupFor(null) : startDup(p))}
                title="复制这个软件包为新的可写副本(Airtable 的 duplicate base)"
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Copy className="h-3 w-3" /> 复制
              </button>
            </div>
            {dupFor === p.id && (
              <div className="flex flex-col gap-1.5 border-t px-3 py-2.5">
                <input
                  autoFocus
                  value={dupName}
                  onChange={(e) => setDupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void doDup();
                    if (e.key === 'Escape') setDupFor(null);
                  }}
                  placeholder="副本名称"
                  className="h-7 w-full rounded-md border bg-background px-2 text-[11px] outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  value={dupId}
                  onChange={(e) => setDupId(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void doDup();
                    if (e.key === 'Escape') setDupFor(null);
                  }}
                  placeholder="副本包 ID"
                  className="h-7 w-full rounded-md border bg-background px-2 font-mono text-[11px] outline-none focus:ring-1 focus:ring-primary"
                />
                {dupErr && <p className="text-[10px] text-destructive">{dupErr}</p>}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void doDup()}
                    disabled={dupBusy || !dupName.trim() || !PACKAGE_ID_RE.test(dupId.trim())}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {dupBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3" />}
                    复制并进入构建器
                  </button>
                  <button
                    type="button"
                    onClick={() => setDupFor(null)}
                    className="rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* new-package card */}
        {creating ? (
          <div className="flex flex-col gap-1.5 rounded-lg border border-dashed bg-muted/20 px-3 py-2.5">
            <input
              autoFocus
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                if (!idTouched) {
                  const slug = toFieldNameLoose(e.target.value).replace(/_/g, '-');
                  setNewId(slug ? `com.example.${slug}` : '');
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void doCreate();
                if (e.key === 'Escape') setCreating(false);
              }}
              placeholder="名称(如:维修中心)"
              className="h-7 w-full rounded-md border bg-background px-2 text-[11px] outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              value={newId}
              onChange={(e) => {
                setIdTouched(true);
                setNewId(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void doCreate();
                if (e.key === 'Escape') setCreating(false);
              }}
              placeholder="包 ID(如:com.example.repairs)"
              className="h-7 w-full rounded-md border bg-background px-2 font-mono text-[11px] outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void doCreate()}
                disabled={busy || !newName.trim() || !PACKAGE_ID_RE.test(newId.trim())}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                创建并开始构建
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-2.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
          >
            <Plus className="h-4 w-4" /> 新建软件包
          </button>
        )}
      </div>

      {readonly.length > 0 && (
        <>
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            已安装(只读 · 可浏览)
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {readonly.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => open(p.id)}
                className="flex items-center gap-2.5 rounded-lg border bg-muted/20 px-3 py-2.5 text-left hover:bg-muted/40"
              >
                <Boxes className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">{p.name}</span>
                  <span className="block truncate font-mono text-[10px] text-muted-foreground">{p.id}</span>
                </span>
                <span className="inline-flex items-center gap-0.5 rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-300">
                  <Lock className="h-2.5 w-2.5" /> 只读
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
