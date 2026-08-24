/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Field Type Definitions
 * 
 * Comprehensive field type system for ObjectQL protocol.
 * Defines all field types supported in ObjectGrid and ObjectForm components.
 * 
 * @module field-types
 * @packageDocumentation
 */

/**
 * Base field metadata interface
 * Common properties shared by all field types
 */
export interface BaseFieldMetadata {
  /**
   * Field name/identifier
   */
  name: string;
  
  /**
   * Display label
   */
  label?: string;
  
  /**
   * Field type identifier
   */
  type: string;
  
  /**
   * Help text or description
   */
  help?: string;
  
  /**
   * Description text
   */
  description?: string;
  
  /**
   * Whether field is required
   */
  required?: boolean;
  
  /**
   * Whether field is read-only
   */
  readonly?: boolean;

  /**
   * Auto-injected system/audit/ownership field (e.g. `created_at`,
   * `updated_by`, `organization_id`, `owner_id`), stamped by the framework's
   * `applySystemFields`. Surfaces that separate framework-managed bookkeeping
   * from author-declared business fields (e.g. default list-column derivation)
   * branch on this flag. Mirrors the spec `Field.system` property.
   */
  system?: boolean;

  /**
   * Render a long-text field with a fullscreen-edit affordance (an "expand"
   * button opening a full-height dialog) — the mobile UX for a textarea that
   * would otherwise be a 4-row box wedged between other fields.
   *
   * **Not authored metadata, and deliberately NOT in `@objectstack/spec`.**
   * It is a PROJECTION of the FORM-level setting
   * `ObjectFormSchema.mobile.fullscreenLongText` onto the field metadata,
   * with exactly one producer: `ObjectForm` (`@object-ui/plugin-form`) stamps
   * it onto each long-text field's metadata carrier while building the form.
   * Writing it on an object's field definition is meaningless — nothing
   * publishes it and nothing else produces it.
   *
   * **Consumers**: `TextAreaField` and `RichTextField` (`@object-ui/fields`,
   * the latter since objectui#3301 / PR #3302), which read it off `field` and
   * nowhere else — `field` being the single metadata carrier since
   * objectui#3233. It is declared here, on the type
   * `FieldWidgetComponentProps.field` resolves to, so that the one legal
   * location for the flag is a typed one rather than an untyped pun: before
   * objectui#3245 it was stamped onto the FormField instead, where the form
   * renderer's `field: field.field || field` forwarding could not see it and
   * `stripRegisteredFieldProps` stripped the prop copy — so every
   * auto-generated form silently lost the feature.
   */
  mobile_fullscreen?: boolean;

  /**
   * Placeholder text
   */
  placeholder?: string;
  
  /**
   * Default value
   */
  defaultValue?: any;
  
  /**
   * Whether field is sortable
   */
  sortable?: boolean;
  
  /**
   * Whether field is filterable
   */
  filterable?: boolean;
  
  /**
   * Conditional visibility expression
   */
  visible_on?: VisibilityCondition;
  
  /**
   * Custom validation function or rules
   */
  validate?: ValidationFunction | FieldConstraints;
  
  /**
   * Field dependencies (Phase 3.2.3)
   * List of fields that this field depends on
   */
  depends_on?: string[];
  
  /*
   * There is deliberately no `indexed` here (objectui#4679). The ObjectStack
   * spec has no field-level index flag: it built no index (objectstack#2377
   * removed it) and `FieldSchema.safeParse` now rejects the key by name, so
   * any producer that authored it produced a save-blocking 422. Declare the
   * index on the object instead — `indexes: [{ name, fields, unique }]`.
   */

  /**
   * Field is unique constraint
   */
  unique?: boolean;
}

/**
 * Visibility condition type
 */
export type VisibilityCondition = {
  field: string;
  operator?: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'in';
  value?: any;
  and?: VisibilityCondition[];
  or?: VisibilityCondition[];
};

/**
 * Validation function type
 */
export type ValidationFunction = (value: any) => boolean | string | Promise<boolean | string>;

/**
 * Validation rule type
 */
export type FieldConstraints = {
  required?: boolean | string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string | RegExp;
  custom?: ValidationFunction;
};

/**
 * Text field metadata
 */
export interface TextFieldMetadata extends BaseFieldMetadata {
  type: 'text';
  min_length?: number;
  max_length?: number;
  pattern?: string | RegExp;
  pattern_message?: string;
}

