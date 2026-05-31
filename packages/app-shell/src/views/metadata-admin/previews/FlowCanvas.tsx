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
import { Maximize2, Plus, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@object-ui/components';
import { uniqueId, appendArray, spliceArray } from '../inspectors/_shared';
import { t as tr } from '../i18n';
import {
  computeLayout,
  diagramSize,
  bottomAnchor,
  topAnchor,
  edgePath,
  edgeMidpoint,
  conditionText,
  NODE_H,
  V_GAP,
  type FlowNode,
  type FlowEdge,
  type Point,
} from './flow-canvas-layout';
import { NodeCard, NodePalette, defaultNodeLabel, defaultNodeExtras } from './flow-canvas-parts';
import { useFlowNodePalette } from './useFlowNodePalette';

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
  locale?: string;
  /** Simulation overlay: currently-executing node. */
  activeNodeId?: string | null;
  /** Simulation overlay: nodes already executed. */
  visitedNodeIds?: string[];
  /** Simulation overlay: ids of edges that were traversed. */
  traversedEdgeIds?: string[];
  onSelect: (node: FlowNode | null) => void;
  onPatch?: (partial: Record<string, unknown>) => void;
}

export function FlowCanvas({
  nodes,
  edges,
  editable,
  designMode,
  selectedId,
  locale,
  activeNodeId,
  visitedNodeIds,
  traversedEdgeIds,
  onSelect,
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
  const simRunning = (visitedNodeIds?.length ?? 0) > 0 || !!activeNodeId;

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
      const at =
        opts?.at ??
        (opts?.from
          ? (() => {
              const p = positionOf(opts.from);
              return { x: p.x, y: p.y + NODE_H + V_GAP };
            })()
          : undefined);
      const newNode: FlowNode = { id, type, label, ...defaultNodeExtras(type), ...(at ? { ui: { x: at.x, y: at.y } } : {}) };
      const nextNodes = appendArray(nodes, newNode);
      const patch: Record<string, unknown> = { nodes: nextNodes };
      if (opts?.from) {
        const newEdge: FlowEdge = {
          id: uniqueId('edge', edges.map((e) => e.id).filter(Boolean) as string[]),
          source: opts.from,
          target: id,
        };
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
    const z = clampZoom(Math.min(zx, zy, 1));
    setZoom(z);
    setPan({
      x: (vp.clientWidth - size.width * z) / 2,
      y: Math.max(16, (vp.clientHeight - size.height * z) / 2),
    });
  }, [size.height, size.width]);

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
      {/* Toolbar */}
      <div className="absolute right-2 top-2 z-30 flex items-center gap-1">
        {editable && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setPaletteOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent"
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
        <div className="flex items-center rounded-md border bg-background shadow-sm">
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
          'bg-[radial-gradient(circle_at_1px_1px,theme(colors.border)_1px,transparent_0)] [background-size:16px_16px] bg-muted/20',
        )}
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
                <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground/60" />
              </marker>
            </defs>
            {edges.map((edge, i) => {
              const sp = layout.get(edge.source);
              const tp = layout.get(edge.target);
              if (!sp || !tp) return null;
              const from = bottomAnchor(dragPos?.id === edge.source ? positionOf(edge.source) : sp);
              const to = topAnchor(dragPos?.id === edge.target ? positionOf(edge.target) : tp);
              const mid = edgeMidpoint(from, to);
              const cond = conditionText(edge.condition);
              const branchLabel = edge.isDefault ? 'else' : cond ? `if ${cond}` : edge.label;
              const eid = edge.id || `${edge.source}->${edge.target}#${i}`;
              const traversed = traversedSet.has(eid);
              return (
                <g key={edge.id || `${edge.source}-${edge.target}-${i}`}>
                  <path
                    d={edgePath(from, to)}
                    className={cn(
                      'fill-none',
                      traversed ? 'stroke-sky-500' : simRunning ? 'stroke-muted-foreground/25' : 'stroke-muted-foreground/50',
                    )}
                    strokeWidth={traversed ? 2.5 : 1.5}
                    markerEnd="url(#flow-arrow)"
                  />
                  {branchLabel && (
                    <foreignObject x={mid.x - 60} y={mid.y - 11} width={120} height={22}>
                      <div className="flex justify-center">
                        <span className="max-w-full truncate rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm">
                          {branchLabel}
                        </span>
                      </div>
                    </foreignObject>
                  )}
                  {editable && (
                    <foreignObject
                      x={mid.x - 11}
                      y={mid.y - 11}
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
                        className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border bg-background text-muted-foreground opacity-60 shadow-sm transition-all hover:scale-110 hover:border-primary hover:text-primary hover:opacity-100 focus-visible:opacity-100"
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

