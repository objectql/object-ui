// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Bridge between framework metadata `Object.fields` (a record of rich
 * 48-type field definitions) and the lighter `DesignerFieldDefinition[]`
 * shape consumed by `@object-ui/plugin-designer`'s `FieldDesigner`.
 *
 * Why this exists: the designer ships with a curated subset (27 types,
 * no `master_detail`, no `tree`, no `multiselect`, etc.). Letting it
 * own the full draft would silently drop properties on round-trip. So
 * the bridge:
 *
 *  - converts the supported subset for editing,
 *  - quarantines unknown types into a "preserved" bucket keyed by
 *    field name, and
 *  - reassembles the full record on commit, putting preserved entries
 *    back in their original order/shape so nothing the user can't see
 *    is destroyed.
 */

import { DESIGNER_FIELD_TYPES } from '@object-ui/types';
import type {
  DesignerFieldDefinition,
  DesignerFieldType,
} from '@object-ui/types';

/**
 * Set of types the designer can edit losslessly — derived from the canonical
 * `DESIGNER_FIELD_TYPES` vocabulary rather than restated (objectui#3017), so
 * this bridge and `FieldDesigner`'s palette cannot drift by construction.
 */
const DESIGNER_TYPES: ReadonlySet<DesignerFieldType> = new Set(DESIGNER_FIELD_TYPES);

interface FrameworkFieldDef {
  type?: string;
  label?: string;
  required?: boolean;
  unique?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  description?: string;
  default?: unknown;
  placeholder?: string;
  options?: Array<{ label?: string; value: string; color?: string }>;
  reference?: string;
  // No declared `formula` (objectui#6043) — nothing reads or writes it any
  // more. A legacy def that still carries one reaches this type through the
  // index signature below, and a QUARANTINED field round-trips verbatim.
  group?: string;
  [k: string]: unknown;
}

export interface FieldsBridgeResult {
  /** Editable subset shaped for FieldDesigner. */
  designerFields: DesignerFieldDefinition[];
  /**
   * Preserves the original framework definitions for fields the
   * designer can't edit losslessly. Keyed by field name. Round-tripped
   * verbatim on commit.
   */
  preserved: Map<string, FrameworkFieldDef>;
  /**
   * Captured input shape (`'record'` or `'array'`) so we commit back
   * in the same shape we received.
   */
  inputShape: 'record' | 'array';
  /**
   * Ordered list of all field names as they appeared on input; the
   * commit function uses it to preserve user-visible ordering.
   */
  originalOrder: string[];
}

/** Try to map a framework field type to a designer type; null if unsupported. */
function mapFrameworkToDesignerType(t: string | undefined): DesignerFieldType | null {
  if (!t) return null;
  if (DESIGNER_TYPES.has(t as DesignerFieldType)) return t as DesignerFieldType;
  // Best-effort fallbacks for the most common "close cousin" types.
  switch (t) {
    case 'richtext':
      return 'html';
    case 'toggle':
      return 'boolean';
    case 'multiselect':
    case 'checkboxes':
    case 'radio':
      return 'select';
    case 'master_detail':
    case 'tree':
      return 'lookup';
    default:
      return null;
  }
}

