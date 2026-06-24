// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * flow-scope — pure, framework-free resolution of the in-scope variable
 * references at a given flow node, for the inspector's variable data-picker
 * (#1934).
 *
 * "In scope" is GRAPH-AWARE: a reference is offered at node N only if it can
 * actually exist when N runs. Concretely:
 *
 *   - Flow variables — every entry in `draft.variables[]` (declared up-front, so
 *     always in scope).
 *   - Upstream outputs — the `outputVariable(s)` / collected screen
 *     `fields[].name` / `assignments` keys / `idVariable` of every ANCESTOR node
 *     (a node from which N is reachable, found by walking edges backwards). A
 *     node's OWN outputs and any DOWNSTREAM node's outputs are deliberately
 *     excluded — they don't exist yet when N runs. This is the property the
 *     picker's "a downstream output is not offered upstream" guarantee rests on.
 *   - Loop / map iterators — the `iteratorVariable` of an enclosing loop/map
 *     ancestor, surfaced as its own group.
 *   - Trigger record — on a record-triggered flow, the trigger object's fields.
 *     Referenced BARE on the start node's own entry condition (`status`,
 *     matching the engine's trigger-evaluation context where the changed
 *     record's fields are top-level) and as `record.<field>` on every
 *     downstream node (the convention the showcase flows use). The object's
 *     field list is fetched lazily by the React layer (see useFlowScope); this
 *     module only resolves the object NAME and the correct token prefix.
 *
 * The graph-walk here is the unit-tested heart of the picker; async field-list
 * expansion and rendering live in the React layer so this module stays pure.
 */

/** Which group a reference belongs to (drives the picker's section headers). */
export type ScopeGroupId = 'variables' | 'outputs' | 'loop' | 'trigger';

/**
 * One pickable reference. `token` is the BARE form (no braces); the picker
 * inserts it as-is into CEL `expression` fields and wraps it as `{token}` for
 * `text` / `textarea` template fields (ADR-0032 — the brace rule is handled for
 * the author).
 */
export interface ScopeRef {
  token: string;
  /** Primary display text (the token, or the bare field name). */
  label: string;
  /** Secondary, muted text — a type, an origin node label, etc. */
  detail?: string;
  group: ScopeGroupId;
}

/** The trigger object whose fields the UI layer should fetch and expand. */
export interface TriggerScope {
  objectName: string;
  /** Per-field token prefix: '' on the start node (bare), 'record.' downstream. */
  fieldPrefix: string;
  /** Also emit `previous.<field>` refs (update / change / before-update triggers). */
  includePrevious: boolean;
}

export interface FlowScope {
  /**
   * References resolvable WITHOUT a network fetch: flow variables, upstream
   * outputs, loop iterators, and the whole-record `record` / `previous` tokens.
   */
  refs: ScopeRef[];
  /** Present when a record trigger is in scope — the UI expands its fields. */
  trigger?: TriggerScope;
}

interface FlowNodeLike {
  id?: unknown;
  type?: unknown;
  label?: unknown;
  config?: unknown;
}
interface FlowEdgeLike {
  source?: unknown;
  target?: unknown;
}

/** Trigger types that fire on a single record (so `record` is in scope). */
const RECORD_TRIGGER_TYPES = new Set([
  'record-after-create',
  'record-after-update',
  'record-before-update',
  'record-after-delete',
  'record-change',
]);
/** Trigger types that carry a meaningful `previous` snapshot of the record. */
const PREVIOUS_TRIGGER_TYPES = new Set([
  'record-after-update',
  'record-before-update',
  'record-change',
]);

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

/**
 * Ancestor node ids of `nodeId` — every node from which `nodeId` is reachable
 * by following edges forward (equivalently, a reverse breadth-first walk from
 * `nodeId`). Cycle-safe (a declared `back`-edge revise loop won't spin) and
 * never includes `nodeId` itself.
 */
export function flowAncestors(nodeId: string, edges: FlowEdgeLike[]): Set<string> {
  const rev = new Map<string, string[]>();
  for (const e of edges) {
    const s = str(e.source);
    const t = str(e.target);
    if (!s || !t) continue;
    const list = rev.get(t);
    if (list) list.push(s);
    else rev.set(t, [s]);
  }
  const seen = new Set<string>();
  const stack = [...(rev.get(nodeId) ?? [])];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === nodeId || seen.has(cur)) continue;
    seen.add(cur);
    for (const p of rev.get(cur) ?? []) stack.push(p);
  }
  return seen;
}

/**
 * The variable names a node INTRODUCES into scope for its successors — mirroring
 * what the simulator (flow-simulator.ts) and engine actually write:
 * `outputVariable` (single), `outputVariables` (list), an assignment node's
 * `assignments` keys (map / array / flat shapes), a screen's collected
 * `fields[].name`, a screen object-form's `idVariable`, and a loop/map
 * `iteratorVariable` (flagged as a `loop` ref). The start node is NOT handled
 * here — its trigger record is resolved separately.
 */
