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
import { useObjectLabel, useObjectTranslation } from '@object-ui/i18n';
import { ActionProvider, useGlobalUndo, type ActionProviderProps } from '@object-ui/react';
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
import { actionErrorDetail, isRecordScopedAction, resolveRecordIdParamSeed } from '@object-ui/core';
import { useActionModal } from './useActionModal.js';
import { ActionConfirmDialog, type ConfirmDialogState } from '../views/ActionConfirmDialog.js';
import { ActionParamDialog, type ParamDialogState } from '../views/ActionParamDialog.js';
import { ActionResultDialog, type ResultDialogState } from '../views/ActionResultDialog.js';
import { FlowRunner, type ScreenFlowState, type ScreenSpec } from '../views/FlowRunner.js';
import { resolveActionParams } from '../utils/resolveActionParams.js';
import { EnvironmentEntitlementDialog, type EntitlementDialogState } from '../environment/EnvironmentEntitlementDialog.js';
import { entitlementDialogFromError, type EntitlementDialogSpec } from '../environment/entitlements.js';
import { resolvePageVarTokens } from '../utils/resolvePageVarTokens.js';
import { interpretFlowResponse } from '../utils/flowResponse.js';
import { createConsoleServerActionHandler } from '../utils/consoleServerAction.js';
import { modalTargetRefusalMessage } from '../utils/modalTargetDiagnostics.js';
import type { ConsoleActionDispatch } from '../consoleActionDispatch.js';

const FALLBACK_USER = { id: 'current-user', name: 'Demo User', isPlatformAdmin: false };

/**
 * Extract a human-readable message from an error response body — shared with
 * every `/actions` caller, which needs the same React-#31 guard. Owned by
 * `@object-ui/core` since #2904 (it moved there with the dispatch itself).
 */
const errorDetail = actionErrorDetail;

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
  // Two parameters, like its three siblings below — the implementation has
  // always been `(action, context?)` (it reads `context.pageVariables` to
  // resolve `{{page.<var>}}` tokens). The one-parameter declaration was a
  // narrower restatement that nothing could catch while the tests calling it
  // with two arguments were unchecked (objectui#4040).
  apiHandler: (action: ActionDef, context?: ActionContext) => Promise<ActionResult>;
  flowHandler: (action: ActionDef, context?: ActionContext) => Promise<ActionResult>;
  serverActionHandler: (action: ActionDef, context?: ActionContext) => Promise<ActionResult>;
  /** `type: 'modal'` — opens `target` as a page/object form, else runs the action server-side. */
  modalActionHandler: (action: ActionDef, context?: ActionContext) => Promise<ActionResult>;
  /** Authenticated fetch wrapper (Bearer + tenant + cookies). */
  authFetch: ReturnType<typeof createAuthenticatedFetch>;
  /** Open the shared environment entitlement (upgrade / limit) dialog. */
  openEntitlementDialog: (spec: EntitlementDialogSpec) => void;
  /**
   * Props to spread onto `<ActionProvider>`.
   *
   * DERIVED from that component's own props (`ActionProviderProps`) rather than
   * restated. The key list stays explicit — it states which props this hook
   * owns — but every TYPE comes from the consumer, so the two cannot drift.
   * They had: the restatement omitted `onModal` (which the implementation has
   * returned all along) and declared `handlers` values as one-parameter
   * functions where `<ActionProvider>` passes `(action, ctx)`. Neither was
   * visible while this package's tests were not type-checked — the suite next
   * door asserts `typeof props.onModal === 'function'` and was reading a key
   * the interface said did not exist (objectui#4040).
   */
  actionProviderProps: Required<
    Pick<
      ActionProviderProps,
      | 'context'
      | 'onConfirm'
      | 'onToast'
      | 'onModal'
      | 'onNavigate'
      | 'onParamCollection'
      | 'onResultDialog'
      | 'handlers'
    >
  >;
  /** Confirm / param / result / paused-flow dialogs — render inside the provider. */
  dialogs: React.ReactNode;
}

