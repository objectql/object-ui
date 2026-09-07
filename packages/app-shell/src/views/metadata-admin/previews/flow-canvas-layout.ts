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
 *
 * "Dependency-free" means no RUNTIME dependency: the imports below are
 * `import type`, erased at compile time, and they are here precisely so the
 * designer's edge guard cannot drift from the spec's expression envelope
 * (see {@link FlowDesignerEdge}) and its node geometry cannot drift from the
 * spec's `FlowNode.position` (see {@link FlowNodePosition}).
 */

import type { ExpressionInput } from '@objectstack/spec/shared';
import type { FlowNode as SpecFlowNode } from '@objectstack/spec/automation';

/**
 * Canvas geometry of a node — **the spec's own `FlowNode.position`**, taken by
 * reference rather than restated (objectui#3172).
 *
 * `{ x: number; y: number }`, both REQUIRED: a half-coordinate is not a
 * position, and the spec's node schema rejects one. Derived from the spec's
 * authoring type so the two cannot drift; `__tests__/spec-symbol-parity.test.ts`
 * pins the equality in both directions.
 */
export type FlowNodePosition = NonNullable<SpecFlowNode['position']>;

/**
 * The designer's pre-objectui#3172 geometry spelling, kept for READING stored
 * flows only.
 *
 * @deprecated Never write this. `FlowSchema`'s node is `.strict()`
 * (objectstack#4001), so a node carrying `ui` is rejected by client-side
 * validation and by the server with a 422 — this spelling could not round-trip
 * even before it was retired. {@link withCanonicalGeometry} lifts it onto
 * {@link FlowNodePosition} at the canvas boundary, so a stored flow heals on the
 * author's first edit.
 */
export interface LegacyFlowNodeUI {
  x?: number;
  y?: number;
}

/**
 * A flow node **as the designer canvas holds it mid-edit**.
 *
 * Renamed from `FlowNode`, which `@objectstack/spec/automation` owns
 * (objectstack#4115). This is deliberately NOT that type, and the difference is
 * not drift — it is a layer difference of the kind objectui#3090 named: the
 * spec's `FlowNode` is a COMPLETE authored node (`label` required), while a
 * canvas holds nodes the user has dropped but not finished. A freshly dropped
 * node has no label yet; typing it as the spec's would make the editor's own
 * intermediate state unrepresentable.
 *
 * Not to be confused with `@objectstack/spec/studio`'s `FlowCanvasNode` either
 * — despite the name, that is the pure visual overlay
 * (`{ nodeId, x, y, collapsed, width, fillColor, … }`), keyed BY node id rather
 * than being the node.
 *
 * The `[k: string]: unknown` index signature is load-bearing: the canvas
 * round-trips node properties it does not itself understand
 * (`connectorConfig`, `inputSchema`, `waitEventConfig`, `boundaryConfig`, …),
 * and dropping them on save would be data loss. It also means the compiler
 * cannot compare this against the spec's node — an index signature absorbs
 * every missing member (objectstack#4075) — which is precisely why the NAME had
 * to stop claiming they are the same thing.
 *
 * Geometry is NOT a layer difference and no longer diverges: the canvas writes
 * the spec's own `position` (objectui#3172). The designer's old `ui: { x, y }`
 * spelling is read-only legacy — see {@link LegacyFlowNodeUI} and
 * {@link withCanonicalGeometry}. (`@objectstack/spec/studio`'s `FlowCanvasNode`
 * is a third name but not a third geometry: it is the visual overlay keyed BY
 * node id, with no consumer in this repo.)
 *
 * `__tests__/spec-symbol-parity.test.ts` pins that the spec owns neither
 * `FlowDesignerNode` nor `FlowDesignerEdge`, and that `position` here IS the
 * spec's.
 */
