// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FlowPreview — read-only summary of a Flow metadata draft.
 *
 * A full DAG canvas lives in `@object-ui/plugin-designer` and would
 * pull in ReactFlow + its deps every time the metadata-admin loads,
 * which is too heavy for a glance-preview. Instead we render:
 *
 *   1. A header strip with type / status / runAs / version.
 *   2. A topologically ordered step list inferred from `nodes` +
 *      `edges`. Each step shows label, action type, branch markers,
 *      and outgoing edge conditions so authors can sanity-check the
 *      logic without launching the designer.
 *   3. A variables side panel listing declared flow variables.
 *
 * The renderer is defensive — drafts may be mid-edit with dangling
 * edges or duplicate node ids; we never throw, we just degrade.
 */

import * as React from 'react';
import {
  ArrowDown,
  CircleDot,
  CircleStop,
  Diamond,
  GitBranch,
  Play,
  Plus,
  Settings2,
  TimerReset,
  Variable,
  Workflow,
  Zap,
} from 'lucide-react';
import { cn } from '@object-ui/components';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewMessage, PreviewErrorBoundary } from './PreviewShell';
import { uniqueId, appendArray } from '../inspectors/_shared';
import { t as tr } from '../i18n';

interface FlowNode {
  id: string;
  type: string;
  label?: string;
  config?: Record<string, unknown>;
}

interface FlowEdge {
  id?: string;
  source: string;
  target: string;
  condition?: string | { source?: string };
  type?: string;
  label?: string;
  isDefault?: boolean;
}

interface FlowVariable {
  name: string;
  type?: string;
  defaultValue?: unknown;
  description?: string;
  isInput?: boolean;
  isOutput?: boolean;
}

function nodeIcon(type: string) {
  switch (type) {
    case 'start':
      return Play;
    case 'end':
      return CircleStop;
    case 'decision':
    case 'branch':
    case 'gateway':
      return Diamond;
    case 'wait':
    case 'timer':
      return TimerReset;
    case 'boundary_event':
    case 'signal':
      return Zap;
    case 'subflow':
    case 'flow':
      return Workflow;
    default:
      return CircleDot;
  }
}

/**
 * Per-node-type color tone — makes step kinds scannable in the list
 * and mirrors the field-type / nav-kind tinting used elsewhere in
 * Studio. Class strings are written in full for Tailwind's JIT.
 */
interface NodeTone {
  /** Icon + type-label text color. */
  icon: string;
  /** Step-number chip (border + bg + text). */
  chip: string;
}

const NODE_TONE: Record<string, NodeTone> = {
  start: {
    icon: 'text-emerald-600 dark:text-emerald-400',
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  end: {
    icon: 'text-rose-600 dark:text-rose-400',
    chip: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300',
  },
  decision: {
    icon: 'text-amber-600 dark:text-amber-400',
    chip: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  },
  wait: {
    icon: 'text-blue-600 dark:text-blue-400',
    chip: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300',
  },
  signal: {
    icon: 'text-violet-600 dark:text-violet-400',
    chip: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300',
  },
  subflow: {
    icon: 'text-indigo-600 dark:text-indigo-400',
    chip: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300',
  },
  task: {
    icon: 'text-slate-500 dark:text-slate-400',
    chip: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300',
  },
};

function nodeTone(type: string): NodeTone {
  switch (type) {
    case 'start':
      return NODE_TONE.start;
    case 'end':
      return NODE_TONE.end;
    case 'decision':
    case 'branch':
    case 'gateway':
      return NODE_TONE.decision;
    case 'wait':
    case 'timer':
      return NODE_TONE.wait;
    case 'boundary_event':
    case 'signal':
      return NODE_TONE.signal;
    case 'subflow':
    case 'flow':
      return NODE_TONE.subflow;
    default:
      return NODE_TONE.task;
  }
}

function conditionText(c: FlowEdge['condition']): string | undefined {
  if (!c) return undefined;
  if (typeof c === 'string') return c;
  if (typeof c === 'object' && typeof (c as any).source === 'string') return (c as any).source;
  return undefined;
}

/**
 * Topologically order nodes starting from the first `start` node (or
 * the first node) using BFS. Nodes unreachable from start are appended
 * at the end so the author still sees them.
 */
function orderNodes(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  if (nodes.length === 0) return [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    if (!adjacency.has(e.source)) adjacency.set(e.source, []);
    adjacency.get(e.source)!.push(e.target);
  }
  const startNode = nodes.find((n) => n.type === 'start') ?? nodes[0];
  const visited = new Set<string>();
  const out: FlowNode[] = [];
  const queue: string[] = [startNode.id];
  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = byId.get(id);
    if (node) out.push(node);
    for (const next of adjacency.get(id) ?? []) {
      if (!visited.has(next)) queue.push(next);
    }
  }
  for (const n of nodes) if (!visited.has(n.id)) out.push(n);
  return out;
}

