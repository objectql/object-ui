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
import { z } from 'zod';

// ============================================================================
// Spec-Canonical Action Sub-types — imported from @objectstack/spec/ui
// ============================================================================

/**
 * Action placement locations.
 *
 * Single source of truth lives in `@objectstack/spec/ui` as
 * `ACTION_LOCATIONS` + `ActionLocationSchema` + `ActionLocation`. Re-export
 * here so existing `@object-ui/types` consumers keep working without coupling
 * them to a duplicated, drift-prone enum. To add a new location, edit
 * `packages/spec/src/ui/action.zod.ts` — every layer (spec, core, types,
 * Studio designer dropdowns) picks up the new value automatically.
 */
export type ActionLocation =
  | 'list_toolbar'
  | 'list_item'
  | 'record_header'
  | 'record_more'
  | 'record_related'
  | 'record_section'
  | 'global_nav';

export const ACTION_LOCATIONS = [
  'list_toolbar',
  'list_item',
  'record_header',
  'record_more',
  'record_related',
  'record_section',
  'global_nav',
] as const satisfies readonly ActionLocation[];

export const ActionLocationSchema = z.enum(ACTION_LOCATIONS);

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

  /**
   * Sort order within a location group (lower = higher / more prominent;
   * defaults to 0). The action:bar stable-sorts actions by `order` before the
   * inline/overflow split, so in `record_header` a lower `order` promotes an
   * action into the primary-button slot and a higher `order` pushes it toward
   * the "More" (⋯) overflow menu. Mirrors `Action.order` in `@objectstack/spec`.
   */
  order?: number;

  // === Behavior ===
  
  /** Action execution type */
  type: ActionType;
  
  /** Target for the action (URL, script name, etc.) */
  target?: string;

  /**
   * For `type: 'url'`: where to open `target`.
   * - `'new-tab'` — open `target` in a new browser tab/window.
   * - `'self'` — navigate the current page (in-app router when available).
   *
   * When omitted, the legacy heuristic applies: absolute/external URLs
   * (`http(s)://…`) open in a new tab, relative URLs navigate in place.
   *
   * This is a **static execution option**, NOT user input — keep it out of
   * {@link params}, which is exclusively for collecting input before
   * execution. Putting `newTab` inside `params` is rejected at build (an
   * object where an `ActionParam[]` is expected) and, as an array entry,
   * is mis-rendered as a checkbox in the param-collection dialog.
   *
   * Note: this is distinct from the runner-internal `opensInNewTab` /
   * `newTabUrl` pair, which pre-opens `about:blank` synchronously for async
   * handlers that resolve a redirect URL after a fetch (SSO flows). For a
   * static `target`, prefer `openIn`.
   */
  openIn?: 'self' | 'new-tab';

  /** Script to execute (for type: 'script') */
  execute?: string;
  
  /** API endpoint (for type: 'api') */
  endpoint?: string;
  
  /** HTTP method (for type: 'api') */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  
  // === Parameters ===
  
  /**
   * Input parameters to collect from the user before execution (renders a
   * dialog). This field is **exclusively** for user-input collection — it is
   * always an `ActionParam[]`. Do NOT use it to carry static execution
   * options (e.g. new-tab behavior — use {@link openIn}); a non-array value
   * fails build validation, and an array entry like
   * `{ name: 'newTab', type: 'checkbox' }` is mis-rendered as a user-facing
   * checkbox instead of being treated as an instruction.
   */
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

  /**
   * UI-local escape hatch: synchronous/async callback invoked directly by
   * UI action renderers (e.g., `action:menu`) instead of routing through
   * {@link ActionEngine}. Intended for chrome-level concerns such as
   * toggling inline-edit mode, opening a native Share sheet, or copying the
   * URL to the clipboard — UI side-effects that are not part of the domain
   * action protocol and therefore need not be serialized over the wire.
   *
   * When present, `onClick` takes precedence over `type` / `target` /
   * `execute`. Prefer {@link ActionEngine}-routed actions for anything that
   * could originate from server-driven metadata.
   */
  onClick?: () => void | Promise<void>;
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

  /** Live page-variable snapshot (ADR-0049) published by PageVariableActionBridge —
   *  lets a submit action read page-local form state via `{{page.<var>}}` tokens. */
  pageVariables?: Record<string, any>;
  
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

// ============================================================================
// Batch Operations (Q2 2026 - Spec v2.0.1 Enhancement)
// ============================================================================

/** Batch operation configuration */
export interface BatchOperationConfig {
  /** Operation name */
  name: string;
  /** Display label */
  label: string;
  /** Target action to execute on each record */
  action: string;
  /** Whether to run in parallel */
  parallel?: boolean;
  /** Maximum concurrent operations */
  concurrency?: number;
  /** Whether to continue on error */
  continueOnError?: boolean;
  /** Progress callback expression */
  onProgress?: string;
  /** Completion callback expression */
  onComplete?: string;
}

/** Batch operation result */
export interface BatchOperationResult {
  /** Total items processed */
  total: number;
  /** Successfully processed count */
  succeeded: number;
  /** Failed count */
  failed: number;
  /** Individual results */
  results: Array<{
    recordId: string;
    success: boolean;
    error?: string;
  }>;
}

// ============================================================================
// Transaction Support (Q2 2026 - Spec v2.0.1 Enhancement)
// ============================================================================

/** Transaction isolation level */
export type TransactionIsolationLevel = 'read-uncommitted' | 'read-committed' | 'repeatable-read' | 'serializable';

/** Transaction configuration */
export interface TransactionConfig {
  /** Transaction name for identification */
  name?: string;
  /** Isolation level */
  isolation?: TransactionIsolationLevel;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Actions to execute within the transaction */
  actions: ActionSchema[];
  /** Rollback action on failure */
  rollbackAction?: string;
  /** Whether to auto-retry on conflict */
  retryOnConflict?: boolean;
  /** Maximum retry attempts */
  maxRetries?: number;
}

/** Transaction result */
export interface TransactionResult {
  /** Whether all actions succeeded */
  success: boolean;
  /** Transaction ID */
  transactionId: string;
  /** Individual action results */
  actionResults: ActionResult[];
  /** Error if transaction failed */
  error?: string;
  /** Whether the transaction was rolled back */
  rolledBack?: boolean;
}

// ============================================================================
// Undo/Redo Support (Q2 2026 - Spec v2.0.1 Enhancement)
// ============================================================================

/** Undo/redo operation entry */
export interface UndoRedoEntry {
  /** Entry identifier */
  id: string;
  /** Action that was performed */
  action: string;
  /** Description of the action */
  description: string;
  /** Timestamp */
  timestamp: string;
  /** Data before the action (for undo) */
  previousState: Record<string, unknown>;
  /** Data after the action (for redo) */
  nextState: Record<string, unknown>;
  /** Target object */
  object?: string;
  /** Target record ID */
  recordId?: string;
}

/** Undo/redo configuration */
export interface UndoRedoConfig {
  /** Enable undo/redo */
  enabled: boolean;
  /** Maximum history size */
  maxHistorySize?: number;
  /** Actions that support undo */
  undoableActions?: string[];
  /** Whether to group rapid changes */
  groupChanges?: boolean;
  /** Group timeout in milliseconds */
  groupTimeout?: number;
}

/** Undo/redo state */
export interface UndoRedoState {
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Undo stack */
  undoStack: UndoRedoEntry[];
  /** Redo stack */
  redoStack: UndoRedoEntry[];
  /** Current position in history */
  currentIndex: number;
}
