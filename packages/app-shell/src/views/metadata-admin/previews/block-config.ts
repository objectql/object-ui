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
 *
 * ## `label` / `addLabel` hold a TRANSLATION KEY, not display text (#3913)
 *
 * Every `label`, every option `label` and every `addLabel` in this file is a key
 * into `../i18n.ts`, resolved by `PageBlockInspector` through `t(key, locale)` at
 * render. They used to be English literals, which is how a zh-CN admin got a
 * panel headed 「属性」 with every box under it named in English — the section
 * chrome went through `t()` and the panel's own content never did.
 *
 * The key is a function of WHERE the label lives, and that is the load-bearing
 * part rather than a naming preference:
 *
 *   field label          engine.inspector.pageBlock.field.<blockType>.<name>
 *   nested item label    engine.inspector.pageBlock.field.<blockType>.<array>.<name>
 *   array add button     engine.inspector.pageBlock.add.<blockType>.<name>
 *   select/color option  engine.inspector.pageBlock.option.<fieldName>.<value>
 *   placeholder prose    engine.inspector.pageBlock.placeholder.<blockType>.<name>
 *
 * `previews/__tests__/block-config-i18n.test.ts` re-derives all five shapes from
 * the table's own structure and asserts (a) the stored key equals the derived
 * one and (b) both locales define it. So a field added here without a
 * translation is red, and so is a key copy-pasted from a neighbouring block —
 * the second is the failure a bare "does the key exist?" check cannot see.
 *
 * ## `placeholder` is a KEY *or* a LITERAL, declared per field (#3979)
 *
 * #3913 moved `label`/`addLabel`/option labels and stopped there, so the
 * placeholder column stayed display text: a zh-CN admin opening `page:header`
 * read 「图标」 over a box hinting `lucide icon name`, in the panel #3913 had
 * just finished translating.
 *
 * The column could not simply follow `label`, because it is a MIXED surface —
 * of the 18 placeholders, 8 are prose telling the author what to type and 10 are
 * example VALUES (`20`, `https://…`, a JSON sample). Translating the second kind
 * is a defect, not a courtesy: those characters are what the author is meant to
 * enter, and a "translated" JSON sample yields metadata the schema rejects. So
 * the two meanings are separated in the TYPE (`PlaceholderSpec` below) rather
 * than by a convention plus a list of exceptions — the author of a new field
 * states which kind it is and cannot leave it implicit.
 *
 * The literal side is inventoried in the same test, so a later "helpful"
 * translation of `lucide icon name`'s neighbours has to argue with a pin instead
 * of quietly landing.
 *
 * Option keys deliberately omit the block type, so `format`'s number/currency/
 * percent are translated once for `object-metric` and `element:number`. Field
 * keys deliberately DO carry it, because the same English word needs different
 * Chinese in different blocks: `element:button.label` is the button's caption
 * (「按钮文字」) while `page:tabs.items.label` is a tab's title (「标签」), and
 * `Add section` is 「添加分区」 here but 「添加分组」 in the form-layout canvas
 * (`designer.canvas.addSection`). One key per meaning is why that is expressible.
 */

/** Where a field/field-list picker resolves its object from:
 *  - 'page' — the record page's bound object (draft.object)
 *  - 'self' — a sibling property on the same block (objectProp) */
export type ObjectSource = { objectFrom: 'page' } | { objectFrom: 'self'; objectProp: string };

/**
 * A field's input hint — EXACTLY ONE of two shapes, chosen where the field is
 * written (#3979):
 *
 *   { key: '…' }      prose telling the author what to type ("lucide icon
 *                     name"). A translation key into `../i18n.ts`, resolved by
 *                     `PageBlockInspector` through `t()` at render, exactly like
 *                     `label`.
 *   { literal: '…' }  a locale-invariant example VALUE — a number, a URL scheme,
 *                     a JSON sample. Passed through untranslated, because those
 *                     characters are what the author is meant to type.
 *
 * A bare string is deliberately NOT assignable. `placeholder: 'lucide icon
 * name'` — this file's own shape until #3979, and the first thing anything
 * generating a new field will reach for — is a TYPE error now, caught by
 * `type-check` in every lane and in the editor, instead of an English string
 * that renders into a Chinese panel and waits for a test somebody remembers to
 * run. The mutual `never`s reject "both at once" too, so the renderer never has
 * to pick a winner between them.
 */
