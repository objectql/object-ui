/**
 * @object-ui/types - API and Event Schemas
 * 
 * Type definitions for API integration and event handling.
 * These schemas enable dynamic API calls and event-driven interactions.
 * 
 * @module api
 * @packageDocumentation
 */

import type { BaseSchema } from './base';

/**
 * HTTP Method types
 */
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * API request configuration
 */
export interface APIRequest {
  /**
   * API endpoint URL
   * Supports variable substitution: "/api/users/${userId}"
   */
  url: string;
  /**
   * HTTP method
   * @default 'GET'
   */
  method?: HTTPMethod;
  /**
   * Request headers
   */
  headers?: Record<string, string>;
  /**
   * Request body data
   * For POST, PUT, PATCH requests
   */
  data?: any;
  /**
   * Query parameters
   */
  params?: Record<string, any>;
  /**
   * Request timeout in milliseconds
   */
  timeout?: number;
  /**
   * Whether to send credentials (cookies)
   * @default false
   */
  withCredentials?: boolean;
  /**
   * Data transformation function
   * Transform request data before sending
   */
  transformRequest?: string;
  /**
   * Response transformation function
   * Transform response data after receiving
   */
  transformResponse?: string;
}

/**
 * API configuration for components
 */
export interface APIConfig {
  /**
   * API request configuration
   */
  request?: APIRequest;
  /**
   * Success handler
   * JavaScript expression or function name
   */
  onSuccess?: string;
  /**
   * Error handler
   * JavaScript expression or function name
   */
  onError?: string;
  /**
   * Loading indicator
   * Whether to show loading state during request
   * @default true
   */
  showLoading?: boolean;
  /**
   * Success message to display
   */
  successMessage?: string;
  /**
   * Error message to display
   */
  errorMessage?: string;
  /**
   * Whether to reload data after success
   * @default false
   */
  reload?: boolean;
  /**
   * Whether to redirect after success
   */
  redirect?: string;
  /**
   * Whether to close dialog/modal after success
   * @default false
   */
  close?: boolean;
  /**
   * Retry configuration
   */
  retry?: {
    /**
     * Maximum retry attempts
     */
    maxAttempts?: number;
    /**
     * Delay between retries in milliseconds
     */
    delay?: number;
    /**
     * HTTP status codes to retry
     */
    retryOn?: number[];
  };
  /**
   * Cache configuration
   */
  cache?: {
    /**
     * Cache key
     */
    key?: string;
    /**
     * Cache duration in milliseconds
     */
    duration?: number;
    /**
     * Whether to use stale cache while revalidating
     */
    staleWhileRevalidate?: boolean;
  };
}

/**
 * Event handler configuration
 */
export interface EventHandler {
  /**
   * Event type
   */
  event: string;
  /**
   * Handler type
   */
  type: 'action' | 'api' | 'script' | 'navigation' | 'dialog' | 'toast' | 'custom';
  /**
   * Action configuration (for type: 'action')
   */
  action?: {
    /**
     * Action name/identifier
     */
    name: string;
    /**
     * Action parameters
     */
    params?: Record<string, any>;
  };
  /**
   * API configuration (for type: 'api')
   */
  api?: APIConfig;
  /**
   * Script to execute (for type: 'script')
   * JavaScript code as string
   */
  script?: string;
  /**
   * Navigation target (for type: 'navigation')
   */
  navigate?: {
    /**
     * Target URL or route
     */
    to: string;
    /**
     * Navigation type
     */
    type?: 'push' | 'replace' | 'reload';
    /**
     * Query parameters
     */
    params?: Record<string, any>;
    /**
     * Open in new window/tab
     */
    external?: boolean;
  };
  /**
   * Dialog configuration (for type: 'dialog')
   */
  dialog?: {
    /**
     * Dialog type
     */
    type: 'alert' | 'confirm' | 'prompt' | 'modal';
    /**
     * Dialog title
     */
    title?: string;
    /**
     * Dialog content
     */
    content?: string | BaseSchema;
    /**
     * Dialog actions
     */
    actions?: Array<{
      label: string;
      handler?: EventHandler;
    }>;
  };
  /**
   * Toast configuration (for type: 'toast')
   */
  toast?: {
    /**
     * Toast type
     */
    type: 'success' | 'error' | 'warning' | 'info';
    /**
     * Toast message
     */
    message: string;
    /**
     * Toast duration in milliseconds
     */
    duration?: number;
  };
  /**
   * Condition for executing handler
   * JavaScript expression
   */
  condition?: string;
  /**
   * Whether to prevent default event behavior
   */
  preventDefault?: boolean;
  /**
   * Whether to stop event propagation
   */
  stopPropagation?: boolean;
  /**
   * Debounce delay in milliseconds
   */
  debounce?: number;
  /**
   * Throttle delay in milliseconds
   */
  throttle?: number;
}