/**
 * Long text/textarea field metadata
 */
export interface TextareaFieldMetadata extends BaseFieldMetadata {
  type: 'textarea';
  min_length?: number;
  max_length?: number;
  rows?: number;
}

/**
 * Markdown field metadata
 */
export interface MarkdownFieldMetadata extends BaseFieldMetadata {
  type: 'markdown';
  max_length?: number;
}

/**
 * HTML/Rich text field metadata
 */
export interface HtmlFieldMetadata extends BaseFieldMetadata {
  type: 'html';
  max_length?: number;
}

/**
 * Number field metadata
 */
export interface NumberFieldMetadata extends BaseFieldMetadata {
  type: 'number';
  min?: number;
  max?: number;
  /** Total number of digits (the `p` in a `decimal(p, s)` column). Not a display setting. */
  precision?: number;
  /** Number of decimal places to display (the `s` in a `decimal(p, s)` column). */
  scale?: number;
  step?: number;
}

/**
 * Currency field metadata
 */
export interface CurrencyFieldMetadata extends BaseFieldMetadata {
  type: 'currency';
  currency?: string;
  precision?: number;
  min?: number;
  max?: number;
}

/**
 * Percent field metadata
 */
export interface PercentFieldMetadata extends BaseFieldMetadata {
  type: 'percent';
  precision?: number;
  min?: number;
  max?: number;
}

/**
 * Boolean field metadata
 */
export interface BooleanFieldMetadata extends BaseFieldMetadata {
  type: 'boolean';
}

/**
 * Date field metadata
 */
export interface DateFieldMetadata extends BaseFieldMetadata {
  type: 'date';
  format?: string;
  min_date?: string | Date;
  max_date?: string | Date;
  /**
   * Marks this field as due/deadline-semantic (vs. a plain start/end/created
   * date). Gates the relative-time "Overdue Nd" wording and red styling —
   * without it, a past date renders as neutral "Nd ago" text. Auto-detected
   * from common due/deadline field-name conventions when omitted.
   */
  dueLike?: boolean;
}

/**
 * DateTime field metadata
 */
export interface DateTimeFieldMetadata extends BaseFieldMetadata {
  type: 'datetime';
  format?: string;
  min_date?: string | Date;
  max_date?: string | Date;
}

/**
 * Time field metadata
 */
export interface TimeFieldMetadata extends BaseFieldMetadata {
  type: 'time';
  format?: string;
}

/**
 * Select option
 */
export interface SelectOptionMetadata {
  label: string;
  value: string;
  color?: string;
  icon?: string;
  disabled?: boolean;
  /**
   * Per-option visibility predicate (CEL). The option is offered only when TRUE,
   * evaluated against the live record + `current_user` (same env as field-level
   * `visibleWhen`). Omit = always available. Drives cascading/dependent options
   * (`record.country == 'cn'`) and role/context gating
   * (`'admin' in current_user.positions`). Aligns with @objectstack/spec
   * SelectOption.visibleWhen. Client-side hiding is UX only — access-control
   * gating must also be enforced server-side.
   */
  visibleWhen?: string | { dialect?: string; source: string };
}

/**
 * Select field metadata
 */
export interface SelectFieldMetadata extends BaseFieldMetadata {
  type: 'select';
  options?: SelectOptionMetadata[];
  multiple?: boolean;
  searchable?: boolean;
}

/**
 * Email field metadata
 */
export interface EmailFieldMetadata extends BaseFieldMetadata {
  type: 'email';
  max_length?: number;
}

/**
 * Phone field metadata
 */
export interface PhoneFieldMetadata extends BaseFieldMetadata {
  type: 'phone';
  format?: string;
}

/**
 * URL field metadata
 */
export interface UrlFieldMetadata extends BaseFieldMetadata {
  type: 'url';
  max_length?: number;
}

/**
 * Password field metadata
 */
export interface PasswordFieldMetadata extends BaseFieldMetadata {
  type: 'password';
  min_length?: number;
  max_length?: number;
}

