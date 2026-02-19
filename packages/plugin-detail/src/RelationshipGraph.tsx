/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn, Card, CardHeader, CardTitle, CardContent } from '@object-ui/components';
import { Network } from 'lucide-react';

export interface GraphNode {
  id: string;
  label: string;
  type?: string;
  relatedRecords?: GraphNode[];
}

export interface RelationshipGraphProps {
  record: GraphNode;
  relatedRecords: GraphNode[];
  levels?: number;
  onNodeClick?: (nodeId: string) => void;
  className?: string;
}

interface LayoutNode {
  id: string;
  label: string;
  type?: string;
  x: number;
  y: number;
  level: number;
}

interface LayoutEdge {
  fromId: string;
  toId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

const NODE_RADIUS = 28;
const LEVEL_COLORS = [
  'fill-primary stroke-primary',
  'fill-blue-500 stroke-blue-500',
  'fill-emerald-500 stroke-emerald-500',
  'fill-amber-500 stroke-amber-500',
];
const LEVEL_TEXT_COLORS = [
  'fill-primary-foreground',
  'fill-white',
  'fill-white',
  'fill-white',
];

/** Compute layout positions for nodes in concentric rings. */
function computeLayout(
  center: GraphNode,
  relatedRecords: GraphNode[],
  levels: number,
  width: number,
  height: number,
): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  const seen = new Set<string>();

  const cx = width / 2;
  const cy = height / 2;

  // Center node
  nodes.push({ id: center.id, label: center.label, type: center.type, x: cx, y: cy, level: 0 });
  seen.add(center.id);

  // Level 1: direct relations
  const ringRadius1 = Math.min(width, height) * 0.32;
  const level1Nodes = relatedRecords.filter((r) => !seen.has(r.id));

  level1Nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / level1Nodes.length - Math.PI / 2;
    const x = cx + ringRadius1 * Math.cos(angle);
    const y = cy + ringRadius1 * Math.sin(angle);
    nodes.push({ id: node.id, label: node.label, type: node.type, x, y, level: 1 });
    edges.push({ fromId: center.id, toId: node.id, fromX: cx, fromY: cy, toX: x, toY: y });
    seen.add(node.id);
  });

  // Level 2+: related records of related records
  if (levels >= 2) {
    const ringRadius2 = Math.min(width, height) * 0.46;
    const level2Nodes: { node: GraphNode; parentX: number; parentY: number; parentId: string }[] = [];

    level1Nodes.forEach((parentNode) => {
      const parentLayoutNode = nodes.find((n) => n.id === parentNode.id);
      if (!parentLayoutNode) return;
      const children = (parentNode.relatedRecords || []).filter((r) => !seen.has(r.id));
      children.forEach((child) => {
        level2Nodes.push({
          node: child,
          parentX: parentLayoutNode.x,
          parentY: parentLayoutNode.y,
          parentId: parentNode.id,
        });
        seen.add(child.id);
      });
    });

    level2Nodes.forEach((item, i) => {
      const angle = (2 * Math.PI * i) / Math.max(level2Nodes.length, 1) - Math.PI / 2;
      const x = cx + ringRadius2 * Math.cos(angle);
      const y = cy + ringRadius2 * Math.sin(angle);
      nodes.push({
        id: item.node.id,
        label: item.node.label,
        type: item.node.type,
        x,
        y,
        level: 2,
      });
      edges.push({
        fromId: item.parentId,
        toId: item.node.id,
        fromX: item.parentX,
        fromY: item.parentY,
        toX: x,
        toY: y,
      });
    });
  }

  return { nodes, edges };
}

/** Truncate label to fit inside a node circle. */
function truncateLabel(label: string, maxLen: number = 6): string {
  if (label.length <= maxLen) return label;
  return label.slice(0, maxLen - 1) + '…';
}

export const RelationshipGraph: React.FC<RelationshipGraphProps> = ({
  record,
  relatedRecords,
  levels = 1,
  onNodeClick,
  className,
}) => {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 500, height: 400 });
  const [hoveredNode, setHoveredNode] = React.useState<string | null>(null);

  // Observe container size
  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const parent = svg.parentElement;
    if (!parent) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 0) {
          setDimensions({ width, height: Math.max(300, width * 0.7) });
        }
      }
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  const { nodes, edges } = React.useMemo(
    () => computeLayout(record, relatedRecords, levels, dimensions.width, dimensions.height),
    [record, relatedRecords, levels, dimensions],
  );

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Network className="h-4 w-4" />
          Relationships
          <span className="text-sm font-normal text-muted-foreground">
            ({relatedRecords.length} related)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <svg
          ref={svgRef}
          width="100%"
          height={dimensions.height}
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          className="select-none"
        >
          {/* Edges */}
          {edges.map((edge, i) => (
            <line
              key={`edge-${i}`}
              x1={edge.fromX}
              y1={edge.fromY}
              x2={edge.toX}
              y2={edge.toY}
              className="stroke-border"
              strokeWidth={1.5}
              strokeOpacity={0.5}
            />
          ))}

          {/* Nodes */}
          {nodes.map((node) => {
            const isHovered = hoveredNode === node.id;
            const levelColor = LEVEL_COLORS[Math.min(node.level, LEVEL_COLORS.length - 1)];
            const textColor = LEVEL_TEXT_COLORS[Math.min(node.level, LEVEL_TEXT_COLORS.length - 1)];
            const radius = node.level === 0 ? NODE_RADIUS + 6 : NODE_RADIUS;

            return (
              <g
                key={node.id}
                className={cn('cursor-pointer transition-transform', onNodeClick && 'hover:opacity-80')}
                onClick={() => onNodeClick?.(node.id)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isHovered ? radius + 3 : radius}
                  className={levelColor}
                  fillOpacity={node.level === 0 ? 1 : 0.85}
                  strokeWidth={2}
                  strokeOpacity={0.3}
                />
                <text
                  x={node.x}
                  y={node.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={cn('text-[10px] font-medium pointer-events-none', textColor)}
                >
                  {truncateLabel(node.label)}
                </text>
                {/* Type label below */}
                {node.type && (
                  <text
                    x={node.x}
                    y={node.y + radius + 12}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[9px] pointer-events-none"
                  >
                    {node.type}
                  </text>
                )}
                {/* Tooltip on hover */}
                {isHovered && (
                  <>
                    <rect
                      x={node.x - 50}
                      y={node.y - radius - 28}
                      width={100}
                      height={20}
                      rx={4}
                      className="fill-popover stroke-border"
                      strokeWidth={1}
                    />
                    <text
                      x={node.x}
                      y={node.y - radius - 16}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="fill-popover-foreground text-[10px] pointer-events-none"
                    >
                      {node.label}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </CardContent>
    </Card>
  );
};
