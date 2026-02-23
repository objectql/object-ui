/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { BaseSchema, GroupingConfig } from '@object-ui/types';

/**
 * Kanban card interface.
 */
export interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  badges?: Array<{ label: string; variant?: "default" | "secondary" | "destructive" | "outline" }>;
  [key: string]: any;
}

/**
 * Kanban column interface.
 */
export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
  limit?: number;
  className?: string;
}

/**
 * Kanban Board component schema.
 * Renders a drag-and-drop kanban board for task management.
 */
export interface KanbanSchema extends BaseSchema {
  type: 'kanban';
  
  /**
   * Object name to fetch data from.
   */
  objectName?: string;

  /**
   * Field to group records by (maps to column IDs).
   */
  groupBy?: string;

  /**
   * Field for swimlane rows (2D grouping). When set, cards are grouped
   * vertically by `groupBy` (columns) and horizontally by `swimlaneField` (rows).
   */
  swimlaneField?: string;

  /**
   * Field to use as the card title.
   */
  cardTitle?: string;

  /**
   * Fields to display on the card.
   */
  cardFields?: string[];

  /**
   * Static data or bound data.
   */
  data?: any[];

  /**
   * Array of columns to display in the kanban board.
   * Each column contains an array of cards.
   */
  columns?: KanbanColumn[];
  
  /**
   * Callback function when a card is moved between columns or reordered.
   */
  onCardMove?: (cardId: string, fromColumnId: string, toColumnId: string, newIndex: number) => void;
  
  /**
   * Optional CSS class name to apply custom styling.
   */
  className?: string;

  /**
   * Enable Quick Add button at the bottom of each column.
   * When true, a "+" button appears allowing inline card creation.
   * @default false
   */
  quickAdd?: boolean;

  /**
   * Callback when a new card is created via Quick Add.
   */
  onQuickAdd?: (columnId: string, title: string) => void;

  /**
   * Field name to use as cover image on cards.
   * The field value should be a URL string or file object with a `url` property.
   */
  coverImageField?: string;

  /**
   * Allow columns to be collapsed/expanded.
   * @default false
   */
  allowCollapse?: boolean;

  /**
   * Conditional formatting rules for card coloring.
   */
  conditionalFormatting?: Array<{
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'in';
    value: string | string[];
    backgroundColor?: string;
    borderColor?: string;
  }>;

  /**
   * Predefined card templates for quick-add.
   * Each template pre-fills the quick-add form with default values.
   */
  cardTemplates?: CardTemplate[];

  /**
   * Custom column width configuration.
   * Supports per-column overrides with min/max constraints.
   */
  columnWidths?: ColumnWidthConfig;

  /**
   * Grouping configuration from ListView.
   * When set, the first grouping field is used as swimlaneField fallback.
   */
  grouping?: GroupingConfig;
}

/**
 * A predefined card template with pre-filled field values.
 */
export interface CardTemplate {
  /** Unique template identifier */
  id: string;
  /** Human-readable template name */
  name: string;
  /** Optional Lucide icon name */
  icon?: string;
  /** Pre-filled field values */
  values: Record<string, any>;
}

/**
 * Configuration for custom column widths.
 */
export interface ColumnWidthConfig {
  /** Default column width in pixels */
  defaultWidth?: number;
  /** Minimum column width in pixels */
  minWidth?: number;
  /** Maximum column width in pixels */
  maxWidth?: number;
  /** Per-column width overrides keyed by column ID */
  overrides?: Record<string, number>;
}

/**
 * Field definition for inline quick-add forms.
 */
export interface InlineFieldDefinition {
  /** Field name (key in the resulting values object) */
  name: string;
  /** Display label */
  label?: string;
  /** Field type */
  type: 'text' | 'number' | 'select';
  /** Placeholder text */
  placeholder?: string;
  /** Default value */
  defaultValue?: any;
  /** Options for select fields */
  options?: Array<{ label: string; value: string }>;
}
