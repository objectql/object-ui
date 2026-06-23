// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * AppContextSelectors — renders the app-level "scope" dropdowns declared
 * in `App.contextSelectors` (e.g. the Studio package filter) and exposes
 * their current values so the sidebar can feed them into
 * `NavigationRenderer`'s `templateContext.contextValues`.
 *
 * Each selector's value is published under its `id` and referenced by
 * nav items as `{<id>}` (e.g. `{active_package}`), exactly like the
 * built-in `{current_user_id}` / `{current_org_id}` template vars.
 * Selecting an option therefore transparently scopes every child nav
 * item — no per-item wiring required.
 *
 * @module
 */

import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@object-ui/components';
import { getIcon } from '../utils/getIcon';
import { resolveI18nLabel } from '../utils';

export interface ContextSelectorFilter {
  key: string;
  op?: 'eq' | 'ne' | 'in' | 'nin';
  value: string | string[];
}

export interface ContextSelectorDef {
  id: string;
  label?: unknown;
  icon?: string;
  optionsSource: { endpoint: string; valueKey?: string; labelKey?: string; filter?: ContextSelectorFilter[] };
  includeAll?: boolean;
  allValue?: string;
  persist?: 'query' | 'session' | 'none';
  placement?: 'sidebar_header' | 'topbar';
}

interface Option { value: string; label: string }

const ALL_SENTINEL = '__all__';

/** Read a (possibly dotted) property path off a row, e.g. `manifest.id`. */
function getByPath(row: any, key: string): unknown {
  if (!key) return undefined;
  return key.split('.').reduce((o: any, k) => (o == null ? o : o[k]), row);
}

/** Tolerate the common REST envelope shapes used across the platform. */
function extractRows(json: any): any[] {
  if (Array.isArray(json)) return json;
  const d = json?.data ?? json;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.packages)) return d.packages;
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(json?.items)) return json.items;
  return [];
}

/** Apply a selector's `filter` predicates (AND) to a fetched row. */
function rowPasses(row: any, filters: ContextSelectorFilter[] | undefined): boolean {
  if (!filters || filters.length === 0) return true;
  for (const f of filters) {
    const actual = getByPath(row, f.key);
    const op = f.op ?? 'eq';
    const list = Array.isArray(f.value) ? f.value : [f.value];
    switch (op) {
      case 'eq': if (actual !== f.value) return false; break;
      case 'ne': if (actual === f.value) return false; break;
      // `in`/`nin` treat a missing value as "not in the set", which keeps
      // untagged rows visible under `nin` (e.g. a package whose manifest
      // omits `scope` defaults to project and should remain selectable).
      case 'in': if (!list.includes(actual as string)) return false; break;
      case 'nin': if (list.includes(actual as string)) return false; break;
    }
  }
  return true;
}

