// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FlowEdgeInspector — scoped editor for the selected flow connection (edge).
 *
 * Selection shape:  { kind: 'edge', id: <edgeKey> }
 * Patches:           draft.edges[i] = {...edge, ...updates}
 *
 * An edge carries the flow's routing semantics between two nodes: an optional
 * branch `label` (e.g. an Approval node's `approve` / `reject` out-edge, a
 * Decision branch name), a guard `condition` (a CEL expression the engine
 * evaluates to pick the branch), and an `isDefault` flag marking the fallback
 * ("else") branch. Source / target are shown read-only — rewiring is done on
 * the canvas, not here — so the edge's identity key stays stable across edits.
 */

import * as React from 'react';
import type { MetadataInspectorProps } from '../inspector-registry';
import { t } from '../i18n';
import {
  InspectorShell,
  InspectorTextField,
  InspectorSelectField,
  InspectorCheckboxField,
  InspectorRemoveButton,
  InspectorEmptyState,
  spliceArray,
} from './_shared';
import { Label } from '@object-ui/components';
import { edgeKey, conditionText } from '../previews/flow-canvas-layout';
import { validateExpressionClient } from './expression-validate';

interface FlowEdge {
  id?: string;
  source: string;
  target: string;
  condition?: string | { source?: string };
  type?: string;
  label?: string;
  isDefault?: boolean;
  [k: string]: unknown;
}

/** Read-only display of an edge endpoint (source / target node id). */
function EndpointRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex h-8 items-center rounded border bg-muted/30 px-2 font-mono text-sm text-muted-foreground">
        {value}
      </div>
    </div>
  );
}

