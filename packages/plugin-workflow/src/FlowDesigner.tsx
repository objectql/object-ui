/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, Badge, Input, Label, Separator,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@object-ui/components';
import type {
  FlowDesignerSchema, FlowNode, FlowEdge, FlowNodeType, FlowEdgeType,
  FlowWaitEventType, FlowNodeExecutionStatus, FlowVersionEntry,
  FlowConcurrencyPolicy, FlowBpmnInteropResult,
} from '@object-ui/types';
import {
  Play, Square, GitBranch, GitMerge, Clock, Bell, Globe, Zap,
  Plus, Trash2, Save, Link, Undo2, Redo2, ZoomIn, ZoomOut,
  RotateCcw, PanelRightClose, PanelRightOpen, Download, Upload,
  CheckCircle, AlertCircle, Loader2, SkipForward, History, Settings,
  Users, Code,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | false)[]) {
  return twMerge(clsx(inputs));
}

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const NODE_WIDTH = 130;
const NODE_HEIGHT = 52;

const NODE_TYPE_LABELS: Record<FlowNodeType, string> = {
  start: 'Start',
  end: 'End',
  task: 'Task',
  user_task: 'User Task',
  service_task: 'Service Task',
  script_task: 'Script Task',
  approval: 'Approval',
  condition: 'Condition',
  parallel_gateway: 'Parallel Gateway',
  join_gateway: 'Join Gateway',
  boundary_event: 'Boundary Event',
  delay: 'Delay',
  notification: 'Notification',
  webhook: 'Webhook',
};

const NODE_TYPE_ICONS: Record<FlowNodeType, React.ReactNode> = {
  start: <Play className="h-3.5 w-3.5 text-green-500" />,
  end: <Square className="h-3.5 w-3.5 text-red-500" />,
  task: <CheckCircle className="h-3.5 w-3.5 text-blue-500" />,
  user_task: <Users className="h-3.5 w-3.5 text-blue-600" />,
  service_task: <Settings className="h-3.5 w-3.5 text-blue-400" />,
  script_task: <Code className="h-3.5 w-3.5 text-indigo-500" />,
  approval: <Users className="h-3.5 w-3.5 text-purple-500" />,
  condition: <GitBranch className="h-3.5 w-3.5 text-orange-500" />,
  parallel_gateway: <GitBranch className="h-3.5 w-3.5 text-teal-500" />,
  join_gateway: <GitMerge className="h-3.5 w-3.5 text-teal-600" />,
  boundary_event: <AlertCircle className="h-3.5 w-3.5 text-amber-500" />,
  delay: <Clock className="h-3.5 w-3.5 text-gray-500" />,
  notification: <Bell className="h-3.5 w-3.5 text-yellow-500" />,
  webhook: <Globe className="h-3.5 w-3.5 text-cyan-500" />,
};

const NODE_TYPE_COLORS: Record<FlowNodeType, string> = {
  start: 'border-green-400 bg-green-50 dark:bg-green-950',
  end: 'border-red-400 bg-red-50 dark:bg-red-950',
  task: 'border-blue-300 bg-blue-50 dark:bg-blue-950',
  user_task: 'border-blue-400 bg-blue-50 dark:bg-blue-950',
  service_task: 'border-blue-200 bg-slate-50 dark:bg-slate-900',
  script_task: 'border-indigo-300 bg-indigo-50 dark:bg-indigo-950',
  approval: 'border-purple-400 bg-purple-50 dark:bg-purple-950',
  condition: 'border-orange-400 bg-orange-50 dark:bg-orange-950',
  parallel_gateway: 'border-teal-400 bg-teal-50 dark:bg-teal-950',
  join_gateway: 'border-teal-500 bg-teal-50 dark:bg-teal-950',
  boundary_event: 'border-amber-400 bg-amber-50 dark:bg-amber-950 border-dashed',
  delay: 'border-gray-400 bg-gray-50 dark:bg-gray-900',
  notification: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950',
  webhook: 'border-cyan-400 bg-cyan-50 dark:bg-cyan-950',
};

