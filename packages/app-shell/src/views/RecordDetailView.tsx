/**
 * RecordDetailView Component
 *
 * Renders a detail view for a single record, resolved by URL params.
 * Uses the DetailView plugin component with auto-generated sections from
 * the object field definitions.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { DetailView, RecordChatterPanel, buildDefaultPageSchema, extractMentions } from '@object-ui/plugin-detail';
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import { useAuth, createAuthenticatedFetch } from '@object-ui/auth';
import { ActionProvider, useObjectTranslation, useObjectLabel, usePageAssignment, RecordContextProvider, SchemaRenderer, DiscussionContextProvider, HighlightFieldsProvider } from '@object-ui/react';
import { buildExpandFields } from '@object-ui/core';
import { toast } from 'sonner';
import { useRecordPresence, PresenceAvatars } from '@object-ui/collaboration';
import { Database, ChevronLeft } from 'lucide-react';
import { MetadataPanel, useMetadataInspector } from './MetadataInspector';
import { SkeletonDetail } from '../skeletons';
import { ManagedByBadge } from '../components/ManagedByBadge';
import { resolveCrudAffordances } from '../utils/crudAffordances';
import { deriveRelatedLists } from '../utils/deriveRelatedLists';
import { hasExplicitDiscussion } from '../utils/pageSchemaIntrospect';
import { ActionConfirmDialog, type ConfirmDialogState } from './ActionConfirmDialog';
import { ActionParamDialog, type ParamDialogState } from './ActionParamDialog';
import { ActionResultDialog, type ResultDialogState } from './ActionResultDialog';
import { FlowRunner, type ScreenFlowState } from './FlowRunner';
import { resolveActionParams } from '../utils/resolveActionParams';
import { useRecordBreadcrumbTitle } from '../context/NavigationContext';
import type { DetailViewSchema, FeedItem, HighlightField, SectionGroup } from '@object-ui/types';
import type { ActionDef, ActionParamDef } from '@object-ui/core';
import { useRecordApprovals } from '../hooks/useRecordApprovals';
import { getRecordDisplayName } from '../utils';
import { useFavorites } from '../hooks/useFavorites';
import { useActionModal } from '../hooks/useActionModal';
import { useRecentItems } from '../hooks/useRecentItems';

interface RecordDetailViewProps {
  dataSource: any;
  objects: any[];
  onEdit: (record: any) => void;
  /**
   * When provided, this object name overrides the value derived from the
   * current URL (`useParams()`). Used when rendering the detail inside a
   * navigation drawer or split-pane — the parent route owns the URL while
   * the embedded detail is keyed by an in-memory record selection.
   */
  objectNameOverride?: string;
  /**
   * When provided, this record id overrides the value derived from the
   * current URL. See {@link objectNameOverride}.
   */
  recordIdOverride?: string;
  /**
   * `true` when this view is embedded (drawer / split-pane). Suppresses
   * side effects that would conflict with the host route — namely the
   * breadcrumb title publish (the parent route already owns the
   * breadcrumb).
   */
  embedded?: boolean;
}

const FALLBACK_USER = { id: 'current-user', name: 'Demo User' };

/**
 * Audit field names auto-injected by the framework's `applySystemFields`.
 * Filtered out of the auto-generated body sections — they are rendered
 * separately as a single subtle one-line `<RecordMetaFooter>` (see
 * `@object-ui/plugin-detail`) so provenance stays discoverable without a
 * heavy "System Information" panel. The inline-edit drawer also hides
 * them via `DEFAULT_SYSTEM_FIELDS` in
 * `@object-ui/plugin-detail/RecordDetailDrawer`.
 */
const AUDIT_FIELD_NAMES = new Set(['created_at', 'created_by', 'updated_at', 'updated_by']);

/**
 * System/tenant fields that the framework auto-injects on every record but
 * which carry no business value on a detail page. Hidden from the
 * auto-generated section (when the object has no explicit form sections).
 * Authors who really want to show these can still list them in
 * `objectDef.views.form.sections`.
 */
const HIDDEN_SYSTEM_FIELD_NAMES = new Set([
  'organization_id', 'tenant_id', 'is_deleted', 'deleted_at',
]);

/**
 * Field-type signals that suggest a "secondary / system / metadata"
 * placement when auto-grouping fields. These move out of the main
 * section and into a collapsible "More details" section by default,
 * keeping the primary section dense with business-critical fields.
 *
 * The heuristic is conservative: when no objectDef metadata is available
 * we surface most fields in the main section; long-form text and
 * audit-by-name fields drop down.
 */
const SECONDARY_FIELD_NAME_HINTS = ['description', 'notes', 'note', 'remark', 'remarks', 'comments'];
const SECONDARY_FIELD_TYPES = new Set(['textarea', 'markdown', 'html', 'rich-text', 'json', 'code']);

function isSecondaryField(fieldName: string, fieldDef: any): boolean {
  if (SECONDARY_FIELD_TYPES.has(fieldDef?.type)) return true;
  const lc = fieldName.toLowerCase();
  return SECONDARY_FIELD_NAME_HINTS.some((hint) => lc === hint || lc.endsWith(`_${hint}`));
}

