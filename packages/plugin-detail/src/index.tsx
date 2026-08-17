/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry, type ComponentInput } from '@object-ui/core';
import { withFieldCarrier } from '@object-ui/fields';
import { DetailView } from './DetailView';
import { DetailSection } from './DetailSection';
import { DetailTabs } from './DetailTabs';
import { RelatedList } from './RelatedList';
import { RecordDetailsRenderer } from './renderers/record-details';
import { RecordRelatedListRenderer } from './renderers/record-related-list';
import { RecordHighlightsRenderer } from './renderers/record-highlights';
import { RecordActivityRenderer } from './renderers/record-activity';
import { RecordChatterRenderer } from './renderers/record-chatter';
import { RecordPathRenderer } from './renderers/record-path';
import { RecordQuickActionsRenderer } from './renderers/record-quick-actions';
import { RecordHistoryRenderer } from './renderers/record-history';
import { RecordReferenceRailRenderer } from './renderers/record-reference-rail';
import { RecordAlertRenderer } from './renderers/record-alert';
import { PermissionFacetLink } from './renderers/PermissionFacetLink';
import type { DetailViewSchema } from '@object-ui/types';
import { ACTION_LOCATIONS } from '@object-ui/types';

export { DetailView, DetailSection, DetailTabs, RelatedList };
export {
  RecordDetailsRenderer,
  RecordRelatedListRenderer,
  RecordHighlightsRenderer,
  RecordActivityRenderer,
  RecordChatterRenderer,
  RecordPathRenderer,
  RecordQuickActionsRenderer,
  RecordHistoryRenderer,
  RecordReferenceRailRenderer,
  RecordAlertRenderer,
};
export { RecordDetailDrawer, deriveRecordPageHref } from './RecordDetailDrawer';
export type { RecordDetailDrawerProps } from './RecordDetailDrawer';
export {
  ConcurrentUpdateDialog,
  isConcurrentUpdateError,
} from './ConcurrentUpdateDialog';
export type {
  ConcurrentUpdateConflict,
  ConcurrentUpdateDialogProps,
} from './ConcurrentUpdateDialog';
export { useRecordEditable, __clearRecordEditableCache } from './useRecordEditable';
export type { RecordOperation } from './useRecordEditable';
export { SectionGroup } from './SectionGroup';
export { HeaderHighlight } from './HeaderHighlight';
export { InlineFieldInput, extractLookupId, TEXTUAL_REF_FALLBACK_TYPES } from './InlineFieldInput';
export type { InlineFieldInputProps } from './InlineFieldInput';
export { InlineEditSaveBar } from './InlineEditSaveBar';
export type { InlineEditSaveBarProps } from './InlineEditSaveBar';
export { inferDetailColumns, isWideFieldType, applyAutoSpan, applyDetailAutoLayout } from './autoLayout';
export { useDetailTranslation, DETAIL_DEFAULT_TRANSLATIONS, createSafeTranslationHook } from './useDetailTranslation';
export { RecordComments } from './RecordComments';
export { ActivityTimeline } from './ActivityTimeline';
export { HistoryTimeline } from './HistoryTimeline';
export { InlineCreateRelated } from './InlineCreateRelated';
export { RichTextCommentInput } from './RichTextCommentInput';
export { DiffView } from './DiffView';
export { RecordNavigationEnhanced } from './RecordNavigationEnhanced';
export { RelationshipGraph } from './RelationshipGraph';
export { CommentAttachment } from './CommentAttachment';
export { PointInTimeRestore } from './PointInTimeRestore';
export { RecordActivityTimeline } from './RecordActivityTimeline';
export { RecordChatterPanel } from './RecordChatterPanel';
export { CommentInput } from './CommentInput';
export { FieldChangeItem } from './FieldChangeItem';
export { MentionAutocomplete, createMentionFromSuggestion } from './MentionAutocomplete';
export { SubscriptionToggle } from './SubscriptionToggle';
export { ReactionPicker } from './ReactionPicker';
export { ThreadedReplies } from './ThreadedReplies';
export { RecordMetaFooter } from './RecordMetaFooter';
export type { RecordMetaFooterProps } from './RecordMetaFooter';
export type { DetailViewProps } from './DetailView';
export type { DetailSectionProps, VirtualScrollOptions } from './DetailSection';
export type { DetailTabsProps } from './DetailTabs';
export type { RelatedListProps } from './RelatedList';
export type { SectionGroupProps } from './SectionGroup';
export type { HeaderHighlightProps } from './HeaderHighlight';
export type { RecordCommentsProps } from './RecordComments';
export type { ActivityTimelineProps, ActivityFilterType } from './ActivityTimeline';
export type { HistoryTimelineProps, HistoryEntry } from './HistoryTimeline';
export type { InlineCreateRelatedProps, RelatedFieldDefinition, RelatedRecordOption } from './InlineCreateRelated';
export type { RichTextCommentInputProps, MentionSuggestion } from './RichTextCommentInput';
export { extractMentions } from './extractMentions';
export type { MentionTarget } from './extractMentions';
export type { DiffViewProps, DiffFieldType, DiffMode, DiffLine } from './DiffView';
export type { RecordNavigationEnhancedProps } from './RecordNavigationEnhanced';
export type { RelationshipGraphProps, GraphNode } from './RelationshipGraph';
export type { CommentAttachmentProps, Attachment } from './CommentAttachment';
export type { PointInTimeRestoreProps, RevisionEntry } from './PointInTimeRestore';
export type { RecordActivityTimelineProps, FeedFilterMode } from './RecordActivityTimeline';
export type { RecordChatterPanelProps } from './RecordChatterPanel';
export type { CommentInputProps } from './CommentInput';
export type { FieldChangeItemProps } from './FieldChangeItem';
export type { MentionAutocompleteProps, MentionSuggestionItem } from './MentionAutocomplete';
export type { SubscriptionToggleProps } from './SubscriptionToggle';
export type { ReactionPickerProps } from './ReactionPicker';
export type { ThreadedRepliesProps } from './ThreadedReplies';

