// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ApprovalPreview — read-only summary of an Approval Process draft.
 *
 * Renders the lifecycle the way operators reason about it:
 *
 *   1. Envelope: target object, lock-record toggle, status field,
 *      entry criteria (CEL), escalation summary.
 *   2. Global hooks strip — onSubmit / onFinalApprove / onFinalReject
 *      / onRecall — collapsed to action-count chips so the eye can
 *      jump straight to the chain.
 *   3. Vertical chain of steps. Each step shows:
 *        • Numbered marker.
 *        • Label + machine name + behavior pill.
 *        • Approvers (typed chips: user/role/field/manager/…).
 *        • Entry criteria CEL.
 *        • Approve / Reject action counts with expandable rows.
 *        • Rejection behavior (back-to-previous vs reject-process).
 *
 * Steps render top-down with arrows between to mirror the way the
 * runtime actually walks them. Escalation gets its own callout
 * because it cuts across all pending steps.
 */

import * as React from 'react';
import {
  AlarmClock,
  ArrowDown,
  CheckCircle2,
  CircleAlert,
  Filter,
  Lock,
  PlayCircle,
  Plus,
  Power,
  RotateCcw,
  ShieldAlert,
  Undo2,
  UserCog,
  Users,
  XCircle,
} from 'lucide-react';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewMessage, PreviewErrorBoundary } from './PreviewShell';
import { uniqueId, appendArray } from '../inspectors/_shared';
import { t as tr } from '../i18n';

interface Approver {
  type?: string;
  value?: string;
}

interface ApprovalAction {
  type?: string;
  name?: string;
  config?: Record<string, unknown>;
}

interface ApprovalStep {
  name?: string;
  label?: string;
  description?: string;
  entryCriteria?: string | { source?: string };
  approvers?: Approver[];
  behavior?: string;
  rejectionBehavior?: string;
  onApprove?: ApprovalAction[];
  onReject?: ApprovalAction[];
}

interface Escalation {
  enabled?: boolean;
  timeoutHours?: number;
  action?: string;
  escalateTo?: string;
  notifySubmitter?: boolean;
}

function celText(c: unknown): string | undefined {
  if (!c) return undefined;
  if (typeof c === 'string') return c;
  if (typeof c === 'object' && typeof (c as any).source === 'string') return (c as any).source;
  return undefined;
}

