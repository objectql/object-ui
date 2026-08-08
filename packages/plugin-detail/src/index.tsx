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
  inputs: [
    { name: 'columns', type: 'enum', label: 'Columns', enum: ['1', '2', '3', '4'], defaultValue: '2', description: 'Number of columns for field layout (1-4)' },
    { name: 'layout', type: 'enum', label: 'Layout', enum: ['auto', 'custom'], defaultValue: 'auto', description: 'auto uses the object highlightFields; custom uses explicit sections' },
    { name: 'sections', type: 'array', label: 'Sections', description: 'Section IDs to show (required when layout is "custom")' },
    { name: 'fields', type: 'array', label: 'Fields', description: 'Explicit field list (overrides highlightFields)' },
  ],
});

ComponentRegistry.register('related_list', RecordRelatedListRenderer, {
  namespace: 'record',
  skipFallback: true,
  category: 'record',
  label: 'Related List',
  icon: 'List',
  // Mirrors @objectstack/spec RecordRelatedListProps.
  inputs: [
    { name: 'objectName', type: 'string', label: 'Related Object', required: true, description: 'Related object name (e.g. "task")' },
    { name: 'relationshipField', type: 'string', label: 'Relationship Field', required: true, description: 'Field on the related object pointing back to this record' },
    { name: 'columns', type: 'array', label: 'Columns', required: true, description: 'Fields to display in the related list' },
    { name: 'sort', type: 'array', label: 'Sort' },
    { name: 'limit', type: 'number', label: 'Limit', defaultValue: 5, description: 'Records to display initially' },
    { name: 'filter', type: 'array', label: 'Filter', description: 'Additional filter criteria' },
    { name: 'title', type: 'string', label: 'Title' },
    { name: 'showViewAll', type: 'boolean', label: 'Show "View All"', defaultValue: true },
    { name: 'actions', type: 'array', label: 'Actions', description: 'Action IDs available for related records' },
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
    { name: 'title', type: 'string', label: 'Title', description: 'Accepts an inline translation map ({ en, "zh-CN", … })' },
    { name: 'body', type: 'string', label: 'Body', description: 'Accepts an inline translation map ({ en, "zh-CN", … })' },
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
