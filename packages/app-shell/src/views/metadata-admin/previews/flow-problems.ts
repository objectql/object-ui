// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * flow-problems — unify the two flow-validation sources into one flat,
 * per-element issue list that the canvas badges and the Problems panel both
 * render.
 *
 *   1. `validateFlowDraft` (client, structural): no resolvable entry,
 *      unreachable nodes, a decision with no default branch, duplicate node
 *      ids, dangling edges, un-declared cycles.
 *   2. The server `_diagnostics` already attached to the layered record
 *      (schema validation), each keyed by a dotted JSON path.
 *
 * "Surfacing, not detection": detection already exists. This module only maps
 * each detected issue onto a concrete canvas element — a node id or a stable
 * edge key — so a badge can sit on the offending element and a Problems-panel
 * row can select + reveal it. Flow-level issues (no specific element) are kept
 * too: listed in the panel, but without a badge.
 */

import { validateFlowDraft } from './simulator/flow-sim-validate.js';
import type { Diagnostic, DiagnosticLevel, SimEdge, SimNode } from './simulator/flow-sim-types.js';
import { edgeKey, type FlowDesignerEdge, type FlowDesignerNode } from './flow-canvas-layout.js';
import { flowExpressionProblems } from './flow-expr-problems.js';

/** What a problem points at on the canvas — drives badge placement + reveal. */
export type FlowProblemTarget =
  | { kind: 'node'; nodeId: string }
  | { kind: 'edge'; edgeKey: string; source: string; target: string }
  | { kind: 'flow' };

/** Origin of a problem — labels the panel row and lets the UI group counts. */
export type FlowProblemSource = 'structural' | 'server' | 'expression';

/** One actionable issue, resolved onto a concrete canvas element. */
export interface FlowProblem {
  /** Stable-enough key for React lists. */
  id: string;
  level: DiagnosticLevel;
  message: string;
  target: FlowProblemTarget;
  source: FlowProblemSource;
  /**
   * Extra elements to flag with the red error ring/stroke beyond `target` —
   * e.g. every hop of a cycle. The badge + click-reveal still use `target`.
   */
  highlight?: { nodeIds: string[]; edges: Array<{ source: string; target: string }> };
}

/** A server diagnostic entry (subset of the layered record's `_diagnostics`). */
export interface ServerDiagnostic {
  /** Dotted (or array) JSON path, e.g. `nodes.2.config.objectName`. */
  path?: string | Array<string | number>;
  message: string;
  /** Defaults to `'error'`. */
  severity?: DiagnosticLevel;
}

/** Stable `source->target` key matching an edge problem to a rendered edge. */
export function edgeProblemKey(source: string, target: string): string {
  return `${source}->${target}`;
}

/** Resolve an edge's selection key (`edgeKey`) from its endpoints. */
function resolveEdgeKey(edges: FlowDesignerEdge[], source: string, target: string): string {
  const idx = edges.findIndex((e) => e.source === source && e.target === target);
  return idx >= 0 ? edgeKey(edges[idx], idx) : `${source}->${target}#-1`;
}

/** Normalize a dotted/array JSON path to segments (numbers stay numeric). */
function pathSegments(path: ServerDiagnostic['path']): Array<string | number> {
  if (Array.isArray(path)) return path;
  if (typeof path !== 'string' || !path) return [];
  return path.split('.').map((seg) => {
    const n = Number(seg);
    return Number.isInteger(n) && String(n) === seg ? n : seg;
  });
}

/** A structural diagnostic mapped to its badge target + optional red-highlight set. */
interface StructuralMapping {
  target: FlowProblemTarget;
  highlight?: { nodeIds: string[]; edges: Array<{ source: string; target: string }> };
}

/**
 * Map a structural diagnostic's optional anchors (`edge`, `cycle`, `nodeId`)
 * onto a badge target. A cycle points its badge at the *closing* hop — the edge
 * the author marks as a back-edge to resolve it — but flags EVERY hop (nodes +
 * edges) for the red error highlight so the whole loop reads as the problem.
 */