export function ApprovalPreview({ draft, editing, selection, onSelectionChange, onPatch, locale }: MetadataPreviewProps) {
  const d = draft as Record<string, unknown>;
  const object = String(d.object ?? '');
  const active = !!d.active;
  const lockRecord = d.lockRecord !== false;
  const statusField = (d.approvalStatusField as string | undefined) || undefined;
  const entryCriteria = celText(d.entryCriteria);
  const steps: ApprovalStep[] = Array.isArray(d.steps) ? (d.steps as ApprovalStep[]) : [];
  const escalation = d.escalation as Escalation | undefined;
  const globalHooks = {
    onSubmit: Array.isArray(d.onSubmit) ? (d.onSubmit as ApprovalAction[]) : [],
    onFinalApprove: Array.isArray(d.onFinalApprove) ? (d.onFinalApprove as ApprovalAction[]) : [],
    onFinalReject: Array.isArray(d.onFinalReject) ? (d.onFinalReject as ApprovalAction[]) : [],
    onRecall: Array.isArray(d.onRecall) ? (d.onRecall as ApprovalAction[]) : [],
  };

  const designMode = !!(editing && onSelectionChange);
  const canEdit = designMode && !!onPatch;
  const selectedId = selection && selection.kind === 'step' ? selection.id : null;
  const selectStep = (s: ApprovalStep, i: number) => {
    const id = s.name || `steps[${i}]`;
    onSelectionChange?.({ kind: 'step', id, label: s.label || s.name || `Step ${i + 1}` });
  };

  const handleAddStep = React.useCallback(() => {
    if (!canEdit) return;
    const existingNames = steps.map((s) => s.name).filter(Boolean) as string[];
    const name = uniqueId('step', existingNames);
    const newStep: ApprovalStep = { name, label: 'New step', approvers: [] };
    const next = appendArray(steps, newStep);
    onPatch!({ steps: next });
    onSelectionChange?.({ kind: 'step', id: name, label: newStep.label || name });
  }, [canEdit, steps, onPatch, onSelectionChange]);

  if (steps.length === 0 && !object) {
    return (
      <PreviewShell hint={`approval${designMode ? ' · design' : ''}`}>
        {canEdit ? (
          <div className="p-3">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-dashed px-3 py-2 text-xs text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              onClick={handleAddStep}
            >
              <Plus className="h-3 w-3" />
              {tr('engine.inspector.add.step', locale)}
            </button>
          </div>
        ) : (
          <PreviewMessage>Set the target object and at least one step to see the approval chain.</PreviewMessage>
        )}
      </PreviewShell>
    );
  }

  return (
    <PreviewShell hint={`approval · ${steps.length} step${steps.length === 1 ? '' : 's'}`}>
      <PreviewErrorBoundary>
        <div className="p-3 space-y-3">
          {/* Envelope */}
          <div className="rounded border bg-muted/30 p-3 space-y-1.5 text-xs">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Pill icon={Power} label={active ? 'Active' : 'Inactive'} tone={active ? 'green' : 'gray'} />
              <Pill icon={ShieldAlert} label={`object: ${object || '—'}`} mono />
              <Pill icon={Lock} label={lockRecord ? 'lock during approval' : 'unlocked'} tone={lockRecord ? 'amber' : 'gray'} />
              {statusField && <Pill label={`status field: ${statusField}`} mono />}
            </div>
            {entryCriteria && (
              <div className="flex items-start gap-1.5">
                <Filter className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Entry:</span>
                <code className="font-mono break-all">{entryCriteria}</code>
              </div>
            )}
          </div>

          {/* Escalation callout */}
          {escalation?.enabled && (
            <div className="rounded border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 p-2.5 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-amber-900 dark:text-amber-200">
                <AlarmClock className="h-3.5 w-3.5" /> SLA escalation enabled
              </div>
              <div className="mt-1 text-amber-900 dark:text-amber-200">
                After <code className="font-mono">{escalation.timeoutHours}h</code> on a pending step →{' '}
                <span className="font-medium">{escalation.action ?? 'notify'}</span>
                {escalation.escalateTo && <> → <code className="font-mono">{escalation.escalateTo}</code></>}
                {escalation.notifySubmitter && <span className="ml-1 opacity-80">(notify submitter)</span>}
              </div>
            </div>
          )}

          {/* Steps chain */}
          {steps.length === 0 ? (
            <PreviewMessage>No steps defined yet.</PreviewMessage>
          ) : (
            <ol className="space-y-2">
              {steps.map((step, i) => (
                <React.Fragment key={step.name || i}>
                  <StepRow
                    step={step}
                    index={i}
                    onClick={designMode ? () => selectStep(step, i) : undefined}
                    selected={selectedId != null && (step.name === selectedId || `steps[${i}]` === selectedId)}
                  />
                  {i < steps.length - 1 && (
                    <li className="flex justify-center" aria-hidden>
                      <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </li>
                  )}
                </React.Fragment>
              ))}
            </ol>
          )}
          {canEdit && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-dashed px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              onClick={handleAddStep}
            >
              <Plus className="h-3 w-3" />
              {tr('engine.inspector.add.step', locale)}
            </button>
          )}

          {/* Global hooks */}
          <div className="rounded border bg-muted/20 p-2.5 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-muted-foreground uppercase tracking-wider text-[10px] mb-1">
              Global Hooks
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <Hook icon={PlayCircle} label="onSubmit" actions={globalHooks.onSubmit} />
              <Hook icon={CheckCircle2} label="onFinalApprove" actions={globalHooks.onFinalApprove} tone="green" />
              <Hook icon={XCircle} label="onFinalReject" actions={globalHooks.onFinalReject} tone="red" />
              <Hook icon={Undo2} label="onRecall" actions={globalHooks.onRecall} />
            </div>
          </div>
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}

