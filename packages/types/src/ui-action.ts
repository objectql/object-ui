/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - UI Action Schema
 * 
 * ObjectStack Spec v2.0.1 compliant action schema with enhanced capabilities:
 * - Location-based action placement
 * - Parameter collection
 * - Conditional visibility and enablement
 * - Rich feedback mechanisms
 * 
 * @module ui-action
 * @packageDocumentation
 */

// ============================================================================
// Spec-Canonical Action Sub-types — imported from @objectstack/spec/ui
// ============================================================================

/**
 * Action placement locations
 * Canonical definition from @objectstack/spec/ui ActionSchema.locations.
 */
export type ActionLocation = 
  | 'list_toolbar'       // Top toolbar in list views
  | 'list_item'          // Per-item actions in list
  | 'record_header'      // Header area of record detail
  | 'record_more'        // More menu in record detail
  | 'record_related'     // Related lists section
  | 'global_nav';        // Global navigation bar

/**
 * Visual component type for actions
 * Canonical definition from @objectstack/spec/ui ActionSchema.component.
 */
export type ActionComponent = 
  | 'action:button'      // Standard button
  | 'action:icon'        // Icon-only button
  | 'action:menu'        // Menu item
  | 'action:group';      // Action group/dropdown

/**
 * Action execution type
 * Canonical definition from @objectstack/spec/ui ActionSchema.type.
 */
export type ActionType = 
  | 'script'             // Execute JavaScript/expression
  | 'url'                // Navigate to URL
  | 'modal'              // Open modal dialog
  | 'flow'               // Start workflow/automation
  | 'api';               // Call API endpoint

/**
 * Field type for action parameters
 * Subset of field types commonly used in action parameter collection UIs.
 * Aligned with the field types available in @objectstack/spec ActionParamSchema.
 */
export type ActionParamFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'time'
  | 'select'
  | 'email'
  | 'phone'
  | 'url'
  | 'password'
  | 'file'
  | 'color'
  | 'slider'
  | 'rating';

/**
 * Action parameter definition (ObjectStack Spec v2.0.1)
 */
export interface ActionParam {
  /** Parameter name (snake_case) */
  name: string;
  
  /** Display label */
  label: string;
  
  /** Field type for input */
  type: ActionParamFieldType;
  
  /** Whether parameter is required */
  required?: boolean;
  
  /** Options for select/picklist types */
  options?: Array<{ label: string; value: string }>;
  
  /** Default value */
  defaultValue?: unknown;
  
  /** Help text */
  helpText?: string;
  
  /** Placeholder text */
  placeholder?: string;
  
  /** Validation expression */
  validation?: string;
}

/**
 * Enhanced Action Schema (ObjectStack Spec v2.0.1)
 * 
 * This is the primary action schema that should be used for all new implementations.
 * The legacy ActionSchema in crud.ts is maintained for backward compatibility.
 */
export interface ActionSchema {
  /** Unique action identifier (snake_case) */
  name: string;
  
  /** Display label */
  label: string;
  
  /** Optional icon (Lucide icon name) */
  icon?: string;
  
  // === Placement ===
  
  /** Where to show this action (defaults to ['record_header']) */
  locations?: ActionLocation[];
  
  /** Visual component type (defaults to 'action:button') */
  component?: ActionComponent;
  
  // === Behavior ===
  
  /** Action execution type */
  type: ActionType;
  
  /** Target for the action (URL, script name, etc.) */
  target?: string;
  
  /** Script to execute (for type: 'script') */
  execute?: string;
  
  /** API endpoint (for type: 'api') */
  endpoint?: string;
  
  /** HTTP method (for type: 'api') */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  
  // === Parameters ===
  
  /** Input parameters to collect before execution */
  params?: ActionParam[];
  
  // === Feedback ===
  
  /** Confirmation text to show before execution */
  confirmText?: string;
  
  /** Success message to show after execution */
  successMessage?: string;
  
  /** Error message to show on failure */
  errorMessage?: string;
  
  /** Whether to refresh data after execution */
  refreshAfter?: boolean;
  
  /** Toast notification configuration */
  toast?: {
    /** Show toast on success */
    showOnSuccess?: boolean;
    
    /** Show toast on error */
    showOnError?: boolean;
    
    /** Toast duration in milliseconds */
    duration?: number;
  };
  
  // === Conditional ===
  
  /** Expression controlling visibility (e.g., "status === 'draft'") */
  visible?: string;
  
  /** Expression controlling enabled state (e.g., "hasPermission('edit')") */
  enabled?: string;
  
  // === Styling ===
  
  /** Button variant */
  variant?: 'default' | 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost';
  
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  
  /** Custom CSS class */
  className?: string;
  
  // === Metadata ===
  
  /** Action description */
  description?: string;
  
  /** Permission required to execute */
  permission?: string;
  
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Action group for organizing related actions
 */
export interface ActionGroup {
  /** Group name */
  name: string;
  
  /** Display label */
  label: string;
  
  /** Optional icon */
  icon?: string;
  
  /** Actions in this group */
  actions: ActionSchema[];
  
  /** Group visibility condition */
  visible?: string;
  
  /** Display as dropdown or inline */
  display?: 'dropdown' | 'inline';
}

/**
 * Action execution context
 */
export interface ActionContext {
  /** Current record data */
  record?: Record<string, any>;
  
  /** Selected records (for list actions) */
  selectedRecords?: Record<string, any>[];
  
  /** Current user */
  user?: Record<string, any>;
  
  /** Additional context data */
  [key: string]: any;
}

/**
 * Action execution result
 */
export interface ActionResult {
  /** Whether action succeeded */
  success: boolean;
  
  /** Result data */
  data?: any;
  
  /** Error message if failed */
  error?: string;
  
  /** Whether to refresh data */
  refresh?: boolean;
  
  /** Whether to close dialog/modal */
  close?: boolean;
}

/**
 * Action executor function type
 */
export type ActionExecutor = (
  action: ActionSchema,
  context: ActionContext,
  params?: Record<string, any>
) => Promise<ActionResult>;