// Track 3 (convergence): pure-function synthesizers for the default
// detail page. Phase G slice 1 — not yet wired into RecordDetailView.
export {
  buildDefaultPageSchema,
  buildDefaultHeader,
  buildDefaultActions,
  buildDefaultHighlights,
  buildDefaultDetails,
  buildDefaultTabs,
  buildDefaultDiscussion,
  detectStatusField,
  deriveStages,
  deriveHighlightFields,
  deriveFieldGroupDetailSections,
  resolveDetailSections,
  resolveTitleField,
} from './synth/buildDefaultPageSchema';
export type {
  ObjectDefLike,
  ObjectDefFieldLike,
  BuildPageOptions,
} from './synth/buildDefaultPageSchema';

// Register DetailView component
ComponentRegistry.register('detail-view', DetailView, {
  namespace: 'plugin-detail',
  label: 'Detail View',
  category: 'Views',
  icon: 'FileText',
  inputs: [
    { name: 'title', type: 'string', label: 'Title' },
    { name: 'objectName', type: 'string', label: 'Object Name' },
    { name: 'resourceId', type: 'string', label: 'Resource ID' },
    { name: 'api', type: 'string', label: 'API Endpoint' },
    { name: 'data', type: 'object', label: 'Data' },
    { name: 'layout', type: 'enum', label: 'Layout Mode', enum: ['vertical', 'horizontal', 'grid'] },
    { name: 'columns', type: 'number', label: 'Grid Columns' },
    { name: 'sections', type: 'array', label: 'Sections' },
    { name: 'fields', type: 'array', label: 'Fields' },
    { name: 'tabs', type: 'array', label: 'Tabs' },
    { name: 'related', type: 'array', label: 'Related Lists' },
    { name: 'actions', type: 'array', label: 'Actions' },
    { name: 'showBack', type: 'boolean', label: 'Show Back Button', defaultValue: true },
    { name: 'backUrl', type: 'string', label: 'Back URL' },
    { name: 'showEdit', type: 'boolean', label: 'Show Edit Button', defaultValue: false },
    { name: 'editUrl', type: 'string', label: 'Edit URL' },
    { name: 'showDelete', type: 'boolean', label: 'Show Delete Button', defaultValue: false },
    { name: 'deleteConfirmation', type: 'string', label: 'Delete Confirmation Message' },
    { name: 'loading', type: 'boolean', label: 'Show Loading State' },
    { name: 'header', type: 'object', label: 'Custom Header' },
    { name: 'footer', type: 'object', label: 'Custom Footer' },
  ],
  defaultProps: {
    title: 'Detail View',
    showBack: true,
    showEdit: false,
    showDelete: false,
    sections: [],
    fields: [],
    tabs: [],
    related: [],
  }
});

// Register DetailSection component
ComponentRegistry.register('detail-section', DetailSection, {
  namespace: 'plugin-detail',
  label: 'Detail Section',
  category: 'Detail Components',
  inputs: [
    { name: 'title', type: 'string', label: 'Title' },
    { name: 'description', type: 'string', label: 'Description' },
    { name: 'fields', type: 'array', label: 'Fields', required: true },
    { name: 'collapsible', type: 'boolean', label: 'Collapsible', defaultValue: false },
    { name: 'defaultCollapsed', type: 'boolean', label: 'Default Collapsed', defaultValue: false },
    { name: 'columns', type: 'number', label: 'Columns', defaultValue: 2 },
    { name: 'showBorder', type: 'boolean', label: 'Show Border', defaultValue: true },
    { name: 'headerColor', type: 'string', label: 'Header Color' },
  ],
});

