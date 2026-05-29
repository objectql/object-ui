// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * WorkflowPreview — read-only summary of a Workflow Rule metadata
 * draft (Salesforce-style declarative workflow: trigger + criteria +
 * immediate actions + time-dependent actions).
 *
 * Renders three sections side-by-side:
 *   1. Trigger envelope: object, trigger type, criteria CEL.
 *   2. Immediate actions: one row per action with type-specific summary.
 *   3. Time-dependent actions: scheduled offsets relative to trigger.
 *
 * Workflow schema isn't a state machine — it is a "when X then do Y"
 * rule. We render it as such instead of forcing a DAG metaphor onto it.
 */

import * as React from 'react';
import {
  AlarmClock,
  ArrowRight,
  Bell,
  Bot,
  Code2,
  Filter,
  Globe,
  ListChecks,
  Mail,
  Pencil,
  Plug,
  Plus,
  PlayCircle,
  Power,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import { cn } from '@object-ui/components';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewMessage, PreviewErrorBoundary } from './PreviewShell';
import { appendArray } from '../inspectors/_shared';
import { t as tr } from '../i18n';

interface WorkflowAction {
  type: string;
  [key: string]: unknown;
}

interface TimeTrigger {
  offset?: number;
  unit?: string;
  baseField?: string;
  baseEvent?: string;
  actions?: WorkflowAction[];
  [key: string]: unknown;
}

function actionIcon(type: string) {
  switch (type) {
    case 'field_update':
      return Pencil;
    case 'email_alert':
      return Mail;
    case 'http_call':
    case 'webhook':
      return Globe;
    case 'task_creation':
      return ListChecks;
    case 'push_notification':
      return Bell;
    case 'custom_script':
      return Code2;
    case 'connector_action':
      return Plug;
    default:
      return Bot;
  }
}

/**
 * Per-action-type color tone — mirrors the flow node-type tinting so
 * action kinds are scannable in the rule's action list. Full Tailwind
 * class strings (JIT) with light + dark variants.
 */
interface ActionTone {
  /** Icon color. */
  icon: string;
  /** Icon chip (border + bg). */
  chip: string;
}

const ACTION_TONE: Record<string, ActionTone> = {
  field_update: {
    icon: 'text-blue-600 dark:text-blue-400',
    chip: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40',
  },
  email_alert: {
    icon: 'text-violet-600 dark:text-violet-400',
    chip: 'border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/40',
  },
  http_call: {
    icon: 'text-indigo-600 dark:text-indigo-400',
    chip: 'border-indigo-200 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/40',
  },
  task_creation: {
    icon: 'text-emerald-600 dark:text-emerald-400',
    chip: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40',
  },
  push_notification: {
    icon: 'text-amber-600 dark:text-amber-400',
    chip: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40',
  },
  custom_script: {
    icon: 'text-teal-600 dark:text-teal-400',
    chip: 'border-teal-200 bg-teal-50 dark:border-teal-900 dark:bg-teal-950/40',
  },
  connector_action: {
    icon: 'text-rose-600 dark:text-rose-400',
    chip: 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40',
  },
  default: {
    icon: 'text-slate-500 dark:text-slate-400',
    chip: 'border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900/60',
  },
};

function actionTone(type: string): ActionTone {
  switch (type) {
    case 'field_update':
      return ACTION_TONE.field_update;
    case 'email_alert':
      return ACTION_TONE.email_alert;
    case 'http_call':
    case 'webhook':
      return ACTION_TONE.http_call;
    case 'task_creation':
      return ACTION_TONE.task_creation;
    case 'push_notification':
      return ACTION_TONE.push_notification;
    case 'custom_script':
      return ACTION_TONE.custom_script;
    case 'connector_action':
      return ACTION_TONE.connector_action;
    default:
      return ACTION_TONE.default;
  }
}

