/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The slice of a field definition the widget decision reads beyond `type`.
 *
 * Structural (not the spec `Field`) for the same reason the spec's own
 * `ValueShapeFieldDef` is: every caller — object-schema metadata, a spec
 * `FormFieldSchema` override, an action param def — can pass its own trimmed
 * shape verbatim. `multiple` is the only key read; nothing else here is
 * consulted, so a caller that has the whole metadata object may hand it over
 * as-is.
 */
export interface FieldTypeMappingConfig {
  /** `FieldSchema.multiple` — the field holds zero-or-more values. */
  multiple?: boolean | null;
}

/**
 * Field types whose `multiple: true` form is a DIFFERENT registered widget,
 * rather than the same widget in another mode (objectui#3986).
 *
 * `select` is the only member, and the narrowness is measured, not assumed. The
 * spec's `MULTI_CAPABLE_TYPES` is larger — select / lookup / file / image, with
 * `radio` on the select branch and `user` storing like `lookup` — but every
 * other member renders both arities INSIDE one widget: `LookupField`,
 * `FileField` and `ImageField` each branch on `multiple` themselves, so their
 * registry id, and with it their `labelling` declaration, is the same either
 * way. A `select` declared `multiple: true` renders `MultiSelectField` instead:
 * a different component, whose labelled surface is a chip row's container that
 * a `<label for>` cannot address (it must be named by IDREF, which is what
 * `field:multiselect`'s `labelling: 'group'` declares — objectui#3975/#3961).
 *
 * So the widget id has to carry the arity. When it did not, the host label was
 * associated by the declaration registered under `select` — a single-value
 * combobox that was NOT rendering — and the visible label of a normal
 * `{ type: 'select', multiple: true }` picklist named nothing at all. One place
 * decides which widget renders, so the declaration and the render cannot
 * disagree again.
 */
const MULTI_VALUE_FORM_TYPES: Record<string, string> = {
  select: 'field:multiselect',
};

/**
 * TOMBSTONE table — field-type spellings this renderer has RETIRED, mapped to
 * the prescription an author must follow instead (ADR-0049 enforce-or-remove).
 *
 * A retired spelling is not merely absent: absence here means
 * {@link mapFieldTypeToFormType}'s `|| 'field:text'` tail would hand back a
 * working plain text input, which is the failure mode this table exists to
 * prevent. An author who writes a retired name — or an AI author who copies one
 * out of a stale doc — must be TOLD, not quietly given a text box that looks
 * like it worked. So each entry resolves to {@link RETIRED_WIDGET_KEY_PREFIX}
 * plus the retired name: a registered tombstone widget that renders a visible
 * refusal naming the migration (`packages/fields/src/index.tsx`), while
 * {@link reportRetiredFieldType} writes the same prescription to the console.
 *
 * `owner` (objectui#4814, ruling A′): a synonym for `user` with zero behavioral
 * delta — both resolved to the SAME `UserField` widget — and absent from the
 * spec's closed 48-member `FieldType`, so no object schema could ever declare
 * it; it was reachable only through hand-written SDUI. Three code faces had
 * already drifted apart on this one word (the form's data-source rule excluded
 * it while plugin-grid's bulk dialog included it), which is the standing
 * evidence that a second spelling for one concept is a drift channel, not a
 * convenience. The idiom survives verbatim as `{ type: 'user', name: 'owner' }`.
 */
export const RETIRED_FIELD_TYPES: Readonly<Record<string, string>> = Object.freeze({
  owner:
    "[object-ui] Field type `owner` was RETIRED (objectui#4814). It was a synonym " +
    "for `user` with no behavioral difference, and it is not a member of " +
    "`@objectstack/spec`'s FieldType. Write the record-owner field as " +
    "`{ type: 'user', name: 'owner' }` — the field NAME carries the ownership " +
    "meaning, the type carries the widget. The `widget: 'field:owner'` spelling " +
    "is retired with it.",
});

/** Namespace prefix the retired spellings resolve into. */
const RETIRED_WIDGET_KEY_PREFIX = 'field:';

/**
 * Spellings already reported this session, so a retired type inside a rendered
 * list logs its prescription ONCE instead of once per row. The message is a
 * fix instruction for an author, not a per-render event — a 1000-row grid
 * repeating it 1000 times buries the very thing it is trying to surface.
 */
const reportedRetiredTypes = new Set<string>();

/**
 * Report a retired field-type spelling loudly, once per spelling.
 *
 * @param fieldType - The spelling the author wrote.
 * @returns `true` when `fieldType` is retired (whether or not this call was the
 * one that logged), so callers can branch on it without a second table lookup.
 */
export function reportRetiredFieldType(fieldType: string): boolean {
  const prescription = RETIRED_FIELD_TYPES[fieldType];
  if (!prescription) return false;
  if (!reportedRetiredTypes.has(fieldType)) {
    reportedRetiredTypes.add(fieldType);
    console.error(prescription);
  }
  return true;
}

