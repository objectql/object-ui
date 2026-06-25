/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Record Component Schemas
 *
 * Type definitions for record:* page components.
 * Aligned with @objectstack/spec RecordDetailsProps, RecordRelatedListProps,
 * RecordHighlightsProps, RecordActivityProps, RecordChatterProps, RecordPathProps.
 *
 * @module record-components
 * @packageDocumentation
 */

/**
 * ARIA props shared across all record components.
 * Aligned with @objectstack/spec AriaPropsSchema.
 */
export interface RecordComponentAriaProps {
  ariaLabel?: string;
  ariaDescribedBy?: string;
  role?: string;
}

// ============================================================================
// record:details — Record Detail Panel
// ============================================================================

/**
 * Props for the record:details page component.
 * Displays a record's fields in a structured detail layout.
 * Aligned with @objectstack/spec RecordDetailsProps.
 */
export interface RecordDetailsComponentProps {
  /** Number of columns for field layout (1-4) */
  columns?: number;
  /** Detail layout mode */
  layout?: 'stacked' | 'inline' | 'compact';
  /** Sections to organize fields */
  sections?: Array<{
    /** Stable identifier for i18n key resolution (e.g. 'info', 'forecast'). */
    name?: string;
    label?: string;
    fields: string[];
    collapsible?: boolean;
    collapsed?: boolean;
  }>;
  /** Specific fields to display (overrides auto-detection from object) */
  fields?: string[];
  /** ARIA accessibility attributes */
  aria?: RecordComponentAriaProps;
}

// ============================================================================
// record:highlights — Key Field Summary
// ============================================================================

/**
 * Props for the record:highlights page component.
 * Shows key fields as a summary/highlights panel (e.g., top of detail page).
 * Aligned with @objectstack/spec RecordHighlightsProps.
 */
export interface RecordHighlightsComponentProps {
  /** Fields to display as highlights — bare names or {name,label?,icon?,type?} for inline overrides */
  fields: Array<string | { name: string; label?: string; icon?: string; type?: string }>;
  /** Layout mode for highlights display */
  layout?: 'horizontal' | 'vertical' | 'grid';
  /** ARIA accessibility attributes */
  aria?: RecordComponentAriaProps;
}

// ============================================================================
// record:related_list — Related Records Table
// ============================================================================

/**
 * Props for the record:related_list page component.
 * Displays a list of related records via a relationship field.
 * Aligned with @objectstack/spec RecordRelatedListProps.
 */
export interface RecordRelatedListComponentProps {
  /** Related object name */
  objectName: string;
  /** Field on the related object that links back to this record */
  relationshipField: string;
  /** Columns to display in the related list */
  columns?: string[];
  /** Sort configuration */
  sort?: Array<{ field: string; order: 'asc' | 'desc' }>;
  /** Maximum records to display */
  limit?: number;
  /** Filter conditions */
  filter?: any;
  /** Section title */
  title?: string;
  /** Show "View All" link */
  showViewAll?: boolean;
  /** Available actions for the related list */
  actions?: string[];
  /**
   * Add-existing-via-picker config (generic m2m/junction assignment). Pick
   * records from `add.picker.object` and create link rows in `objectName`
   * (`{[relationshipField]: parentId, [add.linkField]: pickedId}`), or omit
   * `linkField` to re-parent the picked 1:m child. Mirrors the spec
   * RecordRelatedListProps.add.
   */
  add?: {
    picker: { object: string; valueField?: string; labelField?: string; filter?: unknown };
    linkField?: string;
    label?: string;
  };
  /** ARIA accessibility attributes */
  aria?: RecordComponentAriaProps;
}

// ============================================================================
// record:activity — Activity Timeline
// ============================================================================

/**
 * Props for the record:activity page component.
 * Displays an activity feed/timeline for a record.
 * Aligned with @objectstack/spec RecordActivityProps.
 */
export interface RecordActivityComponentProps {
  /** Activity types to display */
  types?: string[];
  /** Filter mode for activity types */
  filterMode?: string;
  /** Show filter toggle UI */
  showFilterToggle?: boolean;
  /** Maximum activities to display */
  limit?: number;
  /** Show completed/resolved activities */
  showCompleted?: boolean;
  /** Merge all activity types into a single timeline */
  unifiedTimeline?: boolean;
  /** Show comment input box */
  showCommentInput?: boolean;
  /** Enable @mentions in comments */
  enableMentions?: boolean;
  /** Enable emoji reactions on activities */
  enableReactions?: boolean;
  /** Enable threaded comment replies */
  enableThreading?: boolean;
  /** Show subscribe/unsubscribe toggle */
  showSubscriptionToggle?: boolean;
  /** ARIA accessibility attributes */
  aria?: RecordComponentAriaProps;
}

// ============================================================================
// record:chatter — Comments & Discussion
// ============================================================================

/**
 * Props for the record:chatter page component.
 * Provides a chat/discussion panel for a record.
 * Aligned with @objectstack/spec RecordChatterProps.
 */
export interface RecordChatterComponentProps {
  /** Panel position */
  position?: 'bottom' | 'right' | 'left';
  /** Panel width (CSS value) */
  width?: string;
  /** Whether the chatter panel is collapsible */
  collapsible?: boolean;
  /** Whether the chatter panel starts collapsed */
  defaultCollapsed?: boolean;
  /** Activity feed configuration within chatter */
  feed?: RecordActivityComponentProps;
  /** ARIA accessibility attributes */
  aria?: RecordComponentAriaProps;
}

// ============================================================================
// record:path — Record Path / Progress Indicator
// ============================================================================

/**
 * Props for the record:path page component.
 * Displays a progress/stage indicator for the record (e.g., Lead → Qualified → Won).
 * Aligned with @objectstack/spec RecordPathProps.
 */
export interface RecordPathComponentProps {
  /** Field that holds the current status/stage value */
  statusField: string;
  /** Ordered list of stages */
  stages: Array<{
    /** Stage value (matches statusField values) */
    value: string;
    /** Display label for the stage */
    label: string;
    /**
     * Terminal classification. Stages marked `'won'` render as the
     * success terminus of the forward path; stages marked `'lost'`
     * render as a visually separated alt-terminus (muted / destructive
     * tint) because they break the chevron flow rather than completing
     * it. When omitted, the renderer falls back to a value/label
     * heuristic (matches common lost-state tokens like `closed_lost`,
     * `lost`, `failed`, `cancelled`, `失败`, `流失`).
     */
    terminal?: 'won' | 'lost';
  }>;
  /** ARIA accessibility attributes */
  aria?: RecordComponentAriaProps;
}