/**
 * Metadata of an uploaded file, as carried in a `file`/`image` field's VALUE.
 *
 * Renamed off the spec's `FileMetadata` name (objectstack#4115): the spec's
 * (`@objectstack/spec/system`) is the storage layer's file record — `{ path,
 * name, size, mimeType, lastModified, created, etag, fileId }`, all required
 * but the last two — describing an object in a bucket. This one is the
 * field-value payload the form renderer displays: snake_case keys, everything
 * but `name` optional, and it carries `url` (what the field links to) and
 * `original_name` (the upload's client-side filename), neither of which the
 * spec's has. Re-exporting the spec's would delete `url` outright.
 *
 * Tripwire: `__tests__/page-nav-misc-spec-parity.test.ts`.
 */
export interface UploadedFileMetadata {
  name: string;
  original_name?: string;
  size?: number;
  mime_type?: string;
  url?: string;
}

/**
 * File field metadata
 */
export interface FileFieldMetadata extends BaseFieldMetadata {
  type: 'file';
  multiple?: boolean;
  accept?: string[];
  max_size?: number;
  max_files?: number;
}

/**
 * Image field metadata
 */
export interface ImageFieldMetadata extends BaseFieldMetadata {
  type: 'image';
  multiple?: boolean;
  accept?: string[];
  max_size?: number;
  max_files?: number;
  max_width?: number;
  max_height?: number;
}

/**
 * Location field metadata
 */
export interface LocationFieldMetadata extends BaseFieldMetadata {
  type: 'location';
  default_zoom?: number;
}

/**
 * Column definition for the Record Picker dialog table.
 */
export interface LookupColumnDef {
  /** Field name to display in this column */
  field: string;
  /** Optional column header label (defaults to field name) */
  label?: string;
  /** Column width (CSS value, e.g. '120px', '20%') */
  width?: string;
  /**
   * Field type hint for type-aware cell rendering.
   * When provided, the Record Picker uses getCellRenderer for formatting
   * (badges for select/status, currency formatting, date display, etc.).
   * @example 'currency', 'date', 'select', 'boolean'
   */
  type?: string;
}

/**
 * Filter condition for the Record Picker dialog.
 * Applied as a base filter on every query — restricts which records are selectable.
 *
 * Operator compatibility:
 * - `eq`, `ne` — all data types
 * - `gt`, `lt`, `gte`, `lte` — numbers, dates
 * - `contains` — strings
 * - `in`, `notIn` — arrays of values (select/lookup fields)
 *
 * @example { field: 'status', operator: 'eq', value: 'active' }
 * @example { field: 'created_at', operator: 'gte', value: '2024-01-01' }
 * @example { field: 'category', operator: 'in', value: ['A', 'B'] }
 */
export interface LookupFilterDef {
  /** Field name to filter on */
  field: string;
  /** Filter operator */
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in' | 'notIn';
  /** Filter value */
  value: unknown;
}

/**
 * Lookup/Master-Detail field metadata
 *
 * Supports enterprise-grade Record Picker configuration:
 * - `lookup_columns` — columns shown in the Record Picker dialog table
 * - `description_field` — secondary description shown in quick-select popover
 * - `lookup_page_size` — records per page in the Record Picker dialog
 * - `lookup_filters` — base filters applied to Record Picker queries
 */
export interface LookupFieldMetadata extends BaseFieldMetadata {
  type: 'lookup' | 'master_detail';
  reference_to?: string;
  reference_field?: string;
  multiple?: boolean;
  searchable?: boolean;
  options?: SelectOptionMetadata[];

  /**
   * Record field rendered as each candidate's label. Falls back to
   * `reference_field`, then the referenced object's own display-name
   * resolution, then the raw id.
   * @example 'label' — a position's display name
   */
  display_field?: string;

  /**
   * Record field committed as this lookup's VALUE. Defaults to `'id'`; set it
   * when the reference is stored by another column — e.g. an approval
   * `position` approver stores `sys_position.name`, because the engine routes
   * by machine name and names stay portable across environments
   * (objectstack #3508).
   */
  id_field?: string;

  /**
   * Offer inline "create the referenced record" from an empty/zero-result
   * picker. Defaults ON for user-facing relations and OFF for platform
   * objects (`sys_`/`cloud_`/`ai_` and the user directory); set explicitly to
   * override either way.
   */
  allow_create?: boolean;

  /**
   * Secondary field shown as description in the quick-select popover.
   * @example 'industry' — shows customer industry below customer name
   */
  description_field?: string;