function summarizeAction(a: WorkflowAction): string | undefined {
  switch (a.type) {
    case 'field_update':
      // Canonical: { field, value }. Legacy: { objectName, fieldName, value }.
      return `${a.field ?? (a.objectName ? `${a.objectName}.${a.fieldName ?? '?'}` : '?')} = ${formatLiteral(a.value)}`;
    case 'email_alert':
      // Canonical: { template, recipients[] }. Legacy: { templateName, to }.
      return `template: ${a.template ?? a.templateName ?? '?'} → ${formatRecipients(a)}`;
    case 'http_call':
    case 'webhook':
      return `${String(a.method ?? 'POST').toUpperCase()} ${a.url ?? a.endpoint ?? '?'}`;
    case 'task_creation':
      // Canonical: { taskObject, subject, assignedTo?, dueDate? }.
      return `create ${a.taskObject ?? '?'}${a.assignedTo ? ` → ${a.assignedTo}` : ''}${a.subject ? `: "${a.subject}"` : ''}`;
    case 'push_notification':
      return a.title ? `"${a.title}"` : undefined;
    case 'custom_script':
      // Canonical: { language, code }.
      return a.language ? `${a.language}${typeof a.code === 'string' ? ` (${(a.code as string).length} chars)` : ''}` : (a.scriptName as string ?? a.functionName as string ?? undefined);
    case 'connector_action':
      return `${a.connectorId ?? '?'}.${a.actionId ?? '?'}`;
    default:
      return undefined;
  }
}

