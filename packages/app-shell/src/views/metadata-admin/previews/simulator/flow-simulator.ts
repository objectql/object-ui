// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FlowSimulator — a deterministic, backend-free interpreter that walks a flow
 * draft for designer-time debugging. See `flow-sim-types.ts` for the contract.
 *
 * Supported faithfully: start, decision (edge-first CEL routing), the CRUD /
 * get / http / connector / script(notification|code) side-effects (MOCKED), and
 * end. `wait`, `screen`, and `approval` PAUSE for manual continuation (an approval
 * resumes down the chosen decision's branch — approve / reject / revise). `loop` resolves its
 * collection and exposes the iterator but is a labelled single pass (the edge
 * model has no separate body/exit edge). `parallel_gateway` fans out WITHOUT
 * join synchronization; the ADR-0031 structured containers (`parallel`,
 * `try_catch` — nested body regions), `join_gateway`, `subflow` and
 * `boundary_event` are marked unsupported rather than faked. A hard step
 * ceiling guards cycles.
 */

import type {
  MockResults,
  SimEdge,
  SimEdgeEval,
  SimNode,
  SimState,
  SimStep,
  SimStepStatus,
} from './flow-sim-types';
import { evalCondition, validateFlowDraft } from './flow-sim-validate';

const MAX_STEPS = 500;

const PASS_THROUGH = new Set(['start']);
const MOCKED_SIDE_EFFECT = new Set([
  'create_record',
  'update_record',
  'delete_record',
  'get_record',
  'http_request',
  'connector_action',
]);
// `parallel` / `try_catch` carry nested body regions (ADR-0031) the flat
// stepper can't walk — pass through honestly instead of faking their semantics.
const UNSUPPORTED = new Set(['join_gateway', 'subflow', 'boundary_event', 'parallel', 'try_catch']);

const edgeId = (e: SimEdge, i: number): string => e.id || `${e.source}->${e.target}#${i}`;
const condStr = (c: SimEdge['condition']): string | undefined => (typeof c === 'string' ? c : undefined);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

export class FlowSimulator {
  private nodes = new Map<string, SimNode>();
  private edges: SimEdge[] = [];
  private mocks: MockResults = {};
  private seq = 0;

  state: SimState = {
    status: 'idle',
    variables: {},
    steps: [],
    frontier: [],
    activeNodeId: null,
    visitedNodeIds: [],
    traversedEdgeIds: [],
  };

  constructor(nodes: SimNode[], edges: SimEdge[]) {
    for (const n of nodes) this.nodes.set(n.id, n);
    this.edges = edges;
  }

  /** Validate + seed variables and queue the entry node. Returns the validation. */
  reset(seedVariables: Record<string, unknown> = {}, mocks: MockResults = {}) {
    const validation = validateFlowDraft([...this.nodes.values()], this.edges);
    this.mocks = mocks;
    this.seq = 0;
    this.state = {
      status: validation.errors.length ? 'error' : 'idle',
      variables: { ...seedVariables },
      steps: [],
      frontier: validation.startNodeId ? [validation.startNodeId] : [],
      activeNodeId: null,
      visitedNodeIds: [],
      traversedEdgeIds: [],
      error: validation.errors.length ? validation.errors[0].message : undefined,
    };
    return validation;
  }

  get done(): boolean {
    return this.state.status === 'done' || this.state.status === 'error';
  }

  /** Execute one queued node. Returns the recorded step, or null when idle. */
  step(): SimStep | null {
    const s = this.state;
    if (s.status === 'error' || s.status === 'done' || s.status === 'paused') return null;
    if (this.seq >= MAX_STEPS) {
      s.status = 'error';
      s.error = `Step limit (${MAX_STEPS}) exceeded — the flow may contain an infinite loop.`;
      return null;
    }
    const nodeId = s.frontier.shift();
    if (!nodeId) {
      s.status = 'done';
      s.activeNodeId = null;
      return null;
    }
    const node = this.nodes.get(nodeId);
    if (!node) {
      return this.record(nodeId, 'unknown', nodeId, 'error', { error: `Node "${nodeId}" not found.` });
    }
    s.status = 'running';
    s.activeNodeId = nodeId;
    if (!s.visitedNodeIds.includes(nodeId)) s.visitedNodeIds.push(nodeId);

    const step = this.execute(node);
    // Settle the run status. A pause halts the queue until resume(); a decision
    // dead-end / missing node already set 'error' inside execute(). Only a still
    // -'running' branch that drained the frontier completes as 'done'.
    if (s.status === 'running' && s.frontier.length === 0) {
      s.status = 'done';
      s.activeNodeId = null;
    }
    return step;
  }

  /** Run to completion (or until a pause / error). */
  runToEnd(): SimState {
    let guard = 0;
    while (this.state.status !== 'done' && this.state.status !== 'error' && this.state.status !== 'paused') {
      if (++guard > MAX_STEPS + 5) break;
      this.step();
    }
    return this.state;
  }

  /**
   * Continue a flow paused on a `wait`, `screen`, or `approval` node.
   *  - `screenOutputs` — inputs captured from a paused screen.
   *  - `decision` — the branch an approval resumes down (ADR-0019/0044:
   *    `approve` / `reject` / `revise`). The run takes ONLY the out-edge whose
   *    label matches, mirroring how the engine resumes a suspended approval by
   *    branch label — instead of fanning out to every out-edge.
   */
  resume(opts: { screenOutputs?: Record<string, unknown>; decision?: string } = {}) {
    const s = this.state;
    if (s.status !== 'paused' || !s.activeNodeId) return;
    const node = this.nodes.get(s.activeNodeId);
    if (opts.screenOutputs && node?.type === 'screen') {
      Object.assign(s.variables, opts.screenOutputs);
    }
    s.pausedReason = undefined;
    s.status = 'running';
    if (node?.type === 'approval') this.resumeApproval(node, opts.decision);
    else if (node) this.enqueueSuccessors(node);
    if (s.frontier.length === 0) {
      s.status = 'done';
      s.activeNodeId = null;
    }
  }

  /**
   * Resume a suspended approval down the chosen decision's out-edge: the one
   * whose `label` equals `decision` (case-insensitive — `approve` / `reject` /
   * `revise`). With no match (or no decision) it falls back to fanning out —
   * mirroring the engine's unmatched-`branchLabel` fallback — and logs that so
   * the author notices the unrouted decision.
   */
  private resumeApproval(node: SimNode, decision?: string) {
    const out = this.edges.map((e, i) => ({ e, i })).filter((x) => x.e.source === node.id);
    const want = (decision ?? '').trim().toLowerCase();
    const chosen = want ? out.find((x) => (x.e.label ?? '').trim().toLowerCase() === want) : undefined;
    if (chosen) {
      this.traverse(chosen.e, chosen.i);
      this.record(node.id, 'approval', node.label, 'ok', { note: `Decision: ${decision} → ${chosen.e.target}` });
    } else {
      for (const x of out) this.traverse(x.e, x.i);
      this.record(node.id, 'approval', node.label, 'ok', {
        note: want
          ? `No out-edge labelled "${decision}"; took all branches (engine label-fallback).`
          : 'No decision supplied; took all branches.',
      });
    }
  }

  // ---- node execution -----------------------------------------------------

  private execute(node: SimNode): SimStep {
    const type = node.type;

    if (type === 'end') {
      // Terminate this branch only; other queued branches still run.
      return this.record(node.id, type, node.label, 'ok', { note: 'Flow end reached.' });
    }

    if (type === 'decision') return this.executeDecision(node);

    if (type === 'assignment') return this.executeAssignment(node);

    if (UNSUPPORTED.has(type)) {
      this.enqueueSuccessors(node);
      return this.record(node.id, type, node.label, 'skipped', {
        note: `"${type}" is not modelled by the simulator; passing through without its real semantics.`,
      });
    }

    if (type === 'parallel_gateway') {
      this.enqueueSuccessors(node);
      return this.record(node.id, type, node.label, 'ok', {
        note: 'Parallel split — branches fan out (no join synchronization is simulated).',
      });
    }

    if (type === 'approval') {
      // ADR-0019: an approval node opens a request and SUSPENDS the run until a
      // decision is recorded. Model that as a pause; the author resumes down the
      // chosen approve / reject / revise out-edge (see resumeApproval) rather
      // than fanning out to every out-edge at once.
      this.state.status = 'paused';
      this.state.pausedReason = 'approval';
      return this.record(node.id, type, node.label, 'paused', { note: 'Approval reached — choose a decision to continue.' });
    }

    if (type === 'wait') {
      this.state.status = 'paused';
      this.state.pausedReason = 'wait';
      return this.record(node.id, type, node.label, 'paused', { note: 'Wait reached — continue manually.' });
    }

    if (type === 'screen') {
      // Mirror the engine's `shouldPause`: a screen suspends only when it
      // collects input (`fields`) or explicitly opts in (`waitForInput`).
      // A field-less / `waitForInput:false` screen is a server pass-through.
      const fields = Array.isArray(node.config?.fields) ? (node.config!.fields as unknown[]) : [];
      const waitForInput = node.config?.waitForInput;
      const shouldPause = waitForInput === true || (fields.length > 0 && waitForInput !== false);
      if (shouldPause) {
        this.state.status = 'paused';
        this.state.pausedReason = 'screen';
        return this.record(node.id, type, node.label, 'paused', { note: 'Screen reached — provide inputs, then continue.' });
      }
      this.enqueueSuccessors(node);
      return this.record(node.id, type, node.label, 'ok', { note: 'Screen has no input — passed through (matches runtime).' });
    }

    if (type === 'loop') {
      const step = this.executeLoop(node);
      this.enqueueSuccessors(node);
      return step;
    }

    if (MOCKED_SIDE_EFFECT.has(type) || type === 'script') {
      const wrote = this.applyMock(node);
      this.enqueueSuccessors(node);
      return this.record(node.id, type, node.label, 'mocked', {
        wrote,
        note: this.mockNote(node),
      });
    }

    // start / assignment / anything else: pass straight through.
    this.enqueueSuccessors(node);
    return this.record(node.id, type, node.label, 'ok', {
      note: PASS_THROUGH.has(type) ? undefined : `Type "${type}" treated as pass-through.`,
    });
  }

  private executeDecision(node: SimNode): SimStep {
    const out = this.edges
      .map((e, i) => ({ e, i }))
      .filter((x) => x.e.source === node.id);
    const evals: SimEdgeEval[] = [];
    let chosen: { e: SimEdge; i: number } | undefined;
    let firstError: string | undefined;

    // Evaluate conditional edges in declared order; first truthy wins.
    for (const { e, i } of out) {
      if (e.isDefault) continue;
      const cond = condStr(e.condition);
      if (!cond) {
        evals.push({ edgeId: edgeId(e, i), target: e.target, result: false, selected: false, error: 'Branch has no condition.' });
        continue;
      }
      const r = evalCondition(cond, this.state.variables);
      if (r.error && !firstError) firstError = `${cond}: ${r.error}`;
      const selected = r.result && !chosen;
      if (selected) chosen = { e, i };
      evals.push({ edgeId: edgeId(e, i), target: e.target, condition: cond, result: r.result, error: r.error, selected });
    }

    // Fall back to the default branch when no condition matched.
    if (!chosen) {
      const def = out.find((x) => x.e.isDefault);
      if (def) {
        chosen = def;
        evals.push({ edgeId: edgeId(def.e, def.i), target: def.e.target, isDefault: true, result: true, selected: true });
      }
    }

    const multiMatch = evals.filter((x) => x.result && !x.isDefault).length > 1;
    if (chosen) this.traverse(chosen.e, chosen.i);

    return this.record(node.id, 'decision', node.label, chosen ? 'ok' : 'error', {
      edges: evals,
      error: chosen ? undefined : firstError ?? 'No branch matched and there is no default branch.',
      note: multiMatch ? 'Multiple conditions matched; the first declared branch was taken.' : undefined,
    });
  }

  /**
   * assignment node — set flow variables. Normalizes the three authoring
   * shapes the engine accepts (Studio's `{ assignments: { var: value } }`
   * map, the example `{ assignments: [{ variable, value }] }` array, and the
   * legacy flat `{ var: value }`) and interpolates `{var}` templates — so the
   * Debug run mirrors runtime instead of silently no-oping.
   */
  private executeAssignment(node: SimNode): SimStep {
    const cfg = node.config ?? {};
    const raw = cfg.assignments;
    const pairs: Array<[string, unknown]> = [];
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (item && typeof item === 'object') {
          const e = item as Record<string, unknown>;
          const name = e.variable ?? e.name ?? e.key;
          if (typeof name === 'string' && name) pairs.push([name, e.value]);
        }
      }
    } else if (raw && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) pairs.push([k, v]);
    } else {
      for (const [k, v] of Object.entries(cfg)) pairs.push([k, v]);
    }
    const wrote: Record<string, unknown> = {};
    for (const [key, value] of pairs) {
      const resolved = this.interpolateValue(value);
      this.state.variables[key] = resolved;
      wrote[key] = resolved;
    }
    this.enqueueSuccessors(node);
    return this.record(node.id, 'assignment', node.label, 'ok', {
      wrote: Object.keys(wrote).length ? wrote : undefined,
      note: Object.keys(wrote).length ? undefined : 'No assignments defined.',
    });
  }

  /** Resolve `{var}` templates in an assignment value against live variables. */
  private interpolateValue(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    const whole = value.match(/^\{([^}]+)\}$/);
    if (whole) {
      const v = this.state.variables[whole[1].trim()];
      return v !== undefined ? v : value;
    }
    return value.replace(/\{([^}]+)\}/g, (_m, k) => {
      const v = this.state.variables[String(k).trim()];
      return v === undefined || v === null ? '' : String(v);
    });
  }

  private executeLoop(node: SimNode): SimStep {
    const ref = str(node.config?.collection);
    const iterVar = str(node.config?.iteratorVariable);
    let note = 'Loop simulated as a single pass (body re-execution is not modelled).';
    if (ref) {
      const resolved = this.resolveRef(ref);
      if (Array.isArray(resolved)) {
        note = `Collection "${ref}" has ${resolved.length} item(s); simulated as a single pass.`;
        if (iterVar && resolved.length) this.state.variables[iterVar] = resolved[0];
      } else if (resolved !== undefined) {
        note = `Collection "${ref}" is not an array; loop may not run at runtime.`;
      }
    }
    return this.record(node.id, 'loop', node.label, 'ok', { note });
  }

  // ---- helpers ------------------------------------------------------------

  /** Resolve a `{var}` template ref or a plain variable name from `variables`. */
  private resolveRef(ref: string): unknown {
    const m = ref.match(/^\{(.+)\}$/);
    const key = (m ? m[1] : ref).trim();
    return this.state.variables[key];
  }

  /** Apply a node's mock output to the simulation variables; returns what it wrote. */
  private applyMock(node: SimNode): Record<string, unknown> | undefined {
    const cfg = node.config ?? {};
    const mock = this.mocks[node.id];
    const wrote: Record<string, unknown> = {};

    const single = str(cfg.outputVariable);
    if (single) {
      wrote[single] = mock !== undefined ? mock : {};
      this.state.variables[single] = wrote[single];
    }

    const list = Array.isArray(cfg.outputVariables) ? (cfg.outputVariables as unknown[]) : [];
    if (list.length) {
      const m = mock && typeof mock === 'object' ? (mock as Record<string, unknown>) : {};
      for (const name of list) {
        if (typeof name !== 'string') continue;
        wrote[name] = name in m ? m[name] : undefined;
        this.state.variables[name] = wrote[name];
      }
    }
    return Object.keys(wrote).length ? wrote : undefined;
  }

  private mockNote(node: SimNode): string {
    if (node.type === 'script') {
      const action = str(node.config?.actionType);
      if (action && action !== 'code') {
        const recips = Array.isArray(node.config?.recipients) ? (node.config!.recipients as unknown[]).length : 0;
        return `Mocked ${action} notification${recips ? ` to ${recips} recipient(s)` : ''}.`;
      }
      return 'Mocked code script (no real code executed).';
    }
    return `Mocked ${node.type.replace(/_/g, ' ')} (no backend call).`;
  }

  /** Enqueue every outgoing target (linear nodes have one; parallel fans out). */
  private enqueueSuccessors(node: SimNode) {
    this.edges.forEach((e, i) => {
      if (e.source === node.id) this.traverse(e, i);
    });
  }

  private traverse(e: SimEdge, i: number) {
    const id = edgeId(e, i);
    if (!this.state.traversedEdgeIds.includes(id)) this.state.traversedEdgeIds.push(id);
    if (this.nodes.has(e.target)) this.state.frontier.push(e.target);
  }

  private record(
    nodeId: string,
    type: string,
    label: string | undefined,
    status: SimStepStatus,
    extra: Partial<SimStep> = {},
  ): SimStep {
    const step: SimStep = { seq: this.seq++, nodeId, type, label: label || nodeId, status, ...extra };
    this.state.steps.push(step);
    if (status === 'error' && this.state.status !== 'paused') {
      this.state.status = 'error';
      this.state.error = extra.error;
    }
    return step;
  }
}
