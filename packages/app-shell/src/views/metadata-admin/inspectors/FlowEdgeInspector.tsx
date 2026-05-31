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
  InspectorCheckboxField,
  InspectorRemoveButton,
  InspectorEmptyState,
  spliceArray,
} from './_shared';
import { Label } from '@object-ui/components';
import { edgeKey, conditionText } from '../previews/flow-canvas-layout';

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
    onPatch({ edges: spliceArray(edges, index, next) });
  };

  const isDefault = edge.isDefault === true;

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
    </InspectorShell>
  );
}