// Register RelatedList component
ComponentRegistry.register('related-list', RelatedList, {
  namespace: 'plugin-detail',
  label: 'Related List',
  category: 'Detail Components',
  inputs: [
    { name: 'title', type: 'string', label: 'Title', required: true },
    { name: 'type', type: 'enum', label: 'Type', enum: [
      { label: 'List', value: 'list' },
      { label: 'Grid', value: 'grid' },
      { label: 'Table', value: 'table' }
    ], defaultValue: 'table' },
    { name: 'api', type: 'string', label: 'API Endpoint' },
    { name: 'data', type: 'array', label: 'Data' },
    { name: 'columns', type: 'array', label: 'Columns' },
  ],
});

// Alias for generic view
ComponentRegistry.register('detail', DetailView, {
  namespace: 'view',
  category: 'view',
  label: 'Detail',
  icon: 'FileText',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'recordId', type: 'string', label: 'Record ID' },
    { name: 'fields', type: 'array', label: 'Fields' },
  ]
});

// ---------------------------------------------------------------------------
// record:* namespace — Salesforce Lightning-style record page components.
// These renderers consume RecordContext (provided by app-shell's
// RecordDetailView) and adapt the spec's `RecordXxxComponentProps` onto the
// legacy plugin-detail components above.
//
// Pass the BARE name and let `namespace` do the prefixing — `register('details',
// …, { namespace: 'record' })`, not `register('record:details', …)`. The
// registry prepends the namespace itself, so a pre-prefixed name is prefixed
// again and lands under `record:record:details`; the key that actually worked
// was the un-namespaced fallback, which happened to spell `record:details`.
//
// `skipFallback: true` is what keeps that fallback from claiming the bare name
// globally: without it these would register `details`, `path`, `history`,
// `alert` … as top-level tags, colliding with the `ui:` primitives that own
// them. Every block here is reachable as `record:<name>` and only that.
// ---------------------------------------------------------------------------

