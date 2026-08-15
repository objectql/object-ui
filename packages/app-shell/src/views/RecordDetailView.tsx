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
import { RecordChatterPanel, InlineEditSaveBar, buildDefaultPageSchema, deriveFieldGroupDetailSections, extractMentions, resolveTitleField, useRecordEditable } from '@object-ui/plugin-detail';
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import { useAuth, createAuthenticatedFetch } from '@object-ui/auth';
import { usePermissions } from '@object-ui/permissions';
import { ActionProvider, useObjectTranslation, useObjectLabel, useActionTextLocalizer, usePageAssignment, RecordContextProvider, SchemaRenderer, DiscussionContextProvider, HighlightFieldsProvider, InlineEditProvider, useGlobalUndo, useDataInvalidation, notifyDataChanged, useRowPredicate } from '@object-ui/react';
import { buildExpandFields, resolveRecordIdParamSeed, userActionPredicates } from '@object-ui/core';
import { toast } from 'sonner';
import { useRecordPresence, PresenceAvatars } from '@object-ui/collaboration';
import { Database, ChevronLeft } from 'lucide-react';
import { MetadataPanel, useMetadataInspector } from './MetadataInspector';
import { SkeletonDetail } from '../skeletons';
import { ManagedByBadge } from '../components/ManagedByBadge';
import { resolveEffectiveCrudAffordances } from '../utils/crudAffordances';
import { deriveRelatedLists } from '../utils/deriveRelatedLists';
import { hasExplicitDiscussion, hasExplicitAttachments, hasExplicitApprovals } from '../utils/pageSchemaIntrospect';
import { ActionConfirmDialog, type ConfirmDialogState } from './ActionConfirmDialog';
import { ActionParamDialog, type ParamDialogState } from './ActionParamDialog';
import { ActionResultDialog, type ResultDialogState } from './ActionResultDialog';
import { FlowRunner, type ScreenFlowState, type ScreenSpec } from './FlowRunner';
import { RelatedRecordActionsBridge } from './RelatedRecordActionsBridge';
import { withPageTabsUrlSync } from '../utils/pageTabsUrlSync';
import { RECORD_DETAIL_TAB_PARAM, RECORD_TRAIL_PARAM, decodeRecordTrail, buildRecordTrailHref } from '../urlParams';
import { resolveActionParams } from '../utils/resolveActionParams';
import { createConsoleServerActionHandler } from '../utils/consoleServerAction';
import { interpretFlowResponse } from '../utils/flowResponse';
import { useRecordBreadcrumbTitle } from '../context/NavigationContext';
// Audit provenance renders as the one-line <RecordMetaFooter>; the other
// framework-injected bookkeeping columns are hidden from the body outright.
// Both sets are derived, not restated — see record-detail-system-fields.ts.
import { AUDIT_FIELD_NAMES, HIDDEN_SYSTEM_FIELD_NAMES } from './record-detail-system-fields';
import type { FeedItem } from '@object-ui/types';
import type { ActionDef, ActionParamDef } from '@object-ui/core';
import { useRecordApprovals, recordLockedByApproval } from '../hooks/useRecordApprovals';
import { RecordAttachmentsPanel } from './RecordAttachmentsPanel';
import { RecordApprovalsPanel } from './RecordApprovalsPanel';
import { DeclaredActionsBar } from './DeclaredActionsBar';
import {
  SYS_APPROVAL_REQUEST_OBJECT,
  RECORD_APPROVAL_ACTION_LOCATION,
  RECORD_APPROVAL_EXCLUDED_ACTIONS,
} from './recordApprovalActions';
// Side-effect registration of `record:approvals` — synthesized record pages
// reference the node whenever the record has approval requests (#3461), so
// the type must resolve wherever this view renders, not only under hosts
// that import the app-shell barrel.
import './record-approvals-renderer';
import { RecordPermissionAssignmentsRenderer } from './metadata-admin/RecordPermissionAssignmentsRenderer';
import { getRecordDisplayName } from '../utils';
import { parseAuditValue, collectAuditChanges, collectLookupIds, formatAuditValue } from '../utils/auditHistoryDisplay';
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
 * The `user` seeded into this view's own `<ActionProvider>` — identity plus, once
 * resolved, the caller's system capabilities.
 *
 * [ADR-0066 D4 / framework#3923] `systemPermissions` is not decoration here: this
 * provider SHADOWS the shell-level one (`useConsoleActionRuntime`) for every
 * action on the record surface, and `ActionEngine.getActionsForLocation` reads the
 * capability gate off `runner.getContext().user.systemPermissions`. The engine
 * fails OPEN on `undefined` (unknown ≠ denied), so shipping identity alone
 * silently un-gated every `record_header` / `record_more` action that declared
 * `requiredPermissions` — the button rendered, and only the server's 403 stopped
 * it (and only for platform action routes at that).
 *
 * The `permissionsLoaded` gate keeps "no answer yet" apart from "an answer,
 * whatever it is": while `!permissionsLoaded` (no PermissionProvider mounted,
 * or still resolving), `systemPermissions` is omitted entirely so the engine's
 * own fail-open applies. Forwarding `[]` in that window would flip the gate
 * fail-CLOSED and hide gated actions in a standalone embed.
 *
 * [objectui#4656] Once loaded, `systemPermissions` is forwarded AS-IS,
 * `undefined` included — it is NOT collapsed to `[]`. `MePermissionsProvider`
 * now preserves the distinction the engine already keys off: `undefined`
 * means the backend never reported `systemPermissions` at all (a deployment
 * predating ADR-0066), which is exactly the "unknown" case the engine's own
 * `Array.isArray(held)` check fails OPEN on — not "holds nothing". Defaulting
 * it to `[]` here would silently re-introduce the same collapse at this one
 * call site and gate every `record_header` / `record_more` action closed on
 * such a deployment. A REPORTED empty array still forwards as `[]` and gates
 * strictly, unchanged.
 */
export function resolveActionUser(
  user: { id: string; name: string; image?: string } | null | undefined,
  permissionsLoaded: boolean,
  systemPermissions: string[] | undefined,
): { id: string; name: string; avatar?: string; systemPermissions?: string[] } {
  const identity = user
    ? { id: user.id, name: user.name, avatar: user.image }
    : FALLBACK_USER;
  return permissionsLoaded
    ? { ...identity, systemPermissions }
    : identity;
}

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
/**
 * Matched against the RAW `objectDef.fields[x].type`, so every member must be a
 * `@objectstack/spec` `FieldType` name. `rich-text` was not one: the spec spells
 * the type `richtext` and REJECTS `rich-text`, which survives only as a typo key
 * in the spec's own `suggestFieldType` table — a spelling no producer can emit.
 * The member therefore demoted nothing while a real `richtext` field stayed in
 * the dense primary section, and the same field failed to read wide in the
 * detail and form auto-layouts, which carried the identical hole (#4250).
 */
const SECONDARY_FIELD_TYPES = new Set(['textarea', 'markdown', 'html', 'richtext', 'json', 'code']);

/**
 * Exported for the cross-surface pin in `richtextSurfaceParity.test.ts` — the
 * rule is the behaviour under test, not the set's string membership. Not
 * re-exported from the package barrel (`views/index.ts` names `RecordDetailView`
 * only), so this widens no public API.
 */
export function isSecondaryField(fieldName: string, fieldDef: any): boolean {
  if (SECONDARY_FIELD_TYPES.has(fieldDef?.type)) return true;
  const lc = fieldName.toLowerCase();
  return SECONDARY_FIELD_NAME_HINTS.some((hint) => lc === hint || lc.endsWith(`_${hint}`));
}

/**
 * The discussion feed of a record that has none. A module-level constant, not
 * a fresh `[]` per render: `feedItems` is handed straight to
 * `DiscussionContextProvider` / `RecordChatterPanel` as a prop, so a new array
 * identity every render would defeat every memo downstream of it. Read-only by
 * convention — every write path below produces a NEW array.
 */
const EMPTY_FEED: FeedItem[] = [];

/**
 * Union two feed slices by row id, oldest first.
 *
 * Both reads that fill the feed (`sys_comment`, `sys_activity`) land through
 * here, and so does the re-read that follows a navigation back to a record we
 * already have rows for. Union-by-id (rather than replace) is what lets an
 * OPTIMISTIC row — a comment the user just posted, written with the same id it
 * was `create`d under — survive the refetch: if the row has persisted the
 * server copy wins on the same key (no duplicate), and if it has not, the local
 * row is still there.
 */
function mergeFeedRows(prev: readonly FeedItem[], incoming: readonly FeedItem[]): FeedItem[] {
  const byId = new Map<string, FeedItem>();
  for (const item of [...prev, ...incoming]) byId.set(String(item.id), item);
  return Array.from(byId.values()).sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    return ta - tb;
  });
}

