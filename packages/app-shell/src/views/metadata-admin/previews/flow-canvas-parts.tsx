// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * flow-canvas-parts — presentational building blocks for `FlowCanvas.tsx`:
 * the per-node-type icon/tone mapping, the node card, and the add-node
 * palette popover. Kept dependency-free and Shadcn-native (Tailwind + lucide).
 */

import * as React from 'react';
import {
  Code,
  CircleDot,
  CircleStop,
  Diamond,
  FilePen,
  FilePlus,
  FileSearch,
  FileX,
  GitFork,
  Globe,
  MonitorSmartphone,
  Play,
  Plug,
  Plus,
  Repeat,
  TimerReset,
  UserCheck,
  Variable,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@object-ui/components';
import { NODE_W, NODE_H, type Point } from './flow-canvas-layout';

export function nodeIcon(type: string): LucideIcon {
  switch (type) {
    case 'start':
      return Play;
    case 'end':
      return CircleStop;
    case 'decision':
    case 'branch':
    case 'gateway':
      return Diamond;
    case 'wait':
    case 'timer':
    case 'delay':
      return TimerReset;
    case 'boundary_event':
    case 'signal':
      return Zap;
    case 'subflow':
    case 'flow':
      return Workflow;
    case 'create_record':
      return FilePlus;
    case 'update_record':
      return FilePen;
    case 'delete_record':
      return FileX;
    case 'get_record':
      return FileSearch;
    case 'http_request':
    case 'webhook':
      return Globe;
    case 'script':
    case 'script_task':
      return Code;
    case 'screen':
    case 'user_task':
      return MonitorSmartphone;
    case 'approval':
      return UserCheck;
    case 'connector_action':
    case 'service_task':
      return Plug;
    case 'assignment':
      return Variable;
    case 'loop':
    case 'for_each':
      return Repeat;
    case 'parallel_gateway':
    case 'join_gateway':
    case 'parallel':
      return GitFork;
    default:
      return CircleDot;
  }
}

interface NodeTone {
  /** Icon color. */
  icon: string;
  /** Card accent border (left edge) + selected ring color. */
  accent: string;
  /** Small type-label text color. */
  label: string;
}

const TONES: Record<string, NodeTone> = {
  start: {
    icon: 'text-emerald-600 dark:text-emerald-400',
    accent: 'border-l-emerald-500',
    label: 'text-emerald-600 dark:text-emerald-400',
  },
  end: {
    icon: 'text-rose-600 dark:text-rose-400',
    accent: 'border-l-rose-500',
    label: 'text-rose-600 dark:text-rose-400',
  },
  decision: {
    icon: 'text-amber-600 dark:text-amber-400',
    accent: 'border-l-amber-500',
    label: 'text-amber-600 dark:text-amber-400',
  },
  wait: {
    icon: 'text-blue-600 dark:text-blue-400',
    accent: 'border-l-blue-500',
    label: 'text-blue-600 dark:text-blue-400',
  },
  signal: {
    icon: 'text-violet-600 dark:text-violet-400',
    accent: 'border-l-violet-500',
    label: 'text-violet-600 dark:text-violet-400',
  },
  subflow: {
    icon: 'text-indigo-600 dark:text-indigo-400',
    accent: 'border-l-indigo-500',
    label: 'text-indigo-600 dark:text-indigo-400',
  },
  task: {
    icon: 'text-slate-500 dark:text-slate-400',
    accent: 'border-l-slate-400',
    label: 'text-slate-500 dark:text-slate-400',
  },
  record: {
    icon: 'text-cyan-600 dark:text-cyan-400',
    accent: 'border-l-cyan-500',
    label: 'text-cyan-600 dark:text-cyan-400',
  },
  integration: {
    icon: 'text-fuchsia-600 dark:text-fuchsia-400',
    accent: 'border-l-fuchsia-500',
    label: 'text-fuchsia-600 dark:text-fuchsia-400',
  },
  approval: {
    icon: 'text-teal-600 dark:text-teal-400',
    accent: 'border-l-teal-500',
    label: 'text-teal-600 dark:text-teal-400',
  },
};

export function nodeTone(type: string): NodeTone {
  switch (type) {
    case 'start':
      return TONES.start;
    case 'end':
      return TONES.end;
    case 'decision':
    case 'branch':
    case 'gateway':
    case 'parallel_gateway':
    case 'join_gateway':
    case 'parallel':
      return TONES.decision;
    case 'wait':
    case 'timer':
    case 'delay':
      return TONES.wait;
    case 'boundary_event':
    case 'signal':
      return TONES.signal;
    case 'subflow':
    case 'flow':
      return TONES.subflow;
    case 'approval':
      return TONES.approval;
    case 'create_record':
    case 'update_record':
    case 'delete_record':
    case 'get_record':
      return TONES.record;
    case 'http_request':
    case 'connector_action':
    case 'script':
    case 'webhook':
    case 'service_task':
    case 'script_task':
      return TONES.integration;
    default:
      return TONES.task;
  }
}

/**
 * Renders the glyph for a node type. Uses `createElement` (rather than binding
 * the resolved icon to a capitalized local) so the renderer stays a stable
 * module-scope component instead of one re-created on every parent render.
 */
export function NodeTypeIcon({ type, className }: { type: string; className?: string }) {
  return React.createElement(nodeIcon(type), { className, 'aria-hidden': true });
}

export interface PaletteItem {
  type: string;
  label: string;
  hint?: string;
}

/** Node types offered by the add-node palette (spec `FlowNodeAction`). */
export const NODE_PALETTE: PaletteItem[] = [
  { type: 'create_record', label: 'Create record', hint: 'Insert a new record' },
  { type: 'update_record', label: 'Update record', hint: 'Modify an existing record' },
  { type: 'get_record', label: 'Get record', hint: 'Query records' },
  { type: 'decision', label: 'Decision', hint: 'Branch on a condition' },
  { type: 'loop', label: 'Loop', hint: 'Iterate over a collection' },
  { type: 'http_request', label: 'HTTP request', hint: 'Call an external API' },
  { type: 'connector_action', label: 'Connector', hint: 'Run an integration action' },
  { type: 'script', label: 'Script', hint: 'Run custom code' },
  { type: 'approval', label: 'Approval', hint: 'Pause for a human decision' },
  { type: 'subflow', label: 'Subflow', hint: 'Invoke another flow' },
  { type: 'wait', label: 'Wait', hint: 'Pause for an event or timer' },
  { type: 'end', label: 'End', hint: 'Terminate the flow' },
];

/** Human-friendly default label for a newly created node of `type`. */
export function defaultNodeLabel(type: string): string {
  const item = NODE_PALETTE.find((p) => p.type === type);
  if (item) return item.label;
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Spec-valid seed fields for a newly created node, so structured blocks start
 * in a valid-ish shape (e.g. a wait node already has a timer eventType) rather
 * than an empty intermediate state. Returns extra node props to spread in.
 */
export function defaultNodeExtras(type: string): Record<string, unknown> {
  switch (type) {
    case 'start':
      return {};
    case 'wait':
      return { waitEventConfig: { eventType: 'timer', onTimeout: 'fail' } };
    case 'connector_action':
      return { connectorConfig: { connectorId: '', actionId: '', input: {} } };
    case 'boundary_event':
      return { boundaryConfig: { attachedToNodeId: '', eventType: 'error', interrupting: true } };
    case 'approval':
      // Seed a node-model approval: at least one approver + spec defaults. The
      // author wires the out-edges with labels `approve` / `reject`.
      return { config: { approvers: [{ type: 'manager' }], behavior: 'first_response', lockRecord: true } };
    case 'http_request':
      return { config: { method: 'GET' } };
    case 'script':
      return {};
    default:
      return {};
  }
}

export interface NodeCardProps {
  id: string;
  type: string;
  label: string;
  summary?: string;
  position: Point;
  selected: boolean;
  editable: boolean;
  /** Simulation overlay: the currently-executing or already-visited node. */
  runState?: 'active' | 'visited';
  /** Dim nodes not yet reached while a simulation is in progress. */
  dimmed?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onSelect?: () => void;
  onAppend?: () => void;
}

/**
 * A single draggable flow node rendered at an absolute canvas coordinate.
 * The card body drives selection + reposition; a dedicated bottom "+" handle
 * (edit mode only) appends a connected child without ambiguity.
 */
export function NodeCard({
  type,
  label,
  summary,
  position,
  selected,
  editable,
  runState,
  dimmed,
  onPointerDown,
  onSelect,
  onAppend,
}: NodeCardProps) {
  const tone = nodeTone(type);
  return (
    <div
      className="absolute transition-opacity"
      style={{ left: position.x, top: position.y, width: NODE_W, height: NODE_H, opacity: dimmed ? 0.4 : 1 }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onPointerDown={onPointerDown}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect?.();
          }
        }}
        className={cn(
          'group flex h-full w-full items-center gap-2.5 rounded-lg border border-l-[3px] bg-card px-3 py-2 text-left shadow-sm transition-all outline-none',
          'hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary/40',
          tone.accent,
          editable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
          runState === 'active'
            ? 'border-sky-500 ring-2 ring-sky-400/60 animate-pulse'
            : runState === 'visited'
              ? 'border-emerald-500/70 ring-1 ring-emerald-400/40'
              : selected
                ? 'border-primary ring-2 ring-primary/30'
                : 'border-border',
        )}
      >
        <NodeTypeIcon type={type} className={cn('h-4 w-4 shrink-0', tone.icon)} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium leading-tight">{label}</div>
          <div className={cn('truncate text-[10px] font-medium uppercase tracking-wide', tone.label)}>
            {type}
          </div>
        </div>
        {summary && (
          <div className="max-w-[40%] shrink-0 truncate font-mono text-[10px] text-muted-foreground">
            {summary}
          </div>
        )}
      </div>
      {editable && type !== 'end' && (
        <button
          type="button"
          title="Add connected node"
          aria-label="Add connected node"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onAppend?.();
          }}
          className={cn(
            'absolute left-1/2 -bottom-3 z-10 inline-flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors',
            'opacity-0 hover:border-primary hover:text-primary group-hover:opacity-100 focus-visible:opacity-100',
          )}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export interface NodePaletteProps {
  locale?: string;
  /** Node types to offer. Defaults to the hardcoded {@link NODE_PALETTE}. */
  items?: PaletteItem[];
  onPick: (type: string) => void;
  onClose: () => void;
}

/** Compact popover listing the node types an author can add. */
export function NodePalette({ items = NODE_PALETTE, onPick, onClose }: NodePaletteProps) {
  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} aria-hidden />
      <div className="absolute right-0 top-full z-30 mt-1 max-h-[60vh] w-56 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
        {items.map((item) => {
          const tone = nodeTone(item.type);
          return (
            <button
              key={item.type}
              type="button"
              onClick={() => onPick(item.type)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-accent"
            >
              <NodeTypeIcon type={item.type} className={cn('h-4 w-4 shrink-0', tone.icon)} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{item.label}</div>
                {item.hint && (
                  <div className="truncate text-[11px] text-muted-foreground">{item.hint}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