ComponentRegistry.register('details', RecordDetailsRenderer, {
  namespace: 'record',
  skipFallback: true,
  category: 'record',
  label: 'Record Details',
  icon: 'FileText',
  // Designer inputs mirror @objectstack/spec RecordDetailsProps (component.zod).
  //
  // `sections` publishes its ENTRY shape in prose, derived from the spec's own
  // `.describe()` on each member key — `ComponentInput` is flat by design and
  // has no slot for a member shape, so an array-of-objects input can only
  // document its elements here (same as `record:highlights.fields`,
  // `record:path.stages`, `record:alert.action`). It says "object, not string"
  // out loud because the string spelling is exactly what this text used to
  // teach: until 17.x the spec declared `sections: z.array(z.string())` and
  // this description read "Section IDs to show". objectstack#5611 deleted that
  // arm rather than unioning it in (no producer, no consumer — one shape, not
  // two de-facto contracts), and nothing in the four layers between the
  // manifest and the screen reports a leftover ID list: the manifest gate
  // checks top-level prop names and coarse types only (`['a','b']` is a valid
  // `array`), `validateComponentProps` upstream is advisory, and
  // `RecordDetailsRenderer` maps every entry as an object (`s.name` /
  // `s.label` / `s.fields`), so a string entry contributes no fields at all.
  // Once `sections` is authored at all it is the ONLY source of the body, so
  // the author who trusted the old text got a blank detail page. objectui#3807.
  //
  // There is deliberately NO `layout` input. `record:details` published one
  // (`enum ['auto','custom']`, `defaultValue: 'auto'`) until objectui#3818;
  // @objectstack/spec 17.0.0 removed the key outright (objectstack#6946,
  // ADR-0087 D2) because those semantics were never implemented — the
  // renderer's only read tested `inline` | `compact`, values the schema never
  // permitted, so `auto` and `custom` took the same branch and the key
  // selected nothing. Re-adding it here would republish a key the spec now
  // rejects on parse; the body-source contract is `sections`-presence, stated
  // in the `sections` description below.
  //
  // Documented member keys are exactly the spec's four (`name`, `label`,
  // `columns`, `fields`) — deliberately NOT the extras `RecordDetailsRenderer`
  // also honours on a section (`title`, `showBorder`, `hideEmpty`). Those are
  // undeclared upstream, so the spec's section object STRIPS them on parse:
  // publishing them here would advertise keys the contract throws away, the
  // same trap as declaring a top-level `readonly` on `record:highlights`
  // below. The renderer tolerating them is not a licence to teach them.
  inputs: [
    { name: 'columns', type: 'enum', label: 'Columns', enum: ['1', '2', '3', '4'], defaultValue: '2', description: 'Number of columns for field layout (1-4)' },
    { name: 'sections', type: 'array', label: 'Sections', description: 'Field groups rendered as the detail body, in order. Every entry is an OBJECT — `{ name?, label?, columns?, fields }` — a bare section-id string is NOT accepted (the spec retired that spelling in objectstack#5611, and the renderer reads name/label/fields off each entry, so a string entry renders no fields at all). `fields` (required) are the field names shown in this section, in order. `label` is the section heading; omit it for an untitled, borderless section. `name` is a stable snake_case identifier and the i18n anchor — the heading resolves through objects.<object>._sections.<name>.label, so a section without a name shows its authored label in every locale. `columns` (1-4) is THIS section\'s field-grid width; omit it and the renderer derives the width. Authoring `sections` at all makes it the only source of the detail body; omit it and the body falls back to the object\'s highlightFields.' },
    { name: 'fields', type: 'array', label: 'Fields', description: 'Explicit field list (overrides highlightFields)' },
    // `hideFields` is DECLARED, not merely honoured (objectui#3808). The spec
    // declares it (objectstack#5611) and `RecordDetailsRenderer` has read it
    // since the highlight-dedup phase (`renderers/record-details.tsx:147`), but
    // it was missing here — so an author reading the manifest could not
    // discover it, and every layer that reads the manifest said the opposite:
    // `sdui.manifest.json` / `sdui-intrinsics.d.ts` omitted it and
    // `sdui-parser`'s prop walk reported `unknown-prop` on a key the renderer
    // then honoured. Same failure as `readonly` in objectui#3407.
    //
    // Bare field NAMES only. The renderer also tolerates `{name}` / `{field}`
    // entries (`typeof n === 'string' ? n : fieldName(n)` at the read site), but
    // `hideFields` is `z.array(z.string())` in the spec and rejects those values
    // on parse — teaching them here would publish a second dialect the contract
    // refuses, the same fence `fields` above is held to.
    //
    // The "hiding every field drops the section" sentence is read off
    // `DetailSection.tsx:439` (`visibleFields.length === 0 &&
    // emptyCount === section.fields.length` returns null), not assumed.
    { name: 'hideFields', type: 'array', label: 'Hide Fields', description: 'Field names to omit from the body — applied to the top-level `fields` list AND to every section\'s `fields`. Bare field names only. Authors rarely need it: the synth pipeline fills it with the fields already shown in `record:highlights`, and hand-authored pages get the same dedup live from HighlightFieldsContext, so its purpose is suppressing a field you do not want repeated (the page H1 title field is dropped for you too). Hiding every field of a section leaves that section out entirely.' },
    // `inlineEdit` and `showHeader` are DECLARED, not merely honoured
    // (objectui#4668) — the same reverse-direction defect `hideFields` above
    // records, on the two keys @objectstack/spec 17.0.0 GA added to this block.
    // `RecordDetailsRenderer` has read both all along (`renderers/
    // record-details.tsx`: `(schema.inlineEdit ?? true) && objectInlineEditable`,
    // and `showHeader: schema.showHeader ?? false` on the synthesized
    // `detail-view`), while `inputs` omitted them — so `sdui.manifest.json` and
    // `sdui-intrinsics.d.ts` never mentioned them, `sdui-parser`'s prop walk
    // raised `unknown-prop` on an author who wrote one, and the renderer
    // honoured it regardless.
    //
    // Both are plain booleans on the installed pin — measured against
    // `ComponentPropsMap['record:details']`, `z.boolean().optional()` each, so a
    // single arm and no union (objectui#3832): `1` / `'true'` / `null` are
    // rejected by value.
    //
    // `inlineEdit` is documented as an opt-OUT because that is the only
    // direction it can decide. The value is AND-ed with the object's own
    // resolved editability (`isObjectInlineEditable`, ADR-0103) and with the
    // server's effective API operation set (objectui#3546), so `true` cannot
    // open editing the platform refuses; only `false` is unconditional. Saying
    // "enables inline editing" would advertise an authority this key does not
    // have.
    { name: 'inlineEdit', type: 'boolean', label: 'Inline Edit', defaultValue: true, description: 'Offer the per-field double-click / pencil inline-edit affordances in the detail body. On by default, and an OPT-OUT only: the value is combined with the object\'s own editability (system, engine-owned, append-only and better-auth objects are not user-editable unless they opened userActions.edit) and with the server\'s effective API operation set for the object, so `false` always wins while `true` cannot open editing the platform refuses. The edit session and the atomic Save bar are hosted by the page, so one draft spans the highlights strip and this body.' },
    { name: 'showHeader', type: 'boolean', label: 'Show Body Header', defaultValue: false, description: 'Render the detail body\'s own title / follow-star / copy-id chip above the fields. Off by default because this block is normally composed under a `page:header` that already draws that chrome, and turning it on there shows the record title twice. Set it true only when this block is the whole page.' },
  ],
});