const EXECUTION_STATUS_OVERLAY: Record<FlowNodeExecutionStatus, { color: string; icon: React.ReactNode }> = {
  pending: { color: 'text-muted-foreground', icon: <Clock className="h-3 w-3" /> },
  running: { color: 'text-blue-500', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  completed: { color: 'text-green-500', icon: <CheckCircle className="h-3 w-3" /> },
  failed: { color: 'text-red-500', icon: <AlertCircle className="h-3 w-3" /> },
  skipped: { color: 'text-gray-400', icon: <SkipForward className="h-3 w-3" /> },
};

const TOOLBAR_NODE_TYPES: FlowNodeType[] = [
  'task', 'user_task', 'service_task', 'script_task',
  'approval', 'condition',
  'parallel_gateway', 'join_gateway', 'boundary_event',
  'delay', 'notification', 'webhook',
];

const CONCURRENCY_POLICY_LABELS: Record<FlowConcurrencyPolicy, string> = {
  allow: 'Allow (run concurrently)',
  forbid: 'Forbid (skip new)',
  replace: 'Replace (cancel existing)',
  queue: 'Queue (run after current)',
};

const WAIT_EVENT_TYPE_LABELS: Record<FlowWaitEventType, string> = {
  condition: 'Condition',
  manual: 'Manual',
  webhook: 'Webhook',
  timer: 'Timer',
  signal: 'Signal',
};

// ──────────────────────────────────────────────────────────────────────────────
// Default initial flow
// ──────────────────────────────────────────────────────────────────────────────

const defaultNodes = (): FlowNode[] => [
  { id: 'start-1', type: 'start', label: 'Start', position: { x: 80, y: 200 } },
  { id: 'end-1', type: 'end', label: 'End', position: { x: 500, y: 200 } },
];

const defaultEdges = (): FlowEdge[] => [];

// ──────────────────────────────────────────────────────────────────────────────
// Simple undo/redo stack
// ──────────────────────────────────────────────────────────────────────────────

interface Snapshot { nodes: FlowNode[]; edges: FlowEdge[] }

function useUndoRedoStack(initial: Snapshot) {
  const [history, setHistory] = useState<Snapshot[]>([initial]);
  const [cursor, setCursor] = useState(0);

  const current = history[cursor];

  const push = useCallback((next: Snapshot) => {
    setHistory((h) => [...h.slice(0, cursor + 1), next]);
    setCursor((c) => c + 1);
  }, [cursor]);

  const undo = useCallback(() => {
    setCursor((c) => Math.max(0, c - 1));
  }, []);

  const redo = useCallback(() => {
    setHistory((h) => {
      setCursor((c) => Math.min(h.length - 1, c + 1));
      return h;
    });
  }, []);

  const canUndo = cursor > 0;
  const canRedo = cursor < history.length - 1;

  return { current, push, undo, redo, canUndo, canRedo };
}

// ──────────────────────────────────────────────────────────────────────────────
// BPMN export helper (lightweight — produces structured JSON)
// ──────────────────────────────────────────────────────────────────────────────

function exportBpmn(nodes: FlowNode[], edges: FlowEdge[], title: string): FlowBpmnInteropResult {
  const warnings: string[] = [];
  const unsupportedTypes: FlowNodeType[] = ['boundary_event'];

  nodes.forEach((n) => {
    if (unsupportedTypes.includes(n.type)) {
      warnings.push(`Node "${n.label}" (${n.type}) has limited BPMN mapping.`);
    }
  });

  const bpmnXml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"`,
    `             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"`,
    `             targetNamespace="http://objectui.org/bpmn">`,
    `  <process id="process-1" name="${title}" isExecutable="true">`,
    ...nodes.map((n) => {
      const tag = bpmnTag(n.type);
      return `    <${tag} id="${n.id}" name="${n.label}" />`;
    }),
    ...edges.map((e) => {
      const attrs = [
        `id="${e.id}"`,
        `sourceRef="${e.source}"`,
        `targetRef="${e.target}"`,
        e.condition ? `conditionExpression="${e.condition}"` : '',
      ].filter(Boolean).join(' ');
      return `    <sequenceFlow ${attrs} />`;
    }),
    `  </process>`,
    `</definitions>`,
  ].join('\n');

  return {
    success: true,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    warnings: warnings.length ? warnings : undefined,
    bpmnXml,
  };
}

function bpmnTag(type: FlowNodeType): string {
  const map: Partial<Record<FlowNodeType, string>> = {
    start: 'startEvent',
    end: 'endEvent',
    task: 'task',
    user_task: 'userTask',
    service_task: 'serviceTask',
    script_task: 'scriptTask',
    approval: 'userTask',
    condition: 'exclusiveGateway',
    parallel_gateway: 'parallelGateway',
    join_gateway: 'parallelGateway',
    boundary_event: 'boundaryEvent',
    delay: 'intermediateCatchEvent',
    notification: 'sendTask',
    webhook: 'serviceTask',
  };
  return map[type] ?? 'task';
}

