// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FlowRunsPanel — run history for a flow, fetched from the automation engine
 * (`GET /api/v1/automation/{name}/runs`, the observability surface next to
 * resume/screen). Renders each run's status / start time / duration with an
 * expandable step log (the `ExecutionLog.steps` ADR-0019/#1479 shape). Body
 * steps that ran inside a structured control-flow region — a `loop` iteration,
 * a `parallel` branch, or a `try`/`catch` handler — are nested under their
 * container node and grouped by iteration / branch (#1505), so authors can see
 * where a run paused or failed *and which iteration did it*, without leaving the
 * Studio.
 *
 * Degrades like the palette fetch: offline / plugin-absent / older backend →
 * a quiet "history unavailable" note, never an error state that blocks the
 * designer.
 */

import * as React from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Clock, Loader2, PauseCircle, RefreshCw, SkipForward } from 'lucide-react';
import { cn } from '@object-ui/components';
import { apiBase } from './useFlowNodePalette';

/** An error on a run/step. The engine sends the run-level `error` as a plain
 *  string (`ExecutionLog.error`) while a step-level error is a `{code,message}`
 *  object — the panel accepts either shape. */
type RunError = string | { code?: string; message?: string };

/** Step entry of a run log (spec `ExecutionStepLogSchema`, fields we render). */
interface RunStep {
  nodeId: string;
  nodeType?: string;
  status: 'success' | 'failure' | 'skipped' | string;
  durationMs?: number;
  error?: RunError;
  // #1505: structured-region grouping. A step that ran inside a `loop` /
  // `parallel` / `try_catch` body region is tagged by the engine with its
  // immediate container so the panel can nest it, instead of showing the
  // container as one opaque step. Absent on top-level (main-graph) steps.
  parentNodeId?: string;
  /** Zero-based loop iteration or parallel branch index of the enclosing region. */
  iteration?: number;
  /** Region kind the step ran in: `loop-body` | `parallel-branch` | `try` | `catch`. */
  regionKind?: string;
}

/** A step plus the region body steps that ran under it — the execution tree the
 *  panel renders. Reconstructed from the engine's flat, pre-order step log by
 *  {@link buildStepTree}. */
export interface StepTreeNode {
  step: RunStep;
  children: StepTreeNode[];
}

/** Run log entry (spec `ExecutionLogSchema`, fields we render). */
export interface FlowRun {
  id: string;
  status: 'completed' | 'failed' | 'paused' | 'running' | 'cancelled' | string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  trigger?: { type?: string; userId?: string; object?: string };
  steps?: RunStep[];
  error?: RunError;
}

/**
 * Normalize a run/step error to its human-readable message. The engine emits a
 * run-level `error` as a plain string but a step-level error as `{code,message}`
 * — reading `.message` off the string case silently dropped the run failure
 * reason (the whole point of the Runs panel for a failed run), so accept both.
 */
export function errorText(e: RunError | undefined | null): string | undefined {
  if (!e) return undefined;
  if (typeof e === 'string') return e || undefined;
  const m = e.message;
  return typeof m === 'string' && m ? m : undefined;
}

/**
 * Reconstruct the execution tree from the engine's flat, pre-order step log
 * (#1505). Each step carries its **immediate** structured-region container in
 * `parentNodeId`; the container's own step always precedes its body steps in the
 * array, and a whole region's steps are contiguous (the engine appends
 * `NodeExecutionResult.childSteps` in one shot). A stack walk therefore rebuilds
 * the nesting exactly, and it is robust to the two things that break naive
 * grouping: repeated `nodeId`s (a loop body node runs once per iteration) and
 * regions nested inside regions.
 *
 * Degrades safely: a step whose `parentNodeId` has no open ancestor — e.g. a
 * container step was dropped by durable-history truncation — is surfaced at the
 * top level rather than silently discarded.
 */
export function buildStepTree(steps: RunStep[]): StepTreeNode[] {
  const roots: StepTreeNode[] = [];
  const stack: StepTreeNode[] = [];
  for (const step of steps) {
    const node: StepTreeNode = { step, children: [] };
    if (step.parentNodeId == null) {
      stack.length = 0; // a top-level step closes every open region
      roots.push(node);
    } else {
      // Pop until the stack top is this step's container.
      while (stack.length > 0 && stack[stack.length - 1].step.nodeId !== step.parentNodeId) {
        stack.pop();
      }
      if (stack.length > 0) {
        stack[stack.length - 1].children.push(node);
      } else {
        roots.push(node); // container not found (truncated log) — don't lose the step
      }
    }
    stack.push(node); // every step may itself contain a nested region
  }
  return roots;
}

/**
 * Human label for a body step's enclosing region (#1505). `loop`/`parallel`
 * carry a zero-based `iteration` surfaced 1-based; `try`/`catch` carry only the
 * region kind. Returns `null` for a top-level step (no region grouping).
 */
export function regionLabel(step: RunStep): string | null {
  const { regionKind, iteration } = step;
  if (!regionKind) return null;
  switch (regionKind) {
    case 'loop-body':
      return iteration == null ? 'Iteration' : `Iteration ${iteration + 1}`;
    case 'parallel-branch':
      return iteration == null ? 'Branch' : `Branch ${iteration + 1}`;
    case 'try':
      return 'Try';
    case 'catch':
      return 'Catch';
    default:
      return iteration == null ? regionKind : `${regionKind} ${iteration + 1}`;
  }
}

/** Grouping key so consecutive body steps of the same iteration/branch/handler
 *  share one header. */
function regionSignature(step: RunStep): string {
  return `${step.regionKind ?? ''}#${step.iteration ?? ''}`;
}

/** Split a container's children into consecutive runs that share a region label
 *  (an iteration, a branch, a try/catch handler), so each gets one header. */
function groupChildren(children: StepTreeNode[]): { label: string | null; items: StepTreeNode[] }[] {
  const groups: { label: string | null; items: StepTreeNode[] }[] = [];
  let sig: string | undefined;
  for (const child of children) {
    const s = regionSignature(child.step);
    if (groups.length === 0 || s !== sig) {
      groups.push({ label: regionLabel(child.step), items: [child] });
      sig = s;
    } else {
      groups[groups.length - 1].items.push(child);
    }
  }
  return groups;
}

type LoadState = 'loading' | 'ready' | 'unavailable';

/** Fetch a flow's run history. Exposed for tests. */
export async function fetchFlowRuns(flowName: string, signal?: AbortSignal): Promise<FlowRun[] | null> {
  try {
    const res = await fetch(
      `${apiBase()}/automation/${encodeURIComponent(flowName)}/runs?limit=25`,
      { credentials: 'include', headers: { 'Content-Type': 'application/json' }, signal },
    );
    if (!res.ok) return null; // 404/501 — plugin absent or older backend
    const payload = (await res.json()) as { data?: { runs?: FlowRun[] }; runs?: FlowRun[] };
    const runs = payload?.data?.runs ?? payload?.runs;
    return Array.isArray(runs) ? runs : null;
  } catch {
    return null; // offline / aborted
  }
}

const STATUS_META: Record<string, { icon: React.ComponentType<{ className?: string }>; cls: string; label: string }> = {
  completed: { icon: CheckCircle2, cls: 'text-emerald-600 dark:text-emerald-400', label: 'Completed' },
  failed: { icon: AlertCircle, cls: 'text-rose-600 dark:text-rose-400', label: 'Failed' },
  paused: { icon: PauseCircle, cls: 'text-amber-600 dark:text-amber-400', label: 'Paused' },
  running: { icon: Loader2, cls: 'text-sky-600 dark:text-sky-400', label: 'Running' },
  cancelled: { icon: SkipForward, cls: 'text-muted-foreground', label: 'Cancelled' },
};

function statusMeta(status: string) {
  return STATUS_META[status] ?? { icon: Clock, cls: 'text-muted-foreground', label: status };
}

function fmtTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function fmtDuration(ms?: number): string | null {
  if (ms == null) return null;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

function StepRow({ step, depth = 0 }: { step: RunStep; depth?: number }) {
  const cls =
    step.status === 'success'
      ? 'text-emerald-600 dark:text-emerald-400'
      : step.status === 'failure'
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-muted-foreground';
  const stepErr = errorText(step.error);
  return (
    <li className="flex items-baseline gap-1.5 py-0.5" style={depth ? { paddingLeft: depth * 12 } : undefined}>
      <span className={cn('shrink-0 text-[9px] font-semibold uppercase', cls)}>{step.status}</span>
      <span className="truncate font-mono text-[10px]" title={step.nodeId}>{step.nodeId}</span>
      {step.nodeType && <span className="shrink-0 text-[9px] uppercase text-muted-foreground">{step.nodeType}</span>}
      {fmtDuration(step.durationMs) && (
        <span className="ml-auto shrink-0 text-[9px] text-muted-foreground">{fmtDuration(step.durationMs)}</span>
      )}
      {stepErr && (
        <span className="min-w-0 truncate text-[9px] text-rose-600" title={stepErr}>
          {stepErr}
        </span>
      )}
    </li>
  );
}

/** Header for a run of body steps in one iteration / branch / try-catch handler. */
function RegionHeader({ label, depth }: { label: string; depth: number }) {
  return (
    <li
      className="flex items-center gap-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/80"
      style={{ paddingLeft: depth * 12 }}
    >
      <span aria-hidden className="text-muted-foreground/50">
        ↳
      </span>
      {label}
    </li>
  );
}

/** Render a step and, nested beneath it, its structured-region body steps —
 *  grouped by iteration / branch / handler (#1505). Recurses for nested regions. */
function StepNode({ node, depth }: { node: StepTreeNode; depth: number }) {
  const groups = node.children.length > 0 ? groupChildren(node.children) : [];
  return (
    <>
      <StepRow step={node.step} depth={depth} />
      {groups.map((g, gi) => (
        <React.Fragment key={gi}>
          {g.label != null && <RegionHeader label={g.label} depth={depth + 1} />}
          {g.items.map((child, ci) => (
            <StepNode
              key={`${child.step.nodeId}#${ci}`}
              node={child}
              depth={g.label != null ? depth + 2 : depth + 1}
            />
          ))}
        </React.Fragment>
      ))}
    </>
  );
}

function RunRow({ run }: { run: FlowRun }) {
  const [open, setOpen] = React.useState(false);
  const meta = statusMeta(run.status);
  const Icon = meta.icon;
  const steps = Array.isArray(run.steps) ? run.steps : [];
  const runErr = errorText(run.error);
  return (
    <li className="rounded border bg-background">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 p-1.5 text-left"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <Icon className={cn('h-3.5 w-3.5 shrink-0', meta.cls, run.status === 'running' && 'animate-spin')} />
        <span className={cn('shrink-0 text-[10px] font-semibold', meta.cls)}>{meta.label}</span>
        <span className="min-w-0 truncate text-[10px] text-muted-foreground" title={run.id}>
          {fmtTime(run.startedAt)}
        </span>
        {fmtDuration(run.durationMs) && (
          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{fmtDuration(run.durationMs)}</span>
        )}
      </button>
      {open && (
        <div className="border-t px-2 py-1.5">
          <div className="pb-1 font-mono text-[9px] text-muted-foreground" title={run.id}>
            run {run.id}
            {run.trigger?.type && ` · trigger ${run.trigger.type}`}
          </div>
          {runErr && (
            <div className="pb-1 text-[10px] text-rose-600">{runErr}</div>
          )}
          {steps.length === 0 ? (
            <div className="text-[10px] italic text-muted-foreground">No step log recorded.</div>
          ) : (
            <ul>
              {buildStepTree(steps).map((node, i) => (
                <StepNode key={`${node.step.nodeId}#${i}`} node={node} depth={0} />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

export function FlowRunsPanel({ flowName }: { flowName: string }) {
  const [runs, setRuns] = React.useState<FlowRun[]>([]);
  const [state, setState] = React.useState<LoadState>('loading');
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setState('loading');
    (async () => {
      const result = await fetchFlowRuns(flowName, controller.signal);
      if (!alive) return;
      if (result === null) setState('unavailable');
      else {
        setRuns(result);
        setState('ready');
      }
    })();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [flowName, reloadKey]);

  return (
    <div className="flex h-full flex-col p-3 text-xs">
      <div className="flex items-center gap-1.5 pb-2 font-medium text-muted-foreground">
        <Clock className="h-3 w-3" /> Runs
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          title="Refresh run history"
          aria-label="Refresh run history"
          className="ml-auto rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <RefreshCw className={cn('h-3 w-3', state === 'loading' && 'animate-spin')} />
        </button>
      </div>
      {state === 'unavailable' ? (
        <div className="italic text-muted-foreground">
          Run history unavailable — the automation engine is offline or this flow hasn’t been published.
        </div>
      ) : state === 'ready' && runs.length === 0 ? (
        <div className="italic text-muted-foreground">No runs yet.</div>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
          {runs.map((r) => (
            <RunRow key={r.id} run={r} />
          ))}
        </ul>
      )}
    </div>
  );
}