ComponentRegistry.register('related_list', RecordRelatedListRenderer, {
  namespace: 'record',
  skipFallback: true,
  category: 'record',
  label: 'Related List',
  icon: 'List',
  // Mirrors @objectstack/spec RecordRelatedListProps.
  //
  // `relationshipValueField` and `add` are DECLARED, not merely honoured
  // (objectui#3808). Both are spec keys this renderer has read all along —
  // `renderers/record-related-list.tsx:95` and `:186` — while `inputs` omitted
  // them, so the published surface and the runtime disagreed in the direction
  // nothing reports: `sdui.manifest.json` / `sdui-intrinsics.d.ts` never
  // mentioned them, `sdui-parser`'s prop walk raised `unknown-prop` on an
  // author who wrote one anyway, and the renderer honoured it regardless. `add`
  // in particular is not cosmetic — without it declared, the ONLY published way
  // to build a junction-assignment list was to write an undiscoverable key.
  inputs: [
    { name: 'objectName', type: 'string', label: 'Related Object', required: true, description: 'Related object name (e.g. "task")' },
    { name: 'relationshipField', type: 'string', label: 'Relationship Field', required: true, description: 'Field on the related object pointing back to this record' },
    { name: 'relationshipValueField', type: 'string', label: 'Relationship Value Field', defaultValue: 'id', description: 'Which field OF THIS PARENT record `relationshipField` stores. Defaults to "id"; set it to the field a name-keyed junction points at (e.g. "name" when sys_user_position.position holds sys_position.name). The resolved value drives three things at once — the list filter, the Add-picker link value, and the pre-filled create form — so they cannot drift apart. While the parent record is still loading, a non-"id" field resolves to null and the list holds its fetch rather than querying on an empty value.' },
    { name: 'columns', type: 'array', label: 'Columns', required: true, description: 'Fields to display in the related list' },
    { name: 'sort', type: 'array', label: 'Sort' },
    { name: 'limit', type: 'number', label: 'Limit', defaultValue: 5, description: 'Records to display initially' },
    // `type: 'array'` matches the spec (`RecordRelatedListProps.filter` is
    // `z.array(ViewFilterRuleSchema)`), and the description now names the MEMBER
    // shape for the reason `add`'s does: `ComponentInput` is flat, so an array
    // input can document its element vocabulary nowhere else — and this key is
    // one an AI author reaches for often. It also states the combining rule,
    // which is the part a wrong guess makes dangerous rather than merely broken:
    // an author who reads "filter" as "the list's whole filter" would expect it
    // to be able to widen past the parent record, and it cannot (objectstack#7118).
    { name: 'filter', type: 'array', label: 'Filter', description: 'Additional filter criteria, as spec `ViewFilterRule` entries (`[{ field, operator, value }]`). AND-combined with the parent relationship condition, never a replacement for it: it can only narrow this record\'s children. Also the key a per-element `dataSource` binding\'s composed filter lands on.' },
    { name: 'title', type: 'string', label: 'Title' },
    { name: 'showViewAll', type: 'boolean', label: 'Show "View All"', defaultValue: true },
    { name: 'actions', type: 'array', label: 'Actions', description: 'Action IDs available for related records' },
    // `add` publishes its MEMBER shape in prose for the reason the sibling
    // array-of-objects inputs do (`record:details.sections`,
    // `record:highlights.fields`, `record:path.stages`): `ComponentInput` is flat
    // by design and has no slot for a member shape, so an `object` input can
    // only document its members here.
    //
    // Documented members are exactly the spec's — `picker.object`,
    // `picker.valueField`, `picker.labelField`, `linkField`, `label` — with each
    // default taken from the RENDERER, which is where an author's expectation
    // gets settled: `RelatedList.tsx:724` defaults `picker.valueField` to `id`
    // (matching the spec's own default) but `:390` defaults `picker.labelField`
    // to `name`, NOT to the object's title field as the spec's `.describe()`
    // says. Publishing the spec's wording there would have been a description
    // the platform does not honour.
    //
    // `picker.filter` IS documented as working since #3831 wired it: it reaches
    // `RecordPickerDialog`'s `baseFilter` verbatim (`RelatedList.tsx`, at the
    // dialog mount), which is the un-editable slot — not `lookupFilters`, whose
    // entries become filter-bar rows the user can widen back out. It carried a
    // KNOWN GAP sentence here until then, on the
    // `record:activity.showSubscriptionToggle` precedent; the sentence went away
    // with the gap, not before it.
    { name: 'add', type: 'object', label: 'Add Existing', description: 'Adds an "Add" button that assigns EXISTING records instead of creating one — the m2m/junction case. Shape: `{ picker: { object, valueField?, labelField?, filter? }, linkField?, label? }`. `picker.object` (required) is the object whose records the dialog offers. `picker.valueField` is the field of the picked record used as the link value (default "id"); `picker.labelField` is the column shown in the picker rows (default "name", and the other columns are derived from that object\'s schema). With `linkField` set, selecting records CREATES rows in this list\'s own object as `{ [relationshipField]: parentValue, [linkField]: pickedId }` — the junction case; omit `linkField` and the picked child is RE-PARENTED instead, by setting its own `relationshipField` to this parent. `label` is the button text (default "Add", localizable inline). Setting `add` also enables generic link removal on rows when no host delete handler is wired. `picker.filter` restricts which records the dialog offers — a list of `{ field, operator, value }` rules in the same vocabulary as this list\'s own `filter`, applied as a hard constraint the user cannot widen (it never appears as an editable filter row).' },
  ],
});