export function RecordDetailView({ dataSource, objects, onEdit, objectNameOverride, recordIdOverride, embedded }: RecordDetailViewProps) {
  const params = useParams<{
    appName?: string;
    objectName?: string;
    recordId?: string;
  }>();
  const appName = params.appName;
  const objectName = objectNameOverride ?? params.objectName;
  const recordId = recordIdOverride ?? params.recordId;
  const { showDebug } = useMetadataInspector();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const originFrom = (location.state as any)?.from as { pathname?: string; label?: string } | undefined;
  const { t } = useObjectTranslation();
  const { objectLabel, viewLabel: _vLabel, sectionLabel, actionLabel, actionConfirm, actionSuccess, actionParamText, fieldLabel, fieldOptionLabel } = useObjectLabel();
  const { isFavorite, toggleFavorite, refreshLabel: refreshFavoriteLabel } = useFavorites();
  const { addRecentItem } = useRecentItems();
  const [isLoading, setIsLoading] = useState(true);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [mentionSuggestions, setMentionSuggestions] = useState<
    Array<{ id: string; label: string; avatarUrl?: string }>
  >([]);
  const [actionRefreshKey, setActionRefreshKey] = useState(0);
  // Screen-flow runtime: a paused `screen`-node flow launched from a record action.
  const [screenFlow, setScreenFlow] = useState<ScreenFlowState | null>(null);
  const [childRelatedData, setChildRelatedData] = useState<Record<string, any[]>>({});
  const [historyEntries, setHistoryEntries] = useState<any[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [recordTitle, setRecordTitle] = useState<string | undefined>();
  const objectDef = objects.find((o: any) => o.name === objectName);

  // Publish record title to the navigation context so the top-bar breadcrumb
  // can display "Acme Platform Upgrade" instead of "#9U1_MmmxjiGR…". Skip
  // when embedded (drawer/split): the parent list route owns the breadcrumb.
  useRecordBreadcrumbTitle(embedded ? undefined : recordTitle);

  // Use the URL recordId as-is — it contains the actual record id.
  // Navigation code passes `record.id || record._id` directly into the URL
  // without adding any prefix, so no stripping is needed.
  const pureRecordId = recordId;

  // Record-scoped presence ("who else is viewing this record"). The default
  // PresenceProvider source is a no-op, so this resolves to `[]` until a
  // realtime transport (WebSocket-backed source) is wired in by the host
  // app — see `@object-ui/collaboration`'s `<PresenceProvider>`. The
  // PresenceAvatars row is hidden when the array is empty, so the
  // affordance is invisible until the transport lights up.
  const recordPresence = useRecordPresence(objectName, pureRecordId);

  const favoriteRecord = useMemo(() => {
    if (!objectName || !pureRecordId) return null;
    return {
      id: `record:${objectName}:${pureRecordId}`,
      label: recordTitle || pureRecordId || '',
      href: `/apps/${appName}/${objectName}/record/${pureRecordId}`,
      type: 'record' as const,
    };
  }, [appName, objectName, pureRecordId, recordTitle]);
  const isRecordFavorite = favoriteRecord ? isFavorite(favoriteRecord.id) : false;
  const handleToggleRecordFavorite = useCallback(() => {
    if (favoriteRecord) toggleFavorite(favoriteRecord);
  }, [favoriteRecord, toggleFavorite]);

  // ─── Page Assignment (Salesforce Lightning-style record Pages) ──────
  // If a PageSchema(pageType='record') is authored for this object, render
  // it via SchemaRenderer (which dispatches to the registered 'record'
  // PageRenderer in @object-ui/components). Otherwise we fall through to
  // the legacy auto-generated DetailView path below.
  //
  // Track 3 Phase G slice 6 — `renderViaSchema` is now default-on. The
  // no-assignedPage branch synthesizes a canonical Page via
  // `buildDefaultPageSchema(objectDef)` so the default detail page rides
  // the same SchemaRenderer pipeline as custom pages. Kill-switches:
  //   1) URL query param `?renderViaSchema=0` (per-request fallback to
  //      the legacy DetailView monolith — useful for debugging regressions)
  //   2) `objectDef.detail?.renderViaSchema === false` (per-object opt-out)
  const { page: assignedPage, slots: assignedSlots } = usePageAssignment(objectName);
  const renderViaSchemaFlag = useMemo(() => {
    if (typeof window !== 'undefined') {
      try {
        const qp = new URLSearchParams(window.location.search).get('renderViaSchema');
        if (qp === '0' || qp === 'false') return false;
        if (qp === '1' || qp === 'true') return true;
      } catch {}
    }
    if ((objectDef as any)?.detail?.renderViaSchema === false) return false;
    return true;
  }, [objectDef]);
  const synthesizedPage = useMemo(() => {
    // Synthesizer drives two cases:
    //   1) no assignedPage at all → pure default detail page
    //   2) assignedSlots (slotted page) → synth with slot overrides
    // In either case the page-record load effect below only needs
    // "is there a page?"; the fully-detailed schema is rebuilt at
    // render time once `detailSchema.sections` are known.
    if (assignedPage) return null;
    if (!objectDef) return null;
    if (!renderViaSchemaFlag && !assignedSlots) return null;
    return buildDefaultPageSchema(objectDef as any, assignedSlots ? { slots: assignedSlots } : undefined);
  }, [renderViaSchemaFlag, assignedPage, assignedSlots, objectDef]);
  const effectivePage = assignedPage || synthesizedPage;
  const [pageRecord, setPageRecord] = useState<any>(null);
  // 'idle' | 'loading' | 'loaded' | 'missing' — distinguishes "haven't
  // tried yet" from "tried and the record really doesn't exist". The
  // not-found short-circuit below uses `missing` to render a clean empty
  // state instead of a half-broken page chrome (rail + discussion).
  const [pageRecordStatus, setPageRecordStatus] = useState<
    'idle' | 'loading' | 'loaded' | 'missing'
  >('idle');

  useEffect(() => {
    let cancelled = false;
    if (!effectivePage || !pureRecordId || !objectName || !dataSource?.findOne) {
      setPageRecord(null);
      setPageRecordStatus('idle');
      return;
    }
    // Expand lookup/master_detail fields so the page receives display
    // names (e.g. account.name) rather than raw foreign-key IDs. The
    // page subtitle interpolation and record:* renderers depend on this.
    const expandFields = buildExpandFields(objectDef?.fields);
    const params = expandFields.length > 0 ? { $expand: expandFields } : undefined;
    const loadRecord = () => {
      setPageRecordStatus('loading');
      const findOnePromise = params
        ? dataSource.findOne(objectName, pureRecordId, params)
        : dataSource.findOne(objectName, pureRecordId);
      findOnePromise
        .then((rec: any) => {
          if (cancelled) return;
          if (rec && typeof rec === 'object') {
            setPageRecord(rec);
            setPageRecordStatus('loaded');
          } else {
            setPageRecord(null);
            setPageRecordStatus('missing');
          }
        })
        .catch(() => {
          if (cancelled) return;
          setPageRecord(null);
          setPageRecordStatus('missing');
        });
    };
    loadRecord();

    // Re-sync when any descendant signals the record changed (e.g.
    // DetailView recalling a pending approval). Without this listener,
    // the cached `pageRecord` would stay stale and propagate `pending`
    // back into nested DetailViews via context.
    const onChanged = (ev: Event) => {
      const detail = (ev as CustomEvent).detail || {};
      if (detail.objectName !== objectName || String(detail.recordId) !== String(pureRecordId)) return;
      loadRecord();
    };
    window.addEventListener('objectui:record-changed', onChanged as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener('objectui:record-changed', onChanged as EventListener);
    };
  }, [effectivePage, objectName, pureRecordId, dataSource, objectDef]);

  // Schema-driven path: derive a human-readable record title from the
  // loaded `pageRecord` so favourites (record:*) and the breadcrumb show
  // e.g. "Acme Corporation" instead of the raw record id. The legacy
  // `DetailView` path keeps using its own `onDataLoaded` callback below.
  useEffect(() => {
    if (!pageRecord || typeof pageRecord !== 'object' || !objectDef) return;
    const resolved = getRecordDisplayName(objectDef, pageRecord);
    if (resolved && resolved !== 'Untitled' && resolved !== recordTitle) {
      setRecordTitle(resolved);
    }
  }, [pageRecord, objectDef, recordTitle]);

  // Once we have a human-readable title, (a) record this visit into the
  // "Recently Accessed" rail on the home page and (b) self-heal any
  // previously-favorited entry whose label was saved as the raw record id
  // (because the title hadn't loaded yet at the time of the toggle).
  useEffect(() => {
    if (!objectName || !pureRecordId || !appName) return;
    if (!recordTitle) return;
    const favId = `record:${objectName}:${pureRecordId}`;
    const href = `/apps/${appName}/${objectName}/record/${pureRecordId}`;
    addRecentItem({ id: favId, label: recordTitle, href, type: 'record' });
    refreshFavoriteLabel(favId, recordTitle);
  }, [appName, objectName, pureRecordId, recordTitle, addRecentItem, refreshFavoriteLabel]);

  // ─── Action Provider Handlers ───────────────────────────────────────

  // Confirm dialog state (promise-based)
  const [confirmState, setConfirmState] = useState<ConfirmDialogState>({ open: false, message: '' });

  // Param collection dialog state (promise-based)
  const [paramState, setParamState] = useState<ParamDialogState>({ open: false, params: [] });

  // Result-dialog state — one-shot reveal of action response data
  // (2FA secrets, OAuth client_secret, recovery codes).
  const [resultDialogState, setResultDialogState] = useState<ResultDialogState>({ open: false });
  const resultDialogHandler = useCallback(
    (spec: any, data: unknown) => new Promise<void>((resolve) => {
      setResultDialogState({ open: true, spec, data, resolve });
    }),
    [],
  );

  const confirmHandler = useCallback((message: string, options?: { title?: string; confirmText?: string; cancelText?: string }) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ open: true, message, options, resolve });
    });
  }, []);

  const paramCollectionHandler = useCallback((params: ActionParamDef[], action?: any) => {
    return new Promise<Record<string, any> | null>((resolve) => {
      const resolved = resolveActionParams(params as any, {
        objectName: objectName || objectDef?.name || '',
        objects: objects || [],
        fieldLabel,
        fieldOptionLabel,
      });
      // Localize param label/placeholder/helpText (see ObjectView for the
      // convention); falls back to the metadata literal.
      const objForI18n = objectName || objectDef?.name;
      const localized = (resolved as any[]).map((p: any) => ({
        ...p,
        label: actionParamText(objForI18n, action?.name, p.name, 'label', p.label) ?? p.label,
        placeholder: actionParamText(objForI18n, action?.name, p.name, 'placeholder', p.placeholder) ?? p.placeholder,
        helpText: actionParamText(objForI18n, action?.name, p.name, 'helpText', p.helpText) ?? p.helpText,
      }));
      setParamState({
        open: true,
        params: localized,
        // Title the dialog as the action rather than the generic "Action parameters".
        title: action?.label || action?.title,
        description: action?.description,
        resolve,
      });
    });
  }, [objectName, objectDef, objects, fieldLabel, fieldOptionLabel, actionParamText]);

  const toastHandler = useCallback((message: string, options?: { type?: string }) => {
    if (options?.type === 'error') toast.error(message);
    else toast.success(message);
  }, []);

  const navigateHandler = useCallback((url: string, options?: { external?: boolean; newTab?: boolean }) => {
    if (options?.external || options?.newTab) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      navigate(url);
    }
  }, [navigate]);

  // API action handler — maps logical action targets to dataSource operations
  const apiHandler = useCallback(async (action: ActionDef) => {
    try {
      const target = action.target || action.name;
      const params = action.params || {};

      switch (target) {
        case 'opportunity_change_stage':
          await dataSource.update(objectName!, pureRecordId!, { stage: params.new_stage });
          break;
        case 'opportunity_mark_won':
          await dataSource.update(objectName!, pureRecordId!, { stage: 'closed_won' });
          break;
        case 'opportunity_mark_lost':
          await dataSource.update(objectName!, pureRecordId!, { stage: 'closed_lost', loss_reason: params.loss_reason });
          break;
        default:
          // Generic: update record with collected params
          if (Object.keys(params).length > 0) {
            await dataSource.update(objectName!, pureRecordId!, params);
          }
          break;
      }

      const shouldRefresh = action.refreshAfter === true;
      if (shouldRefresh) {
        setActionRefreshKey(k => k + 1);
      }
      return { success: true, reload: shouldRefresh };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, [dataSource, objectName, pureRecordId]);

  // Client-side modal transport: `type:'modal'` actions open here (Dialog /
  // Sheet / Drawer by `placement`) and render arbitrary SchemaNode content.
  const { modalHandler, modalElement } = useActionModal(dataSource);

  // Authenticated fetch for direct backend calls (e.g. flow trigger).
  const authFetch = useMemo(() => createAuthenticatedFetch(), []);

  // Flow action handler — POST to /api/v1/automation/{name}/trigger.
  // Triggered when an Action with `type: 'flow'` is invoked from a record-level
  // location (record_header, record_more, …). The server-side automation
  // engine resolves `{name}` against the registered flow definitions and
  // returns `{success, output, durationMs}`.
  const flowHandler = useCallback(async (action: ActionDef) => {
    const flowName = action.target || action.name;
    if (!flowName) {
      return { success: false, error: 'No flow target provided for flow action' };
    }
    try {
      const baseUrl = import.meta.env.VITE_SERVER_URL || '';
      const res = await authFetch(
        `${baseUrl}/api/v1/automation/${encodeURIComponent(flowName)}/trigger`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recordId: pureRecordId,
            objectName,
            params: action.params ?? {},
          }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || (json && json.success === false)) {
        const errMsg = json?.error || `Flow "${flowName}" failed (HTTP ${res.status})`;
        return { success: false, error: errMsg };
      }
      // Screen-flow runtime: the run paused at a `screen` node awaiting input —
      // open the FlowRunner to render the form + resume (refresh on completion).
      const data = json?.data ?? {};
      if (data.status === 'paused' && data.screen) {
        setScreenFlow({ flowName, runId: data.runId, screen: data.screen });
        return { success: true };
      }
      const shouldRefresh = action.refreshAfter !== false;
      if (shouldRefresh) {
        setActionRefreshKey(k => k + 1);
      }
      return { success: true, data: json?.data, reload: shouldRefresh };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, [authFetch, pureRecordId, objectName]);

  // Server-side action handler — POST to /api/v1/actions/{object}/{action}.
  // Used for `script` and `modal` actions where `action.target` matches a
  // server-registered handler name (engine.registerAction). Sends the
  // current recordId, objectName, and any collected/static params, and the
  // server resolves the handler (with wildcard '*' fallback) and runs it.
  const serverActionHandler = useCallback(async (action: ActionDef) => {
    const targetName = action.target || action.name;
    if (!targetName) {
      return { success: false, error: 'No action target provided' };
    }
    const params = (action.params && !Array.isArray(action.params))
      ? (action.params as Record<string, unknown>)
      : {};

    // ── Popup-blocker workaround ──────────────────────────────────────
    // When `action.opensInNewTab` is set, the handler is known to return
    // `{ redirectUrl: ... }` for the UI to navigate to. We pre-open
    // `about:blank` synchronously *here*, before the await fetch — this
    // preserves the user-gesture context so Chrome/Safari don't block
    // the eventual navigation. Drives the same tab to `redirectUrl`
    // after the server replies. If pre-open fails (popup blocker on the
    // initial gesture), we fall back to navigating the current tab so
    // the user always gets there.
    let preOpenedTab: Window | null = null;
    if ((action as any).opensInNewTab) {
      // NOTE: do NOT pass 'noopener' here — per spec it forces window.open to
      // return null even when the tab opens, so we'd lose the handle, fall
      // through to the popup branch below, and end up navigating the *current*
      // tab to the redirectUrl (the double-navigation bug: env opens in a new
      // tab AND the list/detail page jumps to the now-consumed SSO URL). We
      // need the reference to drive the pre-opened tab to the SSO redirect.
      try { preOpenedTab = window.open('about:blank', '_blank'); } catch { preOpenedTab = null; }
    }

    try {
      const baseUrl = import.meta.env.VITE_SERVER_URL || '';
      const obj = action.objectName || objectName || 'global';
      const res = await authFetch(
        `${baseUrl}/api/v1/actions/${encodeURIComponent(obj)}/${encodeURIComponent(targetName)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recordId: pureRecordId, params }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || (json && json.success === false)) {
        const errMsg = json?.error || `Action "${targetName}" failed (HTTP ${res.status})`;
        if (preOpenedTab) { try { preOpenedTab.close(); } catch { /* ignore */ } }
        // Surface the failure — this custom new-tab path bypasses
        // ActionRunner's toast-on-error, so otherwise the user gets no feedback.
        toast.error(errMsg);
        return { success: false, error: errMsg };
      }
      const shouldRefresh = action.refreshAfter !== false;
      if (shouldRefresh) setActionRefreshKey(k => k + 1);
      const result = json?.data;
      // ── redirectUrl convention ────────────────────────────────────────
      // A script-action handler can return `{ redirectUrl: 'https://…' }`
      // to ask the UI to open the URL. If the action declared
      // `opensInNewTab: true`, we drive the pre-opened tab to that URL
      // (popup-blocker-safe). Otherwise we open lazily and, if blocked,
      // fall back to navigating the current tab so the user always gets
      // to the destination.
      if (result && typeof result === 'object' && typeof (result as any).redirectUrl === 'string') {
        const redirectUrl = (result as any).redirectUrl as string;
        if (preOpenedTab) {
          try { preOpenedTab.location.href = redirectUrl; } catch {
            try { preOpenedTab.close(); } catch { /* ignore */ }
            window.location.href = redirectUrl;
          }
        } else {
          let popup: Window | null = null;
          // No 'noopener' so a successful open returns a truthy handle; with
          // it, the null return would always trip the current-tab fallback.
          try { popup = window.open(redirectUrl, '_blank'); } catch { popup = null; }
          if (!popup) { window.location.href = redirectUrl; }
        }
      } else if (preOpenedTab) {
        // Handler didn't return a redirectUrl — close the empty tab we
        // optimistically pre-opened so the user isn't left with about:blank.
        try { preOpenedTab.close(); } catch { /* ignore */ }
      }
      return { success: true, data: result, reload: shouldRefresh };
    } catch (error) {
      if (preOpenedTab) { try { preOpenedTab.close(); } catch { /* ignore */ } }
      const msg = (error as Error).message;
      toast.error(msg);
      return { success: false, error: msg };
    }
  }, [authFetch, pureRecordId, objectName]);

  // ─── Approvals ─────────────────────────────────────────────────────
  // Since ADR-0019 an approval is a flow node: the flow opens the request,
  // there is no manual submit/recall from the record header. When the current
  // user is a pending approver, surface "Approve" / "Reject" on the header and
  // a status badge whenever a request exists.
  const approvals = useRecordApprovals(objectName, pureRecordId, user?.id);
  // Hold latest approvals snapshot in a ref so the action handler
  // (memoized once inside ActionRunner) always sees fresh state instead of
  // the stale closure captured at the first render.
  const approvalsRef = useRef(approvals);
  approvalsRef.current = approvals;

  const approvalHandler = useCallback(async (action: ActionDef) => {
    const target = action.target || action.name;
    const params = (action.params && !Array.isArray(action.params))
      ? (action.params as Record<string, any>)
      : {};
    try {
      if (target === 'approve_request') {
        await approvalsRef.current.approve({ comment: params.comment });
      } else if (target === 'reject_request') {
        await approvalsRef.current.reject({ comment: params.comment });
      } else {
        return { success: false, error: `Unknown approval target: ${target}` };
      }
      setActionRefreshKey((k) => k + 1);
      return { success: true, reload: true };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }, []);

  // Discover reverse references: other objects with lookup/master_detail fields
  // pointing to the current object (e.g., order_item.order → order).
  //
  // Audit FKs (`created_by` / `updated_by` / `owner_id`) are skipped — they
  // exist on virtually every object, and on a `sys_user` page they would
  // produce one related entry per (object × audit-FK) pair (dozens of
  // duplicate "用户偏好 / 邮件模板 / 角色 …" cards in the right rail and
  // tabs). The semantic owner field for a child record is its primary
  // `*_id` lookup; audit attribution belongs in audit views, not in the
  // related-records summary.
  // Detail-page related lists — the read-side mirror of the form's inline
  // master-detail. Derived purely from the relationship graph: every child
  // object whose lookup/master_detail FK references this object becomes a
  // related list (owned `master_detail` children first), unless its FK opts
  // out via `relatedList: false`. `relatedListTitle` / `relatedListColumns`
  // on the FK override the derived title / columns. Audit FKs are skipped and
  // children deduped — see `deriveRelatedLists`.
  const childRelations = useMemo(
    () => deriveRelatedLists(objectDef, objects),
    [objectDef, objects],
  );

  // Fetch related child records for each reverse reference.
  //
  // PERF: only the legacy `DetailView` path consumes `childRelatedData`
  // (it's threaded into `detailSchema.related[].data`). The default
  // schema path renders each related list via `record:related_list`,
  // whose `RelatedList` self-fetches lazily when its tab is shown — so
  // preloading here would just fire ~N redundant concurrent queries on
  // every record open (measured: a record with 8 related lists fired ~50
  // concurrent requests, all TTFB ~9s) for data the schema path never
  // reads. Skip the fan-out entirely whenever the schema page renders;
  // load eagerly only for the legacy fallback that needs it.
  useEffect(() => {
    if (effectivePage) return;
    if (!dataSource || !pureRecordId || childRelations.length === 0) return;
    let cancelled = false;
    Promise.all(
      childRelations.map(({ childObject, referenceField }) =>
        dataSource.find(childObject, {
          $filter: { [referenceField]: pureRecordId },
        })
          .then((res: any) => {
            const items = Array.isArray(res) ? res : res?.data || [];
            return { childObject, items };
          })
          .catch((err: any) => {
            console.warn(`[RecordDetailView] Failed to fetch related ${childObject}:`, err);
            return { childObject, items: [] as any[] };
          })
      )
    ).then((results) => {
      if (cancelled) return;
      const data: Record<string, any[]> = {};
      for (const { childObject, items } of results) {
        data[childObject] = items;
      }
      setChildRelatedData(data);
    });
    return () => { cancelled = true; };
  }, [dataSource, pureRecordId, childRelations, objectDef, effectivePage]);

  // ── Audit history fetch ────────────────────────────────────────────
  // Loads recent sys_audit_log entries for this record so the DetailView can
  // render a read-only "History" tab. Gated on three preconditions to keep
  // the network and the UI quiet for objects that opt out of history:
  //   1) trackHistory must be explicitly true on the object capabilities
  //      (the framework default is false, so we never speculatively fetch).
  //   2) sys_audit_log must be present in the registered objects list — if
  //      the platform-objects package isn't deployed the tab makes no sense.
  //   3) The object being viewed must not be sys_audit_log itself, to avoid
  //      a recursive tab on the audit log detail page.
  // We request only the safe projection (created_at, action, user_id) so the
  // browser never receives serialized old_value/new_value payloads, which
  // can contain restricted fields. Field-level redaction in PR2 will harden
  // this further once a backend-scoped audit endpoint exists.
  const historyEnabled = useMemo(() => {
    if (!objectDef) return false;
    if (objectDef.name === 'sys_audit_log') return false;
    if (objectDef.enable?.trackHistory !== true) return false;
    return objects.some((o: any) => o.name === 'sys_audit_log');
  }, [objectDef, objects]);

  useEffect(() => {
    if (!dataSource || !pureRecordId || !objectDef || !historyEnabled) {
      setHistoryEntries(null);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);

    // Pull `old_value` and `new_value` so we can render a per-field diff
    // ("Industry: finance → healthcare") instead of just the action verb.
    // The backend already authorises sys_audit_log row access; column-level
    // redaction would need to happen server-side, not by omitting columns here.
    dataSource
      .find('sys_audit_log', {
        $filter: { record_id: pureRecordId, object_name: objectDef.name },
        $orderby: { created_at: 'desc' },
        $top: 50,
        $select: ['id', 'created_at', 'action', 'user_id', 'old_value', 'new_value'],
      })
      .then(async (res: any) => {
        if (cancelled) return;
        const items: any[] = Array.isArray(res) ? res : res?.data || [];

        // 1) Resolve actor display names + avatars in a single batched call
        //    so the timeline never falls back to a raw UUID.
        const userIds = Array.from(
          new Set(
            items
              .map((it) => it?.user_id)
              .filter((v): v is string => typeof v === 'string' && v.length > 0),
          ),
        );
        let userMap = new Map<string, { name?: string | null; image?: string | null }>();
        if (userIds.length > 0) {
          try {
            const usersRes = await dataSource.find('sys_user', {
              $filter: { id: { $in: userIds } },
              $top: userIds.length,
              $select: ['id', 'name', 'email', 'image'],
            });
            const users: any[] = Array.isArray(usersRes) ? usersRes : usersRes?.data || [];
            userMap = new Map(
              users.map((u) => [u.id, { name: u.name || u.email || null, image: u.image || null }]),
            );
          } catch (err) {
            console.warn('[RecordDetailView] Failed to resolve audit user names:', err);
          }
        }

        // 2) Build a label map for the current object so diff lines show
        //    "Industry: …" rather than the snake_case "industry: …".
        const fieldLabels: Record<string, string> = {};
        for (const [name, def] of Object.entries<any>(objectDef.fields || {})) {
          if (def?.label) fieldLabels[name] = def.label;
        }

        const parseJson = (v: any): Record<string, unknown> | null => {
          if (!v) return null;
          if (typeof v === 'object') return v as Record<string, unknown>;
          if (typeof v === 'string') {
            try { return JSON.parse(v); } catch { return null; }
          }
          return null;
        };

        const enriched = items.map((it) => {
          const u = it?.user_id ? userMap.get(it.user_id) : undefined;
          const oldObj = parseJson(it?.old_value) || {};
          const newObj = parseJson(it?.new_value) || {};
          const fields = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
          const changes = Array.from(fields)
            .filter((f) => JSON.stringify(oldObj[f]) !== JSON.stringify(newObj[f]))
            .map((f) => ({
              field: f,
              label: fieldLabels[f] || f,
              from: oldObj[f],
              to: newObj[f],
            }));
          return {
            ...it,
            user_name: u?.name ?? null,
            user_avatar: u?.image ?? null,
            changes: changes.length > 0 ? changes : undefined,
          };
        });

        setHistoryEntries(enriched);
      })
      .catch((err: any) => {
        if (cancelled) return;
        console.warn('[RecordDetailView] Failed to fetch sys_audit_log:', err);
        setHistoryEntries([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => { cancelled = true; };
  }, [dataSource, pureRecordId, objectDef, historyEnabled]);

  // Fetch a directory of active users once per dataSource mount and expose
  // them as @-mention suggestions to the DiscussionContext. Capped at 50 to
  // keep the dropdown tight; hosts can swap in a paginated/server-search
  // implementation later by mounting their own DiscussionContextProvider.
  useEffect(() => {
    if (!dataSource) return;
    let cancelled = false;

    // Always seed with the current user so the @-mention dropdown shows at
    // least one entry even when the backend has no sys_user directory.
    // Hosts wanting a richer roster should provide it via dataSource.
    const selfSuggestion = user
      ? [{
          id: String(user.id),
          label: user.name || user.email || String(user.id),
          avatarUrl: (user as any).image || undefined,
        }]
      : [];

    (async () => {
      try {
        const res = await dataSource.find('sys_user', {
          $top: 50,
          $select: ['id', 'name', 'email', 'image'],
        } as any);
        if (cancelled) return;
        const rows: any[] = Array.isArray(res) ? res : res?.data || [];
        const fetched = rows
          .map((u) => ({
            id: String(u.id),
            label: u.name || u.email || String(u.id),
            avatarUrl: u.image || undefined,
          }))
          .filter((s) => s.label);
        // Merge: current user first, then directory (de-duped by id).
        const seen = new Set(selfSuggestion.map((s) => s.id));
        const merged = [
          ...selfSuggestion,
          ...fetched.filter((s) => !seen.has(s.id)),
        ];
        setMentionSuggestions(merged.length > 0 ? merged : selfSuggestion);
      } catch {
        if (cancelled) return;
        // Fall back to just the current user so mentions still work.
        setMentionSuggestions(selfSuggestion);
      }
    })();
    return () => { cancelled = true; };
  }, [dataSource, user?.id, user?.name, user?.email]);

  // Memoize so the object identity is stable across renders — otherwise
  // any effect that depends on it (e.g. the feed loader below) would
  // re-fire every render and create an infinite request loop.
  const currentUser = useMemo(
    () => (user ? { id: user.id, name: user.name, avatar: user.image } : FALLBACK_USER),
    [user?.id, user?.name, user?.image],
  );

  // Fetch comments from API.
  //
  // NOTE: Record-level presence ("who else is viewing this record") used to
  // be probed here by `dataSource.find('sys_presence', …)`, but that was an
  // architectural mistake: presence is real-time ephemeral state and does
  // not belong in a regular REST collection. The probe has been removed
  // pending a proper transport-level design (WebSocket-backed
  // `<PresenceProvider>` in @object-ui/collaboration). See ROADMAP for the
  // realtime / OCC plan.
  useEffect(() => {
    if (!dataSource || !objectName || !pureRecordId) return;
    const threadId = `${objectName}:${pureRecordId}`;

    // M10.10: Fetch persisted comments from sys_comment. Field names
    // are snake_case to match the platform-objects schema
    // (`packages/platform-objects/src/audit/sys-comment.object.ts`):
    // thread_id, author_id, author_name, author_avatar_url, body,
    // reactions (JSON string), parent_id, created_at, updated_at.
    //
    // Reactions are stored as a JSON object of `{ emoji: string[] }`
    // (one array of user-ids per emoji). The aggregator below counts
    // entries and flags the currently-signed-in user.
    const parseReactions = (raw: unknown): FeedItem['reactions'] => {
      if (!raw) return undefined;
      let parsed: Record<string, string[]> | undefined;
      if (typeof raw === 'string') {
        try { parsed = JSON.parse(raw); } catch { return undefined; }
      } else if (typeof raw === 'object') {
        parsed = raw as Record<string, string[]>;
      }
      if (!parsed) return undefined;
      return Object.entries(parsed).map(([emoji, userIds]) => ({
        emoji,
        count: Array.isArray(userIds) ? userIds.length : 0,
        reacted: Array.isArray(userIds) && userIds.includes(currentUser.id),
      }));
    };

    dataSource.find('sys_comment', { $filter: { thread_id: threadId }, $orderby: { created_at: 'asc' } })
      .then((res: any) => {
        if (!res?.data?.length) return;
        const mapped: FeedItem[] = res.data.map((c: any) => ({
          id: c.id,
          type: 'comment' as const,
          actor: c.author_name ?? 'Unknown',
          actorAvatarUrl: c.author_avatar_url ?? undefined,
          body: c.body ?? '',
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          parentId: c.parent_id ?? undefined,
          reactions: parseReactions(c.reactions),
        }));
        setFeedItems(prev => {
          const byId = new Map<string, FeedItem>();
          for (const item of [...prev, ...mapped]) byId.set(String(item.id), item);
          return Array.from(byId.values()).sort((a, b) => {
            const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
            const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
            return ta - tb;
          });
        });
      })
      .catch(() => {});

    // M10.11: Fetch sys_activity rows for this record and merge into the
    // timeline. plugin-audit's writers populate sys_activity on every
    // create/update/delete of objects that opt-in via enable.activities,
    // so this surface — once wired here — gives us a Salesforce-style
    // "what happened on this record" feed without any per-app glue.
    //
    // We map sys_activity.type to FeedItemType so the existing icon /
    // colour map in RecordActivityTimeline keeps working:
    //   created/updated/deleted/system → 'field_change'
    //   assigned/shared                → 'field_change'
    //   completed                      → 'task'
    //   commented/mentioned            → 'comment'  (but skipped — we
    //                                    already load these from
    //                                    sys_comment to get reactions
    //                                    and threading)
    //
    // sys_activity is system-owned so a 404 ("table not provisioned",
    // older schemas without activities) is silently tolerated.
    const activityTypeToFeed: Record<string, FeedItem['type'] | undefined> = {
      created:   'field_change',
      updated:   'field_change',
      deleted:   'field_change',
      assigned:  'field_change',
      shared:    'field_change',
      system:    'system',
      completed: 'task',
      commented: undefined,
      mentioned: undefined,
      login:     undefined,
      logout:    undefined,
    };
    dataSource.find('sys_activity', {
      $filter: { object_name: objectName, record_id: pureRecordId },
      $orderby: { timestamp: 'asc' },
      $top: 200,
    })
      .then((res: any) => {
        if (!res?.data?.length) return;
        const mapped: FeedItem[] = [];
        for (const row of res.data) {
          const t = activityTypeToFeed[row.type];
          if (!t) continue;
          // Prefer the explicit `timestamp` column, but tolerate older
          // rows where the driver leaked the literal "NOW()" — fall
          // back to created_at (always a real ISO date).
          let when = row.timestamp;
          if (!when || when === 'NOW()' || Number.isNaN(Date.parse(when))) {
            when = row.created_at;
          }
          mapped.push({
            id: row.id,
            type: t,
            actor: row.actor_name ?? 'System',
            actorAvatarUrl: row.actor_avatar_url ?? undefined,
            body: row.summary ?? '',
            createdAt: when,
          } as FeedItem);
        }
        if (!mapped.length) return;
        setFeedItems(prev => {
          // Merge by id (timeline events are append-only); sort by
          // createdAt ascending so the activity panel reads as a
          // chronological narrative.
          const byId = new Map<string, FeedItem>();
          for (const item of [...prev, ...mapped]) {
            byId.set(String(item.id), item);
          }
          return Array.from(byId.values()).sort((a, b) => {
            const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
            const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
            return ta - tb;
          });
        });
      })
      .catch(() => {});
  }, [dataSource, objectName, pureRecordId, currentUser]);

  /**
   * Note: comment-mention → notification fan-out lives on the server
   * (`@objectstack/plugin-audit` registers a `sys_comment` afterInsert hook
   * that parses the `mentions` JSON and calls `messaging.emit('collab.mention')`
   * — ADR-0030 single ingress — which materializes one `sys_inbox_message` per
   * recipient that the bell then reads). The client's only job is to ensure
   * `sys_comment.mentions` carries the real id list (see handleAddComment
   * /handleAddReply below). Deployments without the messaging pipeline will not
   * deliver bell notifications, which is the expected degradation.
   */

  const handleAddComment = useCallback(
    async (text: string) => {
      const newItem: FeedItem = {
        id: crypto.randomUUID(),
        type: 'comment',
        actor: currentUser.name,
        actorAvatarUrl: 'avatar' in currentUser ? (currentUser as any).avatar : undefined,
        body: text,
        createdAt: new Date().toISOString(),
      };
      setFeedItems(prev => [...prev, newItem]);
      // Persist to backend (M10.10: snake_case fields per sys_comment schema)
      if (dataSource) {
        const threadId = `${objectName}:${pureRecordId}`;
        const mentionIds = extractMentions(text, mentionSuggestions);
        dataSource.create('sys_comment', {
          id: newItem.id,
          thread_id: threadId,
          author_id: currentUser.id,
          author_name: currentUser.name,
          author_avatar_url: 'avatar' in currentUser ? (currentUser as any).avatar : undefined,
          body: text,
          mentions: JSON.stringify(mentionIds),
          created_at: newItem.createdAt,
        }).catch(() => {});
      }
    },
    [currentUser, dataSource, objectName, pureRecordId, mentionSuggestions],
  );

  const handleAddReply = useCallback(
    async (parentId: string | number, text: string) => {
      const newItem: FeedItem = {
        id: crypto.randomUUID(),
        type: 'comment',
        actor: currentUser.name,
        actorAvatarUrl: 'avatar' in currentUser ? (currentUser as any).avatar : undefined,
        body: text,
        createdAt: new Date().toISOString(),
        parentId,
      };
      setFeedItems(prev => {
        const updated = [...prev, newItem];
        // Increment replyCount on parent
        return updated.map(item =>
          item.id === parentId
            ? { ...item, replyCount: (item.replyCount ?? 0) + 1 }
            : item
        );
      });
      if (dataSource) {
        const threadId = `${objectName}:${pureRecordId}`;
        const mentionIds = extractMentions(text, mentionSuggestions);
        dataSource.create('sys_comment', {
          id: newItem.id,
          thread_id: threadId,
          author_id: currentUser.id,
          author_name: currentUser.name,
          author_avatar_url: 'avatar' in currentUser ? (currentUser as any).avatar : undefined,
          body: text,
          mentions: JSON.stringify(mentionIds),
          created_at: newItem.createdAt,
          parent_id: parentId,
        }).catch(() => {});
      }
    },
    [currentUser, dataSource, objectName, pureRecordId, mentionSuggestions],
  );

  const handleToggleReaction = useCallback(
    (itemId: string | number, emoji: string) => {
      setFeedItems(prev => prev.map(item => {
        if (item.id !== itemId) return item;
        const reactions = [...(item.reactions ?? [])];
        const idx = reactions.findIndex(r => r.emoji === emoji);
        if (idx >= 0) {
          const r = reactions[idx];
          if (r.reacted) {
            // Remove user's reaction
            if (r.count <= 1) {
              reactions.splice(idx, 1);
            } else {
              reactions[idx] = { ...r, count: r.count - 1, reacted: false };
            }
          } else {
            reactions[idx] = { ...r, count: r.count + 1, reacted: true };
          }
        } else {
          reactions.push({ emoji, count: 1, reacted: true });
        }
        const updated = { ...item, reactions };
        // Persist reactions to backend as JSON. The schema stores
        // `reactions` as a textarea JSON string of `{ emoji: userIds[] }`,
        // so we rebuild the canonical shape from the optimistic local
        // state before writing back. A failed update silently keeps the
        // optimistic UI change (best-effort, surfaced by RUM if needed).
        if (dataSource) {
          const userId = currentUser.id;
          const remoteShape: Record<string, string[]> = {};
          for (const r of reactions) {
            // We don't have the original user-id list locally, so we
            // approximate by emitting the signed-in user when they are
            // the (only known) reactor. This is an over-simplification
            // for single-user pilot installs and will be replaced by a
            // proper backend reaction endpoint in M11.
            const ids: string[] = [];
            if (r.reacted) ids.push(userId);
            // Pad with a synthetic marker so count is preserved across
            // refreshes from other clients (best-effort).
            while (ids.length < r.count) ids.push('__other__');
            remoteShape[r.emoji] = ids;
          }
          dataSource.update('sys_comment', String(itemId), {
            reactions: JSON.stringify(remoteShape),
          }).catch(() => {});
        }
        return updated;
      }));
    },
    [currentUser.id, dataSource],
  );

  useEffect(() => {
    // Reset loading on navigation; the actual DetailView handles data fetching
    setIsLoading(true);
    queueMicrotask(() => setIsLoading(false));
  }, [objectName, recordId]);

  // Build detail schema — must be before early returns to keep hook count
  // consistent across renders and avoid React error #310.
  const detailSchema: DetailViewSchema = useMemo(() => {
    if (!objectDef) {
      return { type: 'detail-view' } as DetailViewSchema;
    }

    // Auto-detect primary field: prefer objectDef metadata, then 'name' or 'title' heuristic
    const primaryField = objectDef.primaryField
      || Object.keys(objectDef.fields || {}).find(
        (key) => key === 'name' || key === 'title'
      );

    // Build sections: prefer form sections from objectDef, fallback to flat field list
    const formSections = objectDef.views?.form?.sections;
    const sections = formSections && formSections.length > 0
      ? formSections.map((sec: any) => ({
          title: sec.name ? sectionLabel(objectDef.name, sec.name, sec.title || sec.name) : sec.title,
          collapsible: sec.collapsible,
          defaultCollapsed: sec.defaultCollapsed,
          fields: (sec.fields || [])
            .filter((f: any) => {
              // Honor `hidden: true` on a field def even when the form
              // section explicitly lists it. Hidden fields are typically
              // internal artifacts (e.g. database URL, environment id)
              // that platform actions read but end-users shouldn't see.
              const fieldName = typeof f === 'string' ? f : f.name;
              const fieldDef = objectDef.fields?.[fieldName];
              return !fieldDef?.hidden;
            })
            .map((f: any) => {
            const fieldName = typeof f === 'string' ? f : f.name;
            const fieldDef = objectDef.fields[fieldName];
            if (!fieldDef) {
              console.warn(`[RecordDetailView] Field "${fieldName}" not found in ${objectDef.name} definition`);
              return { name: fieldName, label: fieldName };
            }
            const refTarget = fieldDef.reference_to || fieldDef.reference;
            return {
              name: fieldName,
              label: fieldDef.label || fieldName,
              type: fieldDef.type || 'text',
              ...(fieldDef.options && { options: fieldDef.options }),
              ...(refTarget && { reference_to: refTarget }),
              ...(fieldDef.reference_field && { reference_field: fieldDef.reference_field }),
              ...(fieldDef.currency && { currency: fieldDef.currency }),
            };
          }),
        }))
      : (() => {
          // Auto-grouping (platform B): when no form sections are authored,
          // split fields into a primary section and a collapsible
          // "More details" section so long-form/secondary fields don't
          // dilute the main grid. The primary section stays untitled so
          // DetailSection still flattens its chrome when alone.
          const allFields = Object.keys(objectDef.fields || {})
            .filter((key) => !AUDIT_FIELD_NAMES.has(key) && !HIDDEN_SYSTEM_FIELD_NAMES.has(key) && !objectDef.fields[key]?.hidden);

          const toField = (key: string) => {
            const fieldDef = objectDef.fields[key];
            const refTarget = fieldDef.reference_to || fieldDef.reference;
            return {
              name: key,
              label: fieldDef.label || key,
              type: fieldDef.type || 'text',
              ...(fieldDef.options && { options: fieldDef.options }),
              ...(refTarget && { reference_to: refTarget }),
              ...(fieldDef.reference_field && { reference_field: fieldDef.reference_field }),
              ...(fieldDef.currency && { currency: fieldDef.currency }),
            };
          };

          const primaryKeys = allFields.filter((k) => !isSecondaryField(k, objectDef.fields[k]));
          const secondaryKeys = allFields.filter((k) => isSecondaryField(k, objectDef.fields[k]));

          // Below ~6 primary fields the second section often looks awkward
          // — keep the legacy single-untitled-section behaviour. Also
          // honour the "no secondary fields" case the same way.
          if (secondaryKeys.length === 0 || primaryKeys.length === 0) {
            return [
              {
                showBorder: false as const,
                fields: allFields.map(toField),
              },
            ];
          }

          return [
            {
              showBorder: false as const,
              fields: primaryKeys.map(toField),
            },
            {
              name: 'details',
              title: sectionLabel(objectDef.name, 'details', t('detail.sectionMoreDetails', 'More details')),
              collapsible: true,
              defaultCollapsed: false,
              showBorder: true as const,
              fields: secondaryKeys.map(toField),
            },
          ];
        })();

    // Audit fields (created_at/created_by/updated_at/updated_by) are NOT
    // appended as a section here — they are surfaced by `<RecordMetaFooter>`
    // (rendered by DetailView) as a single subtle line below the content,
    // replacing the old card-style "System Information" panel. The inline-edit
    // drawer continues to hide them via `DEFAULT_SYSTEM_FIELDS` in
    // `@object-ui/plugin-detail/RecordDetailDrawer`.

    // Filter actions for record_header location and deduplicate by name
    const recordHeaderActions = (() => {
      const seen = new Set<string>();
      const base = (objectDef.actions || []).filter((a: any) => {
        if (!a.locations?.includes('record_header')) return false;
        if (!a.name) return true;
        if (seen.has(a.name)) return false;
        seen.add(a.name);
        return true;
      }).map((a: any) => ({
        ...a,
        label: actionLabel(objectDef.name, a.name, a.label || a.name),
        ...(a.confirmText !== undefined && {
          confirmText: actionConfirm(objectDef.name, a.name, a.confirmText),
        }),
        ...(a.successMessage !== undefined && {
          successMessage: actionSuccess(objectDef.name, a.name, a.successMessage),
        }),
      }));

      // Inject approval actions — only when the current user is a pending
      // approver for this record (ADR-0019: approvals are opened by a flow
      // node, so there is no manual submit/recall; an approver records a
      // decision that resumes the flow down its approve/reject edge).
      if (approvals.available && approvals.canDecide) {
        const commentParam = {
          name: 'comment',
          label: t('approvals.comment', { defaultValue: 'Comment (optional)' }),
          type: 'text',
          multiline: true,
        };
        base.push({
          name: 'approve_request',
          type: 'approval',
          target: 'approve_request',
          label: t('approvals.approve', { defaultValue: 'Approve' }),
          icon: 'check',
          variant: 'default',
          locations: ['record_header'],
          refreshAfter: true,
          collectParams: [commentParam],
          successMessage: t('approvals.approveSuccess', { defaultValue: 'Approved' }),
        });
        base.push({
          name: 'reject_request',
          type: 'approval',
          target: 'reject_request',
          label: t('approvals.reject', { defaultValue: 'Reject' }),
          icon: 'x',
          variant: 'destructive',
          locations: ['record_header'],
          refreshAfter: true,
          confirmText: t('approvals.rejectConfirm', {
            defaultValue: 'Reject this approval request?',
          }),
          collectParams: [commentParam],
          successMessage: t('approvals.rejectSuccess', { defaultValue: 'Rejected' }),
        });
      }

      return base;
    })();

    // Build highlightFields: exclusively from objectDef metadata (no hardcoded fallback)
    const highlightFields: HighlightField[] = objectDef.views?.detail?.highlightFields ?? [];

    // Build sectionGroups from objectDef detail/form config if available
    const sectionGroups: SectionGroup[] | undefined =
      objectDef.views?.detail?.sectionGroups ?? objectDef.views?.form?.sectionGroups;

    // Build related entries from reverse-reference child objects.
    // `referenceField` is the FK field on the child pointing back to this
    // record — passed so the related-list renderer can hide the redundant
    // parent-ID column. Each entry carries action handlers that the renderer
    // surfaces as header `+ New` / `View All` buttons and per-row Edit /
    // Delete controls.
    const baseAppUrl = appName ? `/apps/${appName}` : '';
    const related = childRelations.map(({ childObject, childLabel, referenceField, title: titleOverride, columns: columnsOverride }) => {
      const childObjectDef = objects.find((o: any) => o.name === childObject);
      const parentId = pureRecordId || '';
      // A `relatedListTitle` on the relationship wins; else fall back to the
      // localized child-object label.
      const localizedTitle = titleOverride
        || (childObjectDef
          ? objectLabel({ name: childObjectDef.name, label: childObjectDef.label || childLabel })
          : childLabel);

      const buildNewUrl = () => {
        const qs = new URLSearchParams({ [referenceField]: parentId }).toString();
        return `${baseAppUrl}/${childObject}/new${qs ? `?${qs}` : ''}`;
      };
      const buildListUrl = () => {
        const qs = new URLSearchParams({
          [`filter[${referenceField}]`]: parentId,
        }).toString();
        return `${baseAppUrl}/${childObject}${qs ? `?${qs}` : ''}`;
      };
      const buildEditUrl = (row: any) => {
        const rid = row?.id || row?._id;
        if (!rid) return null;
        return `${baseAppUrl}/${childObject}/record/${encodeURIComponent(String(rid))}/edit`;
      };
      const buildRecordUrl = (row: any) => {
        const rid = row?.id || row?._id;
        if (!rid) return null;
        return `${baseAppUrl}/${childObject}/record/${encodeURIComponent(String(rid))}`;
      };

      const onNew = baseAppUrl
        ? () => navigate(buildNewUrl())
        : undefined;
      const onViewAll = baseAppUrl
        ? () => navigate(buildListUrl())
        : undefined;
      const onRowClick = baseAppUrl
        ? (row: any) => {
            const url = buildRecordUrl(row);
            if (url) navigate(url);
          }
        : undefined;
      const onRowEdit = baseAppUrl
        ? (row: any) => {
            const url = buildEditUrl(row);
            if (url) navigate(url);
          }
        : undefined;
      const onRowDelete = dataSource && parentId
        ? async (row: any) => {
            const rid = row?.id || row?._id;
            if (!rid) return;
            try {
              await dataSource.delete(childObject, rid);
              toast.success(t('detail.deleteSuccess', { defaultValue: 'Deleted' }));
              setChildRelatedData((prev) => ({
                ...prev,
                [childObject]: (prev[childObject] || []).filter(
                  (r: any) => (r.id || r._id) !== rid,
                ),
              }));
            } catch (err: any) {
              toast.error(err?.message || t('detail.deleteError', { defaultValue: 'Delete failed' }));
            }
          }
        : undefined;

      return {
        title: localizedTitle,
        type: 'table' as const,
        api: childObject,
        data: childRelatedData[childObject] || [],
        referenceField,
        // Explicit columns from `relatedListColumns` on the relationship; when
        // absent the related-list renderer auto-derives them from the child
        // object's fields.
        ...(Array.isArray(columnsOverride) && columnsOverride.length > 0
          ? { columns: columnsOverride }
          : {}),
        icon: childObjectDef?.icon,
        // Surface the child object's canonical display field so the
        // right-rail can show meaningful labels (`user_agent`, `email`,
        // …) instead of opaque IDs like `kCc8mhJr0bRs0r9Ykd09…`.
        displayField:
          childObjectDef?.displayNameField ||
          (Array.isArray(childObjectDef?.compactLayout)
            ? childObjectDef.compactLayout[0]
            : undefined),
        onNew,
        onViewAll,
        onRowClick,
        onRowEdit,
        onRowDelete,
      };
    });

    const affordances = resolveCrudAffordances(objectDef as any);
    return {
      type: 'detail-view' as const,
      objectName: objectDef.name,
      resourceId: pureRecordId,
      showBack: !embedded,
      onBack: 'history',
      // Hide the Edit button for objects whose lifecycle isn't user-managed
      // (approval requests, audit logs, better-auth tables, …).  The
      // underlying form is also disabled when `managedBy !== 'platform'`
      // (see plugin-form/ObjectForm), so even if a stray Edit URL is
      // visited the inputs render read-only.
      showEdit: affordances.edit,
      title: objectDef.label,
      primaryField,
      sections,
      autoTabs: true,
      autoDiscoverRelated: true,
      ...(historyEnabled && {
        history: {
          entries: historyEntries ?? [],
          loading: historyLoading && historyEntries === null,
        },
      }),
      ...(related.length > 0 && { related }),
      ...(highlightFields.length > 0 && { highlightFields }),
      ...(sectionGroups && sectionGroups.length > 0 && { sectionGroups }),
      ...(recordHeaderActions.length > 0 && {
        actions: [{
          type: 'action:bar',
          location: 'record_header',
          actions: recordHeaderActions,
        } as any],
      }),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectDef?.name, pureRecordId, childRelatedData, actionRefreshKey, appName, navigate, dataSource, t, objectLabel, objects, historyEnabled, historyEntries, historyLoading, approvals.available, approvals.canDecide, approvals.pendingRequest, approvals.latestRequest, embedded]);

  if (isLoading) {
    return <SkeletonDetail />;
  }

  if (!objectDef) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Empty>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Database className="h-6 w-6 text-muted-foreground" />
          </div>
          <EmptyTitle>{t('empty.objectNotFound')}</EmptyTitle>
          <EmptyDescription>
            {t('empty.objectNotFoundDescription', { name: objectName })}
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  // Record-not-found short-circuit. Previously we rendered the page chrome
  // (rail, discussion, breadcrumb with the truncated raw id) even when the
  // record didn't exist, which made invalid links look like a partially-
  // broken page instead of a clean 404. Only triggers on the synth/page
  // path; the legacy DetailView path handles missing records itself.
  if (effectivePage && pageRecordStatus === 'missing') {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Empty>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Database className="h-6 w-6 text-muted-foreground" />
          </div>
          <EmptyTitle>{t('empty.recordNotFound', { defaultValue: 'Record not found' })}</EmptyTitle>
          <EmptyDescription>
            {t('empty.recordNotFoundDescription', {
              defaultValue:
                'The record you are looking for does not exist or may have been deleted.',
            })}
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  if (effectivePage) {
    const disableDiscussion = (effectivePage as any)?.disableDiscussion === true;
    // When the page schema embeds an explicit `record:discussion` /
    // `record:chatter` slot, skip the bottom auto-append so the
    // author placement (or synth default) wins. The walker recurses
    // into `regions[]` so `buildDefaultPageSchema` output and
    // full-Lightning authored pages are both detected.
    const hasDiscussion = hasExplicitDiscussion(effectivePage as any);
    const showAutoDiscussion = !disableDiscussion && !hasDiscussion;
    // Slice 2 — when we're synthesizing (no author assignedPage), rebuild
    // the schema with the actual detailSchema.sections + highlight fields
    // so record:details renders the same field layout the legacy
    // DetailView would have produced.
    // Slice 4 — also forward header actions, related lists, activities,
    // and history so the synthesized page reaches parity with the
    // monolithic DetailView (tabs strip + record_header quick actions).
    // Business / custom actions authored on objectDef and routed to the
    // record_header location (e.g. Lead.convert, Contact.set_primary).
    const synthBusinessActions: ActionDef[] = (() => {
      const acts = (detailSchema as any).actions;
      if (!Array.isArray(acts)) return [];
      // detailSchema wraps actions in a `{type:'action:bar', actions:[]}`
      // shape; unwrap to the flat ActionDef[] the renderer expects.
      const bar = acts.find((a: any) => Array.isArray(a?.actions));
      const flat = bar?.actions ?? acts;
      return Array.isArray(flat) ? flat : [];
    })();

    // System actions (Edit / Share / Delete) — the legacy DetailView
    // monolith always synthesized these. The synth-path replacement
    // (Phase G slice 6) initially dropped them, leaving objects without
    // authored record_header actions with a bare header. Re-inject here
    // so every record page surfaces the basic affordances.
    const synthSystemActions: ActionDef[] = (() => {
      const affordances = resolveCrudAffordances(objectDef as any);
      const items: ActionDef[] = [];
      if (affordances.edit) {
        // Inline-edit toggle. Surfaced ABOVE `sys_edit` so the
        // overflow menu lists field-level editing first — Lightning /
        // HubSpot put inline edit ("Edit details") above the modal /
        // form-page edit because in-page editing is the higher-frequency
        // interaction. Communicates with DetailView via a window event
        // so we don't need to lift inline-edit state out of the plugin.
        items.push({
          name: 'sys_inline_edit',
          label: t('detail.editFieldsInline', { defaultValue: 'Edit fields' }),
          type: 'script',
          locations: ['record_header'],
          variant: 'outline',
          onClick: () => {
            window.dispatchEvent(new CustomEvent('objectui:record:inline-edit-toggle', {
              detail: { recordId: pureRecordId, objectName },
            }));
          },
        } as any);
        items.push({
          name: 'sys_edit',
          label: t('detail.edit', { defaultValue: 'Edit' }),
          type: 'script',
          locations: ['record_header'],
          variant: 'default',
          onClick: () => onEdit({ id: pureRecordId }),
        } as any);
      }
      items.push({
        name: 'sys_share',
        label: t('detail.share', { defaultValue: 'Share' }),
        type: 'script',
        locations: ['record_header'],
        variant: 'outline',
        onClick: async () => {
          try {
            if ((navigator as any).share) {
              await (navigator as any).share({
                title: document.title,
                url: window.location.href,
              });
              return;
            }
          } catch {
            // user dismissed the native share sheet — no-op
            return;
          }
          // Fallback path: clipboard. Surface failure to the user so we
          // never silently no-op (e.g. when clipboard access is denied
          // because the page is not focused or running over http://).
          try {
            await navigator.clipboard.writeText(window.location.href);
            toast.success(t('detail.linkCopied', { defaultValue: 'Link copied' }));
          } catch (err: any) {
            toast.error(
              t('detail.linkCopyFailed', { defaultValue: 'Failed to copy link' }) +
                (err?.message ? `: ${err.message}` : ''),
            );
          }
        },
      } as any);
      if (affordances.delete) {
        items.push({
          name: 'sys_delete',
          label: t('detail.delete', { defaultValue: 'Delete' }),
          type: 'script',
          locations: ['record_header'],
          variant: 'destructive',
          onClick: async () => {
            const msg = t('detail.deleteConfirmation', {
              defaultValue: 'Are you sure you want to delete this record?',
            });
            if (!window.confirm(msg)) return;
            try {
              await dataSource.delete(objectName!, pureRecordId!);
              toast.success(t('detail.deleted', { defaultValue: 'Record deleted' }));
              const baseAppUrl = appName ? `/apps/${appName}` : '';
              navigate(`${baseAppUrl}/${objectName}`, { replace: true });
            } catch (err: any) {
              toast.error(err?.message || 'Delete failed');
            }
          },
        } as any);
      }
      return items;
    })();

    // The synth path now hands ONLY business actions to the page schema.
    // System actions (Edit / Share / Delete) ride through
    // `RecordContext.headerSystemActions` instead, so they reach both
    // synth/slotted pages AND authored full-Lightning pages without
    // mutating the assignedPage tree. `PageHeaderRenderer` dedupes by
    // name so authored business actions still win on collision.
    const synthHeaderActions = synthBusinessActions.length > 0 ? synthBusinessActions : undefined;
    const synthRelated = Array.isArray((detailSchema as any).related)
      ? ((detailSchema as any).related as any[])
          .filter((r) => r?.api && r?.referenceField)
          .map((r) => ({
            title: r.title,
            objectName: r.api,
            relationshipField: r.referenceField,
            ...(Array.isArray(r.columns) ? { columns: r.columns } : {}),
            ...(typeof r.pageSize === 'number' ? { limit: r.pageSize } : {}),
            ...(r.icon ? { icon: r.icon } : {}),
          }))
      : undefined;
    const synthHistory = (detailSchema as any).history
      ? {
          entries: ((detailSchema as any).history.entries as any[]) ?? [],
          loading: !!(detailSchema as any).history.loading,
          emptyText: (detailSchema as any).history.emptyText,
        }
      : undefined;
    const renderedPage = assignedPage
      ? effectivePage
      : buildDefaultPageSchema(objectDef as any, {
          sections: (detailSchema as any).sections,
          highlightFields: Array.isArray((detailSchema as any).highlightFields)
            ? ((detailSchema as any).highlightFields as any[])
                .map((f) => (typeof f === 'string' ? f : f?.name))
                .filter((n): n is string => !!n)
            : undefined,
          headerActions: synthHeaderActions,
          related: synthRelated,
          history: synthHistory,
          // Per-object opt-outs read from `objectDef.detail.*`. Lets
          // catalog/atomic objects (product, task, ...) keep a focused
          // single-column layout instead of inheriting the rail.
          showReferenceRail:
            (objectDef as any)?.detail?.showReferenceRail === true || undefined,
          hideReferenceRail:
            (objectDef as any)?.detail?.hideReferenceRail === true || undefined,
          hideRelatedTab:
            (objectDef as any)?.detail?.hideRelatedTab === true || undefined,
          ...(assignedSlots ? { slots: assignedSlots } : {}),
        });
    return (
      <div className="h-full bg-background overflow-hidden flex flex-col relative">
        {/* Shared cross-cutting chrome: lifecycle badge + presence avatars.
            Mirrors the default branch so custom Page-assigned record pages
            don't lose these affordances. */}
        <div className="absolute top-2 sm:top-4 right-2 sm:right-4 z-50 flex items-center gap-2">
          {recordPresence.length > 0 && (
            <PresenceAvatars users={recordPresence} size="sm" maxVisible={3} showStatus />
          )}
          <ManagedByBadge managedBy={(objectDef as any)?.managedBy} />
        </div>

        <RecordContextProvider
          objectName={objectName!}
          recordId={pureRecordId}
          data={pageRecord}
          objectSchema={objectDef}
          dataSource={dataSource}
          embedded={embedded}
          headerSystemActions={synthSystemActions}
          isFavorite={isRecordFavorite}
          onToggleFavorite={favoriteRecord ? handleToggleRecordFavorite : undefined}
        >
          <HighlightFieldsProvider>
          <DiscussionContextProvider
            items={feedItems as any}
            onAddComment={handleAddComment as any}
            onAddReply={handleAddReply as any}
            onToggleReaction={handleToggleReaction as any}
            mentionSuggestions={mentionSuggestions}
          >
          <ActionProvider
            context={{ record: pageRecord || {}, objectName, user: currentUser }}
            onConfirm={confirmHandler}
            onToast={toastHandler}
            onNavigate={navigateHandler}
            onParamCollection={paramCollectionHandler}
            onResultDialog={resultDialogHandler}
            onModal={modalHandler}
            handlers={{ api: apiHandler, flow: flowHandler, script: serverActionHandler, approval: approvalHandler }}
          >
            <div className="flex-1 overflow-hidden flex flex-row">
              <div className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6 scroll-pb-48">
                {originFrom?.pathname && originFrom?.label && (
                  <Link
                    to={originFrom.pathname}
                    className="inline-flex items-center gap-1 mb-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>{originFrom.label}</span>
                  </Link>
                )}
                <SchemaRenderer schema={renderedPage as any} />
                {/* Auto-append RecordChatterPanel only when the page
                    schema doesn't already place a `record:discussion` /
                    `record:chatter` component. Hard opt-out via
                    `assignedPage.disableDiscussion = true`. */}
                {showAutoDiscussion && (
                  <div className="mt-6">
                    <RecordChatterPanel
                      config={{
                        position: 'bottom',
                        collapsible: false,
                        feed: {
                          enableReactions: true,
                          enableThreading: true,
                          showCommentInput: true,
                        },
                      }}
                      items={feedItems}
                      onAddComment={handleAddComment}
                      onAddReply={handleAddReply}
                      onToggleReaction={handleToggleReaction}
                      mentionSuggestions={mentionSuggestions}
                    />
                  </div>
                )}
              </div>
              <MetadataPanel
                open={showDebug}
                sections={[{ title: 'Page Schema', data: renderedPage }]}
              />
            </div>
            {modalElement}
          </ActionProvider>
          </DiscussionContextProvider>
          </HighlightFieldsProvider>
        </RecordContextProvider>

        {/* Action Confirm Dialog */}
        <ActionConfirmDialog
          state={confirmState}
          onOpenChange={(open) => {
            if (!open) setConfirmState(s => ({ ...s, open: false }));
          }}
        />

        {/* Action Param Collection Dialog */}
        <ActionParamDialog
          state={paramState}
          onOpenChange={(open) => {
            if (!open) setParamState(s => ({ ...s, open: false }));
          }}
        />

        {/* Action Result Reveal Dialog */}
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
          onClose={() => setScreenFlow(null)}
          onComplete={() => { setScreenFlow(null); setActionRefreshKey(k => k + 1); }}
        />
      </div>
    );
  }

  return (
    <div className="h-full bg-background overflow-hidden flex flex-col relative">
      <div className="absolute top-2 sm:top-4 right-2 sm:right-4 z-50 flex items-center gap-2">
        {/* Lifecycle bucket indicator. Replaces the previous full-width
            ManagedByBanner — see ManagedByBadge for the rationale.
            Record-scoped presence avatars are sourced from the
            <PresenceProvider> context and render only when at least one
            other user is viewing this record — invisible until a
            realtime transport is wired by the host app. */}
        {recordPresence.length > 0 && (
          <PresenceAvatars users={recordPresence} size="sm" maxVisible={3} showStatus />
        )}
        <ManagedByBadge managedBy={(objectDef as any)?.managedBy} />
      </div>

      <div className="flex-1 overflow-hidden flex flex-row">
        <div className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6 scroll-pb-48">
          <ActionProvider
            context={{ record: {}, objectName, user: currentUser }}
            onConfirm={confirmHandler}
            onToast={toastHandler}
            onNavigate={navigateHandler}
            onParamCollection={paramCollectionHandler}
            onResultDialog={resultDialogHandler}
            onModal={modalHandler}
            handlers={{ api: apiHandler, flow: flowHandler, script: serverActionHandler, approval: approvalHandler }}
          >
            <DetailView
              key={actionRefreshKey}
              schema={detailSchema}
              dataSource={dataSource}
              objectLabel={objectLabel({ name: objectDef.name, label: objectDef.label })}
              isFavorite={isRecordFavorite}
              onToggleFavorite={favoriteRecord ? handleToggleRecordFavorite : undefined}
              onDataLoaded={(record) => {
                if (!record || typeof record !== 'object') return;
                // Resolve the same way DetailView's header does, so the
                // breadcrumb matches the on-page title (e.g. "David Kim"
                // instead of "#lead-1778…").
                const resolved = getRecordDisplayName(objectDef, record);
                if (resolved && resolved !== recordTitle && resolved !== 'Untitled') {
                  setRecordTitle(resolved);
                }
              }}
              onEdit={() => {
                onEdit({ id: pureRecordId });
              }}
              discussionSlot={
                <RecordChatterPanel
                  config={{
                    position: 'bottom',
                    collapsible: false,
                    feed: {
                      enableReactions: true,
                      enableThreading: true,
                      showCommentInput: true,
                    },
                  }}
                  items={feedItems}
                  onAddComment={handleAddComment}
                  onAddReply={handleAddReply}
                  onToggleReaction={handleToggleReaction}
                />
              }
            />
            {modalElement}
          </ActionProvider>
        </div>
        <MetadataPanel
          open={showDebug}
          sections={[{ title: 'View Schema', data: detailSchema }]}
        />
      </div>

      {/* Action Confirm Dialog */}
      <ActionConfirmDialog
        state={confirmState}
        onOpenChange={(open) => {
          if (!open) setConfirmState(s => ({ ...s, open: false }));
        }}
      />

      {/* Action Param Collection Dialog */}
      <ActionParamDialog
        state={paramState}
        onOpenChange={(open) => {
          if (!open) setParamState(s => ({ ...s, open: false }));
        }}
      />

      {/* Action Result Reveal Dialog */}
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
        onClose={() => setScreenFlow(null)}
        onComplete={() => { setScreenFlow(null); setActionRefreshKey(k => k + 1); }}
      />
    </div>
  );
}