/**
 * Which system record-header affordances the record page may offer for this
 * object — the primary `sys_edit` CTA (which also gates the record-body
 * inline-edit session) and the `sys_delete` overflow item.
 *
 * [#3546] Each bit is the object's resolved CRUD affordance (lifecycle bucket +
 * `userActions`) INTERSECTED with the server-resolved effective API operation
 * set (`/me/permissions` `apiOperations`) — never a union. So a server grant can
 * never re-open an affordance the object's bucket closed, and a permissive
 * bucket default never survives the server denying `update` / `delete`. This is
 * the detail-surface end of the same intersection the list/toolbar surface
 * applies (objectui#2823). Passing `undefined` for `effectiveApiOperations`
 * (unrestricted object / old backend / no `PermissionProvider`) leaves the
 * bucket + `userActions` decision untouched — backward-compatible.
 *
 * Exported so the gate can be unit-tested directly: the record page itself is
 * wired into routing, auth, presence and data fetching too deeply to render in
 * a unit test, and this matrix is the part that must not regress. Same pattern
 * as `defaultListColumnsFromObject` in `ObjectView`.
 */
export function resolveRecordHeaderActionGates(
  objectDef: unknown,
  effectiveApiOperations?: readonly string[] | null,
): { edit: boolean; delete: boolean } {
  const affordances = resolveEffectiveCrudAffordances(objectDef as any, effectiveApiOperations);
  return { edit: affordances.edit, delete: affordances.delete };
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
  const location = useLocation();
  const handleTabChange = useCallback((value: string) => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get(RECORD_DETAIL_TAB_PARAM) === value) return;
    sp.set(RECORD_DETAIL_TAB_PARAM, value);
    // `setSearchParams` is a navigation: without an explicit `state` it drops
    // the entry's history state, losing the list-origin `state.from` that
    // renders the "← All <object>" back link — switching tabs must keep it.
    setTabSearchParams(sp, { replace: true, state: location.state });
  }, [setTabSearchParams, location.state]);
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
  const { t, language } = useObjectTranslation();
  const { objectLabel, viewLabel: _vLabel, sectionLabel, actionParamText, actionParamOptionLabel, actionDescription, actionResultDialog, fieldLabel, fieldOptionLabel } = useObjectLabel();
  // label + confirmText + successMessage through ONE call (objectui#4265) —
  // the three keys of an `_actions.<name>` bundle entry can no longer be
  // localized apart from one another on this surface.
  const localizeActionTexts = useActionTextLocalizer();
  const { isFavorite, toggleFavorite, refreshLabel: refreshFavoriteLabel } = useFavorites();
  const { addRecentItem } = useRecentItems();
  const [isLoading, setIsLoading] = useState(true);
  // The discussion feed, stored PER RECORD (objectui#3268). See the
  // `feedRecordKey` block below for why this is a map and not a `FeedItem[]`.
  const [feedItemsByRecord, setFeedItemsByRecord] = useState<Record<string, FeedItem[]>>({});
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
  // Manual refresh (objectui#3460) — the producer for `RecordContext.refresh`,
  // which `page:header` turns into the ⟳ button at the end of the header row.
  //
  // Scope is deliberately `'*'`, not this record: the reason a user reaches for
  // refresh is a write made by SOMEONE ELSE (another operator started the work
  // order, a child row got reported) — a write this client never saw, so it
  // cannot know which objects it touched. `'*'` treats everything mounted as
  // stale, so the main record, every related child list and the tab-count
  // badges all refetch in place over the #2269 bus: no remount, so tab /
  // scroll / in-progress inline-edit state all survive.
  const handleManualRefresh = useCallback(() => {
    notifyDataChanged({ objectName: '*' });
  }, []);
  // First phase covers the standalone record ROUTE only. Embedded hosts — the
  // list drawer and the split-pane preview (ObjectView / ObjectDataPage /
  // InterfaceListPage all mount this same view with `embedded`) — wrap it in
  // overlay chrome that already owns its own controls, and the #3460 ruling
  // keeps ⟳ off those surfaces for now. `undefined` is the opt-out
  // `page:header` reads, so nothing renders there.
  const headerRefresh = embedded ? undefined : handleManualRefresh;

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
    (spec: any, data: unknown, action?: any) => new Promise<void>((resolve) => {
      // Localize title/description/acknowledge + field labels via the
      // `_actions.<action>.resultDialog` convention (metadata literals as
      // fallback); the action's own object wins over the page object.
      const objForI18n = (typeof action?.objectName === 'string' && action.objectName)
        ? action.objectName
        : objectName || objectDef?.name;
      const localized = actionResultDialog(objForI18n, action?.name, spec) ?? spec;
      setResultDialogState({ open: true, spec: localized, data, resolve });
    }),
    [objectName, objectDef, actionResultDialog],
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
        // Resolves an inline per-locale `label` map (rc.6's widened
        // `I18nLabel`) for the active language — objectui#4163.
        locale: language,
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
        // Interpolate `{field}` tokens in the target URL. Source: the stashed
        // row when the dispatch carries one (related-list rows; page:header
        // since objectui#3391), else THIS page's record — but only when the
        // action doesn't retarget another object (a child action interpolated
        // from the parent's fields would hit the wrong record; same guard as
        // the recordIdParam fallback below). Without the page-record fallback,
        // a `record_header` action reaching here through any dispatch path
        // that doesn't stash `_rowRecord` sent the literal `{id}` on the wire.
        const interpolationRecord = rowRecord
          ?? (!action.objectName || action.objectName === objectName
            ? (pageRecord as Record<string, any> | undefined) ?? undefined
            : undefined);
        let resolvedTarget = targetStr;
        if (interpolationRecord && /\{[a-z_][a-z0-9_]*\}/i.test(resolvedTarget)) {
          resolvedTarget = resolvedTarget.replace(/\{([a-z_][a-z0-9_]*)\}/gi, (_, k) => {
            const v = interpolationRecord[k];
            return v == null ? '' : encodeURIComponent(String(v));
          });
        }
        const url = resolvedTarget.startsWith('http') ? resolvedTarget : `${baseUrl}${resolvedTarget}`;

        const wrap = action.bodyShape && typeof action.bodyShape === 'object' && (action.bodyShape as any).wrap
          ? (action.bodyShape as any).wrap
          : undefined;
        const body: Record<string, any> = wrap ? { [wrap]: params } : { ...params };

        if (action.recordIdParam) {
          const rowField = action.recordIdField || 'id';
          // This site has two sources resolveRecordIdParamSeed doesn't know
          // about — a literal `recordId` override (not a declared ActionDef
          // field; nothing in this repo's metadata sets it today, hence the
          // cast) and the same page-record fallback `interpolationRecord`
          // above uses for `record_header` actions dispatched with no
          // `rowRecord`. Preserve that priority (row -> override ->
          // page record) and let the helper decide — and word — the
          // refusal only once every source has been tried, instead of the
          // silent drop this call site used to fall back to
          // (objectstack#8018, objectui#4669).
          const recordIdOverride = (action as { recordId?: unknown }).recordId;
          const rowHasValue = !!rowRecord && rowRecord[rowField] != null;
          if (!rowHasValue && recordIdOverride != null) {
            body[action.recordIdParam] = recordIdOverride;
          } else {
            const seedRecord: Record<string, any> | undefined = rowHasValue
              ? rowRecord
              : ((!action.objectName || action.objectName === objectName
                  ? (pageRecord as Record<string, any> | undefined)
                  : undefined) ?? rowRecord);
            const seed = resolveRecordIdParamSeed(action, seedRecord);
            if (seed.error) return { success: false, error: seed.error };
            if (seed.value !== undefined) body[action.recordIdParam] = seed.value;
          }
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
  const { modalHandler, modalElement, resolveModalTarget } = useActionModal(dataSource);

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
      // `_rowRecord` is the client-side row stash (page:header dispatches
      // carry it since objectui#3391) — never part of the trigger contract;
      // strip it exactly like useConsoleActionRuntime's flowHandler does.
      const flowParams = {
        ...(action.params && !Array.isArray(action.params)
          ? (action.params as Record<string, any>)
          : {}),
      };
      delete flowParams._rowRecord;
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
            params: flowParams,
          }),
        },
      );
      const json = await res.json().catch(() => null);
      // Single source for the flow-response rule — shared with
      // useConsoleActionRuntime's copy of this handler and FlowRunner's resume.
      // This copy checked only the transport envelope and then treated
      // everything else as terminal success, so a run that failed on its first
      // node fired a green toast (#2958); it also passed `json.error` through
      // raw, and the nested `{code, message}` shape reaches `toast.error()` as
      // a React child and crashes the page (React #31). See utils/flowResponse.
      const outcome = interpretFlowResponse<ScreenSpec>(res, json, `Flow "${flowName}"`);
      if (outcome.kind === 'failed') {
        return { success: false, error: outcome.error };
      }
      // Screen-flow runtime: the run paused at a `screen` node awaiting input —
      // open the FlowRunner to render the form + resume (refresh on completion).
      if (outcome.kind === 'paused') {
        setScreenFlow({ flowName, runId: outcome.runId ?? '', screen: outcome.screen });
        // The action only OPENED the wizard — it hasn't completed. Suppress the
        // action-level success toast; the flow-runner owns completion messaging.
        return { success: true, silent: true };
      }
      const shouldRefresh = action.refreshAfter !== false;
      if (shouldRefresh) {
        notifyRecordChanged();
      }
      return { success: true, data: outcome.data, reload: shouldRefresh };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, [authFetch, pureRecordId, objectName]);

  // Server-side action handler — POST /api/v1/actions/{object}/{action},
  // built from @object-ui/core's `createServerActionHandler` via the shared
  // console wrapper (#2904), exactly like `useConsoleActionRuntime`: core owns
  // the dispatch (name-only identity per ADR-0110 D1 — this copy used to post
  // `target || name`, the drift framework#3935 fixed only in the shared
  // runtime — plus the re-entrancy guard and the /actions envelope rule), the
  // wrapper owns the popup pre-open / `newTabUrl` fast path / `redirectUrl`
  // convention.
  //
  // The record page resolves records against ITSELF, not a grid selection:
  // related-list row actions retarget a CHILD record via an explicit
  // `action.recordId`; header/more actions carry none and use this page's id.
  // The env ref keeps the handler instance stable across renders (authFetch is
  // memoized once) while the thunks read the live record/object.
  const serverActionEnvRef = useRef({ objectName, pureRecordId, notifyRecordChanged, t });
  serverActionEnvRef.current = { objectName, pureRecordId, notifyRecordChanged, t };
  const serverActionHandler = useMemo(
    () => createConsoleServerActionHandler({
      fetch: authFetch,
      baseUrl: () => import.meta.env.VITE_SERVER_URL || '',
      resolveObject: () => serverActionEnvRef.current.objectName,
      resolveRecordId: (action) => ({
        recordId: (action as { recordId?: unknown }).recordId ?? serverActionEnvRef.current.pureRecordId ?? undefined,
      }),
      onRefresh: () => serverActionEnvRef.current.notifyRecordChanged(),
      // Read through the env ref so the spinner-tab / popup-blocked copy
      // follows a language switch without invalidating the handler instance
      // (objectui#3321).
      t: (key, englishDefault) => String(serverActionEnvRef.current.t(key, englishDefault)),
    }),
    [authFetch],
  );

  /**
   * `type: 'modal'` dispatch — same rule as the shared console runtime (see
   * `useConsoleActionRuntime.modalActionHandler`): CLIENT-SIDE ONLY. The
   * action's `target` names the page (or object form) to open; rendering it is
   * the whole of what a modal action does.
   *
   * [objectstack#3959 / objectui#3320] This used to fall through to
   * `serverActionHandler` when the target resolved to neither a page nor an
   * object, "so a modal action bound to `engine.registerAction(...)` completes
   * here exactly as it does on a list page". It never ran: the framework's
   * `headlessActionTypeError` rejects `type: 'modal'` over REST with a 400,
   * because a modal has no server dispatch — the fallthrough only converted an
   * authoring mistake (a target naming no page) into a confusing round-trip.
   * objectstack#3959 removed it from the shared runtime; this copy kept the
   * pre-#3959 shape until objectui#3320. An unresolvable target is now
   * reported as what it is. To collect input and then run server-side, declare
   * `type: 'script'` with `params`: the runner collects the same dialog and
   * the handler runs with those values.
   */
  const modalActionHandler = useCallback(async (action: ActionDef) => {
    const schema = (action as any).modal ?? action.target ?? (action as any).params?.schema;
    const descriptor = schema != null ? await resolveModalTarget(schema) : null;
    if (descriptor) return modalHandler(descriptor);
    return {
      success: false,
      error:
        `Action "${action.name}" is type:'modal' but its target ` +
        `${schema != null ? `"${String(schema)}" ` : ''}names no page or object to open. ` +
        `Point it at a page, or use type:'script' with params to collect input and run a handler.`,
    };
  }, [resolveModalTarget, modalHandler]);

  // ─── Approvals ─────────────────────────────────────────────────────
  // Since ADR-0019 an approval is a flow node: the flow opens the request,
  // there is no manual submit/recall from the record header. This read backs
  // three things: the status badge / edit lock, the approvals panel (#3461),
  // and — since objectui#3055 — the pending `sys_approval_request` row that the
  // object's own SERVER-DECLARED decision actions run against.
  const approvals = useRecordApprovals(objectName, pureRecordId);
  // Hold latest approvals snapshot in a ref so the action handler
  // (memoized once inside ActionRunner) always sees fresh state instead of
  // the stale closure captured at the first render.
  const approvalsRef = useRef(approvals);
  approvalsRef.current = approvals;

  // Approval-lock preflight (objectui#2572 item 2): re-read the approval
  // state whenever this record is invalidated on the bus — a saved edit can
  // TRIGGER an approval flow (e.g. a budget change), and without this
  // re-fetch the page kept the pre-save snapshot: the user could re-enter
  // inline edit, fill a whole draft, and only learn about the lock when Save
  // came back RECORD_LOCKED. Skips the initial mount (the hook fetches on
  // mount itself); the ref keeps the effect off the approvals identity.
  const skippedInitialApprovalsRefresh = useRef(false);
  useEffect(() => {
    if (!skippedInitialApprovalsRefresh.current) {
      skippedInitialApprovalsRefresh.current = true;
      return;
    }
    void approvalsRef.current.refresh();
  }, [recordInvalidationNonce]);

  // Approval state is TWO signals, not one (objectui#2902).
  //
  // `approvalPending` — an approval is in flight on this record. Drives the
  // status band and the recall affordance, which are meaningful whether or not
  // the record is editable.
  //
  // `approvalLocked` — that approval also forbids edits. The approval node's
  // `lockRecord` policy decides this, and the server enforces exactly that
  // policy in its record-lock `beforeUpdate` hook. Conflating the two (which
  // this used to do) made every `lockRecord: false` node claim the record was
  // locked while the server happily accepted writes — and, worse than the
  // wrong label, `canEdit` below then suppressed the inline-edit affordances
  // entirely, so the "approver may fill in the missing detail" case the flag
  // exists for was unreachable from the console.
  //
  // The record's own `approval_status` field stays a fallback for backends
  // that mirror status onto the record but expose no approvals API. It carries
  // no node granularity, so it can only mean "locked" — the conservative read,
  // and the same one `recordLockedByApproval` applies to a pre-framework#3814 backend.
  const approvalStatusPending =
    (pageRecord as any)?.approval_status === 'pending' ||
    (pageRecord as any)?.approval_status === 'in_approval';
  const approvalPending = approvalStatusPending || !!approvals.pendingRequest;
  const approvalLocked = approvals.pendingRequest
    ? recordLockedByApproval(approvals.pendingRequest)
    : approvalStatusPending;
  // How far the pending node's tally has got (objectstack#4478). Multi-approver
  // nodes — `quorum`, `unanimous`, `per_group` — do not finalize on one
  // decision, so an approver standing on the record needs the count to know
  // whether their click closes the step. Server-computed; `first_response`
  // nodes carry none and the band then shows nothing extra.
  const approvalProgress = approvals.pendingRequest?.decision_progress;

  // A decision landed through the declared-action bar (objectui#3055). The
  // action itself already POSTed and the runtime already toasted; what the HOST
  // owes is a re-read of both halves it renders — the approval state (status,
  // pending row, `viewer` block, tally) and the record itself, whose
  // engine-written mirrors (`approval_status`, stage fields) change with the
  // decision. `refreshAfter: true` on every declared decision action is what
  // calls this.
  const handleApprovalActionDone = useCallback(() => {
    void approvalsRef.current.refresh();
    notifyRecordChanged();
  }, [notifyRecordChanged]);

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
  // Object-level READ gate (objectui#2359): the relationship graph alone
  // decides WHICH lists exist, but the current user's permissions decide
  // which they may SEE. Children the user cannot read are dropped here, so
  // neither the section nor its tab is ever rendered (previously they showed
  // an empty grid + a "New" button that 403'd on save). While permissions
  // are still loading (`isLoaded === false`, e.g. no PermissionProvider in a
  // standalone embed) the gate stays open — fail-open is safe because the
  // server enforces data access regardless; this is purely a UI/DX filter.
  const { can: canOnObject, isLoaded: permissionsLoaded, getObjectApiOperations, systemPermissions } = usePermissions();
  // [#3546] Server-resolved effective API operation set for this object
  // (`/me/permissions` `apiOperations`). Threaded as the 2nd arg into
  // `resolveRecordHeaderActionGates` for the detail header's Edit/Delete and
  // the record-body inline-edit gate, so the detail surface never offers an
  // operation the server would 405 — the same intersection the list/toolbar
  // surface already applies (objectui#2823). `undefined` (unrestricted object
  // / old backend) leaves the bucket affordances untouched (backward-compatible).
  const effectiveApiOperations = useMemo(
    () => (objectDef ? getObjectApiOperations(objectDef.name) : undefined),
    [objectDef, getObjectApiOperations],
  );
  const childRelations = useMemo(
    () => deriveRelatedLists(objectDef, objects, {
      canRead: permissionsLoaded ? (name) => canOnObject(name, 'read') : undefined,
    }),
    [objectDef, objects, canOnObject, permissionsLoaded],
  );

  // [objectstack#3821] RECORD-level write gate. Everything above is object
  // scoped — it cannot express "this one record is read-only", which is
  // exactly what a read-only sharing grant is. So the header offered Edit on
  // a record the user may only read: the form opened, the user retyped a
  // field, and the server rejected the save with a 403. Ask the explain
  // engine for the row-level verdict (fail-open; the server stays the
  // authority per ADR-0057 D10) and fold it into the same affordance gates.
  const recordWriteAllowed = useRecordEditable(
    objectDef?.name,
    pureRecordId,
    'update',
    !!objectDef?.name && !!pureRecordId,
  );
  const recordDeleteAllowed = useRecordEditable(
    objectDef?.name,
    pureRecordId,
    'delete',
    !!objectDef?.name && !!pureRecordId,
  );

  // ── Per-record `userActions` predicates — the header's FOURTH gate ────────
  //
  // objectui#4213. `userActions.edit` / `.delete` reached this header in their
  // BOOLEAN form and only in that form: the switch flows through
  // `resolveRecordHeaderActionGates` → `resolveEffectiveCrudAffordances`, so
  // `userActions: { delete: false }` hid Delete on the list row AND here. The
  // per-record OBJECT form — `{ visibleWhen: … }`, objectui#2614 — was
  // consumed by the list row alone (`plugin-grid`'s
  // `isBuiltinRowActionVisible`), because the conjunction below is the
  // affordance/permission channel and nothing on this path ever parsed a
  // predicate. An author narrowing "who may edit this object" to "which
  // records may be edited" therefore lost the record page while keeping the
  // list — a key whose scope SHRANK when a predicate was added to it.
  //
  // This is the console end of the same convergence PR #4515 (objectui#4419)
  // made for `plugin-detail`'s `DetailView` header. Three surfaces, one
  // evaluator, one answer: row kebab, `DetailView` header, console record page.
  //
  // These are HOOKS, so they live here — beside the record-level verdicts they
  // join — and not inside `synthSystemActions` below, which is a plain IIFE
  // sitting AFTER the `isLoading` / `!objectDef` / `missing` early returns.
  // Their results are threaded into that IIFE as ordinary values, the same
  // shape PR #4515 used.
  //
  // `userActionPredicates` from `@object-ui/core` is THE parser for this form,
  // shared with the row surfaces. A bare boolean yields NO predicates, which is
  // what keeps the boolean form the affordance resolver's channel alone rather
  // than growing a second definition of it here.
  const editPredicates = useMemo(
    () => userActionPredicates(objectDef?.userActions?.edit),
    [objectDef],
  );
  const deletePredicates = useMemo(
    () => userActionPredicates(objectDef?.userActions?.delete),
    [objectDef],
  );
  /**
   * The object's field definitions, handed to every predicate on this record
   * for the same reason the row kebab passes them: a relation field must bind
   * as the stored FOREIGN KEY rather than whatever `$expand` substituted for it
   * on this surface (the detail fetch expands every relation it can), or
   * `record.owner == os.user.id` answers a different question here than it does
   * on the list.
   */
  const predicateFields = objectDef?.fields;
  /**
   * `visibleWhen` — fails CLOSED, and counts as DECLARED by `!= null` rather
   * than by truthiness, so `visibleWhen: false` hides the affordance instead of
   * reading as "ungated" (the objectui#3492 invariant that
   * `isBuiltinRowActionVisible` restates for the row surfaces). `?? true`
   * expresses the ungated default as a boolean, which `useRowPredicate`
   * short-circuits without touching the engine — so an object with no
   * `userActions` takes no evaluation at all and this gate is a literal `true`.
   *
   * `useRowPredicate` IS the row surfaces' evaluator: `plugin-grid`'s
   * `evalRowActionVisibility` documents itself as mirroring
   * `useRowPredicate(pred, row, { fallback: false, warnOnError: true, label,
   * fields })` exactly, boolean short-circuit included, and is hook-free only
   * because a row loop evaluates a variable number of actions inside one
   * `useMemo`. This header evaluates a fixed arity of one record, so the hook
   * form is that same evaluator without the constraint that shaped the wrapper.
   */
  const editVisible = useRowPredicate(editPredicates?.visibleWhen ?? true, pageRecord, {
    fallback: false,
    warnOnError: true,
    label: 'builtin:edit:visibleWhen',
    fields: predicateFields,
  });
  const deleteVisible = useRowPredicate(deletePredicates?.visibleWhen ?? true, pageRecord, {
    fallback: false,
    warnOnError: true,
    label: 'builtin:delete:visibleWhen',
    fields: predicateFields,
  });
  /**
   * `disabledWhen` — fails SOFT (an unevaluable predicate must not grey a
   * button forever), and the `!= null` gate lives OUTSIDE the evaluation, so
   * `disabledWhen: ''` reads as "no condition" rather than as "disable".
   * Verbatim the posture of `DataTableBuiltinRowActionItem` and of PR #4515.
   */
  const editDisabledPred = useRowPredicate(editPredicates?.disabledWhen, pageRecord, {
    fallback: false,
    warnOnError: true,
    label: 'builtin:edit:disabledWhen',
    fields: predicateFields,
  });
  const deleteDisabledPred = useRowPredicate(deletePredicates?.disabledWhen, pageRecord, {
    fallback: false,
    warnOnError: true,
    label: 'builtin:delete:disabledWhen',
    fields: predicateFields,
  });
  const editDisabledByPredicate = editPredicates?.disabledWhen != null && editDisabledPred;
  const deleteDisabledByPredicate = deletePredicates?.disabledWhen != null && deleteDisabledPred;

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
    // `actor` (service/automation principal, ADR-0014 D2) is a newer column —
    // only select it when the registered sys_audit_log schema declares it, so
    // the whole query doesn't fail against older deployments.
    const auditLogDef = objects.find((o: any) => o.name === 'sys_audit_log');
    const hasActorColumn = !!auditLogDef?.fields?.actor;

    dataSource
      .find('sys_audit_log', {
        $filter: { record_id: pureRecordId, object_name: objectDef.name },
        $orderby: { created_at: 'desc' },
        $top: 50,
        $select: ['id', 'created_at', 'action', 'user_id', ...(hasActorColumn ? ['actor'] : []), 'old_value', 'new_value'],
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

        // 3) Compute display-worthy diffs (drops computed/hidden/system
        //    fields and empty↔empty no-ops — see auditHistoryDisplay).
        const rawChangesPerItem = items.map((it) =>
          collectAuditChanges(parseAuditValue(it?.old_value), parseAuditValue(it?.new_value), objectDef.fields),
        );

        // 4) Batch-resolve lookup ids → record display labels (one query per
        //    referenced object) so diffs show "紧前计划: 任务A" instead of a
        //    raw id. Best-effort: a failed lookup keeps the raw id.
        const lookupIdsByTarget = collectLookupIds(rawChangesPerItem.flat(), objectDef.fields);
        const lookupLabels = new Map<string, Map<string, string>>();
        await Promise.all(
          Array.from(lookupIdsByTarget.entries()).map(async ([target, ids]) => {
            const targetDef = objects.find((o: any) => o.name === target);
            const titleField = resolveTitleField(targetDef) ?? 'name';
            try {
              const refRes = await dataSource.find(target, {
                $filter: { id: { $in: Array.from(ids) } },
                $top: ids.size,
                $select: ['id', titleField],
              });
              const rows: any[] = Array.isArray(refRes) ? refRes : refRes?.data || [];
              lookupLabels.set(
                target,
                new Map(
                  rows
                    .filter((r) => r?.id != null && typeof r?.[titleField] === 'string' && r[titleField])
                    .map((r) => [String(r.id), r[titleField] as string]),
                ),
              );
            } catch (err) {
              console.warn(`[RecordDetailView] Failed to resolve audit lookup labels for ${target}:`, err);
            }
          }),
        );
        if (cancelled) return;

        const fmtCtx = { t, locale: language, lookupLabels };
        const enriched = items.map((it, idx) => {
          const u = it?.user_id ? userMap.get(it.user_id) : undefined;
          // Attribution fallback chain: resolved user name → service/automation
          // principal from the `actor` column (e.g. "svc:flow:<name>") → null
          // (the timeline then shows its localized unknown-user text).
          // A `svc:*` principal is a machine, not a person — render the
          // localized "System" label rather than the raw principal string
          // (framework#4366); the raw value stays available on the entry.
          const rawActor =
            typeof it?.actor === 'string' && it.actor.trim() && it.actor !== it?.user_id
              ? it.actor.trim()
              : null;
          const actorLabel = rawActor?.startsWith('svc:')
            ? t('detail.systemActor', { defaultValue: 'System' })
            : rawActor;
          const changes = rawChangesPerItem[idx].map((c) => ({
            field: c.field,
            label: fieldLabels[c.field] || c.field,
            from: formatAuditValue(objectDef.fields?.[c.field], c.from, fmtCtx),
            to: formatAuditValue(objectDef.fields?.[c.field], c.to, fmtCtx),
          }));
          return {
            ...it,
            user_name: u?.name ?? actorLabel,
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
    // `t` is identity-stable per language; `language` already refires the
    // effect on locale switches so formatted diff values re-localize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSource, pureRecordId, objectDef, historyEnabled, objects, language]);

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
  //
  // Carries the ADR-0066 D4 capability gate into this view's ActionProvider —
  // see `resolveActionUser` for why that matters (framework#3923).
  const currentUser = useMemo(
    () => resolveActionUser(user, permissionsLoaded, systemPermissions),
    [user?.id, user?.name, user?.image, permissionsLoaded, systemPermissions],
  );

  // ── Feed loading signal (objectui#3209) ──────────────────────────────────
  //
  // This view OWNS the discussion fetch (the two `find`s below are the only
  // thing that can fill `feedItems`), so it is the only place that can say
  // "still fetching". Until this existed nobody on the chain could: the
  // panel spent every fetch asserting `No comments yet` — a factual claim
  // about the record — and then contradicted itself when the rows landed.
  // #3205 gave `RecordActivityTimeline` the loading render branch; this is
  // the missing SIGNAL behind it. Same shape as #3165/#3205: produced by the
  // host that owns the fetch, never guessed at the consumer (a "no items yet
  // and just mounted" heuristic down in the timeline would be wrong the
  // moment a record genuinely has no comments).
  //
  // Keyed rather than a plain boolean, deliberately. A `useState(false)` +
  // `setFeedLoading(true)` inside the effect paints the empty state for the
  // frame before the effect runs, and navigating to another record would show
  // the PREVIOUS record's settled state until its effect re-fired. Deriving
  // "the key I would fetch for ≠ the key I have settled" makes the very first
  // render of a record already read as loading, with no reset effect.
  // `record:activity` derives its own flag the same way (`canSelfFetch &&
  // fetched === null`) — one idiom, not two.
  //
  // ── Feed STATE is keyed by the same key (objectui#3268) ─────────────────
  //
  // `feedRecordKey` is the identity of the record a feed row belongs to — the
  // very `thread_id` the rows are stored under server-side. Every write into
  // the feed, fetched or optimistic, goes into that record's slice, and the
  // render reads only the CURRENT key's slice. This view is not remounted
  // between records (no `key=` at any mount site — `console/AppContent.tsx`
  // and the `ObjectView` / `ObjectDataPage` / `InterfaceListPage` drawers just
  // swap `recordIdOverride`, deliberately: #2269 "refresh data, don't rebuild
  // UI"), and both reads below merge by row id — so with one flat `FeedItem[]`
  // record A's comments and activity stayed on record B's panel with B's rows
  // merged in alongside (different ids, so the merge could not dedupe them).
  //
  // Keying rather than clearing is the point:
  //   • "empty for a new record" FALLS OUT of reading a key with no slice —
  //     there is no `setFeedItems([])` racing the fetch that filled it;
  //   • a response that lands AFTER the user navigated away is written under
  //     the key its effect closed over, so it can never bleed into the record
  //     now on screen (the same guarantee `settledFeedKey` gives the loading
  //     flag — one idiom in this file, not two);
  //   • ⛔ optimistic rows (a comment posted but not yet persisted) ride in
  //     their own record's slice, so navigating away and back does not drop
  //     them. Nothing here ever deletes a slice; that is deliberate, and it is
  //     also why coming back to a record shows its rows immediately instead of
  //     a spinner while the re-read confirms them (#3205).
  const feedRecordKey = objectName && pureRecordId ? `${objectName}:${pureRecordId}` : null;
  const feedItems = (feedRecordKey ? feedItemsByRecord[feedRecordKey] : undefined) ?? EMPTY_FEED;
  const feedFetchKey =
    dataSource && feedRecordKey && (feedsEnabled || activitiesEnabled) ? feedRecordKey : null;
  const [settledFeedKey, setSettledFeedKey] = useState<string | null>(null);
  const feedLoading = feedFetchKey !== null && settledFeedKey !== feedFetchKey;

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
    let cancelled = false;
    const threadId = `${objectName}:${pureRecordId}`;
    // The two reads below run in PARALLEL and are collected here so the
    // loading flag can close over BOTH of them — see the `allSettled` at the
    // end of this effect.
    const inFlight: Promise<unknown>[] = [];

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

    if (feedsEnabled) inFlight.push(dataSource.find('sys_comment', { $filter: { thread_id: threadId }, $orderby: { created_at: 'asc' } })
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
        // Into THIS record's slice — `threadId` is the key the effect closed
        // over, so a response that arrives after the user navigated away
        // updates the record it was fetched for, never the one on screen.
        setFeedItemsByRecord(prev => ({
          ...prev,
          [threadId]: mergeFeedRows(prev[threadId] ?? EMPTY_FEED, mapped),
        }));
      })
      .catch(() => {}));

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
    if (activitiesEnabled) inFlight.push(dataSource.find('sys_activity', {
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
        // Merge by id into THIS record's slice (timeline events are
        // append-only); `mergeFeedRows` sorts by createdAt ascending so the
        // activity panel reads as a chronological narrative.
        setFeedItemsByRecord(prev => ({
          ...prev,
          [threadId]: mergeFeedRows(prev[threadId] ?? EMPTY_FEED, mapped),
        }));
      })
      .catch(() => {}));

    // The panel leaves the loading state exactly once, when BOTH reads have
    // answered. `allSettled` over promises that already carry their own
    // `.catch(() => {})` is what makes a FAILED read count as an answer: a
    // 404 from `sys_activity` (deployment without the audit plugin) or a
    // rejected `sys_comment` must land the panel on the empty state, never
    // pin it in a permanent spinner. Keyed off `feedFetchKey` so a settle
    // that arrives after the user has navigated to another record cannot
    // clear the new record's loading state.
    Promise.allSettled(inFlight).then(() => {
      if (!cancelled) setSettledFeedKey(feedFetchKey);
    });

    return () => { cancelled = true; };
  }, [dataSource, objectName, pureRecordId, currentUser, feedsEnabled, activitiesEnabled, feedFetchKey]);

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
      // The optimistic row goes into the slice of the record it was written
      // ON, under the same key its `thread_id` will carry (objectui#3268) —
      // so navigating away and back finds it again, and it never shows up on
      // another record's panel. The re-read merges the persisted copy onto it
      // by id, so there is no duplicate when it lands.
      if (feedRecordKey) {
        setFeedItemsByRecord(prev => ({
          ...prev,
          [feedRecordKey]: [...(prev[feedRecordKey] ?? EMPTY_FEED), newItem],
        }));
      }
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
    [currentUser, dataSource, objectName, pureRecordId, feedRecordKey, mentionSuggestions],
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
      // Same record-scoped optimistic write as `handleAddComment` — the reply
      // and the parent's bumped `replyCount` both belong to THIS record's
      // slice (objectui#3268).
      if (feedRecordKey) {
        setFeedItemsByRecord(prev => {
          const updated = [...(prev[feedRecordKey] ?? EMPTY_FEED), newItem];
          return {
            ...prev,
            // Increment replyCount on parent
            [feedRecordKey]: updated.map(item =>
              item.id === parentId
                ? { ...item, replyCount: (item.replyCount ?? 0) + 1 }
                : item
            ),
          };
        });
      }
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
    [currentUser, dataSource, objectName, pureRecordId, feedRecordKey, mentionSuggestions],
  );

  const handleToggleReaction = useCallback(
    (itemId: string | number, emoji: string) => {
      if (!feedRecordKey) return;
      // Reactions are toggled from the panel of the record on screen, so they
      // apply to that record's slice only (objectui#3268) — an id collision
      // with a row cached for another record cannot reach across.
      setFeedItemsByRecord(prevByRecord => ({
        ...prevByRecord,
        [feedRecordKey]: (prevByRecord[feedRecordKey] ?? EMPTY_FEED).map(item => {
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
        }),
      }));
    },
    [currentUser.id, dataSource, feedRecordKey],
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
        history?: { entries: any[]; loading: boolean; unknownUserText?: string };
        approvals?: { count?: number; node?: Record<string, any> };
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

    // Filter actions for the record page header and deduplicate by name.
    // Both header locations are included: `record_header` renders inline,
    // `record_more` renders inside the header's ⋯ overflow menu (the spec's
    // "overflow menu under the More/⋯ button" location — PageHeaderRenderer
    // routes record_more-only actions into the overflow; #2358 trap 2).
    const recordHeaderActions = (() => {
      const seen = new Set<string>();
      const base = (objectDef.actions || []).filter((a: any) => {
        if (!a.locations?.includes('record_header') && !a.locations?.includes('record_more')) return false;
        if (!a.name) return true;
        if (seen.has(a.name)) return false;
        seen.add(a.name);
        return true;
      }).map((a: any) => localizeActionTexts(objectDef.name, a));

      // ⛔ No approval actions are injected here any more (objectui#3055).
      // They used to be two hand-written buttons (approve/reject only, no
      // attachments, own copy, own CLIENT-side approver test) spliced into this
      // header list. They now render from `sys_approval_request`'s OWN declared
      // actions through `<DeclaredActionsBar>` below — the same metadata the
      // approvals list runs, gated by the same server-computed `viewer` block.
      //
      // The header list is the wrong carrier for them and cannot be fixed into
      // one: `action:bar` evaluates a `visible` predicate against THIS page's
      // record (a business record has no `viewer` block) and stamps that same
      // record into `params._rowRecord`, so a declared action targeting
      // `/api/v1/approvals/requests/{id}/…` would resolve `{id}` to the
      // business record's id. The request row has to be the dispatch record,
      // which is exactly what the bar does.
      return base;
    })();

    // Highlight-strip field names from the object's semantic role
    // (ADR-0085). Bare names pass through; `{ name }` descriptors reduce
    // to their name. Empty → undefined below, so the synthesizer
    // auto-derives instead.
    const rawHighlightFields = (objectDef as any).highlightFields ?? [];
    // Drop the record's title field: it is the page H1 and repeating it as
    // the first chip duplicated the name, truncated, right under the
    // heading. Mirrors deriveHighlightFields' declared-list handling —
    // this pre-computed list bypasses that derivation (#2548).
    const titleField = resolveTitleField(objectDef as any);
    const highlightFields: string[] = (Array.isArray(rawHighlightFields) ? rawHighlightFields : [])
      .map((f: any) => (typeof f === 'string' ? f : f?.name))
      .filter((n: any): n is string => typeof n === 'string' && n.length > 0 && n !== titleField);

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
          unknownUserText: t('detail.unknownUser', { defaultValue: 'Unknown' }),
        },
      }),
      // Approvals tab (#3461) — only when the record actually has requests,
      // so approval-free records carry no dead tab. The node carries the
      // LIVE hook result this view already holds (the same read behind the
      // header decision buttons); like `history`, data flows through the
      // synthesized schema, and the deps below rebuild the page when a
      // decision changes the request set or its tally.
      ...(approvals.available && approvals.requests.length > 0 && {
        approvals: {
          count: approvals.requests.length,
          node: {
            approvals: {
              available: approvals.available,
              requests: approvals.requests,
              pendingRequest: approvals.pendingRequest,
            },
            currentUserId: user?.id,
          },
        },
      }),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // `approvals.requests` / `approvals.pendingRequest` are in the deps for the
  // Approvals tab payload (#3461) — the tab's node carries the live rows, and
  // the panel's headline is the pending one. (The decision actions no longer
  // ride this list at all — objectui#3055 moved them to the declared-action
  // bar, which reads the pending row directly.)
  }, [objectDef?.name, childRelations, t, objectLabel, objects, historyEnabled, historyEntries, historyLoading, approvals.available, approvals.pendingRequest, approvals.requests, user?.id]);

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
  // Synthesized pages place `record:attachments` beside the discussion feed
  // (objectstack#4358); the legacy bottom-of-page append below stays only as
  // the fallback for authored pages that don't slot the panel themselves.
  const hasAttachments = hasExplicitAttachments(effectivePage as any);

  // System actions (Edit / Share / Delete) — synthesized for every record
  // page so objects without authored record_header actions still surface
  // the basic affordances.
  //
  // Placement metadata (objectui#2361): the page header now renders up to
  // `maxVisible` inline buttons sorted by `order` (lower = more prominent).
  // Authored business actions default to `order: 0`, so giving the system
  // set high orders (100+) keeps them behind every business action, and
  // `component: 'action:menu'` pins Share/Delete inside the `⋯` overflow
  // menu permanently — Delete must never surface as an inline red button
  // just because an object has few actions.
  const synthSystemActions: ActionDef[] = (() => {
    const objectAffordances = resolveRecordHeaderActionGates(objectDef, effectiveApiOperations);
    // Object-level gate AND the record-level verdict (objectstack#3821) AND the
    // object's per-record `userActions` predicate (objectui#4213 — see the
    // evaluation block beside `recordDeleteAllowed` above).
    //
    // The predicate is a FOURTH conjunct: the affordance and permission gates
    // above are untouched, so a predicate that holds can never resurrect a
    // button the bucket closed or the user may not press. It only ever
    // subtracts.
    const affordances = {
      edit: objectAffordances.edit && recordWriteAllowed && editVisible,
      delete: objectAffordances.delete && recordDeleteAllowed && deleteVisible,
    };
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
        order: 100,
        // objectui#2572 item 4 — while a shared inline-edit draft is live,
        // the page:header renderer greys this CTA out so the classic form
        // can't be stacked on top of the draft (two competing edit sessions
        // with no reconciliation).
        disableDuringInlineEdit: true,
        // framework#3794 — an approval-LOCKED record refuses every write (the
        // server answers RECORD_LOCKED), so opening the form only to be
        // rejected on Save after filling a screen is wasted work. Disabled
        // rather than hidden: the user should see the affordance exists and is
        // off, with the lock band next to it saying why. Note this is the
        // LOCK, not the mere presence of an approval — a `lockRecord: false`
        // node keeps Edit live, which is the point of that setting.
        //
        // objectui#4213 — `edit.disabledWhen` composes onto this SAME key
        // rather than opening a second one: `visibleWhen` decides existence,
        // `disabledWhen` decides pressability, and either reason for "off" is
        // the same off. OR, not AND: an approval lock and a declared predicate
        // are independent reasons, and neither may cancel the other. With no
        // predicate declared `editDisabledByPredicate` is `false`, so this is
        // byte-identical to the pre-#4213 `disabled: approvalLocked`.
        disabled: approvalLocked || editDisabledByPredicate,
        onClick: () => onEdit({ id: pureRecordId }),
      } as any);
    }
    items.push({
      name: 'sys_share',
      label: t('detail.share', { defaultValue: 'Share' }),
      type: 'script',
      locations: ['record_header'],
      variant: 'outline',
      order: 110,
      component: 'action:menu',
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
          toast.success(t('detail.linkCopied', { defaultValue: 'Link copied to clipboard' }));
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
        order: 120,
        component: 'action:menu',
        // objectui#4213 — `delete.disabledWhen` greys the overflow entry, the
        // kebab's rule for the same key. Spread only when it HOLDS: this action
        // declared no `disabled` key before, and `page:header` reads a declared
        // `disabled` by `!= null`, so emitting a bare `false` would say
        // something the object never declared. With no predicate the emitted
        // ActionDef is byte-identical to the pre-#4213 one.
        ...(deleteDisabledByPredicate ? { disabled: true } : null),
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
        approvals: synthParts.approvals,
        // ADR-0085 removed the per-object `detail.*` presentation
        // toggles (show/hideReferenceRail, hideRelatedTab, relatedLayout)
        // — the synth defaults apply; per-page layout goes through an
        // assigned Page schema (`record:reference_rail` stays available
        // there as a renderer capability).
        ...(assignedSlots ? { slots: assignedSlots } : {}),
      });

  // Same split as attachments, but introspected on `renderedPage` — the tree
  // actually rendered — NOT `effectivePage` (#3461): the Approvals tab exists
  // only in the synthParts-aware rebuild above (it depends on runtime request
  // data), so the early `effectivePage` synth never contains it and checking
  // that tree would double-render the panel (tab + bottom fallback).
  const hasApprovalsNode = hasExplicitApprovals(renderedPage as any);

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
        refresh={headerRefresh}
        headerSystemActions={synthSystemActions}
        isFavorite={isRecordFavorite}
        onToggleFavorite={favoriteRecord ? handleToggleRecordFavorite : undefined}
      >
        {/* objectui#2407 P2 — ONE record-level inline-edit session spanning
            the highlights strip AND the details body (both descend from this
            provider), committed together by the single <InlineEditSaveBar>
            below. `canEdit` carries the object-lifecycle / permission gate
            AND the approval lock (objectui#2572 item 2): a locked record
            hides the pencil affordances and no-ops `enter()`, so users can't
            type into a draft that Save would reject with RECORD_LOCKED.
            `locked` surfaces the approval lock as its own signal so the
            DetailView approval band renders from the SAME dual-source
            `approvalLocked` that gated `canEdit` — engaging even on backends
            that track the lock via approval requests only and never
            materialize an `approval_status` field (objectui#2618).
            `approvalPending` rides alongside it so a node that declares
            `lockRecord: false` still shows its band and recall button while
            leaving the record editable (objectui#2902).

            objectui#4213 — the object's per-record `userActions.edit` predicate
            joins the SAME conjunction, and joins it exactly where
            `approvalLocked` already sits. This expression mirrors the header's
            `sys_edit` gate on purpose (the header CTA and the body pencils are
            one edit affordance in two places), so folding the predicate into
            only one of them would re-create, inside a single file, precisely
            the header-vs-row asymmetry #4213 is about: Edit gone from the
            header while double-click still opened a draft the object says this
            record may not have. `disabledWhen` suppresses the pencils for the
            same reason `approvalLocked` does — a draft Save would reject. */}
        <InlineEditProvider
          canEdit={
            resolveRecordHeaderActionGates(objectDef, effectiveApiOperations).edit
            && recordWriteAllowed
            && !approvalLocked
            && editVisible
            && !editDisabledByPredicate
          }
          locked={approvalLocked}
          approvalPending={approvalPending}
          approvalProgress={approvalProgress}
          lockedReason={t('detail.lockedTooltip', {
            defaultValue: 'This record has a pending approval request; editing is locked',
          })}
        >
        <HighlightFieldsProvider>
        <DiscussionContextProvider
          items={feedItems as any}
          loading={feedLoading}
          onAddComment={handleAddComment as any}
          onAddReply={handleAddReply as any}
          onToggleReaction={handleToggleReaction as any}
          mentionSuggestions={mentionSuggestions}
        >
        {/* No `approval` handler in the set below (objectui#3055): the record
            page has no bespoke approval action TYPE any more. A decision is an
            ordinary `type:'api'` action declared on `sys_approval_request` and
            run by the shared runtime the decision bar mounts. */}
        <ActionProvider
          context={{ record: pageRecord || {}, objectName, user: currentUser }}
          onConfirm={confirmHandler}
          onToast={toastHandler}
          onNavigate={navigateHandler}
          onParamCollection={paramCollectionHandler}
          onResultDialog={resultDialogHandler}
          onModal={modalHandler}
          handlers={{ api: apiHandler, flow: flowHandler, script: serverActionHandler, modal: modalActionHandler }}
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
              {/* The pending approval's DECISION ACTIONS (objectui#3055).
                  `sys_approval_request` declares them as object metadata —
                  approve / reject (with decision attachments) / reassign /
                  send back / request info, plus the submitter's recall and
                  resubmit — and this is the same bar, the same runtime and the
                  same server-computed `visible` gate the approvals list runs
                  them through. The record page adds no per-action code, so a
                  ninth decision action ships as metadata alone.

                  The dispatch record is the REQUEST row, not the business
                  record: that is what makes `{id}` resolve to the request and
                  what gives each action's `visible` the server's `viewer`
                  block (`can_act` / `is_submitter` / `can_override`) to read.
                  Placed above the page body rather than in the header for that
                  reason — see the header-actions comment above — and above the
                  fold, because a pending decision is why the approver opened
                  the record.

                  `approval_remind` is excluded: the approvals panel already
                  renders a richer remind (throttle-aware copy, timeline
                  refresh), and `exclude` is how a host keeps one of an
                  object's declared actions in its own UI without the bar
                  double-rendering it. */}
              {approvals.available && approvals.pendingRequest && (
                <DeclaredActionsBar
                  className="mb-4"
                  objectName={SYS_APPROVAL_REQUEST_OBJECT}
                  record={approvals.pendingRequest}
                  location={RECORD_APPROVAL_ACTION_LOCATION}
                  exclude={[...RECORD_APPROVAL_EXCLUDED_ACTIONS]}
                  onDone={handleApprovalActionDone}
                />
              )}
              <RelatedRecordActionsBridge
                appName={appName}
                objects={objects}
                dataSource={dataSource}
                parentObjectName={objectName}
                parentRecordId={pureRecordId ?? undefined}
                parentTitle={recordTitle}
              >
                <SchemaRenderer schema={withPageTabsUrlSync(renderedPage, { defaultTab: activeTabParam, onTabChange: handleTabChange }) as any} />
              </RelatedRecordActionsBridge>
              {/* Approval visibility fallback (objectui#3461) — synthesized
                  pages surface approvals as a TAB (`record:approvals` via
                  buildDefaultTabs); this bottom append fires only for
                  AUTHORED pages that don't place the node, so the read-gated
                  approval story is never lost to a custom layout. Renders
                  nothing when the record has no requests. */}
              {pureRecordId && !hasApprovalsNode && (
                <RecordApprovalsPanel
                  className="mt-6"
                  approvals={approvals}
                  currentUserId={user?.id}
                />
              )}
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
                  targeting any other object (403 FILES_DISABLED).
                  Fallback only: synthesized pages already place a
                  `record:attachments` node beside the discussion feed
                  (objectstack#4358), so this bottom append fires only for
                  authored pages that omit the panel. */}
              {filesEnabled && !hasAttachments && pureRecordId && (
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
                    loading={feedLoading}
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
                locked={approvalLocked}
                lockedHint={t('detail.lockedTooltip', {
                  defaultValue: 'This record has a pending approval request; editing is locked',
                })}
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