/** Test seam — forget which spellings have been reported. */
export function resetRetiredFieldTypeReports(): void {
  reportedRetiredTypes.clear();
}

/**
 * Map field type to form component type
 *
 * @param fieldType - The ObjectQL field type identifier to convert
 * (for example: `"text"`, `"number"`, `"date"`, `"lookup"`).
 * @param config - The rest of the field definition, for the types whose widget
 * identity depends on more than the type string. Only `multiple` is read; see
 * {@link MULTI_VALUE_FORM_TYPES}. Omitting it maps the single-value form, which
 * is what every non-multi-capable type resolves to anyway.
 * @returns The normalized form field type string used in the form schema
 * (for example: `"input"`, `"textarea"`, `"date-picker"`, `"select"`).
 */
export function mapFieldTypeToFormType(
  fieldType: string,
  config?: FieldTypeMappingConfig,
): string {
  const typeMap: Record<string, string> = {
    // Text-based fields
    text: 'field:text',
    textarea: 'field:textarea',
    markdown: 'field:markdown', // Markdown editor (fallback to textarea)
    html: 'field:html', // Rich text editor (fallback to textarea)
    richtext: 'field:richtext', // WYSIWYG rich-text editor
    secret: 'field:password', // encrypted-at-rest value — mask input like a password

    // Numeric fields
    number: 'field:number',
    currency: 'field:currency',
    percent: 'field:percent',
    slider: 'field:slider',
    progress: 'field:slider', // bounded 0..100 progress — edit via slider
    rating: 'field:rating',

    // Date/Time fields
    date: 'field:date',
    datetime: 'field:datetime',
    time: 'field:time',

    // Boolean
    boolean: 'field:boolean',
    toggle: 'field:boolean', // toggle is a boolean rendered as a switch

    // Selection fields
    select: 'field:select',
    multiselect: 'field:multiselect',
    radio: 'field:radio',
    checkboxes: 'field:checkboxes',
    tags: 'field:tags',
    lookup: 'field:lookup',
    master_detail: 'field:master_detail',
    tree: 'field:lookup', // hierarchical reference — pick the parent via a lookup
    // `user` is a lookup specialized to sys_user, rendered by the UserField
    // person-picker (which delegates to the lookup picker). Without it the type
    // would fall through to `field:text`.
    //
    // `owner` was its synonym until objectui#4814 retired it — see
    // {@link RETIRED_FIELD_TYPES}. It is deliberately NOT re-added here: a
    // retired spelling must not resolve through the live table.
    user: 'field:user',

    // Contact fields
    email: 'field:email',
    phone: 'field:phone',
    url: 'field:url',

    // File / media fields
    file: 'field:file',
    image: 'field:image',
    avatar: 'field:avatar',
    video: 'field:file', // uploads as a file
    audio: 'field:file', // uploads as a file
    signature: 'field:signature',

    // Special / enhanced fields
    password: 'field:password',
    location: 'field:location', // Location/map field (fallback to input)
    geolocation: 'field:geolocation',
    address: 'field:address',
    color: 'field:color',
    code: 'field:code',
    json: 'field:code', // JSON edited in the code editor
    qrcode: 'field:qrcode',
    vector: 'field:vector',

    // Embedded structured values (stored as JSON on the row)
    object: 'field:object',
    composite: 'field:object', // embedded object
    record: 'field:object', // name-keyed map
    repeater: 'field:grid', // embedded array of rows

    // Auto-generated/computed fields (typically read-only)
    formula: 'field:formula',
    summary: 'field:summary',
    // `@objectstack/spec` spells this `autonumber`; the widget map key is
    // `auto_number`. Map both spellings so a spec-typed field/param doesn't
    // fall through to the plain text input.
    autonumber: 'field:auto_number',
    auto_number: 'field:auto_number',
  };

  // The arity override comes FIRST and is table-driven: only a type listed in
  // `MULTI_VALUE_FORM_TYPES` has a second widget to move to, so `multiple` on
  // any other type (a multi `lookup`, a multi `file`) resolves exactly as
  // before and keeps reaching the widget that handles both arities itself.
  if (config?.multiple && MULTI_VALUE_FORM_TYPES[fieldType]) {
    return MULTI_VALUE_FORM_TYPES[fieldType];
  }

  const live = typeMap[fieldType];
  if (live) return live;

  // A RETIRED spelling is answered before the `field:text` tail, and never by
  // it: falling through would render a working text input, which is exactly the
  // silent degradation the tombstone exists to prevent (objectui#4814).
  if (reportRetiredFieldType(fieldType)) {
    return `${RETIRED_WIDGET_KEY_PREFIX}${fieldType}`;
  }

  return 'field:text';
}