ComponentRegistry.register('highlights', RecordHighlightsRenderer, {
  namespace: 'record',
  skipFallback: true,
  category: 'record',
  label: 'Highlights Panel',
  icon: 'Star',
  // Mirrors @objectstack/spec RecordHighlightsProps.
  //
  // `readonly` is documented INSIDE the `fields` description, not declared as
  // an input of its own, because that is where the contract puts it: the spec's
  // `RecordHighlightsField` carries `readonly` on each ENTRY, while
  // `RecordHighlightsProps` has exactly three top-level keys (fields, layout,
  // aria). A top-level `{ name: 'readonly', type: 'boolean' }` here would look
  // like the fix for "the manifest never mentions readonly" and would instead
  // publish a key the platform silently discards: the generated
  // `sdui.manifest.json` and `sdui-intrinsics.d.ts` would advertise
  // `<RecordHighlights readonly>`, the manifest gate validates top-level props
  // only and would raise no diagnostic, the spec strips the unknown key on
  // parse without error, and the renderer — which reads `field.readonly` per
  // entry — would never see it. An author who trusted that surface would be
  // left with the machine-owned column still hand-editable and nothing
  // anywhere saying why. `ComponentInput` is flat by design (`name` = "must
  // match schema property"), so an array-of-objects input publishes its member
  // keys in prose, the same way `record:path.stages` and `record:alert.action`
  // do. objectui#3407 / objectstack#5176.
  inputs: [
    { name: 'fields', type: 'array', label: 'Fields', required: true, description: 'Key fields to highlight (1-7), bare names or {name,label?,icon?,type?,readonly?}. Set readonly: true on an entry to render that chip read-only — it suppresses the inline-edit affordance and the HeaderHighlight editability gate enforces it. Use it for hook/automation-maintained columns that must not be hand-edited from the record header; marking the OBJECT field readonly instead would also strip the hook\'s own write-back.' },
    { name: 'layout', type: 'enum', label: 'Layout', enum: ['horizontal', 'vertical'], defaultValue: 'horizontal', description: 'Layout orientation for highlight fields' },
  ],
});

// `inputs` on the blocks below describe what an AUTHOR writes, which is a
// subset of what the renderer reads. `entries`, `loading` and resolved
// `actions` are injected by the host shell (RecordDetailView and friends) off
// RecordContext — declaring those would invite a model to hand-write data the
// page is supposed to fetch. `aria` is omitted for the same reason it is
// omitted on `record:details` above: it is an accessibility escape hatch, not
// a layout choice.

