/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/core - Action Runner
 * 
 * Executes actions defined in ActionSchema and EventHandler.
 * Supports all spec v0.7.1 action types: script, url, modal, flow, api.
 * Features: conditional execution, confirmation, toast notifications,
 * redirect handling, action chaining, custom handler registration.
 */

import { ExpressionEvaluator } from '../evaluator/ExpressionEvaluator';

export interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
  reload?: boolean;
  close?: boolean;
  redirect?: string;
  /** Modal schema to render (for type: 'modal') */
  modal?: any;
}

export interface ActionContext {
  data?: Record<string, any>;
  record?: any;
  selectedRecords?: Record<string, any>[];
  user?: any;
  [key: string]: any;
}

/**
 * API configuration for complex requests.
 */
export interface ApiConfig {
  /** API endpoint URL */
  url: string;
  /** HTTP method */
  method?: string;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body (will be JSON-stringified if object) */
  body?: any;
  /** Query parameters */
  queryParams?: Record<string, string>;
  /** Response type */
  responseType?: 'json' | 'text' | 'blob';
}

/**
 * Action definition accepted by the runner.
 * Compatible with both UIActionSchema (spec v0.7.1) and legacy crud.ts ActionSchema.
 */
export interface ActionDef {
  /** Action type identifier: 'script' | 'url' | 'modal' | 'flow' | 'api' | 'navigation' | custom */
  type?: string;
  /** Legacy action type field */
  actionType?: string;
  /** Action name (from UIActionSchema) */
  name?: string;
  /** Display label */
  label?: string;
  /** Confirmation text — shows a confirm dialog before executing */
  confirmText?: string;
  /** Structured confirmation (from crud.ts) */
  confirm?: { title?: string; message?: string; confirmText?: string; cancelText?: string };
  /** Condition expression — if falsy, skip action */
  condition?: string;
  /** Disabled expression — if truthy, skip action */
  disabled?: string | boolean;
  /** API endpoint (string URL or complex config) */
  api?: string | ApiConfig;
  /** API endpoint URL (spec v0.7.1 alias) */
  endpoint?: string;
  /** HTTP method */
  method?: string;
  /** Navigation target */
  navigate?: any;
  /** onClick callback (legacy) */
  onClick?: () => void | Promise<void>;
  /** Whether to reload data after success */
  reload?: boolean;
  /** Whether to close dialog after success */
  close?: boolean;
  /** Redirect URL expression */
  redirect?: string;
  /** Toast configuration */
  toast?: { showOnSuccess?: boolean; showOnError?: boolean; duration?: number };
  /** Success message (from UIActionSchema) */
  successMessage?: string;
  /** Error message (from UIActionSchema) */
  errorMessage?: string;
  /** Whether to refresh data after execution (from UIActionSchema) */
  refreshAfter?: boolean;
  /** Params object (for custom handlers) */
  params?: Record<string, any>;
  /** ActionParam definitions to collect from user before execution (from spec ActionSchema.params) */
  actionParams?: ActionParamDef[];
  /** Script/expression to execute (for type: 'script') */
  execute?: string;
  /** Target URL or identifier (for type: 'url', 'modal', 'flow') */
  target?: string;
  /** Modal schema to open (for type: 'modal') */
  modal?: any;
  /** Chained actions to execute after this one */
  chain?: ActionDef[];
  /** Chain execution mode */
  chainMode?: 'sequential' | 'parallel';
  /** Callback on success */
  onSuccess?: ActionDef | ActionDef[];
  /** Callback on failure */
  onFailure?: ActionDef | ActionDef[];
  /** Any additional properties */
  [key: string]: any;
}

export type ActionHandler = (
  action: ActionDef,
  context: ActionContext
) => Promise<ActionResult> | ActionResult;

/**
 * Confirmation handler — replaces window.confirm.
 * Consumers can provide an async implementation (e.g., Shadcn AlertDialog).
 */
