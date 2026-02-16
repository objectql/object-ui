/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { BaseSchema } from '@object-ui/types';

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
}
