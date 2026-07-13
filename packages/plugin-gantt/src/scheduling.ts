/**
 * Scheduling helpers for the Gantt — pure, side-effect-free functions over the
 * task graph. Shared by two Phase 6 features:
 *
 *   - `computeCriticalPath` — classic CPM (forward ES/EF + backward LS/LF
 *     passes) to find the zero-slack chain that drives the project end.
 *   - `computeProjectReschedule` — dependency-driven forward shifting: push
 *     successors later until every link constraint holds, preserving each
 *     task's duration. Tasks are only ever moved *later* (顺延), never pulled
 *     earlier, so the result is a minimal repair, not an ASAP recompute.
 *
 * Both treat the dependency on a task as a *predecessor* edge: if task B lists
 * A in `dependencies`, the edge is A → B (A precedes B). Link types:
 *   fs  finish→start  B.start >= A.end   (default)
 *   ss  start →start  B.start >= A.start
 *   ff  finish→finish B.end   >= A.end
 *   sf  start →finish  B.end   >= A.start
 *
 * Summary (parent) tasks are derived rollups of their children, so they are
 * never *moved* by the reschedule; they still act as fixed predecessor nodes
 * using their current rolled-up dates.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type SchedLinkType = 'fs' | 'ss' | 'ff' | 'sf';

/**
 * Working-calendar model. When supplied to the scheduling functions, durations
 * are measured in *working* days and rescheduled tasks never start on a
 * non-working day. Days are evaluated at UTC midnight granularity.
 */
export interface WorkingCalendar {
  /** Treat Saturday/Sunday as non-working. */
  skipWeekends?: boolean;
  /** ISO `yyyy-mm-dd` (UTC) keys to treat as non-working (holidays). */
  holidays?: Set<string>;
}

const dayKeyUTC = (d: Date) => d.toISOString().slice(0, 10);

/** Whether the calendar marks this day as workable (UTC day granularity). */
function isWorkingDay(d: Date, cal: WorkingCalendar): boolean {
  if (cal.skipWeekends) {
    const wd = d.getUTCDay();
    if (wd === 0 || wd === 6) return false;
  }
  return !(cal.holidays && cal.holidays.has(dayKeyUTC(d)));
}

