// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * StudioDesignSurface — the open-source WYSIWYG design surface (ADR-0080).
 *
 * Three zones — single-App nav · live canvas · property inspector — composed
 * AROUND the existing metadata-admin registry (`getMetadataPreview` /
 * `getMetadataInspector`) and the runtime `SchemaRenderer`, so design-time is
 * literally run-time (same renderer, same metadata).
 *
 * Open-core boundary: the left AI copilot is NOT part of the open-source
 * surface. It is an injected slot (`aiSlot`) that the cloud edition fills; the
 * OSS build renders three zones. Everything else — nav, canvas, inspector,
 * the select→edit→re-render loop — lives here, in the open package.
 *
 * slice-1 drives a fixture page with no backend so the surface is demoable
 * standalone. Real metadata load/save (useMetadataClient) and nav-driven
 * surface switching land in follow-up slices.
 */

import * as React from 'react';
import { SchemaRenderer } from '@object-ui/react';
import {
  Boxes,
  Layers3,
  ShieldCheck,
  SlidersHorizontal,
  MousePointer2,
  Eye,
  Lock,
} from 'lucide-react';
import { getMetadataPreview, type MetadataSelection } from '../metadata-admin/preview-registry';
import { getMetadataInspector } from '../metadata-admin/inspector-registry';

// ── Fixture: one "Interface" page draft. Built from element blocks that
//    render with no backend. Replaced by real metadata in a later slice. ──
const FIXTURE_PAGE: Record<string, unknown> = {
  type: 'page',
  name: 'projects_overview',
  label: '项目与任务',
  regions: [
    {
      name: 'main',
      components: [
        {
          type: 'element:definition-list',
          id: 'summary',
          properties: {
            columns: 2,
            items: [
              { term: '负责人', description: 'Sophia Rodriguez' },
              { term: '状态', description: '进行中' },
              { term: '截止', description: '2026-07-15' },
              { term: '进度', description: '60%' },
            ],
          },
        },
        {
          type: 'element:definition-list',
          id: 'meta',
          properties: {
            columns: 1,
            items: [
              { term: '团队', description: '平台组' },
              { term: '优先级', description: '高' },
            ],
          },
        },
      ],
    },
  ],
};

// ── Mock single-App nav. The permission chips illustrate the role-projection
//    model (ADR-0080 D4). Replaced by a real App nav model in a later slice. ──
const NAV: Array<{
  group: string;
  locked?: boolean;
  items: Array<{ icon: React.ComponentType<{ className?: string }>; label: string; perm?: string; active?: boolean }>;
}> = [
  {
    group: '工作区',
    items: [
      { icon: Layers3, label: '我的任务', perm: '所有人' },
      { icon: Boxes, label: '项目与任务', perm: '项目成员', active: true },
      { icon: SlidersHorizontal, label: '看板', perm: '项目成员' },
    ],
  },
  {
    group: '管理',
    locked: true,
    items: [
      { icon: ShieldCheck, label: '团队', perm: '管理员' },
      { icon: Eye, label: '洞察看板', perm: '管理员' },
    ],
  },
];

const PILLARS = ['Data', 'Automations', 'Interfaces'] as const;

export interface StudioDesignSurfaceProps {
  /**
   * Open-core slot. The cloud edition injects its AI copilot panel here
   * (rendered as the far-left zone). The open-source build leaves it
   * undefined, so the surface renders three zones.
   */
  aiSlot?: React.ReactNode;
}