export function FlowPreview({ draft, editing, selection, onSelectionChange, onPatch, locale }: MetadataPreviewProps) {
  const d = draft as Record<string, unknown>;
  const nodes: FlowNode[] = Array.isArray(d.nodes) ? (d.nodes as FlowNode[]) : [];
  const edges: FlowEdge[] = Array.isArray(d.edges) ? (d.edges as FlowEdge[]) : [];
  const variables: FlowVariable[] = Array.isArray(d.variables) ? (d.variables as FlowVariable[]) : [];

  const designMode = !!(editing && onSelectionChange);
  const canEdit = designMode && !!onPatch;
  const selectedId = selection && selection.kind === 'node' ? selection.id : null;
  const selectNode = (n: FlowNode) => onSelectionChange?.({ kind: 'node', id: n.id, label: n.label || n.id });

  const handleAddNode = React.useCallback(() => {
    if (!canEdit) return;
    const existingIds = nodes.map((n) => n.id).filter(Boolean);
    const newNode: FlowNode = { id: uniqueId('node', existingIds), type: 'task', label: 'New node' };
    const next = appendArray(nodes, newNode);
    onPatch!({ nodes: next });
    onSelectionChange?.({ kind: 'node', id: newNode.id, label: newNode.label || newNode.id });
  }, [canEdit, nodes, onPatch, onSelectionChange]);

  const ordered = React.useMemo(() => orderNodes(nodes, edges), [nodes, edges]);
  const outgoingByNode = React.useMemo(() => {
    const map = new Map<string, FlowEdge[]>();
    for (const e of edges) {
      if (!map.has(e.source)) map.set(e.source, []);
      map.get(e.source)!.push(e);
    }
    return map;
  }, [edges]);
  const nodeById = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const flowType = String(d.type ?? 'autolaunched');
  const status = String(d.status ?? (d.active ? 'active' : 'draft'));
  const runAs = String(d.runAs ?? 'user');
  const version = d.version != null ? String(d.version) : undefined;
  const errorStrategy = (d.errorHandling as any)?.strategy as string | undefined;

  if (nodes.length === 0) {
    return (
      <PreviewShell hint={`flow${designMode ? ' · design' : ''}`}>
        {canEdit ? (
          <div className="p-3">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-dashed px-3 py-2 text-xs text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              onClick={handleAddNode}
            >
              <Plus className="h-3 w-3" />
              {tr('engine.inspector.add.node', locale)}
            </button>
          </div>
        ) : (
          <PreviewMessage>Add nodes in the Form tab to see the flow preview.</PreviewMessage>
        )}
      </PreviewShell>
    );
  }

  return (
    <PreviewShell hint={`flow · ${nodes.length} node${nodes.length === 1 ? '' : 's'}`}>
      <PreviewErrorBoundary fallbackHint="One of the flow nodes or edges is malformed.">
        <div className="grid lg:grid-cols-[1fr_240px] gap-0">
          {/* Steps */}
          <div className="p-3 space-y-3 min-w-0">
            <div className="rounded border bg-muted/30 px-3 py-2 text-xs flex flex-wrap items-center gap-x-4 gap-y-1">
              <Pill icon={Zap} label="Trigger" value={flowType} />
              <Pill icon={CircleDot} label="Status" value={status} tone={status === 'active' ? 'green' : status === 'draft' ? 'gray' : 'amber'} />
              <Pill icon={Settings2} label="Run as" value={runAs} />
              {version && <Pill label="v" value={version} />}
              {errorStrategy && <Pill icon={GitBranch} label="On error" value={errorStrategy} />}
            </div>

            <ol className="space-y-2">
              {ordered.map((node, idx) => {
                const Icon = nodeIcon(node.type);
                const tone = nodeTone(node.type);
                const outs = outgoingByNode.get(node.id) ?? [];
                const isBranch = node.type === 'decision' || node.type === 'branch' || node.type === 'gateway';
                return (
                  <li
                    key={node.id || idx}
                    className={`rounded border bg-background ${designMode ? 'cursor-pointer hover:border-primary/50' : ''} ${selectedId === node.id ? 'ring-2 ring-primary border-primary' : ''}`}
                    onClick={designMode ? (e) => { e.stopPropagation(); selectNode(node); } : undefined}
                  >
                    <div className="flex items-start gap-2 p-2.5">
                      <span className={cn('mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-mono', tone.chip)}>
                        {idx + 1}
                      </span>
                      <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', tone.icon)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-sm font-medium truncate">{node.label || node.id}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">{node.id}</span>
                          <span className={cn('text-[10px] uppercase tracking-wider font-medium', tone.icon)}>
                            {node.type}
                          </span>
                        </div>
                        {summarizeNodeConfig(node) && (
                          <div className="text-xs text-muted-foreground mt-0.5 font-mono break-all">
                            {summarizeNodeConfig(node)}
                          </div>
                        )}
                      </div>
                    </div>
                    {outs.length > 0 && (
                      <div className="border-t bg-muted/20 px-3 py-1.5 text-[11px] space-y-0.5">
                        {outs.map((e, i) => {
                          const cond = conditionText(e.condition);
                          const targetNode = nodeById.get(e.target);
                          const branchLabel = isBranch
                            ? e.isDefault
                              ? 'else'
                              : cond
                                ? `if ${cond}`
                                : e.label ?? 'branch'
                            : (e.label ?? (cond ? `when ${cond}` : 'next'));
                          return (
                            <div key={e.id || i} className="flex items-center gap-1.5">
                              <ArrowDown className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="font-mono text-muted-foreground">{branchLabel}</span>
                              <span className="text-muted-foreground">→</span>
                              <span className="font-medium truncate">
                                {targetNode?.label || e.target}
                              </span>
                              {!targetNode && (
                                <span className="ml-1 text-amber-600">(unresolved)</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
            {canEdit && (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded border border-dashed px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                onClick={handleAddNode}
              >
                <Plus className="h-3 w-3" />
                {tr('engine.inspector.add.node', locale)}
              </button>
            )}
          </div>

          {/* Variables side panel */}
          <div className="border-l bg-muted/20 p-3 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
              <Variable className="h-3 w-3" /> Variables
            </div>
            {variables.length === 0 ? (
              <div className="text-muted-foreground italic">No variables declared.</div>
            ) : (
              <ul className="space-y-1.5">
                {variables.map((v, i) => (
                  <li key={v.name || i} className="rounded border bg-background p-1.5">
                    <div className="flex items-baseline gap-1 flex-wrap">
                      <span className="font-mono">{v.name}</span>
                      {v.type && (
                        <span className="text-[10px] uppercase text-muted-foreground">
                          {v.type}
                        </span>
                      )}
                      {v.isInput && (
                        <span className="text-[9px] font-semibold uppercase px-1 rounded bg-sky-100 text-sky-700">
                          in
                        </span>
                      )}
                      {v.isOutput && (
                        <span className="text-[9px] font-semibold uppercase px-1 rounded bg-emerald-100 text-emerald-700">
                          out
                        </span>
                      )}
                    </div>
                    {v.defaultValue !== undefined && (
                      <div className="text-[10px] text-muted-foreground font-mono truncate">
                        = {String(v.defaultValue)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}

function summarizeNodeConfig(node: FlowNode): string | undefined {
  const c = node.config as Record<string, unknown> | undefined;
  if (!c) return undefined;

  // Node-type-specific summaries (matches packages/spec/src/automation/flow.zod.ts).
  switch (node.type) {
    case 'get_record':
    case 'get_records':
    case 'find_records':
      return fmt('object', c.objectName) + fmt(' · id', c.recordId) + fmt(' → ', c.outputVariable);
    case 'create_record':
    case 'create_records':
      return fmt('create', c.objectName) + fmtFields(c.fields) + fmt(' → ', c.outputVariable);
    case 'update_record':
    case 'update_records':
      return fmt('update', c.objectName) + fmt(' #', c.recordId) + fmtFields(c.fields);
    case 'delete_record':
    case 'delete_records':
      return fmt('delete', c.objectName) + fmt(' #', c.recordId);
    case 'decision':
    case 'branch':
    case 'gateway': {
      const conds = c.conditions;
      if (Array.isArray(conds)) {
        const lines = conds
          .slice(0, 3)
          .map((cc: any) => (cc.label ?? cc.expression ?? '?'))
          .map((s: any) => String(s));
        return lines.length ? lines.join(' | ') + (conds.length > 3 ? ' …' : '') : undefined;
      }
      return fmtExpr(c.expression);
    }
    case 'screen': {
      const fields = c.fields;
      if (Array.isArray(fields) && fields.length > 0) {
        const names = fields.slice(0, 4).map((f: any) => f.name ?? f.label ?? '?').join(', ');
        return `${fields.length} field(s): ${names}${fields.length > 4 ? ' …' : ''}`;
      }
      if (typeof c.message === 'string') return `"${c.message}"`;
      return undefined;
    }
    case 'assignment':
    case 'assign': {
      const assigns = c.assignments;
      if (Array.isArray(assigns)) {
        const lines = assigns
          .slice(0, 3)
          .map((a: any) => `${a.variable ?? a.target ?? '?'} = ${formatLit(a.value ?? a.expression)}`);
        return lines.join('; ') + (assigns.length > 3 ? ' …' : '');
      }
      return undefined;
    }
    case 'subflow':
    case 'flow':
      return fmt('flow', c.flowName ?? c.flowId);
    case 'action':
      return fmt('action', c.actionName ?? c.actionId);
    case 'wait':
    case 'timer':
      return fmt('wait', c.duration ?? c.delayMs ?? c.until);
    case 'loop':
    case 'for_each':
      return fmt('collection', c.collection) + fmt(' as ', c.itemVariable);
    case 'http_call':
      return `${String(c.method ?? 'POST').toUpperCase()} ${c.url ?? '?'}`;
    case 'send_email':
      return fmt('template', c.template ?? c.templateName) + fmt(' → ', formatRecipientsCfg(c.recipients ?? c.to));
    case 'invoke_agent':
    case 'agent':
      return fmt('agent', c.agentName ?? c.agentId);
    case 'end':
    case 'start':
      return undefined;
  }

  // Fallback: surface the most informative single-line bits.
  if (typeof c.objectName === 'string') return `object: ${c.objectName}`;
  if (typeof c.flowName === 'string') return `flow: ${c.flowName}`;
  if (typeof c.actionName === 'string') return `action: ${c.actionName}`;
  if (typeof c.eventType === 'string') return `event: ${c.eventType}`;
  if (typeof c.expression === 'string') return `expr: ${c.expression}`;
  // Last resort: show a JSON sketch (one line, truncated).
  try {
    const json = JSON.stringify(c);
    return json.length > 100 ? json.slice(0, 97) + '…' : json;
  } catch {
    return undefined;
  }
}

function fmt(prefix: string, v: unknown): string {
  if (v == null || v === '') return '';
  // If prefix already contains an arrow/separator, render as `${prefix}${value}`;
  // otherwise use the canonical `${prefix}: ${value}` form.
  if (/[→=]\s*$/.test(prefix)) return `${prefix}${String(v)}`;
  return `${prefix}: ${String(v)}`;
}

function fmtExpr(e: unknown): string | undefined {
  if (typeof e === 'string') return `if ${e}`;
  if (e && typeof e === 'object' && typeof (e as any).source === 'string') return `if ${(e as any).source}`;
  return undefined;
}

function fmtFields(f: unknown): string {
  if (!f || typeof f !== 'object') return '';
  const keys = Object.keys(f as Record<string, unknown>);
  if (keys.length === 0) return '';
  return ` {${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', …' : ''}}`;
}

function formatLit(v: unknown): string {
  if (v == null) return '∅';
  if (typeof v === 'string') return `"${v}"`;
  if (typeof v === 'object' && typeof (v as any).source === 'string') return (v as any).source;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function formatRecipientsCfg(r: unknown): string {
  if (Array.isArray(r)) return r.slice(0, 3).join(', ') + (r.length > 3 ? ', …' : '');
  if (typeof r === 'string') return r;
  return '';
}

function Pill({
  icon: Icon,
  label,
  value,
  tone = 'gray',
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: 'gray' | 'green' | 'amber';
}) {
  const cls =
    tone === 'green'
      ? 'text-emerald-700'
      : tone === 'amber'
        ? 'text-amber-700'
        : 'text-foreground';
  return (
    <span className="inline-flex items-center gap-1">
      {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
      <span className="text-muted-foreground">{label}:</span>
      <span className={`font-medium ${cls}`}>{value}</span>
    </span>
  );
}
