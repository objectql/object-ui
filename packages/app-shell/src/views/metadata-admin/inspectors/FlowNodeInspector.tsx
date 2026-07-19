// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FlowNodeInspector — scoped editor for the selected flow node.
 *
 * Selection shape:  { kind: 'node', id: <nodeId> }         — a top-level node
 *                   { kind: 'nested-node', id: <path> }    — a node inside a
 *                     container region (loop/parallel/try_catch, #2670)
 * Patches:          via `locateFlowNode(...).write` — top-level nodes splice
 *                   `draft.nodes[i]`; nested nodes rebuild the container's
 *                   `config.<region>.nodes[i]` with explicit spreads.
 *
 * Both share the SAME schema-driven form. Beyond id / label / type /
 * description, each node type exposes a set of typed form fields (see
 * `flow-node-config`, or the engine-published configSchema) that edit scalar
 * keys on `node.config`; remaining keys go to an "Advanced (JSON)" block so
 * authors are never locked out. A nested node is edit-only this phase: its id is
 * read-only, it has no delete, and (for a nested decision) the virtual Target
 * column is dropped — region-internal routing is not managed here.
 */

import * as React from 'react';
import { Plus } from 'lucide-react';
import type { MetadataInspectorProps } from '../inspector-registry';
import { t } from '../i18n';
import {
  InspectorShell,
  InspectorTextField,
  InspectorSelectField,
  InspectorRemoveButton,
  InspectorEmptyState,
} from './_shared';
import {
  fieldsForNodeType,
  isFieldVisible,
  getFieldValue,
  configKeyOf,
  FLOW_NODE_TYPE_OPTIONS,
  type FlowConfigField,
} from './flow-node-config';
import { jsonSchemaToFlowFields } from './json-schema-to-fields';
import { applyDecisionBranches, syncDecisionEdgesByOrder, withBranchTargets } from './flow-decision-edges';
import { useActionConfigSchemas } from '../previews/useFlowNodePalette';
import { FlowNodeConfigField } from './FlowNodeConfigField';
import { useFlowScope } from './useFlowScope';
import { nodeOutputRefs, type ScopeRef } from './flow-scope';
import { NESTED_NODE_KIND, parseNestedNodeId, locateFlowNode } from './flow-nested-selection';
import { ScreenPreview } from '../previews/ScreenPreview';

interface FlowNode {
  id: string;
  type?: string;
  label?: string;
  description?: string;
  config?: Record<string, unknown>;
  [k: string]: unknown;
}

interface FlowEdge {
  id?: string;
  source: string;
  target: string;
  condition?: unknown;
  label?: string;
  isDefault?: boolean;
  type?: string;
  [k: string]: unknown;
}

/**
 * The decision Branches editor field: the `config.conditions` list whose
 * columns include the virtual `target` column (#1942). For it, the value shown
 * is augmented with per-branch targets derived from the out-edges, and a
 * commit reconciles the chosen targets back onto the edges — see
 * `flow-decision-edges` for the full semantics.
 */
function isBranchTargetField(field: FlowConfigField): boolean {
  return (
    field.kind === 'objectList' &&
    configKeyOf(field) === 'conditions' &&
    (field.columns ?? []).some((c) => c.key === 'target')
  );
}

function asConfig(node: FlowNode | null): Record<string, unknown> {
  const c = node?.config;
  return c && typeof c === 'object' && !Array.isArray(c) ? (c as Record<string, unknown>) : {};
}

/**
 * Immutably set `value` at `path` on a plain object, pruning any intermediate
 * object that becomes empty (so e.g. clearing the last `waitEventConfig` key
 * removes the whole block). Empty string / null / undefined deletes the leaf.
 */
function setAtPath(obj: Record<string, unknown>, path: string[], value: unknown): Record<string, unknown> {
  const [head, ...rest] = path;
  const next: Record<string, unknown> = { ...obj };
  if (rest.length === 0) {
    if (value === undefined || value === null || value === '') delete next[head];
    else next[head] = value;
  } else {
    const cur = next[head];
    const base = cur && typeof cur === 'object' && !Array.isArray(cur) ? (cur as Record<string, unknown>) : {};
    const child = setAtPath(base, rest, value);
    if (Object.keys(child).length === 0) delete next[head];
    else next[head] = child;
  }
  return next;
}

export function FlowNodeInspector({ selection, draft, onPatch, onClearSelection, locale, readOnly }: MetadataInspectorProps) {
  // Resolve the selection to a node + how to write it back — a top-level draft
  // node, or a node nested inside a container region (#2670). Every edit goes
  // through loc.write, so the inspector never branches on where the node lives.
  // Memoized on (draft, selection) so its `write` closure and identity stay
  // stable between edits (keeps the nested-scope memo below from thrashing).
  const loc = React.useMemo(
    () => locateFlowNode(draft as Record<string, unknown>, selection),
    [draft, selection],
  );
  const node = loc?.node ?? null;

  // Server-driven property form: when the running engine publishes a config
  // JSON Schema for this node type (ADR-0018 §configSchema — e.g. the ADR-0019
  // approval node), derive the form from it so the designer stays in lock-step
  // with the backend. Falls back to the hardcoded field group when no schema is
  // published (offline / plugin absent / older backend).
  const configSchemas = useActionConfigSchemas();
  // A nested node anchors its scope on the container (ADR-0031 outer scope). The
  // container's own outputs — a loop's iteratorVariable — are excluded from the
  // graph walk at its id, so inject the loop group explicitly for a body node.
  const nestedLoopRefs = React.useMemo<ScopeRef[]>(
    () => (loc?.nested && loc.container ? nodeOutputRefs(loc.container).filter((r) => r.group === 'loop') : []),
    [loc],
  );
  // In-scope variable references for this node, for the data-picker (#1934).
  const { groups: scopeGroups } = useFlowScope(draft as Record<string, unknown>, loc?.scopeAnchorId, nestedLoopRefs);
  const fields = React.useMemo(() => {
    const schema = node?.type ? configSchemas[node.type] : undefined;
    const serverFields = schema !== undefined ? jsonSchemaToFlowFields(schema) : null;
    return serverFields ?? fieldsForNodeType(node?.type);
  }, [configSchemas, node?.type]);
  const config = asConfig(node);
  const visibleFields = fields.filter((f) => isFieldVisible(f, node, fields));

  // `{var}` interpolation source for the screen preview — the flow's declared
  // variables and their defaults (the designer has no live run state).
  const screenVars = React.useMemo(() => {
    const decls = Array.isArray((draft as any).variables) ? ((draft as any).variables as Array<Record<string, unknown>>) : [];
    const out: Record<string, unknown> = {};
    for (const v of decls) if (v && typeof v.name === 'string') out[v.name] = v.defaultValue;
    return out;
  }, [draft]);
  // Only fields stored under `config` "own" a config key; spec-structured
  // blocks (waitEventConfig, etc.) and top-level timeoutMs never suppress an
  // Advanced key.
  const ownedConfigKeys = React.useMemo(() => {
    const s = new Set<string>();
    for (const f of fields) {
      const k = configKeyOf(f);
      if (k) s.add(k);
      // A loose-shape fallback rooted at `config` is claimed too, so a tolerated
      // legacy key (e.g. a wait node's `config.eventType`) never leaks to Advanced.
      if (f.fallbackPath && f.fallbackPath.length >= 2 && f.fallbackPath[0] === 'config') s.add(f.fallbackPath[1]);
    }
    return s;
  }, [fields]);

  const extraJson = React.useMemo(() => {
    const extra = Object.fromEntries(Object.entries(config).filter(([k]) => !ownedConfigKeys.has(k)));
    return Object.keys(extra).length ? JSON.stringify(extra, null, 2) : '';
    // Recompute when the node identity changes (patch) or the known keys change.
  }, [node, ownedConfigKeys]); // eslint-disable-line react-hooks/exhaustive-deps

  const [advText, setAdvText] = React.useState(extraJson);
  const [advError, setAdvError] = React.useState<string | null>(null);
  const [advOpen, setAdvOpen] = React.useState(extraJson.trim() !== '');
  // Reveals the optional custom-keys editor on nodes that currently have none.
  const [advReveal, setAdvReveal] = React.useState(false);
  React.useEffect(() => {
    setAdvText(extraJson);
    setAdvError(null);
    setAdvOpen(extraJson.trim() !== '');
    setAdvReveal(false);
  }, [extraJson]);

  if (!node) {
    // Stale selection (deleted node, or a deep link the draft has moved past).
    // For a nested path, show the node's own id — not the encoded
    // container::region::node string — as the empty-state identity.
    const nestedPath = selection.kind === NESTED_NODE_KIND ? parseNestedNodeId(selection.id) : null;
    const emptyId = nestedPath?.nodeId ?? selection.id;
    return (
      <InspectorShell kindLabel={t('engine.inspector.flowNode.kind', locale)} title={selection.label ?? emptyId} onClose={onClearSelection} closeLabel={t('engine.inspector.flowNode.close', locale)}>
        <InspectorEmptyState message={emptyId} />
      </InspectorShell>
    );
  }

  const patchNode = (updates: Partial<FlowNode>) => {
    const patch = loc?.write({ ...node, ...updates });
    if (patch) onPatch(patch);
  };

  const hasExtras = extraJson.trim() !== '';

  // Screen nodes (and the `user_task` alias) get a live end-user preview.
  const isScreen = node.type === 'screen' || node.type === 'user_task';

  const setField = (field: FlowConfigField, value: unknown) => {
    if (!loc) return;
    const path = field.path;
    let stored = value;
    let nextEdges: FlowEdge[] | undefined;
    // Decision→edge mirroring is TOP-LEVEL only. A top-level decision drives
    // routing via its out-edges (the engine/simulator read edge.condition, not
    // node.config.conditions), and the Branches editor's Target column (#1942)
    // wires each branch to its downstream node. A NESTED decision routes within
    // its region sub-graph, not on draft.edges — mirroring there would forge
    // phantom top-level edges pointing at nested ids, so it is skipped entirely
    // (the virtual Target column is also stripped from nested fields below).
    if (!loc.nested) {
      const draftEdges = Array.isArray((draft as { edges?: unknown }).edges)
        ? ((draft as { edges: FlowEdge[] }).edges)
        : [];
      if (isBranchTargetField(field)) {
        const applied = applyDecisionBranches(node.id, value, draftEdges);
        stored = applied.conditions.length ? applied.conditions : undefined;
        nextEdges = applied.edges;
      } else if (node.type === 'decision' && path.length === 2 && path[0] === 'config' && path[1] === 'conditions') {
        // A decision branch list without a Target column (engine-published
        // configSchema form) keeps the legacy by-order mirror.
        nextEdges = syncDecisionEdgesByOrder(node.id, value, draftEdges);
      }
    }
    let nextNode = setAtPath(node, path, stored);
    // Migrate-on-edit: writing the canonical path drops any looser fallback
    // location, so the node never carries a stale duplicate (engine + designer agree).
    if (field.fallbackPath) nextNode = setAtPath(nextNode, field.fallbackPath, undefined);
    const patch = loc.write(nextNode);
    if (!patch) return;
    if (nextEdges) patch.edges = nextEdges;
    onPatch(patch);
  };

  const commitAdvanced = () => {
    try {
      const parsed = advText.trim() === '' ? {} : JSON.parse(advText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Must be a JSON object');
      // Form-owned config keys always win: the Advanced block may only set keys
      // that no form field owns, so it can never overwrite or resurrect one.
      const knownPart = Object.fromEntries(Object.entries(config).filter(([k]) => ownedConfigKeys.has(k)));
      const extrasPart = Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).filter(([k]) => !ownedConfigKeys.has(k)),
      );
      const merged = { ...knownPart, ...extrasPart };
      setAdvError(null);
      const nextNode: Record<string, unknown> = { ...node };
      if (Object.keys(merged).length === 0) delete nextNode.config;
      else nextNode.config = merged;
      const patch = loc?.write(nextNode);
      if (patch) onPatch(patch);
    } catch (e) {
      setAdvError(String((e as Error).message));
    }
  };

  const remove = () => {
    const patch = loc?.write(null);
    if (patch) onPatch(patch);
    onClearSelection();
  };

  const typeOptions = FLOW_NODE_TYPE_OPTIONS.includes(node.type as (typeof FLOW_NODE_TYPE_OPTIONS)[number])
    ? [...FLOW_NODE_TYPE_OPTIONS]
    : [...FLOW_NODE_TYPE_OPTIONS, node.type ?? ''].filter(Boolean);

  // A nested node has no structural editing this phase (no delete, id is
  // read-only — those live on the container's Advanced JSON).
  const nested = !!loc?.nested;

  return (
    <InspectorShell
      kindLabel={t('engine.inspector.flowNode.kind', locale)}
      title={node.label || node.id}
      onClose={onClearSelection}
      closeLabel={t('engine.inspector.flowNode.close', locale)}
      footer={nested ? undefined : <InspectorRemoveButton label={t('engine.inspector.flowNode.remove', locale)} onClick={remove} disabled={readOnly} />}
    >
      {nested && (
        <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground" aria-label="nested node location">
          <span className="max-w-[45%] truncate font-medium">{loc?.container?.label || loc?.container?.id}</span>
          <span aria-hidden>›</span>
          <span className="truncate">{loc?.regionLabel}</span>
          <span aria-hidden>›</span>
          <span className="max-w-[45%] truncate font-medium text-foreground">{node.label || node.id}</span>
        </div>
      )}
      <InspectorTextField label={t('engine.inspector.flowNode.id', locale)} value={node.id} onCommit={(v) => patchNode({ id: v })} disabled={readOnly || nested} mono />
      {nested && (
        <p className="-mt-1 text-[11px] leading-snug text-muted-foreground">{t('engine.inspector.flowNode.nestedIdHint', locale)}</p>
      )}
      <InspectorTextField label={t('engine.inspector.flowNode.label', locale)} value={node.label ?? ''} onCommit={(v) => patchNode({ label: v })} disabled={readOnly} />
      <InspectorSelectField
        label={t('engine.inspector.flowNode.type', locale)}
        value={node.type}
        options={typeOptions.map((v) => ({ value: v, label: v }))}
        onCommit={(v) => patchNode({ type: v })}
        disabled={readOnly}
      />
      <InspectorTextField
        label={t('engine.inspector.flowNode.description', locale)}
        value={node.description ?? ''}
        onCommit={(v) => patchNode({ description: v || undefined })}
        disabled={readOnly}
      />

      {fields.length === 0 ? (
        <p className="pt-1 text-xs italic text-muted-foreground">
          {t('engine.inspector.flowNode.noConfig', locale)}
        </p>
      ) : (
        visibleFields.length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t('engine.inspector.flowNode.configuration', locale)}
            </span>
            <span className="h-px flex-1 bg-border" aria-hidden />
          </div>
        )
      )}

      {visibleFields.map((field) => {
        const branchTarget = isBranchTargetField(field);
        // A NESTED node can't wire top-level edges, so drop the virtual Target
        // column from its Branches editor and skip the withBranchTargets augment
        // (its region routing is out of scope this phase).
        const effField =
          nested && branchTarget
            ? { ...field, columns: (field.columns ?? []).filter((c) => c.key !== 'target') }
            : field;
        // The Branches editor's Target column (#1942) is virtual: derived from the
        // node's out-edges, never stored on the branch rows (top-level only).
        const value =
          branchTarget && !nested
            ? withBranchTargets(
                node.id,
                getFieldValue(node, field),
                Array.isArray((draft as { edges?: unknown }).edges) ? ((draft as { edges: FlowEdge[] }).edges) : [],
              )
            : getFieldValue(node, effField);
        return (
          <FlowNodeConfigField
            key={field.id}
            field={effField}
            value={value}
            onCommit={(v) => setField(field, v)}
            disabled={readOnly}
            locale={locale}
            context={{ draft, node }}
            scopeGroups={scopeGroups}
          />
        );
      })}

      {isScreen && <ScreenPreview node={node} variables={screenVars} className="mt-1" />}

      {hasExtras || advReveal ? (
        <details
          className="group rounded border bg-muted/20"
          open={advOpen}
          onToggle={(e) => setAdvOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer select-none px-2 py-1.5 text-xs font-medium text-muted-foreground">
            {t('engine.inspector.flowNode.advanced', locale)}
          </summary>
          <div className="space-y-1 border-t p-2">
            <p className="text-[11px] leading-snug text-muted-foreground">{t('engine.inspector.flowNode.advancedHint', locale)}</p>
            <textarea
              value={advText}
              onChange={(e) => setAdvText(e.target.value)}
              onBlur={commitAdvanced}
              disabled={readOnly}
              rows={6}
              placeholder="{ }"
              className="w-full rounded border bg-background px-2 py-1.5 font-mono text-xs"
            />
            {advError && <div className="text-xs text-destructive">{advError}</div>}
          </div>
        </details>
      ) : (
        !readOnly && (
          <button
            type="button"
            onClick={() => {
              setAdvReveal(true);
              setAdvOpen(true);
            }}
            className="inline-flex items-center gap-1 self-start text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            {t('engine.inspector.flowNode.advanced', locale)}
          </button>
        )
      )}
    </InspectorShell>
  );
}
