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
import type { DetailViewSchema } from '@object-ui/types';

export { DetailView, DetailSection, DetailTabs, RelatedList };
export { inferDetailColumns, isWideFieldType, applyAutoSpan, applyDetailAutoLayout } from './autoLayout';
export { RecordComments } from './RecordComments';
export { ActivityTimeline } from './ActivityTimeline';
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
export type { DetailViewProps } from './DetailView';
export type { DetailSectionProps } from './DetailSection';
export type { DetailTabsProps } from './DetailTabs';
export type { RelatedListProps } from './RelatedList';
export type { RecordCommentsProps } from './RecordComments';
export type { ActivityTimelineProps, ActivityFilterType } from './ActivityTimeline';
export type { InlineCreateRelatedProps, RelatedFieldDefinition, RelatedRecordOption } from './InlineCreateRelated';
export type { RichTextCommentInputProps, MentionSuggestion } from './RichTextCommentInput';
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
