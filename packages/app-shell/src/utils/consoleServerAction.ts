/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The CONSOLE server-action handler — `@object-ui/core`'s
 * `createServerActionHandler` (objectui#2904) wrapped with the browser-only
 * conventions the console layers on top of the dispatch:
 *
 * - the **popup-blocker pre-open dance** for `opensInNewTab` actions: open
 *   `about:blank` synchronously on click (preserving the user-gesture context
 *   across the awaited POST) and paint a spinner so the tab isn't blank during
 *   a slow SSO-handoff mint;
 * - the **zero-roundtrip `newTabUrl` fast path**: a GET endpoint that performs
 *   all auth/authz itself (e.g. cloud's `/sso-open`) is navigated to directly,
 *   skipping the POST;
 * - the **`redirectUrl` convention**: a handler returning `{ redirectUrl }`
 *   asks the UI to open it — into the pre-opened tab when there is one, else a
 *   lazily opened one with a popup-blocked toast fallback.
 *
 * This file exists because `useConsoleActionRuntime` and `RecordDetailView`
 * each carried a near-verbatim copy of all of the above around their
 * hand-rolled POSTs, and the copies drifted (objectstack#3913 — envelope;
 * framework#3935 — action identity). The dispatch itself (name-only identity,
 * record-id resolution, re-entrancy guard, envelope rule) lives in core; only
 * the DOM/toast choreography belongs here.
 *
 * One deliberate delta from the old copies: the re-entrancy guard now lives
 * INSIDE the core dispatch, after the pre-open. A double-click on an
 * `opensInNewTab` action therefore pre-opens a second tab for one microtask
 * before the blocked dispatch closes it — the double POST it guards against is
 * still impossible.
 */

import { toast } from 'sonner';
import {
  createServerActionHandler,
  readActionPayload,
  resolveServerActionRecordId,
  type ActionContext,
  type ActionDef,
  type ServerActionFetch,
  type ServerActionHandler,
  type ServerActionRecordIdResolver,
} from '@object-ui/core';

export interface ConsoleServerActionOptions {
  /** Authenticated fetch wrapper (Bearer + tenant + cookies). */
  fetch: ServerActionFetch;
  /** Backend origin, read per dispatch (`''` = same-origin). */
  baseUrl: () => string;
  /** Fallback object scope when the action declares no `objectName`. */
  resolveObject: (action: ActionDef, context: ActionContext | undefined) => string | undefined;
  /**
   * Replace the standard record-id dance — RecordDetailView resolves against
   * ITS record (`action.recordId ?? pageRecordId`) instead of a grid
   * selection. Omit for the standard list/page behavior.
   */
  resolveRecordId?: ServerActionRecordIdResolver;
  /** Data invalidation, invoked per the action's `refreshAfter` semantics. */
  onRefresh: () => void;
}

/**
 * Pre-open `about:blank` synchronously (user-gesture context) and paint
 * progress immediately so the tab isn't blank/frozen during the (slow)
 * server round trip.
 *
 * NOTE: do NOT pass 'noopener' — per spec it forces `window.open` to return
 * null even when the tab opens, so the handle would be lost, the popup
 * fallback would fire, and the CURRENT tab would navigate to the now-consumed
 * SSO URL (the double-navigation bug).
 */
function preOpenSpinnerTab(): Window | null {
  try {
    const tab = window.open('about:blank', '_blank');
    if (tab) {
      tab.document.write('<!doctype html><meta charset="utf-8"><title>正在打开… Opening…</title><body style="margin:0;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;color:#4b5563"><div style="width:28px;height:28px;border:3px solid #e5e7eb;border-top-color:#6366f1;border-radius:50%;animation:s .8s linear infinite"></div><div>正在为你打开环境…</div><style>@keyframes s{to{transform:rotate(360deg)}}</style></body>');
      tab.document.close();
    }
    return tab;
  } catch {
    return null;
  }
}

function closeTab(tab: Window | null): void {
  if (!tab) return;
  try { tab.close(); } catch { /* ignore */ }
}

/**
 * Open `url`: drive the pre-opened tab there when one exists (falling back to
 * a current-tab navigation if the handle went stale); otherwise open lazily
 * and, when the popup blocker eats it, offer a one-click toast instead of
 * silently hijacking the current tab.
 */
function openInTab(preOpenedTab: Window | null, url: string): void {
  if (preOpenedTab) {
    try {
      preOpenedTab.location.href = url;
    } catch {
      closeTab(preOpenedTab);
      window.location.href = url;
    }
    return;
  }
  let popup: Window | null;
  // No 'noopener' so a successful open returns a truthy handle; with it, the
  // null return would always trip the toast fallback.
  try { popup = window.open(url, '_blank'); } catch { popup = null; }
  if (!popup) {
    toast('浏览器拦截了弹窗 / Popup blocked', {
      description: '点击在新标签页打开环境',
      action: { label: '打开环境', onClick: () => { try { window.open(url, '_blank'); } catch { window.location.href = url; } } },
      duration: 10000,
    });
  }
}

export function createConsoleServerActionHandler(opts: ConsoleServerActionOptions): ServerActionHandler {
  const dispatch = createServerActionHandler({
    fetch: opts.fetch,
    baseUrl: opts.baseUrl,
    resolveObject: opts.resolveObject,
    resolveRecordId: opts.resolveRecordId,
    onRefresh: opts.onRefresh,
  });
  const resolveRecordId = opts.resolveRecordId ?? resolveServerActionRecordId;

  return async (action: ActionDef, context?: ActionContext) => {
    // ── Zero-roundtrip fast path ────────────────────────────────────────
    // `newTabUrl` names a GET endpoint that performs ALL auth/authz itself
    // (e.g. /sso-open re-runs every check the POST half would have done),
    // so the POST round trip would add nothing but click latency. Drive the
    // pre-opened tab there immediately — the spinner page stays painted
    // until the (possibly slow) endpoint commits its redirect. Record-id
    // resolution runs BEFORE the pre-open so a blocked resolution
    // (multi-select, empty selection) never flashes a tab.
    const newTabUrl = typeof action.newTabUrl === 'string' ? action.newTabUrl : '';
    if (action.opensInNewTab && newTabUrl) {
      const resolution = resolveRecordId(action, context);
      if (resolution.error) {
        return { success: false, error: resolution.error };
      }
      const recordId = resolution.recordId;
      if (recordId == null) {
        return { success: false, error: 'This action runs on a single record — no record id available.' };
      }
      const preOpenedTab = preOpenSpinnerTab();
      // Absolute URL required: the pre-opened tab is an about:blank document,
      // so a bare-relative href has no reliable resolution base.
      const directUrl = `${opts.baseUrl() || window.location.origin}${newTabUrl.replace('{recordId}', encodeURIComponent(String(recordId)))}`;
      openInTab(preOpenedTab, directUrl);
      if (action.refreshAfter === true) opts.onRefresh();
      return { success: true };
    }

    // Popup-blocker workaround: pre-open about:blank synchronously before the
    // await so the user-gesture context is preserved.
    const preOpenedTab = action.opensInNewTab ? preOpenSpinnerTab() : null;
    try {
      const result = await dispatch(action, context);
      if (!result.success) {
        closeTab(preOpenedTab);
        // Don't toast here — the ActionRunner's post-execution hook surfaces
        // `error` as a toast; toasting here too double-fires it.
        return result;
      }
      // ── redirectUrl convention ────────────────────────────────────────
      // Read off the HANDLER's return value, not the action envelope wrapping
      // it (`result.data`). This used to read one level too shallow, where
      // only `success`/`data` ever live — so an action returning
      // `{ redirectUrl }` was silently ignored and an `opensInNewTab` action
      // left its pre-opened tab parked on the spinner page forever.
      const payload = readActionPayload(result.data);
      const redirectUrl = (payload && typeof payload === 'object' && typeof (payload as { redirectUrl?: unknown }).redirectUrl === 'string')
        ? (payload as { redirectUrl: string }).redirectUrl
        : null;
      if (redirectUrl) {
        openInTab(preOpenedTab, redirectUrl);
      } else {
        // Handler didn't return a redirectUrl — close the empty tab we
        // optimistically pre-opened so the user isn't left with about:blank.
        closeTab(preOpenedTab);
      }
      return result;
    } catch (error) {
      closeTab(preOpenedTab);
      return { success: false, error: (error as Error).message };
    }
  };
}
