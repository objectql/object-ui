/**
 * MetadataService
 *
 * Encapsulates CRUD operations for object definitions and field definitions
 * against the ObjectStack metadata API (`client.meta.saveItem`).
 *
 * This service bridges the gap between the local-state-only ObjectManager /
 * FieldDesigner components and the backend persistence layer.
 *
 * Pattern:
 *   1. Optimistically update local UI state
 *   2. Persist via `client.meta.saveItem('object', name, data)`
 *   3. Refresh MetadataProvider cache on success
 *   4. Rollback local state on failure
 *
 * @module services/MetadataService
 */

import type { ObjectStackAdapter } from '../dataSource';
import type { ObjectDefinition, DesignerFieldDefinition } from '@object-ui/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape written to the metadata API for an object definition. */
export interface ObjectMetadataPayload {
  name: string;
  label?: string;
  pluralLabel?: string;
  description?: string;
  icon?: string;
  group?: string;
  sortOrder?: number;
  enabled?: boolean;
  fields?: FieldMetadataPayload[];
  relationships?: Array<{
    relatedObject: string;
    type: string;
    label?: string;
    foreignKey?: string;
  }>;
}

/** Shape written to the metadata API for a field definition. */
export interface FieldMetadataPayload {
  name: string;
  label?: string;
  type: string;
  group?: string;
  description?: string;
  required?: boolean;
  unique?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  defaultValue?: string;
  placeholder?: string;
  options?: Array<{ label: string; value: string; color?: string }>;
  externalId?: boolean;
  trackHistory?: boolean;
  indexed?: boolean;
  referenceTo?: string;
  formula?: string;
  sortOrder?: number;
}

// ---------------------------------------------------------------------------
// Converters: UI types → API payloads
// ---------------------------------------------------------------------------

/** Convert an `ObjectDefinition` (UI) to the API payload shape. */
function toObjectPayload(obj: ObjectDefinition, fields?: FieldMetadataPayload[]): ObjectMetadataPayload {
  return {
    name: obj.name,
    label: obj.label,
    pluralLabel: obj.pluralLabel,
    description: obj.description,
    icon: obj.icon,
    group: obj.group,
    sortOrder: obj.sortOrder,
    enabled: obj.enabled,
    fields,
    relationships: obj.relationships,
  };
}

