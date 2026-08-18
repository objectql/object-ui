/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Block Schema
 * 
 * Defines reusable component blocks for composition and templating.
 */

import type { BaseSchema, SchemaNode } from './base.js';

/**
 * Block Variable Definition
 */
export interface BlockVariable {
  /**
   * Variable name
   */
  name: string;

  /**
   * Display label
   */
  label?: string;

  /**
   * Variable type
   */
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'component';

  /**
   * Default value
   */
  defaultValue?: any;

  /**
   * Description/help text
   */
  description?: string;

  /**
   * Whether this variable is required
   */
  required?: boolean;

  /**
   * Validation rules
   */
  validation?: any;

  /**
   * Enum options (for string/number types)
   */
  enum?: any[];
}

/**
 * Block Slot Definition
 */
export interface BlockSlot {
  /**
   * Slot name
   */
  name: string;

  /**
   * Display label
   */
  label?: string;

  /**
   * Description
   */
  description?: string;

  /**
   * Default content
   */
  defaultContent?: SchemaNode | SchemaNode[];

  /**
   * Allowed component types
   */
  allowedTypes?: string[];

  /**
   * Maximum number of children
   */
  maxChildren?: number;

  /**
   * Whether this slot is required
   */
  required?: boolean;
}

/**
 * Block Metadata
 */
export interface BlockMetadata {
  /**
   * Block name/identifier
   */
  name: string;

  /**
   * Display label
   */
  label?: string;

  /**
   * Block description
   */
  description?: string;

  /**
   * Block category
   */
  category?: string;

  /**
   * Block icon
   */
  icon?: string;

  /**
   * Block tags for search
   */
  tags?: string[];

  /**
   * Author/creator
   */
  author?: string;

  /**
   * Version
   */
  version?: string;

  /**
   * License
   */
  license?: string;

  /**
   * Repository URL
   */
  repository?: string;

  /**
   * Preview image URL
   */
  preview?: string;

  /**
   * Is this a premium/paid block
   */
  premium?: boolean;
}

/**
 * Block Schema - Reusable component block
 */
export interface BlockSchema extends BaseSchema {
  type: 'block';

  /**
   * Block metadata
   */
  meta?: BlockMetadata;

  /**
   * Block variables/props
   */
  variables?: BlockVariable[];

  /**
   * Block slots for content injection
   */
  slots?: BlockSlot[];

  /**
   * Block template (component tree)
   */
  template?: SchemaNode | SchemaNode[];

  /**
   * Variable values (when using a block)
   */
  values?: Record<string, any>;

  /**
   * Slot content (when using a block)
   */
  slotContent?: Record<string, SchemaNode | SchemaNode[]>;

  /**
   * Block reference (for reusing saved blocks)
   */
  blockRef?: string;

  /**
   * Enable edit mode
   */
  editable?: boolean;
}

/**
 * Block Library Item
 */
export interface BlockLibraryItem {
  /**
   * Unique identifier
   */
  id: string;

  /**
   * Block metadata
   */
  meta: BlockMetadata;

  /**
   * Block schema
   */
  schema: BlockSchema;

  /**
   * Installation count
   */
  installs?: number;

  /**
   * Rating (1-5)
   */
  rating?: number;

  /**
   * Number of ratings
   */
  ratingCount?: number;

  /**
   * Last updated timestamp
   */
  updatedAt?: string;

  /**
   * Created timestamp
   */
  createdAt?: string;
}

/**
 * Block Library Schema - Browse and install blocks
 */
export interface BlockLibrarySchema extends BaseSchema {
  type: 'block-library';

  /**
   * Library API endpoint
   */
  apiEndpoint?: string;

  /**
   * Filter by category
   */
  category?: string;

  /**
   * Search query
   */
  searchQuery?: string;

  /**
   * Filter by tags
   */
  tags?: string[];

  /**
   * Show premium blocks
   */
  showPremium?: boolean;

  /**
   * Blocks to display
   */
  blocks?: BlockLibraryItem[];

  /**
   * Loading state
   */
  loading?: boolean;

  /**
   * Install callback
   */
  onInstall?: string;

  /**
   * Preview callback
   */
  onPreview?: string;
}

/**
 * Block Editor Schema - Edit/create blocks
 */
export interface BlockEditorSchema extends BaseSchema {
  type: 'block-editor';

  /**
   * Block being edited
   */
  block?: BlockSchema;

  /**
   * Show variable editor
   */
  showVariables?: boolean;

  /**
   * Show slot editor
   */
  showSlots?: boolean;

  /**
   * Show template editor
   */
  showTemplate?: boolean;

  /**
   * Show preview
   */
  showPreview?: boolean;

  /**
   * Save callback
   */
  onSave?: string;

  /**
   * Cancel callback
   */
  onCancel?: string;
}

/**
 * Block Instance Schema - Use a saved block
 */
export interface BlockInstanceSchema extends BaseSchema {
  type: 'block-instance';

  /**
   * Block reference ID
   */
  blockId: string;

  /**
   * Block name (for local blocks)
   */
  blockName?: string;

  /**
   * Variable values
   */
  values?: Record<string, any>;

  /**
   * Slot content
   */
  slotContent?: Record<string, SchemaNode | SchemaNode[]>;

  /**
   * Override styles
   */
  overrideStyles?: boolean;
}

/**
 * Component Schema Extension - For base component metadata
 */
export interface ComponentSchema extends BaseSchema {
  type: 'component';

  /**
   * Component name/identifier
   */
  componentName?: string;

  /**
   * Component props
   */
  props?: Record<string, any>;

  /**
   * Component children
   */
  children?: SchemaNode | SchemaNode[];
}