  /**
   * Columns to display in the Record Picker dialog table.
   * When omitted the dialog auto-infers columns from the display field and
   * description field.
   * @example ['name', 'email', 'status']
   * @example [{ field: 'name', label: 'Customer' }, { field: 'amount', label: 'Total', width: '100px' }]
   */
  lookup_columns?: Array<string | LookupColumnDef>;

  /**
   * Custom page size for the Record Picker dialog.
   * Defaults to 10.
   */
  lookup_page_size?: number;

  /**
   * Base filters applied to every Record Picker query.
   * Use to restrict which records are selectable (e.g. only active records).
   * @example [{ field: 'status', operator: 'eq', value: 'active' }]
   */
  lookup_filters?: LookupFilterDef[];
}

/**
 * Formula field metadata (read-only computed field)
 * Phase 3.2.4: Enhanced formula field with real-time computation
 */
export interface FormulaFieldMetadata extends BaseFieldMetadata {
  type: 'formula';
  /**
   * Formula expression
   * Supports JavaScript-like expressions with field references
   * @example "${amount} * ${tax_rate}"
   * @example "${firstName} + ' ' + ${lastName}"
   */
  formula?: string;
  /**
   * Return type of the formula
   */
  return_type?: 'text' | 'number' | 'boolean' | 'date' | 'datetime';
  /**
   * Whether to recompute on dependency changes
   */
  auto_compute?: boolean;
}

/**
 * Summary/Rollup field metadata (aggregation)
 * Phase 3.2.5: Enhanced summary field implementation
 */
export interface SummaryFieldMetadata extends BaseFieldMetadata {
  type: 'summary';
  /**
   * Related object to summarize from
   */
  summary_object?: string;
  /**
   * Field to aggregate in the related object
   */
  summary_field?: string;
  /**
   * Aggregation type
   */
  summary_type?: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'first' | 'last';
  /**
   * Filter condition for summarized records
   */
  summary_filter?: Record<string, any>;
  /**
   * Whether to auto-update on related record changes
   */
  auto_update?: boolean;
}

/**
 * Auto-number field metadata
 */
export interface AutoNumberFieldMetadata extends BaseFieldMetadata {
  type: 'auto_number';
  format?: string;
  starting_number?: number;
}

/**
 * User field metadata — a lookup specialized to `sys_user`, rendered by the
 * person picker.
 *
 * `type` offered `'user' | 'owner'` until objectui#4814 retired the `owner`
 * spelling (ruling A′), carried onto the published twins by objectui#4914.
 * `owner` was a synonym with zero behavioral delta (both resolved to the SAME
 * `UserField` widget) and was never a member of `@objectstack/spec`'s closed
 * `FieldType`, so no object schema could declare it. While it survived here,
 * published `.d.ts` autocomplete kept offering a word `@object-ui/fields`
 * answers with a tombstone refusal. The record-owner idiom survives verbatim
 * as `{ type: 'user', name: 'owner' }` — the field NAME carries the ownership
 * meaning, the type carries the widget. The interface keeps its name: it
 * describes the person-picker family, not the retired spelling.
 */
export interface UserFieldMetadata extends BaseFieldMetadata {
  type: 'user';
  multiple?: boolean;

  /**
   * Picker UI variant.
   * - `'search'` — the search-first PeoplePicker (rich rows + selection tray).
   *   Default for `user` fields.
   * - `'default'` — the classic table-based record-picker dialog.
   */
  picker?: 'search' | 'default';

  /**
   * Dotted field paths shown as the candidate/row subtitle for disambiguation.
   * Relation paths auto-expand (e.g. `primary_business_unit_id.name`).
   * @example ['primary_business_unit_id.name', 'email']
   */
  subtitle?: string[];

  /** Field holding the avatar image URL. Default `image`. */
  avatar_field?: string;

  /**
   * Base candidate filters applied to the picker query — e.g. exclude
   * deactivated users. Defaults to excluding `banned` users for user fields.
   * @example [{ field: 'banned', operator: 'ne', value: true }]
   */
  lookup_filters?: LookupFilterDef[];
}

/**
 * Object field metadata (JSON object)
 */
export interface ObjectFieldMetadata extends BaseFieldMetadata {
  type: 'object';
  schema?: Record<string, any>;
}

/**
 * Vector field metadata (embeddings)
 * Phase 3.2.1: Complete vector field implementation
 */
