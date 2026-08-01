// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * DatasourcePreview — read-only summary of a Datasource draft.
 *
 * Datasources hold connection material, so the preview's most
 * important contract is "show enough to verify the binding, never
 * leak secrets". Concretely:
 *
 *   • Header: driver pill (postgres/mysql/mongo/…), name, label,
 *     active flag, default-flag.
 *   • Connection card: a redacted config table where any key whose
 *     name matches /pass|secret|key|token|credential/i is replaced
 *     with `••••••` and a "redacted" badge. Other primitives render
 *     verbatim; nested objects render as their key count.
 *   • Pool, SSL, retry, health-check pills derived from optional
 *     sibling blocks.
 *   • Capabilities chip strip.
 *
 * A read-replica count pill used to sit in that strip. It is gone with
 * `datasource.readReplicas` itself (objectstack#4468): nothing in the
 * platform ever opened a replica connection, so the pill reported a
 * configuration that did not exist — and, being the only surface that
 * acknowledged the key at all, it was the strongest signal an author had
 * that it worked. A preview echoes what was typed; it can never stand in
 * for a runtime consumer (`packages/spec/liveness/README.md`).
 *
 * The preview never attempts a live "test connection" — it runs
 * inside the editor sandbox and must remain side-effect free.
 */

import * as React from 'react';
import {
  Activity,
  Database,
  HardDrive,
  Lock,
  Power,
  RotateCcw,
  ShieldCheck,
  Star,
} from 'lucide-react';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewMessage, PreviewErrorBoundary } from './PreviewShell';
import { ExternalDatasourcePanel } from '../external/ExternalDatasourcePanel';

const SECRET_RE = /pass|secret|key|token|credential|auth/i;

function isSecretKey(k: string): boolean {
  return SECRET_RE.test(k);
}

function redactValue(v: unknown): string {
  if (v == null || v === '') return '∅';
  return '••••••';
}

function renderValue(v: unknown): string {
  if (v == null) return '∅';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `[${v.length}]`;
  if (typeof v === 'object') return `{${Object.keys(v).length} keys}`;
  return String(v);
}