/**
 * Component with event handlers
 */
export interface EventableSchema extends BaseSchema {
  /**
   * Event handlers configuration
   */
  events?: EventHandler[];
  /**
   * Click handler
   */
  onClick?: EventHandler | string;
  /**
   * Change handler
   */
  onChange?: EventHandler | string;
  /**
   * Submit handler
   */
  onSubmit?: EventHandler | string;
  /**
   * Focus handler
   */
  onFocus?: EventHandler | string;
  /**
   * Blur handler
   */
  onBlur?: EventHandler | string;
  /**
   * Mouse enter handler
   */
  onMouseEnter?: EventHandler | string;
  /**
   * Mouse leave handler
   */
  onMouseLeave?: EventHandler | string;
  /**
   * Key down handler
   */
  onKeyDown?: EventHandler | string;
  /**
   * Key up handler
   */
  onKeyUp?: EventHandler | string;
}

/**
 * Data fetching configuration
 */
export interface DataFetchConfig {
  /**
   * Data source API
   */
  api: string | APIRequest;
  /**
   * Whether to fetch on mount
   * @default true
   */
  fetchOnMount?: boolean;
  /**
   * Polling interval in milliseconds
   * If set, data will be refetched at this interval
   */
  pollInterval?: number;
  /**
   * Dependencies for refetching
   * Array of variable names to watch
   */
  dependencies?: string[];
  /**
   * Default data before fetch completes
   */
  defaultData?: any;
  /**
   * Transform function for fetched data
   * JavaScript expression or function name
   */
  transform?: string;
  /**
   * Filter function for data
   * JavaScript expression or function name
   */
  filter?: string;
  /**
   * Sort configuration
   */
  sort?: {
    /**
     * Field to sort by
     */
    field: string;
    /**
     * Sort order
     */
    order: 'asc' | 'desc';
  };
  /**
   * Pagination configuration
   */
  pagination?: {
    /**
     * Current page
     */
    page?: number;
    /**
     * Page size
     */
    pageSize?: number;
    /**
     * Whether pagination is enabled
     */
    enabled?: boolean;
  };
}

/**
 * Component with data fetching
 */
export interface DataFetchableSchema extends BaseSchema {
  /**
   * Data fetching configuration
   */
  dataSource?: DataFetchConfig;
  /**
   * Loading state
   */
  loading?: boolean;
  /**
   * Error state
   */
  error?: string | null;
  /**
   * Fetched data
   */
  data?: any;
}

/**
 * Expression evaluation context
 */
export interface ExpressionContext {
  /**
   * Current component data
   */
  data?: any;
  /**
   * Global application state
   */
  state?: any;
  /**
   * Form values (when in form context)
   */
  form?: any;
  /**
   * Current user information
   */
  user?: any;
  /**
   * Environment variables
   */
  env?: Record<string, any>;
  /**
   * Utility functions
   */
  utils?: Record<string, (...args: any[]) => any>;
}

/**
 * Expression schema for dynamic values
 */
export interface ExpressionSchema {
  /**
   * Expression type
   */
  type: 'expression';
  /**
   * Expression string
   * Supports ${} syntax for variable interpolation
   */
  value: string;
  /**
   * Default value if expression fails
   */
  defaultValue?: any;
  /**
   * Whether to watch and re-evaluate on context changes
   * @default true
   */
  reactive?: boolean;
}

/**
 * Union type of all API schemas
 */
export type APISchema =
  | EventableSchema
  | DataFetchableSchema
  | ExpressionSchema;
