/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type React from 'react';
import type { BaseSchema, GroupingConfig, KanbanConditionalFormattingRule } from '@object-ui/types';

/**
 * Kanban card interface.
 */
export interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  badges?: Array<{
    label: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
    /**
     * Optional Tailwind class string applied to the badge. When set, it
     * overrides `variant` so callers can reuse the same colors as list/grid
     * cells.
     *
     * Derive it the way the grid cell derives it, or the same option renders
     * two colours on one screen (objectui#5183): prefer
     * `getBadgeHexAppearance(color)` from `@object-ui/fields` and use its
     * `className` — passing its `colorStyle` too — and fall back to
     * `getBadgeColorClasses(color, value)` only when it returns `undefined`.
     */
    colorClass?: string;
    /**
     * Inline style accompanying `colorClass`. **Required whenever the class
     * string came from `getBadgeHexAppearance`** — that className reads CSS
     * custom properties which only this style declares, so a badge carrying
     * the class without the style references undefined variables. Pass the
     * helper's `style` verbatim; leave unset on the palette-family path.
     */
    colorStyle?: React.CSSProperties;
  }>;
  /**
   * Synthesized card subtitle (e.g. "Account: Acme · Amount: $150K"). Rendered
   * in preference to `description` so we don't have to overwrite the record's
   * real `description` field — which would corrupt detail-view and edit-form
   * displays once a card is opened.
   *
   * Read by `KanbanImpl`; absent on a board that renders plain descriptions.
   */
  cardSubtitle?: string;
  /**
   * Structured per-field cells. When provided, the card body renders each
   * field via the unified `@object-ui/fields` cell-renderer pipeline (same
   * as Grid/Gallery), so lookup/user/email/url/phone/boolean/etc. fields
   * keep their semantic styling instead of being flattened to a text join.
   *
   * Takes precedence over `cardSubtitle` / `description` when present.
   */
  cardFieldCells?: Array<{ field: string; label?: string; node: React.ReactNode }>;
  /**
   * Resolved cover-image URL for the card, derived from the board's
   * `coverImageField`. Read by both board implementations.
   */
  coverImage?: string;
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
  /**
   * Whether the lane renders collapsed. Honoured by `KanbanEnhanced` (the
   * implementation that ships column collapsing); the plain board ignores it.
   */
  collapsed?: boolean;
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
   * Row cap for the fetch. Defaults to `DEFAULT_KANBAN_LIMIT` (100); a board
   * renders every fetched record into a lane and has no pagination control, so
   * this is the author's window rather than a page size. A bound `dataSource`
   * writes it here too — the binding's own `limit`, or the named view's
   * `pagination.pageSize`.
   *
   * Not to be confused with {@link KanbanColumn.limit}, one level down: that is
   * a lane's WIP limit (the card count at which the lane warns) and never
   * reaches the query.
   */
  limit?: number;

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
   * Conditional formatting rules for card coloring. Accepts the native
   * `{ field, operator, value }` shape and the spec `{ condition, style }` CEL
   * shape (issue #1584).
   */
  conditionalFormatting?: KanbanConditionalFormattingRule[];

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
