/**
 * useConsoleActionRuntime — the reusable console "action runtime".
 *
 * ObjectView historically owned all the wiring needed to make schema-driven
 * `action:button`s actually *do* something: confirm/param/result dialogs, an
 * authenticated API caller, flow + server-action handlers, SPA navigation, and
 * the paused screen-flow runner. SDUI pages (PageView) render the same
 * `action:button` widgets but lacked that runtime, so their actions could not
 * collect params, call authenticated APIs, show result dialogs, refresh, or
 * navigate (#1605).
 *
 * This hook extracts that generic wiring so BOTH ObjectView and PageView can
 * mount it. It owns the dialog state and handlers, and returns:
 *   - `actionProviderProps` — spread onto `<ActionProvider>`;
 *   - `dialogs` — the confirm/param/result/flow dialogs to render inside it;
 *   - the individual handlers (e.g. `confirmHandler`, `toastHandler`) so a
 *     caller like ObjectView can also feed them into `useObjectActions`.
 *
 * `objectName` is optional: pages run global (or action-scoped) actions, while
 * ObjectView passes its current object so object-scoped actions resolve their
 * target + param defaults.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, createAuthenticatedFetch } from '@object-ui/auth';
import { usePermissions } from '@object-ui/permissions';
import { useObjectLabel } from '@object-ui/i18n';
import { ActionProvider, useGlobalUndo } from '@object-ui/react';
import { toast } from 'sonner';
import type {
  ActionContext,
  ActionDef,
  ActionParamDef,
  ActionResult,
  ConfirmationHandler,
  NavigationHandler,
  ParamCollectionHandler,
  ResultDialogHandler,
  ToastHandler,
} from '@object-ui/core';
import { ActionConfirmDialog, type ConfirmDialogState } from '../views/ActionConfirmDialog';
import { ActionParamDialog, type ParamDialogState } from '../views/ActionParamDialog';
import { ActionResultDialog, type ResultDialogState } from '../views/ActionResultDialog';
import { FlowRunner, type ScreenFlowState } from '../views/FlowRunner';
import { resolveActionParams } from '../utils/resolveActionParams';
import { EnvironmentEntitlementDialog, type EntitlementDialogState } from '../environment/EnvironmentEntitlementDialog';
import { entitlementDialogFromError, type EntitlementDialogSpec } from '../environment/entitlements';
import { resolvePageVarTokens } from '../utils/resolvePageVarTokens';

const FALLBACK_USER = { id: 'current-user', name: 'Demo User', isPlatformAdmin: false };

/**
 * An action that also mounts on list rows (`list_item`) or record pages is
 * designed to run against a single record. When such an action is launched
 * from the list toolbar with nothing selected, there is no record context to
 * resolve — block up front instead of triggering a run that fails at its
 * first record-bound step (#2210: "Update requires an ID"). Actions declaring
 * only object-level locations (e.g. `['list_toolbar']`) are left alone: they
 * legitimately run without a record.
 */
function isRecordScoped(action: ActionDef): boolean {
  const locations = (action as { locations?: unknown }).locations;
  if (!Array.isArray(locations)) return false;
  return locations.some((l) =>
    l === 'list_item' || l === 'record_header' || l === 'record_more' || l === 'record_section');
}

export interface ConsoleActionRuntimeOptions {
  /** Adapter for generic CRUD / execute calls. */
  dataSource: any;
  /** All object definitions — used to resolve param defaults from row/object. */
  objects?: any[];
  /** Current object name (ObjectView). Omit for pages running global actions. */
  objectName?: string;
  /** Invoked after a successful action that requests a refresh (`refreshAfter`
   *  !== false) — bump a refresh key to re-fetch embedded data. */
  onRefresh?: () => void;
}

