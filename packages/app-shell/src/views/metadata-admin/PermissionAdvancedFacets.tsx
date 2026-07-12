/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import {
  Input,
  Label,
  Switch,
  Button,
  Textarea,
  Badge,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  cn,
} from '@object-ui/components';
import { ChevronRight, Plus, Trash2, Shield, Lock, PanelTop } from 'lucide-react';

/**
 * Structured editors for the three "advanced" permission facets — Row-Level
 * Security, Tab Visibility, and Delegated Admin Scope — on the Studio /
 * env-scope permission matrix (ADR-0056 P3 / epic #2398).
 *
 * These facets were authorable ONLY as raw JSON in Setup. In the pure model
 * they are *designed* here in Studio via structured editors and shown read-only
 * in Setup (PermissionFacetLink, P1). Each editor reads/writes the draft's
 * parsed camelCase field (`rowLevelSecurity` / `tabPermissions` / `adminScope`)
 * — tolerating a JSON string on load so legacy rows survive — and is persisted
 * by the editor's existing whole-record Save. Shapes mirror the framework spec
 * (sampled from live data): RLS policies `{name,object,operation,using,check,
 * enabled,priority}`; admin scope `{businessUnit,includeSubtree,manage*,
 * authorEnvironmentSets,assignablePermissionSets[]}`.
 */

interface RlsPolicy {
  name?: string;
  object?: string;
  operation?: string;
  using?: string;
  check?: string;
  enabled?: boolean;
  priority?: number;
}

interface AdminScope {
  businessUnit?: string;
  includeSubtree?: boolean;
  manageAssignments?: boolean;
  manageBindings?: boolean;
  authorEnvironmentSets?: boolean;
  assignablePermissionSets?: string[];
}

type TabVisibility = 'visible' | 'hidden' | 'default_on' | 'default_off';
type TabPerms = Record<string, TabVisibility>;

const RLS_OPERATIONS = ['all', 'select', 'insert', 'update', 'delete'] as const;
const TAB_VISIBILITIES: TabVisibility[] = ['visible', 'hidden', 'default_on', 'default_off'];

