// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FlowPreview — read-only summary of a Flow metadata draft.
 *
 * A full DAG canvas lives in `@object-ui/plugin-designer` and would
 * pull in ReactFlow + its deps every time the metadata-admin loads,
 * which is too heavy for a glance-preview. Instead we render:
 *
 *   1. A header strip with type / status / runAs / version.
 *   2. A topologically ordered step list inferred from `nodes` +
 *      `edges`. Each step shows label, action type, branch markers,
 *      and outgoing edge conditions so authors can sanity-check the
 *      logic without launching the designer.
 *   3. A variables side panel listing declared flow variables.
 *
 * The renderer is defensive — drafts may be mid-edit with dangling
 * edges or duplicate node ids; we never throw, we just degrade.
 */

import * as React from 'react';
import {
  AlertCircle,
  Bug,
  CircleDot,
  GitBranch,
  History,
  PanelRight,
  Plus,
  Settings2,
  Variable,
  Zap,
} from 'lucide-react';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewMessage, PreviewErrorBoundary } from './PreviewShell';
import { uniqueId, appendArray } from '../inspectors/_shared';
import { t as tr } from '../i18n';
import { FlowCanvas } from './FlowCanvas';
import { edgeKey } from './flow-canvas-layout';
import { NESTED_NODE_KIND, parseNestedNodeId, encodeNestedNodeId } from '../inspectors/flow-nested-selection';
import { FlowSimulatorPanel } from './FlowSimulatorPanel';
import { FlowRunsPanel } from './FlowRunsPanel';
import { ProblemsPanel } from './ProblemsPanel';
import { buildFlowProblems, deriveInvalidElements, type FlowProblem } from './flow-problems';

interface FlowNode {
  id: string;
  type: string;
  label?: string;
  config?: Record<string, unknown>;
  ui?: { x?: number; y?: number };
  [k: string]: unknown;
}

interface FlowEdge {
  id?: string;
  source: string;
  target: string;
  condition?: string | { source?: string };
  type?: string;
  label?: string;
  isDefault?: boolean;
}

interface FlowVariable {
  name: string;
  type?: string;
  defaultValue?: unknown;
  description?: string;
  isInput?: boolean;
  isOutput?: boolean;
}