function formatLiteral(v: unknown): string {
  if (v == null) return '∅';
  if (typeof v === 'string') return `"${v}"`;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function formatRecipients(a: WorkflowAction): string {
  const r = (a.recipients ?? a.to) as unknown;
  if (Array.isArray(r)) return r.slice(0, 3).join(', ') + (r.length > 3 ? ', …' : '');
  if (typeof r === 'string') return r;
  return '—';
}

export function WorkflowPreview({ draft, editing, selection, onSelectionChange, onPatch, locale }: MetadataPreviewProps) {
  const d = draft as Record<string, unknown>;
  const objectName = String(d.objectName ?? d.object ?? '');
  const triggerType = String(d.triggerType ?? d.trigger ?? '—');
  const criteria = d.criteria as { source?: string } | string | undefined;
  const criteriaText =
    typeof criteria === 'string'
      ? criteria
      : (criteria && typeof criteria === 'object' && typeof (criteria as any).source === 'string')
        ? (criteria as any).source
        : undefined;

  const actions: WorkflowAction[] = Array.isArray(d.actions) ? (d.actions as WorkflowAction[]) : [];
  const timeTriggers: TimeTrigger[] = Array.isArray(d.timeTriggers) ? (d.timeTriggers as TimeTrigger[]) : [];
  const active = d.active !== false;
  const order = d.executionOrder as number | undefined;

  const designMode = !!(editing && onSelectionChange);
  const canEdit = designMode && !!onPatch;
  const selectedId = selection && selection.kind === 'action' ? selection.id : null;
  const selectAction = (a: WorkflowAction, id: string) => onSelectionChange?.({ kind: 'action', id, label: (a as any).name || a.type || id });

  const handleAddAction = React.useCallback(() => {
    if (!canEdit) return;
    const newAction: WorkflowAction = { type: 'field_update', name: '' };
    const next = appendArray(actions, newAction);
    onPatch!({ actions: next });
    const id = `actions[${next.length - 1}]`;
    onSelectionChange?.({ kind: 'action', id, label: newAction.type });
  }, [canEdit, actions, onPatch, onSelectionChange]);

  if (!objectName && actions.length === 0 && timeTriggers.length === 0) {
    return (
      <PreviewShell hint={`workflow${designMode ? ' · design' : ''}`}>
        {canEdit ? (
          <div className="p-3">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-dashed px-3 py-2 text-xs text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              onClick={handleAddAction}
            >
              <Plus className="h-3 w-3" />
              {tr('engine.inspector.add.action', locale)}
            </button>
          </div>
        ) : (
          <PreviewMessage>Set the target object and at least one action to see the workflow preview.</PreviewMessage>
        )}
      </PreviewShell>
    );
  }

  return (
    <PreviewShell hint={`workflow · ${actions.length + timeTriggers.reduce((a, t) => a + (t.actions?.length ?? 0), 0)} action(s)`}>
      <PreviewErrorBoundary>
        <div className="p-3 space-y-3">
          {/* Trigger envelope */}
          <div className="rounded border bg-muted/30 p-3 text-xs space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <Pill icon={WorkflowIcon} label="Object" value={objectName || '—'} mono />
              <Pill icon={PlayCircle} label="When" value={triggerType} />
              <Pill icon={Power} label="Active" value={active ? 'yes' : 'no'} tone={active ? 'green' : 'amber'} />
              {order != null && <Pill label="Order" value={String(order)} />}
            </div>
            <div className="flex items-start gap-1.5">
              <Filter className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Criteria:</span>
              <code className="font-mono text-foreground break-all">
                {criteriaText || <span className="italic text-muted-foreground">always</span>}
              </code>
            </div>
          </div>

          {/* Immediate actions */}
          <Section title="Immediate Actions" count={actions.length}>
            {actions.length === 0 ? (
              <Empty>No immediate actions.</Empty>
            ) : (
              <ul className="divide-y rounded border bg-background">
                {actions.map((a, i) => {
                  const id = `actions[${i}]`;
                  return <ActionRow key={i} action={a} onClick={designMode ? () => selectAction(a, id) : undefined} selected={selectedId === id} />;
                })}
              </ul>
            )}
            {canEdit && (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded border border-dashed px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                onClick={handleAddAction}
              >
                <Plus className="h-3 w-3" />
                {tr('engine.inspector.add.action', locale)}
              </button>
            )}
          </Section>

          {/* Time-dependent actions */}
          {timeTriggers.length > 0 && (
            <Section title="Time-Dependent Actions" count={timeTriggers.length}>
              <ul className="space-y-2">
                {timeTriggers.map((t, i) => {
                  const offset = t.offset ?? 0;
                  const unit = t.unit ?? 'hours';
                  const base = t.baseField ?? t.baseEvent ?? 'trigger';
                  const sign = offset >= 0 ? '+' : '';
                  return (
                    <li key={i} className="rounded border bg-background">
                      <div className="flex items-center gap-2 px-3 py-2 text-xs border-b bg-muted/20">
                        <AlarmClock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-mono">
                          {sign}{offset} {unit}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">after</span>
                        <code className="font-mono">{base}</code>
                      </div>
                      {Array.isArray(t.actions) && t.actions.length > 0 ? (
                        <ul className="divide-y">
                          {t.actions.map((a, j) => {
                            const id = `timeTriggers[${i}].actions[${j}]`;
                            return <ActionRow key={j} action={a as WorkflowAction} onClick={designMode ? () => selectAction(a as WorkflowAction, id) : undefined} selected={selectedId === id} />;
                          })}
                        </ul>
                      ) : (
                        <Empty>No actions scheduled at this offset.</Empty>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}

function ActionRow({ action, onClick, selected }: { action: WorkflowAction; onClick?: () => void; selected?: boolean }) {
  const Icon = actionIcon(action.type);
  const tone = actionTone(action.type);
  const summary = summarizeAction(action);
  const aName = (action as any).name as string | undefined;
  return (
    <li
      className={`flex items-start gap-2 px-3 py-2 text-xs ${onClick ? 'cursor-pointer hover:bg-accent/40' : ''} ${selected ? 'bg-primary/5 ring-1 ring-primary' : ''}`}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
    >
      <span className={cn('mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border', tone.chip)}>
        <Icon className={cn('h-3 w-3', tone.icon)} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-medium">{prettyActionType(action.type)}</span>
          {aName && <code className="font-mono text-[10px] text-foreground">{aName}</code>}
          <span className="font-mono text-[10px] text-muted-foreground">{action.type}</span>
        </div>
        {summary && <div className="text-muted-foreground font-mono break-all">{summary}</div>}
      </div>
    </li>
  );
}

function prettyActionType(t: string): string {
  return t
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
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

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-muted-foreground italic px-2 py-1.5">{children}</div>;
}

function Pill({
  icon: Icon,
  label,
  value,
  tone = 'gray',
  mono = false,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: 'gray' | 'green' | 'amber';
  mono?: boolean;
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
      <span className={`font-medium ${cls} ${mono ? 'font-mono' : ''}`}>{value}</span>
    </span>
  );
}
