/**
 * RecordDetailView Component
 *
 * Renders a detail view for a single record, resolved by URL params.
 * Renders via the SchemaRenderer Page pipeline: an authored
 * PageSchema(pageType='record') when one is assigned, else a canonical
 * default page synthesized from the object definition
 * (`buildDefaultPageSchema`).
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { RecordChatterPanel, InlineEditSaveBar, buildDefaultPageSchema, deriveFieldGroupDetailSections, extractMentions } from '@object-ui/plugin-detail';
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import { useAuth, createAuthenticatedFetch } from '@object-ui/auth';
import { ActionProvider, useObjectTranslation, useObjectLabel, usePageAssignment, RecordContextProvider, SchemaRenderer, DiscussionContextProvider, HighlightFieldsProvider, InlineEditProvider, useGlobalUndo, useDataInvalidation, notifyDataChanged } from '@object-ui/react';
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
import { RelatedRecordActionsBridge } from './RelatedRecordActionsBridge';
import { withPageTabsUrlSync } from '../utils/pageTabsUrlSync';
import { RECORD_DETAIL_TAB_PARAM, RECORD_TRAIL_PARAM, decodeRecordTrail, buildRecordTrailHref } from '../urlParams';
import { resolveActionParams } from '../utils/resolveActionParams';
import { useRecordBreadcrumbTitle } from '../context/NavigationContext';
import type { FeedItem } from '@object-ui/types';
import type { ActionDef, ActionParamDef } from '@object-ui/core';
import { useRecordApprovals } from '../hooks/useRecordApprovals';
import { RecordAttachmentsPanel } from './RecordAttachmentsPanel';
import { RecordPermissionAssignmentsRenderer } from './metadata-admin/RecordPermissionAssignmentsRenderer';
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
 * auto-generated sections. Authors who really want to surface one can
 * assign it to a `fieldGroups` group explicitly (explicit listing wins).
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
  const { user, activeOrganization } = useAuth();
  const navigate = useNavigate();
  // objectui#2257 — the active detail tab is URL-addressable (`?tab=`), so it
  // survives the page subtree remounting (refreshKey-style save refreshes;
  // dev-StrictMode URL churn). Written with `replace` — switching tabs must
  // not stack history entries (Back would page through tabs and fight the
  // overlay contract where Back closes `?form=…`).
  const [tabSearchParams, setTabSearchParams] = useSearchParams();
  const activeTabParam = tabSearchParams.get(RECORD_DETAIL_TAB_PARAM) ?? undefined;
  const handleTabChange = useCallback((value: string) => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get(RECORD_DETAIL_TAB_PARAM) === value) return;
    sp.set(RECORD_DETAIL_TAB_PARAM, value);
    setTabSearchParams(sp, { replace: true });
  }, [setTabSearchParams]);
  const location = useLocation();
  // Inline "← back to parent" link shown above the record body. Prefers an
  // explicit history-state `from` (legacy, in-session only), then falls back
  // to the last ancestor in the `?from=` URL trail — which, unlike history
  // state, survives refresh and shared links. This is the immediate-parent
  // affordance; the full clickable path lives in the top-bar breadcrumb.
  const originFromState = (location.state as any)?.from as { pathname?: string; label?: string } | undefined;
  const originFrom = useMemo<{ pathname?: string; label?: string } | undefined>(() => {
    if (originFromState?.pathname && originFromState?.label) return originFromState;
    const trail = decodeRecordTrail(new URLSearchParams(location.search).get(RECORD_TRAIL_PARAM));
    const parent = trail[trail.length - 1];
    if (!parent) return undefined;
    const baseAppUrl = appName ? `/apps/${appName}` : '';
    const shortId = parent.i.length > 12 ? `${parent.i.slice(0, 8)}…` : parent.i;
    return {
      pathname: buildRecordTrailHref(baseAppUrl, parent, trail.slice(0, -1)),
      label: parent.t || `#${shortId}`,
    };
  }, [originFromState, location.search, appName]);
  const { t } = useObjectTranslation();
  const { objectLabel, viewLabel: _vLabel, sectionLabel, actionLabel, actionConfirm, actionSuccess, actionParamText, actionParamOptionLabel, actionDescription, fieldLabel, fieldOptionLabel } = useObjectLabel();
  const { isFavorite, toggleFavorite, refreshLabel: refreshFavoriteLabel } = useFavorites();
  const { addRecentItem } = useRecentItems();
  const [isLoading, setIsLoading] = useState(true);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [mentionSuggestions, setMentionSuggestions] = useState<
    Array<{ id: string; label: string; avatarUrl?: string }>
  >([]);
  // Screen-flow runtime: a paused `screen`-node flow launched from a record action.
  const [screenFlow, setScreenFlow] = useState<ScreenFlowState | null>(null);
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
  // #2269 — "refresh data, don't rebuild UI": after an action/save succeeds
  // we INVALIDATE this record on the bus instead of bumping a key that
  // remounted the whole DetailView (destroying tab/scroll/inline-edit state).
  // `recordInvalidationNonce` is the read side: it bumps when THIS record (or
  // its object) is invalidated by anyone — the form overlay, an action, an
  // undo, or any dataSource write via the MutationEvent bridge.
  const recordInvalidationNonce = useDataInvalidation(objectName || undefined, pureRecordId || undefined);
  const notifyRecordChanged = useCallback(() => {
    if (objectName) notifyDataChanged({ objectName, recordId: pureRecordId || undefined });
  }, [objectName, pureRecordId]);

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
  // PageRenderer in @object-ui/components). Otherwise the no-assignedPage
  // branch synthesizes a canonical Page via `buildDefaultPageSchema(objectDef)`
  // so the default detail page rides the same SchemaRenderer pipeline as
  // custom pages. (ADR-0085 PR4 removed the legacy DetailView monolith and
  // its `renderViaSchema` kill-switch — schema-driven is the only path.)
  const { page: assignedPage, slots: assignedSlots } = usePageAssignment(objectName);
  const synthesizedPage = useMemo(() => {
    // Synthesizer drives two cases:
    //   1) no assignedPage at all → pure default detail page
    //   2) assignedSlots (slotted page) → synth with slot overrides
    // In either case the page-record load effect below only needs
    // "is there a page?"; the fully-detailed schema is rebuilt at
    // render time once the synth parts (sections, related, …) are known.
    if (assignedPage) return null;
    if (!objectDef) return null;
    return buildDefaultPageSchema(objectDef as any, assignedSlots ? { slots: assignedSlots } : undefined);
  }, [assignedPage, assignedSlots, objectDef]);
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
    // #2269: recordInvalidationNonce re-runs this fetch in place whenever the
    // record (or its object) is invalidated on the bus.
  }, [effectivePage, objectName, pureRecordId, dataSource, objectDef, recordInvalidationNonce]);

  // Derive a human-readable record title from the loaded `pageRecord` so
  // favourites (record:*) and the breadcrumb show e.g. "Acme Corporation"
  // instead of the raw record id.
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
      // Related-list row actions retarget a CHILD object (e.g. sys_member rows
      // on an org record page) and stash the clicked row under
      // `params._rowRecord` — resolve field-backed params against the
      // action's own object and pre-fill `defaultFromRow` from the row, with
      // the page object only as fallback (mirrors useConsoleActionRuntime).
      const actionObject = typeof action?.objectName === 'string' && action.objectName
        ? action.objectName
        : undefined;
      const row = action?.params && !Array.isArray(action.params)
        ? (action.params as Record<string, any>)._rowRecord
        : undefined;
      const resolved = resolveActionParams(params as any, {
        objectName: actionObject || objectName || objectDef?.name || '',
        objects: objects || [],
        fieldLabel,
        fieldOptionLabel,
        row,
      });
      // Localize param label/placeholder/helpText (see ObjectView for the
      // convention); falls back to the metadata literal.
      const objForI18n = actionObject || objectName || objectDef?.name;
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
        // Title the dialog as the action rather than the generic "Action parameters".
        title: action?.label || action?.title,
        description: actionDescription(objForI18n, action?.name, action?.description),
        resolve,
      });
    });
  }, [objectName, objectDef, objects, fieldLabel, fieldOptionLabel, actionParamText, actionParamOptionLabel]);

  // Global undo/redo (Ctrl+Z), backed by the dataSource — the success toast's
  // "Undo" button (for `undoable` actions) restores the record's prior values.
  const undoCtl = useGlobalUndo({
    dataSource,
    onUndo: (op: any) => {
      if (op?.objectName) notifyDataChanged({ objectName: op.objectName, recordId: op.recordId });
      else notifyRecordChanged();
      toast.success('Change undone');
    },
  });

  const toastHandler = useCallback((message: string, options?: { type?: string; duration?: number; undo?: { label?: string } }) => {
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

  const navigateHandler = useCallback((url: string, options?: { external?: boolean; newTab?: boolean }) => {
    if (options?.external || options?.newTab) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      navigate(url);
    }
  }, [navigate]);

  // Authenticated fetch for direct backend calls (absolute `type:'api'`
  // targets below + the flow trigger). Declared before apiHandler.
  const authFetch = useMemo(() => createAuthenticatedFetch(), []);

  // API action handler — absolute HTTP targets go to the backend verbatim
  // (the canonical `type:'api'` semantics); logical targets map to
  // dataSource operations.
  const apiHandler = useCallback(async (action: ActionDef) => {
    try {
      const target = action.target || action.name;
      const rowRecord = action.params && !Array.isArray(action.params)
        ? ((action.params as Record<string, any>)._rowRecord as Record<string, any> | undefined)
        : undefined;
      const params: Record<string, any> = { ...(action.params || {}) };
      delete params._rowRecord;

      // Absolute HTTP target — mirror of useConsoleActionRuntime.apiHandler's
      // canonical branch (fetch + recordIdParam/bodyExtra/bodyShape +
      // active-org injection for better-auth endpoints). The legacy
      // dataSource.update mapping below MUST NOT see these: routing a
      // better-auth row action (remove_member / update_member_role) through
      // it either silently no-opped (no collected params) or bypassed
      // better-auth with a raw table write on a managed identity table.
      const targetStr = typeof target === 'string' ? target : '';
      if (targetStr.startsWith('/') || /^https?:\/\//i.test(targetStr)) {
        const baseUrl = import.meta.env.VITE_SERVER_URL || '';
        // Interpolate `{field}` tokens in the target URL from the row record.
        let resolvedTarget = targetStr;
        if (rowRecord && /\{[a-z_][a-z0-9_]*\}/i.test(resolvedTarget)) {
          resolvedTarget = resolvedTarget.replace(/\{([a-z_][a-z0-9_]*)\}/gi, (_, k) => {
            const v = rowRecord[k];
            return v == null ? '' : encodeURIComponent(String(v));
          });
        }
        const url = resolvedTarget.startsWith('http') ? resolvedTarget : `${baseUrl}${resolvedTarget}`;

        const wrap = action.bodyShape && typeof action.bodyShape === 'object' && (action.bodyShape as any).wrap
          ? (action.bodyShape as any).wrap
          : undefined;
        const body: Record<string, any> = wrap ? { [wrap]: params } : { ...params };

        if (action.recordIdParam) {
          const rowField = (action as any).recordIdField || 'id';
          const rowValue = rowRecord?.[rowField] ?? (action as any).recordId
            ?? (!action.objectName || action.objectName === objectName ? (pageRecord as any)?.[rowField] : undefined);
          if (rowValue != null) body[action.recordIdParam] = rowValue;
        }

        // better-auth org endpoints resolve the session's active org; pass it
        // explicitly so row actions stay correct mid-org-switch.
        if (/\/api\/v1\/auth\//.test(resolvedTarget) && !body.organizationId && activeOrganization?.id) {
          body.organizationId = activeOrganization.id;
        }
        if (action.bodyExtra && typeof action.bodyExtra === 'object') {
          Object.assign(body, action.bodyExtra);
        }

        const method = (action.method || 'POST').toUpperCase();
        const init: any = {
          method,
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        };
        if (method !== 'GET' && method !== 'DELETE') init.body = JSON.stringify(body);
        const res = await authFetch(url, init);
        if (!res.ok) {
          let errBody: any = null;
          try { errBody = await res.json(); } catch { /* response body not JSON */ }
          const detail = errBody?.error?.message || errBody?.error || errBody?.message || `HTTP ${res.status}`;
          return { success: false, error: typeof detail === 'string' ? detail : `HTTP ${res.status}` };
        }
        const data = await res.json().catch(() => ({}));
        if (action.refreshAfter === true) notifyRecordChanged();
        return { success: true, data, reload: action.refreshAfter === true };
      }

      // Merge `bodyExtra` constant fields into the update payload. Per the
      // ActionSchema contract these are "applied last; overrides user params",
      // and the PageView/list executeAPI path already honors them. Without this
      // merge, a pure-confirm action (confirmText, no `params` array — the
      // trigger carried entirely in `bodyExtra`) collects empty `params`, so the
      // generic `default` branch below skips the update and the action silently
      // no-ops on the record-detail page while working from a list row.
      if (action.bodyExtra && typeof action.bodyExtra === 'object') {
        Object.assign(params, action.bodyExtra);
      }

      let undo: any;
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
        default: {
          // Generic: update record with collected params. Related-list row
          // actions retarget a CHILD record via explicit `objectName`/`recordId`;
          // otherwise the update falls back to this page's record.
          const targetObject = action.objectName ?? objectName;
          const targetId = (action as any).recordId ?? pureRecordId;
          const isThisRecord =
            targetObject === objectName && String(targetId) === String(pureRecordId);
          if (Object.keys(params).length > 0 && targetObject && targetId != null) {
            // Undoable single-record update: capture the changed fields' prior
            // values from the loaded record so the success toast can offer Undo.
            // Only this page's record has its prior values loaded, so child-row
            // updates skip undo capture.
            if (action.undoable && isThisRecord && pageRecord) {
              const undoData: Record<string, unknown> = {};
              for (const k of Object.keys(params)) undoData[k] = (pageRecord as any)[k] ?? null;
              undo = {
                id: `undo-${targetObject}-${targetId}-${Date.now()}`,
                type: 'update',
                objectName: targetObject,
                recordId: String(targetId),
                timestamp: Date.now(),
                description: action.label || `Undo ${targetObject}`,
                undoData,
                redoData: { ...params },
              };
            }
            await dataSource.update(targetObject, String(targetId), params);
          }
          break;
        }
      }

      const shouldRefresh = action.refreshAfter === true;
      if (shouldRefresh) {
        notifyRecordChanged();
      } else if (undo) {
        // Even when refreshAfter isn't set, reflect the change so the user sees
        // it (and the subsequent Undo) on the open record.
        notifyRecordChanged();
      }
      return { success: true, reload: shouldRefresh, undo };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, [dataSource, objectName, pureRecordId, pageRecord, authFetch, activeOrganization]);

  // Client-side modal transport: `type:'modal'` actions open here (Dialog /
  // Sheet / Drawer by `placement`) and render arbitrary SchemaNode content.
  const { modalHandler, modalElement } = useActionModal(dataSource);

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
            // Related-list row actions retarget the flow at a CHILD record via
            // an explicit `recordId` / `objectName`; fall back to this page's
            // record when the action carries none (header/more actions).
            recordId: (action as any).recordId ?? pureRecordId,
            objectName: action.objectName ?? objectName,
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
        // The action only OPENED the wizard — it hasn't completed. Suppress the
        // action-level success toast; the flow-runner owns completion messaging.
        return { success: true, silent: true };
      }
      const shouldRefresh = action.refreshAfter !== false;
      if (shouldRefresh) {
        notifyRecordChanged();
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
  const serverActionInFlight = useRef<Set<string>>(new Set());
  const serverActionHandler = useCallback(async (action: ActionDef) => {
    const targetName = action.target || action.name;
    if (!targetName) {
      return { success: false, error: 'No action target provided' };
    }
    const params = (action.params && !Array.isArray(action.params))
      ? (action.params as Record<string, unknown>)
      : {};

    // Re-entrancy guard: ignore a repeat click while this action+record runs.
    const inflightKey = `${targetName}:${pureRecordId ?? ''}`;
    if (serverActionInFlight.current.has(inflightKey)) {
      return { success: false, error: 'Action already in progress' };
    }
    serverActionInFlight.current.add(inflightKey);

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
      try {
        preOpenedTab = window.open('about:blank', '_blank');
        // Paint progress immediately so the new tab isn't blank/frozen during
        // the (slow) SSO-handoff mint.
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
        if (pureRecordId == null) {
          if (preOpenedTab) { try { preOpenedTab.close(); } catch { /* ignore */ } }
          return { success: false, error: 'This action runs on a single record — no record id available.' };
        }
        // Absolute URL required: the pre-opened tab is an about:blank document,
        // so a bare-relative href has no reliable resolution base.
        const directUrl = `${baseUrl || window.location.origin}${newTabUrl.replace('{recordId}', encodeURIComponent(String(pureRecordId)))}`;
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
        if (action.refreshAfter === true) notifyRecordChanged();
        return { success: true };
      }
      const obj = action.objectName || objectName || 'global';
      const res = await authFetch(
        `${baseUrl}/api/v1/actions/${encodeURIComponent(obj)}/${encodeURIComponent(targetName)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Related-list row actions retarget a CHILD record via explicit
          // `recordId`; header/more actions carry none and use this page's id.
          body: JSON.stringify({ recordId: (action as any).recordId ?? pureRecordId, params }),
        },
      );
      const json = await res.json().catch(() => null);
      // The action route wraps the handler's return value in a {success, data}
      // envelope. A script action that THROWS is reported as
      // `data: { success: false, error }` while the OUTER success stays true,
      // so we must inspect the inner envelope too — otherwise a failed action
      // is mistaken for success and fires the green "completed" toast while the
      // real error is swallowed.
      const inner = json?.data;
      const innerFailed = inner && typeof inner === 'object' && inner.success === false;
      if (!res.ok || (json && json.success === false) || innerFailed) {
        const errMsg = (innerFailed && inner.error) || json?.error || `Action "${targetName}" failed (HTTP ${res.status})`;
        if (preOpenedTab) { try { preOpenedTab.close(); } catch { /* ignore */ } }
        // Don't toast here. This handler always runs through the ActionRunner
        // (registered as the `script` handler on the ActionProvider below, which
        // wires `onToast`), whose post-execution hook surfaces the returned
        // `error` as one toast. Toasting again double-fired the message
        // (e.g. RECORD_LOCKED appeared twice). Mirrors useConsoleActionRuntime.
        return { success: false, error: errMsg };
      }
      const shouldRefresh = action.refreshAfter !== false;
      if (shouldRefresh) notifyRecordChanged();
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
          if (!popup) {
            // Don't silently hijack the current tab — offer a one-click open.
            toast('浏览器拦截了弹窗 / Popup blocked', {
              description: '点击在新标签页打开环境',
              action: { label: '打开环境', onClick: () => { try { window.open(redirectUrl, '_blank'); } catch { window.location.href = redirectUrl; } } },
              duration: 10000,
            });
          }
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
      // Don't toast here — the ActionRunner post-execution hook toasts the
      // returned `error` once (see the failure branch above).
      return { success: false, error: msg };
    } finally {
      serverActionInFlight.current.delete(inflightKey);
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
      notifyRecordChanged();
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

  // ── Audit history fetch ────────────────────────────────────────────
  // Loads recent sys_audit_log entries for this record so the record page can
  // render a read-only "History" tab (`record:history`). Gated on three preconditions to keep
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

  // ── Capability gates: enable.feeds / enable.activities (#2707) ─────
  // Both are opt-OUT capabilities (spec default `true`): absent enable
  // block/flag = on; only an explicit `false` disables. `feeds:false`
  // hides the discussion panel and skips the sys_comment fetch (the
  // server also rejects new comments with 403 FEEDS_DISABLED);
  // `activities:false` skips the sys_activity timeline fetch/merge (the
  // server stops mirroring CRUD for such objects, so the fetch would be
  // empty anyway — skipping keeps the network quiet).
  const feedsEnabled = objectDef?.enable?.feeds !== false;
  const activitiesEnabled = objectDef?.enable?.activities !== false;
  // `enable.files` (#2727) is opt-IN (spec default `false`): the generic
  // Attachments panel is a new surface, so it only renders when the object
  // explicitly declares it. The server enforces the same gate on
  // sys_attachment creation (403 FILES_DISABLED).
  const filesEnabled = objectDef?.enable?.files === true;

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

    if (feedsEnabled) dataSource.find('sys_comment', { $filter: { thread_id: threadId }, $orderby: { created_at: 'asc' } })
      .then((res: any) => {
        if (!res?.data?.length) return;
        const mapped: FeedItem[] = res.data.map((c: any) => ({
          id: c.id,
          type: 'comment' as const,
          actor: c.author_name ?? t('detail.unknownUser', { defaultValue: 'Unknown' }),
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
    // create/update/delete unless the object opts OUT via an explicit
    // `enable.activities: false` (#2707 — opt-out contract, spec default
    // true), so this surface gives us a Salesforce-style "what happened
    // on this record" feed without any per-app glue.
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
    if (activitiesEnabled) dataSource.find('sys_activity', {
      $filter: { object_name: objectName, record_id: pureRecordId },
      $orderby: { timestamp: 'asc' },
      $top: 200,
    })
      .then((res: any) => {
        if (!res?.data?.length) return;
        const mapped: FeedItem[] = [];
        for (const row of res.data) {
          const feedType = activityTypeToFeed[row.type];
          if (!feedType) continue;
          // Prefer the explicit `timestamp` column, but tolerate older
          // rows where the driver leaked the literal "NOW()" — fall
          // back to created_at (always a real ISO date).
          let when = row.timestamp;
          if (!when || when === 'NOW()' || Number.isNaN(Date.parse(when))) {
            when = row.created_at;
          }
          mapped.push({
            id: row.id,
            type: feedType,
            actor: row.actor_name ?? t('detail.systemActor', { defaultValue: 'System' }),
            actorAvatarUrl: row.actor_avatar_url ?? undefined,
            body: row.summary ?? '',
            createdAt: when,
            // ADR-0052 ActivityPointer: drill from the summary to the source
            // rich entity (sys_email row, call/meeting task, …) when present.
            sourceObject: row.source_object ?? undefined,
            sourceId: row.source_id ?? undefined,
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
  }, [dataSource, objectName, pureRecordId, currentUser, feedsEnabled, activitiesEnabled]);

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
    // Reset loading on navigation; the page-record effect above owns data fetching
    setIsLoading(true);
    queueMicrotask(() => setIsLoading(false));
  }, [objectName, recordId]);

  // Build the synthesized-page inputs — the object-derived parts that
  // `buildDefaultPageSchema` folds into the default record page when no
  // authored Page is assigned. Must be before early returns to keep hook
  // count consistent across renders and avoid React error #310.
  const synthParts = useMemo(() => {
    if (!objectDef) {
      return {} as {
        sections?: Array<Record<string, any>>;
        highlightFields?: string[];
        headerActions?: ActionDef[];
        related?: Array<{ title?: string; objectName: string; relationshipField: string; columns?: any[]; icon?: string; isPrimary?: boolean }>;
        history?: { entries: any[]; loading: boolean };
      };
    }

    // Build sections (ADR-0085: grouping is the `fieldGroups` semantic
    // role — there is no per-surface sections override; per-page
    // customization goes through an assigned Page schema):
    //   1) sections derived from the object's `fieldGroups`;
    //   2) auto-grouping (primary + collapsible "More details").
    const sections = (() => {
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

          // Auto-grouping (platform B): split fields into a primary section
          // and a collapsible "More details" section so long-form/secondary
          // fields don't dilute the main grid. The primary section stays
          // untitled so DetailSection still flattens its chrome when alone.
          // Shared by the pure-fallback path and the ungrouped remainder of
          // the fieldGroups path below.
          const splitPrimarySecondary = (keys: string[]) => {
            const primaryKeys = keys.filter((k) => !isSecondaryField(k, objectDef.fields[k]));
            const secondaryKeys = keys.filter((k) => isSecondaryField(k, objectDef.fields[k]));

            // Keep the legacy single-untitled-section behaviour when the
            // split would leave one side empty.
            if (secondaryKeys.length === 0 || primaryKeys.length === 0) {
              return [
                {
                  showBorder: false as const,
                  fields: keys.map(toField),
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
          };

          // 1) fieldGroups-derived sections (the ADR-0085 semantic role,
          //    same shared derivation the runtime form honours). Declared
          //    groups render as titled cards in declared order; the
          //    trailing untitled bucket (ungrouped fields) still goes
          //    through the primary/"More details" split so long-form
          //    fields stay tucked away.
          const grouped = deriveFieldGroupDetailSections(objectDef as any);
          if (grouped) {
            return grouped.flatMap((sec: any) => {
              if (!sec.name) {
                return splitPrimarySecondary(
                  (sec.fields as any[]).map((f: any) => f.name),
                );
              }
              return [{
                ...sec,
                title: sectionLabel(objectDef.name, sec.name, sec.title),
                showBorder: true as const,
              }];
            });
          }

          // 3) Pure auto-grouping fallback.
          const allFields = Object.keys(objectDef.fields || {})
            .filter((key) => !AUDIT_FIELD_NAMES.has(key) && !HIDDEN_SYSTEM_FIELD_NAMES.has(key) && !objectDef.fields[key]?.hidden);
          return splitPrimarySecondary(allFields);
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
        // A pending approval is THE decision the approver came to make, so the
        // decision buttons must outrank app `record_header` actions rather than
        // being appended after them (and buried in overflow). A strongly
        // negative `order` floats them into the primary slot; the action:bar
        // stable-sorts by `order`, so app actions keep their relative order
        // just after the decision. Approve gets the highlighted `primary`
        // variant; Reject stays `destructive`. (#2670 / objectui#2339)
        base.push({
          name: 'approve_request',
          type: 'approval',
          target: 'approve_request',
          label: t('approvals.approve', { defaultValue: 'Approve' }),
          icon: 'check',
          variant: 'primary',
          order: -100,
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
          order: -99,
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

    // Highlight-strip field names from the object's semantic role
    // (ADR-0085). Bare names pass through; `{ name }` descriptors reduce
    // to their name. Empty → undefined below, so the synthesizer
    // auto-derives instead.
    const rawHighlightFields = (objectDef as any).highlightFields ?? [];
    const highlightFields: string[] = (Array.isArray(rawHighlightFields) ? rawHighlightFields : [])
      .map((f: any) => (typeof f === 'string' ? f : f?.name))
      .filter((n: any): n is string => typeof n === 'string' && n.length > 0);

    // Related child lists from reverse-reference relationships, in
    // `buildDefaultPageSchema`'s `related` shape. `relationshipField` is
    // the FK field on the child pointing back to this record — passed so
    // the related-list renderer can hide the redundant parent-ID column.
    // Each list's `record:related_list` renderer self-fetches lazily when
    // its tab is shown (nothing is preloaded here), and header/row
    // affordances (+ New / View All / row navigation) are wired
    // downstream by `RelatedRecordActionsBridge`.
    const related = childRelations.map(({ childObject, childLabel, referenceField, title: titleOverride, columns: columnsOverride, isPrimary }) => {
      const childObjectDef = objects.find((o: any) => o.name === childObject);
      // A `relatedListTitle` on the relationship wins; else fall back to the
      // localized child-object label.
      const localizedTitle = titleOverride
        || (childObjectDef
          ? objectLabel({ name: childObjectDef.name, label: childObjectDef.label || childLabel })
          : childLabel);
      return {
        title: localizedTitle,
        objectName: childObject,
        relationshipField: referenceField,
        // Explicit columns from `relatedListColumns` on the relationship; when
        // absent the related-list renderer auto-derives them from the child
        // object's fields.
        ...(Array.isArray(columnsOverride) && columnsOverride.length > 0
          ? { columns: columnsOverride }
          : {}),
        ...(childObjectDef?.icon ? { icon: childObjectDef.icon } : {}),
        // `relatedList: 'primary'` prominence flag (ADR-0085) — the list is
        // promoted to its own tab by `buildDefaultTabs`.
        ...(isPrimary ? { isPrimary: true } : {}),
      };
    });

    return {
      sections,
      // Empty → undefined so the synthesizer falls back to its own
      // derivation (highlights) / skips the node (actions, related, history).
      highlightFields: highlightFields.length > 0 ? highlightFields : undefined,
      headerActions: recordHeaderActions.length > 0 ? (recordHeaderActions as ActionDef[]) : undefined,
      related: related.length > 0 ? related : undefined,
      ...(historyEnabled && {
        history: {
          entries: historyEntries ?? [],
          loading: historyLoading && historyEntries === null,
        },
      }),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectDef?.name, childRelations, t, objectLabel, objects, historyEnabled, historyEntries, historyLoading, approvals.available, approvals.canDecide]);

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
  // broken page instead of a clean 404.
  if (pageRecordStatus === 'missing') {
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

  // A page always exists past the guards above — authored (assignedPage)
  // or synthesized (buildDefaultPageSchema).
  const disableDiscussion = (effectivePage as any)?.disableDiscussion === true;
  // When the page schema embeds an explicit `record:discussion` /
  // `record:chatter` slot, skip the bottom auto-append so the
  // author placement (or synth default) wins. The walker recurses
  // into `regions[]` so `buildDefaultPageSchema` output and
  // full-Lightning authored pages are both detected.
  const hasDiscussion = hasExplicitDiscussion(effectivePage as any);
  // `enable.feeds: false` (#2707) suppresses the discussion panel outright —
  // same opt-out contract the server enforces on sys_comment creation.
  const showAutoDiscussion = !disableDiscussion && !hasDiscussion && feedsEnabled;

  // System actions (Edit / Share / Delete) — synthesized for every record
  // page so objects without authored record_header actions still surface
  // the basic affordances.
  const synthSystemActions: ActionDef[] = (() => {
    const affordances = resolveCrudAffordances(objectDef as any);
    const items: ActionDef[] = [];
    if (affordances.edit) {
      // Single primary Edit CTA → opens the full record form. Inline editing
      // is no longer a standalone header button; it is entered by
      // double-clicking a field (or its hover pencil) in the record body,
      // with the object-editability gate applied at the field-render source
      // (record-details.tsx). See #2401.
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

  // The synth path hands ONLY business actions (authored on objectDef and
  // routed to the record_header location, e.g. Lead.convert) to the page
  // schema. System actions (Edit / Share / Delete) ride through
  // `RecordContext.headerSystemActions` instead, so they reach both
  // synth/slotted pages AND authored full-Lightning pages without
  // mutating the assignedPage tree. `PageHeaderRenderer` dedupes by
  // name so authored business actions still win on collision.
  const renderedPage = assignedPage
    ? effectivePage
    : buildDefaultPageSchema(objectDef as any, {
        sections: synthParts.sections,
        highlightFields: synthParts.highlightFields,
        headerActions: synthParts.headerActions,
        related: synthParts.related,
        history: synthParts.history,
        // ADR-0085 removed the per-object `detail.*` presentation
        // toggles (show/hideReferenceRail, hideRelatedTab, relatedLayout)
        // — the synth defaults apply; per-page layout goes through an
        // assigned Page schema (`record:reference_rail` stays available
        // there as a renderer capability).
        ...(assignedSlots ? { slots: assignedSlots } : {}),
      });

  return (
    <div className="h-full bg-background overflow-hidden flex flex-col relative">
      {/* Shared cross-cutting chrome: lifecycle badge + presence avatars —
          rendered above the page tree so custom Page-assigned record pages
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
        {/* objectui#2407 P2 — ONE record-level inline-edit session spanning
            the highlights strip AND the details body (both descend from this
            provider), committed together by the single <InlineEditSaveBar>
            below. `canEdit` carries the object-lifecycle / permission gate. */}
        <InlineEditProvider canEdit={resolveCrudAffordances(objectDef as any).edit}>
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
              <RelatedRecordActionsBridge
                appName={appName}
                objects={objects}
                dataSource={dataSource}
                actionLabel={actionLabel}
                parentObjectName={objectName}
                parentRecordId={pureRecordId ?? undefined}
                parentTitle={recordTitle}
              >
                <SchemaRenderer schema={withPageTabsUrlSync(renderedPage, { defaultTab: activeTabParam, onTabChange: handleTabChange }) as any} />
              </RelatedRecordActionsBridge>
              {/* ADR-0056 P1b — user assignment lives in Setup (the pure
                  model): the permission set's facets render read-only as
                  summary + Studio deep-link, and admins add/remove users
                  here. Rendered directly (mirrors RecordAttachmentsPanel)
                  inside RecordContextProvider so it reads the set's name. */}
              {objectName === 'sys_permission_set' && pureRecordId && (
                <div className="mt-6">
                  <RecordPermissionAssignmentsRenderer />
                </div>
              )}
              {/* Generic Attachments panel (#2727) — opt-in via
                  `enable.files: true`; the server rejects attachments
                  targeting any other object (403 FILES_DISABLED). */}
              {filesEnabled && pureRecordId && (
                <div className="mt-6">
                  <RecordAttachmentsPanel
                    objectName={objectName!}
                    recordId={pureRecordId}
                    dataSource={dataSource}
                    currentUserId={currentUser?.id}
                  />
                </div>
              )}
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
              {/* Record-level inline-edit Save/Cancel bar (objectui#2407 P2) —
                  commits the whole draft (highlights + body) in ONE atomic OCC
                  update; renders (sticky) only while editing. */}
              <InlineEditSaveBar
                dataSource={dataSource}
                objectName={objectName}
                recordId={pureRecordId}
                data={pageRecord}
                refresh={notifyRecordChanged}
                fieldLabelFor={(name: string) => (objectDef as any)?.fields?.[name]?.label || fieldLabel(objectName || '', name, name)}
                locked={(pageRecord as any)?.approval_status === 'pending' || (pageRecord as any)?.approval_status === 'in_approval'}
              />
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
        </InlineEditProvider>
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
        dataSource={dataSource}
        objects={objects}
        onClose={() => setScreenFlow(null)}
        onComplete={() => { setScreenFlow(null); notifyRecordChanged(); }}
      />
    </div>
  );
}