export type ConfirmationHandler = (message: string, options?: {
  title?: string;
  confirmText?: string;
  cancelText?: string;
}) => Promise<boolean>;

/**
 * Toast handler — consumers can wire to Sonner or any toast library.
 */
export type ToastHandler = (message: string, options?: {
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}) => void;

/**
 * Modal handler — consumers provide to render modal dialogs.
 */
export type ModalHandler = (schema: any, context: ActionContext) => Promise<ActionResult>;

/**
 * Navigation handler — consumers provide for SPA-aware routing.
 */
export type NavigationHandler = (url: string, options?: {
  external?: boolean;
  newTab?: boolean;
  replace?: boolean;
}) => void;

/**
 * Param collection handler — consumers provide to show a dialog
 * for collecting ActionParam values before action execution.
 * Returns collected values, or null if cancelled.
 */
export type ParamCollectionHandler = (params: ActionParamDef[]) => Promise<Record<string, any> | null>;

/**
 * ActionParam definition accepted by the runner.
 * Compatible with @objectstack/spec ActionParam.
 */
export interface ActionParamDef {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
  defaultValue?: unknown;
  helpText?: string;
  placeholder?: string;
  validation?: string;
}

export class ActionRunner {
  private handlers = new Map<string, ActionHandler>();
  private evaluator: ExpressionEvaluator;
  private context: ActionContext;
  private confirmHandler: ConfirmationHandler;
  private toastHandler: ToastHandler | null;
  private modalHandler: ModalHandler | null;
  private navigationHandler: NavigationHandler | null;
  private paramCollectionHandler: ParamCollectionHandler | null;

  constructor(context: ActionContext = {}) {
    this.context = context;
    this.evaluator = new ExpressionEvaluator(context);
    // Default confirmation: window.confirm (can be overridden)
    this.confirmHandler = async (message: string) => window.confirm(message);
    this.toastHandler = null;
    this.modalHandler = null;
    this.navigationHandler = null;
    this.paramCollectionHandler = null;
  }

  /**
   * Set a custom confirmation handler (e.g., Shadcn AlertDialog).
   */
  setConfirmHandler(handler: ConfirmationHandler): void {
    this.confirmHandler = handler;
  }

  /**
   * Set a custom toast handler (e.g., Sonner).
   */
  setToastHandler(handler: ToastHandler): void {
    this.toastHandler = handler;
  }

  /**
   * Set a modal handler (e.g., render a Dialog via React state).
   */
  setModalHandler(handler: ModalHandler): void {
    this.modalHandler = handler;
  }

  /**
   * Set a navigation handler (e.g., React Router navigate).
   */
  setNavigationHandler(handler: NavigationHandler): void {
    this.navigationHandler = handler;
  }

  /**
   * Set a param collection handler — shows a dialog to collect
   * ActionParam values before action execution.
   */
  setParamCollectionHandler(handler: ParamCollectionHandler): void {
    this.paramCollectionHandler = handler;
  }

  registerHandler(actionName: string, handler: ActionHandler): void {
    this.handlers.set(actionName, handler);
  }

  unregisterHandler(actionName: string): void {
    this.handlers.delete(actionName);
  }

