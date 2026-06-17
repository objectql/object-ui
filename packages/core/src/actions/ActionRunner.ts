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
 * Supports all spec v2.0.1 action types: script, url, modal, flow, api.
 * Features: conditional execution, confirmation, toast notifications,
 * redirect handling, action chaining, custom handler registration.
 */

import { ExpressionEvaluator } from '../evaluator/ExpressionEvaluator';
import { globalUndoManager, type UndoableOperation } from './UndoManager';

export interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
  reload?: boolean;
  close?: boolean;
  redirect?: string;
  /** Modal schema to render (for type: 'modal') */
  modal?: any;
  /**
   * Suppress the automatic success toast for this result. A handler sets this
   * when the action only HANDED OFF to a follow-up UI rather than completing —
   * e.g. a `flow` action that paused at a screen and opened the flow-runner. The
   * action hasn't "completed yet", so a "success" toast on open would be
   * misleading; the follow-up surface owns its own completion messaging.
   */
  silent?: boolean;
  /**
   * An undoable operation captured by the handler (e.g. an `undoable` update
   * action's prior field values). When present, the runner pushes it onto the
   * global UndoManager and the success toast offers an "Undo" affordance.
   */
  undo?: UndoableOperation;
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
 * Compatible with both UIActionSchema (spec v2.0.1) and legacy crud.ts ActionSchema.
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
  /** API endpoint URL (spec v2.0.1 alias) */
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
  /** Single-record update actions: offer an Undo affordance on success. */
  undoable?: boolean;
  /** Params object (for custom handlers) */
  params?: Record<string, any>;
  /** ActionParam definitions to collect from user before execution (from spec ActionSchema.params) */
  actionParams?: ActionParamDef[];
  /**
   * Result dialog spec — when present and the action succeeds, the runner
   * suppresses the successMessage toast and asks the consumer to open a
   * reveal dialog rendering `result.data` (see ResultDialogSpec).
   */
  resultDialog?: ResultDialogSpec;
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
  /** When true, the runner pre-opens about:blank synchronously on click so the
   *  handler can drive it to a returned `redirectUrl` after an awaited fetch
   *  without tripping popup blockers. Used by actions like `sso_as_owner`. */
  opensInNewTab?: boolean;
  /** Zero-roundtrip new-tab target: a path template (`{recordId}` placeholder)
   *  the handler navigates the pre-opened tab to IMMEDIATELY on click, skipping
   *  the action POST entirely. Only valid with `opensInNewTab`; the endpoint
   *  must perform all auth/authz itself (e.g. the cloud `/sso-open` endpoint,
   *  which re-runs every check the POST half would have done). */
  newTabUrl?: string;
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
  /** When set, the toast offers an "Undo" affordance (the runner has already
   *  pushed the operation onto the global UndoManager). */
  undo?: { label?: string };
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
export type ParamCollectionHandler = (
  params: ActionParamDef[],
  action?: ActionDef,
) => Promise<Record<string, any> | null>;

/**
 * Result dialog spec — declarative description of how to render a
 * one-shot reveal of an action's API response. Mirrors
 * `Action.resultDialog` in @objectstack/spec.
 *
 * When set on an action and the action succeeds, the runner suppresses
 * the success toast and awaits a ResultDialogHandler instead. Used for
 * values the user must copy NOW (2FA secret, OAuth client_secret, backup
 * codes).
 */
export interface ResultDialogFieldSpec {
  path: string;
  label?: string;
  format?: 'qrcode' | 'code-list' | 'secret' | 'text' | 'json';
}
export interface ResultDialogSpec {
  title?: string;
  description?: string;
  acknowledge?: string;
  format?: 'qrcode' | 'code-list' | 'secret' | 'text' | 'json';
  fields?: ResultDialogFieldSpec[];
}

/**
 * Result dialog handler — consumers provide to render the post-success
 * reveal dialog. Returns a promise that resolves when the user
 * acknowledges. Errors / rejections are treated as acknowledge for
 * cleanup purposes (the action already succeeded).
 */