export interface FlowDesignerNode {
  id: string;
  type: string;
  /**
   * Optional HERE and required by `FlowNodeSchema` — the layer difference this
   * interface's own doc comment describes, and the settled answer to a question
   * that has now been asked twice (objectui#6287, objectui#6331).
   *
   * ⛔ Making it required here catches nothing. Measured on `origin/main` in
   * #6287: `tsc` exit 0, ZERO errors, because every node reaches the reader
   * types through `as InspectorFlowNode[]` / `as FlowDesignerNode[]` casts out of
   * `Record<string, unknown>`, and **a cast bypasses a required member**. It is
   * also mildly harmful — `node.label ?? ''` and `node.label || node.id` are
   * guards the OPTIONAL type forces, while a required `label` would let
   * `node.label.trim()` compile against a value that genuinely is absent (a
   * stored flow, or a node mid-edit, can have none).
   *
   * What guarantees a node ACQUIRES one is therefore at the PRODUCER, where a
   * cast cannot get in front of it: `flow-node-producers.label.test.tsx`
   * censuses every construction site and refuses one that writes no label.
   * ⛔ If that pin ever fails, write the label at the producer — do not narrow
   * this member.
   */
  label?: string;
  config?: Record<string, unknown>;
  /**
   * Canvas position, spec-canonical (`FlowNode.position`). Optional because an
   * un-dragged node is placed by the auto-layout, exactly as in the spec.
   */
  position?: FlowNodePosition;
  /** @deprecated Read-only legacy geometry — see {@link LegacyFlowNodeUI}. */
  ui?: LegacyFlowNodeUI;
  [k: string]: unknown;
}

/**
 * A flow edge as the designer canvas holds it mid-edit — see
 * {@link FlowDesignerNode} for why this is not `@objectstack/spec/automation`'s
 * `FlowEdge`.
 *
 * The ONE remaining reason it cannot simply BE the spec's edge is `id`: an edge
 * being DRAWN has no id until it is committed, while the spec requires one.
 * That is a real mid-edit state (the same layer difference {@link
 * FlowDesignerNode} describes), and it is the only member here that is wider
 * than the spec's. It licenses nothing downstream: every edge that reaches a
 * COMMIT carries an id — objectui#3202 closed the last producer that shipped
 * one without (`applyDecisionBranches`, whose output goes straight to
 * `onPatch` → draft → save).
 *
 * `condition` used to be spelled `string | { source?: string }`, which dropped
 * the ADR-0089 expression envelope's REQUIRED `dialect` discriminant. That was
 * never a layer difference — it was an over-wide READ type describing a shape
 * the server's own `FlowEdgeSchema` rejects and that nothing in this repo has
 * ever produced. Its cost was a wrong defect diagnosis (objectui#3171 was filed
 * against that phantom envelope and does not reproduce). It now mirrors the
 * spec by IMPORTING `ExpressionInput` rather than restating it, so the mirror
 * cannot go stale: a type that can no longer describe a spec-rejected condition
 * cannot mislead the next reader into filing against one either.
 *
 * `type` stays `string` deliberately (the spec's is a four-value enum): the
 * canvas round-trips whatever an authored flow carries, and the inspector's
 * type picker is what constrains the values an author can write.
 */
