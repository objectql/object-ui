// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * block-config — per-block configurable property schemas for the page editor.
 *
 * The page block inspector renders these as typed fields that edit the block's
 * `properties` (the spec convention; the renderer hoists `properties.*` to the
 * top level). Keep each field `name` aligned with the property name the
 * corresponding renderer reads. Add block types here as they are needed.
 *
 * Field kinds:
 *   text | number | boolean | select  — scalar props
 *   string-list                       — an array of strings (e.g. field names)
 *   array (+ itemFields)              — an array of objects (e.g. tab items)
 *   json                              — a nested object edited as raw JSON, for
 *                                       props whose shape the inspector cannot
 *                                       yet render as fields (e.g. an inline
 *                                       action). Curating it matters even
 *                                       though "Advanced" also renders JSON:
 *                                       Advanced only lists keys the block
 *                                       ALREADY has, so it can edit such a prop
 *                                       but never add one.
 */

/** Where a field/field-list picker resolves its object from:
 *  - 'page' — the record page's bound object (draft.object)
 *  - 'self' — a sibling property on the same block (objectProp) */
export type ObjectSource = { objectFrom: 'page' } | { objectFrom: 'self'; objectProp: string };

export type BlockPropField =
  | { name: string; label: string; kind: 'text'; placeholder?: string }
  | { name: string; label: string; kind: 'number'; placeholder?: string }
  | { name: string; label: string; kind: 'boolean' }
  | { name: string; label: string; kind: 'select'; options: Array<{ value: string; label: string }> }
  | { name: string; label: string; kind: 'string-list'; placeholder?: string }
  | { name: string; label: string; kind: 'array'; itemFields: BlockPropField[]; addLabel?: string }
  | { name: string; label: string; kind: 'json'; placeholder?: string }
  | { name: string; label: string; kind: 'color'; options?: Array<{ value: string; label: string }> }
  // Schema-driven pickers — dropdowns populated from the live metadata.
  | { name: string; label: string; kind: 'object-picker'; placeholder?: string }
  | ({ name: string; label: string; kind: 'field-picker'; placeholder?: string } & ObjectSource)
  | ({ name: string; label: string; kind: 'field-list'; placeholder?: string } & ObjectSource);

const ALIGN_OPTS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

