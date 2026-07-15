// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FlowReferenceField — an *editable combobox* for flow-node config values that
 * are really references (an object's field, an object/flow/role/user/… by name,
 * a connector, an email template, or another node in this flow) rather than
 * free-form strings.
 *
 * Why a combobox and not a strict dropdown: the designer must never trap the
 * author. The control suggests known values (fetched per {@link ReferenceKind})
 * but always accepts free text, so a field that doesn't exist yet, a role the
 * current tenant hasn't populated, or an empty catalog all still let the author
 * type a value. Implemented with a native `<datalist>` for exactly that
 * suggest-but-allow-anything behaviour, zero extra dependencies, and built-in
 * accessibility.
 *
 * Two layers:
 *   • {@link ReferenceCombobox} — the bare control, given an already-resolved
 *     concrete kind. Reused by the `objectList` repeater for per-row reference
 *     cells (e.g. an approver's value).
 *   • {@link FlowReferenceField} — the inspector field wrapper (label + hint),
 *     resolving a *polymorphic* reference against the node's own sibling config.
 *
 * Data sources are resolved lazily from the running backend (the same source of
 * truth as the rest of the designer); `object-field` additionally needs to know
 * *which* object — resolved from the reference's `objectSource` against the
 * flow draft (trigger object) or the node's sibling config.
 */

import * as React from 'react';
import { Input, Label } from '@object-ui/components';
import type { FlowReferenceSpec, ReferenceKind } from './flow-node-config';
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

/**
 * Reference kinds backed by a flat metadata list (`client.list(type)`), mapped
 * to their metadata-type name. `object-field` and `node` are resolved
 * specially (not via a list) and are intentionally absent.
 */
const KIND_TO_META_TYPE: Partial<Record<ReferenceKind, string>> = {
  object: 'object',
  flow: 'flow',
  role: 'role',
  position: 'position',
  user: 'user',
  team: 'team',
  queue: 'queue',
  department: 'department',
  connector: 'connector',
  'email-template': 'email_template',
};

/** A concrete (non-polymorphic) reference resolution. */
export interface ResolvedRef {
  kind: ReferenceKind;
  objectSource?: string;
  connectorSource?: string;
}

/**
 * Resolve a (possibly polymorphic) reference spec to a concrete kind. For a
 * polymorphic spec, `sibling(key)` supplies the discriminator value (the row's
 * `type`, or a sibling config key). Returns undefined when nothing resolves —
 * the caller then renders plain free text.
 */
export function resolveRefKind(
  ref: FlowReferenceSpec | undefined,
  sibling: (key: string) => unknown,
): ResolvedRef | undefined {
  if (!ref) return undefined;
  if (ref.kind) return { kind: ref.kind, objectSource: ref.objectSource, connectorSource: ref.connectorSource };
  if (ref.kindFrom && ref.map) {
    const disc = sibling(ref.kindFrom);
    const k = typeof disc === 'string' ? ref.map[disc] : undefined;
    if (k) return { kind: k, objectSource: ref.objectSource, connectorSource: ref.connectorSource };
  }
  return undefined;
}

/** Read `node.config[key]` as a non-empty string, else undefined. */
function configString(node: Record<string, unknown> | null | undefined, key: string): string | undefined {
  const cfg = node?.config;
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return undefined;
  const v = (cfg as Record<string, unknown>)[key];
  return typeof v === 'string' && v ? v : undefined;
}

/** Resolve the target object name for an `object-field` reference. */
function resolveObjectName(kind: ReferenceKind, objectSource: string | undefined, ctx: FlowReferenceContext): string | undefined {
  if (kind !== 'object-field') return undefined;
  const src = objectSource || '$trigger';
  if (src === '$trigger') {
    const nodes = Array.isArray(ctx.draft.nodes) ? (ctx.draft.nodes as Array<Record<string, unknown>>) : [];
    const start = nodes.find((n) => n?.type === 'start');
    return configString(start, 'objectName');
  }
  // A sibling config key on the same node (CRUD nodes carry their own objectName).
  return configString(ctx.node, src);
}

/**
 * Resolve the chosen connector name for a `connector-action` reference — read
 * from the sibling key on this node's `connectorConfig` block (default
 * `connectorId`), which is where the connector picker writes it.
 */
export function resolveConnectorName(kind: ReferenceKind, connectorSource: string | undefined, ctx: FlowReferenceContext): string | undefined {
  if (kind !== 'connector-action') return undefined;
  const cc = ctx.node?.connectorConfig;
  if (!cc || typeof cc !== 'object' || Array.isArray(cc)) return undefined;
  const v = (cc as Record<string, unknown>)[connectorSource || 'connectorId'];
  return typeof v === 'string' && v ? v : undefined;
}

/** A connector descriptor's action list → combobox options (exported for test). */
export function connectorActionsToOptions(actions: unknown): Option[] {
  if (!Array.isArray(actions)) return [];
  return actions
    .filter((a): a is { key: string; label?: string } => !!a && typeof (a as { key?: unknown }).key === 'string' && !!(a as { key: string }).key)
    .map((a) => ({
      value: a.key,
      label: typeof a.label === 'string' && a.label && a.label !== a.key ? `${a.label} (${a.key})` : a.key,
    }));
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

/**
 * Fetch a connector's actions as combobox options from the runtime connector
 * descriptors (`GET /api/v1/automation/connectors`, each `{ name, actions:
 * [{key,label}] }`). `connectorName === undefined` disables the fetch (so the
 * hook is safe to call unconditionally). Degrades to empty on any failure.
 */
function useConnectorActionOptions(connectorName: string | undefined): { options: Option[]; loading: boolean } {
  const [state, setState] = React.useState<{ options: Option[]; loading: boolean }>({
    options: [],
    loading: !!connectorName,
  });
  React.useEffect(() => {
    if (!connectorName) {
      setState({ options: [], loading: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    fetch('/api/v1/automation/connectors', { credentials: 'include', headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (cancelled) return;
        const connectors = payload?.data?.connectors ?? payload?.connectors ?? [];
        const conn = Array.isArray(connectors)
          ? connectors.find((c: { name?: unknown }) => c?.name === connectorName)
          : undefined;
        setState({ options: connectorActionsToOptions(conn?.actions), loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ options: [], loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [connectorName]);
  return state;
}

export interface ReferenceComboboxProps {
  /** The resolved concrete reference, or undefined → plain free text. */
  resolved: ResolvedRef | undefined;
  value: unknown;
  onCommit: (value: unknown) => void;
  /** Optional blur handler (the `objectList` repeater flushes rows on blur). */
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
  context?: FlowReferenceContext;
  /** Show the "Fields of X." / unresolved hint under the control (default true). */
  showHint?: boolean;
}

/**
 * The bare reference combobox — suggestions for `resolved.kind`, always
 * free-text editable. Hooks are called unconditionally (kind-gated args) so the
 * component is safe to use in a repeater where the kind changes per row.
 */
export function ReferenceCombobox({ resolved, value, onCommit, onBlur, disabled, placeholder, context, showHint = true }: ReferenceComboboxProps) {
  const listId = React.useId();
  const ctx: FlowReferenceContext = context ?? { draft: {}, node: null };
  const kind = resolved?.kind;

  // object-field: resolve the target object, then its field catalog.
  const objectName = resolved ? resolveObjectName(resolved.kind, resolved.objectSource, ctx) : undefined;
  const { fields: objectFields } = useObjectFields(kind === 'object-field' ? objectName : undefined);

  // connector-action: resolve the chosen connector, then its action catalog.
  const connectorName = resolved ? resolveConnectorName(resolved.kind, resolved.connectorSource, ctx) : undefined;
  const { options: connectorActionOptions } = useConnectorActionOptions(kind === 'connector-action' ? connectorName : undefined);

  // Flat metadata-list kinds (object / flow / role / user / team / …).
  const listType = kind && kind !== 'object-field' && kind !== 'node' && kind !== 'connector-action' ? KIND_TO_META_TYPE[kind] : undefined;
  const { options: listOptions } = useMetadataListOptions(listType);

  const options = React.useMemo<Option[]>(() => {
    if (kind === 'object-field') {
      return objectFields.map((f) => ({
        value: f.name,
        label: f.label && f.label !== f.name ? `${f.label} (${f.name})` : f.name,
      }));
    }
    if (kind === 'connector-action') return connectorActionOptions;
    if (kind === 'node') {
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
    if (listType) return listOptions;
    return [];
  }, [kind, listType, objectFields, connectorActionOptions, listOptions, ctx.draft, ctx.node]);

  // For an object-field whose object can't be resolved, tell the author why the
  // suggestions are empty — but still let them type a value.
  const unresolvedObject = kind === 'object-field' && !objectName;
  // Same for a connector-action with no connector chosen yet.
  const unresolvedConnector = kind === 'connector-action' && !connectorName;

  return (
    <div className="w-full space-y-1">
      <Input
        list={options.length ? listId : undefined}
        value={value != null ? String(value) : ''}
        onChange={(e) => onCommit(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
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
      {showHint && kind === 'object-field' && objectName && (
        <p className="text-[11px] leading-snug text-muted-foreground">Fields of {objectName}.</p>
      )}
      {showHint && unresolvedObject && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Set the flow’s trigger object (on the Start node) to list fields.
        </p>
      )}
      {showHint && kind === 'connector-action' && connectorName && (
        <p className="text-[11px] leading-snug text-muted-foreground">Actions of {connectorName}.</p>
      )}
      {showHint && unresolvedConnector && (
        <p className="text-[11px] leading-snug text-muted-foreground">Choose a Connector above to list its actions.</p>
      )}
    </div>
  );
}

export interface FlowReferenceFieldProps {
  field: { label: string; placeholder?: string; ref?: FlowReferenceSpec };
  value: unknown;
  onCommit: (value: unknown) => void;
  disabled?: boolean;
  context?: FlowReferenceContext;
}

/**
 * Inspector field wrapper: a labelled reference combobox. A polymorphic ref is
 * resolved against the node's own sibling config keys (e.g. the script node's
 * `template` follows `actionType`).
 */
export function FlowReferenceField({ field, value, onCommit, disabled, context }: FlowReferenceFieldProps) {
  const node = context?.node ?? null;
  const resolved = resolveRefKind(field.ref, (key) => configString(node, key));
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{field.label}</Label>
      <ReferenceCombobox
        resolved={resolved}
        value={value}
        onCommit={onCommit}
        disabled={disabled}
        placeholder={field.placeholder}
        context={context}
      />
    </div>
  );
}
