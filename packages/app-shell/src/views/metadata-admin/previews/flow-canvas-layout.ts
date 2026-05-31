// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * flow-canvas-layout — pure, dependency-free geometry + graph helpers for
 * the visual flow designer canvas (`FlowCanvas.tsx`).
 *
 * Kept separate from the React component so the layout math stays easy to
 * reason about (and unit-test) without pulling in any rendering concerns.
 *
 * Coordinate system: top-to-bottom flowchart (mirrors Power Automate /
 * Salesforce Flow Builder). Origin is the top-left of the diagram bounding
 * box after normalization, so every node sits at x >= PADDING, y >= PADDING.
 */

export interface FlowNodeUI {
  x?: number;
  y?: number;
}

export interface FlowNode {
  id: string;
  type: string;
  label?: string;
  config?: Record<string, unknown>;
  /** UI-only layout hint persisted via onPatch; ignored by the runtime. */
  ui?: FlowNodeUI;
  [k: string]: unknown;
}

export interface FlowEdge {
  id?: string;
  source: string;
  target: string;
  condition?: string | { source?: string };
  type?: string;
  label?: string;
  isDefault?: boolean;
}

export interface Point {
  x: number;
  y: number;
}

// Node card + spacing geometry. Written as plain numbers so both the layout
// pass and the SVG edge router share one source of truth.
export const NODE_W = 188;
export const NODE_H = 62;
export const H_GAP = 40;
export const V_GAP = 56;
export const PADDING = 28;

/** True when a value is a usable, finite coordinate. */
function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** A node carries a persisted manual position when both x and y are finite. */
export function hasManualPosition(node: FlowNode): boolean {
  return isFiniteNum(node.ui?.x) && isFiniteNum(node.ui?.y);
}

/**
 * Compute a deterministic layered (top-to-bottom) layout.
 *
 * - Edges with a dangling endpoint are ignored for layering.
 * - Layer assignment is a cycle-guarded longest-path relaxation: a node sits
 *   one layer below its deepest predecessor. Roots (the `start` node, else
 *   nodes with no incoming edge, else the first node) seed layer 0.
 * - Nodes never reached from a root are dropped into a trailing layer so the
 *   author still sees them.
 * - Within a layer, nodes keep their original `nodes[]` order (stable).
 * - A node with a persisted `ui` position overrides its computed slot, but is
 *   still included in the returned map so callers can size the canvas.
 */
export function computeLayout(nodes: FlowNode[], edges: FlowEdge[]): Map<string, Point> {
  const positions = new Map<string, Point>();
  if (nodes.length === 0) return positions;

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const indexOf = new Map(nodes.map((n, i) => [n.id, i]));
  const outAdj = new Map<string, string[]>();
  const incoming = new Map<string, number>();
  for (const n of nodes) incoming.set(n.id, 0);
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target) || e.source === e.target) continue;
    if (!outAdj.has(e.source)) outAdj.set(e.source, []);
    outAdj.get(e.source)!.push(e.target);
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
  }

  // Seed roots: explicit start nodes, then any node with no incoming edge,
  // finally the first node as a last resort (handles pure cycles).
  const roots: string[] = [];
  for (const n of nodes) if (n.type === 'start') roots.push(n.id);
  for (const n of nodes) if ((incoming.get(n.id) ?? 0) === 0 && !roots.includes(n.id)) roots.push(n.id);
  if (roots.length === 0) roots.push(nodes[0].id);

  const layer = new Map<string, number>();
  const queue: string[] = [];
  for (const r of roots) {
    layer.set(r, 0);
    queue.push(r);
  }
  // Relaxation with a hard iteration cap so a cyclic graph can never loop.
  const maxIterations = nodes.length * Math.max(1, edges.length) + nodes.length + 1;
  let iterations = 0;
  while (queue.length && iterations < maxIterations) {
    iterations += 1;
    const id = queue.shift()!;
    const base = layer.get(id) ?? 0;
    for (const next of outAdj.get(id) ?? []) {
      const candidate = base + 1;
      if ((layer.get(next) ?? -1) < candidate) {
        layer.set(next, candidate);
        queue.push(next);
      }
    }
  }

  // Any node not reached above goes one layer below the deepest known layer.
  let maxLayer = 0;
  for (const v of layer.values()) maxLayer = Math.max(maxLayer, v);
  for (const n of nodes) {
    if (!layer.has(n.id)) {
      maxLayer += 1;
      layer.set(n.id, maxLayer);
    }
  }

  // Bucket nodes by layer, preserving original order within each layer.
  const byLayer = new Map<number, string[]>();
  for (const n of nodes) {
    const l = layer.get(n.id) ?? 0;
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l)!.push(n.id);
  }
  for (const ids of byLayer.values()) {
    ids.sort((a, b) => (indexOf.get(a) ?? 0) - (indexOf.get(b) ?? 0));
  }

  const sortedLayers = [...byLayer.keys()].sort((a, b) => a - b);
  for (const l of sortedLayers) {
    const ids = byLayer.get(l)!;
    const rowWidth = ids.length * NODE_W + (ids.length - 1) * H_GAP;
    const startX = -rowWidth / 2;
    ids.forEach((id, i) => {
      positions.set(id, {
        x: startX + i * (NODE_W + H_GAP),
        y: l * (NODE_H + V_GAP),
      });
    });
  }

  // Normalize the auto-computed slots so the diagram starts at
  // (PADDING, PADDING). We do this BEFORE applying manual overrides so the
  // auto-laid nodes always live in one stable frame — a dragged node then
  // keeps the exact coordinate the user dropped it at, with no drift.
  let minX = Infinity;
  let minY = Infinity;
  for (const p of positions.values()) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
  }
  if (Number.isFinite(minX) && Number.isFinite(minY)) {
    const dx = PADDING - minX;
    const dy = PADDING - minY;
    for (const [id, p] of positions) positions.set(id, { x: p.x + dx, y: p.y + dy });
  }

  // Apply persisted manual overrides on top of the normalized frame.
  for (const n of nodes) {
    if (hasManualPosition(n)) {
      positions.set(n.id, { x: Math.max(0, n.ui!.x!), y: Math.max(0, n.ui!.y!) });
    }
  }

  return positions;
}