/** Convert a `DesignerFieldDefinition` (UI) to the API payload shape. */
function toFieldPayload(field: DesignerFieldDefinition): FieldMetadataPayload {
  return {
    name: field.name,
    label: field.label,
    type: field.type,
    group: field.group,
    description: field.description,
    required: field.required,
    unique: field.unique,
    readonly: field.readonly,
    hidden: field.hidden,
    defaultValue: field.defaultValue,
    placeholder: field.placeholder,
    options: field.options,
    externalId: field.externalId,
    trackHistory: field.trackHistory,
    indexed: field.indexed,
    referenceTo: field.referenceTo,
    formula: field.formula,
    sortOrder: field.sortOrder,
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class MetadataService {
  constructor(private adapter: ObjectStackAdapter) {}

  // -----------------------------------------------------------------------
  // Generic metadata operations (any type)
  // -----------------------------------------------------------------------

  /**
   * Fetch all items for a given metadata category.
   * Returns the items array from the API response, defaulting to `[]`.
   */
  async getItems(category: string): Promise<Record<string, unknown>[]> {
    const client = this.adapter.getClient();
    const res: unknown = await client.meta.getItems(category);
    if (res && typeof res === 'object' && 'items' in res && Array.isArray((res as { items: unknown[] }).items)) {
      return (res as { items: Record<string, unknown>[] }).items;
    }
    return [];
  }

  /**
   * Persist a metadata item (upsert) for any category.
   */
  async saveMetadataItem(category: string, name: string, data: Record<string, unknown>): Promise<void> {
    const client = this.adapter.getClient();
    await client.meta.saveItem(category, name, data);
    this.adapter.invalidateCache(`${category}:${name}`);
  }

  /**
   * Soft-delete a metadata item by persisting it with `enabled: false` and
   * `_deleted: true`. Works for any metadata category.
   */
  async deleteMetadataItem(category: string, name: string): Promise<void> {
    const client = this.adapter.getClient();
    await client.meta.saveItem(category, name, { name, enabled: false, _deleted: true });
    this.adapter.invalidateCache(`${category}:${name}`);
  }

  // -----------------------------------------------------------------------
  // Object operations
  // -----------------------------------------------------------------------

  /**
   * Persist an object definition to the backend.
   * Works for both create and update (the API is an upsert).
   */
  async saveObject(obj: ObjectDefinition, existingFields?: FieldMetadataPayload[]): Promise<void> {
    const client = this.adapter.getClient();
    const payload = toObjectPayload(obj, existingFields);
    await client.meta.saveItem('object', obj.name, payload);
    this.adapter.invalidateCache(`object:${obj.name}`);
  }

  /**
   * Delete an object definition from the backend.
   *
   * NOTE: The ObjectStack metadata API currently exposes `saveItem` but no
   * dedicated `deleteItem`.  We persist the object with `enabled: false` so
   * the intent is recorded and the object is hidden from active use.
   * A full hard-delete can be added once the backend supports it.
   */
  async deleteObject(objectName: string): Promise<void> {
    const client = this.adapter.getClient();
    await client.meta.saveItem('object', objectName, { name: objectName, enabled: false, _deleted: true });
    this.adapter.invalidateCache(`object:${objectName}`);
  }

  // -----------------------------------------------------------------------
  // Field operations (fields are stored as part of their parent object)
  // -----------------------------------------------------------------------

  /**
   * Persist updated fields for an object.
   *
   * Fetches the current object metadata, replaces its `fields` array with the
   * provided designer fields, and saves the whole object back.
   */
  async saveFields(objectName: string, fields: DesignerFieldDefinition[]): Promise<void> {
    const client = this.adapter.getClient();

    // Fetch current object metadata to preserve non-field properties
    let existingObject: Record<string, unknown> = {};
    try {
      const raw: any = await client.meta.getItem('object', objectName);
      existingObject = raw?.item ?? raw ?? {};
    } catch {
      // Object may not exist yet on the backend; proceed with fields-only save
    }

    const updatedObject = {
      ...existingObject,
      name: objectName,
      fields: fields.map(toFieldPayload),
    };

    await client.meta.saveItem('object', objectName, updatedObject);
    this.adapter.invalidateCache(`object:${objectName}`);
  }

  // -----------------------------------------------------------------------
  // Diff helpers — determine what changed between two arrays
  // -----------------------------------------------------------------------

  /**
   * Detect changes between previous and next object arrays.
   *
   * Returns the single object that was created, updated, or deleted.
   * If multiple objects changed simultaneously the function returns `null`
   * (callers should treat this as a bulk save of the entire array).
   */
  static diffObjects(
    prev: ObjectDefinition[],
    next: ObjectDefinition[],
  ): { type: 'create' | 'update' | 'delete'; object: ObjectDefinition } | null {
    const prevMap = new Map(prev.map((o) => [o.id, o]));
    const nextMap = new Map(next.map((o) => [o.id, o]));

    // Detect creation (exists in next but not prev)
    for (const [id, obj] of nextMap) {
      if (!prevMap.has(id)) return { type: 'create', object: obj };
    }

    // Detect deletion (exists in prev but not next)
    for (const [id, obj] of prevMap) {
      if (!nextMap.has(id)) return { type: 'delete', object: obj };
    }

    // Detect update (same id but different content)
    for (const [id, nextObj] of nextMap) {
      const prevObj = prevMap.get(id);
      if (prevObj && JSON.stringify(prevObj) !== JSON.stringify(nextObj)) {
        return { type: 'update', object: nextObj };
      }
    }

    return null;
  }

  /**
   * Detect changes between previous and next field arrays.
   */
  static diffFields(
    prev: DesignerFieldDefinition[],
    next: DesignerFieldDefinition[],
  ): { type: 'create' | 'update' | 'delete'; field: DesignerFieldDefinition } | null {
    const prevMap = new Map(prev.map((f) => [f.id, f]));
    const nextMap = new Map(next.map((f) => [f.id, f]));

    for (const [id, field] of nextMap) {
      if (!prevMap.has(id)) return { type: 'create', field };
    }

    for (const [id, field] of prevMap) {
      if (!nextMap.has(id)) return { type: 'delete', field };
    }

    for (const [id, nextField] of nextMap) {
      const prevField = prevMap.get(id);
      if (prevField && JSON.stringify(prevField) !== JSON.stringify(nextField)) {
        return { type: 'update', field: nextField };
      }
    }

    return null;
  }
}