/** Floor an instant to UTC midnight. */
function floorDayUTC(ms: number): Date {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** First working day at or after `ms` (returns a UTC-midnight instant). */
function nextWorkingDay(ms: number, cal: WorkingCalendar): number {
  let d = floorDayUTC(ms);
  while (!isWorkingDay(d, cal)) d = new Date(d.getTime() + MS_PER_DAY);
  return d.getTime();
}

/** Count working days in the half-open range [startMs, endMs). */
function workingDaysSpan(startMs: number, endMs: number, cal: WorkingCalendar): number {
  if (endMs <= startMs) return 0;
  let count = 0;
  let d = floorDayUTC(startMs);
  const end = floorDayUTC(endMs).getTime();
  while (d.getTime() < end) {
    if (isWorkingDay(d, cal)) count++;
    d = new Date(d.getTime() + MS_PER_DAY);
  }
  return count;
}

/**
 * The (exclusive) end instant that lies `n` working days after a working-day
 * start — i.e. the day after the n-th consumed working day.
 */
function addWorkingDays(startMs: number, n: number, cal: WorkingCalendar): number {
  if (n <= 0) return floorDayUTC(startMs).getTime();
  let d = floorDayUTC(startMs);
  let remaining = n;
  while (remaining > 0) {
    if (isWorkingDay(d, cal)) remaining--;
    d = new Date(d.getTime() + MS_PER_DAY);
  }
  return d.getTime();
}

/**
 * The (inclusive) start instant whose half-open range [start, endMs) holds
 * exactly `n` working days — the inverse of {@link addWorkingDays}. Used to
 * back-derive a successor's start from a finish-based (ff/sf) constraint.
 */
function subWorkingDays(endMs: number, n: number, cal: WorkingCalendar): number {
  if (n <= 0) return floorDayUTC(endMs).getTime();
  let d = floorDayUTC(endMs);
  let remaining = n;
  while (remaining > 0) {
    d = new Date(d.getTime() - MS_PER_DAY);
    if (isWorkingDay(d, cal)) remaining--;
  }
  return d.getTime();
}

export interface SchedulableTask {
  id: string | number;
  start: Date;
  end: Date;
  dependencies?: Array<string | number | { id: string | number; type?: string }>;
  parent?: string | number | null;
  type?: string;
}

interface Edge {
  pred: string;
  succ: string;
  type: SchedLinkType;
}

const key = (id: string | number) => String(id);

function normType(raw: unknown): SchedLinkType {
  return raw === 'ss' || raw === 'ff' || raw === 'sf' ? raw : 'fs';
}

/**
 * Collect the predecessor edges present in the task list, dropping any that
 * reference ids not in the set (filtered/cross-object refs) and self-loops.
 */
function buildEdges(tasks: SchedulableTask[]): Edge[] {
  const ids = new Set(tasks.map((t) => key(t.id)));
  const edges: Edge[] = [];
  for (const t of tasks) {
    const succ = key(t.id);
    for (const dep of t.dependencies ?? []) {
      const isObj = typeof dep === 'object' && dep !== null;
      const rawId = isObj ? (dep as { id: string | number }).id : dep;
      if (rawId == null || rawId === '') continue;
      const pred = key(rawId);
      if (pred === succ || !ids.has(pred)) continue;
      edges.push({ pred, succ, type: normType(isObj ? (dep as { type?: string }).type : undefined) });
    }
  }
  return edges;
}

/** Set of ids that are a parent of at least one other task (i.e. summaries). */
function parentIds(tasks: SchedulableTask[]): Set<string> {
  const parents = new Set<string>();
  for (const t of tasks) {
    if (t.parent != null && t.parent !== '') parents.add(key(t.parent));
  }
  return parents;
}

/**
 * Kahn topological order over the edge set. Returns ids in dependency order
 * (predecessors before successors). Nodes that remain in a cycle are appended
 * at the end in their original order and flagged via `hasCycle`.
 */
function topoOrder(
  allIds: string[],
  edges: Edge[],
): { order: string[]; hasCycle: boolean } {
  const indeg = new Map<string, number>();
  const succs = new Map<string, string[]>();
  for (const id of allIds) {
    indeg.set(id, 0);
    succs.set(id, []);
  }
  for (const e of edges) {
    succs.get(e.pred)!.push(e.succ);
    indeg.set(e.succ, (indeg.get(e.succ) ?? 0) + 1);
  }
  const queue = allIds.filter((id) => (indeg.get(id) ?? 0) === 0);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const s of succs.get(id) ?? []) {
      const d = (indeg.get(s) ?? 0) - 1;
      indeg.set(s, d);
      if (d === 0) queue.push(s);
    }
  }
  if (order.length < allIds.length) {
    const seen = new Set(order);
    for (const id of allIds) if (!seen.has(id)) order.push(id);
    return { order, hasCycle: true };
  }
  return { order, hasCycle: false };
}

export interface CriticalPathResult {
  /** Ids of tasks on the critical path (zero slack). */
  criticalIds: Set<string>;
  /** Critical edges, keyed `predId->succId`. */
  criticalEdges: Set<string>;
}

/**
 * Critical-path analysis via CPM. Durations come from each task's
 * start/end span (in days, min 0). The forward/backward passes use
 * finish-to-start semantics for every edge — the standard simplification for
 * critical-path display; the four link types still all contribute edges to the
 * longest-path graph. Returns the zero-slack task ids and the edges joining
 * consecutive critical tasks.
 *
 * When a {@link WorkingCalendar} is supplied, durations are counted in working
 * days (weekends/holidays excluded) so the longest path reflects real effort.
 */