  async execute(action: ActionDef): Promise<ActionResult> {
    try {
      // Resolve the action type
      const actionType = action.type || action.actionType || action.name || '';

      // Conditional execution
      if (action.condition) {
        const shouldExecute = this.evaluator.evaluateCondition(action.condition);
        if (!shouldExecute) {
          return { success: false, error: 'Action condition not met' };
        }
      }

      if (action.disabled) {
        const isDisabled = typeof action.disabled === 'string'
          ? this.evaluator.evaluateCondition(action.disabled)
          : action.disabled;
        
        if (isDisabled) {
          return { success: false, error: 'Action is disabled' };
        }
      }

      // Confirmation (structured or simple)
      const confirmMessage = action.confirm?.message || action.confirmText;
      if (confirmMessage) {
        const confirmed = await this.confirmHandler(
          this.evaluator.evaluate(confirmMessage) as string,
          action.confirm ? {
            title: action.confirm.title,
            confirmText: action.confirm.confirmText,
            cancelText: action.confirm.cancelText,
          } : undefined,
        );
        if (!confirmed) {
          return { success: false, error: 'Action cancelled by user' };
        }
      }

      // Param collection: if the action defines ActionParam[] to collect,
      // show a dialog to gather user input before executing.
      if (action.actionParams && Array.isArray(action.actionParams) && action.actionParams.length > 0) {
        if (this.paramCollectionHandler) {
          const collected = await this.paramCollectionHandler(action.actionParams);
          if (collected === null) {
            return { success: false, error: 'Action cancelled by user (params)' };
          }
          // Merge collected params into action.params
          action.params = { ...(action.params || {}), ...collected };
        }
      }

      // Check for a registered custom handler first
      if (actionType && this.handlers.has(actionType)) {
        const handler = this.handlers.get(actionType)!;
        const result = await handler(action, this.context);
        await this.handlePostExecution(action, result);
        return result;
      }

      // Built-in action execution by type
      let result: ActionResult;

      switch (actionType) {
        case 'script':
          result = await this.executeScript(action);
          break;
        case 'url':
          result = await this.executeUrl(action);
          break;
        case 'modal':
          result = await this.executeModal(action);
          break;
        case 'flow':
          result = await this.executeFlow(action);
          break;
        case 'api':
          result = await this.executeAPI(action);
          break;
        case 'navigation':
          result = await this.executeNavigation(action);
          break;
        default:
          // Legacy fallback: check for navigate, api, or onClick
          if (action.navigate) {
            result = await this.executeNavigation(action);
          } else if (action.api || action.endpoint) {
            result = await this.executeAPI(action);
          } else if (action.onClick) {
            await action.onClick();
            result = { success: true };
          } else {
            result = await this.executeActionSchema(action);
          }
      }

      await this.handlePostExecution(action, result);
      return result;
    } catch (error) {
      const result: ActionResult = { success: false, error: (error as Error).message };
      await this.handlePostExecution(action, result);
      return result;
    }
  }

  /**
   * Execute multiple actions in sequence or parallel.
   */
  async executeChain(
    actions: ActionDef[],
    mode: 'sequential' | 'parallel' = 'sequential'
  ): Promise<ActionResult> {
    if (actions.length === 0) {
      return { success: true };
    }

    if (mode === 'parallel') {
      const results = await Promise.allSettled(
        actions.map(a => this.execute(a))
      );
      const failures = results.filter(
        r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
      );
      if (failures.length > 0) {
        const firstFail = results.find(
          r => r.status === 'fulfilled' && !r.value.success
        ) as PromiseFulfilledResult<ActionResult> | undefined;
        return {
          success: false,
          error: firstFail?.value?.error || 'One or more parallel actions failed',
        };
      }
      const lastResult = results[results.length - 1];
      return lastResult.status === 'fulfilled'
        ? lastResult.value
        : { success: false, error: 'Action failed' };
    }

    // Sequential execution — stop on first failure
    let lastResult: ActionResult = { success: true };
    for (const action of actions) {
      lastResult = await this.execute(action);
      if (!lastResult.success) {
        return lastResult;
      }
    }
    return lastResult;
  }

