// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FlowReferenceField — an *editable combobox* for flow-node config values that
 * are really references (an object's field, an object/flow/role by name, or
 * another node in this flow) rather than free-form strings.
 *
 * Why a combobox and not a strict dropdown: the designer must never trap the
 * author. The control suggests known values (fetched per {@link ReferenceKind})
 * but always accepts free text, so a field that doesn't exist yet, a role the
 * current tenant hasn't populated, or an empty catalog all still let the author
 * type a value. Implemented with a native `<datalist>` for exactly that
 * suggest-but-allow-anything behaviour, zero extra dependencies, and built-in
 * accessibility.
 *
 * Data sources are resolved lazily from the running backend (the same source of
 * truth as the rest of the designer); `object-field` additionally needs to know
 * *which* object — resolved from the reference's `objectSource` against the
 * flow draft (trigger object) or the node's sibling config.
 */

import * as React from 'react';
import { Input, Label } from '@object-ui/components';
import type { FlowConfigField, FlowReferenceSpec } from './flow-node-config';
import { useMetadataClient } from '../useMetadata';
import { useObjectFields } from '../previews/useObjectFields';

/** Context the reference picker needs to resolve dynamic option sources. */
export interface FlowReferenceContext {
  /** The whole flow draft — used for `$trigger` object + the node list. */
  draft: Record<string, unknown>;
  /** The node currently being edited — used to resolve sibling config keys. */
  node: Record<string, unknown> | null;
}

interface Option {
  value: string;
  label: string;
}

/** Read `node.config[key]` as a non-empty string, else undefined. */
function configString(node: Record<string, unknown> | null | undefined, key: string): string | undefined {
  const cfg = node?.config;
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return undefined;
  const v = (cfg as Record<string, unknown>)[key];
  return typeof v === 'string' && v ? v : undefined;
}

/** Resolve the target object name for an `object-field` reference. */
function resolveObjectName(ref: FlowReferenceSpec | undefined, ctx: FlowReferenceContext): string | undefined {
  if (!ref || ref.kind !== 'object-field') return undefined;
  const src = ref.objectSource || '$trigger';
  if (src === '$trigger') {
    const nodes = Array.isArray(ctx.draft.nodes) ? (ctx.draft.nodes as Array<Record<string, unknown>>) : [];
    const start = nodes.find((n) => n?.type === 'start');
    return configString(start, 'objectName');
  }
  // A sibling config key on the same node (CRUD nodes carry their own objectName).
  return configString(ctx.node, src);
}

/**
 * Fetch a metadata type's items as combobox options. `type === undefined`
 * disables the fetch (returns empty), so the hook can be called
 * unconditionally regardless of the reference kind.
 */
function useMetadataListOptions(type: string | undefined): { options: Option[]; loading: boolean } {
  const client = useMetadataClient();
  const [state, setState] = React.useState<{ options: Option[]; loading: boolean }>({
    options: [],
    loading: !!type,
  });
  React.useEffect(() => {
    if (!type) {
      setState({ options: [], loading: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    client
      .list<{ name?: string; label?: string }>(type)
      .then((rows) => {
        if (cancelled) return;
        const options = (Array.isArray(rows) ? rows : [])
          .filter((r) => r && typeof r.name === 'string' && r.name)
          .map((r) => ({
            value: String(r.name),
            label: typeof r.label === 'string' && r.label && r.label !== r.name ? `${r.label} (${r.name})` : String(r.name),
          }));
        setState({ options, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ options: [], loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [client, type]);
  return state;
}

export interface FlowReferenceFieldProps {
  field: FlowConfigField;
  value: unknown;
  onCommit: (value: unknown) => void;
  disabled?: boolean;
  context?: FlowReferenceContext;
}

export function FlowReferenceField({ field, value, onCommit, disabled, context }: FlowReferenceFieldProps) {
  const listId = React.useId();
  const ref = field.ref;
  const ctx: FlowReferenceContext = context ?? { draft: {}, node: null };
  const kind = ref?.kind;

  // object-field: resolve the target object, then its field catalog.
  const objectName = resolveObjectName(ref, ctx);
  const { fields: objectFields } = useObjectFields(kind === 'object-field' ? objectName : undefined);

  // object / flow / role: list the metadata type.
  const listType = kind === 'object' ? 'object' : kind === 'flow' ? 'flow' : kind === 'role' ? 'role' : undefined;
  const { options: listOptions } = useMetadataListOptions(listType);

  const options = React.useMemo<Option[]>(() => {
    switch (kind) {
      case 'object-field':
        return objectFields.map((f) => ({
          value: f.name,
          label: f.label && f.label !== f.name ? `${f.label} (${f.name})` : f.name,
        }));
      case 'object':
      case 'flow':
      case 'role':
        return listOptions;
      case 'node': {
        const nodes = Array.isArray(ctx.draft.nodes) ? (ctx.draft.nodes as Array<Record<string, unknown>>) : [];
        const currentId = typeof ctx.node?.id === 'string' ? ctx.node.id : undefined;
        return nodes
          .filter((n) => typeof n?.id === 'string' && n.id && n.id !== currentId)
          .map((n) => {
            const id = String(n.id);
            const lbl = typeof n.label === 'string' && n.label ? `${n.label} (${id})` : id;
            return { value: id, label: lbl };
          });
      }
      default:
        return [];
    }
  }, [kind, objectFields, listOptions, ctx.draft, ctx.node]);

  // For an object-field whose object can't be resolved, tell the author why the
  // suggestions are empty — but still let them type a value.
  const unresolvedObject = kind === 'object-field' && !objectName;

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{field.label}</Label>
      <Input
        list={options.length ? listId : undefined}
        value={value != null ? String(value) : ''}
        onChange={(e) => onCommit(e.target.value)}
        placeholder={field.placeholder}
        disabled={disabled}
        className="h-8 text-sm"
      />
      {options.length > 0 && (
        <datalist id={listId}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </datalist>
      )}
      {kind === 'object-field' && objectName && (
        <p className="text-[11px] leading-snug text-muted-foreground">Fields of {objectName}.</p>
      )}
      {unresolvedObject && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Set the flow’s trigger object (on the Start node) to list fields.
        </p>
      )}
    </div>
  );
}
