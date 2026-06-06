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
      name: 'sections',
      label: 'Sections',
      kind: 'array',
      addLabel: 'Add section',
      itemFields: [
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
  'ai:chat_window': [
    { name: 'agentName', label: 'Agent', kind: 'text', placeholder: 'agent name' },
    { name: 'placeholder', label: 'Input placeholder', kind: 'text' },
  ],
  'ai:input': [
    { name: 'agentName', label: 'Agent', kind: 'text', placeholder: 'agent name' },
    { name: 'placeholder', label: 'Input placeholder', kind: 'text' },
  ],
};

/** Block types that expose a configurable property panel. */
export function blockHasConfig(type: string | undefined): boolean {
  return !!type && Array.isArray(BLOCK_CONFIG[type]) && BLOCK_CONFIG[type].length > 0;
}