export function FlowEdgeInspector({ selection, draft, onPatch, onClearSelection, locale, readOnly }: MetadataInspectorProps) {
  const edges = Array.isArray((draft as any).edges) ? ((draft as any).edges as FlowEdge[]) : [];
  const index = edges.findIndex((e, i) => edgeKey(e, i) === selection.id);
  const edge = index >= 0 ? edges[index] : null;

  if (!edge) {
    return (
      <InspectorShell
        kindLabel={t('engine.inspector.flowEdge.kind', locale)}
        title={selection.label ?? selection.id}
        onClose={onClearSelection}
        closeLabel={t('engine.inspector.flowEdge.close', locale)}
      >
        <InspectorEmptyState message={t('engine.inspector.flowEdge.missing', locale)} />
      </InspectorShell>
    );
  }

  // Splice an updated edge in place. A field edit never moves the edge in the
  // array, so the row index is stable; but an edge without an explicit `id`
  // keys off `source->target#index`, so we re-point the selection to the fresh
  // key after the patch to keep the panel attached to the same edge.
  const patchEdge = (updates: Partial<FlowEdge>) => {
    const next: FlowEdge = { ...edge, ...updates };
    // Prune empty optional keys so a cleared field doesn't linger in the draft.
    for (const k of ['label', 'condition', 'isDefault'] as const) {
      const v = next[k];
      if (v === undefined || v === '' || v === false) delete next[k];
    }
    // `type` defaults to 'default' (FlowEdgeSchema) — don't persist the noise so
    // a normal edge stays `{ source, target }`; only `back`/`fault`/`conditional`
    // are written.
    if (next.type === 'default' || next.type === '' || next.type === undefined) delete next.type;
    onPatch({ edges: spliceArray(edges, index, next) });
  };

  const isDefault = edge.isDefault === true;

  // Decision out-edges can bind EXPLICITLY to one of the source decision's
  // branches (vs the implicit by-order auto-wire): picking a branch writes its
  // expression / label (or marks the default) onto this edge, so routing stays
  // correct even when edges are connected out of branch order.
  const nodes = Array.isArray((draft as { nodes?: unknown }).nodes)
    ? ((draft as { nodes: Array<Record<string, unknown>> }).nodes)
    : [];
  const sourceNode = nodes.find((n) => n.id === edge.source);
  const branches =
    sourceNode?.type === 'decision' &&
    Array.isArray((sourceNode.config as Record<string, unknown> | undefined)?.conditions)
      ? ((sourceNode.config as { conditions: Array<Record<string, unknown>> }).conditions)
      : [];
  const branchExpr = (b: Record<string, unknown>) => (typeof b.expression === 'string' ? b.expression.trim() : '');
  const branchName = (b: Record<string, unknown>) => (typeof b.label === 'string' ? b.label.trim() : '');
  // Which branch this edge currently represents: the default edge maps to the
  // `true`/empty branch; otherwise match by condition, then by label. '' = custom.
  const selectedBranch = (() => {
    if (!branches.length) return '';
    if (isDefault) {
      const i = branches.findIndex((b) => { const e = branchExpr(b); return e === '' || e === 'true'; });
      return i >= 0 ? String(i) : '';
    }
    const cond = conditionText(edge.condition);
    let i = cond ? branches.findIndex((b) => branchExpr(b) === cond) : -1;
    if (i < 0 && edge.label) i = branches.findIndex((b) => branchName(b) === edge.label);
    return i >= 0 ? String(i) : '';
  })();
  const applyBranch = (key: string) => {
    if (key === '') return; // keep current custom values
    const b = branches[Number(key)];
    if (!b) return;
    const expr = branchExpr(b);
    const lbl = branchName(b) || undefined;
    if (expr === '' || expr === 'true') patchEdge({ isDefault: true, condition: undefined, label: lbl });
    else patchEdge({ isDefault: false, condition: expr, label: lbl });
  };

  // Approval out-edges (ADR-0019/0044) route by branch *label*: the engine
  // resumes down the out-edge whose label matches the decision — `approve` /
  // `reject`, or `revise` (ADR-0044 send-back-for-revision). Offer those as a
  // picker (mirrors APPROVAL_BRANCH_LABELS in @objectstack/spec) so the author
  // need not recall the exact keyword; a free-text label is still allowed.
  const isApprovalSource = sourceNode?.type === 'approval';
  const APPROVAL_BRANCHES: readonly string[] = ['approve', 'reject', 'revise'];
  const currentApprovalBranch = (() => {
    const l = (edge.label ?? '').trim().toLowerCase();
    return APPROVAL_BRANCHES.includes(l) ? l : '';
  })();

  const edgeType = (typeof edge.type === 'string' && edge.type) || 'default';

  return (
    <InspectorShell
      kindLabel={t('engine.inspector.flowEdge.kind', locale)}
      title={selection.label ?? `${edge.source} → ${edge.target}`}
      onClose={onClearSelection}
      closeLabel={t('engine.inspector.flowEdge.close', locale)}
      footer={
        <InspectorRemoveButton
          label={t('engine.inspector.flowEdge.remove', locale)}
          onClick={() => {
            onPatch({ edges: spliceArray(edges, index, null) });
            onClearSelection();
          }}
          disabled={readOnly}
        />
      }
    >
      <EndpointRow label={t('engine.inspector.flowEdge.source', locale)} value={edge.source} />
      <EndpointRow label={t('engine.inspector.flowEdge.target', locale)} value={edge.target} />

      <div className="flex items-center gap-2 pt-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('engine.inspector.flowEdge.routing', locale)}
        </span>
        <span className="h-px flex-1 bg-border" aria-hidden />
      </div>

      {branches.length > 0 && (
        <InspectorSelectField
          label={t('engine.inspector.flowEdge.branch', locale)}
          value={selectedBranch}
          options={[
            ...branches.map((b, i) => {
              const expr = branchExpr(b);
              const nm = branchName(b) || `Branch ${i + 1}`;
              const suffix = expr === '' || expr === 'true' ? ' \u00b7 default' : ` \u00b7 ${expr}`;
              return { value: String(i), label: `${nm}${suffix}` };
            }),
            { value: '', label: '\u2014 Custom \u2014' },
          ]}
          onCommit={applyBranch}
          disabled={readOnly}
        />
      )}

      {isApprovalSource && (
        <InspectorSelectField
          label={t('engine.inspector.flowEdge.approvalBranch', locale)}
          value={currentApprovalBranch}
          options={[
            { value: 'approve', label: t('engine.inspector.flowEdge.branchApprove', locale) },
            { value: 'reject', label: t('engine.inspector.flowEdge.branchReject', locale) },
            { value: 'revise', label: t('engine.inspector.flowEdge.branchRevise', locale) },
            { value: '', label: t('engine.inspector.flowEdge.branchCustom', locale) },
          ]}
          // Picking a branch writes the matching label; "Custom" keeps the
          // free-text label the author typed below.
          onCommit={(v) => { if (v) patchEdge({ label: v }); }}
          disabled={readOnly}
        />
      )}

      <InspectorTextField
        label={t('engine.inspector.flowEdge.label', locale)}
        value={edge.label ?? ''}
        onCommit={(v) => patchEdge({ label: v })}
        placeholder={t('engine.inspector.flowEdge.labelHint', locale)}
        disabled={readOnly || isDefault}
      />
      <InspectorTextField
        label={t('engine.inspector.flowEdge.condition', locale)}
        value={conditionText(edge.condition) ?? ''}
        onCommit={(v) => patchEdge({ condition: v || undefined })}
        placeholder={t('engine.inspector.flowEdge.conditionHint', locale)}
        disabled={readOnly || isDefault}
        mono
      />
      {(() => {
        // ADR-0032 — flag a malformed edge guard (e.g. `{record.x}` brace-in-CEL)
        // inline, with the same corrective message as build/agent validation.
        const issue = isDefault ? null : validateExpressionClient('predicate', edge.condition);
        return issue ? (
          <p className="text-[11px] leading-snug text-destructive" role="alert">
            {issue.message}
          </p>
        ) : null;
      })()}
      <InspectorCheckboxField
        label={t('engine.inspector.flowEdge.isDefault', locale)}
        value={isDefault}
        // The default ("else") branch is taken when no other guard matches, so
        // it carries neither a condition nor a branch label — clear both.
        onCommit={(v) => patchEdge(v ? { isDefault: true, condition: undefined, label: undefined } : { isDefault: false })}
        disabled={readOnly}
      />
      <p className="text-[11px] leading-snug text-muted-foreground">
        {t('engine.inspector.flowEdge.hint', locale)}
      </p>

      <div className="flex items-center gap-2 pt-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('engine.inspector.flowEdge.connection', locale)}
        </span>
        <span className="h-px flex-1 bg-border" aria-hidden />
      </div>
      <InspectorSelectField
        label={t('engine.inspector.flowEdge.type', locale)}
        value={edgeType}
        options={[
          { value: 'default', label: t('engine.inspector.flowEdge.typeDefault', locale) },
          { value: 'conditional', label: t('engine.inspector.flowEdge.typeConditional', locale) },
          { value: 'fault', label: t('engine.inspector.flowEdge.typeFault', locale) },
          { value: 'back', label: t('engine.inspector.flowEdge.typeBack', locale) },
        ]}
        onCommit={(v) => patchEdge({ type: v })}
        disabled={readOnly}
      />
      {edge.type === 'back' && (
        <p className="text-[11px] leading-snug text-amber-600 dark:text-amber-400" role="note">
          {t('engine.inspector.flowEdge.backHint', locale)}
        </p>
      )}
    </InspectorShell>
  );
}
