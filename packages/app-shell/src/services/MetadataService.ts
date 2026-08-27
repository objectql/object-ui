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

import { stripReadDecorations } from '@objectstack/spec/kernel';
import { viewItemObjectName, type ObjectStackAdapter } from '@object-ui/data-objectstack';
import { retiredFieldKeysFor } from '@object-ui/types';
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
  // No `enabled` (objectui#6238): `ObjectSchema` refuses it BY NAME and the
  // spec has no object-level on/off flag at all. The near-spelling `enable` is
  // NOT it — that is `ObjectCapabilities`, a system-features module object, so
  // `enabled: false` -> `enable: false` fails on the VALUE where it passes on
  // the name. This declaration was objectui#4687's shape (never populated by
  // `toObjectPayload`); the key reached the wire only through the tombstone
  // bodies the two delete methods wrote by hand, and those now go through the
  // metadata API's own delete door instead — see `deleteMetadataItem`.
  /**
   * The object's fields, keyed by field NAME — the map `ObjectSchema` requires
   * (objectui#6240). This used to be `FieldMetadataPayload[]`.
   *
   * An array is a VALUE-level refusal, which is the class the key-name parity
   * gate (`scripts/check-designer-field-key-parity.mjs`, coverage note 4)
   * cannot see: `fields` is in `ObjectSchema`'s accept set under either shape,
   * so the gate was green for as long as the array was on the wire.
   *
   * Measured against the installed `@objectstack/spec` 17.2.0 (ESM build):
   *
   *   fields: [{ name: 'n', type: 'text', label: 'N' }]
   *     => invalid_type @ fields  ("expected record, received array")
   *   fields: []                        => invalid_type @ fields
   *   fields: { n: { type: 'text' } }   => parses green
   *   fields: {}                        => parses green
   *   (key absent)                      => invalid_type @ fields — it is REQUIRED
   *
   * And the route is not lenient about it. `metadata-protocol`'s
   * `saveMetaItem` resolves type `object` to this very `ObjectSchema`
   * (`spec/kernel/metadata-type-schemas.ts`), `safeParse`s the whole item and
   * THROWS `422 INVALID_METADATA` before anything is persisted — the array was
   * refused, never stripped and never stored.
   *
   * Still OPTIONAL, deliberately — see `toObjectPayload`. `undefined` here
   * means "the caller did not say what the fields are", and that must NOT be
   * spelled `{}`: `{}` parses green and a PUT is an upsert, so it would land as
   * "this object has no fields" and wipe them.
   */
  fields?: Record<string, FieldMetadataPayload>;
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
    // No fields supplied means the CALLER DID NOT SAY, which is not the same
    // statement as `{}` ("this object has no fields") — and a PUT is an upsert,
    // so writing `{}` here would delete every field of the object on a save
    // that only meant to rename it. The body then still fails `ObjectSchema`
    // (`fields` is required), which is a loud 422 that persists nothing — the
    // right outcome for a caller that under-specified an upsert, and the same
    // outcome as before this change. `saveFields` is the opposite case and
    // treats its argument as authoritative; see there.
    fields: fields ? toFieldsMap(fields) : undefined,
  };
}

/**
 * Key a list of field payloads by field NAME — the shape `ObjectSchema.fields`
 * requires (objectui#6240).
 *
 * Declaration order is preserved, and that is load-bearing rather than
 * incidental: the spec models field order as DECLARATION ORDER in this record
 * and has no field-level ordering key at all (objectui#6045), so insertion
 * order here IS the designer's order.
 *
 * ## Why a missing name THROWS instead of writing `{ undefined: … }`
 *
 * The key can only come from the field's `name`. Both writer inputs declare it
 * required (`FieldMetadataPayload.name`, `DesignerFieldDefinition.name`), but
 * neither writer owns its input at runtime: `saveObject`'s `existingFields` is
 * public API (`MetadataService` is reachable from app-shell's barrel through
 * `useMetadataService`) and `saveFields` is handed whatever the designer's
 * in-memory model holds. A nameless field keys as the literal string
 * `"undefined"` — and the spec does NOT catch that. Measured on 17.2.0:
 *
 *   ObjectSchema.safeParse({ …, fields: { undefined: { type: 'text', label: 'N' } } })
 *     => success = true
 *
 * So the loud, immediate, harmless array-shaped 422 would have been traded for
 * a silently corrupt STORED document. That is the AI-authored-metadata failure
 * mode this repo keeps closing, and this conversion is exactly where it would
 * have been opened.
 *
 * ## Why a duplicate name throws too
 *
 * That one is the conversion's OWN hazard rather than an inherited one: an
 * array can carry two entries named `n` and a map cannot, so the later entry
 * would silently swallow the earlier. Refusing is the only reading that does
 * not lose a field the caller declared.
 *
 * ## Why `Object.fromEntries` and not assignment into a literal
 *
 * `map['__proto__'] = field` does not create a key — it invokes the prototype
 * setter — and `__proto__` is a SPEC-LEGAL field name (the record's key schema
 * is `/^[a-z_][a-z0-9_]*$/`). The assignment form would therefore drop such a
 * field silently, which is this function's whole subject wearing a different
 * spelling. `Object.fromEntries` defines an own property instead.
 */
