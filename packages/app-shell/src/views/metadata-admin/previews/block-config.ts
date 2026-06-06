// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * block-config — per-block configurable property schemas for the page editor.
 *
 * The page block inspector renders these as typed fields that edit the block's
 * `properties` (the spec convention; the renderer hoists `properties.*` to the
 * top level). This is the minimal, SDUI-essential set of content blocks so each
 * is configurable in the UI instead of only via raw JSON. Add more block types
 * here as they are needed — keep the field `name`s aligned with the property
 * names the corresponding renderer reads.
 */

export type BlockPropField =
  | { name: string; label: string; kind: 'text'; placeholder?: string }
  | { name: string; label: string; kind: 'number'; placeholder?: string }
  | { name: string; label: string; kind: 'boolean' }
  | { name: string; label: string; kind: 'select'; options: Array<{ value: string; label: string }> };

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
    {
      name: 'align',
      label: 'Align',
      kind: 'select',
      options: [
        { value: 'left', label: 'Left' },
        { value: 'center', label: 'Center' },
        { value: 'right', label: 'Right' },
      ],
    },
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

  // ── Record context ────────────────────────────────────────────────────────
  'record:related_list': [
    { name: 'objectName', label: 'Object', kind: 'text', placeholder: 'snake_case object' },
    { name: 'relationshipField', label: 'Relationship field', kind: 'text' },
    { name: 'title', label: 'Title', kind: 'text' },
    { name: 'limit', label: 'Limit', kind: 'number', placeholder: '10' },
  ],
};

/** Block types that expose a configurable property panel. */
export function blockHasConfig(type: string | undefined): boolean {
  return !!type && Array.isArray(BLOCK_CONFIG[type]) && BLOCK_CONFIG[type].length > 0;
}
