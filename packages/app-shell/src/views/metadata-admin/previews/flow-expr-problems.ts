// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * flow-expr-problems — pure, client-side detection of EXPRESSION issues across a
 * whole flow draft, for surfacing in the Problems panel + canvas badges (#1934).
 *
 * Two kinds, mirroring the inline inspector checks but aggregated per node/edge:
 *   • ADR-0032 brace / shape ERRORS on every CEL field (decision conditions +
 *     branch expressions, screen `visibleWhen`, loop collection, edge guards…).
 *     Deterministic, scope-free → zero false positives.
 *   • Scope-aware "unknown reference" WARNINGS — a bare root not in scope at the
 *     node. The START node is skipped: its entry condition legitimately uses the
 *     trigger record's fields *bare* (`status`), which can't be told apart from a
 *     typo without the object schema (an async fetch this pure pass avoids); the
 *     inline inspector check, which does fetch, still covers it.
 *
 * Only CEL (`expression`) surfaces are scanned — template (`{var}`) values use
 * single braces legally and are left to the inline check. An `expression` field
 * flagged `refMode: 'template'` (e.g. a loop/map collection like `{leadList}`) is
 * such a template surface and is likewise skipped here.
 */

import { fieldsForNodeType, getFieldValue } from '../inspectors/flow-node-config';
import { resolveFlowScope } from '../inspectors/flow-scope';
import { scopeRoots, findUnknownRefs, describeUnknownRefs } from '../inspectors/flow-ref-check';
import { validateExpressionClient } from '../inspectors/expression-validate';
import type { DiagnosticLevel } from './simulator/flow-sim-types';

export interface ExprProblem {
  target: { kind: 'node'; nodeId: string } | { kind: 'edge'; source: string; target: string };
  level: DiagnosticLevel;
  message: string;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

/** Brace error (error) else unknown-ref (warning, when `roots` given) for one CEL value. */
function checkCel(value: unknown, roots: Set<string> | null): { level: DiagnosticLevel; message: string } | null {
  const issue = validateExpressionClient('predicate', value);
  if (issue) return { level: 'error', message: issue.message };
  if (roots && roots.size > 0) {
    const unknown = findUnknownRefs(value, 'predicate', roots);
    if (unknown.length > 0) return { level: 'warning', message: describeUnknownRefs(unknown) };
  }
  return null;
}

/**
 * Scan a flow draft for expression problems, resolved onto node / edge targets.
 * Pure: no network — the trigger object's fields are not expanded (root-only
 * scope), which is why the start node is excluded from the ref check.
 */
export function flowExpressionProblems(draft: Record<string, unknown>): ExprProblem[] {
  const nodes = asArray(draft.nodes).map(asRecord);
  const edges = asArray(draft.edges).map(asRecord);
  const startId = str(nodes.find((n) => str(n.type) === 'start')?.id);
  const out: ExprProblem[] = [];

  for (const node of nodes) {
    const nodeId = str(node.id);
    const type = str(node.type);
    if (!nodeId || !type) continue;
    // Root-only scope at this node; skip the ref check on the start node (its
    // bare trigger-record fields are indistinguishable from typos here).
    const roots = nodeId === startId ? null : scopeRoots(resolveFlowScope(draft, nodeId).refs);

    for (const field of fieldsForNodeType(type)) {
      if (field.kind === 'expression' && field.refMode !== 'template') {
        const hit = checkCel(getFieldValue(node, field), roots);
        if (hit) out.push({ target: { kind: 'node', nodeId }, level: hit.level, message: hit.message });
      } else if (field.kind === 'objectList' && field.columns) {
        const exprCols = field.columns.filter((c) => c.kind === 'expression');
        if (exprCols.length === 0) continue;
        for (const row of asArray(getFieldValue(node, field))) {
          const r = asRecord(row);
          const rowLabel = str(r.label);
          for (const col of exprCols) {
            const hit = checkCel(r[col.key], roots);
            if (hit) {
              const prefix = rowLabel || col.label;
              out.push({ target: { kind: 'node', nodeId }, level: hit.level, message: prefix ? `${prefix}: ${hit.message}` : hit.message });
            }
          }
        }
      }
    }
  }

  for (const edge of edges) {
    const source = str(edge.source);
    const target = str(edge.target);
    if (!source || !target || edge.isDefault === true) continue;
    const roots = source === startId ? null : scopeRoots(resolveFlowScope(draft, source).refs);
    const hit = checkCel(edge.condition, roots);
    if (hit) out.push({ target: { kind: 'edge', source, target }, level: hit.level, message: hit.message });
  }

  return out;
}