export interface VectorFieldMetadata extends BaseFieldMetadata {
  type: 'vector';
  /**
   * Vector dimensions (e.g., 768 for BERT, 1536 for OpenAI)
   */
  dimensions?: number;
  /*
   * There is deliberately no `distance_metric` here (objectui#4687). It was
   * never a `FieldSchema` key: the installed `@objectstack/spec`'s vector
   * field shape declares no metric-spelling key at all (`dimensions` is the
   * only vector-specific key it recognizes), and `FieldSchema.safeParse`
   * rejects `distance_metric` by name (`unrecognized_keys`) with no
   * alias/rename entry pointing anywhere else. It had zero readers and zero
   * writers repo-wide, so there was no capability to preserve by renaming —
   * only a dead declaration to remove.
   */
  /*
   * There is deliberately no `indexed` here (objectui#4679, objectui#4687).
   * The ObjectStack spec has no field-level index flag: it built no index
   * (objectstack#2377 removed it) and `FieldSchema.safeParse` now rejects the
   * key by name, so any producer that authored it produced a save-blocking
   * 422. Declare the index on the object instead — `indexes: [{ name,
   * fields, unique }]`.
   */
  /**
   * Normalization strategy
   */
  normalize?: boolean;
}

/**
 * Grid field metadata (sub-table)
 * Phase 3.2.2: Complete grid field implementation
 */
export interface GridFieldMetadata extends BaseFieldMetadata {
  type: 'grid';
  /**
   * Column definitions for the grid
   */
  columns?: GridColumnDefinition[];
  /**
   * Minimum number of rows
   */
  min_rows?: number;
  /**
   * Maximum number of rows
   */
  max_rows?: number;
  /**
   * Whether to allow adding rows
   */
  allow_add?: boolean;
  /**
   * Whether to allow deleting rows
   */
  allow_delete?: boolean;
  /**
   * Whether to allow reordering rows
   */
  allow_reorder?: boolean;
}

/**
 * Grid column definition
 */
export interface GridColumnDefinition {
  /**
   * Column field name
   */
  name: string;
  /**
   * Column label
   */
  label?: string;
  /**
   * Field type
   */
  type: string;
  /**
   * Whether column is required
   */
  required?: boolean;
  /**
   * Default value for new rows
   */
  defaultValue?: any;
  /**
   * Column width
   */
  width?: number;
  /**
   * Validation rules
   */
  validate?: FieldConstraints;
}

export interface ColorFieldMetadata extends BaseFieldMetadata {
  type: 'color';
}

export interface CodeFieldMetadata extends BaseFieldMetadata {
  type: 'code';
}

export interface AvatarFieldMetadata extends BaseFieldMetadata {
  type: 'avatar';
}

export interface SignatureFieldMetadata extends BaseFieldMetadata {
  type: 'signature';
}

export interface QRCodeFieldMetadata extends BaseFieldMetadata {
  type: 'qrcode';
}

export interface AddressFieldMetadata extends BaseFieldMetadata {
  type: 'address';
}

export interface GeolocationFieldMetadata extends BaseFieldMetadata {
  type: 'geolocation';
}

export interface SliderFieldMetadata extends BaseFieldMetadata {
  type: 'slider';
  min?: number;
  max?: number;
}

export interface RatingFieldMetadata extends BaseFieldMetadata {
  type: 'rating';
  max?: number;
}

export interface MasterDetailFieldMetadata extends BaseFieldMetadata {
  type: 'master_detail';
  reference_to?: string;
}

/**
 * Union type of all field metadata types
 */
export type FieldMetadata =
  | TextFieldMetadata
  | TextareaFieldMetadata
  | MarkdownFieldMetadata
  | HtmlFieldMetadata
  | NumberFieldMetadata
  | CurrencyFieldMetadata
  | PercentFieldMetadata
  | BooleanFieldMetadata
  | DateFieldMetadata
  | DateTimeFieldMetadata
  | TimeFieldMetadata
  | SelectFieldMetadata
  | EmailFieldMetadata
  | PhoneFieldMetadata
  | UrlFieldMetadata
  | PasswordFieldMetadata
  | FileFieldMetadata
  | ImageFieldMetadata
  | LocationFieldMetadata
  | LookupFieldMetadata
  | FormulaFieldMetadata
  | SummaryFieldMetadata
  | AutoNumberFieldMetadata
  | UserFieldMetadata
  | ObjectFieldMetadata
  | VectorFieldMetadata
  | GridFieldMetadata
  | ColorFieldMetadata
  | CodeFieldMetadata
  | AvatarFieldMetadata
  | SignatureFieldMetadata
  | QRCodeFieldMetadata
  | AddressFieldMetadata
  | GeolocationFieldMetadata
  | SliderFieldMetadata
  | RatingFieldMetadata
  | MasterDetailFieldMetadata;

