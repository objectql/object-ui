// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * flow-region-view — read-only rendering of a structured control-flow region
 * (ADR-0031 `loop.body` / `parallel.branches[]` / `try_catch.try`/`catch`) as a
 * nested mini-canvas inside its container's card on the flow designer canvas
 * (#2670, Phase 1).
 *
 * It reuses the top-level canvas layout math (`computeLayout` / `diagramSize` /
 * `edgePath`) at full scale, then fits the whole region into the container's
 * width with a single CSS `scale` transform — so there is **no new layout
 * engine**, and a region reads as the same top-to-bottom flow as the parent
 * graph. Read-only: no drag / insert; a nested container inside a region renders
 * as a plain box (recursive on-canvas expansion is a later increment).
 */

import * as React from 'react';
import { cn } from '@object-ui/components';
import {
  computeLayout,
  diagramSize,
  edgePath,
  bottomAnchor,
  topAnchor,
  isBackEdge,
  rightAnchor,
  backEdgePath,
  NODE_W,
  NODE_H,
  type FlowNode,
  type LabeledRegion,
} from './flow-canvas-layout';
import { NodeTypeIcon, nodeTone } from './flow-canvas-parts';
import { REGION_BLOCK_PAD, REGION_GAP, REGION_LABEL_H } from './flow-region-metrics';

/** Read-only node box inside a region — a compact echo of `NodeCard`. */
function RegionNode({ node, x, y }: { node: FlowNode; x: number; y: number }) {
  const tone = nodeTone(node.type);
  return (
    <div
      className="absolute flex items-center gap-2 rounded-lg border border-border/70 bg-card px-2 py-1.5 shadow-sm"
      style={{ left: x, top: y, width: NODE_W, height: NODE_H }}
    >
      <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', tone.chip)}>
        <NodeTypeIcon type={node.type} className={cn('h-4 w-4', tone.icon)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-semibold leading-tight text-foreground" title={node.label || node.id}>
          {node.label || node.id}
        </div>
        <div className={cn('text-[10px] font-semibold uppercase tracking-[0.08em]', tone.label)}>{node.type}</div>
      </div>
    </div>
  );
}

/** One region laid out with the shared engine, then scaled to fit `maxWidth`. */
function RegionCanvas({ region, maxWidth }: { region: LabeledRegion; maxWidth: number }) {
  const layout = React.useMemo(() => computeLayout(region.nodes, region.edges), [region.nodes, region.edges]);
  const { width, height } = React.useMemo(() => diagramSize(layout), [layout]);
  const scale = Math.min(1, maxWidth / Math.max(width, 1));
  return (
    <div className="relative" style={{ width: width * scale, height: height * scale }}>
      <div
        className="absolute left-0 top-0"
        style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={width} height={height}>
          {region.edges.map((edge, i) => {
            const sp = layout.get(edge.source);
            const tp = layout.get(edge.target);
            if (!sp || !tp) return null;
            const back = isBackEdge(edge);
            const from = back ? rightAnchor(sp) : bottomAnchor(sp);
            const to = back ? rightAnchor(tp) : topAnchor(tp);
            return (
              <path
                key={edge.id || `${edge.source}-${edge.target}-${i}`}
                d={back ? backEdgePath(from, to) : edgePath(from, to)}
                strokeDasharray={back ? '5 4' : undefined}
                className={cn('fill-none', back ? 'stroke-amber-500/60' : 'stroke-muted-foreground/40')}
                strokeWidth={1.5}
              />
            );
          })}
        </svg>
        {region.nodes.map((n) => {
          const p = layout.get(n.id);
          return p ? <RegionNode key={n.id} node={n} x={p.x} y={p.y} /> : null;
        })}
      </div>
    </div>
  );
}

/**
 * Render a container's nested regions read-only, each fit to `maxWidth`, with a
 * header per region (`Branch N` / `Try` / `Catch`; a loop body has no header).
 */
export function FlowRegionView({ regions, maxWidth }: { regions: LabeledRegion[]; maxWidth: number }) {
  // #2670: every dimension in this height stack is an explicit px from
  // flow-region-metrics so the layout height PREDICTOR matches the DOM exactly
  // (rem-based Tailwind spacing and font-metric line-heights would drift).
  return (
    <div className="flex flex-col" style={{ gap: REGION_GAP }}>
      {regions.map((region) => (
        <div
          key={region.key}
          className="rounded-md border border-dashed border-border/60 bg-muted/20"
          style={{ padding: REGION_BLOCK_PAD }}
        >
          {region.label && (
            <div
              className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/80"
              style={{ height: REGION_LABEL_H, lineHeight: '12px', paddingBottom: 4 }}
            >
              {region.label}
            </div>
          )}
          <RegionCanvas region={region} maxWidth={maxWidth} />
        </div>
      ))}
    </div>
  );
}