  /**
   * Post-execution: emit toast notifications, handle chaining, callbacks.
   */
  private async handlePostExecution(action: ActionDef, result: ActionResult): Promise<void> {
    // Toast notifications
    if (this.toastHandler) {
      const showToast = action.toast ?? { showOnSuccess: true, showOnError: true };
      const duration = action.toast?.duration;

      if (result.success && showToast.showOnSuccess !== false) {
        const message = action.successMessage || 'Action completed successfully';
        this.toastHandler(message, { type: 'success', duration });
      }

      if (!result.success && showToast.showOnError !== false && result.error) {
        const message = action.errorMessage || result.error;
        this.toastHandler(message, { type: 'error', duration });
      }
    }

    // Apply refreshAfter from UIActionSchema
    if (action.refreshAfter && result.success) {
      result.reload = true;
    }

    // Execute chained actions
    if (action.chain && action.chain.length > 0 && result.success) {
      const chainResult = await this.executeChain(
        action.chain,
        action.chainMode || 'sequential'
      );
      // Merge chain result
      if (!chainResult.success) {
        result.success = false;
        result.error = chainResult.error;
      }
      if (chainResult.data) result.data = chainResult.data;
      if (chainResult.redirect) result.redirect = chainResult.redirect;
      if (chainResult.reload) result.reload = true;
    }

    // Execute onSuccess/onFailure callbacks
    if (result.success && action.onSuccess) {
      const callbacks = Array.isArray(action.onSuccess) ? action.onSuccess : [action.onSuccess];
      await this.executeChain(callbacks, 'sequential');
    }
    if (!result.success && action.onFailure) {
      const callbacks = Array.isArray(action.onFailure) ? action.onFailure : [action.onFailure];
      await this.executeChain(callbacks, 'sequential');
    }
  }

