// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * json-schema-to-fields — adapt an engine-published config JSON Schema into the
 * inspector's {@link FlowConfigField} model, so the flow designer renders a
 * node's property form **from the server** rather than a hardcoded client form.
 *
 * The automation engine owns each node type's config contract: built-in node
 * packs and plugins publish an `ActionDescriptor` whose `configSchema` is the
 * JSON Schema compiled from the executor's Zod (ADR-0018 §configSchema). The
 * approval plugin (ADR-0019) is the first to publish one. Driving the inspector
 * from that schema keeps the property form in lock-step with what the running
 * backend actually validates — when a plugin evolves its config, the designer
 * updates with no client release.
 *
 * We map onto `FlowConfigField[]` (rather than rendering JSON Schema directly)
 * so the existing, polished field widgets — select, boolean, the `objectList`
 * repeater (e.g. approvers), the optional Advanced-JSON escape hatch — are
 * reused unchanged. Anything the mapping can't express (deeply nested objects,
 * unions) is simply left off the form and remains editable in the Advanced
 * block, so authors are never locked out.
 *
 * Scope mirrors what `z.toJSONSchema` emits for real node configs:
 *   • string                      → text  (enum → select)
 *   • number / integer            → number
 *   • boolean                     → boolean
 *   • array of string             → stringList
 *   • array of object             → objectList (columns from item props)
 *   • object (one level)          → flattened sub-fields under config.<key>.*
 *                                   (a nested `enabled: boolean` makes the
 *                                    group's other fields reveal when enabled)
 */

import type { FlowConfigField, FlowConfigColumn, FlowConfigFieldKind, FlowReferenceSpec, ReferenceKind } from './flow-node-config';

/** Loose JSON Schema node shape — we only read the keys we map. */
interface JsonSchemaNode {
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  description?: string;
  title?: string;
  format?: string;
  properties?: Record<string, JsonSchemaNode>;
  items?: JsonSchemaNode;
  required?: string[];
  /**
   * Reference annotation carried from the executor's Zod `.meta({ xRef })`
   * (ADR-0018). Marks a string as a typed reference so the inspector renders a
   * picker instead of free text. Either static (`kind`) or **polymorphic**
   * (`kindFrom` + `map`): the concrete kind is chosen at render time from a
   * sibling field/column value (e.g. an approver's `value` follows its `type`).
   */
  xRef?: { kind?: string; objectSource?: string; kindFrom?: string; map?: Record<string, string> };
}

const REFERENCE_KINDS: ReadonlySet<string> = new Set<ReferenceKind>([
  'object',
  'object-field',
  'flow',
  'role',
  'position',
  'node',
  'user',
  'team',
  'queue',
  'department',
  'connector',
  'email-template',
]);

/**
 * Read a valid `xRef` annotation off a schema node, or undefined. Accepts both
 * the static shape (`{ kind }`) and the polymorphic shape (`{ kindFrom, map }`),
 * validating every referenced kind against {@link REFERENCE_KINDS} so an unknown
 * kind degrades to free text rather than a broken picker.
 */
function refOf(node: JsonSchemaNode): FlowReferenceSpec | undefined {
  const x = node.xRef;
  if (!x || typeof x !== 'object') return undefined;
  const objectSource = typeof x.objectSource === 'string' && x.objectSource ? { objectSource: x.objectSource } : {};

  // Polymorphic: kindFrom + a map of discriminator value → kind.
  if (typeof x.kindFrom === 'string' && x.kindFrom && x.map && typeof x.map === 'object') {
    const map: Record<string, ReferenceKind> = {};
    for (const [disc, kind] of Object.entries(x.map)) {
      if (typeof kind === 'string' && REFERENCE_KINDS.has(kind)) map[disc] = kind as ReferenceKind;
    }
    if (Object.keys(map).length === 0) return undefined;
    return { kindFrom: x.kindFrom, map, ...objectSource };
  }

  // Static: a single concrete kind.
  if (typeof x.kind === 'string' && REFERENCE_KINDS.has(x.kind)) {
    return { kind: x.kind as ReferenceKind, ...objectSource };
  }
  return undefined;
}

/** "approvalStatusField" → "Approval Status Field"; "approve" → "Approve". */
export function humanizeKey(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  if (!spaced) return key;
  return spaced
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function isObject(v: unknown): v is JsonSchemaNode {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** The JSON Schema `type`, normalized to a single string (first non-null of a union). */
function schemaType(node: JsonSchemaNode): string | undefined {
  if (Array.isArray(node.type)) return node.type.find((t) => t !== 'null');
  if (typeof node.type === 'string') return node.type;
  // Infer from shape when `type` is omitted (common with enum-only schemas).
  if (Array.isArray(node.enum)) return 'string';
  if (node.properties) return 'object';
  if (node.items) return 'array';
  return undefined;
}

/** Build `{ value, label }` options from a string enum. */
function enumOptions(values: unknown[]): Array<{ value: string; label: string }> {
  return values
    .filter((v): v is string => typeof v === 'string')
    .map((v) => ({ value: v, label: humanizeKey(v) }));
}

/** Default coerced to the string form the inspector's `defaultValue` expects. */
function defaultString(node: JsonSchemaNode): string | undefined {
  if (node.default === undefined || node.default === null) return undefined;
  if (typeof node.default === 'boolean') return String(node.default);
  if (typeof node.default === 'number') return String(node.default);
  if (typeof node.default === 'string') return node.default;
  return undefined;
}

/** Scalar (non-object, non-array) → field kind. */
function scalarKind(node: JsonSchemaNode): FlowConfigFieldKind | undefined {
  if (Array.isArray(node.enum)) return 'select';
  const t = schemaType(node);
  if (t === 'boolean') return 'boolean';
  if (t === 'number' || t === 'integer') return 'number';
  if (t === 'string') return node.format === 'multiline' ? 'textarea' : 'text';
  return undefined;
}

/** Derive `objectList` columns from an item object's properties. */
function columnsFor(item: JsonSchemaNode): FlowConfigColumn[] {
  const props = item.properties ?? {};
  const cols: FlowConfigColumn[] = [];
  for (const [key, prop] of Object.entries(props)) {
    if (!isObject(prop)) continue;
    const t = schemaType(prop);
    let kind: FlowConfigColumn['kind'];
    let options: Array<{ value: string; label: string }> | undefined;
    // A reference annotation wins over the plain scalar mapping — the column is
    // a typed reference and gets a picker (static or polymorphic via kindFrom).
    const ref = refOf(prop);
    if (ref) {
      kind = 'reference';
    } else if (Array.isArray(prop.enum)) {
      kind = 'select';
      options = enumOptions(prop.enum);
    } else if (t === 'boolean') {
      kind = 'boolean';
    } else {
      kind = 'text';
    }
    cols.push({
      key,
      label: prop.title || humanizeKey(key),
      kind,
      ...(options ? { options } : {}),
      ...(ref ? { ref } : {}),
      // Columns have no help slot — surface the schema description as a hint.
      ...(prop.description ? { placeholder: prop.description } : {}),
    });
  }
  return cols;
}

/** Common field metadata derived from a schema node. */
function meta(node: JsonSchemaNode, key: string): { label: string; help?: string; defaultValue?: string } {
  return {
    label: node.title || humanizeKey(key),
    ...(node.description ? { help: node.description } : {}),
    ...(defaultString(node) ? { defaultValue: defaultString(node) } : {}),
  };
}

/**
 * Convert a published config JSON Schema (an object schema) into the inspector's
 * `FlowConfigField[]`. Property order is preserved. Returns `null` when the
 * schema is not a usable object schema, so callers fall back to their hardcoded
 * field group.
 */
export function jsonSchemaToFlowFields(schema: unknown): FlowConfigField[] | null {
  if (!isObject(schema) || schemaType(schema) !== 'object' || !isObject(schema.properties)) {
    return null;
  }
  const fields: FlowConfigField[] = [];

  for (const [key, prop] of Object.entries(schema.properties)) {
    if (!isObject(prop)) continue;
    const t = schemaType(prop);

    // ── arrays ────────────────────────────────────────────────────────────
    if (t === 'array') {
      const item = isObject(prop.items) ? prop.items : undefined;
      const itemType = item ? schemaType(item) : undefined;
      if (item && itemType === 'object' && isObject(item.properties)) {
        fields.push({ id: key, path: ['config', key], kind: 'objectList', columns: columnsFor(item), ...meta(prop, key) });
      } else if (itemType === 'string') {
        fields.push({ id: key, path: ['config', key], kind: 'stringList', ...meta(prop, key) });
      }
      // arrays of anything else fall through to the Advanced block.
      continue;
    }

    // ── nested object → flatten one level under config.<key>.* ──────────────
    if (t === 'object' && isObject(prop.properties)) {
      const subProps = Object.entries(prop.properties).filter(([, p]) => isObject(p));
      // A boolean `enabled` toggle gates the rest of the group (mirrors the SLA
      // escalation UX): the group's other fields reveal only when it is on.
      const hasEnabled = subProps.some(([k, p]) => k === 'enabled' && schemaType(p as JsonSchemaNode) === 'boolean');
      for (const [subKey, subProp] of subProps) {
        const sp = subProp as JsonSchemaNode;
        const subRef = refOf(sp);
        const kind = subRef ? 'reference' : scalarKind(sp);
        if (!kind) continue; // deeper nesting / unsupported → Advanced block
        const id = `${key}.${subKey}`;
        const isGate = hasEnabled && subKey === 'enabled';
        const field: FlowConfigField = {
          id,
          path: ['config', key, subKey],
          kind,
          // The gate adopts the parent group's label; siblings keep their own.
          ...(isGate ? { label: prop.title || humanizeKey(key), ...(prop.description ? { help: prop.description } : {}), ...(defaultString(sp) ? { defaultValue: defaultString(sp) } : {}) } : meta(sp, subKey)),
          ...(subRef ? { ref: subRef } : {}),
          ...(kind === 'select' && Array.isArray(sp.enum) ? { options: enumOptions(sp.enum) } : {}),
          ...(hasEnabled && !isGate ? { showWhen: { field: `${key}.enabled`, equals: ['true'] } } : {}),
        };
        fields.push(field);
      }
      continue;
    }

    // ── scalars ─────────────────────────────────────────────────────────────
    // A reference annotation (xRef) wins over the plain scalar mapping — the
    // string is really a typed reference and gets a picker.
    const ref = refOf(prop);
    if (ref) {
      fields.push({ id: key, path: ['config', key], kind: 'reference', ref, ...meta(prop, key) });
      continue;
    }
    const kind = scalarKind(prop);
    if (!kind) continue; // unrepresentable → Advanced block
    fields.push({
      id: key,
      path: ['config', key],
      kind,
      ...meta(prop, key),
      ...(kind === 'select' && Array.isArray(prop.enum) ? { options: enumOptions(prop.enum) } : {}),
    });
  }

  return fields;
}