export function FlowPreview({ draft, editing, selection, onSelectionChange, onPatch, locale, diagnostics }: MetadataPreviewProps) {
  const d = draft as Record<string, unknown>;
  // Memoized so hook deps (validation memo, handleAddNode) get a stable array
  // reference across renders instead of a fresh `[]`/cast each time.
  const nodes = React.useMemo<FlowNode[]>(() => (Array.isArray(d.nodes) ? (d.nodes as FlowNode[]) : []), [d.nodes]);
  const edges = React.useMemo<FlowEdge[]>(() => (Array.isArray(d.edges) ? (d.edges as FlowEdge[]) : []), [d.edges]);
  const variables: FlowVariable[] = Array.isArray(d.variables) ? (d.variables as FlowVariable[]) : [];

  const designMode = !!(editing && onSelectionChange);
  const canEdit = designMode && !!onPatch;
  const selectedId = selection && selection.kind === 'node' ? selection.id : null;
  const selectedEdgeId = selection && selection.kind === 'edge' ? selection.id : null;
  // #2670 Phase 3: a nested-node selection carries an encoded container path in
  // the flat selection id. Decode it HERE — FlowPreview is the only place that
  // speaks the codec; the canvas only ever handles the structured path.
  const selectedNestedPath = React.useMemo(
    () => (selection && selection.kind === NESTED_NODE_KIND ? parseNestedNodeId(selection.id) : null),
    [selection],
  );

  const [showDebug, setShowDebug] = React.useState(false);
  // Variables panel is opt-in: opening a flow should show the full-width canvas,
  // not a mostly-empty side panel (most flows declare no variables).
  const [showVars, setShowVars] = React.useState(false);
  const [showRuns, setShowRuns] = React.useState(false);
  const [showProblems, setShowProblems] = React.useState(false);
  const [runHL, setRunHL] = React.useState<{
    activeNodeId: string | null;
    visitedNodeIds: string[];
    traversedEdgeIds: string[];
  } | null>(null);

  // Unified problem list (structural + server `_diagnostics`) is the SINGLE
  // source for every validation surface — the clickable inline banner, the
  // per-element badges, the red error ring/stroke, and the Problems panel.
  // Recomputed from the live draft so they all clear as the author fixes each issue.
  const problems = React.useMemo<FlowProblem[]>(
    () => buildFlowProblems({ nodes, edges, serverDiagnostics: diagnostics, variables }),
    [nodes, edges, diagnostics, d.variables],
  );
  const errorCount = problems.filter((p) => p.level === 'error').length;
  // Red error ring/stroke derived from the same list (errors only; a cycle
  // paints its whole loop) — no second validateFlowDraft pass.
  const { invalidNodeIds, invalidEdges } = React.useMemo(
    () => deriveInvalidElements(problems),
    [problems],
  );

  // "Reveal" handshake with the canvas: a changing nonce pans to the element.
  const [reveal, setReveal] = React.useState<{ target: FlowProblem['target']; nonce: number } | null>(null);
  const selectedKey = selectedId ? `node:${selectedId}` : (selectedEdgeId ?? null);
  const handleSelectProblem = React.useCallback(
    (p: FlowProblem) => {
      if (p.target.kind === 'node') {
        // Destructure before the .find() closure — TS drops the union narrowing
        // of `p.target` inside a nested callback, so capture nodeId as a string.
        const { nodeId } = p.target;
        const node = nodes.find((n) => n.id === nodeId);
        onSelectionChange?.({ kind: 'node', id: nodeId, label: node?.label || nodeId });
      } else if (p.target.kind === 'edge') {
        onSelectionChange?.({ kind: 'edge', id: p.target.edgeKey, label: `${p.target.source} → ${p.target.target}` });
      }
      setReveal((r) => ({ target: p.target, nonce: (r?.nonce ?? 0) + 1 }));
    },
    [nodes, onSelectionChange],
  );

  const handleAddNode = React.useCallback(() => {
    if (!canEdit) return;
    const existingIds = nodes.map((n) => n.id).filter(Boolean);
    // A flow's first node is its trigger — seed a `start` node (not a generic
    // `task`) so the canvas opens on the canonical entry point and the author
    // adds subsequent steps from there.
    const newNode: FlowNode = { id: uniqueId('node', existingIds), type: 'start', label: 'Start' };
    const next = appendArray(nodes, newNode);
    onPatch!({ nodes: next });
    onSelectionChange?.({ kind: 'node', id: newNode.id, label: newNode.label || newNode.id });
  }, [canEdit, nodes, onPatch, onSelectionChange]);

  // Run history needs the published flow name (the engine keys runs by it).
  const flowName = typeof d.name === 'string' && d.name ? d.name : '';
  const flowType = String(d.type ?? 'autolaunched');
  const status = String(d.status ?? (d.active ? 'active' : 'draft'));
  const runAs = String(d.runAs ?? 'user');
  const version = d.version != null ? String(d.version) : undefined;
  const errorStrategy = (d.errorHandling as any)?.strategy as string | undefined;

  if (nodes.length === 0) {
    return (
      <PreviewShell hint={`flow${designMode ? ' · design' : ''}`}>
        {canEdit ? (
          <div className="p-3">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-dashed px-3 py-2 text-xs text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              onClick={handleAddNode}
            >
              <Plus className="h-3 w-3" />
              {tr('engine.inspector.add.node', locale)}
            </button>
          </div>
        ) : (
          <PreviewMessage>Add nodes in the Form tab to see the flow preview.</PreviewMessage>
        )}
      </PreviewShell>
    );
  }

  return (
    <PreviewShell hint={`flow · ${nodes.length} node${nodes.length === 1 ? '' : 's'}`}>
      <PreviewErrorBoundary fallbackHint="One of the flow nodes or edges is malformed.">
        <div className={
          'grid gap-0 h-full min-h-[440px] ' +
          (showDebug || showVars || showRuns || showProblems ? 'lg:grid-cols-[1fr_240px]' : 'grid-cols-1')
        }>
          {/* Visual canvas */}
          <div className="flex flex-col min-w-0 min-h-0">
            <div className="rounded-none border-b bg-muted/30 px-3 py-2 text-xs flex flex-wrap items-center gap-x-4 gap-y-1">
              <Pill icon={Zap} label="Trigger" value={flowType} />
              <Pill icon={CircleDot} label="Status" value={status} tone={status === 'active' ? 'green' : status === 'draft' ? 'gray' : 'amber'} />
              <Pill icon={Settings2} label="Run as" value={runAs} />
              {version && <Pill label="v" value={version} />}
              {errorStrategy && <Pill icon={GitBranch} label="On error" value={errorStrategy} />}
              <div className="ml-auto flex items-center gap-1.5">
                {!showDebug && !showRuns && !showProblems && (
                  <button
                    type="button"
                    onClick={() => setShowVars((v) => !v)}
                    className={
                      'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ' +
                      (showVars
                        ? 'border-violet-500 bg-violet-50 text-violet-700'
                        : 'border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground')
                    }
                    title={showVars ? 'Hide variables panel' : 'Show variables panel'}
                  >
                    <PanelRight className="h-3 w-3" /> Variables
                  </button>
                )}
                {flowName && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowRuns((v) => !v);
                      setShowDebug(false);
                      setShowProblems(false);
                    }}
                    className={
                      'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ' +
                      (showRuns
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground')
                    }
                    title="Run history from the automation engine"
                  >
                    <History className="h-3 w-3" /> Runs
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowProblems((v) => !v);
                    setShowDebug(false);
                    setShowRuns(false);
                  }}
                  className={
                    'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ' +
                    (showProblems
                      ? 'border-rose-500 bg-rose-50 text-rose-700'
                      : 'border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground')
                  }
                  title="Validation problems"
                >
                  <AlertCircle className="h-3 w-3" /> Problems
                  {problems.length > 0 && (
                    <span
                      className={
                        'ml-0.5 inline-flex min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold ' +
                        (errorCount > 0 ? 'bg-destructive/15 text-destructive' : 'bg-amber-500/15 text-amber-600')
                      }
                    >
                      {problems.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDebug((v) => !v);
                    setShowRuns(false);
                    setShowProblems(false);
                  }}
                  className={
                    'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ' +
                    (showDebug
                      ? 'border-sky-500 bg-sky-50 text-sky-700'
                      : 'border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground')
                  }
                >
                  <Bug className="h-3 w-3" /> Debug
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <FlowCanvas
                nodes={nodes}
                edges={edges}
                editable={canEdit}
                designMode={designMode}
                selectedId={selectedId}
                selectedEdgeId={selectedEdgeId}
                locale={locale}
                activeNodeId={runHL?.activeNodeId ?? null}
                visitedNodeIds={runHL?.visitedNodeIds}
                traversedEdgeIds={runHL?.traversedEdgeIds}
                invalidNodeIds={invalidNodeIds}
                invalidEdges={invalidEdges}
                onRevealProblem={handleSelectProblem}
                problems={problems}
                revealSignal={reveal}
                onSelect={(n) =>
                  n
                    ? onSelectionChange?.({ kind: 'node', id: n.id, label: n.label || n.id })
                    : onSelectionChange?.(null)
                }
                onSelectEdge={(e, key) =>
                  e
                    ? onSelectionChange?.({ kind: 'edge', id: key, label: `${e.source} → ${e.target}` })
                    : onSelectionChange?.(null)
                }
                selectedNestedPath={selectedNestedPath}
                onSelectNested={(path, node) =>
                  path
                    ? onSelectionChange?.({
                        kind: NESTED_NODE_KIND,
                        id: encodeNestedNodeId(path),
                        label: node?.label || path.nodeId,
                      })
                    : onSelectionChange?.(null)
                }
                onPatch={onPatch}
              />
            </div>
          </div>

          {/* Right side panel: Variables (default), the debug simulator, or
              the engine run history. Collapsible so the canvas can use the
              full width. */}
          {showProblems ? (
            <div className="border-l bg-muted/20">
              <ProblemsPanel
                problems={problems}
                selectedKey={selectedKey}
                onSelectProblem={handleSelectProblem}
              />
            </div>
          ) : showDebug ? (
            <div className="border-l bg-muted/20">
              <FlowSimulatorPanel
                nodes={nodes}
                edges={edges}
                variables={variables}
                onRunStateChange={setRunHL}
              />
            </div>
          ) : showRuns && flowName ? (
            <div className="border-l bg-muted/20">
              <FlowRunsPanel flowName={flowName} />
            </div>
          ) : showVars ? (
            <div className="border-l bg-muted/20 p-3 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
              <Variable className="h-3 w-3" /> Variables
            </div>
            {variables.length === 0 ? (
              <div className="text-muted-foreground italic">No variables declared.</div>
            ) : (
              <ul className="space-y-1.5">
                {variables.map((v, i) => (
                  <li key={v.name || i} className="rounded border bg-background p-1.5">
                    <div className="flex items-baseline gap-1 flex-wrap">
                      <span className="font-mono">{v.name}</span>
                      {v.type && (
                        <span className="text-[10px] uppercase text-muted-foreground">
                          {v.type}
                        </span>
                      )}
                      {v.isInput && (
                        <span className="text-[9px] font-semibold uppercase px-1 rounded bg-sky-100 text-sky-700">
                          in
                        </span>
                      )}
                      {v.isOutput && (
                        <span className="text-[9px] font-semibold uppercase px-1 rounded bg-emerald-100 text-emerald-700">
                          out
                        </span>
                      )}
                    </div>
                    {v.defaultValue !== undefined && (
                      <div className="text-[10px] text-muted-foreground font-mono truncate">
                        = {String(v.defaultValue)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          ) : null}
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}

function Pill({
  icon: Icon,
  label,
  value,
  tone = 'gray',
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: 'gray' | 'green' | 'amber';
}) {
  const cls =
    tone === 'green'
      ? 'text-emerald-700'
      : tone === 'amber'
        ? 'text-amber-700'
        : 'text-foreground';
  return (
    <span className="inline-flex items-center gap-1">
      {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
      <span className="text-muted-foreground">{label}:</span>
      <span className={`font-medium ${cls}`}>{value}</span>
    </span>
  );
}
