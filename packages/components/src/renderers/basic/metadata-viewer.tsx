/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `element:metadata_viewer` — a read-only, live-resolved view of a metadata
 * item, embedded inline in content (ADR-0051). This is the SDUI component a
 * ```` ```metadata ```` doc fence compiles to: the inline form of ADR-0046 §3.5
 * ("derived content is rendered, never written"). It resolves the target
 * metadata by name at render time (so it never goes stale) and renders a
 * read-only projection — it carries no expressions or actions, staying on the
 * data side of the §3.4 trust boundary.
 *
 * Spec: `framework/packages/spec/src/ui/component.zod.ts`
 *   ElementMetadataViewerPropsSchema → { type, name, object?, mode?, detail? }
 *   type ∈ state_machine | flow | permission   (`object` embeds deferred)
 */

import * as React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { useMetadataItem } from '@object-ui/react';
import {
  ArrowRight,
  CircleDot,
  Flag,
  Workflow,
  GitBranch,
  ShieldCheck,
  Check,
  Minus,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

interface ViewerProps {
  type?: 'state_machine' | 'flow' | 'permission';
  name?: string;
  object?: string;
  mode?: 'diagram' | 'matrix' | 'summary';
  detail?: 'business' | 'technical';
}

function readProps(schema: any): ViewerProps {
  const fromProperties = (schema?.properties ?? {}) as ViewerProps;
  const fromProps = (schema?.props ?? {}) as ViewerProps;
  return { ...fromProps, ...fromProperties };
}

/** Tolerate `fields` as either an object map or an array of `{name,...}`. */
function getField(obj: any, name?: string): any {
  if (!obj || !name) return undefined;
  const f = obj.fields;
  if (!f) return undefined;
  if (Array.isArray(f)) return f.find((x: any) => x?.name === name);
  return f[name];
}

function Shell({
  hint,
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
      <div className="flex items-start gap-2.5 border-b bg-muted/40 px-3.5 py-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold leading-tight">{title}</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{hint}</span>
          </div>
          {subtitle && <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>}
        </div>
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}

function Placeholder({ tone = 'muted', children }: { tone?: 'muted' | 'warn'; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-xs',
        tone === 'warn'
          ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
          : 'bg-muted/30 text-muted-foreground',
      )}
    >
      {tone === 'warn' && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// state_machine — live transition graph from a `state_machine` validation rule
// ---------------------------------------------------------------------------

interface SelectOption {
  label?: string;
  value: string;
  color?: string;
  default?: boolean;
}

function StateMachineView({ object, name }: ViewerProps) {
  const { item: obj, loading, error } = useMetadataItem('object', object ?? null);

  const rule = React.useMemo(() => {
    const rules: any[] = obj?.validations ?? obj?.validationRules ?? [];
    if (!Array.isArray(rules)) return undefined;
    return rules.find(
      (r) => r?.type === 'state_machine' && (!name || r?.name === name),
    );
  }, [obj, name]);

  if (!object) return <Placeholder tone="warn">Missing <code className="font-mono">object</code> for the state machine.</Placeholder>;
  if (loading) return <Placeholder>Loading <code className="font-mono">{object}</code>…</Placeholder>;
  if (error) return <Placeholder tone="warn">Failed to load object <code className="font-mono">{object}</code>: {error.message}</Placeholder>;
  if (!obj) return <Placeholder tone="warn">Object <code className="font-mono">{object}</code> not found.</Placeholder>;
  if (!rule) {
    return (
      <Placeholder tone="warn">
        No state machine{name ? ` named “${name}”` : ''} on <code className="font-mono">{object}</code>.
      </Placeholder>
    );
  }

  const transitions: Record<string, string[]> =
    rule.transitions && typeof rule.transitions === 'object' && !Array.isArray(rule.transitions)
      ? rule.transitions
      : {};
  const field = getField(obj, rule.field);
  const options: SelectOption[] = Array.isArray(field?.options) ? field.options : [];
  const optByValue = new Map(options.map((o) => [o.value, o]));
  const labelOf = (v: string) => optByValue.get(v)?.label ?? v;
  const colorOf = (v: string) => optByValue.get(v)?.color;
  const initial = options.find((o) => o.default)?.value;

  // All states = union of declared options, transition sources, and targets —
  // ordered: initial first, then option order, then any extras.
  const ordered = new Set<string>();
  if (initial) ordered.add(initial);
  for (const o of options) ordered.add(o.value);
  for (const [from, tos] of Object.entries(transitions)) {
    ordered.add(from);
    for (const t of tos) ordered.add(t);
  }
  const states = [...ordered];

  const Chip = ({ value }: { value: string }) => {
    const color = colorOf(value);
    return (
      <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs font-medium">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color ?? 'var(--muted-foreground)' }} />
        {labelOf(value)}
      </span>
    );
  };

  return (
    <Shell
      hint="state machine"
      icon={Workflow}
      title={rule.label ?? rule.name ?? 'State machine'}
      subtitle={
        <>
          Lifecycle of <code className="font-mono">{object}</code>
          {rule.field ? <> · field <code className="font-mono">{rule.field}</code></> : null}
        </>
      }
    >
      <ol className="space-y-1.5">
        {states.map((s) => {
          const tos = transitions[s] ?? [];
          const isInitial = s === initial;
          const isFinal = tos.length === 0;
          return (
            <li
              key={s}
              className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-md border bg-muted/20 px-2.5 py-2"
            >
              <Chip value={s} />
              {isInitial && (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <CircleDot className="h-3 w-3" /> initial
                </span>
              )}
              {isFinal ? (
                <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Flag className="h-3 w-3" /> final
                </span>
              ) : (
                <>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex flex-wrap gap-1.5">
                    {tos.map((t) => (
                      <Chip key={t} value={t} />
                    ))}
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// flow — ordered step summary of a flow's nodes (read-only)
// ---------------------------------------------------------------------------

// Node-action families that are infrastructure, not business steps. With
// `detail: business` (the default), these are folded away so a non-technical
// reader sees the process, not the plumbing (ADR-0051 §3.4 altitude projection).
const TECHNICAL_NODE_TYPES = new Set([
  'script',
  'http_request',
  'connector_action',
  'assignment',
  'get_record',
  'create_record',
  'update_record',
  'delete_record',
  'boundary_event',
]);

function FlowView({ name, detail }: ViewerProps) {
  const { item: flow, loading, error } = useMetadataItem('flow', name ?? null);

  if (!name) return <Placeholder tone="warn">Missing <code className="font-mono">name</code> for the flow.</Placeholder>;
  if (loading) return <Placeholder>Loading flow <code className="font-mono">{name}</code>…</Placeholder>;
  if (error) return <Placeholder tone="warn">Failed to load flow <code className="font-mono">{name}</code>: {error.message}</Placeholder>;
  if (!flow) return <Placeholder tone="warn">Flow <code className="font-mono">{name}</code> not found.</Placeholder>;

  const allNodes: any[] = Array.isArray(flow.nodes) ? flow.nodes : [];
  const business = (detail ?? 'business') === 'business';
  const nodes = business ? allNodes.filter((n) => !TECHNICAL_NODE_TYPES.has(n?.type)) : allNodes;
  const hiddenCount = allNodes.length - nodes.length;

  return (
    <Shell
      hint="flow"
      icon={GitBranch}
      title={flow.label ?? flow.name ?? name}
      subtitle={flow.description ?? <>Process with {allNodes.length} step{allNodes.length === 1 ? '' : 's'}</>}
    >
      {nodes.length === 0 ? (
        <Placeholder>No steps to show.</Placeholder>
      ) : (
        <ol className="space-y-1.5">
          {nodes.map((n, i) => (
            <li key={n?.id ?? i} className="flex items-center gap-2.5 rounded-md border bg-muted/20 px-2.5 py-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                {i + 1}
              </span>
              <span className="text-sm">{n?.label ?? n?.id ?? '(step)'}</span>
              {n?.type && (
                <span className="ml-auto rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {n.type}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
      {business && hiddenCount > 0 && (
        <div className="mt-2 text-[11px] text-muted-foreground">
          {hiddenCount} technical step{hiddenCount === 1 ? '' : 's'} hidden · set <code className="font-mono">detail: technical</code> to show all
        </div>
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// permission — compact object-level CRUD matrix (read-only)
// ---------------------------------------------------------------------------

const CRUD: Array<{ key: string; label: string }> = [
  { key: 'allowCreate', label: 'C' },
  { key: 'allowRead', label: 'R' },
  { key: 'allowEdit', label: 'U' },
  { key: 'allowDelete', label: 'D' },
];

function PermissionView({ name }: ViewerProps) {
  const { item: perm, loading, error } = useMetadataItem('permission', name ?? null);

  if (!name) return <Placeholder tone="warn">Missing <code className="font-mono">name</code> for the permission set.</Placeholder>;
  if (loading) return <Placeholder>Loading permission set <code className="font-mono">{name}</code>…</Placeholder>;
  if (error) return <Placeholder tone="warn">Failed to load permission <code className="font-mono">{name}</code>: {error.message}</Placeholder>;
  if (!perm) return <Placeholder tone="warn">Permission set <code className="font-mono">{name}</code> not found.</Placeholder>;

  const objects: Record<string, any> = perm.objects && typeof perm.objects === 'object' ? perm.objects : {};
  const entries = Object.entries(objects);

  return (
    <Shell
      hint="permission"
      icon={ShieldCheck}
      title={perm.label ?? perm.name ?? name}
      subtitle={<>Object access · {entries.length} object{entries.length === 1 ? '' : 's'}</>}
    >
      {entries.length === 0 ? (
        <Placeholder>No object permissions declared.</Placeholder>
      ) : (
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="border-b px-2 py-1.5 text-left font-medium">Object</th>
              {CRUD.map((c) => (
                <th key={c.key} className="border-b px-2 py-1.5 text-center font-mono font-medium" title={c.key}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map(([objName, perms]) => (
              <tr key={objName}>
                <td className="border-b px-2 py-1.5 font-mono">{objName}</td>
                {CRUD.map((c) => (
                  <td key={c.key} className="border-b px-2 py-1.5 text-center">
                    {perms?.[c.key] ? (
                      <Check className="mx-auto h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Minus className="mx-auto h-3.5 w-3.5 text-muted-foreground/40" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Dispatcher + registration
// ---------------------------------------------------------------------------

export function ElementMetadataViewerRenderer({ schema }: { schema: any }) {
  const props = readProps(schema);
  switch (props.type) {
    case 'state_machine':
      return <StateMachineView {...props} />;
    case 'flow':
      return <FlowView {...props} />;
    case 'permission':
      return <PermissionView {...props} />;
    default:
      return (
        <Placeholder tone="warn">
          Unknown metadata view type{props.type ? ` “${props.type}”` : ''}. Expected{' '}
          <code className="font-mono">state_machine</code>, <code className="font-mono">flow</code>, or{' '}
          <code className="font-mono">permission</code>.
        </Placeholder>
      );
  }
}

ComponentRegistry.register('element:metadata_viewer', ElementMetadataViewerRenderer, {
  namespace: 'element',
  label: 'Metadata Viewer',
  category: 'content',
});