// ──────────────────────────────────────────────────────────────────────────────
// Edge routing (SVG path)
// ──────────────────────────────────────────────────────────────────────────────

function routeEdge(
  source: FlowNode,
  target: FlowNode,
): { d: string; labelX: number; labelY: number } {
  const x1 = source.position.x + NODE_WIDTH;
  const y1 = source.position.y + NODE_HEIGHT / 2;
  const x2 = target.position.x;
  const y2 = target.position.y + NODE_HEIGHT / 2;
  const cx = (x1 + x2) / 2;
  const d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
  return { d, labelX: cx, labelY: (y1 + y2) / 2 - 8 };
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

interface FlowNodeCardProps {
  node: FlowNode;
  isSelected: boolean;
  isConnectSource: boolean;
  connectMode: boolean;
  readOnly: boolean;
  showExecutionOverlay: boolean;
  onSelect: (id: string, multi: boolean) => void;
  onDelete: (id: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onPortClick: (id: string) => void;
}

const FlowNodeCard: React.FC<FlowNodeCardProps> = ({
  node, isSelected, isConnectSource, connectMode, readOnly,
  showExecutionOverlay, onSelect, onDelete, onDragStart, onPortClick,
}) => {
  const execStatus = node.executionStatus;
  const overlay = execStatus ? EXECUTION_STATUS_OVERLAY[execStatus] : null;

  return (
    <div
      className="absolute select-none"
      style={{ left: node.position.x, top: node.position.y }}
      draggable={!readOnly && !connectMode}
      onDragStart={(e) => onDragStart(e, node.id)}
      onClick={(e) => onSelect(node.id, e.shiftKey)}
      role="group"
      aria-label={node.label}
    >
      <div
        className={cn(
          'flex items-center gap-2 border-2 rounded px-3 py-2 min-h-[52px] transition-shadow cursor-pointer',
          NODE_TYPE_COLORS[node.type],
          isSelected && 'ring-2 ring-primary shadow-md',
          isConnectSource && 'ring-2 ring-blue-400 shadow-lg',
          connectMode && !isConnectSource && 'cursor-crosshair',
          showExecutionOverlay && execStatus === 'running' && 'ring-2 ring-blue-400',
          showExecutionOverlay && execStatus === 'failed' && 'ring-2 ring-red-400',
          showExecutionOverlay && execStatus === 'completed' && 'ring-2 ring-green-400',
        )}
        style={{ width: NODE_WIDTH, minHeight: NODE_HEIGHT }}
      >
        <span className="shrink-0">{NODE_TYPE_ICONS[node.type]}</span>
        <span className="text-xs font-medium leading-tight flex-1 truncate">{node.label}</span>
        {showExecutionOverlay && overlay && (
          <span className={cn('shrink-0', overlay.color)}>{overlay.icon}</span>
        )}
      </div>

      {/* Connection ports */}
      {!readOnly && (isSelected || connectMode) && (
        <>
          {/* Output port (right) */}
          <div
            className="absolute w-3 h-3 rounded-full bg-primary border-2 border-background shadow cursor-crosshair"
            style={{ right: -6, top: NODE_HEIGHT / 2 - 6 }}
            title="Connect from this node"
            onClick={(e) => { e.stopPropagation(); onPortClick(node.id); }}
          />
          {/* Input port (left) */}
          <div
            className="absolute w-3 h-3 rounded-full bg-muted-foreground border-2 border-background shadow cursor-crosshair"
            style={{ left: -6, top: NODE_HEIGHT / 2 - 6 }}
            title="Connect to this node"
            onClick={(e) => { e.stopPropagation(); onPortClick(node.id); }}
          />
        </>
      )}

      {/* Delete button */}
      {!readOnly && isSelected && !connectMode && (
        <button
          className="absolute -top-2 -right-2 p-0.5 rounded-full bg-destructive text-destructive-foreground shadow"
          onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
          aria-label={`Delete node ${node.label}`}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Property Panel
// ──────────────────────────────────────────────────────────────────────────────

interface PropertyPanelProps {
  node: FlowNode | null;
  edge: FlowEdge | null;
  readOnly: boolean;
  onNodeChange: (updated: FlowNode) => void;
  onEdgeChange: (updated: FlowEdge) => void;
}

const PropertyPanel: React.FC<PropertyPanelProps> = ({
  node, edge, readOnly, onNodeChange, onEdgeChange,
}) => {
  if (!node && !edge) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Select a node or edge to edit its properties.
      </div>
    );
  }

  if (node) {
    return (
      <div className="p-3 space-y-3 overflow-y-auto">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Node Properties</p>

        <div className="space-y-1">
          <Label className="text-xs">Label</Label>
          <Input
            value={node.label}
            onChange={(e) => onNodeChange({ ...node, label: e.target.value })}
            disabled={readOnly}
            className="h-7 text-xs"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select
            value={node.type}
            onValueChange={(v) => onNodeChange({ ...node, type: v as FlowNodeType })}
            disabled={readOnly}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(NODE_TYPE_LABELS) as FlowNodeType[]).map((t) => (
                <SelectItem key={t} value={t} className="text-xs">
                  {NODE_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Description</Label>
          <Input
            value={node.description ?? ''}
            onChange={(e) => onNodeChange({ ...node, description: e.target.value })}
            disabled={readOnly}
            className="h-7 text-xs"
            placeholder="Optional description"
          />
        </div>

        {/* Executor config for task-type nodes */}
        {['task', 'user_task', 'service_task', 'script_task', 'delay', 'webhook'].includes(node.type) && (
          <>
            <Separator />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Executor</p>

            <div className="space-y-1">
              <Label className="text-xs">Executor Type</Label>
              <Input
                value={node.executor?.type ?? ''}
                onChange={(e) => onNodeChange({
                  ...node,
                  executor: { ...node.executor, type: e.target.value },
                })}
                disabled={readOnly}
                className="h-7 text-xs"
                placeholder="e.g. http, script, email"
              />
            </div>

            {node.type === 'delay' && (
              <div className="space-y-1">
                <Label className="text-xs">Wait Event Type</Label>
                <Select
                  value={node.executor?.waitEventConfig?.eventType ?? 'timer'}
                  onValueChange={(v) => onNodeChange({
                    ...node,
                    executor: {
                      ...node.executor,
                      type: node.executor?.type ?? 'wait',
                      waitEventConfig: {
                        ...node.executor?.waitEventConfig,
                        eventType: v as FlowWaitEventType,
                      },
                    },
                  })}
                  disabled={readOnly}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(WAIT_EVENT_TYPE_LABELS) as FlowWaitEventType[]).map((t) => (
                      <SelectItem key={t} value={t} className="text-xs">
                        {WAIT_EVENT_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Timeout (ms)</Label>
              <Input
                type="number"
                value={node.executor?.timeoutMs ?? ''}
                onChange={(e) => onNodeChange({
                  ...node,
                  executor: {
                    ...node.executor,
                    type: node.executor?.type ?? '',
                    timeoutMs: e.target.value ? Number(e.target.value) : undefined,
                  },
                })}
                disabled={readOnly}
                className="h-7 text-xs"
                placeholder="e.g. 30000"
              />
            </div>
          </>
        )}

        {/* Boundary config */}
        {node.type === 'boundary_event' && (
          <>
            <Separator />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Boundary Config</p>

            <div className="space-y-1">
              <Label className="text-xs">Attached To Node ID</Label>
              <Input
                value={node.boundaryConfig?.attachedToNodeId ?? ''}
                onChange={(e) => onNodeChange({
                  ...node,
                  boundaryConfig: {
                    ...node.boundaryConfig,
                    attachedToNodeId: e.target.value,
                    eventType: node.boundaryConfig?.eventType ?? 'error',
                  },
                })}
                disabled={readOnly}
                className="h-7 text-xs"
                placeholder="Host node id"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Event Type</Label>
              <Select
                value={node.boundaryConfig?.eventType ?? 'error'}
                onValueChange={(v) => onNodeChange({
                  ...node,
                  boundaryConfig: {
                    ...node.boundaryConfig,
                    attachedToNodeId: node.boundaryConfig?.attachedToNodeId ?? '',
                    eventType: v as 'error' | 'timer' | 'message' | 'signal' | 'compensation',
                  },
                })}
                disabled={readOnly}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['error', 'timer', 'message', 'signal', 'compensation'] as const).map((t) => (
                    <SelectItem key={t} value={t} className="text-xs capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>
    );
  }

  if (edge) {
    return (
      <div className="p-3 space-y-3 overflow-y-auto">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Edge Properties</p>

        <div className="space-y-1">
          <Label className="text-xs">Label</Label>
          <Input
            value={edge.label ?? ''}
            onChange={(e) => onEdgeChange({ ...edge, label: e.target.value })}
            disabled={readOnly}
            className="h-7 text-xs"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select
            value={edge.type ?? 'default'}
            onValueChange={(v) => onEdgeChange({ ...edge, type: v as FlowEdgeType })}
            disabled={readOnly}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default" className="text-xs">Default</SelectItem>
              <SelectItem value="conditional" className="text-xs">Conditional</SelectItem>
              <SelectItem value="timeout" className="text-xs">Timeout</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(edge.type === 'conditional') && (
          <div className="space-y-1">
            <Label className="text-xs">Condition Expression</Label>
            <Input
              value={edge.condition ?? ''}
              onChange={(e) => onEdgeChange({ ...edge, condition: e.target.value })}
              disabled={readOnly}
              className="h-7 text-xs font-mono"
              placeholder="e.g. status === 'approved'"
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="edge-isDefault"
            checked={edge.isDefault ?? false}
            onChange={(e) => onEdgeChange({ ...edge, isDefault: e.target.checked })}
            disabled={readOnly}
            className="h-3.5 w-3.5"
          />
          <Label htmlFor="edge-isDefault" className="text-xs">Default edge (isDefault)</Label>
        </div>
      </div>
    );
  }

  return null;
};

// ──────────────────────────────────────────────────────────────────────────────
// Version History Panel
// ──────────────────────────────────────────────────────────────────────────────

interface VersionHistoryPanelProps {
  versions: FlowVersionEntry[];
}

const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({ versions }) => (
  <div className="p-3 space-y-2">
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Version History</p>
    {versions.length === 0 && (
      <p className="text-xs text-muted-foreground">No version history available.</p>
    )}
    <div className="space-y-1.5">
      {versions.map((v) => (
        <div
          key={v.version}
          className={cn(
            'rounded border p-2 text-xs',
            v.isCurrent ? 'border-primary bg-primary/5' : 'border-border bg-muted/30',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">v{v.version}</span>
            {v.isCurrent && <Badge variant="default" className="text-[10px] h-4">Current</Badge>}
          </div>
          {v.changeNote && <p className="text-muted-foreground mt-0.5">{v.changeNote}</p>}
          <p className="text-muted-foreground mt-0.5">
            {v.author && <>{v.author} · </>}
            {new Date(v.createdAt).toLocaleDateString()}
          </p>
        </div>
      ))}
    </div>
  </div>
);

// ──────────────────────────────────────────────────────────────────────────────
// Main FlowDesigner component
// ──────────────────────────────────────────────────────────────────────────────

export interface FlowDesignerProps {
  schema: FlowDesignerSchema;
  /** Called when user clicks save */
  onSave?: (nodes: FlowNode[], edges: FlowEdge[]) => void;
}

/**
 * FlowDesigner — canvas-based flow editor with spec v3.0.9 node types,
 * conditional edges, BPMN export, and execution monitoring overlay.
 */
export const FlowDesigner: React.FC<FlowDesignerProps> = ({ schema, onSave }) => {
  const {
    readOnly = false,
    showToolbar = true,
    showMinimap = false,
    showVersionHistory = false,
    showExecutionOverlay = false,
    executionSteps = [],
    versionHistory = [],
    concurrencyPolicy,
    title: initialTitle = 'New Flow',
    description: initialDescription = '',
    status: initialStatus = 'draft',
  } = schema;

  // ── State ──────────────────────────────────────────────────────────────────

  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);

  const initNodes = schema.nodes ?? defaultNodes();
  const initEdges = schema.edges ?? defaultEdges();

  const { current, push, undo, redo, canUndo, canRedo } = useUndoRedoStack({
    nodes: initNodes,
    edges: initEdges,
  });

  const nodes = current.nodes;
  const edges = current.edges;

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectSource, setConnectSource] = useState<string | null>(null);
  const [showPropertyPanel, setShowPropertyPanel] = useState(true);
  const [showVersionPanel, setShowVersionPanel] = useState(showVersionHistory);
  const [bpmnResult, setBpmnResult] = useState<FlowBpmnInteropResult | null>(null);
  const [zoom, setZoom] = useState(1);

  const canvasRef = useRef<HTMLDivElement>(null);

  // ── Derived ────────────────────────────────────────────────────────────────

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const selectedEdge = useMemo(
    () => edges.find((e) => e.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId],
  );

  // Apply execution status overlay from executionSteps
  const displayNodes = useMemo((): FlowNode[] => {
    if (!showExecutionOverlay || executionSteps.length === 0) return nodes;
    const statusMap = new Map(executionSteps.map((s) => [s.nodeId, s.status]));
    return nodes.map((n) =>
      statusMap.has(n.id) ? { ...n, executionStatus: statusMap.get(n.id) } : n,
    );
  }, [nodes, showExecutionOverlay, executionSteps]);

  // ── Node operations ────────────────────────────────────────────────────────

  const addNode = useCallback((type: FlowNodeType) => {
    if (readOnly) return;
    const id = `${type}-${Date.now()}`;
    const newNode: FlowNode = {
      id,
      type,
      label: NODE_TYPE_LABELS[type],
      position: { x: 200, y: 80 + nodes.length * 70 },
    };
    push({ nodes: [...nodes, newNode], edges });
  }, [readOnly, nodes, edges, push]);

  const deleteNode = useCallback((nodeId: string) => {
    if (readOnly) return;
    const updatedNodes = nodes.filter((n) => n.id !== nodeId);
    const updatedEdges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
    push({ nodes: updatedNodes, edges: updatedEdges });
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  }, [readOnly, nodes, edges, push, selectedNodeId]);

  const updateNode = useCallback((updated: FlowNode) => {
    if (readOnly) return;
    push({ nodes: nodes.map((n) => n.id === updated.id ? updated : n), edges });
  }, [readOnly, nodes, edges, push]);

  // ── Edge operations ────────────────────────────────────────────────────────

  const deleteEdge = useCallback((edgeId: string) => {
    if (readOnly) return;
    push({ nodes, edges: edges.filter((e) => e.id !== edgeId) });
    if (selectedEdgeId === edgeId) setSelectedEdgeId(null);
  }, [readOnly, nodes, edges, push, selectedEdgeId]);

  const updateEdge = useCallback((updated: FlowEdge) => {
    if (readOnly) return;
    push({ nodes, edges: edges.map((e) => e.id === updated.id ? updated : e) });
  }, [readOnly, nodes, edges, push]);

  // ── Connection (edge creation) ─────────────────────────────────────────────

  const handlePortClick = useCallback((nodeId: string) => {
    if (readOnly) return;
    if (!connectMode) {
      setConnectMode(true);
      setConnectSource(nodeId);
      return;
    }
    if (connectSource && connectSource !== nodeId) {
      const id = `edge-${Date.now()}`;
      const newEdge: FlowEdge = { id, source: connectSource, target: nodeId };
      push({ nodes, edges: [...edges, newEdge] });
    }
    setConnectMode(false);
    setConnectSource(null);
  }, [readOnly, connectMode, connectSource, nodes, edges, push]);

  // ── Drag-to-reposition ─────────────────────────────────────────────────────

  const dragNodeIdRef = useRef<string | null>(null);
  const dragStartPosRef = useRef<{ mouseX: number; mouseY: number; nodeX: number; nodeY: number } | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, nodeId: string) => {
    dragNodeIdRef.current = nodeId;
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      dragStartPosRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        nodeX: node.position.x,
        nodeY: node.position.y,
      };
    }
    e.dataTransfer.effectAllowed = 'move';
  }, [nodes]);

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!dragNodeIdRef.current || !dragStartPosRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = (e.clientX - dragStartPosRef.current.mouseX) / zoom;
    const dy = (e.clientY - dragStartPosRef.current.mouseY) / zoom;
    const newX = Math.max(0, dragStartPosRef.current.nodeX + dx);
    const newY = Math.max(0, dragStartPosRef.current.nodeY + dy);
    const nodeId = dragNodeIdRef.current;
    push({
      nodes: nodes.map((n) =>
        n.id === nodeId ? { ...n, position: { x: newX, y: newY } } : n,
      ),
      edges,
    });
    dragNodeIdRef.current = null;
    dragStartPosRef.current = null;
    // suppress unused rect warning
    void rect;
  }, [nodes, edges, push, zoom]);

  // ── BPMN export ────────────────────────────────────────────────────────────

  const handleExportBpmn = useCallback(() => {
    const result = exportBpmn(nodes, edges, title);
    setBpmnResult(result);

    // Trigger download
    const blob = new Blob([result.bpmnXml ?? ''], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '-').toLowerCase()}.bpmn`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, title]);

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    onSave?.(nodes, edges);
  }, [nodes, edges, onSave]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if (ctrl && e.key === 's') { e.preventDefault(); handleSave(); return; }
    if (e.key === 'Escape') {
      setConnectMode(false);
      setConnectSource(null);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedNodeId) deleteNode(selectedNodeId);
      else if (selectedEdgeId) deleteEdge(selectedEdgeId);
    }
  }, [undo, redo, handleSave, selectedNodeId, selectedEdgeId, deleteNode, deleteEdge]);

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <Card className="flex flex-col h-full min-h-[600px] outline-none" tabIndex={0} onKeyDown={handleKeyDown}>
      {/* Header */}
      <CardHeader className="py-2 px-4 border-b flex-shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <Zap className="h-4 w-4 text-primary shrink-0" />
          <CardTitle className="text-sm font-semibold">
            {readOnly ? (
              <span>{title}</span>
            ) : (
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-6 text-sm font-semibold border-0 p-0 focus-visible:ring-0 bg-transparent"
                aria-label="Flow title"
              />
            )}
          </CardTitle>

          <Badge variant="outline" className="text-xs capitalize">{initialStatus}</Badge>

          {concurrencyPolicy && (
            <Badge variant="secondary" className="text-xs">
              {CONCURRENCY_POLICY_LABELS[concurrencyPolicy]}
            </Badge>
          )}

          <div className="ml-auto flex items-center gap-1">
            {!readOnly && (
              <>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
                  <Redo2 className="h-4 w-4" />
                </Button>
                <Separator orientation="vertical" className="h-5 mx-1" />
              </>
            )}

            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom((z) => Math.min(2, z + 0.1))} title="Zoom in">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(1)} title="Reset zoom">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))} title="Zoom out">
              <ZoomOut className="h-4 w-4" />
            </Button>

            <Separator orientation="vertical" className="h-5 mx-1" />

            {versionHistory.length > 0 && (
              <Button
                size="icon"
                variant={showVersionPanel ? 'secondary' : 'ghost'}
                className="h-7 w-7"
                onClick={() => setShowVersionPanel((v) => !v)}
                title="Version history"
              >
                <History className="h-4 w-4" />
              </Button>
            )}

            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleExportBpmn} title="Export BPMN">
              <Download className="h-4 w-4" />
            </Button>

            {!readOnly && (
              <>
                <Button size="icon" variant="ghost" className="h-7 w-7" title="Import BPMN (drag & drop)">
                  <Upload className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs gap-1"
                  onClick={handleSave}
                  title="Save (Ctrl+S)"
                >
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              </>
            )}

            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setShowPropertyPanel((v) => !v)}
              title={showPropertyPanel ? 'Hide properties' : 'Show properties'}
            >
              {showPropertyPanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 p-0 overflow-hidden">
        {/* Left toolbar — node palette */}
        {showToolbar && !readOnly && (
          <div className="w-36 border-r bg-muted/30 flex-shrink-0 overflow-y-auto py-2 px-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">Add Node</p>
            <div className="space-y-1">
              {TOOLBAR_NODE_TYPES.map((type) => (
                <button
                  key={type}
                  className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors text-left"
                  onClick={() => addNode(type)}
                  title={`Add ${NODE_TYPE_LABELS[type]}`}
                >
                  {NODE_TYPE_ICONS[type]}
                  <span className="truncate">{NODE_TYPE_LABELS[type]}</span>
                </button>
              ))}
            </div>

            {connectMode && (
              <>
                <Separator className="my-2" />
                <div className="px-1">
                  <p className="text-[10px] text-blue-600 font-medium">Connect mode</p>
                  <p className="text-[10px] text-muted-foreground">Click a target node port to connect.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs mt-1 w-full"
                    onClick={() => { setConnectMode(false); setConnectSource(null); }}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Canvas area */}
        <div className="flex-1 overflow-auto relative bg-dot-pattern">
          <div
            ref={canvasRef}
            className="relative"
            style={{
              width: 1200,
              height: 700,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
            onDrop={handleCanvasDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={(e) => {
              if ((e.target as HTMLElement) === canvasRef.current) {
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
              }
            }}
          >
            {/* SVG edges */}
            <svg
              className="absolute inset-0 pointer-events-none"
              width={1200}
              height={700}
              style={{ overflow: 'visible' }}
            >
              <defs>
                <marker id="fd-arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--foreground) / 0.5)" />
                </marker>
                <marker id="fd-arrowhead-selected" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--primary))" />
                </marker>
                <marker id="fd-arrowhead-conditional" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--foreground) / 0.6)" />
                </marker>
              </defs>

              {edges.map((edge) => {
                const src = displayNodes.find((n) => n.id === edge.source);
                const tgt = displayNodes.find((n) => n.id === edge.target);
                if (!src || !tgt) return null;

                const { d, labelX, labelY } = routeEdge(src, tgt);
                const isSelectedEdge = edge.id === selectedEdgeId;
                const isConditional = edge.type === 'conditional';
                const isDefault = edge.isDefault;

                return (
                  <g
                    key={edge.id}
                    className="pointer-events-auto cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEdgeId(edge.id);
                      setSelectedNodeId(null);
                    }}
                  >
                    <path
                      d={d}
                      fill="none"
                      stroke={isSelectedEdge ? 'hsl(var(--primary))' : isConditional ? 'hsl(var(--foreground) / 0.6)' : 'hsl(var(--foreground) / 0.4)'}
                      strokeWidth={isSelectedEdge ? 2.5 : 2}
                      strokeDasharray={isConditional ? '6 3' : isDefault ? '3 3' : undefined}
                      markerEnd={`url(#fd-arrowhead${isSelectedEdge ? '-selected' : isConditional ? '-conditional' : ''})`}
                    />
                    {(edge.label || isDefault) && (
                      <text
                        x={labelX}
                        y={labelY}
                        textAnchor="middle"
                        className="text-[10px] fill-muted-foreground"
                        style={{ fontSize: 10 }}
                      >
                        {edge.label ?? (isDefault ? '(default)' : '')}
                      </text>
                    )}
                    {edge.condition && (
                      <text
                        x={labelX}
                        y={labelY + 12}
                        textAnchor="middle"
                        className="text-[9px] fill-orange-500"
                        style={{ fontSize: 9 }}
                      >
                        {edge.condition.length > 24 ? edge.condition.slice(0, 24) + '…' : edge.condition}
                      </text>
                    )}
                    {/* Wider invisible hit area */}
                    <path d={d} fill="none" stroke="transparent" strokeWidth={12} />
                  </g>
                );
              })}
            </svg>

            {/* Nodes */}
            {displayNodes.map((node) => (
              <FlowNodeCard
                key={node.id}
                node={node}
                isSelected={selectedNodeId === node.id}
                isConnectSource={connectSource === node.id}
                connectMode={connectMode}
                readOnly={readOnly}
                showExecutionOverlay={showExecutionOverlay}
                onSelect={(id, multi) => {
                  if (!multi) setSelectedEdgeId(null);
                  setSelectedNodeId(id);
                }}
                onDelete={deleteNode}
                onDragStart={handleDragStart}
                onPortClick={handlePortClick}
              />
            ))}

            {/* Connect mode hint */}
            {connectMode && connectSource && (
              <div
                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1.5 rounded shadow-lg pointer-events-none"
              >
                <Link className="h-3 w-3 inline mr-1" />
                Click a node port to complete the connection — Esc to cancel
              </div>
            )}

            {/* Empty state */}
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                No nodes yet. Use the toolbar to add nodes.
              </div>
            )}
          </div>
        </div>

        {/* Version History panel */}
        {showVersionPanel && versionHistory.length > 0 && (
          <div className="w-48 border-l bg-background flex-shrink-0 overflow-y-auto">
            <VersionHistoryPanel versions={versionHistory} />
          </div>
        )}

        {/* Property panel */}
        {showPropertyPanel && (
          <div className="w-52 border-l bg-background flex-shrink-0 overflow-y-auto">
            <PropertyPanel
              node={selectedNode}
              edge={selectedEdge}
              readOnly={readOnly}
              onNodeChange={updateNode}
              onEdgeChange={updateEdge}
            />
            {/* BPMN export result */}
            {bpmnResult && (
              <div className="p-3 border-t">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">BPMN Export</p>
                <Badge variant={bpmnResult.success ? 'default' : 'destructive'} className="text-[10px]">
                  {bpmnResult.success ? `Exported ${bpmnResult.nodeCount} nodes` : 'Export failed'}
                </Badge>
                {bpmnResult.warnings?.map((w, i) => (
                  <p key={i} className="text-[10px] text-amber-600 mt-0.5">{w}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