/** Bounding box of the laid-out diagram, including node extents + padding. */
export function diagramSize(positions: Map<string, Point>): { width: number; height: number } {
  let maxX = 0;
  let maxY = 0;
  for (const p of positions.values()) {
    maxX = Math.max(maxX, p.x + NODE_W);
    maxY = Math.max(maxY, p.y + NODE_H);
  }
  return { width: maxX + PADDING, height: maxY + PADDING };
}

/** Bottom-center anchor of a node — where its outgoing edges originate. */
export function bottomAnchor(p: Point): Point {
  return { x: p.x + NODE_W / 2, y: p.y + NODE_H };
}

/** Top-center anchor of a node — where its incoming edges terminate. */
export function topAnchor(p: Point): Point {
  return { x: p.x + NODE_W / 2, y: p.y };
}

/**
 * Smooth vertical cubic-bezier path between two anchors. Control points are
 * pulled along the vertical axis so the curve reads as a top-down flow even
 * when the target sits above or beside the source.
 */
export function edgePath(from: Point, to: Point): string {
  const dy = Math.max(Math.abs(to.y - from.y) * 0.5, 24);
  const c1 = { x: from.x, y: from.y + dy };
  const c2 = { x: to.x, y: to.y - dy };
  return `M ${from.x},${from.y} C ${c1.x},${c1.y} ${c2.x},${c2.y} ${to.x},${to.y}`;
}

/** Midpoint of an edge — anchor for the condition label + insert affordance. */
export function edgeMidpoint(from: Point, to: Point): Point {
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
}

/**
 * Stable identity for an edge. Prefers an explicit `edge.id`; otherwise falls
 * back to a `source->target#index` composite so an unsaved edge still has a
 * deterministic key. Used for selection, traversal highlighting, and inspector
 * lookup — all of which read the same `draft.edges` array, so the index is
 * consistent across them. Editing label/condition/isDefault never changes the
 * key (source/target/index are untouched), so a selection survives edits.
 */
export function edgeKey(edge: FlowEdge, index: number): string {
  return edge.id || `${edge.source}->${edge.target}#${index}`;
}

/** Human-readable condition text for an edge's optional guard. */
export function conditionText(c: FlowEdge['condition']): string | undefined {
  if (!c) return undefined;
  if (typeof c === 'string') return c;
  if (typeof c === 'object' && typeof c.source === 'string') return c.source;
  return undefined;
}