function toFieldsMap(fields: FieldMetadataPayload[]): Record<string, FieldMetadataPayload> {
  const entries: Array<[string, FieldMetadataPayload]> = [];
  const seen = new Set<string>();

  fields.forEach((field, index) => {
    const name = field?.name;
    if (typeof name !== 'string' || name.trim() === '') {
      throw new Error(
        `[MetadataService] cannot build the object's \`fields\` map: the field at index ${index} has no ` +
          '`name`. `ObjectSchema.fields` is keyed by field name, so a nameless field would be written under ' +
          'the literal key "undefined" — which the spec ACCEPTS, leaving a corrupt document stored with ' +
          'nothing to report it. Give the field a name.',
      );
    }
    if (seen.has(name)) {
      throw new Error(
        `[MetadataService] cannot build the object's \`fields\` map: duplicate field name \`${name}\` at ` +
          `index ${index}. A name-keyed map cannot carry two fields under one name, so the later one would ` +
          'silently replace the earlier. Rename or remove one of them.',
      );
    }
    seen.add(name);
    entries.push([name, field]);
  });

  return Object.fromEntries(entries);
}

/**
 * Field keys a designer once WROTE that `FieldSchema` refuses BY NAME, dropped
 * out of {@link carryOver} (objectui#6488).
 *
 * Derived from the tombstone registry (`RETIRED_FIELD_KEY_TOMBSTONES` in
 * `@object-ui/types`, objectui#6527) — this carry-over is the registry's
 * `metadataServiceCarryOver` site. The registry names each retired key, the
 * card that retired it, and which sites strip it; the per-key evidence lives
 * there. This site's list is the widest of the three because it is the one
 * with a recorded DEFENSIVE entry: no shipped writer ever populated a
 * field-level `sortOrder` (objectui#6045 — "the key never reached the wire"),
 * and it rides here as insurance against a document some OTHER client stored
 * while an older server accepted the key — see its tombstone for the recorded
 * verdict. Every other entry is a key a shipped build emitted before its card
 * retired it, so a document stored back then can still carry it inside a
 * field.
 *
 * Carrying such a key out again would be a hard `422 INVALID_METADATA` that
 * blocks EVERY later save of that object — and with the controls gone, an
 * author has no way to clear it from the UI. Stripping is what makes an
 * edit-and-save round-trip of such an object come out parseable; nothing that
 * the server would store is lost, because these are exactly the values it
 * refuses.
 *
 * The strip is keyed to those tombstones and is NOT a blanket unknown-key
 * purge: every other key the server sent still rides through, which is the
 * whole point of the carry-over. Deliberately not derived from `FieldSchema`'s
 * accept set either — measured on 17.2.0, a plugin-registered key
 * (`x_plugin_thing`) is `unrecognized_keys` to the INSTALLED spec while the
 * SERVER that sent it accepts it, so filtering by the client's schema would
 * drop precisely the keys this card exists to preserve.
 */
const RETIRED_FIELD_KEYS = retiredFieldKeysFor('metadataServiceCarryOver');

/**
 * The previous SERVER entry for one field, minus {@link RETIRED_FIELD_KEYS} —
 * the keys {@link toFieldPayload} spreads so a save cannot drop what the
 * designer does not model (objectui#6488).
 *
 * Same shape, same name and the same reason as `MetadataFieldsPage`'s
 * `carryOver`, which has solved this one writer over all along.
 */