ComponentRegistry.register('activity', RecordActivityRenderer, {
  namespace: 'record',
  skipFallback: true,
  category: 'record',
  label: 'Activity Timeline',
  icon: 'Activity',
  // Mirrors RecordActivityComponentProps (@object-ui/types), itself aligned
  // with @objectstack/spec RecordActivityProps.
  //
  // Every description below says what the input DOES and, where it depends on
  // something the block does not own, what it needs — because this text is
  // what ships to `sdui.manifest.json` and is therefore what an AI author
  // reads before writing the block. objectui#3165: all eleven of these used to
  // be filters and affordances over a feed the renderer hard-coded to `[]`, so
  // they read as configurable and did nothing. The read-side six are live on
  // every path now; the write-side four are live wherever a host mounts a
  // DiscussionContext (record detail pages do); `showSubscriptionToggle` is a
  // declared-but-inert GAP and says so here rather than looking configurable.
  inputs: [
    { name: 'types', type: 'array', label: 'Activity Types', description: 'Allow-list of feed item types to show (comment, field_change, task, event, email, call, note, file, record_create, record_delete, approval, sharing, system). Omit for all; unrecognised entries are ignored.' },
    {
      name: 'filterMode',
      type: 'enum',
      label: 'Filter Mode',
      enum: ['all', 'comments_only', 'changes_only', 'tasks_only'],
      defaultValue: 'all',
      description: 'Filter the timeline dropdown starts on. The user can still change it; an unrecognised value falls back to "all".',
    },
    { name: 'showFilterToggle', type: 'boolean', label: 'Show Filter Toggle', defaultValue: true, description: 'Expose the activity-type filter dropdown in the panel header' },
    { name: 'limit', type: 'number', label: 'Limit', defaultValue: 20, description: 'Items per page. Also caps the scoped sys_activity read; "Load more" grows the window by this much.' },
    { name: 'showCompleted', type: 'boolean', label: 'Show Completed', defaultValue: false, description: 'Include completed activities (sys_activity type "completed", which surfaces as a task item). Off by default.' },
    { name: 'unifiedTimeline', type: 'boolean', label: 'Unified Timeline', defaultValue: true, description: 'Mix field changes and comments in one timeline (Airtable style). Off keeps the panel a discussion stream — field changes stay in record:history.' },
    { name: 'showCommentInput', type: 'boolean', label: 'Show Comment Input', defaultValue: true, description: 'Show the composer. Requires a host discussion context to persist the comment (record detail pages provide one); without it the feed is read-only.' },
    { name: 'enableMentions', type: 'boolean', label: 'Enable @mentions', defaultValue: true, description: 'Offer @-mention autocomplete in the composer, from the host discussion context\'s user list. Off withholds the suggestions.' },
    { name: 'enableReactions', type: 'boolean', label: 'Enable Reactions', defaultValue: false, description: 'Show emoji reactions on feed items. Toggling one requires a host discussion context; without it existing reactions still render, read-only.' },
    { name: 'enableThreading', type: 'boolean', label: 'Enable Threaded Replies', defaultValue: false, description: 'Group replies under their parent comment. Posting a reply requires a host discussion context.' },
    {
      name: 'showSubscriptionToggle',
      type: 'boolean',
      label: 'Show Subscribe Toggle',
      // No `defaultValue`: the spec defaults it true and this renderer treats
      // it as false, and pinning either number here would advertise a default
      // for something that has no behaviour to default to.
      // KNOWN GAP (objectui#3165). Declared because @objectstack/spec declares
      // it, and left visible rather than quietly dropped so the two
      // declarations stay in parity — but it renders nothing: the bell needs a
      // RecordSubscription plus a persist handler, and the platform has no
      // record-subscription object to read or write one. Saying so here is the
      // difference between a documented gap and objectstack#4413's shape.
      description: 'NOT IMPLEMENTED — no record-subscription backend exists yet, so this renders nothing whatever it is set to. Declared for spec parity only (objectui#3165).',
    },
  ],
});

// `record:chatter` and `record:discussion` are the same renderer under two
// names. The spec prefers `discussion` for new Lightning-style record pages;
// `chatter` stays for Salesforce-familiar authors and for schemas already in
// the wild. Both carry the same inputs — an author who reaches for either gets
// the same configuration surface.
const CHATTER_INPUTS: ComponentInput[] = [
  { name: 'position', type: 'enum', label: 'Position', enum: ['bottom', 'right', 'left'], defaultValue: 'bottom', description: 'Where the panel docks relative to the record body' },
  { name: 'width', type: 'string', label: 'Width', description: 'Panel width as a CSS value (side positions only)' },
  { name: 'collapsible', type: 'boolean', label: 'Collapsible', defaultValue: false },
  { name: 'defaultCollapsed', type: 'boolean', label: 'Start Collapsed' },
  { name: 'feed', type: 'object', label: 'Feed Options', description: 'Activity-feed config nested inside the panel — same shape as record:activity' },
];

ComponentRegistry.register('chatter', RecordChatterRenderer, {
  namespace: 'record',
  skipFallback: true,
  category: 'record',
  label: 'Chatter Feed',
  icon: 'MessageSquare',
  // Mirrors RecordChatterComponentProps (@object-ui/types).
  inputs: CHATTER_INPUTS,
});

ComponentRegistry.register('discussion', RecordChatterRenderer, {
  namespace: 'record',
  skipFallback: true,
  category: 'record',
  label: 'Discussion',
  icon: 'MessageSquare',
  inputs: CHATTER_INPUTS,
});

ComponentRegistry.register('path', RecordPathRenderer, {
  namespace: 'record',
  skipFallback: true,
  category: 'record',
  label: 'Path / Stepper',
  icon: 'GitBranch',
  // Mirrors @objectstack/spec RecordPathProps.
  inputs: [
    { name: 'statusField', type: 'string', label: 'Status Field', required: true, description: 'Field representing the current status/stage' },
    { name: 'stages', type: 'array', label: 'Stages', description: 'Explicit stage definitions [{ value, label }] (else derived from field metadata)' },
  ],
});