export interface ConsoleActionRuntime {
  confirmHandler: ConfirmationHandler;
  toastHandler: ToastHandler;
  navigateHandler: NavigationHandler;
  paramCollectionHandler: ParamCollectionHandler;
  resultDialogHandler: ResultDialogHandler;
  apiHandler: (action: ActionDef) => Promise<ActionResult>;
  flowHandler: (action: ActionDef, context?: ActionContext) => Promise<ActionResult>;
  serverActionHandler: (action: ActionDef, context?: ActionContext) => Promise<ActionResult>;
  /** Authenticated fetch wrapper (Bearer + tenant + cookies). */
  authFetch: ReturnType<typeof createAuthenticatedFetch>;
  /** Open the shared environment entitlement (upgrade / limit) dialog. */
  openEntitlementDialog: (spec: EntitlementDialogSpec) => void;
  /** Props to spread onto `<ActionProvider>`. */
  actionProviderProps: {
    context: Record<string, any>;
    onConfirm: ConfirmationHandler;
    onToast: ToastHandler;
    onNavigate: NavigationHandler;
    onParamCollection: ParamCollectionHandler;
    onResultDialog: ResultDialogHandler;
    handlers: Record<string, (action: ActionDef) => Promise<ActionResult>>;
  };
  /** Confirm / param / result / paused-flow dialogs — render inside the provider. */
  dialogs: React.ReactNode;
}

