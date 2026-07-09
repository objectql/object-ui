// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * PermissionPreview — read-only heatmap of a Permission Set draft.
 *
 * Permission Sets get edited as deeply-nested JSON in the generic
 * form, which makes it nearly impossible to spot mistakes like
 * "Account: edit without read" or "this set has zero objects". The
 * preview renders the matrix that operators actually reason about:
 *
 *   1. Header strip: name, profile/permission-set flag, system perms
 *      count, tab perms count, RLS rule count.
 *   2. Object × CRUD-VAMA grid. Each row is one object; each column
 *      is one capability (Create/Read/Edit/Delete/Transfer/Restore/
 *      Purge/ViewAll/ModifyAll). Cells are colored chips — green when
 *      granted, neutral when not, amber when "View All" or "Modify
 *      All" is on (highlighting the bypass).
 *   3. Field-level security: grouped by object, only fields with a
 *      non-default setting are listed (read=false or editable=true).
 *   4. System permissions + Tab visibility as compact chip lists.
 *
 * Sanity-check banner at the bottom flags risky combinations:
 *   • allowEdit without allowRead (silently fails at runtime)
 *   • allowDelete without allowRead
 *   • modifyAllRecords without viewAllRecords
 */

import * as React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Eye,
  Layers,
  Lock,
  ShieldCheck,
  Star,
  Tag,
} from 'lucide-react';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewMessage, PreviewErrorBoundary } from './PreviewShell';

interface ObjectPermission {
  allowCreate?: boolean;
  allowRead?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  allowTransfer?: boolean;
  allowRestore?: boolean;
  allowPurge?: boolean;
  viewAllRecords?: boolean;
  modifyAllRecords?: boolean;
}

interface FieldPermission {
  readable?: boolean;
  editable?: boolean;
}

const CAPS: Array<{ key: keyof ObjectPermission; short: string; long: string; danger?: boolean }> = [
  { key: 'allowCreate', short: 'C', long: 'Create' },
  { key: 'allowRead', short: 'R', long: 'Read' },
  { key: 'allowEdit', short: 'U', long: 'Edit' },
  { key: 'allowDelete', short: 'D', long: 'Delete' },
  { key: 'allowTransfer', short: 'T', long: 'Transfer' },
  { key: 'allowRestore', short: 'Re', long: 'Restore' },
  { key: 'allowPurge', short: 'P', long: 'Purge', danger: true },
  { key: 'viewAllRecords', short: 'V*', long: 'View All', danger: true },
  { key: 'modifyAllRecords', short: 'M*', long: 'Modify All', danger: true },
];

interface Warning {
  object: string;
  message: string;
}

function findWarnings(objects: Record<string, ObjectPermission>): Warning[] {
  const out: Warning[] = [];
  for (const [obj, p] of Object.entries(objects)) {
    if (p.allowEdit && !p.allowRead) out.push({ object: obj, message: 'Edit granted without Read (record updates will fail).' });
    if (p.allowDelete && !p.allowRead) out.push({ object: obj, message: 'Delete granted without Read.' });
    if (p.modifyAllRecords && !p.viewAllRecords) out.push({ object: obj, message: 'Modify All without View All — modifications may target invisible records.' });
    if (p.allowPurge && !p.allowDelete) out.push({ object: obj, message: 'Purge (hard delete) granted without Delete.' });
  }
  return out;
}

