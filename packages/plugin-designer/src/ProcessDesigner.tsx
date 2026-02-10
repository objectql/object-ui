/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useCallback } from 'react';
import type { BPMNNode, BPMNEdge, BPMNLane, DesignerCanvasConfig } from '@object-ui/types';
import { Play, Square, Diamond, Trash2, GitBranch } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | false)[]) {
  return twMerge(clsx(inputs));
}

export interface ProcessDesignerProps {
  /** Process name */
  processName?: string;
  /** Process version */
  version?: string;
  /** BPMN nodes */
  nodes?: BPMNNode[];
  /** BPMN edges */
  edges?: BPMNEdge[];
  /** Swim lanes */
  lanes?: BPMNLane[];
  /** Canvas configuration */
  canvas?: DesignerCanvasConfig;
  /** Show minimap */
  showMinimap?: boolean;
  /** Show toolbar */
  showToolbar?: boolean;
  /** Read-only mode */
  readOnly?: boolean;
  /** Callback when nodes change */
  onNodesChange?: (nodes: BPMNNode[]) => void;
  /** Callback when edges change */
  onEdgesChange?: (edges: BPMNEdge[]) => void;
  /** Custom CSS class */
  className?: string;
}

/**
 * Process designer for creating BPMN 2.0 workflows.
 * Supports nodes, edges, lanes, and conditional flows.
 */
export function ProcessDesigner({
  processName = 'New Process',
  nodes: initialNodes = [],
  edges: initialEdges = [],
  lanes: _lanes,
  canvas = { width: 1400, height: 800, showGrid: true },
  showToolbar = true,
  readOnly = false,
  onNodesChange,
  onEdgesChange,
  className,
}: ProcessDesignerProps) {
  const [nodes, setNodes] = useState<BPMNNode[]>(initialNodes);
  const [edges, setEdges] = useState<BPMNEdge[]>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const handleAddNode = useCallback(
    (type: BPMNNode['type'], label: string) => {
      if (readOnly) return;
      const newNode: BPMNNode = {
        id: `node-${Date.now()}`,
        type,
        label,
        position: { x: 200 + nodes.length * 160, y: 200 },
      };
      const updated = [...nodes, newNode];
      setNodes(updated);
      setSelectedNodeId(newNode.id);
      onNodesChange?.(updated);
    },
    [nodes, readOnly, onNodesChange],
  );

  const handleDeleteNode = useCallback(
    (id: string) => {
      if (readOnly) return;
      const updatedNodes = nodes.filter((n) => n.id !== id);
      const updatedEdges = edges.filter((e) => e.source !== id && e.target !== id);
      setNodes(updatedNodes);
      setEdges(updatedEdges);
      if (selectedNodeId === id) setSelectedNodeId(null);
      onNodesChange?.(updatedNodes);
      onEdgesChange?.(updatedEdges);
    },
    [nodes, edges, selectedNodeId, readOnly, onNodesChange, onEdgesChange],
  );

  const getNodeStyle = (type: BPMNNode['type']) => {
    switch (type) {
      case 'start-event':
        return 'rounded-full bg-green-100 border-green-500 text-green-700';
      case 'end-event':
        return 'rounded-full bg-red-100 border-red-500 text-red-700';
      case 'exclusive-gateway':
      case 'parallel-gateway':
      case 'inclusive-gateway':
      case 'event-based-gateway':
        return 'rotate-45 bg-yellow-100 border-yellow-500 text-yellow-700';
      case 'user-task':
        return 'rounded bg-blue-100 border-blue-500 text-blue-700';
      case 'service-task':
      case 'script-task':
        return 'rounded bg-purple-100 border-purple-500 text-purple-700';
      default:
        return 'rounded bg-gray-100 border-gray-500 text-gray-700';
    }
  };

  return (
    <div className={cn('flex flex-col h-full w-full border rounded-lg overflow-hidden bg-background', className)}>
      {/* Toolbar */}
      {showToolbar && (
        <div className="flex items-center gap-2 p-2 border-b bg-muted/20">
          <GitBranch className="h-4 w-4" />
          <span className="font-medium text-sm">{processName}</span>
          <div className="flex-1" />
          {!readOnly && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleAddNode('start-event', 'Start')}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-accent"
                title="Add Start Event"
              >
                <Play className="h-3 w-3 text-green-600" /> Start
              </button>
              <button
                onClick={() => handleAddNode('user-task', 'User Task')}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-accent"
                title="Add User Task"
              >
                <Square className="h-3 w-3 text-blue-600" /> Task
              </button>
              <button
                onClick={() => handleAddNode('exclusive-gateway', 'Decision')}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-accent"
                title="Add Gateway"
              >
                <Diamond className="h-3 w-3 text-yellow-600" /> Gateway
              </button>
              <button
                onClick={() => handleAddNode('end-event', 'End')}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-accent"
                title="Add End Event"
              >
                <Square className="h-3 w-3 text-red-600" /> End
              </button>
            </div>
          )}
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 overflow-auto bg-muted/10 p-4">
        <div
          className="relative"
          style={{
            width: canvas.width,
            minHeight: canvas.height,
            backgroundImage: canvas.showGrid
              ? 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)'
              : undefined,
            backgroundSize: canvas.showGrid ? '20px 20px' : undefined,
          }}
        >
          {/* Edge lines */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={canvas.width}
            height={canvas.height}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="10"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--foreground))" />
              </marker>
            </defs>
            {edges.map((edge) => {
              const source = nodes.find((n) => n.id === edge.source);
              const target = nodes.find((n) => n.id === edge.target);
              if (!source || !target) return null;

              return (
                <line
                  key={edge.id}
                  x1={source.position.x + 60}
                  y1={source.position.y + 25}
                  x2={target.position.x}
                  y2={target.position.y + 25}
                  stroke="hsl(var(--foreground) / 0.5)"
                  strokeWidth="2"
                  markerEnd="url(#arrowhead)"
                />
              );
            })}
          </svg>

          {/* Nodes */}
          {nodes.map((node) => (
            <div
              key={node.id}
              className="absolute select-none"
              style={{
                left: node.position.x,
                top: node.position.y,
              }}
              onClick={() => setSelectedNodeId(node.id)}
            >
              <div
                className={cn(
                  'flex items-center justify-center border-2 min-w-[120px] min-h-[50px] px-3 py-2',
                  getNodeStyle(node.type),
                  selectedNodeId === node.id && 'ring-2 ring-primary shadow-md',
                )}
              >
                <span className={cn(
                  'text-xs font-medium',
                  (node.type === 'exclusive-gateway' || node.type === 'parallel-gateway') && '-rotate-45',
                )}>
                  {node.label}
                </span>
              </div>
              {!readOnly && selectedNodeId === node.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteNode(node.id);
                  }}
                  className="absolute -top-2 -right-2 p-0.5 rounded-full bg-destructive text-destructive-foreground shadow"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