  /**
   * Execute script action — evaluates client-side expression via ExpressionEvaluator.
   * Supports ${} template expressions referencing data, record, user context.
   */
  private async executeScript(action: ActionDef): Promise<ActionResult> {
    const script = action.execute || action.target;
    if (!script) {
      return { success: false, error: 'No script provided for script action' };
    }

    try {
      const result = this.evaluator.evaluate(`\${${script}}`);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: `Script execution failed: ${(error as Error).message}` };
    }
  }

  /**
   * Execute URL action — navigate to a URL.
   * Uses navigationHandler for SPA routing, falls back to window.location.
   */
  private async executeUrl(action: ActionDef): Promise<ActionResult> {
    const rawUrl = action.target || action.redirect;
    if (!rawUrl) {
      return { success: false, error: 'No URL provided for url action' };
    }

    const url = this.evaluator.evaluate(rawUrl) as string;

    if (!this.isValidUrl(url)) {
      return {
        success: false,
        error: 'Invalid URL scheme. Only http://, https://, and relative URLs are allowed.',
      };
    }

    const isExternal = url.startsWith('http://') || url.startsWith('https://');
    const newTab = action.params?.newTab ?? isExternal;

    if (this.navigationHandler) {
      this.navigationHandler(url, { external: isExternal, newTab });
      return { success: true };
    }

    if (newTab) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      return { success: true, redirect: url };
    }

    return { success: true };
  }

  /**
   * Execute modal action — open a dialog.
   * Delegates to the registered modalHandler; returns modal schema if no handler.
   */
  private async executeModal(action: ActionDef): Promise<ActionResult> {
    const modalSchema = action.modal || action.target || action.params?.schema;
    if (!modalSchema) {
      return { success: false, error: 'No modal schema or target provided for modal action' };
    }

    if (this.modalHandler) {
      return await this.modalHandler(modalSchema, this.context);
    }

    // Return the modal schema for the consumer to render
    return { success: true, modal: modalSchema };
  }

  /**
   * Execute flow action — trigger a workflow/automation.
   * Delegates to a registered 'flow' handler; otherwise returns not-implemented.
   */
  private async executeFlow(action: ActionDef): Promise<ActionResult> {
    const flowName = action.target || action.name;
    if (!flowName) {
      return { success: false, error: 'No flow target provided for flow action' };
    }

    // Check for a registered flow handler (consumers register via registerHandler)
    if (this.handlers.has('flow')) {
      const handler = this.handlers.get('flow')!;
      return await handler(action, this.context);
    }

    return {
      success: false,
      error: `Flow handler not registered. Cannot execute flow: ${flowName}`,
    };
  }

  private async executeActionSchema(action: ActionDef): Promise<ActionResult> {
    const result: ActionResult = { success: true };

    if (action.api || action.endpoint) {
      const apiResult = await this.executeAPI(action);
      if (!apiResult.success) return apiResult;
      result.data = apiResult.data;
    }

    if (action.onClick) {
      await action.onClick();
    }

    result.reload = action.reload !== false;
    result.close = action.close !== false;

    if (action.redirect) {
      result.redirect = this.evaluator.evaluate(action.redirect) as string;
    }

    return result;
  }

  /**
   * Execute navigation action
   */
  private async executeNavigation(action: ActionDef): Promise<ActionResult> {
    const nav = action.navigate || action;
    const to = this.evaluator.evaluate(nav.to || nav.target) as string;

    if (!this.isValidUrl(to)) {
      return {
        success: false,
        error: 'Invalid URL scheme. Only http://, https://, and relative URLs are allowed.',
      };
    }

    const isExternal = nav.external || (typeof to === 'string' && (
      to.startsWith('http://') || to.startsWith('https://')
    ));

    if (this.navigationHandler) {
      this.navigationHandler(to, {
        external: isExternal,
        newTab: nav.newTab ?? isExternal,
        replace: nav.replace,
      });
      return { success: true };
    }

    if (isExternal) {
      window.open(to, '_blank', 'noopener,noreferrer');
    } else {
      return { success: true, redirect: to };
    }

    return { success: true };
  }

  /**
   * Execute API action — supports both simple string endpoint and complex ApiConfig.
   */
  private async executeAPI(action: ActionDef): Promise<ActionResult> {
    // Resolve the endpoint: api (string/object), endpoint, or target
    const apiConfig = action.api || action.endpoint || action.target;

    if (!apiConfig) {
      return { success: false, error: 'No API endpoint provided' };
    }

    try {
      let url: string;
      let method: string;
      let headers: Record<string, string> = { 'Content-Type': 'application/json' };
      let body: any = undefined;
      let responseType: 'json' | 'text' | 'blob' = 'json';

      if (typeof apiConfig === 'string') {
        // Simple string endpoint
        url = apiConfig;
        method = action.method || 'POST';
        body = JSON.stringify(action.params || this.context.data || {});
      } else {
        // Complex ApiConfig
        const config = apiConfig as ApiConfig;
        url = config.url;
        method = config.method || action.method || 'POST';
        headers = { ...headers, ...config.headers };
        responseType = config.responseType || 'json';

        // Build query params
        if (config.queryParams) {
          const searchParams = new URLSearchParams(config.queryParams);
          url = `${url}${url.includes('?') ? '&' : '?'}${searchParams.toString()}`;
        }

        // Build body
        if (config.body) {
          body = typeof config.body === 'string'
            ? config.body
            : JSON.stringify(config.body);
        } else if (method !== 'GET' && method !== 'HEAD') {
          body = JSON.stringify(action.params || this.context.data || {});
        }
      }

      const fetchInit: RequestInit = { method, headers };
      if (body && method !== 'GET' && method !== 'HEAD') {
        fetchInit.body = body;
      }

      const response = await fetch(url, fetchInit);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      let data: any;
      switch (responseType) {
        case 'text':
          data = await response.text();
          break;
        case 'blob':
          data = await response.blob();
          break;
        default:
          data = await response.json();
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Validate URL to prevent javascript: or data: protocol injection.
   */
  private isValidUrl(url: unknown): boolean {
    return typeof url === 'string' && (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('/') ||
      url.startsWith('./')
    );
  }

  updateContext(newContext: Partial<ActionContext>): void {
    this.context = { ...this.context, ...newContext };
    this.evaluator.updateContext(newContext);
  }

  getContext(): ActionContext {
    return this.context;
  }

  /**
   * Get the expression evaluator (for components that need to evaluate visibility, etc.)
   */
  getEvaluator(): ExpressionEvaluator {
    return this.evaluator;
  }
}

/**
 * Convenience function to execute a single action with a one-off runner.
 */
export async function executeAction(
  action: ActionDef,
  context: ActionContext = {}
): Promise<ActionResult> {
  const runner = new ActionRunner(context);
  return await runner.execute(action);
}