function carryOver(prev?: Record<string, unknown>): Record<string, unknown> {
  if (!prev) return {};
  const present = RETIRED_FIELD_KEYS.filter((k) => k in prev);
  if (present.length === 0) return { ...prev };
  const next = { ...prev };
  for (const k of present) delete next[k];
  return next;
}

/**
 * The `fields` map of the fetched document, as a lookup for {@link carryOver}.
 *
 * Anything that is not a record is read as "no previous entries" rather than
 * coerced. An ARRAY in particular cannot be a stored document's shape —
 * `ObjectSchema` answers `fields: []` with `invalid_type` (objectui#6240), so a
 * served array means something other than metadata came back, and guessing at
 * its entries would be inventing a previous state to carry over.
 */
function previousFieldsOf(existingObject: Record<string, unknown>): Record<string, unknown> {
  const raw = existingObject.fields;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

/**
 * The previous entry for `name`, or `undefined` when there is none to carry.
 *
 * `hasOwnProperty` rather than a plain lookup, for the reason {@link toFieldsMap}
 * documents at the other end of the same map: `__proto__` is a SPEC-LEGAL field
 * name, and `previous['__proto__']` reads `Object.prototype` — an inherited
 * object that is not a previous field entry at all.
 */
function previousFieldEntry(previous: Record<string, unknown>, name: string): Record<string, unknown> | undefined {
  if (!Object.prototype.hasOwnProperty.call(previous, name)) return undefined;
  const entry = previous[name];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return undefined;
  return entry as Record<string, unknown>;
}

/**
 * Convert a `DesignerFieldDefinition` (UI) to the API payload shape, carrying
 * over the previous SERVER entry's unmodelled keys (objectui#6488).
 *
 * ## Why the carry-over
 *
 * This shape models what the FIELD DESIGNER can author, which is a subset of
 * what `FieldSchema` accepts. Measured on the installed `@objectstack/spec`
 * 17.2.0, `expression` (a formula authored in metadata-admin), `precision`,
 * `scale`, `system` and `sortable` all parse green on a field — and none of
 * them is a key this converter names. Rebuilding the entry from the designer
 * model alone therefore DROPPED every one of them on every field save, and a
 * PUT is an upsert, so the drop lands in storage.
 *
 * That loss is not new but was unreachable: while `fields` went out as an array
 * the whole body was refused `422` before persistence (objectui#6240), so
 * nothing this dropped ever reached storage. From that fix onward it does.
 *
 * ## Why the modelled keys are still written UNCONDITIONALLY
 *
 * The mirror hazard, and the one thing that would make this fix worse than the
 * bug: carry-over must not resurrect a value the author deliberately CLEARED.
 * Every key below is named on every call, so a cleared property arrives as an
 * explicit `undefined` that OVERRIDES the carried value and is then dropped by
 * `JSON.stringify` — absent from the body, which on an upsert is the deletion.
 * A conditional spread (`...(field.x ? { x: field.x } : {})`) would leave the
 * server's old value standing and fail the author's deletion silently. Pinned
 * both ways in `MetadataService.fieldKeyCarryOver.test.ts`.
 *
 * It no longer copies `sortOrder` (objectui#6045). `FieldSchema` refuses that
 * key by name and nothing on the tree ever populated it, so the write was
 * latent — `JSON.stringify` drops the `undefined` — but one reorder feature
 * away from a hard 422 that blocks every later save of the object.
 */
function toFieldPayload(
  field: DesignerFieldDefinition,
  prev?: Record<string, unknown>,
): FieldMetadataPayload & Record<string, unknown> {
  return {
    ...carryOver(prev),
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
   * Delete a metadata item through the metadata API's own delete door
   * (`DELETE /api/v1/meta/:type/:name`). Works for any metadata category.
   *
   * **It used to PUT a hand-written tombstone** — `{ name, enabled: false,
   * _deleted: true }` — and objectui#6238 measured what the server does with
   * that body. Neither key is a metadata convention:
   *
   *   - `enabled` and `_deleted` are refused BY NAME by 25 of the 26 overlay
   *     schemas the framework validates a PUT against (`getMetadataTypeSchema`,
   *     the registry `saveMetaItem`'s `resolveOverlaySchema` reads), `object`
   *     among them: `422 INVALID_METADATA`, `unrecognized_keys`.
   *   - Where the type's schema is tolerant (`view`) or unregistered
   *     (`analytics_cube`, `connector`, `sharing_rule`, `webhook`) the body is
   *     STORED VERBATIM — the framework persists the request item, never
   *     `parsed.data` — and `_deleted` has no reader anywhere in the platform.
   *     So on exactly the categories that did not 422, the "soft delete" was a
   *     silent no-op that left the item live carrying two junk keys.
   *
   * There was no third outcome: nothing strips the keys, and no spec surface
   * expresses "this item exists but is off" (`ObjectSchema`'s 42-key accept set
   * has no such flag), so there is no correct spelling this could be renamed
   * to. The delete door is `DELETE /:type/:name` — generic over `:type` on the
   * same route family and capability gate as the PUT — which is the same
   * request `MetadataClient.reset` issues for `MetadataObjectsPage`'s object
   * deletes and `ResourceEditPage`'s generic ones. One operation, one mechanism.
   *
   * **Still not wired to the view seam, and the reason is unchanged and
   * structural** (objectui#4373): both view cache keys are OBJECT-scoped and
   * this signature has no object parameter. The old tombstone body carried no
   * object binding to derive one from; a DELETE has no body at all, so it
   * carries even less. Splitting `name` on `.` would be a second,
   * silently-wrong identity rule (a source-declared view's name is not
   * qualified), and inventing an object argument for a method with no callers
   * is a surface we would be guessing at. If a `'view'` caller ever appears,
   * the fix is to give it the object it already knows and call
   * `adapter.invalidateViewKeys(objectName, name)` here.
   */
  async deleteMetadataItem(category: string, name: string): Promise<void> {
    const client = this.adapter.getClient();
    await client.meta.deleteItem(category, name);
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
   * Delete an object definition from the backend
   * (`DELETE /api/v1/meta/object/:name`).
   *
   * The note this replaces said the metadata API "currently exposes `saveItem`
   * but no dedicated `deleteItem`", and that a tombstone PUT recorded the
   * intent until a real delete existed. Both halves were stale by the time
   * objectui#6238 measured them: `@objectstack/client` 17.2.0 declares
   * `meta.deleteItem(type, name)` on the very client this service already
   * holds, and it issues the SAME `DELETE /api/v1/meta/:type/:name` that
   * `MetadataClient.reset` does — the mechanism `MetadataObjectsPage` has been
   * using for designer object deletes all along. Nothing was recording an
   * intent in the meantime: `ObjectSchema` refuses `enabled` and `_deleted` by
   * name, so this call returned `422 INVALID_METADATA` every time it ran.
   *
   * `reset` semantics are the overlay's, and that is the governed answer rather
   * than a shortfall: it removes the customization row, which IS deletion for
   * an object the designer authored, and restores the artifact for one a
   * package declares — an object you are not allowed to delete. Which of the
   * two an item is, is what the API's own `deletable` / `resettable` verdicts
   * report (`MetadataClient`), not something a client-side flag should decide.
   */
  async deleteObject(objectName: string): Promise<void> {
    const client = this.adapter.getClient();
    await client.meta.deleteItem('object', objectName);
    this.adapter.invalidateCache(`object:${objectName}`);
  }

  // -----------------------------------------------------------------------
  // Field operations (fields are stored as part of their parent object)
  // -----------------------------------------------------------------------

  /**
   * Persist updated fields for an object.
   *
   * Fetches the current object metadata, replaces its `fields` MAP with the
   * provided designer fields, and saves the whole object back.
   *
   * It used to write an ARRAY here (objectui#6240), and note which direction
   * that ran in: the server's own document arrives with `fields` as a map, and
   * `fields.map(toFieldPayload)` converted the correct shape INTO the refused
   * one on every field save. `ObjectSchema` requires a record, so the resulting
   * PUT was answered `422 INVALID_METADATA` (`invalid_type @ fields`) and
   * nothing persisted — measured, not inferred: `metadata-protocol`'s
   * `saveMetaItem` parses the whole item against `ObjectSchema` and throws
   * before it writes.
   *
   * Two properties of this body are deliberate and are pinned in
   * `MetadataService.objectPayloadFieldsMap.test.ts`:
   *
   *   - **The spread still preserves unknown server keys.** `...existingObject`
   *     is what carries every key of the fetched document this service does not
   *     model, and reshaping `fields` must not cost that. It now matters more
   *     than it did, not less: while the body was refused, nothing it preserved
   *     ever reached storage.
   *   - **The field list is AUTHORITATIVE, so an empty one writes `{}`.** That
   *     is the opposite of `saveObject`'s optional `existingFields`, and the
   *     asymmetry is the point: here the designer is stating the object's
   *     complete field set, so "no fields" is a thing it can mean; there, a
   *     missing argument means the caller did not say.
   *
   * …and a third, pinned in `MetadataService.readDecorationStrip.test.ts`:
   *
   *   - **The framework's own read decorations do NOT go back out**
   *     (objectui#6480). The same spread that preserves unknown server keys
   *     also carries `_diagnostics` and `_draft` — keys the framework ADDS to a
   *     served document and `ObjectSchema` refuses by name — so the body is
   *     passed through the spec's `stripReadDecorations` before it is sent.
   *     Note the direction this cuts: the preservation property above is about
   *     keys the AUTHOR owns, and this one is about keys the FRAMEWORK owns.
   *     Only the second kind may be dropped, and only because the read path
   *     regenerates them.
   *
   * …and a fourth, pinned in `MetadataService.fieldKeyCarryOver.test.ts`:
   *
   *   - **Per-FIELD server keys are carried over** (objectui#6488). The spread
   *     above is object-level and does nothing for keys INSIDE a field, so
   *     entries rebuilt from the designer model dropped every key the server
   *     sent that this converter does not name — `expression`, `precision`,
   *     `scale`, `system`, `sortable`, anything a plugin registered. The
   *     previous entries ride in on the very document this method already
   *     fetched, so `toFieldPayload` merges onto them; see there for the mirror
   *     property that keeps a CLEARED designer property cleared.
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

    // The per-FIELD half of the same preservation property (objectui#6488).
    // `...existingObject` below carries unknown keys of the DOCUMENT; it does
    // nothing for keys INSIDE a field, and those entries are rebuilt from the
    // designer model. The previous entries are already in hand — this is the
    // document the object-level spread just fetched — so the carry-over costs
    // no extra request, which is also why it belongs at this drop site rather
    // than anywhere upstream.
    const previousFields = previousFieldsOf(existingObject);

    // `...existingObject` is a verbatim spread of whatever the server sent, so
    // simply not writing `_diagnostics` / `_draft` is not enough: a served
    // document that carries either one spreads it straight back out, and
    // `ObjectSchema` refuses both BY NAME. Strip them on the way out — the
    // objectui#4644 strip-on-load shape applied on the write side where the
    // spread is, exactly as `MetadataObjectsPage.handleObjectsChange` does for
    // `group` (objectui#6223).
    //
    // The list is the SPEC'S (`METADATA_READ_DECORATIONS`), reached through its
    // own exported helper rather than copied here, because a local copy goes
    // stale the next time the framework adds a decoration — and a decoration
    // this writer does not know to remove is precisely the defect.
    //
    // Not a lenient "drop whatever the schema refuses" pass (AGENTS.md #0.1):
    // it removes exactly the two keys the framework ADDS AT READ TIME and never
    // stores, so a genuinely unrecognized key still fails loudly. Nothing is
    // lost by dropping them even though a PUT is an upsert — `_diagnostics` is
    // the read-path validation verdict, recomputed on every read, and `_draft`
    // reflects the row's `state` column and the `mode` parameter, never the
    // body. The ADR-0010 protection envelope (`_lock`, `_provenance`, …) IS
    // write-path state the server merges back, and the spec deliberately keeps
    // it out of the decoration list, so this strip does not touch it.
    const updatedObject = stripReadDecorations({
      ...existingObject,
      name: objectName,
      fields: toFieldsMap(fields.map((field) => toFieldPayload(field, previousFieldEntry(previousFields, field.name)))),
    }) as Record<string, unknown>;

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