export function PermissionPreview({ name, draft }: MetadataPreviewProps) {
  const d = draft as Record<string, unknown>;
  const permName = String(d.name ?? name ?? '');
  const label = String(d.label ?? permName);
  // ADR-0090 D2: Profile removed; the star now marks the package-suggested default set (D5).
  const isDefault = !!d.isDefault;
  const objects = (d.objects ?? {}) as Record<string, ObjectPermission>;
  const fields = (d.fields ?? {}) as Record<string, FieldPermission>;
  const systemPerms = Array.isArray(d.systemPermissions) ? (d.systemPermissions as string[]) : [];
  const tabPerms = (d.tabPermissions ?? {}) as Record<string, string>;
  const rls = Array.isArray(d.rowLevelSecurity) ? (d.rowLevelSecurity as unknown[]) : [];

  const objectNames = React.useMemo(() => Object.keys(objects).sort(), [objects]);
  const warnings = React.useMemo(() => findWarnings(objects), [objects]);

  // Group field permissions by object name (key format: "<object>.<field>").
  const fieldsByObject = React.useMemo(() => {
    const out = new Map<string, Array<{ field: string; perm: FieldPermission }>>();
    for (const [key, perm] of Object.entries(fields)) {
      const [obj, ...rest] = key.split('.');
      if (!obj || rest.length === 0) continue;
      const fname = rest.join('.');
      // Only surface entries that diverge from the default (read=true, edit=false).
      const isNonDefault = perm.readable === false || perm.editable === true;
      if (!isNonDefault) continue;
      if (!out.has(obj)) out.set(obj, []);
      out.get(obj)!.push({ field: fname, perm });
    }
    return out;
  }, [fields]);

  if (objectNames.length === 0 && systemPerms.length === 0 && Object.keys(tabPerms).length === 0) {
    return (
      <PreviewShell hint="permission">
        <PreviewMessage>Grant at least one object, system, or tab permission to see the matrix.</PreviewMessage>
      </PreviewShell>
    );
  }

  return (
    <PreviewShell hint={`permission · ${objectNames.length} object${objectNames.length === 1 ? '' : 's'}`}>
      <PreviewErrorBoundary>
        <div className="p-3 space-y-3">
          {/* Header */}
          <div className="rounded border bg-muted/30 p-3">
            <div className="flex items-start gap-2">
              {isDefault ? (
                <Star className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
              ) : (
                <ShieldCheck className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium truncate">{label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{permName}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {isDefault ? 'Default Permission Set' : 'Permission Set'}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                  <Pill icon={Layers} label={`${objectNames.length} objects`} />
                  <Pill icon={Tag} label={`${systemPerms.length} system perms`} />
                  <Pill icon={Eye} label={`${Object.keys(tabPerms).length} tabs`} />
                  <Pill icon={Lock} label={`${rls.length} RLS rules`} />
                </div>
              </div>
            </div>
          </div>

          {/* Object × CRUD matrix */}
          {objectNames.length > 0 && (
            <Section title="Object Permissions" count={objectNames.length}>
              <div className="rounded border bg-background overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-2.5 py-1.5 text-left font-medium sticky left-0 bg-muted/30">Object</th>
                      {CAPS.map((c) => (
                        <th key={c.key} className="px-1.5 py-1.5 text-center font-medium" title={c.long}>
                          {c.short}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {objectNames.map((obj) => {
                      const p = objects[obj] ?? {};
                      return (
                        <tr key={obj}>
                          <td className="px-2.5 py-1 font-mono sticky left-0 bg-background">{obj}</td>
                          {CAPS.map((c) => {
                            const granted = !!p[c.key];
                            return (
                              <td key={c.key} className="px-1.5 py-1 text-center">
                                <Cell granted={granted} danger={c.danger} />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Legend />
            </Section>
          )}

          {/* Field-Level Security overrides */}
          {fieldsByObject.size > 0 && (
            <Section title="Field-Level Overrides" count={Array.from(fieldsByObject.values()).reduce((a, v) => a + v.length, 0)}>
              <div className="rounded border bg-background divide-y text-xs">
                {Array.from(fieldsByObject.entries()).sort().map(([obj, entries]) => (
                  <div key={obj} className="px-2.5 py-2">
                    <div className="font-mono text-[11px] mb-1">{obj}</div>
                    <ul className="flex flex-wrap gap-1">
                      {entries.map(({ field, perm }) => (
                        <li
                          key={field}
                          className="inline-flex items-center gap-1 rounded border bg-muted/30 px-1.5 py-0.5"
                          title={`readable=${perm.readable !== false}, editable=${!!perm.editable}`}
                        >
                          <span className="font-mono">{field}</span>
                          {perm.readable === false && (
                            <span className="text-[9px] uppercase text-red-700">hidden</span>
                          )}
                          {perm.editable && (
                            <span className="text-[9px] uppercase text-emerald-700">editable</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* System permissions */}
          {systemPerms.length > 0 && (
            <Section title="System Permissions" count={systemPerms.length}>
              <div className="flex flex-wrap gap-1">
                {systemPerms.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[11px] font-mono">
                    {s}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Tab visibility */}
          {Object.keys(tabPerms).length > 0 && (
            <Section title="Tab Visibility" count={Object.keys(tabPerms).length}>
              <div className="flex flex-wrap gap-1">
                {Object.entries(tabPerms).map(([tab, vis]) => (
                  <span
                    key={tab}
                    className="inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[11px]"
                  >
                    <span className="font-mono">{tab}</span>
                    <span
                      className={
                        vis === 'hidden'
                          ? 'text-[9px] uppercase text-red-700'
                          : vis === 'visible' || vis === 'default_on'
                            ? 'text-[9px] uppercase text-emerald-700'
                            : 'text-[9px] uppercase text-muted-foreground'
                      }
                    >
                      {vis}
                    </span>
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Sanity warnings */}
          {warnings.length > 0 && (
            <div className="rounded border border-amber-200 bg-amber-50 p-2.5 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" /> {warnings.length} sanity check{warnings.length === 1 ? '' : 's'} failed
              </div>
              <ul className="space-y-0.5">
                {warnings.map((w, i) => (
                  <li key={i} className="text-amber-900">
                    <code className="font-mono">{w.object}</code>: {w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}

function Cell({ granted, danger }: { granted: boolean; danger?: boolean }) {
  if (!granted) {
    return <Circle className="inline-block h-3 w-3 text-muted-foreground/40" aria-label="not granted" />;
  }
  const cls = danger ? 'text-amber-600' : 'text-emerald-600';
  return <CheckCircle2 className={`inline-block h-3.5 w-3.5 ${cls}`} aria-label="granted" />;
}

function Legend() {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3 text-emerald-600" /> granted
      </span>
      <span className="inline-flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3 text-amber-600" /> bypass (View/Modify All, Purge)
      </span>
      <span className="inline-flex items-center gap-1">
        <Circle className="h-3 w-3 text-muted-foreground/40" /> not granted
      </span>
      <span className="ml-auto font-mono">
        C R U D = CRUD · T Re P = Transfer/Restore/Purge · V* M* = View/Modify All
      </span>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
        <span>{title}</span>
        {count != null && <span className="opacity-70">({count})</span>}
      </div>
      {children}
    </div>
  );
}

function Pill({
  icon: Icon,
  label,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
      <span>{label}</span>
    </span>
  );
}
