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

import { viewItemObjectName, type ObjectStackAdapter } from '@object-ui/data-objectstack';
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
  // No `group` (objectui#6223): `ObjectSchema` has no object-level grouping
  // key — its 42-key accept set contains `fieldGroups`, which groups the FIELDS
  // inside one object, and nothing that categorises objects against each other.
  // The designer's grouping IS a real feature, but a UI-only one: the Object
  // Manager's group column and its group select are display categories derived
  // from the object itself (`sys_` prefix / `isSystem` -> `System Objects` vs
  // `Custom Objects`), never authored data the server round-trips. Writing it
  // made `PUT /api/v1/meta/object/:name` refuse the key by name.
  // No `sortOrder` (objectui#6223): `ObjectSchema` has no object-level ordering
  // key either. What populated it was the ARRAY INDEX the converter happened to
  // be at (`sortOrder: index`), i.e. the order the list was already in — a
  // display concern of the manager, not object metadata. (Distinct from the
  // field-level `sortOrder`, which objectui#6045 has since removed for its own
  // reasons — `FieldSchema` refuses that spelling too, at the other level.)
  enabled?: boolean;
  fields?: FieldMetadataPayload[];
  // No `relationships` (objectui#6223): the spec models relationships on the
  // FIELD — `reference` / `master_detail` plus object-level `indexes` — and
  // `ObjectSchema` refuses an object-level `relationships` array by name. What
  // the designer should author for a relationship is a data-model question
  // that this card does not settle; what it settles is that this shape must
  // stop putting the key on the wire.
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
  // No `indexed` (objectui#4644): the spec has no field-level index flag —
  // `FieldSchema.safeParse` rejects the key by name, so writing it made
  // `PUT /api/v1/meta/object/:name` fail with 422 `INVALID_METADATA`.
  // Object-level `indexes[]` is the real surface.
  // No `referenceTo` (objectui#6041): the spec spells the relationship
  // target `reference`. `FieldSchema.safeParse` refuses `referenceTo` BY NAME
  // ("Did you mean `referenceTo` -> `reference`?"), so a lookup field authored
  // in the designer made `PUT /api/v1/meta/object/:name` fail 422
  // `INVALID_METADATA` and blocked every later save of that object.
  reference?: string;
  // No `formula` (objectui#6043): the spec spells a formula field's expression
  // `expression`, and it is CEL. `FieldSchema.safeParse` refuses `formula` BY
  // NAME ("Did you mean `formula` -> `expression`?"), so a formula field
  // authored in the designer made `PUT /api/v1/meta/object/:name` fail 422
  // `INVALID_METADATA` and blocked every later save of that object.
  //
  // Deliberately NOT renamed to `expression`. `FieldSchema` validates the key
  // but not the LANGUAGE: measured on 17.2.0 it accepts
  // `expression: '!!!not cel at all!!!'`. Emitting the retired textarea's
  // non-CEL contents under the accepted spelling would have turned a loud,
  // immediate 422 into a formula that parses and then silently evaluates to
  // null. Expressions are authored in metadata-admin's `ObjectFieldInspector`,
  // which lints them against the real `@objectstack/formula` engine.
  // No `sortOrder` (objectui#6045): `FieldSchema` refuses it BY NAME and the
  // spec has no field-level ordering key at all. The near-spelling `sortable`
  // is NOT it — that is a boolean ("whether field is sortable in list views"),
  // a different concept, so this is objectui#4687's shape (a declaration with
  // zero readers and zero writers) and not objectui#6041's rename. The spec
  // models field order by DECLARATION ORDER in the object's `fields` record;
  // a designer that wants explicit ordering reorders that record rather than
  // carrying an index. (Distinct from the object-level `sortOrder` retired by
  // objectui#6223, and from the saved-view `sortOrder` in `ObjectView.tsx`,
  // which is per-view display order and untouched by this card.)
}

// ---------------------------------------------------------------------------
// Converters: UI types → API payloads
// ---------------------------------------------------------------------------

/**
 * Convert an `ObjectDefinition` (UI) to the API payload shape.
 *
 * `ObjectDefinition` carries three keys that deliberately do NOT cross into the
 * payload (objectui#6223): `group` and `sortOrder` are the Object Manager's own
 * display category and display order, and `relationships` has no object-level
 * home in the spec. `ObjectSchema` refuses all three BY NAME, so copying them
 * across is what turned a designer save into a 422. The UI model keeps them;
 * the wire shape does not.
 */
function toObjectPayload(obj: ObjectDefinition, fields?: FieldMetadataPayload[]): ObjectMetadataPayload {
  return {
    name: obj.name,
    label: obj.label,
    pluralLabel: obj.pluralLabel,
    description: obj.description,
    icon: obj.icon,
    fields,
  };
}

/**
 * Convert a `DesignerFieldDefinition` (UI) to the API payload shape.
 *
 * It no longer copies `sortOrder` (objectui#6045). `FieldSchema` refuses that
 * key by name and nothing on the tree ever populated it, so the write was
 * latent — `JSON.stringify` drops the `undefined` — but one reorder feature
 * away from a hard 422 that blocks every later save of the object.
 */
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
    defaultValue: field.defaultValue as string | undefined,
    placeholder: field.placeholder,
    options: field.options,
    externalId: field.externalId,
    trackHistory: field.trackHistory,
    reference: field.referenceTo,
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
   *
   * `${category}:${name}` is the key the adapter's generic metadata read
   * caches under, and it is right for every category but one. A `view` row is
   * also read back under two OBJECT-scoped keys (`view:{object}:{name}` and
   * `view-overrides:{object}`), which `view:{name}` names neither of — so a
   * caller passing `'view'` here would leave the object page's override map
   * stale for the cache's 5-minute TTL, which is objectui#4373's defect on a
   * third writer. That is why this routes through the adapter's one seam
   * instead of restating the pair (the third restatement would have been the
   * third time this repo paid for one; see `invalidateViewKeys`).
   *
   * No in-repo caller passes `'view'` today — but this class is public API
   * (`useMetadataService`, exported from app-shell's barrel), so "unreachable"
   * would have been an unmeasured claim about consumers we do not own.
   *
   * The object binding comes from the body being written, via the same
   * accessor `listViewOverrides` narrows those rows by — not from a fourth
   * private copy of "which object is this?".
   */
  async saveMetadataItem(category: string, name: string, data: Record<string, unknown>): Promise<void> {
    const client = this.adapter.getClient();
    await client.meta.saveItem(category, name, data);
    this.adapter.invalidateCache(`${category}:${name}`);
    if (category === 'view') {
      const objectName = viewItemObjectName(data);
      if (objectName) this.adapter.invalidateViewKeys(objectName, name);
    }
  }

  /**
   * Soft-delete a metadata item by persisting it with `enabled: false` and
   * `_deleted: true`. Works for any metadata category.
   *
   * **Not wired to the view seam, and the reason is structural** (objectui#4373):
   * both view cache keys are OBJECT-scoped, this signature has no object
   * parameter, and the tombstone body it writes (`{ name, enabled, _deleted }`)
   * carries no object binding either — so unlike {@link saveMetadataItem} there
   * is nothing here to derive one from. Splitting `name` on `.` would be a
   * second, silently-wrong identity rule (a source-declared view's name is not
   * qualified), and inventing an object argument for a method with no callers
   * is a surface we would be guessing at. If a `'view'` caller ever appears,
   * the fix is to give it the object it already knows and call
   * `adapter.invalidateViewKeys(objectName, name)` here.
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