function structuralMapping(diag: Diagnostic, edges: FlowDesignerEdge[]): StructuralMapping {
  if (diag.edge) {
    const { source, target } = diag.edge;
    return { target: { kind: 'edge', source, target, edgeKey: resolveEdgeKey(edges, source, target) } };
  }
  if (diag.cycle && diag.cycle.length >= 2) {
    const c = diag.cycle;
    const source = c[c.length - 2];
    const target = c[c.length - 1];
    const nodeIds: string[] = [];
    const hops: Array<{ source: string; target: string }> = [];
    for (let i = 0; i < c.length - 1; i++) {
      nodeIds.push(c[i]);
      hops.push({ source: c[i], target: c[i + 1] });
    }
    return {
      target: { kind: 'edge', source, target, edgeKey: resolveEdgeKey(edges, source, target) },
      highlight: { nodeIds, edges: hops },
    };
  }
  if (diag.nodeId) return { target: { kind: 'node', nodeId: diag.nodeId } };
  return { target: { kind: 'flow' } };
}

/** Map a server diagnostic's JSON path onto a node/edge/flow target. */
function serverTarget(path: ServerDiagnostic['path'], nodes: FlowDesignerNode[], edges: FlowDesignerEdge[]): FlowProblemTarget {
  const segs = pathSegments(path);
  if (segs.length >= 2 && typeof segs[1] === 'number') {
    const idx = segs[1];
    if (segs[0] === 'nodes' && nodes[idx]?.id) return { kind: 'node', nodeId: nodes[idx].id };
    if (segs[0] === 'edges' && edges[idx]) {
      const e = edges[idx];
      return { kind: 'edge', source: e.source, target: e.target, edgeKey: edgeKey(e, idx) };
    }
  }
  return { kind: 'flow' };
}

/** Short stable token for a target, used in a problem's React key. */
function targetKey(t: FlowProblemTarget): string {
  if (t.kind === 'node') return `n:${t.nodeId}`;
  if (t.kind === 'edge') return `e:${t.source}->${t.target}`;
  return 'flow';
}

export interface BuildFlowProblemsArgs {
  nodes: FlowDesignerNode[];
  edges: FlowDesignerEdge[];
  /** Server `_diagnostics`, flattened to a severity-tagged, path-keyed list. */
  serverDiagnostics?: ServerDiagnostic[];
  /** Declared flow variables — needed to resolve scope for the expression check. */
  variables?: unknown[];
  /** UI locale for the structural-validation messages. */
  locale?: string;
}

/**
 * Build the unified problem list from structural validation + server
 * diagnostics. Errors are listed before warnings; within a level each source
 * keeps its own emit order (structural before server).
 */
export function buildFlowProblems({ nodes, edges, serverDiagnostics, variables, locale }: BuildFlowProblemsArgs): FlowProblem[] {
  const problems: FlowProblem[] = [];

  const v = validateFlowDraft(nodes as unknown as SimNode[], edges as unknown as SimEdge[], locale);
  const pushStructural = (level: DiagnosticLevel, list: Diagnostic[]) => {
    list.forEach((diag, i) => {
      const { target, highlight } = structuralMapping(diag, edges);
      problems.push({
        id: `structural:${level}:${i}:${targetKey(target)}`,
        level,
        message: diag.message,
        target,
        source: 'structural',
        ...(highlight ? { highlight } : {}),
      });
    });
  };
  pushStructural('error', v.errors);
  pushStructural('warning', v.warnings);

  (serverDiagnostics ?? []).forEach((diag, i) => {
    const level: DiagnosticLevel = diag.severity === 'warning' ? 'warning' : 'error';
    const target = serverTarget(diag.path, nodes, edges);
    problems.push({
      id: `server:${i}:${targetKey(target)}`,
      level,
      message: diag.message,
      target,
      source: 'server',
    });
  });

  // Client-side EXPRESSION issues (ADR-0032 braces + scope-aware unknown refs),
  // resolved onto node / edge targets — see flow-expr-problems.
  flowExpressionProblems({ nodes, edges, variables: variables ?? [] }, locale).forEach((ep, i) => {
    const target: FlowProblemTarget =
      ep.target.kind === 'edge'
        ? {
            kind: 'edge',
            source: ep.target.source,
            target: ep.target.target,
            edgeKey: resolveEdgeKey(edges, ep.target.source, ep.target.target),
          }
        : { kind: 'node', nodeId: ep.target.nodeId };
    problems.push({
      id: `expression:${ep.level}:${i}:${targetKey(target)}`,
      level: ep.level,
      message: ep.message,
      target,
      source: 'expression',
    });
  });

  // Errors first so the panel + counts lead with blockers (stable within level).
  return problems
    .map((p, i) => [p, i] as const)
    .sort((a, b) => {
      if (a[0].level !== b[0].level) return a[0].level === 'error' ? -1 : 1;
      return a[1] - b[1];
    })
    .map(([p]) => p);
}

