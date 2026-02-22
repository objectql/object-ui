/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - View Component Schemas
 * 
 * Type definitions for various view components (List, Detail, Grid, Kanban, Calendar).
 * These schemas enable building different data visualization interfaces.
 * 
 * @module views
 * @packageDocumentation
 */

import type { BaseSchema, SchemaNode } from './base';
import type { ActionSchema } from './crud';
import type { TableColumn } from './data-display';
import type { FormField } from './form';
import type { SelectOptionMetadata } from './field-types';

/**
 * View Type
 */
export type ViewType = 'list' | 'detail' | 'grid' | 'kanban' | 'calendar' | 'timeline' | 'map';

/**
 * Detail View Field Configuration
 */
export interface DetailViewField {
  /**
   * Field name/path
   */
  name: string;
  /**
   * Display label
   */
  label?: string;
  /**
   * Field type for rendering.
   * Supports both display-oriented types (image, link, badge, json, html, markdown, custom)
   * and data-oriented types (number, currency, percent, boolean, select, lookup, master_detail,
   * email, url, phone, user) for type-aware cell rendering via getCellRenderer.
   */
  type?: 'text' | 'number' | 'currency' | 'percent' | 'boolean' | 'select' | 'lookup' | 'master_detail'
    | 'email' | 'url' | 'phone' | 'user'
    | 'image' | 'link' | 'badge' | 'date' | 'datetime' | 'json' | 'html' | 'markdown' | 'custom';
  /**
   * Format string (e.g., date format)
   */
  format?: string;
  /**
   * Custom renderer
   */
  render?: SchemaNode;
  /**
   * Field value
   */
  value?: any;
  /**
   * Whether field is read-only
   */
  readonly?: boolean;
  /**
   * Field visibility condition
   */
  visible?: boolean | string;
  /**
   * Span across columns (for grid layout)
   */
  span?: number;
  /**
   * Options for select/lookup fields
   */
  options?: SelectOptionMetadata[];
  /**
   * Referenced object name for lookup/master_detail fields
   */
  reference_to?: string;
  /**
   * Display field on the referenced object for lookup/master_detail fields
   */
  reference_field?: string;
  /**
   * Currency code for currency fields (e.g. 'USD', 'EUR')
   */
  currency?: string;
}

/**
 * Detail View Section/Group
 */
export interface DetailViewSection {
  /**
   * Section title
   */
  title?: string;
  /**
   * Section description
   */
  description?: string;
  /**
   * Section icon
   */
  icon?: string;
  /**
   * Fields in this section
   */
  fields: DetailViewField[];
  /**
   * Collapsible section
   */
  collapsible?: boolean;
  /**
   * Default collapsed state
   */
  defaultCollapsed?: boolean;
  /**
   * Grid columns for field layout
   */
  columns?: number;
  /**
   * Section visibility condition
   */
  visible?: boolean | string;
  /**
   * Show border around section
   * @default true
   */
  showBorder?: boolean;
  /**
   * Header background color (Tailwind class)
   * @example 'muted', 'primary/10'
   */
  headerColor?: string;
}

/**
 * Detail View Tab
 */
export interface DetailViewTab {
  /**
   * Tab key/identifier
   */
  key: string;
  /**
   * Tab label
   */
  label: string;
  /**
   * Tab icon
   */
  icon?: string;
  /**
   * Tab content
   */
  content: SchemaNode | SchemaNode[];
  /**
   * Tab visibility condition
   */
  visible?: boolean | string;
  /**
   * Badge count
   */
  badge?: string | number;
}

/**
 * Comment Entry - represents a single comment on a record
 */