export function nodeOutputRefs(node: FlowNodeLike): ScopeRef[] {
  const type = str(node.type);
  const cfg = asRecord(node.config);
  const nodeId = str(node.id) ?? '';
  const label = str(node.label);
  const detail = label && label !== nodeId ? label : nodeId || undefined;
  const out: ScopeRef[] = [];
  const add = (token: string | undefined, group: ScopeGroupId = 'outputs') => {
    if (token && !out.some((r) => r.token === token)) {
      out.push({ token, label: token, detail, group });
    }
  };

  // Loop / map iterator — its own group.
  if (type === 'loop' || type === 'map') add(str(cfg.iteratorVariable), 'loop');

  // Single + multi output variables (create/get/http/subflow/map/end/script).
  add(str(cfg.outputVariable));
  for (const name of asArray(cfg.outputVariables)) add(str(name));

  // Screen object-form: the saved record's id is bound to a variable.
  add(str(cfg.idVariable));

  // Assignment node — the assigned variable names. Accepts the three authoring
  // shapes the simulator/engine accept: an array of `{variable|name|key}`, a
  // flat `{ var: value }` map, or (legacy) keys directly on config.
  if (type === 'assignment') {
    const raw = cfg.assignments;
    if (Array.isArray(raw)) {
      for (const item of raw) {
        const e = asRecord(item);
        add(str(e.variable) ?? str(e.name) ?? str(e.key));
      }
    } else if (raw && typeof raw === 'object') {
      for (const k of Object.keys(raw as Record<string, unknown>)) add(k);
    }
  }

  // Screen — collected input field names become variables for downstream nodes.
  if (type === 'screen' || type === 'user_task') {
    for (const f of asArray(cfg.fields)) add(str(asRecord(f).name));
  }

  return out;
}

/** De-duplicate by token, keeping the first (group-priority) occurrence. */
function dedupeByToken(refs: ScopeRef[]): ScopeRef[] {
  const seen = new Set<string>();
  return refs.filter((r) => (seen.has(r.token) ? false : (seen.add(r.token), true)));
}

/**
 * Resolve the in-scope reference set at `nodeId` (graph-aware). Pure: the
 * trigger object's fields are NOT expanded here (that needs an async fetch) —
 * the returned `trigger` carries the object name and per-field token prefix for
 * the UI layer to expand. Order: flow variables, upstream outputs, loop
 * iterators, then trigger refs, de-duplicated by token.
 */
export function resolveFlowScope(draft: Record<string, unknown>, nodeId: string | undefined): FlowScope {
  const nodes = asArray(draft.nodes).map(asRecord) as FlowNodeLike[];
  const edges = asArray(draft.edges) as FlowEdgeLike[];
  const refs: ScopeRef[] = [];

  // 1. Flow variables — always in scope (declared up-front).
  for (const v of asArray(draft.variables)) {
    const rec = asRecord(v);
    const name = str(rec.name);
    if (!name) continue;
    const type = str(rec.type);
    refs.push({ token: name, label: name, detail: type ? `variable · ${type}` : 'variable', group: 'variables' });
  }

  if (!nodeId) return { refs: dedupeByToken(refs) };

  // 2. Upstream outputs + loop iterators — from ANCESTOR nodes only.
  const ancestors = flowAncestors(nodeId, edges);
  const startNode = nodes.find((n) => str(n.type) === 'start');
  const startId = str(startNode?.id);
  for (const node of nodes) {
    const id = str(node.id);
    if (!id || id === nodeId || !ancestors.has(id)) continue;
    if (id === startId) continue; // the start node contributes the trigger record, below
    for (const ref of nodeOutputRefs(node)) refs.push(ref);
  }

  // 3. Trigger record — on a record-triggered flow, when the start node is in
  //    scope: either we ARE the start node (editing its own entry condition) or
  //    the start node is an ancestor (it is the ancestor of everything reachable).
  if (startNode) {
    const cfg = asRecord(startNode.config);
    const triggerType = str(cfg.triggerType);
    const objectName = str(cfg.objectName);
    const isRecordTrigger = !!triggerType && RECORD_TRIGGER_TYPES.has(triggerType);
    const startInScope = startId === nodeId || (!!startId && ancestors.has(startId));
    if (isRecordTrigger && objectName && startInScope) {
      const onStart = startId === nodeId;
      const includePrevious = PREVIOUS_TRIGGER_TYPES.has(triggerType);
      // On the start node the record's fields ARE the bare evaluation context
      // (`status`), so the whole record is not a named ref there; `previous` is
      // (`previous.status`). Downstream the record is the named `record` object.
      if (!onStart) {
        refs.push({ token: 'record', label: 'record', detail: `trigger record · ${objectName}`, group: 'trigger' });
      }
      if (includePrevious) {
        refs.push({ token: 'previous', label: 'previous', detail: 'record values before the change', group: 'trigger' });
      }
      return { refs: dedupeByToken(refs), trigger: { objectName, fieldPrefix: onStart ? '' : 'record.', includePrevious } };
    }
  }

  return { refs: dedupeByToken(refs) };
}

/**
 * Expand a trigger object's fields into per-field refs — `record.<field>`
 * downstream, bare `<field>` on the start node — given an already-fetched field
 * list. Split out from {@link resolveFlowScope} so it is unit-testable without a
 * metadata client.
 */
export function triggerFieldRefs(
  trigger: TriggerScope,
  fields: ReadonlyArray<{ name: string; label?: string; type?: string }>,
): ScopeRef[] {
  const out: ScopeRef[] = [];
  for (const f of fields) {
    if (!f?.name) continue;
    const token = `${trigger.fieldPrefix}${f.name}`;
    const detail = f.label && f.label !== f.name ? f.label : f.type;
    out.push({ token, label: token, detail, group: 'trigger' });
    if (trigger.includePrevious) {
      out.push({
        token: `previous.${f.name}`,
        label: `previous.${f.name}`,
        detail: detail ? `prior ${detail}` : 'prior value',
        group: 'trigger',
      });
    }
  }
  return out;
}