ComponentRegistry.register('quick_actions', RecordQuickActionsRenderer, {
  namespace: 'record',
  skipFallback: true,
  category: 'record',
  label: 'Quick Actions',
  icon: 'Zap',
  inputs: [
    { name: 'actionNames', type: 'array', label: 'Actions', description: 'Action names to expose, in order (else every action declared for the object at this location)' },
    { name: 'requiredPermissions', type: 'array', label: 'Required Permissions', description: 'Hide the whole bar unless the user holds these permissions' },
    // Derived from the spec's own vocabulary rather than restated — #3019.
    { name: 'location', type: 'enum', label: 'Location', enum: [...ACTION_LOCATIONS], defaultValue: 'record_header', description: 'Which declared action location this bar renders' },
    { name: 'align', type: 'enum', label: 'Align', enum: ['start', 'center', 'end'], defaultValue: 'end' },
    { name: 'inline', type: 'boolean', label: 'Inline', description: 'Render in the flow instead of folding into the record header' },
    { name: 'variant', type: 'string', label: 'Button Variant', defaultValue: 'default', description: 'Passed to the Button primitive; a per-action variant overrides it' },
    { name: 'size', type: 'string', label: 'Button Size', defaultValue: 'sm', description: 'Passed to the Button primitive; a per-action size overrides it' },
  ],
});

ComponentRegistry.register('history', RecordHistoryRenderer, {
  namespace: 'record',
  skipFallback: true,
  category: 'record',
  label: 'History Timeline',
  icon: 'Clock',
  inputs: [
    { name: 'limit', type: 'number', label: 'Limit', defaultValue: 50, description: 'Maximum history entries to display' },
    { name: 'emptyText', type: 'string', label: 'Empty Text', description: 'Copy shown when the record has no history' },
    { name: 'unknownUserText', type: 'string', label: 'Unknown User Text', description: 'Copy substituted when an entry has no resolvable actor' },
  ],
});

ComponentRegistry.register('reference_rail', RecordReferenceRailRenderer, {
  namespace: 'record',
  skipFallback: true,
  category: 'record',
  label: 'Reference Rail',
  icon: 'PanelRight',
  inputs: [
    { name: 'hideEmpty', type: 'boolean', label: 'Hide When Empty', defaultValue: true, description: 'Drop the rail entirely when no entries resolve' },
  ],
});

ComponentRegistry.register('alert', RecordAlertRenderer, {
  namespace: 'record',
  skipFallback: true,
  category: 'record',
  label: 'Alert Banner',
  icon: 'AlertTriangle',
  inputs: [
    { name: 'severity', type: 'enum', label: 'Severity', enum: ['info', 'warning', 'error', 'success'], defaultValue: 'info' },
    // Two arms each (objectui#3832). Unlike the `page:*` specimens these two
    // have no props schema to measure against — `ComponentPropsMap` carries no
    // `record:alert` entry at rc.6 — so the second arm is justified by the
    // RENDERER: `renderers/record-alert.tsx` resolves both through
    // `pickLocalized`, which is exactly what these descriptions teach. Declaring
    // the map arm therefore adds no shape the block does not already honour; it
    // stops the manifest gate warning `type-mismatch` on the recommended write.
    { name: 'title', type: ['string', 'object'], label: 'Title', description: 'Accepts an inline translation map ({ en, "zh-CN", … })' },
    { name: 'body', type: ['string', 'object'], label: 'Body', description: 'Accepts an inline translation map ({ en, "zh-CN", … })' },
    { name: 'visible', type: 'string', label: 'Visible When', description: 'Expression gating the banner against the current record' },
    { name: 'icon', type: 'string', label: 'Icon', description: 'Lucide icon name; defaults to the severity icon' },
    { name: 'action', type: 'object', label: 'Call to Action', description: '{ actionName, label?, variant? } — the action the banner offers' },
    { name: 'dismissible', type: 'boolean', label: 'Dismissible' },
    { name: 'dismissKey', type: 'string', label: 'Dismiss Key', description: 'Stable key the dismissal is remembered under' },
  ],
});

// ADR-0056 P1 — the `permission-facet-link` field widget renders a
// `sys_permission_set` authorization facet (object/field/system/RLS/tab/
// admin_scope) read-only as a summary + Studio deep-link. Registered here so
// the record form and inline edit resolve `field:permission-facet-link`; the
// detail read path special-cases it in DetailSection. Setup never edits these
// facets — they are designed in Studio's structured editors.
//
// `withFieldCarrier` is MANDATORY on every `field:` registration (objectui#3233
// / #3307): `SchemaRenderer` hands the authored node over as `schema`, and the
// adapter converges it onto `field` — the field-widget contract's only
// metadata carrier. Registered raw, the widget reads `field === undefined`
// under the SDUI path and silently renders an anonymous summary.
ComponentRegistry.register('permission-facet-link', withFieldCarrier(PermissionFacetLink), {
  namespace: 'field',
  skipFallback: true,
});