export interface FlowDesignerEdge {
  id?: string;
  source: string;
  target: string;
  condition?: ExpressionInput;
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
export const NODE_W = 240;
export const NODE_H = 66;
export const H_GAP = 44;
export const V_GAP = 56;
export const PADDING = 28;

/** True when a value is a usable, finite coordinate. */
function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * The persisted manual position of a node — **the** reader for node geometry.
 *
 * Spec-canonical `position` first; the retired `ui: { x, y }` spelling is read
 * ONLY as a fallback so a flow stored before objectui#3172 still opens with its
 * nodes where the author left them. Nothing writes `ui` any more, and
 * {@link withCanonicalGeometry} strips it at the canvas boundary, so the
 * fallback is a migration path and not a second contract.
 *
 * Both coordinates must be finite — a half or NaN coordinate is not a position
 * (and the spec's node schema rejects one), so such a node is auto-laid out
 * instead of being pinned at a garbage point.
 */
export function manualPosition(node: FlowDesignerNode): FlowNodePosition | null {
  const p = node.position;
  if (isFiniteNum(p?.x) && isFiniteNum(p?.y)) return { x: p.x, y: p.y };
  const legacy = node.ui;
  if (isFiniteNum(legacy?.x) && isFiniteNum(legacy?.y)) return { x: legacy.x, y: legacy.y };
  return null;
}

/** A node carries a persisted manual position when both x and y are finite. */
export function hasManualPosition(node: FlowDesignerNode): boolean {
  return manualPosition(node) !== null;
}

/**
 * Migrate-on-write boundary (objectui#3172): return `nodes` with every legacy
 * `ui: { x, y }` lifted onto the spec's `position` and the `ui` key REMOVED.
 *
 * The canvas runs its own `nodes` prop through this, so every patch it emits is
 * built from already-canonical nodes and can never re-emit `ui` — including the
 * patches that have nothing to do with geometry (delete, revise loop). That
 * matters because a draft carrying `ui` is unsavable, not merely untidy:
 * `FlowSchema`'s node is `.strict()` (objectstack#4001), so the key surfaces as
 * `unrecognized_keys` in the live client validation and as a 422 on save. A
 * stored flow therefore heals on the author's first edit.
 *
 * A node whose legacy `ui` is unusable (missing or non-finite coordinate) loses
 * the key without gaining a position: it was never rendered as pinned, and
 * keeping it would keep the draft unsavable.
 *
 * Returns the SAME array reference when nothing needed migrating, so callers can
 * use it inside a `useMemo` without invalidating downstream memos every render.
 */
export function withCanonicalGeometry(nodes: FlowDesignerNode[]): FlowDesignerNode[] {
  if (!nodes.some((n) => n && 'ui' in n)) return nodes;
  return nodes.map((n) => {
    if (!n || !('ui' in n)) return n;
    const { ui: _legacy, ...rest } = n;
    const p = manualPosition(n);
    return p ? { ...rest, position: p } : rest;
  });
}

/**
 * A structured-region sub-graph carried in a container node's config (ADR-0031),
 * tagged with a header label for the designer.
 */
export interface LabeledRegion {
  /** Stable key within the container (`body` / `branch-N` / `try` / `catch`). */
  key: string;
  /** Header shown above the region — `undefined` for a loop body (no header). */
  label?: string;
  nodes: FlowDesignerNode[];
  edges: FlowDesignerEdge[];
}

/** Coerce a config value to a region iff it is a non-empty `{ nodes, edges }`. */
function asRegion(v: unknown): { nodes: FlowDesignerNode[]; edges: FlowDesignerEdge[] } | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as { nodes?: unknown; edges?: unknown };
  if (!Array.isArray(r.nodes) || r.nodes.length === 0) return null;
  return { nodes: r.nodes as FlowDesignerNode[], edges: Array.isArray(r.edges) ? (r.edges as FlowDesignerEdge[]) : [] };
}

/**
 * The nested regions a structured control-flow container carries in its config
 * (ADR-0031): `loop.body`, `parallel.branches[]`, `try_catch.try`/`catch`.
 *
 * Returns `[]` for ordinary nodes AND for a **legacy flat `loop`** (a `loop`
 * with no `config.body`) — the constructs are additive, so those stay plain
 * cards. The designer renders the returned regions read-only, nested under the
 * container.
 */
export function extractRegions(node: FlowDesignerNode): LabeledRegion[] {
  const cfg = (node.config ?? {}) as Record<string, unknown>;
  switch (node.type) {
    case 'loop': {
      const body = asRegion(cfg.body);
      return body ? [{ key: 'body', label: undefined, ...body }] : [];
    }
    case 'parallel': {
      const out: LabeledRegion[] = [];
      (Array.isArray(cfg.branches) ? cfg.branches : []).forEach((b, i) => {
        const region = asRegion(b);
        if (!region) return;
        const name = (b as { name?: unknown }).name;
        out.push({ key: `branch-${i}`, label: typeof name === 'string' && name ? name : `Branch ${i + 1}`, ...region });
      });
      return out;
    }
    case 'try_catch': {
      const out: LabeledRegion[] = [];
      const tryR = asRegion(cfg.try);
      if (tryR) out.push({ key: 'try', label: 'Try', ...tryR });
      const catchR = asRegion(cfg.catch);
      if (catchR) out.push({ key: 'catch', label: 'Catch', ...catchR });
      return out;
    }
    default:
      return [];
  }
}

/** Full geometry of a laid-out flow: positions, per-node heights, canvas size. */
export interface FlowLayoutGeometry {
  positions: Map<string, Point>;
  /** Rendered height of every node (`heightOf(node)`; {@link NODE_H} default). */
  heights: Map<string, number>;
  /** Bounding box of the diagram incl. node extents + {@link PADDING}. */
  size: { width: number; height: number };
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
 * - A node with a persisted manual position ({@link manualPosition}) overrides
 *   its computed slot, but is still included in the returned map so callers can
 *   size the canvas.
 *
 * #2670: cards are no longer necessarily {@link NODE_H} tall — an expanded
 * `loop`/`parallel`/`try_catch` container grows to embed its region(s), so
 * layer spacing is **cumulative**: each layer starts below the tallest
 * (auto-laid) card of the previous one. With the default constant `heightOf`
 * the output is IDENTICAL to the historical fixed-pitch layout (pinned by
 * tests). Manually-positioned nodes are excluded from a row's height (they don't
 * render in their computed slot; counting them would open phantom gaps) — so a
 * pinned node sitting at/below an expanded container can overlap it. Accepted
 * limitation: the author can drag it clear.
 */
export function computeLayoutWithGeometry(
  nodes: FlowDesignerNode[],
  edges: FlowDesignerEdge[],
  heightOf: (node: FlowDesignerNode) => number = () => NODE_H,
): FlowLayoutGeometry {
  const positions = new Map<string, Point>();
  const heights = new Map<string, number>(nodes.map((n) => [n.id, heightOf(n)]));
  if (nodes.length === 0) return { positions, heights, size: { width: PADDING, height: PADDING } };

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const indexOf = new Map(nodes.map((n, i) => [n.id, i]));
  const outAdj = new Map<string, string[]>();
  const incoming = new Map<string, number>();
  for (const n of nodes) incoming.set(n.id, 0);
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target) || e.source === e.target) continue;
    // ADR-0044: a declared back-edge (`type: 'back'`) re-enters an earlier node
    // to close a revise loop. Exclude it from layering — exactly as the engine
    // excludes it from DAG validation — so the loop doesn't drag its target
    // node below the wait point. The edge is still drawn (as a return arc).
    if (isBackEdge(e)) continue;
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

  // Place layers top-to-bottom with CUMULATIVE y: each layer starts below the
  // tallest auto-laid card of the previous occupied layer. Empty layer indices
  // (possible only in degenerate cyclic graphs) keep their historical
  // fixed-pitch gap so the constant-height output matches the old
  // `l * (NODE_H + V_GAP)` formula exactly.
  const sortedLayers = [...byLayer.keys()].sort((a, b) => a - b);
  let y = 0;
  let prevLayer: number | undefined;
  for (const l of sortedLayers) {
    if (prevLayer !== undefined) {
      y += (l - prevLayer - 1) * (NODE_H + V_GAP);
    }
    const ids = byLayer.get(l)!;
    const rowWidth = ids.length * NODE_W + (ids.length - 1) * H_GAP;
    const startX = -rowWidth / 2;
    let rowMaxHeight = NODE_H;
    ids.forEach((id, i) => {
      positions.set(id, { x: startX + i * (NODE_W + H_GAP), y });
      const n = byId.get(id);
      // Manually-positioned nodes don't render in this slot — exclude from the
      // row height so they can't open phantom gaps (see JSDoc caveat).
      if (n && !hasManualPosition(n)) {
        rowMaxHeight = Math.max(rowMaxHeight, heights.get(id) ?? NODE_H);
      }
    });
    y += rowMaxHeight + V_GAP;
    prevLayer = l;
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
    const manual = manualPosition(n);
    if (manual) {
      positions.set(n.id, { x: Math.max(0, manual.x), y: Math.max(0, manual.y) });
    }
  }

  // Bounding box with true per-node heights (manual nodes included).
  let maxX = 0;
  let maxY = 0;
  for (const [id, p] of positions) {
    maxX = Math.max(maxX, p.x + NODE_W);
    maxY = Math.max(maxY, p.y + (heights.get(id) ?? NODE_H));
  }
  return { positions, heights, size: { width: maxX + PADDING, height: maxY + PADDING } };
}