export function useConsoleActionRuntime(opts: ConsoleActionRuntimeOptions): ConsoleActionRuntime {
  const { dataSource, objects, objectName, onRefresh } = opts;
  const navigate = useNavigate();
  const { user, activeOrganization } = useAuth();
  // [ADR-0066 D4] System capabilities for the action capability gate. Forwarded
  // AS-IS below (no `?? []`) — `undefined` here means either no
  // PermissionProvider is mounted, or the backend never reported
  // `systemPermissions` at all (a deployment predating ADR-0066), and
  // `ActionEngine`'s own `Array.isArray(held)` check already fails OPEN on
  // that (framework#3923). Defaulting it to `[]` here used to silently
  // collapse "unknown" into "holds nothing" and gate every
  // `requiredPermissions` action closed on exactly the deployments this
  // doctrine exists to protect (objectui#4656).
  const { systemPermissions } = usePermissions();
  const { fieldLabel, fieldOptionLabel, actionParamText, actionParamOptionLabel, actionDescription, actionResultDialog } = useObjectLabel();
  // Entitlement 403s render as a dialog, not a toast — its copy is localized
  // here rather than taken from the server (objectui#2458 / cloud#959).
  // `language` also resolves inline per-locale action-param labels below.
  const { t, language } = useObjectTranslation();

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

  const resultDialogHandler = useCallback<ResultDialogHandler>(
    (spec: any, data: unknown, action?: any) => new Promise<void>((resolve) => {
      // Localize title/description/acknowledge + field labels via the
      // `_actions.<action>.resultDialog` convention (metadata literals as
      // fallback). The action's own object wins over the page object,
      // mirroring the param-dialog localization below.
      const objForI18n = (typeof action?.objectName === 'string' && action.objectName)
        ? action.objectName
        : objectName || (objectDef as any)?.name;
      const localized = actionResultDialog(objForI18n, action?.name, spec) ?? spec;
      setResultDialogState({ open: true, spec: localized, data, resolve });
    }),
    [objectName, objectDef, actionResultDialog],
  );

  const confirmHandler = useCallback<ConfirmationHandler>((message, options) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ open: true, message, options, resolve });
    });
  }, []);

  // `ConsoleActionDispatch`, not bare `ActionDef` (objectui#5611): this handler
  // reads `overrideNotice`, which is host-composed dispatch chrome rather than
  // authorable metadata, so it is declared at the seam instead of on the
  // published authored-metadata mirror. Narrowing off `any` is what puts this
  // whole function under the compiler — every other read below is a declared
  // `ActionDef` field, and the one that was not is the reason objectui#4282
  // backed the narrowing out.
  const paramCollectionHandler = useCallback<ParamCollectionHandler>((params: ActionParamDef[], action?: ConsoleActionDispatch) => {
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
        // Resolves an inline per-locale `label` map (rc.6's widened
        // `I18nLabel`) for the active language — objectui#4163.
        locale: language,
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
      // objectui#5178 — a caller-authored notice that must reach the user
      // AHEAD of the declared description, and must not be replaceable by a
      // translation bundle.
      //
      // `DeclaredActionsBar` sets this when the viewer is taking a privileged
      // admin-override branch (`can_act:false && can_override:true`), naming the
      // approvers about to be bypassed. It is deliberately NOT folded into
      // `description`: `actionDescription` resolves
      // `_actions.<name>.description` and prefers a bundle hit over the passed
      // literal, and `plugin-approvals` ships exactly such an entry for
      // `approval_reject` — so a warning routed through `description` would be
      // silently overwritten by the ordinary "Reject this request?" copy in
      // every locale that has the bundle. A safety notice a translation can
      // delete is not a safety notice.
      //
      // The notice arrives already localized (bar-authored chrome, resolved
      // through the normal locale bundle), so it is concatenated verbatim.
      const declaredDescription = actionDescription(objForI18n, action?.name, action?.description);
      const overrideNotice = typeof action?.overrideNotice === 'string' && action.overrideNotice
        ? action.overrideNotice
        : undefined;
      setParamState({
        open: true,
        params: localized,
        // Titled from `label` alone — the one spelling an action carries for
        // this. The `|| action?.title` fallback that used to sit here read a
        // key declared on no action surface at all — not `@objectstack/spec`'s
        // `ActionSchema`, not `ActionDef`, not `@object-ui/types`' renderer
        // view (`ui-action.ts`) or `crud.ts` — and forwarded by none of the
        // four action renderers, so it could not fire from authored metadata
        // (objectui#4282). Reads exactly one key, like `description` below.
        title: action?.label,
        description: overrideNotice
          ? [overrideNotice, declaredDescription].filter(Boolean).join('\n\n')
          : declaredDescription,
        resolve,
      });
    });
  }, [objectName, objectDef, objects, fieldLabel, fieldOptionLabel, actionParamText, actionParamOptionLabel]);

  const currentUser = user
    ? { id: user.id, name: user.name, avatar: user.image, isPlatformAdmin: (user as any)?.isPlatformAdmin ?? false, systemPermissions }
    : { ...FALLBACK_USER, systemPermissions };

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

        // #3447: decision outputs. DeclaredActionsBar synthesizes one param per
        // author-declared output key, named `outputs.<key>` (the key set is
        // per-request, so it can't be a static action param). Fold the dotted
        // params into the nested `outputs` object the approvals decide route
        // expects. Scoped to the `outputs.` prefix — a generic dotted-key fold
        // could reinterpret existing actions' literal param names.
        for (const k of Object.keys(body)) {
          if (k.startsWith('outputs.') && k.length > 'outputs.'.length) {
            const value = body[k];
            delete body[k];
            if (value === undefined || value === '') continue; // blank optional output → omit
            (body.outputs ??= {})[k.slice('outputs.'.length)] = value;
          }
        }

        // Seed the declared `recordIdParam` from the row — or REFUSE
        // (objectstack#8018). The read used to be `if (rowValue != null)` with a
        // silent `else`, so a row that could not supply the key sent the request
        // anyway, minus the parameter naming the record. A backend that reads a
        // missing selector as "match nothing" then answers success for having
        // changed nothing, and the user is told the action worked. Refusing is
        // the contract-first answer (AGENTS.md #0.1): an under-specified request
        // is rejected at the producer, not sent and hoped about. `error` here is
        // what makes the runner toast it (see the entitlement note below).
        const seed = resolveRecordIdParamSeed(action, rowRecord);
        if (seed.error) return { success: false, error: seed.error };
        if (seed.value !== undefined) body[action.recordIdParam!] = seed.value;

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
          const entitlementSpec = entitlementDialogFromError(body, t);
          if (entitlementSpec) {
            openEntitlementDialog(entitlementSpec);
            return { success: false };
          }
          return { success: false, error: errorDetail(body, `HTTP ${res.status}`) };
        }
        const json = await res.json().catch(() => ({}));
        // A business rejection can arrive as HTTP 200 with `success: false`
        // (objectstack#3913). `res.ok` alone misses it, so the call reported
        // success, toasted green and refreshed while the error was swallowed
        // (#2958). Classified BEFORE the refresh below — a rejected call
        // changed nothing to re-fetch.
        if (json && typeof json === 'object' && (json as { success?: unknown }).success === false) {
          // `name` is not guaranteed on an api action (it can be target-only),
          // so fall back to the endpoint rather than interpolating `undefined`.
          return { success: false, error: errorDetail(json, `Action "${action.name || targetStr}" failed`) };
        }
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
  }, [dataSource, objApiName, authFetch, activeOrganization, refresh, openEntitlementDialog, t]);

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
        } else if (isRecordScopedAction(action)) {
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
      // Single source for the flow-response rule — shared with
      // RecordDetailView's copy of this handler and with FlowRunner's resume.
      // A launch that FAILED (HTTP 200, `data.success === false`, no `status`
      // and no `screen`) used to be indistinguishable from a completed run and
      // fell into the terminal-success return below: no dialog, a green toast,
      // and a refresh (#2958). See utils/flowResponse.
      const outcome = interpretFlowResponse<ScreenSpec>(res, json, `Flow "${flowName}"`);
      if (outcome.kind === 'failed') {
        // The ActionRunner's post-execution hook surfaces `error` as a toast.
        return { success: false, error: outcome.error };
      }
      // Screen-flow runtime: paused at a `screen` node awaiting input — open
      // the FlowRunner to render the form + resume. Refresh happens on complete.
      if (outcome.kind === 'paused') {
        setScreenFlow({ flowName, runId: outcome.runId ?? '', screen: outcome.screen });
        // The action only OPENED the wizard — it hasn't completed. Suppress the
        // action-level success toast; the flow-runner owns completion messaging.
        return { success: true, silent: true };
      }
      const shouldRefresh = action.refreshAfter !== false;
      if (shouldRefresh) refresh();
      return { success: true, data: outcome.data, reload: shouldRefresh };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, [authFetch, objApiName, refresh]);

  // Server-side action handler — POST /api/v1/actions/{object}/{action}, built
  // from @object-ui/core's `createServerActionHandler` via the shared console
  // wrapper (#2904): core owns the dispatch (name-only identity per ADR-0110
  // D1, the record-id resolution dance, the re-entrancy guard, the /actions
  // envelope rule), the wrapper owns the console DOM choreography (popup
  // pre-open, `newTabUrl` fast path, `redirectUrl` convention).
  // RecordDetailView builds ITS handler from the same two pieces — the drift
  // between the two hand-rolled copies (objectstack#3913, framework#3935)
  // cannot recur.
  //
  // The env ref keeps the handler INSTANCE stable across renders (authFetch is
  // memoized once) while the config thunks read the latest object scope and
  // refresh callback — the factory's in-flight guard only spans invocations of
  // the same instance.
  const serverActionEnvRef = useRef({ objApiName, refresh, t });
  serverActionEnvRef.current = { objApiName, refresh, t };
  const serverActionHandler = useMemo(
    () => createConsoleServerActionHandler({
      fetch: authFetch,
      baseUrl: () => import.meta.env.VITE_SERVER_URL || '',
      resolveObject: () => serverActionEnvRef.current.objApiName,
      onRefresh: () => serverActionEnvRef.current.refresh(),
      // Read through the env ref so the spinner-tab / popup-blocked copy
      // follows a language switch without invalidating the handler instance
      // (objectui#3321).
      t: (key, englishDefault) => String(serverActionEnvRef.current.t(key, englishDefault)),
    }),
    [authFetch],
  );

  // Client-side modal transport, shared with RecordDetailView so a
  // `type: 'modal'` action behaves the SAME on a list page, an SDUI page, a
  // declared-actions bar and a record page. Before this, only RecordDetailView
  // opened modals client-side and every other console surface POSTed them to
  // `/actions/...` — the same button did two different things depending on
  // where it was mounted (framework#3530).
  const { modalHandler, modalElement, resolveModalTarget } = useActionModal(dataSource);

  /**
   * `type: 'modal'` dispatch — CLIENT-SIDE ONLY. The action's `target` names
   * the page to open (spec: "the modal/page name to open"); rendering it is
   * the whole of what a modal action does.
   *
   * [objectstack#3959] This used to fall through to `serverActionHandler` when
   * the target resolved to neither a page nor an object, documented as "how a
   * modal action bound to `engine.registerAction(...)` still runs". It never
   * ran: the framework's `headlessActionTypeError` rejects `type: 'modal'`
   * over REST with a 400, because a modal has no server dispatch. The
   * fallthrough only converted an authoring mistake — a target naming no
   * page — into a confusing round-trip, and it let apps ship handlers no
   * declaration could address (app-todo's `deferTask` / `setReminder` sat dead
   * for exactly this reason).
   *
   * An unresolvable target is now reported as what it is. To collect input and
   * then run server-side, declare `type: 'script'` with `params`: the runner
   * collects the same dialog and the handler runs with those values.
   *
   * The refusal WORDING is built by `utils/modalTargetDiagnostics`, shared with
   * `RecordDetailView.modalActionHandler` and `useActionModal.modalHandler`.
   * All three used to spell it here, and drifted: PR #4764 retired the object
   * fallback and rewrote only `useActionModal`'s copy, leaving this one — the
   * one console users actually read — saying the target names "no page or
   * object" and never mentioning `type: 'form'`, the replacement the
   * retirement handed authors (objectui#4767). Change the contract there, not
   * here.
   */
  const modalActionHandler = useCallback(async (action: ActionDef, _context?: ActionContext): Promise<ActionResult> => {
    const schema = (action as any).modal ?? action.target ?? (action as any).params?.schema;
    const descriptor = schema != null ? await resolveModalTarget(schema) : null;
    if (descriptor) return modalHandler(descriptor);
    return {
      success: false,
      error: modalTargetRefusalMessage({
        actionName: action.name,
        target: schema,
        serverHandlerHint: true,
      }),
    };
  }, [resolveModalTarget, modalHandler]);

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
    onModal: modalHandler,
    handlers: { api: apiHandler, flow: flowHandler, script: serverActionHandler, modal: modalActionHandler },
  }), [
    objectName, currentUser, activeOrganization, confirmHandler, toastHandler,
    navigateHandler, paramCollectionHandler, resultDialogHandler, apiHandler,
    flowHandler, serverActionHandler, modalHandler, modalActionHandler,
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
      {modalElement}
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
    modalActionHandler,
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