function useSelectorOptions(def: ContextSelectorDef): { options: Option[]; refetch: () => void } {
  const [options, setOptions] = React.useState<Option[]>([]);
  const endpoint = def.optionsSource.endpoint;
  const valueKey = def.optionsSource.valueKey || 'id';
  const labelKey = def.optionsSource.labelKey || 'name';
  const filters = def.optionsSource.filter;
  const filterKey = JSON.stringify(filters ?? []);

  // Stable, re-runnable fetch. Without an explicit refetch the option list is
  // read once on mount, so a package created elsewhere (PackagesPage) stays
  // invisible in this dropdown until a full page reload. We refetch on
  // dropdown-open and on a global `objectui:packages-changed` signal.
  const load = React.useCallback(async () => {
    try {
      const res = await fetch(endpoint, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;
      const json = await res.json();
      const rows = extractRows(json);
      const opts: Option[] = [];
      const seen = new Set<string>();
      for (const row of rows) {
        if (!rowPasses(row, filters)) continue;
        const value = getByPath(row, valueKey);
        if (value == null || typeof value !== 'string' || seen.has(value)) continue;
        seen.add(value);
        const labelRaw = getByPath(row, labelKey);
        opts.push({ value, label: typeof labelRaw === 'string' && labelRaw ? labelRaw : value });
      }
      opts.sort((a, b) => a.label.localeCompare(b.label));
      setOptions(opts);
    } catch {
      /* offline / unauthorized — render with no options */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, valueKey, labelKey, filterKey]);

  React.useEffect(() => {
    void load();
    const onChanged = () => { void load(); };
    window.addEventListener('objectui:packages-changed', onChanged);
    return () => window.removeEventListener('objectui:packages-changed', onChanged);
  }, [load]);

  return { options, refetch: load };
}

/**
 * Hook: resolves the active values for an app's context selectors and
 * returns a ready-to-render UI element plus the `contextValues` map for
 * `NavigationRenderer`.
 */
export function useAppContextSelectors(
  appName: string,
  selectors: ContextSelectorDef[] | undefined,
  t?: (key: string, options?: any) => string,
): { contextValues: Record<string, string>; element: React.ReactNode } {
  const list = Array.isArray(selectors) ? selectors : [];
  const navigate = useNavigate();
  const location = useLocation();

  // The URL query string is the single source of truth for the active
  // scope. Deriving the selected value from it (rather than a parallel
  // useState) keeps the sidebar control in lock-step with the page — no
  // more "sidebar says A while the list shows B" drift.
  const params = new URLSearchParams(location.search);

  // Re-apply a remembered scope whenever navigation drops the query param.
  // The selector is mandatory for Studio: package-scoped pages should never
  // sit at a blank package value just because a nav link omitted `?package=`.
  React.useEffect(() => {
    const p = new URLSearchParams(location.search);
    let changed = false;
    for (const sel of list) {
      if (sel.persist === 'none') continue;
      if (p.get('package')) continue;
      try {
        const saved = sessionStorage.getItem(`objectui-ctx-${appName}-${sel.id}`);
        if (saved) { p.set('package', saved); changed = true; }
      } catch { /* storage disabled */ }
    }
    if (changed) {
      navigate({ pathname: location.pathname, search: p.toString() }, { replace: true });
    }
  }, [appName, list, location.pathname, location.search, navigate]);

  const setValue = React.useCallback((sel: ContextSelectorDef, raw: string) => {
    const value = raw === ALL_SENTINEL ? (sel.allValue ?? '') : raw;
    try {
      const key = `objectui-ctx-${appName}-${sel.id}`;
      if (value) sessionStorage.setItem(key, value);
      else sessionStorage.removeItem(key);
    } catch { /* storage disabled */ }

    // Reflect the scope onto the current page immediately. Metadata
    // surfaces read the `package` query param as the conventional filter
    // key; nav links pick it up via the `{active_package}` template var.
    const next = new URLSearchParams(location.search);
    if (value) next.set('package', value);
    else next.delete('package');
    navigate({ pathname: location.pathname, search: next.toString() }, { replace: true });
  }, [appName, location.pathname, location.search, navigate]);

  const contextValues: Record<string, string> = {};
  for (const sel of list) {
    let saved = '';
    try {
      saved = sessionStorage.getItem(`objectui-ctx-${appName}-${sel.id}`) ?? '';
    } catch { /* storage disabled */ }
    contextValues[sel.id] = (params.get('package') ?? saved) || (sel.allValue ?? '');
  }

  const element = list.length === 0 ? null : (
    <div className="flex flex-col gap-1.5">
      {list.map((sel) => (
        <SelectorControl
          key={sel.id}
          def={sel}
          value={contextValues[sel.id]}
          onChange={(raw) => setValue(sel, raw)}
          t={t}
        />
      ))}
    </div>
  );

  return { contextValues, element };
}

function SelectorControl({
  def,
  value,
  onChange,
  t,
}: {
  def: ContextSelectorDef;
  value: string;
  onChange: (raw: string) => void;
  t?: (key: string, options?: any) => string;
}) {
  const { options, refetch } = useSelectorOptions(def);
  const Icon = getIcon(def.icon);
  const rawLabel = resolveI18nLabel(def.label as any, t) || def.id;
  const label = rawLabel === 'Package'
    ? (t?.('common.package', { defaultValue: rawLabel }) ?? rawLabel)
    : rawLabel;
  const placeholder = t?.('actionDialog.selectPlaceholder', {
    label,
    defaultValue: `Select ${label}…`,
  }) ?? `Select ${label}…`;

  // Context selectors are *mandatory scope* selectors: a concrete option must
  // always be active. Allowing an "All" choice would unscope the surface and,
  // for Studio's package filter, leak system metadata. We therefore ignore
  // `includeAll`, never render an "All" row, and auto-select the first option
  // as soon as the list resolves when nothing concrete is selected yet.
  const hasConcrete = !!value && value !== (def.allValue ?? '');
  React.useEffect(() => {
    if (hasConcrete) {
      return;
    }
    if (options.length > 0) {
      onChange(options[0].value);
    }
  }, [hasConcrete, onChange, options]);

  const current = hasConcrete ? value : '';

  return (
    <Select
      value={current}
      onValueChange={onChange}
      onOpenChange={(open) => { if (open) refetch(); }}
    >
      <SelectTrigger
        aria-label={label}
        className="h-9 w-full gap-2 rounded-md border-sidebar-border/70 bg-sidebar/80 px-2 text-xs font-medium text-sidebar-foreground shadow-none transition-colors hover:bg-sidebar-accent focus:ring-1 focus:ring-sidebar-ring data-[state=open]:bg-sidebar-accent [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-sidebar-border/70 bg-sidebar-accent text-sidebar-foreground/70">
            <Icon className="h-3 w-3" />
          </span>
          <SelectValue placeholder={placeholder} className="truncate" />
        </div>
      </SelectTrigger>
      <SelectContent className="w-[var(--radix-select-trigger-width)]">
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