export interface CommentEntry {
  /** Unique identifier */
  id: string | number;
  /** Comment text */
  text: string;
  /** Author display name */
  author: string;
  /** Avatar URL (optional) */
  avatarUrl?: string;
  /** Timestamp when the comment was created */
  createdAt: string;
  /** Whether this comment is pinned/starred */
  pinned?: boolean;
  /** Mentioned user IDs extracted from the comment text */
  mentions?: string[];
  /** Object/record this comment belongs to (for cross-record search) */
  objectName?: string;
  /** Record ID this comment belongs to (for cross-record search) */
  recordId?: string | number;
}

/**
 * Mention notification - delivered when a user is @mentioned in a comment
 */
export interface MentionNotification {
  /** Unique notification ID */
  id: string;
  /** Type of notification */
  type: 'mention';
  /** ID of the user being notified */
  recipientId: string;
  /** The comment that contains the mention */
  commentId: string | number;
  /** Author who mentioned the recipient */
  mentionedBy: string;
  /** The comment text (or excerpt) */
  commentText: string;
  /** Object name the comment belongs to */
  objectName?: string;
  /** Record ID the comment belongs to */
  recordId?: string | number;
  /** When the mention was created */
  createdAt: string;
  /** Whether the notification has been read */
  read?: boolean;
  /** Delivery channels */
  channels?: Array<'in_app' | 'email' | 'push'>;
}

/**
 * Comment search result - returned when searching comments across records
 */
export interface CommentSearchResult {
  /** The matching comment */
  comment: CommentEntry;
  /** Object name the comment belongs to */
  objectName: string;
  /** Record ID the comment belongs to */
  recordId: string | number;
  /** Highlighted text snippet with search term marked */
  highlight?: string;
}

/**
 * Activity Entry - represents a single activity/field change on a record
 */
export interface ActivityEntry {
  /** Unique identifier */
  id: string | number;
  /** Activity type */
  type: 'field_change' | 'create' | 'delete' | 'comment' | 'status_change';
  /** Field that was changed (for field_change type) */
  field?: string;
  /** Previous value */
  oldValue?: any;
  /** New value */
  newValue?: any;
  /** User who made the change */
  user: string;
  /** Timestamp of the change */
  timestamp: string;
  /** Human-readable description of the change */
  description?: string;
}

// ============================================================================
// Feed / Chatter Protocol Types
// Aligned with @objectstack/spec FeedItemSchema, MentionSchema, ReactionSchema,
// FieldChangeEntrySchema, RecordSubscriptionSchema
// ============================================================================

/**
 * Feed item type — determines rendering style in the activity timeline.
 * Aligned with @objectstack/spec FeedItemSchema.type enum.
 */
export type FeedItemType = 'comment' | 'field_change' | 'task' | 'event' | 'system' | 'email' | 'call';

/**
 * FeedItem — A single item in the unified activity feed.
 * Aligned with @objectstack/spec FeedItemSchema.
 */
export interface FeedItem {
  /** Unique identifier */
  id: string | number;
  /** Feed item type */
  type: FeedItemType;
  /** Actor / author display name */
  actor: string;
  /** Actor avatar URL */
  actorAvatarUrl?: string;
  /** Main body / text content (may contain Markdown) */
  body?: string;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt?: string;
  /** Source of the feed item (e.g., 'manual', 'api', 'automation') */
  source?: string;
  /** Parent feed item ID (for threading) */
  parentId?: string | number;
  /** Number of replies (if this is a root comment) */
  replyCount?: number;
  /** Field change entries (for field_change type) */
  fieldChanges?: FieldChangeEntry[];
  /** Mentions within this feed item */
  mentions?: Mention[];
  /** Reactions on this feed item */
  reactions?: Reaction[];
  /** Whether this item is pinned */
  pinned?: boolean;
  /** Whether this item has been edited */
  edited?: boolean;
}

/**
 * FieldChangeEntry — A single field change within a feed item.
 * Aligned with @objectstack/spec FieldChangeEntrySchema.
 */