export type PlaceholderSpec = { key: string; literal?: never } | { literal: string; key?: never };

/**
 * One curated property editor. Every `label` is a translation key, and every
 * `placeholder` declares whether it is one — see the file header for the five
 * key shapes and the tests that enforce them.
 */
export type BlockPropField =
  | { name: string; label: string; kind: 'text'; placeholder?: PlaceholderSpec }
  | { name: string; label: string; kind: 'number'; placeholder?: PlaceholderSpec }
  | { name: string; label: string; kind: 'boolean' }
  | { name: string; label: string; kind: 'select'; options: Array<{ value: string; label: string }> }
  | { name: string; label: string; kind: 'string-list'; placeholder?: PlaceholderSpec }
  // `addLabel` is REQUIRED (#3913). It was optional, and the inspector rendered
  // a bare English `'Add'` when it was absent — an untranslatable literal that
  // no locale table could reach. Making the contract require it is the fix that
  // deletes the fallback instead of translating it: a new array field cannot
  // compile without naming its add-button key.
  | { name: string; label: string; kind: 'array'; itemFields: BlockPropField[]; addLabel: string }
  | { name: string; label: string; kind: 'json'; placeholder?: PlaceholderSpec }
  | { name: string; label: string; kind: 'color'; options?: Array<{ value: string; label: string }> }
  // Schema-driven pickers — dropdowns populated from the live metadata.
  | { name: string; label: string; kind: 'object-picker'; placeholder?: PlaceholderSpec }
  | ({ name: string; label: string; kind: 'field-picker'; placeholder?: PlaceholderSpec } & ObjectSource)
  | ({ name: string; label: string; kind: 'field-list'; placeholder?: PlaceholderSpec } & ObjectSource);

/** Shared alignment options. The keys name the field (`align`), so reusing this
 *  const on a field called anything else turns the key-derivation pin red. */
const ALIGN_OPTS = [
  { value: 'left', label: 'engine.inspector.pageBlock.option.align.left' },
  { value: 'center', label: 'engine.inspector.pageBlock.option.align.center' },
  { value: 'right', label: 'engine.inspector.pageBlock.option.align.right' },
];