export function computeCriticalPath(tasks: SchedulableTask[], cal?: WorkingCalendar): CriticalPathResult {
  const empty: CriticalPathResult = { criticalIds: new Set(), criticalEdges: new Set() };
  if (!tasks.length) return empty;

  const dur = new Map<string, number>();
  for (const t of tasks) {
    const d = cal
      ? workingDaysSpan(t.start.getTime(), t.end.getTime(), cal)
      : (t.end.getTime() - t.start.getTime()) / MS_PER_DAY;
    dur.set(key(t.id), Number.isFinite(d) && d > 0 ? d : 0);
  }
  const edges = buildEdges(tasks);
  const allIds = tasks.map((t) => key(t.id));
  const { order, hasCycle } = topoOrder(allIds, edges);
  if (hasCycle) return empty; // a cycle has no well-defined critical path

  const preds = new Map<string, Edge[]>();
  const succs = new Map<string, Edge[]>();
  for (const id of allIds) {
    preds.set(id, []);
    succs.set(id, []);
  }
  for (const e of edges) {
    preds.get(e.succ)!.push(e);
    succs.get(e.pred)!.push(e);
  }

  // Forward pass: earliest start/finish.
  const ES = new Map<string, number>();
  const EF = new Map<string, number>();
  for (const id of order) {
    let es = 0;
    for (const e of preds.get(id) ?? []) es = Math.max(es, EF.get(e.pred) ?? 0);
    ES.set(id, es);
    EF.set(id, es + (dur.get(id) ?? 0));
  }
  const projectEnd = Math.max(0, ...allIds.map((id) => EF.get(id) ?? 0));

  // Backward pass: latest finish/start.
  const LF = new Map<string, number>();
  const LS = new Map<string, number>();
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const outgoing = succs.get(id) ?? [];
    let lf = projectEnd;
    if (outgoing.length) {
      lf = Math.min(...outgoing.map((e) => LS.get(e.succ) ?? projectEnd));
    }
    LF.set(id, lf);
    LS.set(id, lf - (dur.get(id) ?? 0));
  }

  const EPS = 1e-6;
  const criticalIds = new Set<string>();
  for (const id of allIds) {
    const slack = (LS.get(id) ?? 0) - (ES.get(id) ?? 0);
    if (Math.abs(slack) <= EPS) criticalIds.add(id);
  }
  // Only keep critical nodes that actually participate in an edge OR have a
  // non-zero duration — an isolated zero-duration milestone with no links is
  // technically zero-slack but not meaningfully "on the path".
  const connected = new Set<string>();
  for (const e of edges) {
    connected.add(e.pred);
    connected.add(e.succ);
  }
  for (const id of [...criticalIds]) {
    if (!connected.has(id) && (dur.get(id) ?? 0) === 0) criticalIds.delete(id);
  }

  const criticalEdges = new Set<string>();
  for (const e of edges) {
    if (!criticalIds.has(e.pred) || !criticalIds.has(e.succ)) continue;
    // The edge is critical when the successor starts exactly when the
    // predecessor finishes (no float on the link).
    if (Math.abs((EF.get(e.pred) ?? 0) - (ES.get(e.succ) ?? 0)) <= EPS) {
      criticalEdges.add(`${e.pred}->${e.succ}`);
    }
  }

  return { criticalIds, criticalEdges };
}

export interface RescheduleChange {
  id: string;
  start: Date;
  end: Date;
}

/**
 * Dependency-driven forward reschedule. Walks the graph in topological order
 * and pushes each task as late as its predecessors require, preserving its
 * duration and never moving it earlier than its current start. Summary tasks
 * (parents) are treated as fixed rollup nodes — they constrain successors but
 * are not themselves moved. Returns only the tasks whose dates change.
 *
 * When a {@link WorkingCalendar} is supplied, each task's duration is measured
 * in working days and rescheduled tasks are snapped to start (and finish) on
 * working days only — weekends/holidays are stepped over rather than consumed.
 *
 * Returns an empty array when the graph has a cycle (ambiguous ordering).
 */