export interface FieldChangeEntry {
  /** Field API name */
  field: string;
  /** Field display label */
  fieldLabel?: string;
  /** Previous raw value */
  oldValue?: unknown;
  /** New raw value */
  newValue?: unknown;
  /** Previous human-readable display value */
  oldDisplayValue?: string;
  /** New human-readable display value */
  newDisplayValue?: string;
}

/**
 * Mention — An @mention within a feed item.
 * Aligned with @objectstack/spec MentionSchema.
 */
export interface Mention {
  /** Mention target type */
  type: 'user' | 'team' | 'group';
  /** Mentioned entity ID */
  id: string;
  /** Display name */
  name: string;
  /** Offset in the body text */
  offset?: number;
  /** Length of the mention text */
  length?: number;
}

/**
 * Reaction — An emoji reaction on a feed item.
 * Aligned with @objectstack/spec ReactionSchema.
 */
export interface Reaction {
  /** Emoji identifier (e.g. '👍', '❤️', '🎉') */
  emoji: string;
  /** Number of users who reacted with this emoji */
  count: number;
  /** Whether the current user reacted with this emoji */
  reacted?: boolean;
  /** IDs of users who reacted */
  userIds?: string[];
}

/**
 * RecordSubscription — Notification subscription state for a record.
 * Aligned with @objectstack/spec RecordSubscriptionSchema.
 */
export interface RecordSubscription {
  /** Record ID */
  recordId: string | number;
  /** Whether the current user is subscribed */
  subscribed: boolean;
  /** Notification channels */
  channels?: Array<'in_app' | 'email' | 'push'>;
}

/**
 * Detail View Schema - Display detailed information about a single record
 * Enhanced in Phase 2 with better organization and features
 */
export interface DetailViewSchema extends BaseSchema {
  type: 'detail-view';
  /**
   * Detail title
   */
  title?: string;
  /**
   * API endpoint to fetch detail data
   */
  api?: string;
  /**
   * Resource ID to display
   */
  resourceId?: string | number;
  /**
   * Object name (for ObjectQL integration)
   */
  objectName?: string;
  /**
   * Data to display (if not fetching from API)
   */
  data?: any;
  /**
   * Layout mode
   */
  layout?: 'vertical' | 'horizontal' | 'grid';
  /**
   * Grid columns (for grid layout)
   */
  columns?: number;
  /**
   * Field sections for organized display
   */
  sections?: DetailViewSection[];
  /**
   * Direct fields (without sections)
   */
  fields?: DetailViewField[];
  /**
   * Actions available in detail view
   */
  actions?: ActionSchema[];
  /**
   * Tabs for additional content
   */
  tabs?: DetailViewTab[];
  /**
   * Show back button
   * @default true
   */
  showBack?: boolean;
  /**
   * Back button URL
   */
  backUrl?: string;
  /**
   * Custom back action
   */
  onBack?: string;
  /**
   * Show edit button
   */
  showEdit?: boolean;
  /**
   * Edit button URL
   */
  editUrl?: string;
  /**
   * Show delete button
   */
  showDelete?: boolean;
  /**
   * Delete confirmation message
   */
  deleteConfirmation?: string;
  /**
   * Whether to show loading state
   * @default true
   */
  loading?: boolean;
  /**
   * Custom header content
   */
  header?: SchemaNode;
  /**
   * Custom footer content
   */
  footer?: SchemaNode;
  /**
   * Navigation handler for SPA-aware routing.
   * Called instead of window.location.href for back/edit navigation.
   * @param url - The URL to navigate to
   * @param options - Navigation options (replace, newTab, etc.)
   */
  onNavigate?: (url: string, options?: { replace?: boolean; newTab?: boolean }) => void;
  /**
   * Related records section
   */
  related?: Array<{
    /**
     * Relation title
     */
    title: string;
    /**
     * Relation type
     */
    type: 'list' | 'grid' | 'table';
    /**
     * API endpoint for related data
     */
    api?: string;
    /**
     * Static data
     */
    data?: any[];
    /**
     * Columns for table view
     */
    columns?: TableColumn[];
    /**
     * Fields for list view
     */
    fields?: string[];
  }>;
  /**
   * Record navigation configuration for prev/next navigation.
   * Allows navigating through a result set from within the detail view.
   */
  recordNavigation?: {
    /** All record IDs in the current view's result set */
    recordIds: Array<string | number>;
    /** Current record's index in the result set (0-based) */
    currentIndex: number;
    /** Callback to navigate to a specific record by ID */
    onNavigate: (recordId: string | number) => void;
  };
  /**
   * Comments associated with this record
   */
  comments?: CommentEntry[];
  /**
   * Callback to add a new comment
   */
  onAddComment?: (text: string) => void | Promise<void>;
  /**
   * Activity history entries for this record
   */
  activities?: ActivityEntry[];
}

