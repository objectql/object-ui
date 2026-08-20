// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * TranslationPreview — read-only coverage report for one locale bundle.
 *
 * A translation record represents exactly one locale (per the i18n ADR).
 * This preview answers two questions an operator typically has when
 * opening a translation:
 *
 *   1. "Which locale is this and how complete is it?" → header strip
 *      with the locale badge, total-key count, and an overall coverage
 *      bar (categories that have at least one entry).
 *   2. "Where are the strings?" → a card per category in
 *      `TranslationDataSchema`: objects · apps · messages ·
 *      validationMessages · globalActions · dashboards · settings ·
 *      metadataForms. Each card shows the count of top-level keys and
 *      a sample of up to 5 keys so the user can confirm the right
 *      bundle is loaded.
 *
 * For flat string maps (messages, validationMessages, globalActions,
 * settings) we render a small key→value sample table. For nested
 * objects (objects, apps, dashboards, metadataForms) we list the
 * top-level keys with their inner key count.
 */

import * as React from 'react';
import {
  AppWindow,
  ClipboardList,
  FileText,
  Gauge,
  Globe2,
  LayoutDashboard,
  Languages,
  ListChecks,
  MessageCircle,
  Settings2,
  ShieldAlert,
} from 'lucide-react';
import type { MetadataPreviewProps } from '../preview-registry.js';
import { PreviewShell, PreviewMessage, PreviewErrorBoundary } from './PreviewShell.js';

type Dict = Record<string, unknown>;

interface CategoryDef {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** When true, the value is { key: string } (flat). Otherwise { key: nestedObject }. */
  flat: boolean;
}

const CATEGORIES: CategoryDef[] = [
  { key: 'objects', label: 'Objects', icon: ListChecks, flat: false },
  { key: 'apps', label: 'Apps', icon: AppWindow, flat: false },
  { key: 'messages', label: 'Messages', icon: MessageCircle, flat: true },
  { key: 'validationMessages', label: 'Validation Messages', icon: ShieldAlert, flat: true },
  { key: 'globalActions', label: 'Global Actions', icon: ClipboardList, flat: true },
  { key: 'dashboards', label: 'Dashboards', icon: LayoutDashboard, flat: false },
  { key: 'settings', label: 'Settings', icon: Settings2, flat: true },
  { key: 'metadataForms', label: 'Metadata Forms', icon: FileText, flat: false },
];

export function TranslationPreview({ name, draft }: MetadataPreviewProps) {
  const d = draft as Record<string, unknown>;
  const locale = (d.locale as string | undefined) ?? (d.language as string | undefined) ?? '?';
  const label = (d.label as string | undefined) ?? (d.name as string | undefined) ?? name ?? '';
  const description = d.description as string | undefined;
  const data = (d.data as Dict | undefined) ?? (d as Dict);

  const counts = CATEGORIES.map((cat) => {
    const bag = data?.[cat.key];
    if (!bag || typeof bag !== 'object') return { ...cat, count: 0, sample: [] as Array<[string, unknown]> };
    const entries = Object.entries(bag as Dict);
    return { ...cat, count: entries.length, sample: entries.slice(0, 5) };
  });

  const totalKeys = counts.reduce((sum, c) => sum + c.count, 0);
  const populated = counts.filter((c) => c.count > 0).length;
  const coverage = Math.round((populated / CATEGORIES.length) * 100);

  if (totalKeys === 0) {
    return (
      <PreviewShell hint={`translation · ${locale}`}>
        <PreviewMessage>This bundle is empty — add at least one translated string to see the coverage report.</PreviewMessage>
      </PreviewShell>
    );
  }

  return (
    <PreviewShell hint={`translation · ${locale} · ${totalKeys} keys`}>
      <PreviewErrorBoundary>
        <div className="p-3 space-y-3">
          {/* Header */}
          <div className="rounded border bg-muted/30 p-3">
            <div className="flex items-start gap-2">
              <Languages className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium truncate">{label}</span>
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-mono text-emerald-800">
                    <Globe2 className="h-3 w-3" /> {locale}
                  </span>
                </div>
                {description && <div className="text-xs text-muted-foreground mt-0.5">{description}</div>}
                <div className="mt-2 flex items-center gap-2 text-[11px]">
                  <Gauge className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Category coverage:</span>
                  <div className="h-1.5 w-32 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${coverage}%` }}
                    />
                  </div>
                  <span className="font-mono">
                    {populated}/{CATEGORIES.length} ({coverage}%)
                  </span>
                  <span className="ml-3 text-muted-foreground">{totalKeys} total keys</span>
                </div>
              </div>
            </div>
          </div>

          {/* Category grid */}
          <div className="grid gap-2 sm:grid-cols-2">
            {counts.map((c) => (
              <CategoryCard key={c.key} cat={c} />
            ))}
          </div>
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}

function CategoryCard({
  cat,
}: {
  cat: CategoryDef & { count: number; sample: Array<[string, unknown]> };
}) {
  const Icon = cat.icon;
  return (
    <div className={`rounded border bg-background ${cat.count === 0 ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between border-b px-2.5 py-1.5">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">{cat.label}</span>
        </div>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">{cat.count}</span>
      </div>
      <div className="px-2.5 py-1.5 min-h-[3.5rem]">
        {cat.count === 0 ? (
          <div className="text-[11px] text-muted-foreground italic">empty</div>
        ) : (
          <ul className="space-y-0.5 text-[11px]">
            {cat.sample.map(([k, v]) => (
              <li key={k} className="flex items-baseline gap-2 truncate">
                <code className="font-mono text-muted-foreground shrink-0">{k}</code>
                <span className="truncate text-foreground/80">{renderSampleValue(v, cat.flat)}</span>
              </li>
            ))}
            {cat.count > cat.sample.length && (
              <li className="text-[10px] text-muted-foreground italic">
                +{cat.count - cat.sample.length} more…
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function renderSampleValue(v: unknown, flat: boolean): string {
  if (flat) {
    if (typeof v === 'string') return `"${v}"`;
    if (v == null) return '∅';
    return String(v);
  }
  if (v && typeof v === 'object') {
    const n = Object.keys(v as Dict).length;
    return `{${n} keys}`;
  }
  return String(v ?? '∅');
}
