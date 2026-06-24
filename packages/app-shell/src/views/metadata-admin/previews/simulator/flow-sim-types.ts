// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Shared types for the designer-time flow simulator.
 *
 * The simulator is a CLIENT-SIDE, BACKEND-FREE interpreter used to debug a flow
 * draft inside the visual designer. It NEVER calls a `dataSource`: every
 * side-effecting node (CRUD / connector / http / script) is MOCKED, so running
 * a simulation can never write or delete real data and never needs a live
 * environment. Its guiding rule (per design review) is: *never silently
 * simulate semantics that differ from the runtime* — anything we cannot
 * faithfully model (join synchronization, subflows, boundary events, arbitrary
 * script code) is surfaced as an explicit pause/notice instead of a fake
 * "success".
 */

export interface SimNode {
  id: string;
  type: string;
  label?: string;
  config?: Record<string, unknown>;
  connectorConfig?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface SimEdge {
  id?: string;
  source: string;
  target: string;
  condition?: string | { source?: string };
  isDefault?: boolean;
  label?: string;
  /**
   * Connection type (FlowEdgeSchema). A `'back'` edge is an ADR-0044 declared
   * back-edge: traversed normally at run time, but excluded from DAG cycle
   * validation so a revise/rework loop can re-enter an earlier node.
   */
  type?: string;
}

export type SimStatus = 'idle' | 'running' | 'paused' | 'done' | 'error';

/** One evaluated outgoing edge of a decision (kept for the debug timeline). */
export interface SimEdgeEval {
  edgeId: string;
  target: string;
  condition?: string;
  result: boolean;
  error?: string;
  isDefault?: boolean;
  selected: boolean;
}

export type SimStepStatus = 'ok' | 'mocked' | 'paused' | 'skipped' | 'error';

/** A single executed node, rich enough to debug decisions and data writes. */
export interface SimStep {
  seq: number;
  nodeId: string;
  type: string;
  label: string;
  status: SimStepStatus;
  /** Variable names → values written by this node (mocked side effects). */
  wrote?: Record<string, unknown>;
  /** Per-edge condition diagnostics for a decision node. */
  edges?: SimEdgeEval[];
  /** Human-readable note (e.g. "mocked", "paused for screen input"). */
  note?: string;
  /** Evaluation/structural error surfaced to the author. */
  error?: string;
}

export interface SimState {
  status: SimStatus;
  variables: Record<string, unknown>;
  steps: SimStep[];
  /** Node ids waiting to execute. */
  frontier: string[];
  /** Last executed (or currently paused) node. */
  activeNodeId: string | null;
  visitedNodeIds: string[];
  traversedEdgeIds: string[];
  /** Set while `status === 'paused'` ("wait" or "screen"). */
  pausedReason?: string;
  error?: string;
}

export type DiagnosticLevel = 'error' | 'warning';

export interface Diagnostic {
  level: DiagnosticLevel;
  /** The node this diagnostic points at (for an inline badge + click-to-reveal). */
  nodeId?: string;
  /**
   * The edge this diagnostic points at (e.g. a dangling endpoint). Carries the
   * endpoints so the designer can key the inline badge by `source->target`.
   */
  edge?: { source: string; target: string };
  message: string;
  /**
   * For a cycle error: the node path that closes the loop (e.g. `['a','b','a']`),
   * so the designer can paint the offending edges/nodes inline on the canvas.
   */
  cycle?: string[];
}

export interface FlowValidation {
  errors: Diagnostic[];
  warnings: Diagnostic[];
  /** Resolved entry node id, when exactly one is determinable. */
  startNodeId?: string;
}

/**
 * Author-supplied mock outputs, keyed by node id. The value is merged into the
 * simulation variables according to the node type (single `outputVariable` or a
 * `outputVariables` list). For a `screen` node it supplies the captured inputs.
 */
export type MockResults = Record<string, unknown>;
