// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FlowNodeInspector — scoped editor for the selected flow node.
 *
 * Selection shape:  { kind: 'node', id: <nodeId> }
 * Patches:           draft.nodes[i] = {...node, ...updates}
 *
 * Beyond id / label / type / description, each node type exposes a set of
 * typed form fields (see `flow-node-config`) that edit scalar keys on
 * `node.config`. Any remaining config keys (objects, arrays, bespoke flags)
 * are surfaced in an "Advanced (JSON)" block so authors are never locked out.
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
  spliceArray,
} from './_shared';
import {
  fieldsForNodeType,
  isFieldVisible,
  getFieldValue,
  configKeyOf,
  FLOW_NODE_TYPE_OPTIONS,
} from './flow-node-config';
import { jsonSchemaToFlowFields } from './json-schema-to-fields';
import { useActionConfigSchemas } from '../previews/useFlowNodePalette';
import { FlowNodeConfigField } from './FlowNodeConfigField';

interface FlowNode {
  id: string;
  type?: string;
  label?: string;
  description?: string;
  config?: Record<string, unknown>;
  [k: string]: unknown;
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
  const nodes = Array.isArray((draft as any).nodes) ? ((draft as any).nodes as FlowNode[]) : [];
  const index = nodes.findIndex((n) => n?.id === selection.id);
  const node = index >= 0 ? nodes[index] : null;

  // Server-driven property form: when the running engine publishes a config
  // JSON Schema for this node type (ADR-0018 §configSchema — e.g. the ADR-0019
  // approval node), derive the form from it so the designer stays in lock-step
  // with the backend. Falls back to the hardcoded field group when no schema is
  // published (offline / plugin absent / older backend).
  const configSchemas = useActionConfigSchemas();
  const fields = React.useMemo(() => {
    const schema = node?.type ? configSchemas[node.type] : undefined;
    const serverFields = schema !== undefined ? jsonSchemaToFlowFields(schema) : null;
    return serverFields ?? fieldsForNodeType(node?.type);
  }, [configSchemas, node?.type]);
  const config = asConfig(node);
  const visibleFields = fields.filter((f) => isFieldVisible(f, node, fields));
  // Only fields stored under `config` "own" a config key; spec-structured
  // blocks (waitEventConfig, etc.) and top-level timeoutMs never suppress an
  // Advanced key.
  const ownedConfigKeys = React.useMemo(() => {
    const s = new Set<string>();
    for (const f of fields) {
      const k = configKeyOf(f);
      if (k) s.add(k);
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
    return (
      <InspectorShell kindLabel={t('engine.inspector.flowNode.kind', locale)} title={selection.label ?? selection.id} onClose={onClearSelection} closeLabel={t('engine.inspector.flowNode.close', locale)}>
        <InspectorEmptyState message={selection.id} />
      </InspectorShell>
    );
  }

  const patchNode = (updates: Partial<FlowNode>) => {
    onPatch({ nodes: spliceArray(nodes, index, { ...node, ...updates }) });
  };

  const hasExtras = extraJson.trim() !== '';

  const setField = (path: string[], value: unknown) => {
    const nextNode = setAtPath(node, path, value);
    onPatch({ nodes: spliceArray(nodes, index, nextNode) });
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
      const nextNode = { ...node };
      if (Object.keys(merged).length === 0) delete (nextNode as FlowNode).config;
      else (nextNode as FlowNode).config = merged;
      onPatch({ nodes: spliceArray(nodes, index, nextNode) });
    } catch (e) {
      setAdvError(String((e as Error).message));
    }
  };

  const remove = () => {
    onPatch({ nodes: spliceArray(nodes, index, null) });
    onClearSelection();
  };

  const typeOptions = FLOW_NODE_TYPE_OPTIONS.includes(node.type as (typeof FLOW_NODE_TYPE_OPTIONS)[number])
    ? [...FLOW_NODE_TYPE_OPTIONS]
    : [...FLOW_NODE_TYPE_OPTIONS, node.type ?? ''].filter(Boolean);

  return (
    <InspectorShell
      kindLabel={t('engine.inspector.flowNode.kind', locale)}
      title={node.label || node.id}
      onClose={onClearSelection}
      closeLabel={t('engine.inspector.flowNode.close', locale)}
      footer={<InspectorRemoveButton label={t('engine.inspector.flowNode.remove', locale)} onClick={remove} disabled={readOnly} />}
    >
      <InspectorTextField label={t('engine.inspector.flowNode.id', locale)} value={node.id} onCommit={(v) => patchNode({ id: v })} disabled={readOnly} mono />
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

      {visibleFields.map((field) => (
        <FlowNodeConfigField
          key={field.id}
          field={field}
          value={getFieldValue(node, field)}
          onCommit={(v) => setField(field.path, v)}
          disabled={readOnly}
          locale={locale}
          context={{ draft, node }}
        />
      ))}

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