/** Tolerantly coerce a facet value (parsed value or JSON string) to an array. */
function asArray<T = unknown>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === 'string' && v.trim()) {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? (p as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Tolerantly coerce a facet value (parsed value or JSON string) to an object. */
function asObject<T extends object = Record<string, unknown>>(v: unknown): T {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as T;
  if (typeof v === 'string' && v.trim()) {
    try {
      const p = JSON.parse(v);
      if (p && typeof p === 'object' && !Array.isArray(p)) return p as T;
    } catch {
      /* fall through */
    }
  }
  return {} as T;
}

const selectCls =
  'h-8 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50';

interface FacetSectionProps {
  title: string;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

/** A collapsible facet section so the three editors don't crowd the matrix. */
function FacetSection({ title, icon, count, children, defaultOpen }: FacetSectionProps) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-6 py-2.5 text-left hover:bg-muted/40">
        <ChevronRight
          className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-90')}
        />
        {icon}
        <span className="text-sm font-medium">{title}</span>
        {count != null && count > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {count}
          </Badge>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-6 pb-4 pt-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export interface PermissionAdvancedFacetsProps {
  draft: Record<string, unknown> & {
    rowLevelSecurity?: unknown;
    tabPermissions?: unknown;
    adminScope?: unknown;
  };
  setDraft: (updater: (prev: any) => any) => void;
  writable: boolean;
  /** All permission-set api-names — for the admin-scope assignable allowlist. */
  allSetNames: string[];
  t: (k: string) => string;
}

export function PermissionAdvancedFacets({
  draft,
  setDraft,
  writable,
  allSetNames,
  t,
}: PermissionAdvancedFacetsProps) {
  const policies = React.useMemo<RlsPolicy[]>(() => asArray(draft.rowLevelSecurity), [draft.rowLevelSecurity]);
  const scope = React.useMemo<AdminScope>(() => asObject(draft.adminScope), [draft.adminScope]);
  const tabs = React.useMemo<TabPerms>(() => asObject(draft.tabPermissions), [draft.tabPermissions]);

  const setPolicies = (next: RlsPolicy[]) =>
    setDraft((p) => ({ ...p, rowLevelSecurity: next }));
  const setScope = (patch: Partial<AdminScope>) =>
    setDraft((p) => ({ ...p, adminScope: { ...asObject(p.adminScope), ...patch } }));
  const setTabs = (next: TabPerms) => setDraft((p) => ({ ...p, tabPermissions: next }));

  const tabEntries = Object.entries(tabs);

  return (
    <div className="border-b bg-muted/10">
      {/* Row-Level Security */}
      <FacetSection
        title={t('perm.rls.title')}
        icon={<Lock className="h-4 w-4 text-muted-foreground" />}
        count={policies.length}
      >
        <p className="text-xs text-muted-foreground mb-3">{t('perm.rls.help')}</p>
        <div className="space-y-3">
          {policies.map((pol, i) => (
            <div key={i} className="rounded-md border p-3 space-y-2 bg-background">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={pol.name ?? ''}
                  disabled={!writable}
                  placeholder={t('perm.rls.name')}
                  onChange={(e) => {
                    const next = [...policies];
                    next[i] = { ...pol, name: e.target.value };
                    setPolicies(next);
                  }}
                  className="h-8 w-48"
                />
                <Input
                  value={pol.object ?? ''}
                  disabled={!writable}
                  placeholder={t('perm.rls.object')}
                  onChange={(e) => {
                    const next = [...policies];
                    next[i] = { ...pol, object: e.target.value };
                    setPolicies(next);
                  }}
                  className="h-8 w-40"
                />
                <select
                  value={pol.operation ?? 'all'}
                  disabled={!writable}
                  onChange={(e) => {
                    const next = [...policies];
                    next[i] = { ...pol, operation: e.target.value };
                    setPolicies(next);
                  }}
                  className={selectCls}
                >
                  {RLS_OPERATIONS.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-xs">
                  <Switch
                    checked={pol.enabled !== false}
                    disabled={!writable}
                    onCheckedChange={(v) => {
                      const next = [...policies];
                      next[i] = { ...pol, enabled: !!v };
                      setPolicies(next);
                    }}
                  />
                  {t('perm.rls.enabled')}
                </label>
                {writable && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 ml-auto text-muted-foreground hover:text-destructive"
                    onClick={() => setPolicies(policies.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">
                    {t('perm.rls.using')}
                  </Label>
                  <Textarea
                    value={pol.using ?? ''}
                    disabled={!writable}
                    rows={2}
                    placeholder="organization_id == current_user.organization_id"
                    onChange={(e) => {
                      const next = [...policies];
                      next[i] = { ...pol, using: e.target.value };
                      setPolicies(next);
                    }}
                    className="font-mono text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">
                    {t('perm.rls.check')}
                  </Label>
                  <Textarea
                    value={pol.check ?? ''}
                    disabled={!writable}
                    rows={2}
                    placeholder={t('perm.rls.checkPlaceholder')}
                    onChange={(e) => {
                      const next = [...policies];
                      next[i] = { ...pol, check: e.target.value };
                      setPolicies(next);
                    }}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          ))}
          {policies.length === 0 && (
            <p className="text-xs text-muted-foreground italic">{t('perm.rls.empty')}</p>
          )}
          {writable && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPolicies([
                  ...policies,
                  { name: '', object: '*', operation: 'all', using: '', enabled: true, priority: 0 },
                ])
              }
            >
              <Plus className="h-4 w-4 mr-1" /> {t('perm.rls.add')}
            </Button>
          )}
        </div>
      </FacetSection>

      {/* Tab Visibility */}
      <FacetSection
        title={t('perm.tabs.title')}
        icon={<PanelTop className="h-4 w-4 text-muted-foreground" />}
        count={tabEntries.length}
      >
        <p className="text-xs text-muted-foreground mb-3">{t('perm.tabs.help')}</p>
        <div className="space-y-2">
          {tabEntries.map(([tab, vis]) => (
            <div key={tab} className="flex items-center gap-2">
              <Input
                value={tab}
                disabled={!writable}
                onChange={(e) => {
                  const nextKey = e.target.value;
                  const next: TabPerms = {};
                  for (const [k, v] of tabEntries) next[k === tab ? nextKey : k] = v;
                  setTabs(next);
                }}
                className="h-8 w-64"
              />
              <select
                value={vis}
                disabled={!writable}
                onChange={(e) => setTabs({ ...tabs, [tab]: e.target.value as TabVisibility })}
                className={selectCls}
              >
                {TAB_VISIBILITIES.map((v) => (
                  <option key={v} value={v}>
                    {t(`perm.tabs.vis.${v}`)}
                  </option>
                ))}
              </select>
              {writable && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    const next = { ...tabs };
                    delete next[tab];
                    setTabs(next);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {tabEntries.length === 0 && (
            <p className="text-xs text-muted-foreground italic">{t('perm.tabs.empty')}</p>
          )}
          {writable && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (tabs[''] !== undefined) return;
                setTabs({ ...tabs, '': 'visible' });
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> {t('perm.tabs.add')}
            </Button>
          )}
        </div>
      </FacetSection>

      {/* Delegated Admin Scope */}
      <FacetSection
        title={t('perm.admin.title')}
        icon={<Shield className="h-4 w-4 text-muted-foreground" />}
        count={scope.businessUnit || (scope.assignablePermissionSets?.length ?? 0) ? 1 : 0}
      >
        <p className="text-xs text-muted-foreground mb-3">{t('perm.admin.help')}</p>
        <div className="space-y-3 max-w-2xl">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs">{t('perm.admin.businessUnit')}</Label>
              <Input
                value={scope.businessUnit ?? ''}
                disabled={!writable}
                onChange={(e) => setScope({ businessUnit: e.target.value })}
                className="h-8 w-64"
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs pb-1.5">
              <Switch
                checked={!!scope.includeSubtree}
                disabled={!writable}
                onCheckedChange={(v) => setScope({ includeSubtree: !!v })}
              />
              {t('perm.admin.includeSubtree')}
            </label>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {(
              [
                ['manageAssignments', 'perm.admin.manageAssignments'],
                ['manageBindings', 'perm.admin.manageBindings'],
                ['authorEnvironmentSets', 'perm.admin.authorEnvironmentSets'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-1.5 text-xs">
                <Switch
                  checked={!!scope[key]}
                  disabled={!writable}
                  onCheckedChange={(v) => setScope({ [key]: !!v } as Partial<AdminScope>)}
                />
                {t(label)}
              </label>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('perm.admin.assignableSets')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {allSetNames.length === 0 && (
                <span className="text-xs text-muted-foreground">{t('perm.admin.noSets')}</span>
              )}
              {allSetNames.map((setName) => {
                const on = (scope.assignablePermissionSets ?? []).includes(setName);
                return (
                  <button
                    type="button"
                    key={setName}
                    disabled={!writable}
                    aria-pressed={on}
                    onClick={() => {
                      const cur = scope.assignablePermissionSets ?? [];
                      const next = on ? cur.filter((s) => s !== setName) : [...cur, setName];
                      setScope({ assignablePermissionSets: next });
                    }}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50',
                      on
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input bg-background hover:bg-accent',
                    )}
                  >
                    {setName}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </FacetSection>
    </div>
  );
}

export default PermissionAdvancedFacets;
