/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/core - Standard Expression Context Protocol
 *
 * Defines the standardized context shape available in all ${...} expressions.
 * Ensures consistent variable naming across forms, pages, actions, and layouts.
 *
 * @example
 * ```ts
 * // All expressions have access to these standard namespaces:
 * "${data.name}"            // Current row / record data
 * "${record.id}"            // Alias for data (record context)
 * "${form.status}"          // Form field values (inside forms)
 * "${user.name}"            // Current authenticated user
 * "${page.title}"           // Page-level variables
 * "${params.orderId}"       // URL / navigation parameters
 * "${env.API_URL}"          // Environment variables
 * ```
 *
 * @module evaluator
 * @packageDocumentation
 */

/**
 * Standard user context available in expressions
 */
export interface UserContext {
  /** Unique user identifier */
  id?: string;
  /** Display name */
  name?: string;
  /** Email address */
  email?: string;
  /** User roles */
  roles?: string[];
  /** User's locale / language */
  locale?: string;
  /** User's timezone */
  timezone?: string;
  /** Profile image URL */
  avatar?: string;
  /** Additional user properties */
  [key: string]: unknown;
}

/**
 * Standard page context available in expressions
 */
export interface PageContext {
  /** Page title */
  title?: string;
  /** Page type (record, home, app, utility) */
  type?: string;
  /** Object name associated with this page */
  objectName?: string;
  /** Page-level variables set via PageVariablesProvider */
  [key: string]: unknown;
}

/**
 * Standard environment context available in expressions
 */
export interface EnvContext {
  /** Current mode (development, staging, production) */
  mode?: string;
  /** Base API URL */
  baseUrl?: string;
  /** Additional environment variables */
  [key: string]: unknown;
}

/**
 * The fully standardized expression evaluation context.
 *
 * All expression evaluation sites (form fields, page visibility,
 * action conditions, layout expressions) SHOULD build a context
 * that conforms to this shape.
 */
export interface StandardExpressionContext {
  /**
   * Current data record.
   * In a list: the current row. In a form: the current record being edited.
   */
  data: Record<string, unknown>;

  /**
   * Alias for `data`. Some contexts prefer "record" for clarity.
   */
  record: Record<string, unknown>;

  /**
   * Form field values. Only populated inside form contexts.
   * Identical to `data` when inside a form, but kept as a separate
   * namespace so expressions can explicitly reference form state.
   */
  form: Record<string, unknown>;

  /**
   * Current authenticated user information.
   */
  user: UserContext;

  /**
   * Page-level variables and metadata.
   */
  page: PageContext;

  /**
   * URL or navigation parameters (query string, route params).
   */
  params: Record<string, unknown>;

  /**
   * Environment variables and configuration.
   */
  env: EnvContext;

  /**
   * Index in a repeating context (e.g., list row index).
   */
  index?: number;

  /**
   * Parent record when in a child/related context.
   */
  parent?: Record<string, unknown>;
}

/**
 * Options for building a standard context
 */
export interface BuildContextOptions {
  /** Current data/record */
  data?: Record<string, unknown>;
  /** Form values (defaults to data if not provided) */
  form?: Record<string, unknown>;
  /** Authenticated user info */
  user?: UserContext;
  /** Page metadata & variables */
  page?: PageContext;
  /** URL / route parameters */
  params?: Record<string, unknown>;
  /** Environment config */
  env?: EnvContext;
  /** Current index in a repeating context */
  index?: number;
  /** Parent record */
  parent?: Record<string, unknown>;
  /** Additional custom context variables */
  extra?: Record<string, unknown>;
}

/**
 * Build a fully populated StandardExpressionContext with sensible defaults.
 *
 * Missing namespaces are initialized to empty objects so that expressions
 * like `${user.name}` don't throw even when no user is provided.
 *
 * @example
 * ```ts
 * const ctx = buildStandardContext({
 *   data: { name: 'Alice', amount: 500 },
 *   user: { id: '1', name: 'Admin', roles: ['admin'] },
 * });
 * // ctx.data.name → 'Alice'
 * // ctx.record.name → 'Alice'  (alias)
 * // ctx.user.roles → ['admin']
 * // ctx.form → { name: 'Alice', amount: 500 }
 * ```
 */
export function buildStandardContext(options: BuildContextOptions = {}): StandardExpressionContext & Record<string, unknown> {
  const data = options.data ?? {};
  const form = options.form ?? data;

  const ctx: StandardExpressionContext & Record<string, unknown> = {
    data,
    record: data, // alias
    form,
    user: options.user ?? {},
    page: options.page ?? {},
    params: options.params ?? {},
    env: options.env ?? {},
    index: options.index,
    parent: options.parent,
  };

  // Merge any extra custom variables at the top level
  if (options.extra) {
    Object.assign(ctx, options.extra);
  }

  return ctx;
}