export type ResultDialogHandler = (
  spec: ResultDialogSpec,
  data: unknown,
  action?: ActionDef,
) => Promise<void>;

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

  // ── Lookup-/reference-type metadata ───────────────────────────────
  // Populated by `resolveActionParams()` when a field-backed param resolves
  // to a `lookup` or `reference` field. Forwarded to `<LookupField>` inside
  // `ActionParamDialog` so the user gets a real record picker (popover +
  // RecordPickerDialog) instead of a plain text input.
  /** Object name the lookup picker queries (`reference_to` on the field). */
  referenceTo?: string;
  /** Field on the referenced record used as the human label (default `name`). */
  displayField?: string;
  /** Field used as the option value (default `id`). */
  idField?: string;
  /** Optional secondary line shown under the label in the picker. */
  descriptionField?: string;
  /** Allow multi-select (renders chip list). */
  multiple?: boolean;
  /** Template (e.g. `{first_name} {last_name}`) used to build the label. */
  titleFormat?: string;
  /** Column definitions surfaced in the enterprise `RecordPickerDialog`. */
  lookupColumns?: unknown[];
  /** Server-side filters applied when querying lookup candidates. */
  lookupFilters?: unknown[];
  /** Page size for the typeahead popover. */
  lookupPageSize?: number;
  /** Form-field dependencies that gate / parameterise the picker query. */
  dependsOn?: unknown[];
}

export class ActionRunner {
  private handlers = new Map<string, ActionHandler>();
  private scripts = new Map<string, ActionHandler>();
  private evaluator: ExpressionEvaluator;
  private context: ActionContext;
  private confirmHandler: ConfirmationHandler;
  private toastHandler: ToastHandler | null;
  private modalHandler: ModalHandler | null;
  private navigationHandler: NavigationHandler | null;
  private paramCollectionHandler: ParamCollectionHandler | null;
  private resultDialogHandler: ResultDialogHandler | null;

