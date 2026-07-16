// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * flow-decision-edges — pure branch↔edge reconciliation for decision nodes
 * (#1927 / #1930 / #1942).
 *
 * A decision's routing lives on its outgoing EDGES (`edge.condition` /
 * `edge.label` / `edge.isDefault`) — that is what the engine and the simulator
 * evaluate. `node.config.conditions` is only the node-local branch list
 * (`{ label, expression }`, per the spec decision shape). The Branches editor
 * additionally shows a per-branch **Target** column (#1942): its value is
 * DERIVED from the current edges here (never persisted on the branch — edges
 * stay the single source of truth, so it round-trips with the per-edge Branch
 * picker in `FlowEdgeInspector`, #1930), and committing the editor applies the
 * chosen targets back onto the edges:
 *
 *   • branch has a target and a matching out-edge → update it in place
 *     (retargeting when the author picked a different node);
 *   • branch has a target but no edge            → create the out-edge;
 *   • branch's target was cleared                → remove ("detach") the edge
 *     that was bound to that branch — never the node it pointed at;
 *   • edges bound to NO branch (custom per-edge guards authored in
 *     `FlowEdgeInspector`, fault/back edges, surplus canvas wiring) are never
 *     touched or deleted.
 *
 * A commit in which NO branch carries a target (the engine-published
 * configSchema form has no Target column, and older flows) falls back to the
 * #1927 by-order mirror, so those paths behave exactly as before.
 *
 * "Bound to a branch" follows the same matching the `FlowEdgeInspector`
 * Branch picker uses: a default-ish branch (expression empty or `true`) binds
 * the `isDefault` edge; otherwise match by condition text, then by label.
 */

import { conditionText } from '../previews/flow-canvas-layout';

export interface DecisionEdge {
  id?: string;
  source: string;
  target: string;
  /** CEL guard — a bare string or the spec's `{ dialect, source }` shape. */
  condition?: unknown;
  label?: string;
  isDefault?: boolean;
  type?: string;
  [k: string]: unknown;
}

/** `conditionText` narrowed for the loose `unknown` condition this module carries. */
const condText = (c: unknown): string | undefined =>
  conditionText(c as string | { source?: string } | undefined);

/** A branch row as committed by the editor (freeform per the spec config). */
export type DecisionBranch = Record<string, unknown>;

const branchExpr = (b: DecisionBranch): string =>
  typeof b.expression === 'string' ? b.expression.trim() : '';
const branchName = (b: DecisionBranch): string =>
  typeof b.label === 'string' ? b.label.trim() : '';
const branchTarget = (b: DecisionBranch): string =>
  typeof b.target === 'string' ? b.target.trim() : '';
/** Default/else branch: an empty or literal-`true` expression (#1930 matcher). */
const isDefaultish = (b: DecisionBranch): boolean => {
  const e = branchExpr(b);
  return e === '' || e === 'true';
};

export function asBranchArray(conditions: unknown): DecisionBranch[] {
  return Array.isArray(conditions)
    ? (conditions.filter((c) => c && typeof c === 'object' && !Array.isArray(c)) as DecisionBranch[])
    : [];
}

/**
 * Whether an edge is BOUND to a branch — mirrors `FlowEdgeInspector`'s
 * branch-picker matching so the two editors agree on which edge is which
 * branch: default-ish branch ↔ the `isDefault` edge, else condition text,
 * else (non-empty) label.
 */
export function edgeBindsBranch(branch: DecisionBranch, edge: DecisionEdge): boolean {
  if (isDefaultish(branch)) return edge.isDefault === true;
  const expr = branchExpr(branch);
  const cond = condText(edge.condition);
  if (expr && cond === expr) return true;
  const name = branchName(branch);
  return name !== '' && edge.label === name;
}

/** The decision's plain out-edges (fault / back edges never carry branches). */
const isCandidate = (decisionId: string) => (e: DecisionEdge): boolean =>
  e.source === decisionId && e.type !== 'fault' && e.type !== 'back';

/**
 * Stamp a branch's routing onto an edge (the #1927 mirror rules): a non-`true`
 * expression becomes the guard, a literal `true` marks the default/else path,
 * an empty expression clears both; the label follows the branch label.
 */
function mirrorBranchOntoEdge(edge: DecisionEdge, branch: DecisionBranch): DecisionEdge {
  const expr = branchExpr(branch);
  const label = branchName(branch);
  const next: DecisionEdge = { ...edge };
  if (label) next.label = label;
  else delete next.label;
  if (expr && expr !== 'true') {
    next.condition = expr;
    delete next.isDefault;
  } else if (expr === 'true') {
    next.isDefault = true;
    delete next.condition;
  } else {
    delete next.condition;
    delete next.isDefault;
  }
  return next;
}

/**
 * The legacy #1927 by-order mirror: branch i stamps the i-th plain out-edge.
 * Used when no committed branch carries an explicit target (see module doc).
 */
export function syncDecisionEdgesByOrder(
  decisionId: string,
  conditions: unknown,
  edges: DecisionEdge[],
): DecisionEdge[] {
  const branches = asBranchArray(conditions);
  const candidate = isCandidate(decisionId);
  let bi = 0;
  return edges.map((e) => {
    if (!candidate(e)) return e;
    const branch = branches[bi++];
    return branch ? mirrorBranchOntoEdge(e, branch) : e;
  });
}

/**
 * Derive the Target column for display: pair each branch with the out-edge
 * bound to it (#1930 matching), then pair the remainder by order (the #1927
 * mirror keeps unannotated flows aligned that way). Returns the branches with
 * `target` injected from the paired edge — and any stale stored `target` key
 * dropped, since edges are the source of truth.
 */
export function withBranchTargets(
  decisionId: string,
  conditions: unknown,
  edges: DecisionEdge[],
): DecisionBranch[] {
  const branches = asBranchArray(conditions);
  if (branches.length === 0) return branches;
  const candidates = edges
    .map((_, i) => i)
    .filter((i) => isCandidate(decisionId)(edges[i]));
  const claimed = new Set<number>();
  const pairing = new Map<number, number>();
  branches.forEach((b, bi) => {
    const ei = candidates.find((i) => !claimed.has(i) && edgeBindsBranch(b, edges[i]));
    if (ei !== undefined) {
      claimed.add(ei);
      pairing.set(bi, ei);
    }
  });
  branches.forEach((_, bi) => {
    if (pairing.has(bi)) return;
    const ei = candidates.find((i) => !claimed.has(i));
    if (ei !== undefined) {
      claimed.add(ei);
      pairing.set(bi, ei);
    }
  });
  return branches.map((b, bi) => {
    const { target: _stale, ...rest } = b;
    const ei = pairing.get(bi);
    return ei !== undefined ? { ...rest, target: edges[ei].target } : rest;
  });
}

/**
 * Apply a Branches-editor commit: returns the spec-clean `conditions` to store
 * (the virtual `target` column stripped) and the reconciled `edges`.
 *
 * With no targets anywhere the edge pass is the legacy by-order mirror.
 * Otherwise branches claim edges in three deterministic tiers — exact target
 * AND binding, exact target, binding alone (a retarget keeps the edge's
 * identity and extra keys) — unmatched targeted branches create a fresh edge,
 * and a target-less branch detaches (removes) the edge still bound to it.
 */
export function applyDecisionBranches(
  decisionId: string,
  committed: unknown,
  edges: DecisionEdge[],
): { conditions: DecisionBranch[]; edges: DecisionEdge[] } {
  const branches = asBranchArray(committed);
  const conditions = branches.map((b) => {
    const { target: _t, ...rest } = b;
    return rest;
  });

  if (!branches.some((b) => branchTarget(b) !== '')) {
    return { conditions, edges: syncDecisionEdgesByOrder(decisionId, conditions, edges) };
  }

  const candidates = edges
    .map((_, i) => i)
    .filter((i) => isCandidate(decisionId)(edges[i]));
  const claimed = new Set<number>();
  const pairing = new Map<number, number>();

  const tiers: Array<(b: DecisionBranch, e: DecisionEdge) => boolean> = [
    (b, e) => e.target === branchTarget(b) && edgeBindsBranch(b, e),
    (b, e) => e.target === branchTarget(b),
    (b, e) => edgeBindsBranch(b, e),
  ];
  for (const matches of tiers) {
    branches.forEach((b, bi) => {
      if (pairing.has(bi) || branchTarget(b) === '') return;
      const ei = candidates.find((i) => !claimed.has(i) && matches(b, edges[i]));
      if (ei !== undefined) {
        claimed.add(ei);
        pairing.set(bi, ei);
      }
    });
  }

  const updated = new Map<number, DecisionEdge>();
  const created: DecisionEdge[] = [];
  const removed = new Set<number>();
  branches.forEach((b, bi) => {
    const target = branchTarget(b);
    if (target === '') {
      // Explicitly unbound: detach the edge still bound to this branch (never
      // a claimed edge, never an edge bound to no branch at all).
      const ei = candidates.find((i) => !claimed.has(i) && edgeBindsBranch(b, edges[i]));
      if (ei !== undefined) {
        claimed.add(ei);
        removed.add(ei);
      }
      return;
    }
    const ei = pairing.get(bi);
    if (ei !== undefined) updated.set(ei, mirrorBranchOntoEdge({ ...edges[ei], target }, b));
    else created.push(mirrorBranchOntoEdge({ source: decisionId, target }, b));
  });

  const nextEdges = edges
    .map((e, i) => (removed.has(i) ? null : updated.get(i) ?? e))
    .filter((e): e is DecisionEdge => e !== null)
    .concat(created);
  return { conditions, edges: nextEdges };
}