/** A folded badge for one canvas element (errors dominate warnings). */
export interface ProblemBadge {
  level: DiagnosticLevel;
  /** Tooltip text — each problem message on its own line. */
  title: string;
  count: number;
}

function foldBadge(list: FlowProblem[]): ProblemBadge {
  const level: DiagnosticLevel = list.some((p) => p.level === 'error') ? 'error' : 'warning';
  return { level, title: list.map((p) => p.message).join('\n'), count: list.length };
}

export interface ProblemIndex {
  byNode: Map<string, ProblemBadge>;
  byEdge: Map<string, ProblemBadge>;
}

/** Group problems into per-node / per-edge badges for the canvas overlay. */
export function indexProblemBadges(problems: FlowProblem[]): ProblemIndex {
  const nodeLists = new Map<string, FlowProblem[]>();
  const edgeLists = new Map<string, FlowProblem[]>();
  for (const p of problems) {
    if (p.target.kind === 'node') {
      const l = nodeLists.get(p.target.nodeId) ?? [];
      l.push(p);
      nodeLists.set(p.target.nodeId, l);
    } else if (p.target.kind === 'edge') {
      const k = edgeProblemKey(p.target.source, p.target.target);
      const l = edgeLists.get(k) ?? [];
      l.push(p);
      edgeLists.set(k, l);
    }
  }
  const byNode = new Map<string, ProblemBadge>();
  for (const [id, list] of nodeLists) byNode.set(id, foldBadge(list));
  const byEdge = new Map<string, ProblemBadge>();
  for (const [k, list] of edgeLists) byEdge.set(k, foldBadge(list));
  return { byNode, byEdge };
}

/**
 * Error elements to paint with the red ring/stroke, derived from the unified
 * problem list. ERRORS ONLY — warnings get an amber badge but no ring. Includes
 * each error's `highlight` set, so a cycle paints its whole loop (every hop node
 * + edge) red while its badge still sits on the closing edge. Lets the preview
 * derive the red sets from `problems` instead of a second validateFlowDraft pass.
 */
export function deriveInvalidElements(problems: FlowProblem[]): {
  invalidNodeIds: string[];
  invalidEdges: Set<string>;
} {
  const nodeSet = new Set<string>();
  const edgeSet = new Set<string>();
  for (const p of problems) {
    if (p.level !== 'error') continue;
    if (p.target.kind === 'node') nodeSet.add(p.target.nodeId);
    else if (p.target.kind === 'edge') edgeSet.add(edgeProblemKey(p.target.source, p.target.target));
    for (const id of p.highlight?.nodeIds ?? []) nodeSet.add(id);
    for (const e of p.highlight?.edges ?? []) edgeSet.add(edgeProblemKey(e.source, e.target));
  }
  return { invalidNodeIds: [...nodeSet], invalidEdges: edgeSet };
}