function StepRow({ step, index, onClick, selected }: { step: ApprovalStep; index: number; onClick?: () => void; selected?: boolean }) {
  const approvers = step.approvers ?? [];
  const entry = celText(step.entryCriteria);
  return (
    <li
      className={`rounded border bg-background ${onClick ? 'cursor-pointer hover:border-primary/50' : ''} ${selected ? 'ring-2 ring-primary border-primary' : ''}`}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
    >
      <div className="flex items-start gap-2 p-2.5">
        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-mono">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-medium truncate">{step.label || step.name || `Step ${index + 1}`}</span>
            {step.name && <span className="font-mono text-[10px] text-muted-foreground">{step.name}</span>}
            {step.behavior && (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {step.behavior === 'unanimous' ? 'all must approve' : 'first response wins'}
              </span>
            )}
          </div>
          {step.description && (
            <div className="text-xs text-muted-foreground">{step.description}</div>
          )}
          {entry && (
            <div className="flex items-start gap-1.5 text-xs">
              <Filter className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">When:</span>
              <code className="font-mono break-all">{entry}</code>
            </div>
          )}
          <div className="flex items-start gap-1.5 text-xs">
            <Users className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground shrink-0">Approvers:</span>
            {approvers.length === 0 ? (
              <span className="text-amber-700 dark:text-amber-400">none</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {approvers.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded border bg-muted/40 px-1.5 py-0.5 text-[11px]">
                    <UserCog className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono">{a.value || '?'}</span>
                    {a.type && <span className="text-[9px] uppercase text-muted-foreground">{a.type}</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Step hooks */}
      {((step.onApprove?.length ?? 0) > 0 || (step.onReject?.length ?? 0) > 0 || step.rejectionBehavior) && (
        <div className="border-t bg-muted/20 px-3 py-1.5 text-[11px] space-y-0.5">
          {step.onApprove && step.onApprove.length > 0 && (
            <ActionLine icon={CheckCircle2} tone="green" label="on approve" actions={step.onApprove} />
          )}
          {step.onReject && step.onReject.length > 0 && (
            <ActionLine icon={XCircle} tone="red" label="on reject" actions={step.onReject} />
          )}
          {step.rejectionBehavior && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              {step.rejectionBehavior === 'back_to_previous' ? (
                <RotateCcw className="h-3 w-3" />
              ) : (
                <CircleAlert className="h-3 w-3" />
              )}
              <span>
                Rejection: <code className="font-mono text-foreground">{step.rejectionBehavior}</code>
              </span>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function ActionLine({
  icon: Icon,
  tone,
  label,
  actions,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: 'green' | 'red';
  label: string;
  actions: ApprovalAction[];
}) {
  const cls = tone === 'green' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400';
  return (
    <div className="flex items-start gap-1.5">
      <Icon className={`h-3 w-3 mt-0.5 ${cls}`} />
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <div className="flex flex-wrap gap-1">
        {actions.map((a, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]">
            {a.type ?? 'action'}
            {a.name && <span className="opacity-70">· {a.name}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

function Hook({
  icon: Icon,
  label,
  actions,
  tone = 'gray',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  actions: ApprovalAction[];
  tone?: 'gray' | 'green' | 'red';
}) {
  const cls =
    tone === 'green'
      ? 'text-emerald-700 dark:text-emerald-400'
      : tone === 'red'
        ? 'text-red-700 dark:text-red-400'
        : 'text-muted-foreground';
  return (
    <span className={`inline-flex items-center gap-1 ${cls}`}>
      <Icon className="h-3 w-3" />
      <span className="font-mono">{label}</span>
      <span className="rounded bg-muted px-1 text-[10px]">{actions.length}</span>
    </span>
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
    tone === 'green' ? 'text-emerald-700 dark:text-emerald-400' : tone === 'amber' ? 'text-amber-700 dark:text-amber-400' : 'text-foreground';
  return (
    <span className="inline-flex items-center gap-1">
      {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
      <span className={`${cls} ${mono ? 'font-mono' : ''}`}>{label}</span>
    </span>
  );
}