export function DatasourcePreview({ name, draft }: MetadataPreviewProps) {
  const d = draft as Record<string, unknown>;
  const dsName = String(d.name ?? name ?? '');
  const label = String(d.label ?? dsName);
  const description = (d.description as string | undefined) ?? '';
  const driver = (d.driver as string | undefined) ?? (d.type as string | undefined) ?? 'unknown';
  const active = d.active !== false;
  const isDefault = !!d.isDefault || !!d.default;
  const config = (d.config as Record<string, unknown> | undefined) ?? {};
  const pool = d.pool as Record<string, unknown> | undefined;
  const ssl = d.ssl as Record<string, unknown> | boolean | undefined;
  const retryPolicy = d.retryPolicy as Record<string, unknown> | undefined;
  const healthCheck = d.healthCheck as Record<string, unknown> | undefined;
  const capabilities = Array.isArray(d.capabilities) ? (d.capabilities as string[]) : [];

  // External Datasource Federation (ADR-0015): a non-'managed' schemaMode
  // marks this datasource as federated. The panel keys off the *saved* item
  // name (`name`) so its REST calls hit a persisted datasource.
  const schemaMode = (d.schemaMode as string | undefined) ?? 'managed';
  const isFederated = schemaMode !== 'managed';
  const external = (d.external as Record<string, unknown> | undefined) ?? undefined;
  const allowWrites = !!external?.allowWrites;

  const configEntries = Object.entries(config);

  if (!dsName && configEntries.length === 0) {
    return (
      <PreviewShell hint="datasource">
        <PreviewMessage>Set a name and at least a driver to see the datasource preview.</PreviewMessage>
      </PreviewShell>
    );
  }

  return (
    <PreviewShell hint={`datasource · ${driver}`}>
      <PreviewErrorBoundary>
        <div className="p-3 space-y-3">
          {/* Header */}
          <div className="rounded border bg-muted/30 p-3">
            <div className="flex items-start gap-2">
              <Database className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium truncate">{label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{dsName}</span>
                </div>
                {description && (
                  <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                  <span className="inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 font-mono">
                    <HardDrive className="h-3 w-3 text-muted-foreground" /> {driver}
                  </span>
                  <Pill icon={Power} label={active ? 'Active' : 'Disabled'} tone={active ? 'green' : 'gray'} />
                  {isDefault && <Pill icon={Star} label="default" tone="amber" />}
                </div>
              </div>
            </div>
          </div>

          {/* External Datasource Federation surfaces (browse / validate).
              Keyed off the saved PK (`name`) — an unsaved draft has no
              persisted datasource for the REST routes to introspect. */}
          {isFederated && (
            <ExternalDatasourcePanel
              datasource={String(name ?? '')}
              schemaMode={schemaMode}
              allowWrites={allowWrites}
            />
          )}

          {/* Connection config */}
          <Section title="Connection" icon={Lock}>
            {configEntries.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">No config keys set.</div>
            ) : (
              <div className="rounded border bg-background overflow-hidden">
                <table className="w-full text-xs">
                  <tbody className="divide-y">
                    {configEntries.map(([k, v]) => {
                      const secret = isSecretKey(k);
                      return (
                        <tr key={k}>
                          <td className="px-2.5 py-1.5 align-top w-40 font-mono text-muted-foreground">
                            {k}
                          </td>
                          <td className="px-2.5 py-1.5 font-mono break-all">
                            {secret ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span>{redactValue(v)}</span>
                                <span className="rounded bg-amber-50 border border-amber-200 px-1 py-0.5 text-[9px] uppercase tracking-wider text-amber-800">
                                  redacted
                                </span>
                              </span>
                            ) : (
                              renderValue(v)
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Side rail blocks */}
          <div className="grid gap-2 sm:grid-cols-2">
            <SideBlock title="Pool" icon={Activity} value={pool} />
            <SideBlock
              title="SSL"
              icon={ShieldCheck}
              value={typeof ssl === 'boolean' ? { enabled: ssl } : ssl}
            />
            <SideBlock title="Retry Policy" icon={RotateCcw} value={retryPolicy} />
            <SideBlock title="Health Check" icon={Activity} value={healthCheck} />
          </div>

          {/* Capabilities */}
          {capabilities.length > 0 && (
            <Section title="Capabilities" icon={ShieldCheck}>
              <div className="flex flex-wrap gap-1">
                {capabilities.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 rounded border bg-muted/40 px-1.5 py-0.5 text-[11px] font-mono"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}

function SideBlock({
  title,
  icon: Icon,
  value,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  value: Record<string, unknown> | undefined;
}) {
  const present = value && typeof value === 'object' && Object.keys(value).length > 0;
  return (
    <div className={`rounded border bg-background ${present ? '' : 'opacity-60'}`}>
      <div className="flex items-center gap-1.5 border-b px-2.5 py-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">{title}</span>
      </div>
      <div className="px-2.5 py-1.5 text-[11px]">
        {!present ? (
          <span className="text-muted-foreground italic">not configured</span>
        ) : (
          <dl className="space-y-0.5">
            {Object.entries(value).slice(0, 6).map(([k, v]) => (
              <div key={k} className="flex items-baseline gap-2 truncate">
                <dt className="text-muted-foreground font-mono shrink-0">{k}:</dt>
                <dd className="font-mono truncate">
                  {isSecretKey(k) ? redactValue(v) : renderValue(v)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
        {Icon && <Icon className="h-3 w-3" />}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Pill({
  icon: Icon,
  label,
  tone = 'gray',
  mono = false,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  tone?: 'gray' | 'green' | 'amber';
  mono?: boolean;
}) {
  const cls =
    tone === 'green' ? 'text-emerald-700' : tone === 'amber' ? 'text-amber-700' : 'text-foreground';
  return (
    <span className="inline-flex items-center gap-1">
      {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
      <span className={`${cls} ${mono ? 'font-mono' : ''}`}>{label}</span>
    </span>
  );
}