export function StudioDesignSurface({ aiSlot }: StudioDesignSurfaceProps): React.ReactElement {
  const [draft, setDraft] = React.useState<Record<string, unknown>>(FIXTURE_PAGE);
  const [selection, setSelection] = React.useState<MetadataSelection | null>(null);
  const locale = 'zh-CN';

  // Reuse the REAL registered surfaces — no new editor code.
  const Preview = getMetadataPreview('page');
  const Inspector = getMetadataInspector('page');

  const onPatch = React.useCallback(
    (patch: Record<string, unknown>) => setDraft((d) => ({ ...d, ...patch })),
    [],
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* ── Zone 0 · AI copilot — OPEN-CORE SLOT (cloud-injected; absent in OSS) ── */}
      {aiSlot ? (
        <aside className="w-64 shrink-0 overflow-auto border-r bg-muted/40">{aiSlot}</aside>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar: three pillars + publish */}
        <header className="flex items-center justify-between border-b px-3 py-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium">
              <Boxes className="h-4 w-4" /> 项目管理包
            </span>
            <span className="text-muted-foreground">·</span>
            <nav className="flex gap-1">
              {PILLARS.map((p) => (
                <span
                  key={p}
                  className={
                    'rounded-md px-2.5 py-1 text-xs ' +
                    (p === 'Interfaces'
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-muted-foreground')
                  }
                >
                  {p}
                </span>
              ))}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted">
              <Eye className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />预览
            </button>
            <button className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
              发布
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* ── Zone 1 · single-App nav (multi-level + permission chips) ── */}
          <nav className="w-44 shrink-0 overflow-auto border-r p-2">
            <p className="px-2 pb-1 pt-1 text-[11px] font-medium text-muted-foreground">单一 App</p>
            {NAV.map((g) => (
              <div key={g.group}>
                <p className="flex items-center gap-1 px-2 pb-1 pt-3 text-[11px] text-muted-foreground">
                  {g.group}
                  {g.locked && <Lock className="h-3 w-3" />}
                </p>
                {g.items.map((it) => (
                  <div
                    key={it.label}
                    className={
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ' +
                      (it.active ? 'bg-muted font-medium' : 'text-foreground/90')
                    }
                  >
                    <it.icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 truncate">{it.label}</span>
                    {it.perm && (
                      <span className="flex items-center gap-0.5 whitespace-nowrap rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">
                        <Lock className="h-2.5 w-2.5" />
                        {it.perm}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </nav>

          {/* ── Zone 2 · canvas (live render = runtime) ── */}
          <main className="min-w-0 flex-1 overflow-auto bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                <Eye className="h-3 w-3" /> 预览即运行 · 同一渲染器
              </span>
              <span className="text-[11px] text-muted-foreground">草稿</span>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[13px] font-medium">
                  {String((draft as { label?: string }).label ?? '项目与任务')}
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  对象视图 / page
                </span>
              </div>
              {Preview ? (
                <Preview
                  type="page"
                  name="projects_overview"
                  draft={draft}
                  editing
                  selection={selection}
                  onSelectionChange={setSelection}
                  onPatch={onPatch}
                  locale={locale}
                />
              ) : (
                <SchemaRenderer schema={{ ...draft, type: 'page' } as never} />
              )}
            </div>
            <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
              <MousePointer2 className="h-3 w-3" /> 点选积木 → 右侧直接改
            </p>
          </main>

          {/* ── Zone 3 · inspector (selected block's property schema) ── */}
          <aside className="w-72 shrink-0 overflow-auto border-l">
            <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="text-[13px] font-medium">属性</span>
              {selection?.label && (
                <span className="truncate rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  {selection.label}
                </span>
              )}
            </header>
            <div className="p-3">
              {selection && Inspector ? (
                <Inspector
                  type="page"
                  name="projects_overview"
                  draft={draft}
                  selection={selection}
                  onPatch={onPatch}
                  onClearSelection={() => setSelection(null)}
                  onSelectionChange={setSelection}
                  readOnly={false}
                  locale={locale}
                />
              ) : (
                <div className="flex flex-col items-center gap-2 px-2 py-10 text-center text-xs text-muted-foreground">
                  <MousePointer2 className="h-5 w-5" />
                  在画布里点选一个积木,
                  <br />
                  它的属性会在这里直接编辑。
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default StudioDesignSurface;
