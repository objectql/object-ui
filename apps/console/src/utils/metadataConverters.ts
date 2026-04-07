/**
 * Metadata Converters
 *
 * Shared conversion functions for transforming raw metadata API objects
 * (from the ObjectStack spec) to the UI types used by ObjectManager and
 * FieldDesigner components.
 *
 * Extracted from ObjectManagerPage to enable reuse across pages.
 *
 * @module utils/metadataConverters
 */

import type { ObjectDefinition, ObjectDefinitionRelationship, DesignerFieldDefinition, DesignerFieldType } from '@object-ui/types';

// ---------------------------------------------------------------------------
// Raw metadata shapes (from the ObjectStack API)
// ---------------------------------------------------------------------------

/** Loose shape of a metadata object definition from the ObjectStack API. */
export interface MetadataObject {
  name?: string;
  label?: string | { defaultValue?: string; key?: string };
  pluralLabel?: string;
  plural_label?: string;
  description?: string | { defaultValue?: string };
  icon?: string;
  enabled?: boolean;
  fields?: MetadataField[] | Record<string, MetadataField>;
  relationships?: Array<{
    object?: string;
    relatedObject?: string;
    type?: string;
    label?: string;
    name?: string;
    foreign_key?: string;
    foreignKey?: string;
  }>;
}

/** Loose shape of a metadata field definition from the ObjectStack API. */
export interface MetadataField {
  name?: string;
  label?: string | { defaultValue?: string; key?: string };
  type?: string;
  group?: string;
  description?: string;
  help?: string;
  required?: boolean;
  unique?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  defaultValue?: string;
  default_value?: string;
  placeholder?: string;
  options?: Array<string | { label?: string; value: string; color?: string }>;
  externalId?: boolean;
  trackHistory?: boolean;
  track_history?: boolean;
  indexed?: boolean;
  reference_to?: string;
  referenceTo?: string;
  formula?: string;
}

// ---------------------------------------------------------------------------
// Converters
// ---------------------------------------------------------------------------

/**
 * Convert a metadata object definition (from the API/spec) to the ObjectDefinition
 * type used by the ObjectManager component.
 */
export function toObjectDefinition(obj: MetadataObject, index: number): ObjectDefinition {
  const fields = Array.isArray(obj.fields) ? obj.fields : Object.values(obj.fields || {});
  return {
    id: obj.name || `obj_${index}`,
    name: obj.name || '',
    label: typeof obj.label === 'object' ? obj.label.defaultValue || obj.label.key || '' : (obj.label || obj.name || ''),
    pluralLabel: obj.pluralLabel || obj.plural_label || undefined,
    description: typeof obj.description === 'object' ? obj.description.defaultValue : (obj.description || undefined),
    icon: obj.icon || undefined,
    group: obj.name?.startsWith('sys_') ? 'System Objects' : 'Custom Objects',
    sortOrder: index,
    isSystem: obj.name?.startsWith('sys_') || false,
    enabled: obj.enabled !== false,
    fieldCount: fields.length,
    relationships: Array.isArray(obj.relationships)
      ? obj.relationships.map((r) => ({
          relatedObject: r.object || r.relatedObject || '',
          type: (r.type || 'one-to-many') as ObjectDefinitionRelationship['type'],
          label: r.label || r.name || undefined,
          foreignKey: r.foreign_key || r.foreignKey || undefined,
        }))
      : undefined,
  };
}

/**
 * Convert a metadata field definition to the DesignerFieldDefinition
 * type used by the FieldDesigner component.
 */
export function toFieldDefinition(field: MetadataField, index: number): DesignerFieldDefinition {
  return {
    id: field.name || `fld_${index}`,
    name: field.name || '',
    label: typeof field.label === 'object' ? field.label.defaultValue || field.label.key || '' : (field.label || field.name || ''),
    type: (field.type || 'text') as DesignerFieldType,
    group: field.group || undefined,
    sortOrder: index,
    description: field.description || field.help || undefined,
    required: field.required || false,
    unique: field.unique || false,
    readonly: field.readonly || false,
    hidden: field.hidden || false,
    defaultValue: field.defaultValue || field.default_value || undefined,
    placeholder: field.placeholder || undefined,
    options: Array.isArray(field.options)
      ? field.options.map((opt) =>
          typeof opt === 'string'
            ? { label: opt, value: opt }
            : { label: opt.label || opt.value, value: opt.value, color: opt.color }
        )
      : undefined,
    isSystem: field.readonly === true && (field.name === 'id' || field.name === 'createdAt' || field.name === 'updatedAt'),
    externalId: field.externalId || false,
    trackHistory: field.trackHistory || field.track_history || false,
    indexed: field.indexed || false,
    referenceTo: field.reference_to || field.referenceTo || undefined,
    formula: field.formula || undefined,
  };
}