/**
 * View Switcher Schema - Toggle between different view modes
 * New in Phase 2
 */
export interface ViewSwitcherSchema extends BaseSchema {
  type: 'view-switcher';
  /**
   * Available view types
   */
  views: Array<{
    /**
     * View type
     */
    type: ViewType;
    /**
     * View label
     */
    label?: string;
    /**
     * View icon
     */
    icon?: string;
    /**
     * View schema
     */
    schema?: SchemaNode;
  }>;
  /**
   * Default/active view
   */
  defaultView?: ViewType;
  /**
   * Current active view
   */
  activeView?: ViewType;
  /**
   * Switcher variant
   */
  variant?: 'tabs' | 'buttons' | 'dropdown';
  /**
   * Switcher position
   */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /**
   * View change callback
   */
  onViewChange?: string;
  /**
   * Persist view preference
   */
  persistPreference?: boolean;
  /**
   * Storage key for persisting view
   */
  storageKey?: string;
}

/**
 * Filter UI Schema - Enhanced filter interface
 * New in Phase 2
 */
export interface FilterUISchema extends BaseSchema {
  type: 'filter-ui';
  /**
   * Available filters
   */
  filters: Array<{
    /**
     * Filter field
     */
    field: string;
    /**
     * Filter label
     */
    label?: string;
    /**
     * Filter type
     */
    type: 'text' | 'number' | 'select' | 'date' | 'date-range' | 'boolean';
    /**
     * Filter operator
     */
    operator?: 'equals' | 'contains' | 'startsWith' | 'gt' | 'lt' | 'between' | 'in';
    /**
     * Options for select filter
     */
    options?: Array<{ label: string; value: any }>;
    /**
     * Placeholder
     */
    placeholder?: string;
  }>;
  /**
   * Current filter values
   */
  values?: Record<string, any>;
  /**
   * Filter change callback
   */
  onChange?: string;
  /**
   * Show clear button
   */
  showClear?: boolean;
  /**
   * Show apply button
   */
  showApply?: boolean;
  /**
   * Filter layout
   */
  layout?: 'inline' | 'popover' | 'drawer';
}

/**
 * Sort UI Schema - Enhanced sort interface
 * New in Phase 2
 */
export interface SortUISchema extends BaseSchema {
  type: 'sort-ui';
  /**
   * Sortable fields
   */
  fields: Array<{
    /**
     * Field name
     */
    field: string;
    /**
     * Field label
     */
    label?: string;
  }>;
  /**
   * Current sort configuration
   */
  sort?: Array<{
    /**
     * Field to sort by
     */
    field: string;
    /**
     * Sort direction
     */
    direction: 'asc' | 'desc';
  }>;
  /**
   * Sort change callback
   */
  onChange?: string;
  /**
   * Allow multiple sort fields
   */
  multiple?: boolean;
  /**
   * UI variant
   */
  variant?: 'dropdown' | 'buttons';
}

/**
 * Union type of all view schemas
 */
export type ViewComponentSchema =
  | DetailViewSchema
  | ViewSwitcherSchema
  | FilterUISchema
  | SortUISchema;