export const BLOCK_CONFIG: Record<string, BlockPropField[]> = {
  // ── Data-bound blocks (the high-traffic ones on app pages) ────────────────
  // These were previously absent, so selecting a table/form/metric on the
  // canvas opened an inspector with only type/id/className — every binding
  // (object, columns, filters) lived in source with no UI. Curated fields
  // cover the common props; anything else surfaces in the generic "Advanced"
  // section of PageBlockInspector so the panel is never out of sync with source.
  'object-grid': [
    { name: 'objectName', label: 'Object', kind: 'object-picker' },
    { name: 'columns', label: 'Columns', kind: 'field-list', objectFrom: 'self', objectProp: 'objectName' },
    { name: 'pageSize', label: 'Page size', kind: 'number', placeholder: '20' },
    { name: 'striped', label: 'Striped rows', kind: 'boolean' },
    { name: 'bordered', label: 'Bordered', kind: 'boolean' },
  ],
  'object-form': [
    { name: 'objectName', label: 'Object', kind: 'object-picker' },
    {
      name: 'mode', label: 'Mode', kind: 'select',
      options: [
        { value: 'create', label: 'Create' },
        { value: 'edit', label: 'Edit' },
        { value: 'view', label: 'View' },
      ],
    },
    {
      name: 'formType', label: 'Form type', kind: 'select',
      options: [
        { value: 'simple', label: 'Simple' },
        { value: 'tabbed', label: 'Tabbed' },
        { value: 'wizard', label: 'Wizard' },
        { value: 'split', label: 'Split' },
        { value: 'drawer', label: 'Drawer' },
        { value: 'modal', label: 'Modal' },
      ],
    },
    {
      name: 'layout', label: 'Layout', kind: 'select',
      options: [
        { value: 'vertical', label: 'Vertical' },
        { value: 'horizontal', label: 'Horizontal' },
        { value: 'inline', label: 'Inline' },
        { value: 'grid', label: 'Grid' },
      ],
    },
    { name: 'columns', label: 'Columns (grid layout)', kind: 'number', placeholder: '2' },
    { name: 'fields', label: 'Fields', kind: 'field-list', objectFrom: 'self', objectProp: 'objectName' },
    { name: 'title', label: 'Title', kind: 'text' },
    { name: 'description', label: 'Description', kind: 'text' },
  ],
  'object-metric': [
    { name: 'objectName', label: 'Object', kind: 'object-picker' },
    { name: 'label', label: 'Label', kind: 'text' },
    { name: 'description', label: 'Description', kind: 'text' },
    { name: 'icon', label: 'Icon', kind: 'text', placeholder: 'lucide icon name' },
    {
      name: 'colorVariant', label: 'Color', kind: 'color',
      options: [
        { value: 'default', label: 'Default' },
        { value: 'blue', label: 'Blue' },
        { value: 'teal', label: 'Teal' },
        { value: 'orange', label: 'Orange' },
        { value: 'purple', label: 'Purple' },
        { value: 'success', label: 'Success' },
        { value: 'warning', label: 'Warning' },
        { value: 'danger', label: 'Danger' },
      ],
    },
    {
      name: 'format', label: 'Format', kind: 'select',
      options: [
        { value: 'number', label: 'Number' },
        { value: 'currency', label: 'Currency' },
        { value: 'percent', label: 'Percent' },
      ],
    },
    { name: 'prefix', label: 'Prefix', kind: 'text' },
    { name: 'suffix', label: 'Suffix', kind: 'text' },
    // `aggregate` ({ field, function }) and `filter` are nested/complex — they
    // render in the generic Advanced section as editable JSON.
  ],
  'object-kanban': [
    { name: 'objectName', label: 'Object', kind: 'object-picker' },
    { name: 'groupField', label: 'Group by field', kind: 'field-picker', objectFrom: 'self', objectProp: 'objectName' },
    { name: 'titleField', label: 'Title field', kind: 'field-picker', objectFrom: 'self', objectProp: 'objectName' },
    { name: 'cardFields', label: 'Card fields', kind: 'field-list', objectFrom: 'self', objectProp: 'objectName' },
  ],

  // ── Layout grid ───────────────────────────────────────────────────────────
  grid: [
    { name: 'columns', label: 'Columns', kind: 'number', placeholder: '3' },
    { name: 'gap', label: 'Gap', kind: 'number', placeholder: '4' },
  ],

  // ── Content elements ──────────────────────────────────────────────────────
  'element:text': [
    { name: 'content', label: 'Content', kind: 'text', placeholder: 'Text…' },
    {
      name: 'variant',
      label: 'Variant',
      kind: 'select',
      options: [
        { value: 'heading', label: 'Heading' },
        { value: 'subheading', label: 'Subheading' },
        { value: 'body', label: 'Body' },
        { value: 'caption', label: 'Caption' },
      ],
    },
    { name: 'align', label: 'Align', kind: 'select', options: ALIGN_OPTS },
  ],
  'element:image': [
    { name: 'src', label: 'Source URL', kind: 'text', placeholder: 'https://…' },
    { name: 'alt', label: 'Alt text', kind: 'text' },
    {
      name: 'fit',
      label: 'Fit',
      kind: 'select',
      options: [
        { value: 'cover', label: 'Cover' },
        { value: 'contain', label: 'Contain' },
        { value: 'fill', label: 'Fill' },
      ],
    },
  ],

  // ── Lightweight lists (compact, for simple data) ──────────────────────────
  'element:definition-list': [
    {
      name: 'items',
      label: 'Items',
      kind: 'array',
      addLabel: 'Add item',
      itemFields: [
        { name: 'label', label: 'Label', kind: 'text' },
        { name: 'value', label: 'Value', kind: 'text' },
      ],
    },
    { name: 'columns', label: 'Columns (1 or 2)', kind: 'number', placeholder: '1' },
    { name: 'inline', label: 'Inline (label · value)', kind: 'boolean' },
  ],
  'element:repeater': [
    { name: 'object', label: 'Object', kind: 'object-picker' },
    { name: 'titleField', label: 'Title field', kind: 'field-picker', objectFrom: 'self', objectProp: 'object' },
    { name: 'fields', label: 'Fields', kind: 'field-list', objectFrom: 'self', objectProp: 'object' },
    { name: 'limit', label: 'Limit', kind: 'number', placeholder: '10' },
    { name: 'emptyText', label: 'Empty text', kind: 'text' },
    { name: 'divided', label: 'Dividers between rows', kind: 'boolean' },
  ],
  'element:number': [
    { name: 'object', label: 'Object', kind: 'object-picker' },
    { name: 'field', label: 'Field', kind: 'field-picker', objectFrom: 'self', objectProp: 'object' },
    {
      name: 'aggregate',
      label: 'Aggregate',
      kind: 'select',
      options: [
        { value: 'count', label: 'Count' },
        { value: 'sum', label: 'Sum' },
        { value: 'avg', label: 'Average' },
        { value: 'min', label: 'Min' },
        { value: 'max', label: 'Max' },
      ],
    },
    {
      name: 'format',
      label: 'Format',
      kind: 'select',
      options: [
        { value: 'number', label: 'Number' },
        { value: 'currency', label: 'Currency' },
        { value: 'percent', label: 'Percent' },
      ],
    },
    { name: 'prefix', label: 'Prefix', kind: 'text' },
    { name: 'suffix', label: 'Suffix', kind: 'text' },
  ],
  'element:button': [
    { name: 'label', label: 'Label', kind: 'text' },
    {
      name: 'variant',
      label: 'Variant',
      kind: 'select',
      options: [
        { value: 'primary', label: 'Primary' },
        { value: 'secondary', label: 'Secondary' },
        { value: 'danger', label: 'Danger' },
        { value: 'ghost', label: 'Ghost' },
        { value: 'link', label: 'Link' },
      ],
    },
    {
      name: 'size',
      label: 'Size',
      kind: 'select',
      options: [
        { value: 'small', label: 'Small' },
        { value: 'medium', label: 'Medium' },
        { value: 'large', label: 'Large' },
      ],
    },
    { name: 'icon', label: 'Icon', kind: 'text', placeholder: 'lucide icon name' },
    // Without `action` a button renders inert, and the generic "Advanced"
    // section can only edit properties the block ALREADY has — so a button
    // created in Studio had no way to become interactive at all. The spec
    // declares the prop as `InlineActionSchema` (objectstack#4135); a JSON
    // editor is the honest fit until the inspector can render a nested schema.
    {
      name: 'action',
      label: 'Action',
      kind: 'json',
      placeholder: '{ "type": "url", "target": "/environments" }',
    },
  ],

  // ── Layout containers ─────────────────────────────────────────────────────
  'page:header': [
    { name: 'title', label: 'Title', kind: 'text' },
    { name: 'subtitle', label: 'Subtitle', kind: 'text' },
    { name: 'icon', label: 'Icon', kind: 'text', placeholder: 'lucide icon name' },
    { name: 'breadcrumb', label: 'Show breadcrumb', kind: 'boolean' },
  ],
  'page:card': [
    { name: 'title', label: 'Title', kind: 'text' },
    { name: 'bordered', label: 'Bordered', kind: 'boolean' },
  ],
  'page:tabs': [
    {
      name: 'items',
      label: 'Tabs',
      kind: 'array',
      addLabel: 'Add tab',
      itemFields: [
        { name: 'key', label: 'Key', kind: 'text' },
        { name: 'label', label: 'Label', kind: 'text' },
      ],
    },
  ],
  'page:accordion': [
    { name: 'title', label: 'Title', kind: 'text' },
    {
      name: 'items',
      label: 'Sections',
      kind: 'array',
      addLabel: 'Add section',
      itemFields: [
        { name: 'value', label: 'Key', kind: 'text' },
        { name: 'label', label: 'Label', kind: 'text' },
      ],
    },
  ],

  // ── Record context ────────────────────────────────────────────────────────
  'record:related_list': [
    { name: 'objectName', label: 'Object', kind: 'object-picker' },
    { name: 'relationshipField', label: 'Relationship field', kind: 'field-picker', objectFrom: 'self', objectProp: 'objectName' },
    { name: 'title', label: 'Title', kind: 'text' },
    { name: 'limit', label: 'Limit', kind: 'number', placeholder: '10' },
  ],
  'record:highlights': [
    { name: 'fields', label: 'Fields', kind: 'field-list', objectFrom: 'page' },
  ],
  'record:details': [
    {
      // A section's `name` is its i18n anchor, not decoration: the renderer
      // resolves the heading through `objects.<object>._sections.<name>.label`
      // (`record-details.tsx` → `sectionLabel`; key convention in
      // `i18n/useObjectLabel.ts`), and a nameless section shows its authored
      // label in every locale. While this field was missing the designer could
      // only produce structurally untranslatable sections, and every page it
      // built carried an upstream `translation-section-name-missing`
      // diagnostic its author had no UI to clear (objectui#3819). It is listed
      // first because it is the entry's identity — same order as
      // `page:tabs`/`page:accordion`, where the key precedes the label.
      //
      // Deliberately NOT derived from `label`: an author who already localized
      // the heading would get that translated text frozen into the anchor, and
      // the anchor is the one value that must stay stable across locales. The
      // placeholder carries the snake_case convention because `BlockPropField`
      // has no pattern/validate affordance — see the type above — and adding
      // one for a single field is outside this fix.
      name: 'sections',
      label: 'Sections',
      kind: 'array',
      addLabel: 'Add section',
      itemFields: [
        { name: 'name', label: 'Name (i18n key)', kind: 'text', placeholder: 'snake_case, e.g. contact_info' },
        { name: 'label', label: 'Label', kind: 'text' },
        { name: 'columns', label: 'Columns', kind: 'number', placeholder: '2' },
        { name: 'fields', label: 'Fields', kind: 'field-list', objectFrom: 'page' },
      ],
    },
  ],
  'record:alert': [
    {
      name: 'severity',
      label: 'Severity',
      kind: 'select',
      options: [
        { value: 'info', label: 'Info' },
        { value: 'warning', label: 'Warning' },
        { value: 'error', label: 'Error' },
        { value: 'success', label: 'Success' },
      ],
    },
    { name: 'title', label: 'Title', kind: 'text' },
    { name: 'body', label: 'Body', kind: 'text' },
    { name: 'icon', label: 'Icon', kind: 'text', placeholder: 'lucide icon name' },
    { name: 'dismissible', label: 'Dismissible', kind: 'boolean' },
  ],
  'record:path': [
    { name: 'statusField', label: 'Status field', kind: 'field-picker', objectFrom: 'page' },
    {
      name: 'stages',
      label: 'Stages',
      kind: 'array',
      addLabel: 'Add stage',
      itemFields: [
        { name: 'value', label: 'Value', kind: 'text' },
        { name: 'label', label: 'Label', kind: 'text' },
      ],
    },
  ],
  'record:quick_actions': [
    { name: 'actionNames', label: 'Action names', kind: 'string-list', placeholder: 'action name' },
    {
      name: 'location',
      label: 'Location',
      kind: 'select',
      options: [
        { value: 'record_header', label: 'Record header' },
        { value: 'record_more', label: 'Record more menu' },
        { value: 'record_section', label: 'Record section' },
        { value: 'record_related', label: 'Record related' },
        { value: 'list_toolbar', label: 'List toolbar' },
        { value: 'list_item', label: 'List item' },
        { value: 'global_nav', label: 'Global nav' },
      ],
    },
  ],

  // ── AI ────────────────────────────────────────────────────────────────────
  // No `ai:chat_window` panel: the block is not in the palette (no inline
  // renderer — see block-types.ts PALETTE_EXCLUSIONS, #2943). A config panel
  // for an unauthorable block is how the contradiction stayed invisible.
  'ai:input': [
    { name: 'agentName', label: 'Agent', kind: 'text', placeholder: 'agent name' },
    { name: 'placeholder', label: 'Input placeholder', kind: 'text' },
  ],
};

/** Block types that expose a configurable property panel. */
export function blockHasConfig(type: string | undefined): boolean {
  return !!type && Array.isArray(BLOCK_CONFIG[type]) && BLOCK_CONFIG[type].length > 0;
}