  constructor(context: ActionContext = {}) {
    this.context = context;
    this.evaluator = new ExpressionEvaluator(context);
    // Default confirmation: window.confirm (can be overridden)
    this.confirmHandler = async (message: string) => window.confirm(message);
    this.toastHandler = null;
    this.modalHandler = null;
    this.navigationHandler = null;
    this.paramCollectionHandler = null;
    this.resultDialogHandler = null;
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

  /**
   * Set a result dialog handler — shows a one-shot reveal dialog after
   * a successful action whose spec declares `resultDialog`. Used for
   * values the user must copy now (2FA codes, OAuth client_secret).
   */
  setResultDialogHandler(handler: ResultDialogHandler): void {
    this.resultDialogHandler = handler;
  }

  registerHandler(actionName: string, handler: ActionHandler): void {
    this.handlers.set(actionName, handler);
  }

  unregisterHandler(actionName: string): void {
    this.handlers.delete(actionName);
  }

  /**
   * Register a named script handler. When a `script` action's
   * `target`/`execute` matches the registered name, the handler runs
   * instead of the expression evaluator. Lets dashboards/views wire
   * symbolic action names (e.g. 'export_dashboard_pdf') to JS callbacks.
   */
  registerScript(scriptName: string, handler: ActionHandler): void {
    this.scripts.set(scriptName, handler);
  }

  unregisterScript(scriptName: string): void {
    this.scripts.delete(scriptName);
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

      if (action.disabled != null && action.disabled !== false) {
        // `disabled` may be a boolean, a CEL string, or the normalized envelope
        // `{ dialect, source }` (what `objectstack build` emits). The previous
        // code only evaluated the STRING form and treated any object as truthy,
        // so an envelope-disabled action was ALWAYS "disabled" — silently
        // blocking every execution (param dialog never opened, handler never
        // ran). `evaluateCondition` already handles boolean/string/envelope;
        // and the renderers are authoritative for the visual disabled state, so
        // any eval failure here defaults to NOT-disabled (don't false-block).
        let isDisabled = false;
        try {
          isDisabled = this.evaluator.evaluateCondition(action.disabled as never);
        } catch {
          isDisabled = false;
        }
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
      // Spec defines this as `params: ActionParam[]`; ActionRunner historically
      // used `actionParams` to disambiguate from the static-params object that
      // some custom handlers consume. Accept both — when `params` is an array,
      // treat it as the input-collection definition.
      const paramDefs: ActionParamDef[] | undefined =
        action.actionParams && Array.isArray(action.actionParams) ? action.actionParams
          : (Array.isArray(action.params) ? (action.params as unknown as ActionParamDef[]) : undefined);
      if (paramDefs && paramDefs.length > 0) {
        if (this.paramCollectionHandler) {
          const collected = await this.paramCollectionHandler(paramDefs, action);
          if (collected === null) {
            return { success: false, error: 'Action cancelled by user (params)' };
          }
          // Merge collected params into action.params as a values map for downstream consumers.
          // Preserve any pre-attached row context (`_rowRecord`) used by list_item
          // actions so downstream handlers (apiHandler) can inject the row id.
          const priorParams: Record<string, any> = Array.isArray(action.params) ? {} : (action.params as Record<string, any> || {});
          const rowRecord = priorParams._rowRecord;
          action.params = { ...priorParams, ...collected };
          if (rowRecord !== undefined) (action.params as Record<string, any>)._rowRecord = rowRecord;
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
    // resultDialog SUPPRESSES the successMessage toast — these are one-shot
    // reveals (2FA codes, fresh OAuth secrets) where a toast would let the
    // user dismiss the value before copying it. The reveal dialog itself
    // requires explicit acknowledgement; we await it here so refreshAfter
    // / chain steps don't fire until the user closes the dialog.
    const hasResultDialog = !!(action.resultDialog && result.success);

    // Toast notifications
    if (this.toastHandler) {
      const showToast = action.toast ?? { showOnSuccess: true, showOnError: true };
      const duration = action.toast?.duration;

      if (result.success && !hasResultDialog && !result.silent && showToast.showOnSuccess !== false) {
        // Prefer a DYNAMIC message the server returned (result.data.message)
        // over the static action.successMessage. Server-driven actions like
        // check_app_updates / publish / install compute a real outcome
        // ("2 app updates available: CRM 1.0.0→1.0.1", "Published v1.2.0")
        // that the static label can't express; without this the user only ever
        // sees a generic "Done". Falls back to the static label, then a default.
        const dyn = (result.data && typeof result.data === 'object'
          && typeof (result.data as { message?: unknown }).message === 'string')
          ? String((result.data as { message?: unknown }).message).trim()
          : '';
        const message = dyn || action.successMessage || 'Action completed successfully';
        // Undoable action: register the captured operation on the global
        // UndoManager and surface an "Undo" affordance on the toast (the
        // consumer's toast handler wires the button to UndoManager).
        if (result.undo) {
          try { globalUndoManager.push(result.undo); } catch { /* non-fatal */ }
        }
        this.toastHandler(message, { type: 'success', duration, undo: result.undo ? {} : undefined });
      }

      if (!result.success && showToast.showOnError !== false && result.error) {
        const message = action.errorMessage || result.error;
        this.toastHandler(message, { type: 'error', duration });
      }
    }

    // Open the reveal dialog. If no handler is registered we still mark the
    // execution successful but log — better to lose the value visibility
    // than to silently re-toast and dismiss it.
    if (hasResultDialog) {
      if (this.resultDialogHandler) {
        try {
          await this.resultDialogHandler(action.resultDialog!, result.data, action);
        } catch (err) {
          // Acknowledgement failure is non-fatal; the underlying action already
          // succeeded. Log so consumers can wire it through their error reporter.
          // eslint-disable-next-line no-console
          console.warn('[ActionRunner] resultDialog handler rejected; treating as acknowledged', err);
        }
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          '[ActionRunner] action.resultDialog set but no resultDialogHandler registered — the response value will not be shown to the user.',
          { action: action.name, data: result.data }
        );
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

    // Named script registry wins over the expression evaluator. This lets
    // dashboards/views bind a symbolic action name (e.g. 'export_dashboard_pdf')
    // to a JS callback without piping the literal through ExpressionEvaluator.
    const named = this.scripts.get(script);
    if (named) {
      try {
        return await named(action, this.context);
      } catch (error) {
        return { success: false, error: `Script execution failed: ${(error as Error).message}` };
      }
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

    // Apply target ${param.X} / ${ctx.X} interpolation FIRST — the
    // ExpressionEvaluator that follows would otherwise see unresolved
    // `param.provider` and either error or substitute undefined. Doing it
    // here also URL-encodes values (required for query-position params
    // like `?provider=foo+bar`).
    const interpolated = this.interpolateTarget(rawUrl, action);
    let url = this.evaluator.evaluate(interpolated) as string;

    if (!this.isValidUrl(url)) {
      return {
        success: false,
        error: 'Invalid URL scheme. Only http://, https://, and relative URLs are allowed.',
      };
    }

    // Promote same-origin-style `/api/...` paths to absolute when an
    // `apiBase` is provided in context (typical of split SPA + backend
    // dev setups). Without this, `window.location.href = "/api/..."`
    // hits the SPA host (e.g. Vite at :5173), the router has no match,
    // and the browser silently falls back to the home page instead of
    // following better-auth's 302 to the IdP.
    const apiBase = typeof this.context.apiBase === 'string' ? this.context.apiBase.replace(/\/+$/, '') : '';
    if (apiBase && /^\/(api|_auth|_account)\//.test(url)) {
      url = `${apiBase}${url}`;
    }

    const isExternal = url.startsWith('http://') || url.startsWith('https://');
    // Same-origin API endpoints (most commonly the auth provider's
    // `/api/v1/auth/sign-in/social` redirect dance) issue server-side
    // 302s that must be followed by the *browser*, not the SPA router.
    // Pushing `/api/...` into React Router lands on no matching route
    // and silently falls back to the default page, so the OAuth flow
    // never starts. Short-circuit to a full-page navigation here.
    // For absolute URLs (now also produced by the apiBase prefix above),
    // we need full-page navigation for any URL that is going to issue a
    // server-side redirect dance — better-auth's `/sign-in/social` is the
    // canonical case. Detect "looks like a same-origin API path" both for
    // bare-relative input AND for the apiBase-prefixed form.
    const isApiCall = /\/(api|_auth|_account)\//.test(url) && (isExternal || url.startsWith('/'));
    if (isApiCall) {
      window.location.href = url;
      return { success: true };
    }
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
        url = this.interpolateTarget(apiConfig, action);
        method = action.method || 'POST';
        body = JSON.stringify(action.params || this.context.data || {});
      } else {
        // Complex ApiConfig
        const config = apiConfig as ApiConfig;
        url = this.interpolateTarget(config.url, action);
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

  /**
   * Substitute `${param.X}` and `${ctx.X}` tokens in an action target.
   *
   * Used by executeUrl and executeAPI so metadata can produce dynamic
   * URLs without coupling to the wider ExpressionEvaluator surface
   * (which would also evaluate operators, member access, etc. — overkill
   * and unsafe for URL-position values).
   *
   * Every substituted value is `encodeURIComponent`'d, since the only
   * legitimate use case so far (better-auth `/sign-in/social?provider=…`)
   * places interpolated values in URL query positions. Callers MUST
   * therefore put tokens after a `?` or `&` — using `${param.x}` inside a
   * path segment will produce percent-encoded slashes, which is the
   * correct behaviour for opaque IDs but would break a literal path
   * fragment.
   *
   * `ctx.origin`, `ctx.user.*`, `ctx.org.*`, `ctx.recordId` are surfaced
   * implicitly from the runner's ActionContext + window. Consumers can
   * extend by stuffing extra keys under `context.ctx = {...}` before
   * calling `runner.execute()`.
   */
  private interpolateTarget(target: string, action: ActionDef): string {
    if (typeof target !== 'string' || target.indexOf('${') === -1) return target;
    const params = (action.params && typeof action.params === 'object' && !Array.isArray(action.params))
      ? (action.params as Record<string, unknown>)
      : {};
    const ctx = this.buildInterpolationContext();
    return target.replace(/\$\{(param|ctx)\.([\w.]+)\}/g, (_match, scope: string, path: string) => {
      const root = scope === 'param' ? params : ctx;
      const value = readPath(root, path);
      if (value == null) return '';
      return encodeURIComponent(String(value));
    });
  }

  /**
   * Assemble the `ctx` namespace exposed to target interpolation.
   * Built-in keys: origin, user, org, recordId. Anything the consumer
   * placed under context.ctx is merged on top.
   */
  private buildInterpolationContext(): Record<string, unknown> {
    const ctx: Record<string, unknown> = {
      origin: typeof window !== 'undefined' ? window.location.origin : '',
      // Backend API origin (typically `import.meta.env.VITE_SERVER_URL`
      // passed in from the host app). Empty string means "same-origin",
      // which collapses `${ctx.apiBase}/api/...` to a regular relative
      // path — exactly the production-deployment behaviour.
      apiBase: typeof this.context.apiBase === 'string'
        ? this.context.apiBase.replace(/\/+$/, '')
        : '',
      user: this.context.user ?? {},
      org: this.context.org ?? this.context.organization ?? {},
      recordId: this.context.record?.id ?? this.context.recordId,
    };
    if (this.context.ctx && typeof this.context.ctx === 'object') {
      Object.assign(ctx, this.context.ctx);
    }
    return ctx;
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

/**
 * Dot-path read used by target interpolation. Plain reduce — kept inline
 * to avoid pulling lodash for a 3-line helper.
 */
function readPath(root: unknown, path: string): unknown {
  if (root == null) return undefined;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, root);
}