export function useConsoleActionRuntime(opts: ConsoleActionRuntimeOptions): ConsoleActionRuntime {
  const { dataSource, objects, objectName, onRefresh } = opts;
  const navigate = useNavigate();
  const { user, activeOrganization } = useAuth();
  // [ADR-0066 D4] System capabilities for the action capability gate (fail-open
  // when no PermissionProvider is mounted — usePermissions returns []).
  const { systemPermissions } = usePermissions();
  const { fieldLabel, fieldOptionLabel, actionParamText, actionParamOptionLabel, actionDescription } = useObjectLabel();

  const objectDef = useMemo(
    () => (objectName ? objects?.find((o: any) => o.name === objectName) : undefined),
    [objects, objectName],
  );
  // Object name used for API paths / generic CRUD. Falls back to the action's
  // own `objectName` (set per call below) or 'global'.
  const objApiName = objectName || (objectDef as any)?.name;

  const refresh = useCallback(() => { onRefresh?.(); }, [onRefresh]);

  // Global undo/redo (Ctrl+Z / Ctrl+Shift+Z), backed by the dataSource. The
  // success toast's "Undo" button calls `undoCtl.undo()` for `undoable` actions
  // (the ActionRunner has already pushed the operation onto the UndoManager).
  const undoCtl = useGlobalUndo({
    dataSource,
    onUndo: () => { refresh(); toast.success('Change undone'); },
  });

  // Promise-based confirm / param / result dialogs.
  const [confirmState, setConfirmState] = useState<ConfirmDialogState>({ open: false, message: '' });
  const [paramState, setParamState] = useState<ParamDialogState>({ open: false, params: [] });
  const [resultDialogState, setResultDialogState] = useState<ResultDialogState>({ open: false });
  // A paused `screen`-node flow awaiting user input.
  const [screenFlow, setScreenFlow] = useState<ScreenFlowState | null>(null);
  // Plan/capacity gate dialog (upgrade / limit), shared by the env-list toolbar
  // (proactive) and the api-action error path below (reactive safety net).
  const [entitlementDialog, setEntitlementDialog] = useState<EntitlementDialogState>({ open: false });
  // Guards against double-firing a server action (slow SSO handoff, etc.).
  const serverActionInFlight = useRef<Set<string>>(new Set());

  const resultDialogHandler = useCallback<ResultDialogHandler>(
    (spec: any, data: unknown) => new Promise<void>((resolve) => {
      setResultDialogState({ open: true, spec, data, resolve });
    }),
    [],
  );

  const confirmHandler = useCallback<ConfirmationHandler>((message, options) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ open: true, message, options, resolve });
    });
  }, []);

  const paramCollectionHandler = useCallback<ParamCollectionHandler>((params: ActionParamDef[], action?: any) => {
    return new Promise<Record<string, any> | null>((resolve) => {
      // List_item actions stash the row record under params._rowRecord (see
      // ObjectGrid → onRowAction). Pull it out so resolveActionParams can
      // pre-fill `defaultFromRow` params from the row's current values.
      const row = action?.params && !Array.isArray(action.params)
        ? (action.params as Record<string, any>)._rowRecord
        : undefined;
      // Field-backed params resolve against the action's OWN object when the
      // dispatch carries one (related-list row actions retarget a CHILD object
      // — e.g. sys_member rows on an org record page); the page-level object
      // is only the fallback. Without this, a child action's `field` lookup
      // ran against the parent object, missed, and degraded to a bare text
      // input (no select options, no field label).
      const actionObject = typeof action?.objectName === 'string' && action.objectName
        ? action.objectName
        : undefined;
      const resolved = resolveActionParams(params as any, {
        objectName: actionObject || objectName || (objectDef as any)?.name || '',
        objects: objects || [],
        fieldLabel,
        fieldOptionLabel,
        row,
      });
      // Localize each param's label/placeholder/helpText via the
      // `_actions.<action>.params.<param>.<attr>` convention.
      const objForI18n = actionObject || objectName || (objectDef as any)?.name;
      const localized = (resolved as any[]).map((p: any) => ({
        ...p,
        label: actionParamText(objForI18n, action?.name, p.name, 'label', p.label) ?? p.label,
        placeholder: actionParamText(objForI18n, action?.name, p.name, 'placeholder', p.placeholder) ?? p.placeholder,
        helpText: actionParamText(objForI18n, action?.name, p.name, 'helpText', p.helpText) ?? p.helpText,
        options: Array.isArray(p.options)
          ? p.options.map((o: any) => ({ ...o, label: actionParamOptionLabel(objForI18n, action?.name, p.name, o.value, o.label) }))
          : p.options,
      }));
      setParamState({
        open: true,
        params: localized,
        title: action?.label || action?.title,
        description: actionDescription(objForI18n, action?.name, action?.description),
        resolve,
      });
    });
  }, [objectName, objectDef, objects, fieldLabel, fieldOptionLabel, actionParamText, actionParamOptionLabel]);

  const currentUser = user
    ? { id: user.id, name: user.name, avatar: user.image, isPlatformAdmin: (user as any)?.isPlatformAdmin ?? false, systemPermissions: systemPermissions ?? [] }
    : { ...FALLBACK_USER, systemPermissions: systemPermissions ?? [] };

  const toastHandler = useCallback<ToastHandler>((message, options) => {
    if (options?.type === 'error') { toast.error(message); return; }
    if (options?.undo) {
      toast.success(message, {
        duration: options.duration,
        action: { label: options.undo.label || 'Undo', onClick: () => { void undoCtl.undo(); } },
      });
      return;
    }
    toast.success(message, { duration: options?.duration });
  }, [undoCtl]);

  const navigateHandler = useCallback<NavigationHandler>((url, options) => {
    if (options?.external || options?.newTab) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      navigate(url);
    }
  }, [navigate]);

  // Authenticated fetch for direct backend calls. Declared before apiHandler.
  const authFetch = useMemo(() => createAuthenticatedFetch(), []);

  const openEntitlementDialog = useCallback((spec: EntitlementDialogSpec) => {
    setEntitlementDialog({ open: true, spec });
  }, []);

  const apiHandler = useCallback(async (action: ActionDef, context?: ActionContext): Promise<ActionResult> => {
    try {
      const target = action.target || action.name;
      const params = action.params || {};

      // Absolute HTTP target — bypass dataSource and call the API directly
      // through the authenticated fetch wrapper (Bearer + X-Tenant-ID +
      // same-origin cookies). The canonical path for schema actions on
      // managed-by tables and global page actions.
      const targetStr = typeof target === 'string' ? target : '';
      const isAbsolute = targetStr.startsWith('/') || /^https?:\/\//i.test(targetStr);
      if (isAbsolute) {
        const baseUrl = import.meta.env.VITE_SERVER_URL || '';
        const rawParams = { ...(params as Record<string, any>) };
        const rowRecord = rawParams._rowRecord as Record<string, any> | undefined;
        delete rawParams._rowRecord;

        // Resolve `{{page.<var>}}` tokens against the live page-variable snapshot
        // (published into the action context by PageVariableActionBridge). This is
        // what lets a pure-SDUI form submit the values its inputs wrote into page
        // variables; whole-value tokens preserve type. See resolvePageVarTokens.
        const pageVars = (context?.pageVariables ?? undefined) as Record<string, any> | undefined;
        const resolvedParams = resolvePageVarTokens(rawParams, pageVars);

        // Interpolate `{field}` tokens in the target URL from the row record.
        let resolvedTarget = targetStr;
        if (rowRecord && /\{[a-z_][a-z0-9_]*\}/i.test(resolvedTarget)) {
          resolvedTarget = resolvedTarget.replace(/\{([a-z_][a-z0-9_]*)\}/gi, (_, k) => {
            const v = rowRecord[k];
            return v == null ? '' : encodeURIComponent(String(v));
          });
        }
        const url = resolvedTarget.startsWith('http') ? resolvedTarget : `${baseUrl}${resolvedTarget}`;

        const wrap = action.bodyShape && typeof action.bodyShape === 'object' && action.bodyShape.wrap
          ? action.bodyShape.wrap
          : undefined;
        const body: Record<string, any> = wrap ? { [wrap]: resolvedParams } : { ...resolvedParams };

        if (rowRecord && action.recordIdParam) {
          const rowField = action.recordIdField || 'id';
          const rowValue = rowRecord[rowField];
          if (rowValue != null) body[action.recordIdParam] = rowValue;
        }

        const isAuthOrgEndpoint = /\/api\/v1\/auth\//.test(resolvedTarget);
        if (isAuthOrgEndpoint && !body.organizationId && activeOrganization?.id) {
          body.organizationId = activeOrganization.id;
        }

        if (action.bodyExtra && typeof action.bodyExtra === 'object') {
          Object.assign(body, resolvePageVarTokens(action.bodyExtra, pageVars));
        }

        const method = (action.method || 'POST').toUpperCase();
        const init: any = {
          method,
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        };
        if (method !== 'GET' && method !== 'DELETE') {
          init.body = JSON.stringify(body);
        }
        const res = await authFetch(url, init);
        if (!res.ok) {
          let body: any = null;
          try { body = await res.json(); } catch { /* response body not JSON */ }
          // Plan/capacity gates (e.g. creating an environment the org's plan
          // doesn't include) come back as coded 403s. Surface them as a friendly
          // upgrade/limit DIALOG with a CTA — never a generic red error toast.
          // Returning success:false WITHOUT an `error` suppresses the runner's
          // error toast (ActionRunner.handlePostExecution); the dialog owns the
          // messaging.
          const entitlementSpec = entitlementDialogFromError(body);
          if (entitlementSpec) {
            openEntitlementDialog(entitlementSpec);
            return { success: false };
          }
          const detail = (body as any)?.error || (body as any)?.message || `HTTP ${res.status}`;
          return { success: false, error: detail };
        }
        const json = await res.json().catch(() => ({}));
        if (action.refreshAfter !== false) refresh();
        // Unwrap the ObjectStack `{ success, data }` envelope so `result.data`
        // is the inner payload — the contract every `result.data` consumer
        // expects. The action `resultDialog` field paths (e.g. `user.email`,
        // `temporaryPassword`) and the dynamic-toast `result.data.message` are
        // all written relative to the inner `data`. flowHandler and
        // serverActionHandler already unwrap `json.data`; apiHandler was the
        // lone handler that leaked the whole envelope, which blanked every
        // resultDialog whose paths didn't redundantly prefix `data.` (the
        // "Create User temporary password shows empty" bug). Bare,
        // non-enveloped responses (some stock better-auth bodies) pass through
        // unchanged.
        const data = json && typeof json === 'object' && !Array.isArray(json) && 'data' in json
          ? (json as { data: unknown }).data
          : json;
        return { success: true, data, reload: action.refreshAfter !== false };
      }

      // Generic list-level API handler: update/execute via dataSource. Only
      // meaningful when an object context exists (ObjectView); pages without an
      // object resolve their actions through the absolute path above.
      const obj = action.objectName || objApiName;
      // The row record is stashed under `_rowRecord` for list_item actions —
      // separate it from the field values, and resolve the record id from it
      // (the action's static params carry the field changes, not the id).
      const rowRecord = (params as any)._rowRecord as Record<string, any> | undefined;
      const fields: Record<string, any> = { ...(params as Record<string, any>) };
      delete fields._rowRecord;
      const recId = fields.recordId ?? rowRecord?.[(action as any).recordIdField || 'id'];
      delete fields.recordId;

      // Constant body fields merged last (overrides user params), matching the
      // absolute-HTTP branch and the spec's documented `bodyExtra` semantics.
      // Without this a pure-confirmation action (confirmText, no params array)
      // carries its mutation only in bodyExtra, leaving `fields` empty so the
      // update below is skipped and nothing is persisted.
      if (action.bodyExtra && typeof action.bodyExtra === 'object') {
        Object.assign(fields, action.bodyExtra);
      }

      if (obj && typeof dataSource?.execute === 'function') {
        await dataSource.execute(obj, target, fields);
      } else if (obj && recId && Object.keys(fields).length > 0 && typeof dataSource?.update === 'function') {
        await dataSource.update(obj, recId, fields);
      }

      // Undoable single-record update: capture the prior values of the changed
      // fields from the row record so the success toast can offer "Undo".
      let undo: ActionResult['undo'];
      if (action.undoable && obj && recId && rowRecord && Object.keys(fields).length > 0
          && typeof dataSource?.update === 'function') {
        const undoData: Record<string, unknown> = {};
        for (const k of Object.keys(fields)) undoData[k] = rowRecord[k] ?? null;
        undo = {
          id: `undo-${obj}-${recId}-${Date.now()}`,
          type: 'update',
          objectName: obj,
          recordId: String(recId),
          timestamp: Date.now(),
          description: action.label || `Undo ${obj}`,
          undoData,
          redoData: { ...fields },
        };
      }

      const shouldRefresh = action.refreshAfter !== false;
      if (shouldRefresh) refresh();
      return { success: true, reload: shouldRefresh, undo };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, [dataSource, objApiName, authFetch, activeOrganization, refresh, openEntitlementDialog]);

  // Flow action handler — POST to /api/v1/automation/{name}/trigger.
  // `context` is the shared ActionRunner context (registered handlers are
  // invoked as `handler(action, runnerContext)`).
  const flowHandler = useCallback(async (action: ActionDef, context?: ActionContext): Promise<ActionResult> => {
    const flowName = action.target || action.name;
    if (!flowName) {
      return { success: false, error: 'No flow target provided for flow action' };
    }
    try {
      const baseUrl = import.meta.env.VITE_SERVER_URL || '';
      const params = { ...(action.params || {}) } as Record<string, any>;
      const rowRecord = params._rowRecord as Record<string, any> | undefined;
      delete params._rowRecord;
      let recordId = params.recordId ?? rowRecord?.id;
      // list_toolbar invocations carry no `_rowRecord` — fall back to the
      // grid's checkbox selection, which ObjectGrid publishes into the runner
      // context as `selectedRecords`. Flows take a single `recordId` input
      // variable, so a multi-row selection is ambiguous: block with a message
      // instead of triggering a run that fails at its first record-bound node.
      // Zero selection is blocked too when the action is record-scoped (it
      // also mounts on list rows) — otherwise the wizard opens, collects
      // input, and dies at its first record-bound node ("Update requires an
      // ID"). Pure object-level toolbar flows keep triggering with no record.
      if (recordId == null) {
        const selected = Array.isArray(context?.selectedRecords) ? context!.selectedRecords : [];
        if (selected.length === 1) {
          recordId = selected[0]?.id;
        } else if (selected.length > 1) {
          return { success: false, error: 'This flow runs on a single record — select exactly one row.' };
        } else if (isRecordScoped(action)) {
          return { success: false, error: 'This flow runs on a single record — select a row first.' };
        }
      }
      if (recordId != null && params.recordId == null) params.recordId = recordId;
      const res = await authFetch(
        `${baseUrl}/api/v1/automation/${encodeURIComponent(flowName)}/trigger`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recordId,
            objectName: action.objectName || objApiName,
            params,
          }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || (json && json.success === false)) {
        const errMsg = json?.error || `Flow "${flowName}" failed (HTTP ${res.status})`;
        return { success: false, error: errMsg };
      }
      // Screen-flow runtime: paused at a `screen` node awaiting input — open
      // the FlowRunner to render the form + resume. Refresh happens on complete.
      const data = json?.data ?? {};
      if (data.status === 'paused' && data.screen) {
        setScreenFlow({ flowName, runId: data.runId, screen: data.screen });
        // The action only OPENED the wizard — it hasn't completed. Suppress the
        // action-level success toast; the flow-runner owns completion messaging.
        return { success: true, silent: true };
      }
      const shouldRefresh = action.refreshAfter !== false;
      if (shouldRefresh) refresh();
      return { success: true, data: json?.data, reload: shouldRefresh };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, [authFetch, objApiName, refresh]);

  // Server-side action handler — POST to /api/v1/actions/{object}/{action}.
  // `context` is the shared ActionRunner context (registered handlers are
  // invoked as `handler(action, runnerContext)`).
  const serverActionHandler = useCallback(async (action: ActionDef, context?: ActionContext): Promise<ActionResult> => {
    const targetName = action.target || action.name;
    if (!targetName) {
      return { success: false, error: 'No action target provided' };
    }
    const params = (action.params && !Array.isArray(action.params))
      ? { ...(action.params as Record<string, unknown>) }
      : {};
    const _rowRecord = (params as any)._rowRecord as Record<string, any> | undefined;
    delete (params as any)._rowRecord;
    const recordIdField = (action as any).recordIdField || 'id';
    let resolvedRecordId = (params as any).recordId ?? _rowRecord?.[recordIdField];
    // Same list_toolbar fallback as flowHandler: no `_rowRecord` means the
    // action came from the toolbar — resolve the recordId from the grid's
    // checkbox selection (published as `selectedRecords`). Multi-select is
    // ambiguous for a single-record action, so block with a message; so is
    // zero selection when the action is record-scoped (see isRecordScoped).
    if (resolvedRecordId == null) {
      const selected = Array.isArray(context?.selectedRecords) ? context!.selectedRecords : [];
      if (selected.length === 1) {
        resolvedRecordId = selected[0]?.[recordIdField];
      } else if (selected.length > 1) {
        // The runner's post-execution hook surfaces `error` as a toast.
        return { success: false, error: 'This action runs on a single record — select exactly one row.' };
      } else if (isRecordScoped(action)) {
        return { success: false, error: 'This action runs on a single record — select a row first.' };
      }
    }

    // Re-entrancy guard.
    const inflightKey = `${targetName}:${resolvedRecordId ?? ''}`;
    if (serverActionInFlight.current.has(inflightKey)) {
      return { success: false, error: 'Action already in progress' };
    }
    serverActionInFlight.current.add(inflightKey);

    // Popup-blocker workaround: pre-open about:blank synchronously before the
    // await so the user-gesture context is preserved.
    let preOpenedTab: Window | null = null;
    if ((action as any).opensInNewTab) {
      try {
        preOpenedTab = window.open('about:blank', '_blank');
        if (preOpenedTab) {
          preOpenedTab.document.write('<!doctype html><meta charset="utf-8"><title>正在打开… Opening…</title><body style="margin:0;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;color:#4b5563"><div style="width:28px;height:28px;border:3px solid #e5e7eb;border-top-color:#6366f1;border-radius:50%;animation:s .8s linear infinite"></div><div>正在为你打开环境…</div><style>@keyframes s{to{transform:rotate(360deg)}}</style></body>');
          preOpenedTab.document.close();
        }
      } catch { preOpenedTab = null; }
    }
    try {
      const baseUrl = import.meta.env.VITE_SERVER_URL || '';
      // ── Zero-roundtrip fast path ────────────────────────────────────────
      // `newTabUrl` names a GET endpoint that performs ALL auth/authz itself
      // (e.g. /sso-open re-runs every check the POST half would have done),
      // so the POST round trip would add nothing but click latency. Drive the
      // pre-opened tab there immediately — the spinner page stays painted
      // until the (possibly slow) endpoint commits its redirect.
      const newTabUrl = typeof (action as any).newTabUrl === 'string' ? (action as any).newTabUrl as string : '';
      if ((action as any).opensInNewTab && newTabUrl) {
        if (resolvedRecordId == null) {
          if (preOpenedTab) { try { preOpenedTab.close(); } catch { /* ignore */ } }
          return { success: false, error: 'This action runs on a single record — no record id available.' };
        }
        // Absolute URL required: the pre-opened tab is an about:blank document,
        // so a bare-relative href has no reliable resolution base.
        const directUrl = `${baseUrl || window.location.origin}${newTabUrl.replace('{recordId}', encodeURIComponent(String(resolvedRecordId)))}`;
        if (preOpenedTab) {
          try { preOpenedTab.location.href = directUrl; }
          catch {
            try { preOpenedTab.close(); } catch { /* ignore */ }
            window.location.href = directUrl;
          }
        } else {
          let popup: Window | null = null;
          try { popup = window.open(directUrl, '_blank'); } catch { popup = null; }
          if (!popup) {
            toast('浏览器拦截了弹窗 / Popup blocked', {
              description: '点击在新标签页打开环境',
              action: { label: '打开环境', onClick: () => { try { window.open(directUrl, '_blank'); } catch { window.location.href = directUrl; } } },
              duration: 10000,
            });
          }
        }
        if (action.refreshAfter === true) refresh();
        return { success: true };
      }
      const obj = action.objectName || objApiName || 'global';
      const res = await authFetch(
        `${baseUrl}/api/v1/actions/${encodeURIComponent(obj)}/${encodeURIComponent(targetName)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recordId: resolvedRecordId, params }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || (json && json.success === false)) {
        const errMsg = json?.error || `Action "${targetName}" failed (HTTP ${res.status})`;
        if (preOpenedTab) { try { preOpenedTab.close(); } catch { /* ignore */ } }
        // Don't toast here — the ActionRunner's post-execution hook surfaces
        // `error` as a toast (see apiHandler/flowHandler, which likewise only
        // return). Toasting here too double-fires the error (two identical toasts).
        return { success: false, error: errMsg };
      }
      const shouldRefresh = action.refreshAfter !== false;
      if (shouldRefresh) refresh();
      const data = json?.data;
      const redirectUrl = (data && typeof data === 'object' && typeof (data as any).redirectUrl === 'string')
        ? (data as any).redirectUrl as string
        : null;
      if (redirectUrl) {
        if (preOpenedTab) {
          try { preOpenedTab.location.href = redirectUrl; }
          catch {
            try { preOpenedTab.close(); } catch { /* ignore */ }
            window.location.href = redirectUrl;
          }
        } else {
          let popup: Window | null = null;
          try { popup = window.open(redirectUrl, '_blank'); } catch { popup = null; }
          if (!popup) {
            toast('浏览器拦截了弹窗 / Popup blocked', {
              description: '点击在新标签页打开环境',
              action: { label: '打开环境', onClick: () => { try { window.open(redirectUrl, '_blank'); } catch { window.location.href = redirectUrl; } } },
              duration: 10000,
            });
          }
        }
      } else if (preOpenedTab) {
        try { preOpenedTab.close(); } catch { /* ignore */ }
      }
      return { success: true, data, reload: shouldRefresh };
    } catch (error) {
      if (preOpenedTab) { try { preOpenedTab.close(); } catch { /* ignore */ } }
      const msg = (error as Error).message;
      // The ActionRunner's post-execution hook toasts `error`; returning it here
      // (without a local toast.error) avoids the double toast.
      return { success: false, error: msg };
    } finally {
      serverActionInFlight.current.delete(inflightKey);
    }
  }, [authFetch, objApiName, refresh]);

  const actionProviderProps = useMemo(() => ({
    context: {
      ...(objectName ? { objectName } : {}),
      user: currentUser,
      // Backend origin — lets `type: 'url'` actions issue full-page
      // navigations to API endpoints across origins in dev.
      apiBase: (import.meta as any).env?.VITE_SERVER_URL || '',
      activeOrganization: activeOrganization
        ? { id: activeOrganization.id, slug: activeOrganization.slug, name: activeOrganization.name }
        : null,
    },
    onConfirm: confirmHandler,
    onToast: toastHandler,
    onNavigate: navigateHandler,
    onParamCollection: paramCollectionHandler,
    onResultDialog: resultDialogHandler,
    handlers: { api: apiHandler, flow: flowHandler, script: serverActionHandler, modal: serverActionHandler },
  }), [
    objectName, currentUser, activeOrganization, confirmHandler, toastHandler,
    navigateHandler, paramCollectionHandler, resultDialogHandler, apiHandler,
    flowHandler, serverActionHandler,
  ]);

  const dialogs = (
    <>
      <ActionConfirmDialog state={confirmState} onOpenChange={(open) => {
        if (!open) setConfirmState({ open: false, message: '' });
      }} />
      <ActionParamDialog state={paramState} onOpenChange={(open) => {
        if (!open) setParamState({ open: false, params: [] });
      }} />
      <ActionResultDialog
        state={resultDialogState}
        onAcknowledge={() => {
          resultDialogState.resolve?.();
          setResultDialogState({ open: false });
        }}
      />
      <FlowRunner
        state={screenFlow}
        authFetch={authFetch}
        baseUrl={import.meta.env.VITE_SERVER_URL || ''}
        dataSource={dataSource}
        objects={objects}
        onClose={() => setScreenFlow(null)}
        onComplete={() => { setScreenFlow(null); refresh(); }}
      />
      <EnvironmentEntitlementDialog
        state={entitlementDialog}
        apiBase={import.meta.env.VITE_SERVER_URL || ''}
        onOpenChange={(open) => { if (!open) setEntitlementDialog({ open: false }); }}
      />
    </>
  );

  return {
    confirmHandler,
    toastHandler,
    navigateHandler,
    paramCollectionHandler,
    resultDialogHandler,
    apiHandler,
    flowHandler,
    serverActionHandler,
    authFetch,
    openEntitlementDialog,
    actionProviderProps,
    dialogs,
  };
}

/**
 * ConsoleActionRuntimeProvider — convenience wrapper for callers (e.g. PageView)
 * that only need to wrap a subtree in the console action runtime. ObjectView
 * uses {@link useConsoleActionRuntime} directly because it also feeds the
 * handlers into `useObjectActions`.
 */
export function ConsoleActionRuntimeProvider({
  children,
  ...opts
}: ConsoleActionRuntimeOptions & { children: React.ReactNode }) {
  const runtime = useConsoleActionRuntime(opts);
  return (
    <ActionProvider {...runtime.actionProviderProps}>
      {children}
      {runtime.dialogs}
    </ActionProvider>
  );
}