export function bridgeFromDraft(fieldsInput: unknown): FieldsBridgeResult {
  const preserved = new Map<string, FrameworkFieldDef>();
  const designerFields: DesignerFieldDefinition[] = [];
  const originalOrder: string[] = [];

  if (!fieldsInput || typeof fieldsInput !== 'object') {
    return { designerFields, preserved, inputShape: 'record', originalOrder };
  }

  const isArray = Array.isArray(fieldsInput);
  const inputShape: 'record' | 'array' = isArray ? 'array' : 'record';

  const entries: Array<[string, FrameworkFieldDef]> = isArray
    ? (fieldsInput as FrameworkFieldDef[]).map((def, i) => [
        String(def?.name ?? `field_${i + 1}`),
        def,
      ])
    : Object.entries(fieldsInput as Record<string, FrameworkFieldDef>);

  for (const [name, def] of entries) {
    originalOrder.push(name);
    const mapped = mapFrameworkToDesignerType(def?.type);
    if (mapped === null) {
      // Quarantine — preserve as-is, do not surface in the designer.
      preserved.set(name, def);
      continue;
    }
    designerFields.push({
      id: name, // FieldDesigner uses id as React key; using `name` is stable across edits.
      name,
      label: String(def?.label ?? name),
      type: mapped,
      required: !!def?.required,
      unique: !!def?.unique,
      readonly: !!def?.readonly,
      hidden: !!def?.hidden,
      description: typeof def?.description === 'string' ? def.description : undefined,
      defaultValue: def?.default,
      placeholder: typeof def?.placeholder === 'string' ? def.placeholder : undefined,
      group: typeof def?.group === 'string' ? def.group : undefined,
      options: Array.isArray(def?.options)
        ? def!.options!.map((o) => ({
            label: String(o.label ?? o.value),
            value: String(o.value),
            color: o.color,
          }))
        : undefined,
      referenceTo: typeof def?.reference === 'string' ? def.reference : undefined,
    });
  }

  return { designerFields, preserved, inputShape, originalOrder };
}

/**
 * Reassemble the framework-shape fields record from designer output.
 * Preserved fields are spliced back in their original order. Newly
 * added fields land at the end.
 */
export function commitToDraft(
  designerFields: DesignerFieldDefinition[],
  prev: FieldsBridgeResult,
): Record<string, FrameworkFieldDef> | FrameworkFieldDef[] {
  const designerByName = new Map<string, DesignerFieldDefinition>();
  for (const f of designerFields) designerByName.set(f.name, f);

  const writeName = (name: string, target: Record<string, FrameworkFieldDef>) => {
    const preserved = prev.preserved.get(name);
    if (preserved) {
      target[name] = preserved;
      return;
    }
    const f = designerByName.get(name);
    if (f) {
      target[name] = serializeDesignerField(f);
    }
  };

  const result: Record<string, FrameworkFieldDef> = {};

  // First emit fields in their original order to preserve user-visible
  // ordering and keep diff noise low for unchanged drafts.
  for (const name of prev.originalOrder) {
    if (designerByName.has(name) || prev.preserved.has(name)) {
      writeName(name, result);
    }
  }
  // Then append any newly added designer fields (not in originalOrder).
  for (const f of designerFields) {
    if (!prev.originalOrder.includes(f.name)) {
      result[f.name] = serializeDesignerField(f);
    }
  }

  if (prev.inputShape === 'array') {
    return Object.entries(result).map(([name, def]) => ({ name, ...def }));
  }
  return result;
}

function serializeDesignerField(f: DesignerFieldDefinition): FrameworkFieldDef {
  const out: FrameworkFieldDef = {
    type: f.type,
    label: f.label,
  };
  if (f.required) out.required = true;
  if (f.unique) out.unique = true;
  if (f.readonly) out.readonly = true;
  if (f.hidden) out.hidden = true;
  if (f.description) out.description = f.description;
  if (f.defaultValue !== undefined) out.default = f.defaultValue;
  if (f.placeholder) out.placeholder = f.placeholder;
  if (f.group) out.group = f.group;
  if (f.options && f.options.length > 0) out.options = f.options;
  if (f.referenceTo) out.reference = f.referenceTo;
  // No `formula` (objectui#6043). This bridge was a THIRD emit site for the
  // key, named by neither the card nor `check-designer-field-key-parity.mjs` —
  // `FrameworkFieldDef` is not one of that gate's declared `PAYLOAD_SHAPES`, so
  // the gate was green over it. `FieldSchema` refuses `formula` BY NAME, and it
  // is not renamed to `expression` here for the same reason as everywhere else
  // on this card: the schema accepts the key without parsing the CEL, so a
  // rename ships an unevaluatable expression under a valid name.
  return out;
}