/**
 * Object document type — derived from `@objectstack/spec/data` rather than
 * restated (objectui#5362; maintainer ruling 2026-08-20: the object document
 * type belongs to `@objectstack/spec`, objectui derives rather than
 * hand-copies — the same layer split objectui#3074 applied to
 * `PageNodeSchema` and objectstack#4115 applied to `ObjectIndex` below).
 *
 * The hand-written interface this replaces had drifted in both directions:
 *
 * - It declared NONE of `titleFormat`, `listViews`, `icon` — three keys the
 *   shipped runtime reads (objectui#5362 lists the read sites), so a document
 *   annotated with this type got excess-property errors on keys the renderer
 *   then happily consumed.
 * - It declared nine members no objectui runtime code reads and the spec's
 *   object document does not know: `extends`, `triggers`, `primary_key`,
 *   `relationships`, `name_field` (the spec key is `nameField`),
 *   `soft_delete`, `audit_trail`, `version`, `cache`.
 *
 * Spelling (objectui#5362): the spec declares only camelCase `listViews`;
 * `list_views` appears nowhere in `@objectstack/spec` 17.2.0's `dist/`. The
 * runtime keeps a snake-spelling READ fallback for stored app data published
 * before this settlement (that stock has never been censused —
 * objectstack#7917); the tolerance lives at the read sites, deliberately not
 * in this type: new documents must author `listViews`.
 *
 * `ServiceObject` is the AUTHORING shape (`z.input` — pre-parse, defaults
 * not yet applied), which is what a hand-authored or served object document
 * is before validation. The post-parse shape is the spec's
 * `ServiceObjectParsed`.
 */
import type { ServiceObject } from '@objectstack/spec/data';

/**
 * Client-side members the objectui runtime reads on the object document but
 * `@objectstack/spec` does not declare. Every member here must cite a live
 * runtime read — this interface is the measured client DELTA on top of the
 * spec document, not a place to restate spec keys (restating them would
 * recreate the hand-written fork objectui#5362 retired). The member list is
 * pinned by `__tests__/object-schema-metadata-spec-derivation.test.ts`, so
 * growing it is a conscious decision: promote the key upstream to the spec,
 * or add it here with the runtime read that justifies it.
 */
export interface ObjectSchemaClientExtensions {
  /**
   * Default UI mode for record create/edit interactions.
   *
   * - `'modal'` (default) — open the record form inside a `ModalForm` dialog
   *   overlaid on top of the current view. Suitable for short forms and
   *   quick edits.
   * - `'page'` — navigate to a dedicated full-screen route
   *   (`/{objectName}/new` for create, `/{objectName}/record/:id/edit` for
   *   edit). URLs are deep-linkable, refresh-safe, and integrate with the
   *   browser back button. Recommended for objects with many fields,
   *   `tabbed` / `wizard` form layouts, or scenarios that benefit from
   *   shareable links to the create/edit form.
   *
   * The host application reads this flag in its central `handleEdit`
   * dispatcher (see `@object-ui/app-shell` `AppContent` and
   * `utils/recordFormNavigation.ts`) — switching the value requires no code
   * changes.
   *
   * @default 'modal'
   */
  editMode?: 'modal' | 'page';
}

/**
 * Object schema definition — the object document a data source's
 * `getObjectSchema(objectName)` serves, in its authoring shape, plus the
 * measured objectui client extensions above.
 */
export type ObjectSchemaMetadata = ServiceObject & ObjectSchemaClientExtensions;

/**
 * Object index configuration — re-exported from `@objectstack/spec/data`
 * rather than restated (objectstack#4115).
 *
 * The hand-written interface it replaces had drifted three ways: its `type`
 * enum was missing `fulltext`, `unique` was a bare `boolean` where the spec
 * also accepts `'global'` (the global-unique scope), and it had no `partial`
 * member at all — so a spec-authored partial or globally-unique index could
 * not be expressed here.
 */
import type { ObjectIndex } from '@objectstack/spec/data';
export type { ObjectIndex };
