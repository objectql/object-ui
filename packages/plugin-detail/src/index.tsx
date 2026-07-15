/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
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
} from './synth/buildDefaultPageSchema';
export type {
  ObjectDefLike,
  ObjectFieldLike,
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
// ---------------------------------------------------------------------------

ComponentRegistry.register('record:details', RecordDetailsRenderer, {
  namespace: 'record',
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

ComponentRegistry.register('record:related_list', RecordRelatedListRenderer, {
  namespace: 'record',
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

ComponentRegistry.register('record:highlights', RecordHighlightsRenderer, {
  namespace: 'record',
  category: 'record',
  label: 'Highlights Panel',
  icon: 'Star',
  // Mirrors @objectstack/spec RecordHighlightsProps.
  inputs: [
    { name: 'fields', type: 'array', label: 'Fields', required: true, description: 'Key fields to highlight (1-7), bare names or {name,label?,icon?,type?}' },
    { name: 'layout', type: 'enum', label: 'Layout', enum: ['horizontal', 'vertical'], defaultValue: 'horizontal', description: 'Layout orientation for highlight fields' },
  ],
});

ComponentRegistry.register('record:activity', RecordActivityRenderer, {
  namespace: 'record',
  category: 'record',
  label: 'Activity Timeline',
  icon: 'Activity',
});

ComponentRegistry.register('record:chatter', RecordChatterRenderer, {
  namespace: 'record',
  category: 'record',
  label: 'Chatter Feed',
  icon: 'MessageSquare',
});

// `record:discussion` is the spec-compliant alias preferred for new
// Lightning-style record pages. The two names render identically and
// share the same DiscussionContext wiring; we keep `record:chatter`
// for Salesforce-familiar authors and for backward compatibility with
// schemas already in the wild.
ComponentRegistry.register('record:discussion', RecordChatterRenderer, {
  namespace: 'record',
  category: 'record',
  label: 'Discussion',
  icon: 'MessageSquare',
});

ComponentRegistry.register('record:path', RecordPathRenderer, {
  namespace: 'record',
  category: 'record',
  label: 'Path / Stepper',
  icon: 'GitBranch',
  // Mirrors @objectstack/spec RecordPathProps.
  inputs: [
    { name: 'statusField', type: 'string', label: 'Status Field', required: true, description: 'Field representing the current status/stage' },
    { name: 'stages', type: 'array', label: 'Stages', description: 'Explicit stage definitions [{ value, label }] (else derived from field metadata)' },
  ],
});

ComponentRegistry.register('record:quick_actions', RecordQuickActionsRenderer, {
  namespace: 'record',
  category: 'record',
  label: 'Quick Actions',
  icon: 'Zap',
});

ComponentRegistry.register('record:history', RecordHistoryRenderer, {
  namespace: 'record',
  category: 'record',
  label: 'History Timeline',
  icon: 'Clock',
});

ComponentRegistry.register('record:reference_rail', RecordReferenceRailRenderer, {
  namespace: 'record',
  category: 'record',
  label: 'Reference Rail',
  icon: 'PanelRight',
});

ComponentRegistry.register('record:alert', RecordAlertRenderer, {
  namespace: 'record',
  category: 'record',
  label: 'Alert Banner',
  icon: 'AlertTriangle',
});

// ADR-0056 P1 — the `permission-facet-link` field widget renders a
// `sys_permission_set` authorization facet (object/field/system/RLS/tab/
// admin_scope) read-only as a summary + Studio deep-link. Registered here so
// the record form and inline edit resolve `field:permission-facet-link`; the
// detail read path special-cases it in DetailSection. Setup never edits these
// facets — they are designed in Studio's structured editors.
ComponentRegistry.register('permission-facet-link', PermissionFacetLink, {
  namespace: 'field',
  skipFallback: true,
});