export const BLOCK_CONFIG: Record<string, BlockPropField[]> = {
  // ── Data-bound blocks (the high-traffic ones on app pages) ────────────────
  // These were previously absent, so selecting a table/form/metric on the
  // canvas opened an inspector with only type/id/className — every binding
  // (object, columns, filters) lived in source with no UI. Curated fields
  // cover the common props; anything else surfaces in the generic "Advanced"
  // section of PageBlockInspector so the panel is never out of sync with source.
  'object-grid': [
    { name: 'objectName', label: 'engine.inspector.pageBlock.field.object-grid.objectName', kind: 'object-picker' },
    { name: 'columns', label: 'engine.inspector.pageBlock.field.object-grid.columns', kind: 'field-list', objectFrom: 'self', objectProp: 'objectName' },
    // `{ literal: … }` — an example VALUE, not prose: see `PlaceholderSpec`.
    { name: 'pageSize', label: 'engine.inspector.pageBlock.field.object-grid.pageSize', kind: 'number', placeholder: { literal: '20' } },
    // `striped` / `bordered` were curated here until objectui#4649. They failed
    // the rule at the top of this file — "keep each field `name` aligned with
    // the property name the corresponding renderer reads" — because ObjectGrid
    // reads neither, and objectstack#7176 has since retired the upstream keys
    // they mirrored. An inspector toggle is the loudest way to declare a key
    // live, so it goes with the rest of the chain.
  ],
  'object-form': [
    { name: 'objectName', label: 'engine.inspector.pageBlock.field.object-form.objectName', kind: 'object-picker' },
    {
      name: 'mode', label: 'engine.inspector.pageBlock.field.object-form.mode', kind: 'select',
      options: [
        { value: 'create', label: 'engine.inspector.pageBlock.option.mode.create' },
        { value: 'edit', label: 'engine.inspector.pageBlock.option.mode.edit' },
        { value: 'view', label: 'engine.inspector.pageBlock.option.mode.view' },
      ],
    },
    {
      name: 'formType', label: 'engine.inspector.pageBlock.field.object-form.formType', kind: 'select',
      options: [
        { value: 'simple', label: 'engine.inspector.pageBlock.option.formType.simple' },
        { value: 'tabbed', label: 'engine.inspector.pageBlock.option.formType.tabbed' },
        { value: 'wizard', label: 'engine.inspector.pageBlock.option.formType.wizard' },
        { value: 'split', label: 'engine.inspector.pageBlock.option.formType.split' },
        { value: 'drawer', label: 'engine.inspector.pageBlock.option.formType.drawer' },
        { value: 'modal', label: 'engine.inspector.pageBlock.option.formType.modal' },
      ],
    },
    {
      name: 'layout', label: 'engine.inspector.pageBlock.field.object-form.layout', kind: 'select',
      options: [
        { value: 'vertical', label: 'engine.inspector.pageBlock.option.layout.vertical' },
        { value: 'horizontal', label: 'engine.inspector.pageBlock.option.layout.horizontal' },
        { value: 'inline', label: 'engine.inspector.pageBlock.option.layout.inline' },
        { value: 'grid', label: 'engine.inspector.pageBlock.option.layout.grid' },
      ],
    },
    { name: 'columns', label: 'engine.inspector.pageBlock.field.object-form.columns', kind: 'number', placeholder: { literal: '2' } },
    { name: 'fields', label: 'engine.inspector.pageBlock.field.object-form.fields', kind: 'field-list', objectFrom: 'self', objectProp: 'objectName' },
    { name: 'title', label: 'engine.inspector.pageBlock.field.object-form.title', kind: 'text' },
    { name: 'description', label: 'engine.inspector.pageBlock.field.object-form.description', kind: 'text' },
  ],
  'object-metric': [
    { name: 'objectName', label: 'engine.inspector.pageBlock.field.object-metric.objectName', kind: 'object-picker' },
    { name: 'label', label: 'engine.inspector.pageBlock.field.object-metric.label', kind: 'text' },
    { name: 'description', label: 'engine.inspector.pageBlock.field.object-metric.description', kind: 'text' },
    { name: 'icon', label: 'engine.inspector.pageBlock.field.object-metric.icon', kind: 'text', placeholder: { key: 'engine.inspector.pageBlock.placeholder.object-metric.icon' } },
    {
      name: 'colorVariant', label: 'engine.inspector.pageBlock.field.object-metric.colorVariant', kind: 'color',
      options: [
        { value: 'default', label: 'engine.inspector.pageBlock.option.colorVariant.default' },
        { value: 'blue', label: 'engine.inspector.pageBlock.option.colorVariant.blue' },
        { value: 'teal', label: 'engine.inspector.pageBlock.option.colorVariant.teal' },
        { value: 'orange', label: 'engine.inspector.pageBlock.option.colorVariant.orange' },
        { value: 'purple', label: 'engine.inspector.pageBlock.option.colorVariant.purple' },
        { value: 'success', label: 'engine.inspector.pageBlock.option.colorVariant.success' },
        { value: 'warning', label: 'engine.inspector.pageBlock.option.colorVariant.warning' },
        { value: 'danger', label: 'engine.inspector.pageBlock.option.colorVariant.danger' },
      ],
    },
    {
      name: 'format', label: 'engine.inspector.pageBlock.field.object-metric.format', kind: 'select',
      options: [
        { value: 'number', label: 'engine.inspector.pageBlock.option.format.number' },
        { value: 'currency', label: 'engine.inspector.pageBlock.option.format.currency' },
        { value: 'percent', label: 'engine.inspector.pageBlock.option.format.percent' },
      ],
    },
    { name: 'prefix', label: 'engine.inspector.pageBlock.field.object-metric.prefix', kind: 'text' },
    { name: 'suffix', label: 'engine.inspector.pageBlock.field.object-metric.suffix', kind: 'text' },
    // `aggregate` ({ field, function }) and `filter` are nested/complex — they
    // render in the generic Advanced section as editable JSON.
  ],
  'object-kanban': [
    { name: 'objectName', label: 'engine.inspector.pageBlock.field.object-kanban.objectName', kind: 'object-picker' },
    { name: 'groupField', label: 'engine.inspector.pageBlock.field.object-kanban.groupField', kind: 'field-picker', objectFrom: 'self', objectProp: 'objectName' },
    { name: 'titleField', label: 'engine.inspector.pageBlock.field.object-kanban.titleField', kind: 'field-picker', objectFrom: 'self', objectProp: 'objectName' },
    { name: 'cardFields', label: 'engine.inspector.pageBlock.field.object-kanban.cardFields', kind: 'field-list', objectFrom: 'self', objectProp: 'objectName' },
  ],

  // ── Layout grid ───────────────────────────────────────────────────────────
  grid: [
    { name: 'columns', label: 'engine.inspector.pageBlock.field.grid.columns', kind: 'number', placeholder: { literal: '3' } },
    { name: 'gap', label: 'engine.inspector.pageBlock.field.grid.gap', kind: 'number', placeholder: { literal: '4' } },
  ],

  // ── Content elements ──────────────────────────────────────────────────────
  'element:text': [
    { name: 'content', label: 'engine.inspector.pageBlock.field.element:text.content', kind: 'text', placeholder: { key: 'engine.inspector.pageBlock.placeholder.element:text.content' } },
    {
      name: 'variant',
      label: 'engine.inspector.pageBlock.field.element:text.variant',
      kind: 'select',
      options: [
        { value: 'heading', label: 'engine.inspector.pageBlock.option.variant.heading' },
        { value: 'subheading', label: 'engine.inspector.pageBlock.option.variant.subheading' },
        { value: 'body', label: 'engine.inspector.pageBlock.option.variant.body' },
        { value: 'caption', label: 'engine.inspector.pageBlock.option.variant.caption' },
      ],
    },
    { name: 'align', label: 'engine.inspector.pageBlock.field.element:text.align', kind: 'select', options: ALIGN_OPTS },
  ],
  'element:image': [
    { name: 'src', label: 'engine.inspector.pageBlock.field.element:image.src', kind: 'text', placeholder: { literal: 'https://…' } },
    { name: 'alt', label: 'engine.inspector.pageBlock.field.element:image.alt', kind: 'text' },
    {
      name: 'fit',
      label: 'engine.inspector.pageBlock.field.element:image.fit',
      kind: 'select',
      options: [
        { value: 'cover', label: 'engine.inspector.pageBlock.option.fit.cover' },
        { value: 'contain', label: 'engine.inspector.pageBlock.option.fit.contain' },
        { value: 'fill', label: 'engine.inspector.pageBlock.option.fit.fill' },
      ],
    },
  ],

  // ── Lightweight lists (compact, for simple data) ──────────────────────────
  'element:definition-list': [
    {
      name: 'items',
      label: 'engine.inspector.pageBlock.field.element:definition-list.items',
      kind: 'array',
      addLabel: 'engine.inspector.pageBlock.add.element:definition-list.items',
      itemFields: [
        { name: 'label', label: 'engine.inspector.pageBlock.field.element:definition-list.items.label', kind: 'text' },
        { name: 'value', label: 'engine.inspector.pageBlock.field.element:definition-list.items.value', kind: 'text' },
      ],
    },
    { name: 'columns', label: 'engine.inspector.pageBlock.field.element:definition-list.columns', kind: 'number', placeholder: { literal: '1' } },
    { name: 'inline', label: 'engine.inspector.pageBlock.field.element:definition-list.inline', kind: 'boolean' },
  ],
  'element:repeater': [
    { name: 'object', label: 'engine.inspector.pageBlock.field.element:repeater.object', kind: 'object-picker' },
    { name: 'titleField', label: 'engine.inspector.pageBlock.field.element:repeater.titleField', kind: 'field-picker', objectFrom: 'self', objectProp: 'object' },
    { name: 'fields', label: 'engine.inspector.pageBlock.field.element:repeater.fields', kind: 'field-list', objectFrom: 'self', objectProp: 'object' },
    { name: 'limit', label: 'engine.inspector.pageBlock.field.element:repeater.limit', kind: 'number', placeholder: { literal: '10' } },
    { name: 'emptyText', label: 'engine.inspector.pageBlock.field.element:repeater.emptyText', kind: 'text' },
    { name: 'divided', label: 'engine.inspector.pageBlock.field.element:repeater.divided', kind: 'boolean' },
  ],
  'element:number': [
    { name: 'object', label: 'engine.inspector.pageBlock.field.element:number.object', kind: 'object-picker' },
    { name: 'field', label: 'engine.inspector.pageBlock.field.element:number.field', kind: 'field-picker', objectFrom: 'self', objectProp: 'object' },
    {
      name: 'aggregate',
      label: 'engine.inspector.pageBlock.field.element:number.aggregate',
      kind: 'select',
      options: [
        { value: 'count', label: 'engine.inspector.pageBlock.option.aggregate.count' },
        { value: 'sum', label: 'engine.inspector.pageBlock.option.aggregate.sum' },
        { value: 'avg', label: 'engine.inspector.pageBlock.option.aggregate.avg' },
        { value: 'min', label: 'engine.inspector.pageBlock.option.aggregate.min' },
        { value: 'max', label: 'engine.inspector.pageBlock.option.aggregate.max' },
      ],
    },
    {
      name: 'format',
      label: 'engine.inspector.pageBlock.field.element:number.format',
      kind: 'select',
      options: [
        { value: 'number', label: 'engine.inspector.pageBlock.option.format.number' },
        { value: 'currency', label: 'engine.inspector.pageBlock.option.format.currency' },
        { value: 'percent', label: 'engine.inspector.pageBlock.option.format.percent' },
      ],
    },
    { name: 'prefix', label: 'engine.inspector.pageBlock.field.element:number.prefix', kind: 'text' },
    { name: 'suffix', label: 'engine.inspector.pageBlock.field.element:number.suffix', kind: 'text' },
  ],
  'element:button': [
    { name: 'label', label: 'engine.inspector.pageBlock.field.element:button.label', kind: 'text' },
    {
      name: 'variant',
      label: 'engine.inspector.pageBlock.field.element:button.variant',
      kind: 'select',
      options: [
        { value: 'primary', label: 'engine.inspector.pageBlock.option.variant.primary' },
        { value: 'secondary', label: 'engine.inspector.pageBlock.option.variant.secondary' },
        { value: 'danger', label: 'engine.inspector.pageBlock.option.variant.danger' },
        { value: 'ghost', label: 'engine.inspector.pageBlock.option.variant.ghost' },
        { value: 'link', label: 'engine.inspector.pageBlock.option.variant.link' },
      ],
    },
    {
      name: 'size',
      label: 'engine.inspector.pageBlock.field.element:button.size',
      kind: 'select',
      options: [
        { value: 'small', label: 'engine.inspector.pageBlock.option.size.small' },
        { value: 'medium', label: 'engine.inspector.pageBlock.option.size.medium' },
        { value: 'large', label: 'engine.inspector.pageBlock.option.size.large' },
      ],
    },
    { name: 'icon', label: 'engine.inspector.pageBlock.field.element:button.icon', kind: 'text', placeholder: { key: 'engine.inspector.pageBlock.placeholder.element:button.icon' } },
    // Without `action` a button renders inert, and the generic "Advanced"
    // section can only edit properties the block ALREADY has — so a button
    // created in Studio had no way to become interactive at all. The spec
    // declares the prop as `InlineActionSchema` (objectstack#4135); a JSON
    // editor is the honest fit until the inspector can render a nested schema.
    {
      name: 'action',
      label: 'engine.inspector.pageBlock.field.element:button.action',
      kind: 'json',
      // A literal on purpose: this is the JSON an author copies, and a
      // "translated" `"type"`/`"target"` would produce metadata the spec
      // rejects. Pinned as locale-invariant in `block-config.test.ts`.
      placeholder: { literal: '{ "type": "url", "target": "/environments" }' },
    },
  ],

  // ── Layout containers ─────────────────────────────────────────────────────
  'page:header': [
    { name: 'title', label: 'engine.inspector.pageBlock.field.page:header.title', kind: 'text' },
    { name: 'subtitle', label: 'engine.inspector.pageBlock.field.page:header.subtitle', kind: 'text' },
    // No `icon` field: `PageHeaderProps.icon` was retired from the spec in
    // @objectstack/spec 17.0.0-rc.6 (objectstack#6946 / PR objectstack#7115,
    // ADR-0087 D2, maintainer ruling 2026-08-09 route (c)). The canonical
    // `page:header` renderer never read it — the header's identity is drawn by
    // the record chrome (`recordChrome`) and each action carries its own `icon`
    // — so before the retirement an authored value was silently dropped, and
    // after it the platform rejects the key BY NAME. Offering the box here
    // would let the designer author metadata that fails to parse, which is
    // strictly worse than the silent drop it replaced. Pinned negatively in
    // `__tests__/block-config.test.ts`. objectui#3829.
    { name: 'breadcrumb', label: 'engine.inspector.pageBlock.field.page:header.breadcrumb', kind: 'boolean' },
  ],
  'page:card': [
    { name: 'title', label: 'engine.inspector.pageBlock.field.page:card.title', kind: 'text' },
    { name: 'bordered', label: 'engine.inspector.pageBlock.field.page:card.bordered', kind: 'boolean' },
  ],
  'page:tabs': [
    {
      name: 'items',
      label: 'engine.inspector.pageBlock.field.page:tabs.items',
      kind: 'array',
      addLabel: 'engine.inspector.pageBlock.add.page:tabs.items',
      itemFields: [
        { name: 'key', label: 'engine.inspector.pageBlock.field.page:tabs.items.key', kind: 'text' },
        { name: 'label', label: 'engine.inspector.pageBlock.field.page:tabs.items.label', kind: 'text' },
      ],
    },
  ],
  // No top-level `title` field, and no `value` on an item: neither is read by
  // `PageAccordionRenderer` (`renderers/layout/containers.tsx`) and neither is
  // a member of `PageAccordionProps` in `@objectstack/spec` — an author who
  // filled either in got no effect and no diagnostic (objectui#5212).
  //   - `title`: the renderer reads `items`, `allowMultiple`, `variant`; there
  //     is no accordion-level heading. `PageAccordionProps`'s shape has no
  //     `title` key at all — a strict-object rejection, not a silent drop, once
  //     the value reaches metadata validation.
  //   - `items[].value`: the renderer OVERWRITES it before render —
  //     `itemsWithValue = items.map((it, idx) => ({ ...it, value:
  //     \`panel-${idx}\` }))` — so an authored value never reaches the Radix
  //     item. This is NOT the `page:tabs` case one component over: there, an
  //     authored `items[].value` (designer field name `key`) really is read,
  //     with a `tab-${idx}` fallback only when absent. The accordion's panel id
  //     is unconditionally derived; the tabs one is genuinely live. The spec
  //     mirrors the asymmetry — `PageAccordionProps.items[]` deliberately does
  //     not declare `value` and carries a `guidance` prescription pointing an
  //     author at the same fact, while `PageTabsProps.items[].value` is a real
  //     schema member.
  'page:accordion': [
    {
      name: 'items',
      label: 'engine.inspector.pageBlock.field.page:accordion.items',
      kind: 'array',
      addLabel: 'engine.inspector.pageBlock.add.page:accordion.items',
      itemFields: [
        { name: 'label', label: 'engine.inspector.pageBlock.field.page:accordion.items.label', kind: 'text' },
      ],
    },
  ],

  // ── Record context ────────────────────────────────────────────────────────
  'record:related_list': [
    { name: 'objectName', label: 'engine.inspector.pageBlock.field.record:related_list.objectName', kind: 'object-picker' },
    { name: 'relationshipField', label: 'engine.inspector.pageBlock.field.record:related_list.relationshipField', kind: 'field-picker', objectFrom: 'self', objectProp: 'objectName' },
    { name: 'title', label: 'engine.inspector.pageBlock.field.record:related_list.title', kind: 'text' },
    { name: 'limit', label: 'engine.inspector.pageBlock.field.record:related_list.limit', kind: 'number', placeholder: { literal: '10' } },
  ],
  'record:highlights': [
    { name: 'fields', label: 'engine.inspector.pageBlock.field.record:highlights.fields', kind: 'field-list', objectFrom: 'page' },
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
      // one for a single field is outside this fix. That convention is prose
      // ABOUT the value, so the placeholder is a key (#3979) and both locales
      // must keep the `snake_case` token verbatim inside it.
      name: 'sections',
      label: 'engine.inspector.pageBlock.field.record:details.sections',
      kind: 'array',
      addLabel: 'engine.inspector.pageBlock.add.record:details.sections',
      itemFields: [
        { name: 'name', label: 'engine.inspector.pageBlock.field.record:details.sections.name', kind: 'text', placeholder: { key: 'engine.inspector.pageBlock.placeholder.record:details.sections.name' } },
        { name: 'label', label: 'engine.inspector.pageBlock.field.record:details.sections.label', kind: 'text' },
        { name: 'columns', label: 'engine.inspector.pageBlock.field.record:details.sections.columns', kind: 'number', placeholder: { literal: '2' } },
        { name: 'fields', label: 'engine.inspector.pageBlock.field.record:details.sections.fields', kind: 'field-list', objectFrom: 'page' },
      ],
    },
  ],
  'record:alert': [
    {
      name: 'severity',
      label: 'engine.inspector.pageBlock.field.record:alert.severity',
      kind: 'select',
      options: [
        { value: 'info', label: 'engine.inspector.pageBlock.option.severity.info' },
        { value: 'warning', label: 'engine.inspector.pageBlock.option.severity.warning' },
        { value: 'error', label: 'engine.inspector.pageBlock.option.severity.error' },
        { value: 'success', label: 'engine.inspector.pageBlock.option.severity.success' },
      ],
    },
    { name: 'title', label: 'engine.inspector.pageBlock.field.record:alert.title', kind: 'text' },
    { name: 'body', label: 'engine.inspector.pageBlock.field.record:alert.body', kind: 'text' },
    { name: 'icon', label: 'engine.inspector.pageBlock.field.record:alert.icon', kind: 'text', placeholder: { key: 'engine.inspector.pageBlock.placeholder.record:alert.icon' } },
    { name: 'dismissible', label: 'engine.inspector.pageBlock.field.record:alert.dismissible', kind: 'boolean' },
  ],
  'record:path': [
    { name: 'statusField', label: 'engine.inspector.pageBlock.field.record:path.statusField', kind: 'field-picker', objectFrom: 'page' },
    {
      name: 'stages',
      label: 'engine.inspector.pageBlock.field.record:path.stages',
      kind: 'array',
      addLabel: 'engine.inspector.pageBlock.add.record:path.stages',
      itemFields: [
        { name: 'value', label: 'engine.inspector.pageBlock.field.record:path.stages.value', kind: 'text' },
        { name: 'label', label: 'engine.inspector.pageBlock.field.record:path.stages.label', kind: 'text' },
      ],
    },
  ],
  'record:quick_actions': [
    { name: 'actionNames', label: 'engine.inspector.pageBlock.field.record:quick_actions.actionNames', kind: 'string-list', placeholder: { key: 'engine.inspector.pageBlock.placeholder.record:quick_actions.actionNames' } },
    {
      name: 'location',
      label: 'engine.inspector.pageBlock.field.record:quick_actions.location',
      kind: 'select',
      options: [
        { value: 'record_header', label: 'engine.inspector.pageBlock.option.location.record_header' },
        { value: 'record_more', label: 'engine.inspector.pageBlock.option.location.record_more' },
        { value: 'record_section', label: 'engine.inspector.pageBlock.option.location.record_section' },
        { value: 'record_related', label: 'engine.inspector.pageBlock.option.location.record_related' },
        { value: 'list_toolbar', label: 'engine.inspector.pageBlock.option.location.list_toolbar' },
        { value: 'list_item', label: 'engine.inspector.pageBlock.option.location.list_item' },
        // No `global_nav` option: the location was retired from the spec's
        // `ACTION_LOCATIONS` in @objectstack/spec 17.0.0-rc.6 (objectstack#6888).
        // Offering it here would let the designer author a value the schema now
        // rejects by name. Pinned negatively in `__tests__/block-config.test.ts`.
      ],
    },
  ],

  // ── AI ────────────────────────────────────────────────────────────────────
  // No `ai:chat_window` panel: the block is not in the palette (no inline
  // renderer — see block-types.ts PALETTE_EXCLUSIONS, #2943). A config panel
  // for an unauthorable block is how the contradiction stayed invisible.
  'ai:input': [
    { name: 'agentName', label: 'engine.inspector.pageBlock.field.ai:input.agentName', kind: 'text', placeholder: { key: 'engine.inspector.pageBlock.placeholder.ai:input.agentName' } },
    { name: 'placeholder', label: 'engine.inspector.pageBlock.field.ai:input.placeholder', kind: 'text' },
  ],
};

/** Block types that expose a configurable property panel. */
export function blockHasConfig(type: string | undefined): boolean {
  return !!type && Array.isArray(BLOCK_CONFIG[type]) && BLOCK_CONFIG[type].length > 0;
}