export function computeProjectReschedule(tasks: SchedulableTask[], cal?: WorkingCalendar): RescheduleChange[] {
  if (!tasks.length) return [];
  const edges = buildEdges(tasks);
  const allIds = tasks.map((t) => key(t.id));
  const { order, hasCycle } = topoOrder(allIds, edges);
  if (hasCycle) return [];

  const summaries = parentIds(tasks);
  const byId = new Map<string, SchedulableTask>();
  for (const t of tasks) byId.set(key(t.id), t);

  const preds = new Map<string, Edge[]>();
  for (const id of allIds) preds.set(id, []);
  for (const e of edges) preds.get(e.succ)!.push(e);

  // Working start/end (ms) per task, seeded from current dates.
  const startMs = new Map<string, number>();
  const endMs = new Map<string, number>();
  for (const t of tasks) {
    startMs.set(key(t.id), t.start.getTime());
    endMs.set(key(t.id), t.end.getTime());
  }

  for (const id of order) {
    const t = byId.get(id);
    if (!t) continue;
    // Calendar mode measures spans in working days; otherwise raw ms.
    const duration = cal
      ? workingDaysSpan(startMs.get(id)!, endMs.get(id)!, cal)
      : endMs.get(id)! - startMs.get(id)!;
    const origStart = t.start.getTime();
    // Never pull earlier than the current start — this is 顺延, not ASAP.
    let reqStart = origStart;
    for (const e of preds.get(id) ?? []) {
      const pStart = startMs.get(e.pred)!;
      const pEnd = endMs.get(e.pred)!;
      let candidate: number;
      switch (e.type) {
        case 'ss':
          candidate = pStart;
          break;
        case 'ff':
          // Successor must finish no earlier than the predecessor: back off the
          // duration from the required finish (in working days when calendared).
          candidate = cal ? subWorkingDays(pEnd, duration, cal) : pEnd - duration;
          break;
        case 'sf':
          candidate = cal ? subWorkingDays(pStart, duration, cal) : pStart - duration;
          break;
        case 'fs':
        default:
          candidate = pEnd;
          break;
      }
      if (candidate > reqStart) reqStart = candidate;
    }
    // Summaries are derived rollups: keep them where they are, only let them
    // act as predecessors. Everything else shifts to satisfy its links.
    if (summaries.has(id)) continue;
    if (cal) {
      const s = nextWorkingDay(reqStart, cal);
      startMs.set(id, s);
      endMs.set(id, addWorkingDays(s, duration, cal));
    } else {
      startMs.set(id, reqStart);
      endMs.set(id, reqStart + duration);
    }
  }

  const changes: RescheduleChange[] = [];
  for (const t of tasks) {
    const id = key(t.id);
    if (summaries.has(id)) continue;
    const ns = startMs.get(id)!;
    const ne = endMs.get(id)!;
    // In calendar mode a task can keep its start yet have its finish snapped off
    // a weekend, so report end-only moves too.
    if (ns !== t.start.getTime() || ne !== t.end.getTime()) {
      changes.push({ id, start: new Date(ns), end: new Date(ne) });
    }
  }
  return changes;
}

// ---------------------------------------------------------------------------
// Dependency-cycle guard (creation-time)
// ---------------------------------------------------------------------------

/**
 * Would adding the dependency edge `sourceId → targetId` (predecessor →
 * dependent) close a cycle? `edges` is the EXISTING graph as
 * [predecessorId, dependentId] pairs — build it from the full task set, not
 * from visible rows, so links hidden inside collapsed subtrees still count.
 *
 * The new edge cycles iff `sourceId` is already reachable from `targetId`
 * (a path target ⇝ source exists). The toposort above only *skips* cyclic
 * chains during scheduling; this guard is what keeps them from being created
 * in the first place.
 */
export function wouldCreateDependencyCycle(
  edges: Array<[string, string]>,
  sourceId: string | number,
  targetId: string | number,
): boolean {
  const src = String(sourceId);
  const tgt = String(targetId);
  if (src === tgt) return true;
  const adj = new Map<string, string[]>();
  for (const [from, to] of edges) {
    const list = adj.get(from);
    if (list) list.push(to);
    else adj.set(from, [to]);
  }
  const seen = new Set<string>([tgt]);
  const stack = [tgt];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const next of adj.get(cur) ?? []) {
      if (next === src) return true;
      if (!seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return false;
}
