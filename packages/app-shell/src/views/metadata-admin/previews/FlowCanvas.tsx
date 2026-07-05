// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FlowCanvas — an industry-standard visual flowchart designer for flow
 * automation metadata (mirrors Power Automate / Salesforce Flow Builder).
 *
 * Dependency-free: no reactflow/@xyflow. Nodes are absolutely-positioned
 * Shadcn cards over an SVG edge layer, laid out top-to-bottom by a
 * deterministic layered algorithm (`flow-canvas-layout`). Authors can:
 *
 *   - drag to reposition nodes (committed to `node.ui = {x,y}` on drop),
 *   - add nodes from a palette (toolbar or a node's bottom "+" handle),
 *   - insert a node on an edge ("+" at the edge midpoint splits A→B),
 *   - delete the selected node (Delete/Backspace) with full edge cleanup,
 *   - pan (background drag) and zoom / fit-to-view.
 *
 * Selection is delegated to the existing FlowNodeInspector via
 * onSelectionChange — the canvas never duplicates the inspector.
 *
 * The component is a pure renderer of `draft`; all mutations go through
 * `onPatch(partial)` and the host merges + persists.
 */

import * as React from 'react';
import { AlertCircle, AlertTriangle, Maximize2, Plus, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@object-ui/components';
import { uniqueId, appendArray, spliceArray } from '../inspectors/_shared';
import { t as tr } from '../i18n';
import {
  computeLayout,
  diagramSize,
  NODE_W,
  NODE_H,
  bottomAnchor,
  topAnchor,
  rightAnchor,
  edgePath,
  edgeMidpoint,
  backEdgePath,
  backEdgeLabelAnchor,
  isBackEdge,
  edgeKey,
  conditionText,
  type FlowNode,
  type FlowEdge,
  type Point,
} from './flow-canvas-layout';
import { NodeCard, NodePalette, defaultNodeLabel, defaultNodeExtras } from './flow-canvas-parts';
import { useFlowNodePalette } from './useFlowNodePalette';
import { indexProblemBadges, edgeProblemKey, type FlowProblem } from './flow-problems';

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.6;
const DRAG_THRESHOLD = 4;

interface DragState {
  nodeId: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
}

interface PanState {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

export interface FlowCanvasProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  editable: boolean;
  designMode: boolean;
  selectedId: string | null;
  /** Stable key (see `edgeKey`) of the currently-selected edge, or null. */
  selectedEdgeId?: string | null;
  locale?: string;
  /** Simulation overlay: currently-executing node. */
  activeNodeId?: string | null;
  /** Simulation overlay: nodes already executed. */
  visitedNodeIds?: string[];
  /** Simulation overlay: ids of edges that were traversed. */
  traversedEdgeIds?: string[];
  /** Structural-validation: node ids to paint with a red error ring. */
  invalidNodeIds?: string[];
  /** Structural-validation: edges (keyed `${source}->${target}`) to paint red. */
  invalidEdges?: ReadonlySet<string>;
  /**
   * Select + reveal a problem when its inline-banner row is clicked — wired to
   * the same handler the Problems panel uses, so the always-visible banner is
   * actionable without opening the panel.
   */
  onRevealProblem?: (problem: FlowProblem) => void;
  /**
   * Unified validation issues (structural + server) rendered as per-element
   * badges; the Problems panel shares the same list.
   */
  problems?: FlowProblem[];
  /**
   * Imperative "reveal" request from the Problems panel: when `nonce` changes
   * the canvas pans to center the targeted node/edge. Selection highlight is
   * driven separately via `selectedId` / `selectedEdgeId`.
   */
  revealSignal?: { target: FlowProblem['target']; nonce: number } | null;
  onSelect: (node: FlowNode | null) => void;
  /** Select an edge (its `edgeKey`), or clear selection with `null`. */
  onSelectEdge?: (edge: FlowEdge | null, key: string) => void;
  onPatch?: (partial: Record<string, unknown>) => void;
}

export function FlowCanvas({
  nodes,
  edges,
  editable,
  designMode,
  selectedId,
  selectedEdgeId,
  locale,
  activeNodeId,
  visitedNodeIds,
  traversedEdgeIds,
  invalidNodeIds,
  invalidEdges,
  onRevealProblem,
  problems,
  revealSignal,
  onSelect,
  onSelectEdge,
  onPatch,
}: FlowCanvasProps) {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState<Point>({ x: 0, y: 0 });
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  // Node types offered by the add-node palette, driven by the engine's
  // published descriptors (`GET /api/v1/automation/actions`) merged with the
  // hardcoded base — so the palette reflects what the backend actually supports
  // (e.g. the `approval` node, third-party connector actions).
  const paletteItems = useFlowNodePalette();

  // Transient drag position override (commit-on-drop) so rapid pointer moves
  // never spam onPatch and never diverge from the persisted draft.
  const [dragPos, setDragPos] = React.useState<{ id: string; x: number; y: number } | null>(null);
  const dragRef = React.useRef<DragState | null>(null);
  const panRef = React.useRef<PanState | null>(null);

  const layout = React.useMemo(() => computeLayout(nodes, edges), [nodes, edges]);
  const size = React.useMemo(() => diagramSize(layout), [layout]);

  // Simulation overlay sets (display-only; never drives engine behavior).
  const visitedSet = React.useMemo(() => new Set(visitedNodeIds ?? []), [visitedNodeIds]);
  const traversedSet = React.useMemo(() => new Set(traversedEdgeIds ?? []), [traversedEdgeIds]);
  const invalidNodeSet = React.useMemo(() => new Set(invalidNodeIds ?? []), [invalidNodeIds]);
  const simRunning = (visitedNodeIds?.length ?? 0) > 0 || !!activeNodeId;

  // Per-element validation badges (errors dominate warnings on the same
  // element). Derived from the live `problems` list so badges clear as issues
  // are resolved.
  const { byNode: nodeBadges, byEdge: edgeBadges } = React.useMemo(
    () => indexProblemBadges(problems ?? []),
    [problems],
  );

  // Error-level problems shown in the always-visible inline banner — driven by
  // the same `problems` list as the panel/badges so the three stay in lock-step.
  const bannerErrors = React.useMemo(() => (problems ?? []).filter((p) => p.level === 'error'), [problems]);

  const positionOf = React.useCallback(
    (id: string): Point => {
      if (dragPos && dragPos.id === id) return { x: dragPos.x, y: dragPos.y };
      return layout.get(id) ?? { x: 0, y: 0 };
    },
    [dragPos, layout],
  );

  // ── Mutations ────────────────────────────────────────────────────────────

  const persistPosition = React.useCallback(
    (id: string, x: number, y: number) => {
      if (!onPatch) return;
      const idx = nodes.findIndex((n) => n.id === id);
      if (idx < 0) return;
      const node = nodes[idx];
      const nextNode: FlowNode = { ...node, ui: { ...(node.ui ?? {}), x, y } };
      onPatch({ nodes: spliceArray(nodes, idx, nextNode) });
    },
    [nodes, onPatch],
  );

  const addNode = React.useCallback(
    (type: string, opts?: { from?: string; at?: Point }) => {
      if (!onPatch) return;
      const existing = nodes.map((n) => n.id).filter(Boolean) as string[];
      const id = uniqueId('node', existing);
      const label = type === 'end' ? 'End' : defaultNodeLabel(type);
      // Only an explicit `at` pins a manual position. A `from`-append is left
      // unpinned so the layered auto-layout slots it below its parent and
      // spaces it horizontally among siblings — pinning it directly under the
      // parent (the old behavior) made every sibling stack on the same spot.
      const at = opts?.at;
      const newNode: FlowNode = { id, type, label, ...defaultNodeExtras(type), ...(at ? { ui: { x: at.x, y: at.y } } : {}) };
      const nextNodes = appendArray(nodes, newNode);
      const patch: Record<string, unknown> = { nodes: nextNodes };
      if (opts?.from) {
        const newEdge: FlowEdge = {
          id: uniqueId('edge', edges.map((e) => e.id).filter(Boolean) as string[]),
          source: opts.from,
          target: id,
        };
        // When the source is a decision, carry its matching branch (by order:
        // the k-th out-edge takes the k-th branch) onto the new edge so it
        // actually routes. The decision's config.conditions are otherwise
        // disconnected from the edges, leaving every branch unconditional.
        const fromNode = nodes.find((n) => n.id === opts.from);
        if (fromNode?.type === 'decision') {
          const branches = Array.isArray(fromNode.config?.conditions)
            ? (fromNode.config!.conditions as Array<Record<string, unknown>>)
            : [];
          const outCount = edges.filter((e) => e.source === opts.from).length;
          const branch = branches[outCount];
          if (branch && typeof branch === 'object') {
            const expr = typeof branch.expression === 'string' ? branch.expression.trim() : '';
            const label = typeof branch.label === 'string' ? branch.label.trim() : '';
            if (label) newEdge.label = label;
            if (expr === 'true') newEdge.isDefault = true;
            else if (expr) newEdge.condition = expr;
          }
        }
        patch.edges = appendArray(edges, newEdge);
      }
      onPatch(patch);
      onSelect(newNode);
      setPaletteOpen(false);
    },
    [edges, nodes, onPatch, onSelect, positionOf],
  );

  /** Split edge A→B by inserting a new node N: A→N (keeps guard) + N→B. */
  const insertOnEdge = React.useCallback(
    (edge: FlowEdge, type = 'create_record') => {
      if (!onPatch) return;
      const edgeIdx = edges.findIndex((e) => e === edge);
      if (edgeIdx < 0) return;
      const existing = nodes.map((n) => n.id).filter(Boolean) as string[];
      const id = uniqueId('node', existing);
      const from = positionOf(edge.source);
      const to = positionOf(edge.target);
      const at = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      const newNode: FlowNode = {
        id,
        type,
        label: defaultNodeLabel(type),
        ...defaultNodeExtras(type),
        ui: { x: at.x, y: at.y },
      };
      // A→N inherits the original edge's branch semantics; N→B is plain.
      const firstSegment: FlowEdge = { ...edge, target: id };
      const secondSegment: FlowEdge = {
        id: uniqueId('edge', [...edges.map((e) => e.id).filter(Boolean) as string[], 'edge']),
        source: id,
        target: edge.target,
      };
      const nextEdges = spliceArray(edges, edgeIdx, firstSegment);
      onPatch({ nodes: appendArray(nodes, newNode), edges: appendArray(nextEdges, secondSegment) });
      onSelect(newNode);
    },
    [edges, nodes, onPatch, onSelect, positionOf],
  );

  /**
   * ADR-0044 one-click "add revision loop": drop a signal `wait` node plus the
   * two edges that form a send-back-for-revision loop on an approval node —
   * a `revise` out-edge to the wait point, and a declared `back`-edge closing
   * the loop (resubmit re-enters the approval node as round N+1). Reproduces the
   * canonical `showcase_budget_approval` shape in a single gesture. The wait
   * node is left unpinned so the layered auto-layout slots it among the
   * approval node's other branches.
   */
  const addReviseLoop = React.useCallback(
    (approvalId: string) => {
      if (!onPatch) return;
      if (!nodes.some((n) => n.id === approvalId)) return;
      const waitId = uniqueId('node', nodes.map((n) => n.id).filter(Boolean) as string[]);
      const waitNode: FlowNode = {
        id: waitId,
        type: 'wait',
        label: 'Awaiting Revision',
        // Signal-flavored wait: the submitter's resubmit signal resumes the run.
        waitEventConfig: { eventType: 'signal', signalName: 'revision', onTimeout: 'fail' },
      };
      const existingEdgeIds = edges.map((e) => e.id).filter(Boolean) as string[];
      const reviseId = uniqueId('edge', existingEdgeIds);
      const backId = uniqueId('edge', [...existingEdgeIds, reviseId]);
      const reviseEdge: FlowEdge = { id: reviseId, source: approvalId, target: waitId, label: 'revise' };
      const backEdge: FlowEdge = { id: backId, source: waitId, target: approvalId, label: 'resubmit', type: 'back' };
      onPatch({
        nodes: appendArray(nodes, waitNode),
        edges: appendArray(appendArray(edges, reviseEdge), backEdge),
      });
      onSelect(waitNode);
    },
    [edges, nodes, onPatch, onSelect],
  );

  // Approval nodes that already declare a `revise` out-edge — used to hide the
  // "add revision loop" affordance once a loop exists (avoid duplicates).
  const reviseLoopSources = React.useMemo(() => {
    const s = new Set<string>();
    for (const e of edges) {
      if (typeof e.label === 'string' && e.label.trim().toLowerCase() === 'revise') s.add(e.source);
    }
    return s;
  }, [edges]);

  const deleteNode = React.useCallback(
    (id: string) => {
      if (!onPatch) return;
      const nextNodes = nodes.filter((n) => n.id !== id);
      const nextEdges = edges.filter((e) => e.source !== id && e.target !== id);
      onPatch({ nodes: nextNodes, edges: nextEdges });
      onSelect(null);
    },
    [edges, nodes, onPatch, onSelect],
  );

  // ── Drag (reposition) — pointer capture, commit on pointer-up ──────────────

  const onNodePointerDown = React.useCallback(
    (id: string) => (e: React.PointerEvent) => {
      if (!editable || e.button !== 0) return;
      e.stopPropagation();
      const origin = positionOf(id);
      dragRef.current = {
        nodeId: id,
        startX: e.clientX,
        startY: e.clientY,
        originX: origin.x,
        originY: origin.y,
        moved: false,
      };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [editable, positionOf],
  );

  const onNodePointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (e.clientX - d.startX) / zoom;
      const dy = (e.clientY - d.startY) / zoom;
      if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD) {
        return;
      }
      d.moved = true;
      setDragPos({ id: d.nodeId, x: Math.max(0, d.originX + dx), y: Math.max(0, d.originY + dy) });
    },
    [zoom],
  );

  const onNodePointerUp = React.useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      if (!d) return;
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      if (d.moved && dragPos) {
        persistPosition(d.nodeId, Math.round(dragPos.x), Math.round(dragPos.y));
      }
      setDragPos(null);
    },
    [dragPos, persistPosition],
  );

  // ── Pan (background drag) ──────────────────────────────────────────────────

  const onBgPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      onSelect(null);
      panRef.current = { startX: e.clientX, startY: e.clientY, originX: pan.x, originY: pan.y };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [onSelect, pan.x, pan.y],
  );

  const onBgPointerMove = React.useCallback((e: React.PointerEvent) => {
    const p = panRef.current;
    if (!p) return;
    setPan({ x: p.originX + (e.clientX - p.startX), y: p.originY + (e.clientY - p.startY) });
  }, []);

  const onBgPointerUp = React.useCallback((e: React.PointerEvent) => {
    if (panRef.current) (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    panRef.current = null;
  }, []);

  // ── Zoom / fit ─────────────────────────────────────────────────────────────

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  const fitToView = React.useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const pad = 32;
    const zx = (vp.clientWidth - pad) / size.width;
    const zy = (vp.clientHeight - pad) / size.height;
    // No `, 1` cap here: clampZoom already bounds this to MAX_ZOOM (1.6). A
    // small flow (most flows are 2-4 linear nodes) used to freeze at 100% —
    // fit-to-view should actually fit, i.e. zoom IN to use the available
    // canvas, not just center a tiny diagram in a sea of blank space.
    const z = clampZoom(Math.min(zx, zy));
    setZoom(z);
    setPan({
      x: (vp.clientWidth - size.width * z) / 2,
      y: Math.max(16, (vp.clientHeight - size.height * z) / 2),
    });
  }, [size.height, size.width]);

  // Center the diagram at 100% on mount so opening a flow shows a familiar 1:1
  // scale with the diagram centered — rather than an auto-fit that zoomed small
  // (2-4 node) flows up to 160%. Centering (not pan-{0,0}) keeps the diagram
  // from being stranded in a corner. Authors can still zoom / fit-to-view from
  // the toolbar. Deliberately mount-only (not re-run on every `size` change):
  // re-centering on every node add/drag would yank the viewport out from under
  // an actively editing user.
  React.useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    setZoom(1);
    setPan({
      x: (vp.clientWidth - size.width) / 2,
      y: Math.max(16, (vp.clientHeight - size.height) / 2),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pan to center an element when the Problems panel asks to reveal it. Driven
  // by a changing `nonce` so re-clicking the same problem re-centers it.
  React.useEffect(() => {
    if (!revealSignal) return;
    const vp = viewportRef.current;
    if (!vp) return;
    const t = revealSignal.target;
    let pt: Point | null = null;
    if (t.kind === 'node') {
      const p = layout.get(t.nodeId);
      if (p) pt = { x: p.x + NODE_W / 2, y: p.y + NODE_H / 2 };
    } else if (t.kind === 'edge') {
      const s = layout.get(t.source);
      const d = layout.get(t.target);
      if (s && d) pt = { x: (s.x + d.x) / 2 + NODE_W / 2, y: (s.y + d.y) / 2 + NODE_H / 2 };
    }
    if (pt) setPan({ x: vp.clientWidth / 2 - pt.x * zoom, y: vp.clientHeight / 2 - pt.y * zoom });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealSignal?.nonce]);

  // ── Keyboard: delete selected node ─────────────────────────────────────────

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!editable || !selectedId) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        e.preventDefault();
        deleteNode(selectedId);
      }
    },
    [deleteNode, editable, selectedId],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="relative h-full min-h-[320px] w-full overflow-hidden">
      {/* Inline structural-validation banner (ADR-0044 cycle surfacing): shows
          errors directly on the canvas so the author needn't open Debug. Each row
          with a concrete target is clickable — it selects + pans to the offending
          node/edge (the same reveal the Problems panel does). */}
      {bannerErrors.length > 0 && (
        <div className="absolute left-2 top-2 z-30 max-w-[min(60%,420px)] space-y-1">
          {bannerErrors.slice(0, 3).map((p) => {
            const clickable = !!onRevealProblem && p.target.kind !== 'flow';
            return (
              <button
                key={p.id}
                type="button"
                role="alert"
                disabled={!clickable}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={clickable ? (e) => { e.stopPropagation(); onRevealProblem!(p); } : undefined}
                title={clickable ? 'Reveal on canvas' : undefined}
                className={cn(
                  'flex w-full items-start gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-left text-[11px] leading-snug text-destructive shadow-sm backdrop-blur-sm transition-colors',
                  clickable && 'cursor-pointer hover:border-destructive/60 hover:bg-destructive/20',
                )}
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{p.message}</span>
              </button>
            );
          })}
          {bannerErrors.length > 3 && (
            <div className="px-2.5 text-[10px] text-destructive/80">+{bannerErrors.length - 3} more…</div>
          )}
        </div>
      )}
      {/* Toolbar */}
      <div className="absolute right-2 top-2 z-30 flex items-center gap-1.5">
        {editable && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setPaletteOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border bg-background/90 px-2.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm transition-colors hover:border-primary/50 hover:bg-accent hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              {tr('engine.inspector.add.node', locale)}
            </button>
            {paletteOpen && (
              <NodePalette
                locale={locale}
                items={paletteItems}
                onClose={() => setPaletteOpen(false)}
                onPick={(type) => addNode(type, { from: selectedId ?? undefined })}
              />
            )}
          </div>
        )}
        <div className="flex items-center rounded-lg border bg-background/90 shadow-sm backdrop-blur-sm">
          <button
            type="button"
            title="Zoom out"
            aria-label="Zoom out"
            onClick={() => setZoom((z) => clampZoom(z - 0.15))}
            className="inline-flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="w-10 text-center text-[11px] tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            title="Zoom in"
            aria-label="Zoom in"
            onClick={() => setZoom((z) => clampZoom(z + 0.15))}
            className="inline-flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Fit to view"
            aria-label="Fit to view"
            onClick={fitToView}
            className="inline-flex h-7 w-7 items-center justify-center border-l text-muted-foreground hover:text-foreground"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Viewport */}
      <div
        ref={viewportRef}
        tabIndex={0}
        role="application"
        aria-label="Flow canvas"
        onKeyDown={onKeyDown}
        onPointerDown={onBgPointerDown}
        onPointerMove={(e) => {
          onBgPointerMove(e);
          onNodePointerMove(e);
        }}
        onPointerUp={(e) => {
          onBgPointerUp(e);
          onNodePointerUp(e);
        }}
        className={cn(
          'h-full w-full cursor-grab outline-none active:cursor-grabbing',
          'bg-muted/15 dark:bg-background/30',
          // Subtle inset vignette gives the canvas surface depth.
          'shadow-[inset_0_0_90px_rgba(0,0,0,0.05)]',
        )}
        style={{
          // Dot grid tied to pan + zoom so the surface tracks the diagram
          // (rather than floating behind a static texture).
          backgroundImage:
            'radial-gradient(circle at 1px 1px, hsl(var(--border)) 1px, transparent 0)',
          backgroundSize: `${18 * zoom}px ${18 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        <div
          className="relative origin-top-left"
          style={{
            width: size.width,
            height: size.height,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* Edge layer */}
          <svg
            className="pointer-events-none absolute left-0 top-0 overflow-visible"
            width={size.width}
            height={size.height}
          >
            <defs>
              <marker
                id="flow-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground/55" />
              </marker>
              {/* Distinct amber arrowhead for ADR-0044 back-edges (revise loop). */}
              <marker
                id="flow-arrow-back"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" className="fill-amber-500/80" />
              </marker>
              {/* Red arrowhead for edges flagged by structural validation. */}
              <marker
                id="flow-arrow-error"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" className="fill-destructive" />
              </marker>
            </defs>
            {edges.map((edge, i) => {
              const sp = layout.get(edge.source);
              const tp = layout.get(edge.target);
              if (!sp || !tp) return null;
              // ADR-0044 back-edges (revise loop) re-enter an earlier node, so
              // they attach to the right side of both endpoints and render as a
              // dashed amber return arc — visually distinct from the forward
              // top-to-bottom flow.
              const back = isBackEdge(edge);
              // Structural-validation error (e.g. part of an un-declared cycle).
              // Back-edges are excluded from cycle detection, so they're never invalid.
              const invalid = !back && !!invalidEdges?.has(`${edge.source}->${edge.target}`);
              const sPos = dragPos?.id === edge.source ? positionOf(edge.source) : sp;
              const tPos = dragPos?.id === edge.target ? positionOf(edge.target) : tp;
              const from = back ? rightAnchor(sPos) : bottomAnchor(sPos);
              const to = back ? rightAnchor(tPos) : topAnchor(tPos);
              const labelPos = back ? backEdgeLabelAnchor(from, to) : edgeMidpoint(from, to);
              const cond = conditionText(edge.condition);
              const branchLabel = edge.isDefault ? 'else' : cond ? `if ${cond}` : edge.label;
              const eid = edgeKey(edge, i);
              const edgeBadge = edgeBadges.get(edgeProblemKey(edge.source, edge.target));
              const traversed = traversedSet.has(eid);
              const selected = selectedEdgeId === eid;
              const d = back ? backEdgePath(from, to) : edgePath(from, to);
              // Edges are selectable in design mode; the host opens the edge
              // inspector. A wide transparent hit-path widens the click target
              // beyond the 1.5px visible stroke without altering the visuals.
              const selectable = designMode && !!onSelectEdge;
              return (
                <g key={edge.id || `${edge.source}-${edge.target}-${i}`} data-invalid={invalid || undefined}>
                  <path
                    d={d}
                    strokeLinecap="round"
                    strokeDasharray={back ? '5 4' : undefined}
                    className={cn(
                      'fill-none transition-[stroke] duration-150',
                      traversed
                        ? 'stroke-sky-500'
                        : selected
                          ? 'stroke-primary'
                          : invalid
                            ? 'stroke-destructive'
                            : back
                              ? 'stroke-amber-500/70'
                              : simRunning
                                ? 'stroke-muted-foreground/20'
                                : 'stroke-muted-foreground/40',
                    )}
                    strokeWidth={traversed || selected || invalid ? 2.5 : 1.75}
                    markerEnd={invalid ? 'url(#flow-arrow-error)' : back ? 'url(#flow-arrow-back)' : 'url(#flow-arrow)'}
                  />
                  {selectable && (
                    <path
                      d={d}
                      className="pointer-events-auto cursor-pointer fill-none stroke-transparent"
                      strokeWidth={14}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEdge!(edge, eid);
                      }}
                    >
                      <title>{invalid ? `${edge.source} → ${edge.target} — part of an un-declared cycle; mark the edge that closes the loop as a back-edge` : back ? `${edge.source} ↩ ${edge.target} (back-edge)` : `${edge.source} → ${edge.target}`}</title>
                    </path>
                  )}
                  {branchLabel && (
                    <foreignObject
                      x={labelPos.x - 60}
                      y={labelPos.y - 11}
                      width={120}
                      height={22}
                      className={cn(selectable && 'pointer-events-auto')}
                    >
                      <div className="flex justify-center">
                        <span
                          onPointerDown={selectable ? (e) => e.stopPropagation() : undefined}
                          onClick={selectable ? (e) => { e.stopPropagation(); onSelectEdge!(edge, eid); } : undefined}
                          className={cn(
                            'max-w-full truncate rounded-full border bg-background/95 px-2 py-0.5 text-[10px] font-medium shadow-sm backdrop-blur-sm transition-colors',
                            selectable && 'cursor-pointer hover:border-primary/60',
                            selected
                              ? 'border-primary text-primary'
                              : invalid
                                ? 'border-destructive/60 text-destructive'
                                : back
                                  ? 'border-amber-500/50 text-amber-600 dark:text-amber-400'
                                  : 'border-border text-muted-foreground',
                          )}
                        >
                          {branchLabel}
                        </span>
                      </div>
                    </foreignObject>
                  )}
                  {edgeBadge && (
                    <foreignObject
                      x={labelPos.x - 9}
                      y={labelPos.y - 30}
                      width={18}
                      height={18}
                      className="pointer-events-auto overflow-visible"
                    >
                      <span
                        title={edgeBadge.title}
                        data-problem={edgeBadge.level}
                        className={cn(
                          'inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border bg-background shadow-sm',
                          edgeBadge.level === 'error'
                            ? 'border-destructive/50 text-destructive'
                            : 'border-amber-500/50 text-amber-600 dark:text-amber-400',
                        )}
                      >
                        {edgeBadge.level === 'error' ? (
                          <AlertCircle className="h-3 w-3" />
                        ) : (
                          <AlertTriangle className="h-3 w-3" />
                        )}
                      </span>
                    </foreignObject>
                  )}
                  {editable && !back && (
                    <foreignObject
                      // Sit the insert handle at the edge midpoint, but slide it
                      // to the right of the branch-label pill when one is present
                      // so the two don't stack on the same spot.
                      x={branchLabel ? labelPos.x + 66 : labelPos.x - 11}
                      y={labelPos.y - 11}
                      width={22}
                      height={22}
                      className="pointer-events-auto"
                    >
                      <button
                        type="button"
                        title="Insert node here"
                        aria-label="Insert node here"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          insertOnEdge(edge);
                        }}
                        className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border bg-background/90 text-muted-foreground opacity-50 shadow-sm backdrop-blur-sm transition-all hover:scale-110 hover:border-primary hover:bg-background hover:text-primary hover:opacity-100 focus-visible:opacity-100"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </foreignObject>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Node layer */}
          {nodes.map((node) => {
            const runState = activeNodeId === node.id ? 'active' : visitedSet.has(node.id) ? 'visited' : undefined;
            return (
              <NodeCard
                key={node.id}
                id={node.id}
                type={node.type}
                label={node.label || node.id}
                summary={nodeSummary(node)}
                position={positionOf(node.id)}
                selected={selectedId === node.id}
                editable={editable}
                runState={runState}
                dimmed={simRunning && !runState}
                onPointerDown={onNodePointerDown(node.id)}
                onSelect={() => designMode && onSelect(node)}
                onAppend={() => addNode('create_record', { from: node.id })}
                onAddReviseLoop={
                  editable && node.type === 'approval' && !reviseLoopSources.has(node.id)
                    ? () => addReviseLoop(node.id)
                    : undefined
                }
                invalid={invalidNodeSet.has(node.id)}
                badge={nodeBadges.get(node.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** One-line config summary shown on the node card (best-effort, type-aware). */
function nodeSummary(node: FlowNode): string | undefined {
  const c = node.config as Record<string, unknown> | undefined;
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  const block = (key: string, inner: string) => {
    const b = (node as Record<string, unknown>)[key];
    return b && typeof b === 'object' ? str((b as Record<string, unknown>)[inner]) : undefined;
  };
  const pick = (k: string) => (c ? str(c[k]) : undefined);
  if (node.type === 'start') {
    return pick('condition') || pick('criteria') || pick('objectName') || pick('cron') || pick('schedule') || pick('triggerType');
  }
  if (node.type === 'decision') {
    const conds = c?.conditions;
    if (Array.isArray(conds) && conds.length) {
      const labels = conds
        .map((x) => (x && typeof x === 'object' ? str((x as Record<string, unknown>).label) : undefined))
        .filter(Boolean);
      return labels.length ? labels.join(' / ') : `${conds.length} branches`;
    }
    return pick('condition');
  }
  if (node.type === 'script') {
    return pick('actionType') || pick('template') || (c && c.script ? 'code' : undefined);
  }
  if (node.type === 'approval') {
    const approvers = c?.approvers;
    const n = Array.isArray(approvers) ? approvers.length : 0;
    const behavior = pick('behavior');
    if (n > 0) return `${n} approver${n === 1 ? '' : 's'}${behavior === 'unanimous' ? ' · all' : ''}`;
    return behavior || undefined;
  }
  return (
    pick('objectName') ||
    block('connectorConfig', 'actionId') ||
    block('waitEventConfig', 'timerDuration') ||
    block('waitEventConfig', 'eventType') ||
    block('boundaryConfig', 'eventType') ||
    pick('condition') ||
    pick('flowName') ||
    pick('url') ||
    pick('collection') ||
    pick('action') ||
    pick('flow') ||
    pick('event') ||
    pick('duration') ||
    undefined
  );
}