/**
 * Back-compat positions-only view of {@link computeLayoutWithGeometry} with
 * every card at the constant {@link NODE_H} — exactly the historical layout.
 */
export function computeLayout(nodes: FlowDesignerNode[], edges: FlowDesignerEdge[]): Map<string, Point> {
  return computeLayoutWithGeometry(nodes, edges).positions;
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

/**
 * Bottom-center anchor of a node — where its outgoing edges originate.
 * #2670: pass the node's rendered height for an expanded container so the edge
 * leaves from its true bottom; defaults to {@link NODE_H} (plain cards).
 */
export function bottomAnchor(p: Point, height: number = NODE_H): Point {
  return { x: p.x + NODE_W / 2, y: p.y + height };
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

/** True for an ADR-0044 declared back-edge (a revise/rework loop's return). */
export function isBackEdge(edge: Pick<FlowDesignerEdge, 'type'>): boolean {
  return edge.type === 'back';
}

/** Right-center anchor of a node — where a back-edge's return arc attaches. */
export function rightAnchor(p: Point): Point {
  return { x: p.x + NODE_W, y: p.y + NODE_H / 2 };
}

/** Horizontal bow of a back-edge's return arc, scaled to the vertical span. */
function backEdgeBow(from: Point, to: Point): number {
  return Math.max(64, Math.abs(to.y - from.y) * 0.35);
}

/**
 * Curved return path for a declared back-edge (ADR-0044 revise loop). Unlike a
 * forward edge (top→bottom), a back-edge re-enters an earlier node, so we route
 * it off the right side of both endpoints and bow it out to the right — a
 * distinct return arc that reads as "loop back" rather than crossing the
 * top-to-bottom forward edges.
 */
export function backEdgePath(from: Point, to: Point): string {
  const bow = backEdgeBow(from, to);
  const c1 = { x: from.x + bow, y: from.y };
  const c2 = { x: to.x + bow, y: to.y };
  return `M ${from.x},${from.y} C ${c1.x},${c1.y} ${c2.x},${c2.y} ${to.x},${to.y}`;
}

/** Anchor for a back-edge's label pill — the apex of its return arc. */
export function backEdgeLabelAnchor(from: Point, to: Point): Point {
  // The cubic's t=0.5 point sits ~0.75·bow right of the (shared) right edge.
  const bow = backEdgeBow(from, to);
  return { x: Math.max(from.x, to.x) + bow * 0.75, y: (from.y + to.y) / 2 };
}

/**
 * Stable identity for an edge. Prefers an explicit `edge.id`; otherwise falls
 * back to a `source->target#index` composite so an unsaved edge still has a
 * deterministic key. Used for selection, traversal highlighting, and inspector
 * lookup — all of which read the same `draft.edges` array, so the index is
 * consistent across them. Editing label/condition/isDefault never changes the
 * key (source/target/index are untouched), so a selection survives edits.
 */
export function edgeKey(edge: FlowDesignerEdge, index: number): string {
  return edge.id || `${edge.source}->${edge.target}#${index}`;
}

/**
 * The CEL source of an edge's optional guard — **the** reader for that field.
 *
 * Both authoring spellings resolve here: the bare string, and the ADR-0089
 * envelope that the spec's `ExpressionInputSchema` normalizes every authored
 * string INTO at parse time (so the envelope is what a persisted flow carries).
 * An envelope with only a compiled `ast` and no `source` (spec phase M9.2) has
 * no readable source yet, and says so rather than inventing text.
 *
 * Every consumer of `condition` goes through this function — canvas labels and
 * the inspector, the Branches↔edges reconciliation in
 * `inspectors/flow-decision-edges.ts`, AND the simulator (both its decision
 * routing and its preflight diagnostics). That is deliberate and load-bearing:
 * "how an edge guard is read" had four hand-rolled answers, two of which
 * (`simulator/flow-simulator.ts`, `simulator/flow-sim-validate.ts`) accepted
 * only the bare string and so reported a spec-canonical envelope as "no
 * condition" — the simulator skipped a branch the engine takes (objectui#3216).
 * Add a fifth spelling and that class of bug comes straight back; call this
 * instead.
 */
export function conditionText(c: FlowDesignerEdge['condition']): string | undefined {
  if (!c) return undefined;
  if (typeof c === 'string') return c;
  if (typeof c === 'object' && typeof c.source === 'string') return c.source;
  return undefined;
}
