/**
 * Console ObjectView
 *
 * Thin wrapper around the plugin-view ObjectView that adds:
 * - Multi-view resolution from objectDef.listViews
 * - MetadataInspector toggle
 * - Drawer for record detail preview
 * - useObjectActions for toolbar create button
 * - ListView delegation for non-grid view types (kanban, calendar, chart, etc.)
 */

import { useMemo, useState, useCallback, useEffect, useRef, lazy, Suspense, type ComponentType } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { resolveFilterPlaceholders, DENSITY_MODE_TO_ROW_HEIGHT, normalizeListViewSchema, leadWithNameField, type FilterTokenScope } from '@object-ui/core';
import { parseUserFilterParams, applyUserFilterParams } from './userFilterUrlState.js';
import { buildListFilterKey, readListFilterState, writeListFilterState } from './listFilterStorage.js';
import { VALUELESS_FILTER_OPERATORS } from './viewFilterFold.js';
import { narrowPersonalizationOverlay, isViewConfigPermissionDeniedError } from '@object-ui/data-objectstack';
const ObjectChart = lazy(() =>
  import('@object-ui/plugin-charts').then((m) => ({ default: m.ObjectChart })),
);
const ImportWizard = lazy(() =>
  import('@object-ui/plugin-grid').then((m) => ({ default: m.ImportWizard })),
);
import { ListView } from '@object-ui/plugin-list';
import { ObjectView as PluginObjectView, ViewTabBar, ManageViewsDialog, deriveRecordSurface, overlayWidthFor } from '@object-ui/plugin-view';
import type { ViewTabItem } from '@object-ui/plugin-view';
import { RECORD_DRAWER_PARAM } from '../urlParams.js';
// Plugin registration is handled by the host app (e.g. apps/console/src/main.tsx
// uses ComponentRegistry.registerLazy so heavy plugins stay code-split).
// Do NOT add eager `import '@object-ui/plugin-*'` side-effect imports here.
import {
  Button,
  Empty,
  EmptyTitle,
  EmptyDescription,
  NavigationOverlay,
  isFilterValueComplete,
} from '@object-ui/components';
import { Plus, Upload, Star, StarOff, Table as TableIcon, KanbanSquare, Calendar, LayoutGrid, Activity, GanttChart, MapPin, BarChart3 } from 'lucide-react';
import { useFavorites } from '../hooks/useFavorites.js';
import { useTenancyPosture } from '../hooks/useTenancyPosture.js';
import { getIcon } from '../utils/getIcon.js';
import type { ListViewSchema, ViewNavigationConfig, FeedItem } from '@object-ui/types';
import { detectStatusField, isSystemManagedField } from '@object-ui/types';
import { MetadataPanel, useMetadataInspector } from './MetadataInspector.js';
import { ViewConfigPanel } from './ViewConfigPanel.js';
import { useMetadataClient } from './metadata-admin/useMetadata.js';
import { persistRuntimeMetadata, createRuntimeMetadata, viewEnvelope } from './runtime-metadata-persistence.js';
import { CreateViewDialog } from './CreateViewDialog.js';
import {
  usePreviewDrafts,
  PREVIEW_QUERY_FLAG,
  PREVIEW_QUERY_VALUE,
} from '../preview/PreviewModeContext.js';
import { PageHeader } from '../layout/PageHeader.js';
import { useMobileViewSwitcherRegistration } from '../layout/MobileViewSwitcherContext.js';
import type { MobileViewSwitcherItem } from '../layout/MobileViewSwitcherContext.js';
import { ManagedByBadge } from '../components/ManagedByBadge.js';
import { RecordDetailView } from './RecordDetailView.js';
import { resolveEffectiveCrudAffordances, type RowCrudPredicates } from '../utils/crudAffordances.js';
import { createIdentityImportDataSource, IDENTITY_IMPORT_OBJECT, type IdentityPasswordPolicy } from './identityImport.js';
import { IdentityImportOptions, IdentityImportResultExtra, identityImportFields } from './IdentityImportPanels.js';
import { importTargetFields } from './importTargetFields.js';
import { useExpressionContext } from '../providers/ExpressionProvider.js';
import { resolveManagedByEmptyState } from '../utils/managedByEmptyState.js';
import { resolveViewId } from '../utils/resolveViewId.js';
import { defaultListViewId, viewRowId, isSavedViewId, viewEntry } from '../utils/viewIdentity.js';
import { warnSuppressedListNav } from '../utils/warnSuppressedListNav.js';
import { useObjectActions } from '../hooks/useObjectActions.js';
import { useObjectTranslation, useObjectLabel } from '@object-ui/i18n';
import { usePermissions } from '@object-ui/permissions';
import { useAuth, useWorkspaceAdminStatus } from '@object-ui/auth';
import { useRealtimeSubscription, useConflictResolution } from '@object-ui/collaboration';
import { ActionProvider, useNavigationOverlay, SchemaRenderer, useActionTextLocalizer, useRowPredicate, RelatedRecordActionsProvider } from '@object-ui/react';
import type { RelatedRecordActionsValue, RelatedRecordHandlers } from '@object-ui/react';
import { toast } from 'sonner';
import { useConsoleActionRuntime } from '../hooks/useConsoleActionRuntime.js';
import { useNavRunAction } from '../hooks/useNavRunAction.js';
import { actionRendersAt } from '@object-ui/types';
import { useEnvironmentEntitlements } from '../environment/useEnvironmentEntitlements.js';
import { EnvironmentListToolbar } from '../environment/EnvironmentListToolbar.js';

/** Map view types to Lucide icons (Airtable-style) */
const VIEW_TYPE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
    grid: TableIcon,
    kanban: KanbanSquare,
    calendar: Calendar,
    gallery: LayoutGrid,
    timeline: Activity,
    gantt: GanttChart,
    map: MapPin,
    chart: BarChart3,
};

const FALLBACK_USER = { id: 'current-user', name: 'Demo User' };

/**
 * Replace built-in placeholders (e.g. `{current_user_id}`) inside a list-view
 * filter with concrete values. Filters from platform-shipped `listViews` or
 * saved `sys_view` rows may declare context-sensitive predicates like
 * `{ field: 'submitter_id', operator: 'equals', value: '{current_user_id}' }`
 * — those need to be substituted before the query reaches the API.
 *
 * Delegates to the shared `resolveFilterPlaceholders` in `@object-ui/core`,
 * which also expands date macros and understands `{current_org_id}`.
 *
 * This used to be a local implementation that bailed on non-array input
 * (`if (!Array.isArray(filter)) return filter`) and knew exactly one token.
 * That narrowness is why it could not be reused by dashboard widgets, whose
 * filters are MongoDB-style objects — so widgets went without any resolution
 * at all and silently rendered 0 (framework #3574). Every surface now routes
 * through one shape-agnostic resolver.
 */
function substituteFilterTokens(filter: any, scope: FilterTokenScope): any {
    return resolveFilterPlaceholders(filter, scope);
}

/**
 * Default list columns for an object that declares no explicit list view.
 *
 * Priority: the object's name field ALWAYS leads (see below); then the
 * `highlightFields` semantic role (ADR-0085) verbatim (only dropping names with
 * no field def); otherwise the first `limit` business fields in declared order.
 * Framework-injected system / audit / ownership columns are excluded via the
 * shared `isSystemManagedField` classifier — its single source of truth is the
 * spec `system` flag stamped by `applySystemFields`, with a name-set fallback
 * covering the injected, non-hidden / non-readonly `owner_id` and
 * `organization_id`. Without this, `applySystemFields` (which spreads injected
 * fields to the FRONT of the field map) would surface `owner_id` as a leading
 * raw-id column (#2702, #2777).
 *
 * The name-field lead is `leadWithNameField` from `@object-ui/core`
 * (objectui#7245). `highlightFields` is NOT a column list — it is ADR-0085's
 * "most important fields", and its first consumer, the detail highlight strip,
 * deliberately DROPS the title field because the page H1 above it already shows
 * one. So metadata that is entirely well-authored routinely omits the name:
 * `showcase_account` declares `["status", "industry", "annual_revenue"]` and its
 * default grid rendered 14 rows a user could not tell apart. A list has no H1,
 * so the same role needs the opposite treatment here. Applied to BOTH branches:
 * the fallback walk is declaration-ordered, so an object whose name field is
 * declared late lost it off the end of the `limit` slice.
 *
 * `opts.orgAttribution` (ADR-0105 group posture): reads span every
 * organization the member belongs to, so cross-org rows need attribution —
 * append `organization_id` as a TRAILING column when the object carries the
 * field. Trailing keeps business fields leading; render-time only, never
 * persisted into saved view metadata (a saved view must not fossilize a
 * posture-dependent column set).
 */
/**
 * The `options.timeline` config this page hands to `ListView`.
 *
 * Deliberately does NOT resolve the date axis. `ListView.resolveTimelineDateBinding`
 * is the single read-site that decides which field a timeline buckets by, and it
 * reads the calendar binding when the view carries no timeline one. This face used
 * to fabricate `startDateField: 'due_date'` for every object view — a field name
 * the view never declared and most objects do not have — which both looked like a
 * real binding downstream and, because it is always present, shadowed the calendar
 * fallback entirely. The result on a calendar-bound view was a Timeline the
 * switcher offered and the renderer bucketed wholly into "No date" (objectui#3129).
 *
 * What stays here is the view's OWN declared config, floored at `'name'`. An
 * object-level `objectDef.titleField` leg used to sit in the middle of that
 * chain; it was removed in objectui#6557 because `@objectstack/spec`'s object
 * schema is a `strictObject` that REJECTS the key with `unrecognized_keys`, so
 * no legal object metadata could ever reach it (objectui#6531 established the
 * measurement, and dropped the twin read inside `getRecordDisplayName`).
 *
 * ⚠️ WHAT THE SIBLING BRANCHES BELOW ACTUALLY DO (objectui#7070). The sentence
 * above used to end "— the same two-rung shape the calendar and gantt branches
 * below already use", and for gantt that was FALSE the whole time it stood: the
 * gantt branch floored `startDateField` / `endDateField` at `'start_date'` /
 * `'end_date'`, which is precisely the one-rung fabrication this note declares
 * retired. A note is the authority the next fixer consults, so it vouched for
 * the lines that were broken. Each branch is therefore stated as MEASURED, not
 * as a family:
 *
 *   - `calendarViewOptions` below — forwards a declared block or emits no
 *     `calendar` key at all; it never floors a date axis (objectui#7029).
 *   - `ganttViewOptions` below — forwards the declared block, title floored at
 *     `'name'`, and invents neither date field. Its `'start_date'` / `'end_date'`
 *     floors were deleted by objectui#7070; that is what makes `ObjectGantt`'s
 *     own "Gantt configuration required" screen reachable from this route.
 *   - ⛔ STILL FABRICATING, and deliberately NOT fixed by objectui#7070: the
 *     TIMELINE axis at the two SIBLING FACES. `plugin-list/ListView.tsx` and
 *     `plugin-view/ObjectView.tsx` both floor `startDateField` at `'created_at'`
 *     — the very literal objectui#3129 retired HERE. `ListView` carries it as a
 *     stated decision ("`created_at` stays the last resort for a view that
 *     declares no date axis anywhere"), so the two faces hold contradictory
 *     DOCUMENTED postures on one literal. objectui#7070 routes that to a single
 *     ruling instead of settling it per-face. Until it is answered: this note
 *     describes the timeline axis at THIS face only, and says nothing about the
 *     other two.
 *
 * Exported for the regression suite.
 */
export function timelineViewOptions(viewDef: any): Record<string, unknown> {
    const declaredStart = viewDef?.timeline?.startDateField || viewDef?.timeline?.dateField;
    return {
        // Spread the full view-defined timeline config first so the spec fields
        // (startDateField/endDateField/groupByField/colorField/scale) survive.
        ...(viewDef?.timeline || {}),
        // Only ever restate a binding the view actually declared.
        ...(declaredStart ? { startDateField: declaredStart } : {}),
        titleField: viewDef?.timeline?.titleField || 'name',
        descriptionField: viewDef?.timeline?.descriptionField,
    };
}

/**
 * The `options.calendar` config this page hands to `ListView` — or NOTHING.
 *
 * objectui#7029 (ruled on objectstack#13748, director batch #19, option A).
 * This face used to fabricate `startDateField: 'due_date'` and
 * `titleField: 'name'` for EVERY object view, declared or not. Downstream that
 * is indistinguishable from a real binding, and it is what made the calendar
 * renderer's own refusal screen ("Calendar configuration required…",
 * `ObjectCalendar.tsx`) unreachable from this route: the renderer decides by
 * asking whether a start-date binding is PRESENT, and this face always said
 * yes. Measured on hotcrm's `crm_leave_request` (real fields `start_date` /
 * `end_date`, no `calendar:` block): all nine records piled onto today's cell
 * with titles resolved through the display-name chain — a plausible, fully
 * wrong screen with zero signal to the author.
 *
 * The same fabrication also fed two gates that read this bag:
 * `ListView.availableViews` offered the Calendar toggle for every object view,
 * and `resolveTimelineDateBinding` accepts a calendar binding as a legitimate
 * timeline axis — so the invented name silently answered for the Timeline
 * switcher too.
 *
 * What stays is the view's OWN declared block, forwarded verbatim (spread, not
 * whitelisted, so every spec key survives), and `undefined` when the view
 * declared none. Exactly the shape the sibling faces already converged on:
 * `timelineViewOptions` above (objectui#3129 retired this very literal from the
 * timeline axis), the kanban branch's `detectStatusField` (ADR-0085, "never
 * invents a field the object doesn't have"), and `defaultCalendarFromObject`
 * in `InterfaceListPage` (a binding or `undefined`, never a guess).
 *
 * ⚠️ A view that carried no `calendar:` block and happened to sit on an object
 * with a real `due_date` field was rendering by luck; it now reaches the
 * refusal screen instead. That is the ruled loud-over-silent direction.
 *
 * Exported for the regression suite.
 */
export function calendarViewOptions(viewDef: any): Record<string, unknown> | undefined {
    const declared = viewDef?.calendar;
    if (!declared || typeof declared !== 'object') return undefined;
    // Forward what the author wrote — nothing invented, nothing floored.
    return { ...declared };
}

/**
 * The `options.gantt` config this page hands to `ListView`.
 *
 * objectui#7070 — the same class objectui#7029 removed from the calendar branch,
 * reported separately by PR #7062 rather than fixed alongside it. This face used
 * to floor `startDateField` at `'start_date'` and `endDateField` at `'end_date'`
 * for EVERY object view, declared or not — field names no view had written and
 * most objects do not carry. Downstream that is indistinguishable from a real
 * binding, and it is what made `ObjectGantt`'s own refusal screen ("Gantt
 * configuration required. Please specify startDateField, endDateField, and
 * titleField.") unreachable from this route: `getGanttConfig` takes its flat
 * branch as soon as BOTH date props are present, and this face always supplied
 * both. It also answered the ADR-0047 capability gate in `ListView.availableViews`
 * (`schema.options?.gantt?.startDateField`), so the Gantt toggle was live on
 * every object view in the product.
 *
 * ⚠️ MEASURED BEFORE THE DELETION, because #7029's mechanic is only correct
 * where a refusal path exists: `ObjectGantt` REFUSES an absent binding — it does
 * not render empty and does not throw. Pinned as the seam in
 * `plugin-gantt/src/ObjectGantt.unconfiguredRefusal-7070.test.tsx`.
 *
 * What stays is the view's OWN declared block, spread whole so every spec key
 * the renderer reads survives (parentField/typeField for the summary→step
 * hierarchy, baseline*, groupByField, resourceView/assignee*, tooltipFields,
 * quickFilters, …) — a bare whitelist here once dropped every field past
 * colorField and flattened the chart. `titleField` keeps its `'name'` floor:
 * that is a display-name default, not a date axis, and it is the same rung
 * `timelineViewOptions` above carries.
 *
 * Exported for the regression suite.
 */
export function ganttViewOptions(viewDef: any): Record<string, unknown> {
    return {
        ...(viewDef?.gantt || {}),
        // Only ever restates what the view declared — no date field is floored.
        titleField: viewDef?.gantt?.titleField || 'name',
    };
}

/**
 * THE record-detail URL this list surface builds — one route shape, one place.
 *
 * Derived from the LIST's own pathname rather than re-assembled from route
 * params, because that is what the "open in new window" navigation action has
 * always used here: strip a trailing `/view/:viewId` and append
 * `/record/:recordId`. It therefore works wherever this page is mounted, and —
 * more to the point — every affordance that opens a record in a new tab from
 * this page addresses the SAME URL by construction.
 *
 * Since objectui#4490 it also backs the href the list's link column publishes
 * through {@link RelatedRecordActionsValue.recordHref}, so the anchor a user
 * middle-clicks and the tab the row's ⌘-click opens cannot drift apart.
 *
 * Exported for the pin test.
 */
export function listRecordDetailUrl(pathname: string, recordId: string | number): string {
    const basePath = pathname.replace(/\/view\/.*$/, '');
    return `${basePath}/record/${encodeURIComponent(String(recordId))}`;
}

/** No related-list handlers — see {@link listRecordActionsValue}. */
const NO_RELATED_HANDLERS: RelatedRecordHandlers = Object.freeze({});

/**
 * What the object LIST page publishes on `RelatedRecordActionsContext`
 * (objectui#4490).
 *
 * `RelatedRecordActionsProvider` was mounted only on the record DETAIL body
 * (by `RelatedRecordActionsBridge`), which is why PR #4489's real anchors
 * reached lookup values there and the list page's own `link: true` column was
 * left with a click-only `span role="link"`. The list host publishes the same
 * pair here, so `LinkCell` can render a real anchor without knowing anything
 * about routes — one mechanism, all three surfaces.
 *
 * Two deliberate limits:
 *
 *  - **`resolve` returns no handlers.** This surface has no related lists — a
 *    list page's rows are not a child collection — so there is nothing to
 *    resolve. An empty handler set is exactly what the context documents as
 *    "capability unavailable", i.e. the same read-only outcome a consumer gets
 *    with no provider at all, so nothing that renders under this page gains an
 *    affordance it did not have.
 *  - **`recordHref` addresses THIS view's object only.** {@link
 *    listRecordDetailUrl} is derived from the current list's pathname, so it
 *    can only name records of the object being listed; any other object is
 *    `null`, which consumers must render as the plain value (a lookup cell
 *    pointing at a third object stays exactly as it renders today). The
 *    console-wide, any-object builder lives on the detail page's bridge, which
 *    has the routable-object set this page does not.
 *
 * `pathname` is read at CALL time (not captured) so a view switch or a drill-in
 * cannot leave a stale base behind — the same freshness rule the bridge's
 * builder documents for its `?from=` trail.
 *
 * Exported for the pin test.
 */
export function listRecordActionsValue(
    objectName: string,
    openRecordPage: (recordId: string | number) => void,
    getPathname: () => string = () => window.location.pathname,
): RelatedRecordActionsValue {
    const addressable = (targetObjectName: string, recordId: string | number) =>
        targetObjectName === objectName && recordId != null && recordId !== '';
    return {
        resolve: () => NO_RELATED_HANDLERS,
        recordHref: (targetObjectName, recordId) =>
            addressable(targetObjectName, recordId)
                ? listRecordDetailUrl(getPathname(), recordId)
                : null,
        openRecord: (targetObjectName, recordId) => {
            if (!addressable(targetObjectName, recordId)) return;
            openRecordPage(recordId);
        },
    };
}

export function defaultListColumnsFromObject(
    objectDef: any,
    limit = 5,
    opts?: { orgAttribution?: boolean },
): string[] {
    const withOrgAttribution = (cols: string[]): string[] =>
        opts?.orgAttribution && objectDef?.fields?.organization_id && !cols.includes('organization_id')
            ? [...cols, 'organization_id']
            : cols;
    const curated = objectDef?.highlightFields;
    if (Array.isArray(curated) && curated.length > 0) {
        return withOrgAttribution(
            leadWithNameField(objectDef, curated.filter((n: string) => objectDef?.fields?.[n])),
        );
    }
    const fields = objectDef?.fields;
    if (fields && typeof fields === 'object') {
        return withOrgAttribution(
            // Lead BEFORE the slice: slicing first could drop the very column
            // the lead exists to guarantee, on an object that declares its name
            // field after `limit` others.
            leadWithNameField(
                objectDef,
                Object.entries(fields)
                    .filter(([name, f]: [string, any]) => f && !f.hidden && !isSystemManagedField(name, f))
                    .map(([name]) => name),
            ).slice(0, limit),
        );
    }
    return [];
}

/**
 * Read the persisted per-view overrides (density, column widths, sort, hidden
 * columns, inlineEdit …) for `ids`, preferring the adapter's one-request batch
 * enumeration and falling back to a per-view `getView`.
 *
 * Extracted from the effect below so the three-way branch is pinnable on its
 * own (objectui#3774) — the file's existing precedent for this is
 * {@link defaultListColumnsFromObject}.
 *
 * The batch/fallback choice hangs entirely on how `listViewOverrides` ANSWERS,
 * so the two are spelled out:
 *
 * - RESOLVES (including to an empty map) → authoritative. The adapter looked
 *   and reports what exists; an object whose views were never customized
 *   legitimately has no overrides, and we take that answer and skip N GETs.
 *   That is the whole point of the batch call — do not "helpfully" re-probe
 *   per view on an empty map, that reinstates the 404 flurry it removes.
 * - REJECTS → the adapter could not tell, which is NOT the same fact as
 *   "nothing is there". Fall through to the per-view reads.
 *
 * An adapter that swallows its own failures into `{}` collapses those two into
 * the authoritative branch and makes the fallback below unreachable code —
 * that was objectui#3774's second half, fixed in `@object-ui/data-objectstack`.
 */
/**
 * Strip conditions an overlay must never impose, and drop the `filter` key
 * entirely when nothing effective is left (objectui#4155).
 *
 * A view override is merged over the source-declared view as `{ ...source,
 * ...override }`, so its `filter` key REPLACES the view's declared filter
 * wholesale. That made two overlay bodies destructive:
 *
 *   `filter: [{ field: 'x', operator: 'equals', value: '' }]`
 *        — an incomplete filter-panel row. The live query never applied it
 *          (`convertFilterGroupToAST` skips empty values), but as a stored
 *          overlay it became the view's ENTIRE filter and returned `total: 0`:
 *          the "empty list that used to have rows" this issue reports.
 *   `filter: []`
 *        — what "Clear all" wrote. Not a poisoned filter, but still an override
 *          that silently deletes the source declaration (an archived-records
 *          exclusion, say) for everyone.
 *
 * Both are neutralized HERE, on the read path, so an install already carrying a
 * poisoned row self-heals on the next load rather than needing a `sys_metadata`
 * delete plus a service restart. The write that created them is gone too (the
 * filter panel no longer persists anything) — this is the recovery half.
 *
 * Consequence, deliberate and worth naming: an overlay can no longer express
 * "this view has NO filter" over a source view that declares one. That is the
 * strictly safer side of the trade — the shape that expressed it is the same
 * shape that silently erased source declarations, and an author who genuinely
 * wants no filter edits the view (an explicit save), which writes the view body
 * rather than an overlay.
 *
 * Filter entries are matched in both at-rest shapes: spec `ViewFilterRule`
 * objects (`{ field, operator, value }`, what the fold writes) and the legacy
 * runtime triple `[field, operator, value]` a source view may declare and which
 * `persistViewPatch` USED TO copy into the overlay along with the rest of the
 * view — it now stores the patch alone (objectui#5233,
 * {@link buildPersistedViewBody}), so a triple can only reach this pass from a
 * row written before that landed, or from a saved view's own body.
 *
 * Whether a matched entry's VALUE counts as supplied is asked of the builder's
 * own {@link isFilterValueComplete}, not of a local predicate (objectstack#8815,
 * objectui#5025). This pass used to spell the question out here:
 *
 * ```ts
 * value == null || value === '' || (Array.isArray(value) && value.length === 0)
 * ```
 *
 * — right for `scalar` and `list`, blind to `pair`. A `between` carrying one
 * bound is `['2024-01-01', '']`, an array of length 2, so the recovery pass read
 * it as a real condition and handed it back. That is the one shape this pass
 * most needs to strip: `ViewFilterRuleSchema` ACCEPTS a half-filled range
 * (measured on `@objectstack/spec` 17.1.0 — it counts the two slots, not what is
 * in them), so authoring validation is green on it and it only dies at query
 * time, where the server refuses the WHOLE view (`400 INVALID_FILTER`) for every
 * user on every later read. The builder's two write paths were converted to the
 * arity-aware reading; this is the read-path half, and it was the third verbatim
 * copy of a predicate that had already been indicted twice.
 *
 * The split of duties is the helper's own: it answers the VALUE question only,
 * while which operators want no value at all stays with
 * {@link VALUELESS_FILTER_OPERATORS} above — this layer additionally sees the
 * canonical spec spellings (`is_null`) that never reach the dropdown.
 */
export function sanitizeViewOverride(override: any): any {
    if (!override || typeof override !== 'object') return override;
    // objectui#5233 — a PERSONALIZATION overlay contributes only the keys it
    // owns (density / sort / hiddenFields / columnState / inlineEdit). Every
    // other key on such a row is a copy of the source view taken when the
    // user last dragged a column, and the merge below hands it authority over
    // the source declaration it was copied from. Narrowed FIRST and returned:
    // a narrowed row can no longer carry a `filter` at all, so the
    // recovery pass below has nothing left to do for it. The predicate is the
    // adapter's (`@object-ui/data-objectstack` owns the row's shape and stamps
    // its marker) so a saved view's OWN body — enumerated by the same batch
    // read — is returned untouched, exactly as `listViews()` classifies it.
    const narrowed = narrowPersonalizationOverlay(override);
    if (narrowed !== override) return narrowed;
    if (!Array.isArray(override.filter)) return override;

    const kept = override.filter.filter((entry: any) => {
        if (Array.isArray(entry)) {
            // Legacy runtime triple: [field, operator, value]
            if (entry.length < 2) return false;
            const [, operator, value] = entry;
            if (VALUELESS_FILTER_OPERATORS.has(String(operator))) return true;
            return isFilterValueComplete(String(operator), value);
        }
        if (!entry || typeof entry !== 'object') return false;
        if (typeof entry.field !== 'string' || entry.field === '') return false;
        if (VALUELESS_FILTER_OPERATORS.has(String(entry.operator))) return true;
        const value = entry.value;
        return isFilterValueComplete(String(entry.operator), value);
    });

    // The empty-array case is checked FIRST: `filter: []` (Clear all's write)
    // leaves `kept.length === override.filter.length`, so an "unchanged"
    // shortcut ahead of this would hand the destructive empty override straight
    // back.
    if (kept.length === 0) {
        // Nothing effective survives → the overlay carries no opinion about the
        // filter, so the SOURCE-declared filter must win again. Dropping the key
        // (rather than writing `[]`) is what makes the `{ ...source, ...override }`
        // merge fall through to it.
        const { filter: _dropped, ...rest } = override;
        return rest;
    }
    if (kept.length === override.filter.length) return override;
    return { ...override, filter: kept };
}

export async function loadViewOverrides(
    dataSource: any,
    objectName: string,
    ids: string[],
): Promise<Record<string, any>> {
    if (typeof dataSource?.listViewOverrides === 'function') {
        try {
            const all = await dataSource.listViewOverrides(objectName);
            if (all && typeof all === 'object') {
                const map: Record<string, any> = {};
                for (const id of ids) {
                    if (all[id]) map[id] = sanitizeViewOverride(all[id]);
                }
                return map;
            }
        } catch {
            // fall through to per-view fetch
        }
    }
    if (typeof dataSource?.getView !== 'function') return {};
    const entries = await Promise.all(
        ids.map(async (id) => {
            try {
                const v = await dataSource.getView(objectName, id);
                return [id, v] as const;
            } catch {
                return [id, null] as const;
            }
        })
    );
    const map: Record<string, any> = {};
    for (const [id, v] of entries) {
        if (v && typeof v === 'object') map[id] = sanitizeViewOverride(v);
    }
    return map;
}

/**
 * Build the switcher's tab list — the ONE place a tab's identity is decided
 * (objectui#4211).
 *
 * Views reach this function from two independent reads of the same
 * `type='view'` metadata namespace:
 *
 *   - `definedViews` — `objectDef.listViews`, keyed by the composer's runtime
 *     identity (`MetadataProvider.applyViewItem`, `<object>.<key>`);
 *   - `savedViews` — the adapter's `listViews()` overlay rows, keyed by
 *     {@link viewRowId}.
 *
 * The two must produce the SAME string for the same view, because everything
 * downstream that decides whether a view is mutable — the tab's `readonly`
 * flag, `isSavedView`, and the early return in every mutating handler — asks
 * whether the tab's id is among the overlay keys. When they disagreed, a saved
 * view was presented as a system view: its set-default / rename / delete menu
 * entries were not rendered at all, so the click the QA run reported produced
 * no adapter write because there was nothing left to click.
 *
 * They disagreed because the metadata side spelled identity `{ id: key,
 * ...body, ...override }` — `id` FIRST, so an `id` key inside the stored body
 * or the stored override silently replaced it. Both are stored documents that
 * really do carry one: `persistViewPatch` WROTE the whole tab object (its `id`
 * included) back through `updateViewConfig` — since objectui#5233 it writes the
 * patch alone for an overlay ({@link buildPersistedViewBody}) but still the
 * whole body for a saved view's own row, and every row written before that
 * landed still carries an `id` — and a duplicated view copies its
 * source artifact's `id` verbatim. `viewEntry` stamps identity LAST at all
 * three sites, so the tab id is now a property of the key the caller looked the
 * view up by, and can never be a property of the data.
 *
 * Extracted from the `views` memo so the seam is assertable without mounting
 * the view; the memo still owns the concerns that need render context (default
 * columns, labels, the per-user sort).
 *
 * @param fallbackTab - the auto-generated "all records" tab, built lazily
 *   because it needs the translated label and the object's default columns.
 *   Used only when the object declares no views at all.
 */
export function buildViewTabs({
    definedViews,
    primary,
    primaryId,
    savedViews,
    viewOverrides,
    fallbackTab,
}: {
    definedViews: Record<string, any>;
    primary?: any;
    primaryId?: string;
    savedViews: readonly any[];
    viewOverrides: Record<string, any>;
    fallbackTab: () => Record<string, any> & { id: string };
}): Array<Record<string, any> & { id: string }> {
    const viewList = Object.entries(definedViews || {}).map(([key, value]: [string, any]) => {
        const override = viewOverrides[key];
        // Override wins per-key — saved overrides represent org-wide shared
        // view settings (density, column widths, etc. — objectstack#7494's
        // ruling: this store has no per-user scope, so "personal" is not an
        // accurate description of what it persists) that should shadow the
        // embedded definition — but NOT over the tab's identity.
        return viewEntry(key, value, override, {
            type: (override?.type) || value?.type || 'grid',
        });
    });

    // Honor `objectDef.list` (the primary list view, per @objectstack/spec
    // ViewSchema). MetadataProvider mirrors it into `listViews` so it's
    // already in `viewList` above; promote it to the front and mark it as
    // the default so `defaultViewId` picks it over secondary listViews.
    //
    // Its id is the composer's runtime identity (objectui#3770), which is
    // what the tab label / description / emptyState are translated under:
    // `viewLabel` reads `objects.<object>._views.<bare key>.label`, and for a
    // default list declared without a `name` that bare key is `default`.
    if (primaryId) {
        const idx = viewList.findIndex(v => v.id === primaryId);
        if (idx >= 0) {
            const [entry] = viewList.splice(idx, 1);
            viewList.unshift(viewEntry(primaryId, entry, { isDefault: true }));
        } else {
            const override = viewOverrides[primaryId];
            viewList.unshift(viewEntry(primaryId, primary, override, {
                type: (override?.type) || primary?.type || 'grid',
                isDefault: true,
            }));
        }
    }

    if (viewList.length === 0) viewList.push(fallbackTab());

    // Merge user-defined views (overlay rows) after metadata-defined views.
    // Dedup by id so a saved view that shadows a metadata view wins.
    const metaIds = new Set(viewList.map(v => v.id));
    for (const sv of savedViews) {
        const id = viewRowId(sv);
        if (!id) continue;
        // Drop undefined fields so a partial overlay (e.g. baseline row
        // with no user customization) does not stomp `isDefault`/`columns`
        // populated from the metadata view it shadows.
        const rawNormalized: Record<string, any> = {
            label: sv.label || sv.name || id,
            type: sv.type || 'grid',
            columns: sv.columns,
            filter: sv.filter,
            sort: sv.sort,
            showSearch: sv.showSearch,
            showFilters: sv.showFilters,
            showSort: sv.showSort,
            isPinned: sv.isPinned,
            isDefault: sv.isDefault,
            visibility: sv.visibility,
            sortOrder: sv.sortOrder,
            ...sv,
            id,
        };
        const normalized: Record<string, any> = {};
        for (const [k, v] of Object.entries(rawNormalized)) {
            if (v !== undefined) normalized[k] = v;
        }
        if (metaIds.has(id)) {
            const idx = viewList.findIndex(v => v.id === id);
            viewList[idx] = viewEntry(id, viewList[idx], normalized);
        } else {
            viewList.push(viewEntry(id, normalized));
        }
    }
    return viewList;
}

/**
 * The `updateView` writes a "set this view as default" must issue
 * (objectui#4211).
 *
 * Extracted from `handleSetDefaultView` so the write set is assertable without
 * mounting the whole view: the QA symptom this issue records is *zero* adapter
 * writes, and a claim about how many writes a click produces has to be measured
 * against the code that produces them, not a replica of it.
 *
 * The list is never empty — clearing `isDefault` elsewhere is conditional, but
 * setting it here is not. So a set-default that reaches this function always
 * writes; the only way to observe no write at all is to be refused before it,
 * by the `isSavedViewId` guard in the handler (and, upstream of that, by the
 * menu entry the same predicate hides).
 */
export function setDefaultViewPatches(
    savedViews: readonly any[],
    vid: string,
): Array<{ viewId: string; patch: { isDefault: boolean } }> {
    const patches = savedViews
        .filter((sv: any) => viewRowId(sv) !== vid && sv.isDefault)
        .map((sv: any) => ({ viewId: viewRowId(sv) as string, patch: { isDefault: false } }));
    patches.push({ viewId: vid, patch: { isDefault: true } });
    return patches;
}

/**
 * The `updateView` writes a drag-reorder must issue (objectui#4463) —
 * `sortOrder` per saved view, in the new order.
 *
 * Metadata-only views are filtered out: they have no `sys_view` row to write,
 * and their position is carried by the `viewOrder:<object>` localStorage key the
 * handler writes first. `sortOrder` is the index **after** that filter, so the
 * persisted sequence is dense over the saved views alone.
 */
export function reorderViewPatches(
    savedViews: readonly any[],
    orderedIds: readonly string[],
): Array<{ viewId: string; patch: { sortOrder: number } }> {
    const savedIdSet = new Set(savedViews.map((sv: any) => viewRowId(sv)));
    return orderedIds
        .filter(id => savedIdSet.has(id))
        .map((id, idx) => ({ viewId: id, patch: { sortOrder: idx } }));
}

/**
 * Issue one `updateView` per patch — **as a method call on the adapter**
 * (objectui#4463).
 *
 * This exists to make one specific bug unwritable. `handleSetDefaultView` and
 * `handleReorderViews` both used to detach the method before calling it:
 *
 * ```ts
 * const updateView = (dataSource as any).updateView;   // detached
 * …
 * updateView(objectName, target, patch);               // `this` === undefined
 * ```
 *
 * The adapter's `updateView` opens with `await this.connect()`, so every write
 * in the list rejected with `TypeError: Cannot read properties of undefined
 * (reading 'connect')` **before any request was issued** — the user got a toast
 * and the server never heard about it. "Set as Default" was dead on every saved
 * view for exactly this reason, while rename and pin worked from the same menu:
 * `handlePinView` always called it as a method, which is the in-file convention
 * this restores.
 *
 * Both call sites now route through here, so there is a single place in the file
 * that calls `updateView` over a patch list — and it has no local to detach into.
 */
export function dispatchViewPatches(
    dataSource: any,
    objectName: string,
    patches: ReadonlyArray<{ viewId: string; patch: Record<string, any> }>,
): Array<Promise<unknown>> {
    return patches.map(
        ({ viewId, patch }) => dataSource.updateView(objectName, viewId, patch),
    );
}

/**
 * The body a toolbar toggle persists — **the patch only, for an overlay**
 * (objectui#5233).
 *
 * `persistViewPatch` used to send `{ ...baseViewDef, ...patch }`, so an overlay
 * written by a mere column drag copied the view's CURRENT effective `filter` —
 * and its `columns`, `label`, `type`, `isDefault` … — into the stored row. The
 * display merge is `{ ...source, ...override }`, so that copy then outranked
 * the source view forever: an admin edited the view's filter and every user who
 * had once resized a column kept the old one, with nothing reporting it.
 *
 * Ruled by the maintainer on 2026-08-12 (objectstack#7494, comment
 * `5261754173`): 「**`persistViewPatch` 只存 patch,不存 merged base** —— 独立小
 * 修,现在做:它把写入时的有效 filter 冻进 overlay,导致源视图后续的 filter 变更
 * 到不了带 overlay 的用户,这与 per-user 之争无关,是纯粹的存储形状错误。」
 *
 * ## Why the two branches are not one
 *
 * `updateViewConfig` persists through `client.meta.saveItem`, which is a **PUT
 * of the whole document** — the adapter's own `updateView` reads the current row
 * and merges onto it precisely because `saveItem` does not ("there is nothing to
 * merge onto. Fail loudly instead of emitting the partial write"). So what this
 * function returns is what the row BECOMES, not what is layered onto it:
 *
 * - **`isSavedView: false`** — a code-defined *system* view. The row is a
 *   personalization OVERLAY laid on top of a definition that lives elsewhere;
 *   nothing in it but the patch is an opinion the user expressed. Store the
 *   patch. The source view is then free to change under it, which is the card.
 * - **`isSavedView: true`** — a genuinely user-created *saved* view. The row IS
 *   the view; there is no source underneath it to shadow, so the ruled harm
 *   cannot arise here. A patch-only PUT would not narrow this row, it would
 *   **delete the user's view definition** — its `config`/`columns`/`filter`/
 *   `label` are not a frozen copy of anything, they are the view. This branch
 *   therefore still carries the body, byte-identical to the pre-fix write.
 *
 * The same `isSavedViewId` classification already decides the switcher's
 * readonly flag, its five mutating handlers, and whether `updateViewConfig`
 * stamps the overlay marker — so a row cannot be a saved view for one of them
 * and an overlay for another.
 *
 * ## What the overlay branch keeps besides the patch
 *
 * `viewKind` only, and only when the active tab carries one — **identity, not
 * content**, the same line `VIEW_OVERLAY_IDENTITY_KEYS`
 * (`@object-ui/data-objectstack`) draws on the read side, so the write now
 * produces exactly the shape the reader would keep. `object`, `name` and the
 * overlay marker are stamped by `updateViewConfig` itself; `label` is
 * deliberately NOT kept (the platform inherits it from the shadowed registry
 * entry — a stored one is a snapshot of the source view's label at write time,
 * which is the very class of frozen key this narrowing exists to stop).
 *
 * The patch is written verbatim rather than filtered through
 * `VIEW_OVERLAY_OWNED_KEYS`: every call site passes exactly the one key the
 * user just changed, and a filter here would SILENTLY drop a sixth key someone
 * later persists. The ratchet in `ObjectView.overlayPatchOnly.test.ts` is what
 * makes that drift loud instead.
 *
 * ## Consequence for rows written before this shipped
 *
 * They are fat at rest and stay that way until touched — already harmless on
 * read since PR #5272 narrowed the merge (`sanitizeViewOverride` →
 * `narrowPersonalizationOverlay`). Because this write is a full-document PUT,
 * the next toolbar toggle on such a view **replaces** the fat row with the thin
 * one. So the issue's three dispositions land as: tolerate on read (shipped),
 * strip on next write (here), no migration — and both halves are pinned.
 *
 * Extracted from `persistViewPatch` so the write shape is assertable without
 * mounting the view, the same reason `buildViewTabs`, `setDefaultViewPatches`
 * and `reorderViewPatches` above are exported.
 */
export function buildPersistedViewBody(
    baseViewDef: Record<string, any> | null | undefined,
    patch: Record<string, any>,
    opts: { isSavedView: boolean },
): Record<string, any> {
    if (opts.isSavedView) return { ...(baseViewDef || {}), ...patch };
    const viewKind = (baseViewDef as any)?.viewKind;
    // Identity is stamped LAST for the same reason `updateViewConfig` stamps
    // `object`/`name`/the marker last: nothing in the payload can shadow it.
    return viewKind === undefined ? { ...patch } : { ...patch, viewKind };
}

export function ObjectView({ dataSource, objects, onEdit, externalRefreshKey }: any) {
    const { objectName } = useParams();
    const { t } = useObjectTranslation();

    // Resolve the object definition up front. When it's missing we render the
    // "object not found" empty state *here*, before the inner component mounts.
    // This is the key to keeping the Rules of Hooks satisfied: ObjectViewInner
    // holds ~50 hooks and must call them unconditionally, so the missing-object
    // branch lives in this thin wrapper instead of as a mid-component early
    // return. The inner subtree then mounts/unmounts as a whole (object exists
    // ↔ doesn't) rather than toggling the number of hooks executed per render.
    const objectDef = objects.find((o: any) => o.name === objectName);
    if (!objectDef) {
      return (
        <div className="h-full p-4 flex items-center justify-center">
          <Empty>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <TableIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <EmptyTitle>{t('console.objectView.objectNotFound')}</EmptyTitle>
            <EmptyDescription>
              {t('console.objectView.objectNotFoundDescription', { objectName })}
              {' '}
              {t('console.objectView.objectNotFoundHint')}
            </EmptyDescription>
          </Empty>
        </div>
      );
    }

    return (
      <ObjectViewInner
        dataSource={dataSource}
        objects={objects}
        onEdit={onEdit}
        externalRefreshKey={externalRefreshKey}
      />
    );
}

/**
 * Inner ObjectView body. Only mounted by {@link ObjectView} once the object
 * definition is known to exist, so every hook below runs unconditionally on
 * every render of this component — no early return sits between hook calls.
 */
function ObjectViewInner({ dataSource, objects, onEdit, externalRefreshKey }: any) {
    const navigate = useNavigate();
    const { appName, objectName, viewId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const { showDebug } = useMetadataInspector();
    const { t } = useObjectTranslation();
    const { objectLabel, objectDescription: objectDesc, viewLabel, viewEmptyState, actionParamText, fieldLabel, fieldOptionLabel } = useObjectLabel();
    // label + confirmText + successMessage through ONE call (objectui#4265).
    const localizeActionTexts = useActionTextLocalizer();
    const { isFavorite, toggleFavorite } = useFavorites();
    // ADR-0105: under group posture default list columns get a trailing
    // organization_id attribution column (reads span all the user's orgs).
    const orgAttribution = useTenancyPosture() === 'group';
    // ADR-0034: runtime view edits persist via the metadata draft/publish
    // model (the `sys_view` table is retired).
    const metadataClient = useMetadataClient();

    // ADR-0037: in draft-preview mode (`?preview=draft`), `listViews()` reads
    // the draft-overlaid world so a view just created via "Add View" shows up
    // in the ViewTabBar before it is published. Normal mode sees published
    // views only (the publish gate stays intact).
    const previewDrafts = usePreviewDrafts();

    // Inline view config panel state (Airtable-style right sidebar)
    const [showViewConfigPanel, setShowViewConfigPanel] = useState(false);
    const [viewConfigPanelMode, setViewConfigPanelMode] = useState<'create' | 'edit'>('edit');
    // Airtable-style "Create view" dialog (type picker + name input)
    const [showCreateViewDialog, setShowCreateViewDialog] = useState(false);
    // Manage Views dialog (vertical sortable list of all views)
    const [manageViewsOpen, setManageViewsOpen] = useState(false);
    
    // Draft state for view config edits — cached locally, saved on demand
    const [viewDraft, setViewDraft] = useState<Record<string, any> | null>(null);

    // Per-view debounce timers + latest pending patch payloads. Keyed by
    // viewId so toggles on different views don't clobber each other. We
    // merge incoming patches into a single payload so rapid successive
    // toggles (e.g. resize-drag emitting 60 events/sec) collapse into one
    // network write.
    const persistTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const persistPending = useRef<Record<string, Record<string, any>>>({});
    // `persistViewPatch` is defined (and its `useCallback` deps evaluated)
    // BEFORE `savedViews` state exists below — closing over it directly in
    // the dependency array would read it in its temporal dead zone. Mirror
    // it into a ref on every render instead (same pattern as
    // `identityPolicyRef` above), read only from inside the callback body.
    const savedViewsRef = useRef<any[]>([]);
    const persistViewPatch = useCallback(
        (viewIdLocal: string, baseViewDef: Record<string, any>, patch: Record<string, any>) => {
            if (!dataSource?.updateViewConfig || !objectName || !viewIdLocal) return;
            // Merge into pending payload — every key present is the latest
            // value the user intended.
            const prev = persistPending.current[viewIdLocal] || {};
            persistPending.current[viewIdLocal] = { ...prev, ...patch };
            const existing = persistTimers.current[viewIdLocal];
            if (existing) clearTimeout(existing);
            persistTimers.current[viewIdLocal] = setTimeout(() => {
                const merged = persistPending.current[viewIdLocal] || {};
                delete persistPending.current[viewIdLocal];
                delete persistTimers.current[viewIdLocal];
                // A toolbar toggle fires through this ONE path for BOTH a
                // system view (no overlay row yet) and a genuinely saved
                // view — `baseViewDef` is the active tab either way, and
                // nothing upstream of here branches on which. Tell the
                // adapter which case this is via the SAME classification the
                // switcher's own readonly gate and its five mutating
                // handlers already use (`isSavedViewId`), rather than
                // leaving it to (re-)infer from the write's shape: writing
                // this as an unconditional personalization-overlay marker
                // (objectui#4227) would flag the saved view's OWN row and
                // make `listViews()` exclude it on the very next read — the
                // user's own view would vanish from the switcher after they
                // merely toggled its density (objectui#4227 follow-up,
                // PM review on PR #4713).
                const targetIsSavedView = isSavedViewId(savedViewsRef.current, viewIdLocal);
                // objectui#5233 — for a system view's personalization overlay
                // this is the PATCH ONLY: the row used to be written as
                // `{ ...baseViewDef, ...merged }`, which froze the source
                // view's effective `filter` (and `columns`, `label`, `type`,
                // `isDefault` …) into it as of the drag. See
                // `buildPersistedViewBody` for why the saved-view branch is
                // deliberately NOT narrowed — its row IS the view, and
                // `saveItem` is a whole-document PUT.
                Promise.resolve(
                    dataSource.updateViewConfig(
                        objectName,
                        viewIdLocal,
                        buildPersistedViewBody(baseViewDef, merged, { isSavedView: targetIsSavedView }),
                        { isSavedView: targetIsSavedView },
                    )
                ).catch((err: any) => {
                    // objectstack#7494's ruling — the gate refuses ORG-WIDE
                    // view-config writes for a session without the authoring
                    // capability. The toggle that triggered this has ALREADY
                    // moved on screen, so the refusal has to be SAID: swallowing
                    // it into console.error leaves the operator with a density
                    // they did not get and no way to learn why until a reload
                    // silently puts it back.
                    if (isViewConfigPermissionDeniedError(err)) {
                        toast.error(t('console.objectView.viewConfigPermissionDenied'));
                        return;
                    }
                    console.error('[ObjectView] Failed to persist view config:', err);
                });
            }, 300);
        },
        [dataSource, objectName]
    );

    /*
     * There is deliberately NO `persistViewFilter` here (objectui#4155).
     *
     * The list toolbar's filter panel is TRANSIENT state — it belongs to the
     * session (and to `writeListFilterState`'s per-browser restore), not to the
     * view's stored body. It used to persist: every `onFilterChange` the panel
     * emitted was folded and written to the view overlay, so merely opening the
     * panel and clicking `Add filter` wrote an incomplete `field equals ''`
     * condition into `sys_metadata` — which then REPLACED the source-declared
     * `filter` for every user of that view and emptied the list, unrecoverably
     * from the panel itself.
     *
     * The threshold for writing a view overlay is an EXPLICIT save:
     * `handleViewConfigSave` (the view config panel) and `handleSaveAsView`
     * (`ObjectDataPage`). `ObjectDataPage` already made this choice for the
     * sibling surface — "Deliberately NO onSortChange/onFilterChange
     * persistence hooks: this surface never writes back to any saved view"
     * (#2251) — and this surface was the outlier.
     *
     * `foldFilterGroupToSpecRules` (objectstack#5159) is still the one dialect
     * for those explicit paths — the Studio inspector's `FilterBuilderField`
     * folds through it. What is gone is the automatic write, not the fold.
     */

    const handleViewConfigSave = useCallback((draft: Record<string, any>) => {
        setViewDraft(draft);
        setRefreshKey(k => k + 1);

        // ADR-0034: stage a per-item draft via the metadata seam; an explicit
        // Publish (RuntimeDraftBar) promotes it + records a version.
        const vid = draft.id;
        if (metadataClient && vid) {
            // `dataSource` + `objectName` let the seam drop this object's view
            // cache keys (#4373) — the adapter owns which keys those are.
            persistRuntimeMetadata('view', vid, draft, {
                metadataClient,
                dataSource,
                objectName,
            }).catch((err: any) => {
                console.error('[ViewConfigPanel] Failed to persist view config:', err);
            });
        } else {
            console.warn('[ViewConfigPanel] Cannot persist view config: missing metadataClient or viewId.');
        }
    }, [metadataClient, dataSource, objectName]);

    /** Create a new view via the config panel */
    const handleViewCreate = useCallback(async (config: Record<string, any>) => {
        try {
            let createdId: string | undefined;
            if (metadataClient) {
                // Prefill sensible defaults so the saved view renders rows
                // immediately even if the user didn't pick columns yet.
                const objectDef = objects?.find?.((o: any) => o.name === objectName);
                // Prefill business columns only — the shared helper keeps the
                // framework-injected `owner_id` / audit columns out of the lead
                // (#2702, #2777), so a newly created view never opens on a raw id.
                const defaultColumns = defaultListColumnsFromObject(objectDef, 5);
                const incomingColumns = Array.isArray(config.columns) && config.columns.length > 0
                    ? config.columns
                    : defaultColumns;
                // ADR-0005 overlay path — write the full spec under a unique
                // `name` via the metadata customization API instead of into
                // the physical `sys_view` table (whose columns no longer
                // accommodate the spec shape: arrays, nested objects, etc.).
                const spec: Record<string, any> = { ...config, columns: incomingColumns };
                // Per @objectstack/spec, certain view types nest their card/field
                // list inside their type-specific subconfig (e.g. kanban.columns,
                // gallery.visibleFields). The CreateViewDialog only collects
                // required *picker* fields; we mirror the resolved column list
                // into the subconfig here so the spec validator accepts the row.
                if (config.type === 'kanban') {
                    spec.kanban = { ...(spec.kanban || {}), columns: incomingColumns };
                } else if (config.type === 'gallery') {
                    const existing = spec.gallery || {};
                    if (!Array.isArray(existing.visibleFields) || existing.visibleFields.length === 0) {
                        spec.gallery = { ...existing, visibleFields: incomingColumns };
                    }
                }
                // ADR-0034: a new view is created as an invisible per-item
                // draft via the metadata seam; an explicit Publish promotes it.
                // UI-layer concerns (default columns, kanban/gallery massaging
                // above, and the auto-activation below) stay here; the canonical
                // ViewItem envelope + qualified-name identity live in the seam.
                //
                // #2767 P1: the qualified name `<object>.<key>` is used as BOTH
                // the URL segment and `body.name`, so the sys_metadata row key,
                // the ViewTabBar tab id, and the body identity all agree and the
                // draft → read → publish loop resolves.
                const env = viewEnvelope(objectName, spec, {
                    name: (config as any)?.name,
                    label: config.label,
                });
                createdId = await createRuntimeMetadata('view', env.name, env, {
                    metadataClient,
                    // #4373: this flow is the second door into the same rows the
                    // adapter caches. Hand it the adapter (the `dataSource` prop
                    // IS the `ObjectStackAdapter`, via `AppContent`'s
                    // `useAdapter()`) so the seam can drop the object's view keys.
                    dataSource,
                    objectName,
                });
            }
            setShowViewConfigPanel(false);
            setViewConfigPanelMode('edit');
            setRefreshKey(k => k + 1);
            // Auto-activate the newly created view (Airtable parity), and close
            // the main-path loop (#2767 P4): a fresh view is a DRAFT, invisible
            // to a normal (published-only) read, so navigating there plainly
            // would land on "view not found". Enter draft-preview mode
            // (`?preview=draft`) instead — the DraftPreviewBar then lets the
            // user verify and Publish in one click. If already in preview, the
            // sticky provider keeps the flag, so no suffix is needed.
            if (createdId) {
                const previewSuffix = previewDrafts
                    ? ''
                    : `?${PREVIEW_QUERY_FLAG}=${PREVIEW_QUERY_VALUE}`;
                if (viewId) {
                    navigate(`../${createdId}${previewSuffix}`, { relative: 'path' });
                } else {
                    navigate(`view/${createdId}${previewSuffix}`);
                }
            }
        } catch (err) {
            console.error('[ViewConfigPanel] Failed to create view:', err);
        }
    }, [dataSource, objectName, objects, navigate, viewId, metadataClient, previewDrafts]);
    
    // Record count tracking for footer
    const [recordCount, setRecordCount] = useState<number | undefined>(undefined);
    
    // Admin users automatically get design tools (no toggle needed)
    const { user, activeOrganization } = useAuth();
    const { isAdmin } = useWorkspaceAdminStatus();
    const perms = usePermissions();
    const { can, getObjectApiOperations } = perms;

    // [ADR-0066 / objectstack#7494] Hand the adapter the session's REPORTED
    // system capabilities so its `updateViewConfig` gate has something to judge
    // by. The adapter is constructed by the host long before `/me/permissions`
    // resolves, so this is a push, not a constructor argument.
    //
    // `systemPermissions` is passed straight through, `undefined` included:
    // "never reported" and "reported empty" are different answers and the
    // adapter decides between them (unknown fails OPEN — the server enforces
    // the capability on the metadata door either way). Collapsing them here
    // would re-derive, badly, the one distinction `MePermissionsProvider` goes
    // out of its way to preserve (objectui#4656).
    //
    // Wired at THIS component because `updateViewConfig` has exactly one
    // production caller — the `persistViewPatch` below (see the adapter method's
    // own docblock). The gate itself is on the write, so a future second caller
    // is refused whether or not it remembers to do this.
    const { systemPermissions } = perms;
    useEffect(() => {
        (dataSource as any)?.setSystemCapabilities?.(systemPermissions);
    }, [dataSource, systemPermissions]);
    
    // Get Object Definition. The outer ObjectView wrapper already guards the
    // missing-object case, so this always resolves while this component is
    // mounted — every hook below can therefore run unconditionally.
    const objectDef = objects.find((o: any) => o.name === objectName);

    // Refresh trigger — bumped after view CRUD or external data mutations.
    const [refreshKey, setRefreshKey] = useState(0);

    // Shared console action runtime: confirm/param/result dialogs, the
    // authenticated api/flow/server-action handlers, SPA navigation, and the
    // paused screen-flow runner. The same runtime PageView mounts (#1605).
    // ObjectView additionally feeds its confirm/toast handlers into
    // useObjectActions below, so it consumes the hook directly (rather than the
    // ConsoleActionRuntimeProvider wrapper).
    const actionRuntime = useConsoleActionRuntime({
        dataSource,
        objects,
        objectName: objectDef.name,
        onRefresh: () => setRefreshKey((k) => k + 1),
    });
    const { confirmHandler, toastHandler } = actionRuntime;

    // Environment list (sys_environment) is entitlement- + state-aware: born
    // with one production env per org, its single `create_environment` action
    // means different things — "Set up your production environment", "Add
    // development environment", or an upgrade prompt — depending on org state.
    // Resolved org-side here; the hook is a no-op for every other object.
    const isEnvironmentList = objectDef.name === 'sys_environment';
    const environmentEntitlements = useEnvironmentEntitlements({
        enabled: isEnvironmentList,
        dataSource,
        authFetch: actionRuntime.authFetch,
        apiBase: (import.meta as any).env?.VITE_SERVER_URL || '',
        refreshKey,
    });
    // Localized `list_toolbar` actions, shared by the generic action bar and the
    // environment-aware toolbar (the action:bar renderer filters by location).
    const localizedToolbarActions = useMemo(
        () => (objectDef.actions || []).map((a: any) => localizeActionTexts(objectDef.name, a)),
        [objectDef, localizeActionTexts],
    );

    // [#5216] The DECLARED nav `runAction` slot, consumed generically.
    // An object nav entry declaring `runAction: '<name>'` resolves (via
    // `resolveHref`) to this list's href carrying `?runAction=`; landing here
    // runs that action once, through the ordinary execute path.
    //
    // Arm only on an action THIS toolbar actually renders — `list_toolbar` is
    // the slot's surface, so a name that only exists at `record_header` cannot
    // be triggered from here and must not spend the one-shot intent (#4123).
    // `sys_environment` is excluded because `EnvironmentListToolbar` owns the
    // arming there: it must additionally wait for entitlements to resolve, and
    // two consumers of one param would race to strip it.
    const navRunAction = useNavRunAction((requested) =>
        !isEnvironmentList &&
        localizedToolbarActions.some(
            (a: any) => a?.name === requested && actionRendersAt(a, 'list_toolbar'),
        ),
    );
    // Mark exactly the requested action `autoTrigger`, leaving every other
    // action's identity untouched so the bar's ordering/overflow is unchanged.
    const toolbarActionsWithDeepLink = useMemo(
        () =>
            navRunAction === null
                ? localizedToolbarActions
                : localizedToolbarActions.map((a: any) =>
                      a?.name === navRunAction ? { ...a, autoTrigger: true } : a,
                  ),
        [localizedToolbarActions, navRunAction],
    );

    // Resolve which generic CRUD affordances belong in the toolbar for
    // this object's lifecycle bucket (`managedBy`).  config tables show
    // New/Edit/Delete but no CSV Import; system / append-only / better-auth
    // hide the lot — those flows go through purpose-built actions on the
    // source record (e.g. "Submit for Approval" on an Opportunity creates
    // an `sys_approval_request`).  Permissions still gate the buttons.
    // [#3391] Intersect the bucket affordances with the server's effective API
    // operation set for this object (from /me/permissions apiOperations), so the
    // toolbar never offers Import/Export/New/Edit/Delete the server would 405.
    // `undefined` (unrestricted object / old backend) leaves affordances as-is.
    // The identity-import bypass below is independent of `affordances.import`.
    const affordances = useMemo(
      () => resolveEffectiveCrudAffordances(objectDef as any, getObjectApiOperations(objectDef.name)),
      [objectDef, getObjectApiOperations],
    );

    // Propagate externally-triggered refreshes (e.g. global ModalForm submit)
    // into our internal refreshKey so list/data effects re-run.
    useEffect(() => {
        if (externalRefreshKey === undefined || externalRefreshKey === 0) return;
        setRefreshKey(k => k + 1);
    }, [externalRefreshKey]);

    /**
     * [#5153] The object-list toolbar's CREATE predicates — the `create` half
     * of the toolbar-scope pair on THIS surface. #4646 (PR #5145) gave
     * `createPredicates` a consumer on the **related list**
     * (`RelatedRecordActionsBridge`); the standalone object-list page kept
     * gating its "New" on the object-level verdict alone, so one
     * `userActions.create` object form got two different verdicts depending on
     * which surface rendered the button — honoured on a record page's related
     * list, ignored here. `visibleWhen: false` (the objectui#3492 shape) did
     * not hide this "New".
     *
     * BINDING, LAYERING and the fail-CLOSED / fail-SOFT split are the import
     * half's, immediately below, verbatim — the spec types the two toolbar keys
     * identically and binds them in one breath. See that docblock for the
     * reasoning; the only thing that differs here is which affordance is gated.
     *
     * TWO RENDER POINTS, ONE VERDICT. The affordance surfaces twice on this
     * page — the PageHeader button (desktop) and the phone-only floating "+"
     * that stands in for it once the header is hidden. They are one affordance
     * rendered twice, so both consume these SAME two values; computing the
     * predicate once here is what keeps them from disagreeing with each other.
     */
    const objectCanCreate = affordances.create && can(objectDef.name, 'create');
    const createPredicates: RowCrudPredicates | undefined = objectCanCreate
      ? affordances.createPredicates
      : undefined;
    /** `visibleWhen` — fails CLOSED, declared-ness by `?? true`. As Import. */
    const createVisible = useRowPredicate(createPredicates?.visibleWhen ?? true, null, {
      fallback: false,
      warnOnError: true,
      label: 'builtin:create:visibleWhen',
    });
    /** `disabledWhen` — fails SOFT, `!= null` declared-ness OUTSIDE the eval. */
    const createDisabledPred = useRowPredicate(createPredicates?.disabledWhen, null, {
      fallback: false,
      warnOnError: true,
      label: 'builtin:create:disabledWhen',
    });
    const createDisabled = createPredicates?.disabledWhen != null && createDisabledPred;

    /**
     * [#5142] The object-list toolbar's IMPORT predicates — the `import` half
     * of the toolbar-scope pair the spec resolver emits, mirroring what
     * `RelatedRecordActionsBridge` does for `create` (objectui#4646).
     *
     * `@objectstack/spec@17.0.0` types `userActions.create` and
     * `userActions.import` identically and `resolveCrudAffordances` emits a
     * predicate envelope for each; the docblock binds them in one breath
     * ("`importPredicates` — same binding as `createPredicates`"). #4646 gave
     * `create` a consumer and left `import` declared-and-inert: an author could
     * write `userActions.import.visibleWhen`, have the spec accept it and the
     * resolver parse it, and watch this toolbar offer the CSV wizard anyway.
     *
     * BINDING (the spec docblock's, not an invention here). Unlike the ROW
     * predicates, a toolbar predicate evaluates ONCE per toolbar against the
     * record of the scope the toolbar sits in — the host parent record on a
     * related list, and **no record at all on a standalone object list**, which
     * is what this surface is. So `null` is passed deliberately below: a
     * predicate reading `record.*` has nothing to bind, faults, and — per the
     * fail-CLOSED rule — hides the button, exactly as the spec spells out.
     * Predicates over the host scope (`os.user.*` / `features.*`) bind normally
     * and are the meaningful shape here.
     *
     * LAYERING: surfaced only when the object-level verdict already passed —
     * the same posture the related-list bridge takes, because a predicate may
     * not RE-OPEN what the bucket, the effective API operations (#3391) or the
     * principal's grant have closed. The identity-import bypass below is a
     * different affordance entirely (it does not read `affordances.import`) and
     * is deliberately left outside this layer.
     */
    const objectCanImport = affordances.import && can(objectDef.name, 'create');
    const importPredicates: RowCrudPredicates | undefined = objectCanImport
      ? affordances.importPredicates
      : undefined;
    /**
     * `visibleWhen` — fails CLOSED, and counts as DECLARED by `?? true` rather
     * than by truthiness, so `visibleWhen: false` hides Import instead of
     * reading as "ungated" (the objectui#3492 invariant). The `true` default is
     * a boolean, which the evaluator short-circuits without touching the engine
     * — an object with no import predicates pays no evaluation at all.
     */
    const importVisible = useRowPredicate(importPredicates?.visibleWhen ?? true, null, {
      fallback: false,
      warnOnError: true,
      label: 'builtin:import:visibleWhen',
    });
    /**
     * `disabledWhen` — fails SOFT (an unevaluable predicate must not grey a
     * button forever), with the `!= null` declared-ness gate OUTSIDE the
     * evaluation so `disabledWhen: ''` reads as "no condition" rather than as
     * "disable". Verbatim the posture of the record header (PR #4515), the
     * row kebab, and the related-list toolbar.
     */
    const importDisabledPred = useRowPredicate(importPredicates?.disabledWhen, null, {
      fallback: false,
      warnOnError: true,
      label: 'builtin:import:disabledWhen',
    });
    const importDisabled = importPredicates?.disabledWhen != null && importDisabledPred;

    // Import wizard open/close state — toolbar entry triggers it.
    const [showImport, setShowImport] = useState(false);

    // ─── Identity import (framework#2782) ────────────────────────────────
    // sys_user's generic import affordance stays FALSE (a data-layer insert
    // would bypass better-auth's hashing and never create a credential), but
    // platform admins get the same wizard wired to the dedicated
    // /api/v1/auth/admin/import-users pipeline. Gated on the deployment's
    // admin surface (features.admin from /api/v1/auth/config) plus the
    // caller being a workspace admin (the server re-checks, ADR-0068).
    const { features } = useExpressionContext();
    const isIdentityImport = objectDef.name === IDENTITY_IMPORT_OBJECT;
    const identityImportEnabled = isIdentityImport && features?.admin === true && isAdmin;
    const [identityPasswordPolicy, setIdentityPasswordPolicy] = useState<IdentityPasswordPolicy>('auto');
    const identityPolicyRef = useRef<IdentityPasswordPolicy>('auto');
    identityPolicyRef.current = identityPasswordPolicy;
    const identityDataSource = useMemo(
      () => (identityImportEnabled
        ? createIdentityImportDataSource({
            base: dataSource,
            authFetch: actionRuntime.authFetch,
            baseUrl: import.meta.env.VITE_SERVER_URL || '',
            getPasswordPolicy: () => identityPolicyRef.current,
          })
        : undefined),
      [identityImportEnabled, dataSource, actionRuntime.authFetch],
    );

    // ─── User-defined views (metadata overlay) ──────────────────────────
    // Saved views created via the ViewConfigPanel ("Add View") live in the
    // metadata overlay (`/meta/view`). We fetch them via `listViews` and merge
    // into `views` so the ViewTabBar renders them alongside metadata-defined
    // listViews.
    const [savedViews, setSavedViews] = useState<any[]>([]);
    savedViewsRef.current = savedViews;
    useEffect(() => {
        let cancelled = false;
        if (!objectName) {
            setSavedViews([]);
            return;
        }
        // Read saved views from the metadata overlay (`/meta/view`) via the
        // adapter's `listViews`. Adapters without it surface no saved views.
        if (typeof (dataSource as any)?.listViews === 'function') {
            (dataSource as any).listViews(objectName, { previewDrafts })
                .then((rows: any[]) => {
                    if (cancelled) return;
                    // Normalize: ensure each view has an `id` for ViewTabBar
                    // (which is name-keyed downstream). Stamp `objectName`
                    // so the defensive filter in handlers still works.
                    const normalized = (rows || []).map((sv: any) => ({
                        ...sv,
                        // Overlay rows are keyed by `name`. Prefer that as the
                        // tab id so a duplicate's `id` field (which may have
                        // been copied verbatim from the source artifact) does
                        // not collide with the source's view id during dedup.
                        // `viewRowId` owns that rule for every consumer of this
                        // array too, so the key written here and the key read
                        // back cannot drift apart (objectui#4211).
                        id: viewRowId(sv),
                        objectName: sv.objectName || sv.object || objectName,
                    }));
                    setSavedViews(normalized);
                })
                .catch((err: any) => {
                    console.error('[ObjectView] Failed to load overlay views:', err);
                    if (!cancelled) setSavedViews([]);
                });
            return () => { cancelled = true; };
        }
        // No overlay API available (e.g. a minimal adapter / test mock) → no
        // saved views. The retired `sys_view` table is no longer read.
        setSavedViews([]);
        return () => { cancelled = true; };
    }, [dataSource, objectName, refreshKey, previewDrafts]);

    // Persisted per-view config overrides (e.g. density toggle). Saved
    // separately from `objectDef.listViews` (the embedded definition) via
    // `dataSource.updateViewConfig` and read back here so the toggle state
    // survives a hard reload. Org-wide shared settings (objectstack#7494's
    // ruling), not a per-user preference. Keyed by viewId → partial view
    // config to merge.
    //
    // Reading strategy (batch first, per-view fallback) lives in the exported
    // `loadViewOverrides` above so it can be pinned directly — see its doc for
    // why an empty batch result is authoritative but a rejected one is not.
    const [viewOverrides, setViewOverrides] = useState<Record<string, any>>({});
    useEffect(() => {
        let cancelled = false;
        if (!dataSource || !objectName) {
            setViewOverrides({});
            return;
        }
        // `listViews` is canonical (#5362; @objectstack/spec declares only camelCase). The
        // `list_views` leg is a compatibility READ for stored pre-settlement documents
        // (that stock has never been censused: objectstack#7917). Never WRITE the snake key.
        const definedViews = (objectDef.listViews || objectDef.list_views || {}) as Record<string, any>;
        const ids = Object.keys(definedViews);
        // Include the primary view id so overrides apply to it too. Its identity
        // comes from the view composer (objectui#3770) — the same id the override
        // was persisted under, since `persistViewPatch` writes by view id.
        const primaryId = defaultListViewId(objectDef.name, (objectDef as any).list);
        if (primaryId && !ids.includes(primaryId)) ids.unshift(primaryId);
        if (ids.length === 0) {
            setViewOverrides({});
            return;
        }

        loadViewOverrides(dataSource, objectName, ids).then((map) => {
            if (!cancelled) setViewOverrides(map);
        });
        return () => { cancelled = true; };
    }, [dataSource, objectName, objectDef.listViews, objectDef.list_views, (objectDef as any).list, refreshKey]);

    // Resolve Views from objectDef.listViews (camelCase per @objectstack/spec)
    const views = useMemo(() => {
        // Default columns for the auto-generated "所有记录" view (and any saved
        // grid view with no explicit columns). `highlightFields` (ADR-0085) wins;
        // otherwise the first business fields — framework-injected system / audit
        // / ownership columns (notably the non-readonly `owner_id`) are excluded
        // by the shared classifier. #2702 applied this to ObjectGrid /
        // InterfaceListPage; this view resolves its columns here (#2777).
        const resolveDefaultColumns = (): string[] =>
            defaultListColumnsFromObject(objectDef, 5, { orgAttribution });

        const viewList = buildViewTabs({
            definedViews: objectDef.listViews || objectDef.list_views || {},
            primary: (objectDef as any).list,
            primaryId: defaultListViewId(objectDef.name, (objectDef as any).list),
            savedViews,
            viewOverrides,
            fallbackTab: () => ({
                id: 'all',
                label: t('console.objectView.allRecords'),
                type: 'grid',
                columns: resolveDefaultColumns(),
            }),
        });

        // Apply default columns to any grid-like view that has no explicit
        // columns (e.g. saved views created via "Add View" before the user
        // configured fields). Without this, the grid renders an empty header
        // row and the data fetch omits a `select` clause.
        const GRID_LIKE = new Set(['grid', 'list', 'table']);
        for (const v of viewList) {
            if (!GRID_LIKE.has(v.type)) continue;
            if (!Array.isArray(v.columns) || v.columns.length === 0) {
                v.columns = resolveDefaultColumns();
            }
        }

        // Stable sort: respect a per-user view-order preference (for both
        // metadata and saved views). Falls back to: metadata views first
        // in declared order, then saved views by `sortOrder` / created_at.
        const indexOf = new Map(viewList.map((v, i) => [v.id, i]));
        let userOrder: string[] = [];
        try {
            const raw = typeof window !== 'undefined'
                ? window.localStorage?.getItem(`viewOrder:${objectDef.name}`)
                : null;
            if (raw) userOrder = JSON.parse(raw);
        } catch { /* ignore */ }
        const userOrderIndex = new Map(userOrder.map((id, i) => [id, i]));
        viewList.sort((a, b) => {
            const aUser = userOrderIndex.get(a.id);
            const bUser = userOrderIndex.get(b.id);
            if (aUser !== undefined && bUser !== undefined) return aUser - bUser;
            if (aUser !== undefined) return -1;
            if (bUser !== undefined) return 1;
            const aSaved = savedViews.find((sv: any) => viewRowId(sv) === a.id);
            const bSaved = savedViews.find((sv: any) => viewRowId(sv) === b.id);
            const aHasOrder = aSaved && typeof aSaved.sortOrder === 'number';
            const bHasOrder = bSaved && typeof bSaved.sortOrder === 'number';
            // Only an explicit user `sortOrder` should reorder views away from
            // the metadata-declared sequence. A bare overlay row (no sortOrder)
            // must not demote a metadata view: that would break primary-view
            // promotion (which relies on declared order) for objects whose
            // overlay seeded a baseline `sys_view` row without sort info.
            if (aHasOrder && bHasOrder) {
                if (aSaved.sortOrder !== bSaved.sortOrder) {
                    return aSaved.sortOrder - bSaved.sortOrder;
                }
                return (aSaved.created_at || '').localeCompare(bSaved.created_at || '');
            }
            if (aHasOrder) return -1;
            if (bHasOrder) return 1;
            return (indexOf.get(a.id) ?? 0) - (indexOf.get(b.id) ?? 0);
        });

        return viewList;
    }, [objectDef, savedViews, viewOverrides, t, orgAttribution]);

    // Active View State — merge saved draft if available for this view.
    // Resolution priority: URL viewId → ?view= → user-marked default → first.
    const defaultViewId = useMemo(() => {
        const def = views.find((v: any) => v.isDefault);
        return def?.id;
    }, [views]);
    // Canonical view ids are fully qualified (`<object>.<viewKind>`, see
    // MetadataProvider), but nav items emit `viewName` verbatim — usually
    // the short form — and legacy embedded listViews carry bare keys (incl.
    // the `'all'` fallback). Resolve the URL-requested name in both
    // directions, and never swallow a miss silently (#2217).
    const requestedViewId = viewId || searchParams.get('view') || undefined;
    const resolvedViewId = useMemo(
        () => resolveViewId(requestedViewId, views.map((v: any) => v.id), objectDef.name),
        [requestedViewId, views, objectDef.name],
    );
    useEffect(() => {
        if (requestedViewId && !resolvedViewId) {
            console.warn(
                `[ObjectView] Requested view "${requestedViewId}" not found on object "${objectDef.name}"; ` +
                `falling back to the default view. Known views: ${views.map((v: any) => v.id).join(', ')}`,
            );
        }
    }, [requestedViewId, resolvedViewId, objectDef.name, views]);
    const activeViewId = resolvedViewId || defaultViewId || views[0]?.id;
    const baseView = views.find((v: any) => v.id === activeViewId) || views[0];
    const activeView = viewDraft && viewDraft.id === baseView?.id
        ? { ...baseView, ...viewDraft }
        : baseView;

    /** Real-time draft field update — propagates each toggle/input change immediately */
    const handleViewUpdate = useCallback((field: string, value: any) => {
        setViewDraft(prev => ({
            ...(prev || {}),
            id: baseView?.id,
            [field]: value,
        }));
    }, [baseView?.id]);

    const handleViewChange = (newViewId: string) => {
        // The plugin ObjectView returns the view ID directly via onViewChange
        const matchedView = views.find((v: any) => v.id === newViewId);
        if (!matchedView) return;
        // Auto-close the config panel only when actually switching to a
        // different view. Same-view clicks (e.g., bubbling from the actions
        // dropdown menu item) must not stomp on a freshly-opened panel.
        if (matchedView.id !== activeViewId) {
            setShowViewConfigPanel(false);
        }
        if (viewId) {
             navigate(`../${matchedView.id}`, { relative: "path" });
        } else {
             navigate(`view/${matchedView.id}`);
        }
    };

    // Mobile view switcher — registers our view list with the AppHeader so
    // the topbar can render a `<viewName> ▾` dropdown instead of the static
    // page label. Desktop ignores this (ViewTabBar handles switching there).
    const mobileViewSwitcherItems = useMemo<MobileViewSwitcherItem[]>(() => {
        return (views || []).map((view: any) => {
            const Icon = VIEW_TYPE_ICONS[view.type as keyof typeof VIEW_TYPE_ICONS];
            return {
                id: view.id,
                label: viewLabel(objectDef.name, view.name || view.id, view.label || view.name || view.id),
                icon: Icon ? <Icon className="h-4 w-4" /> : undefined,
            };
        });
    }, [views, objectDef.name, viewLabel]);
    useMobileViewSwitcherRegistration({
        views: mobileViewSwitcherItems,
        activeViewId: activeViewId ?? '',
        onChange: handleViewChange,
        enabled: mobileViewSwitcherItems.length > 0 && !!activeViewId,
    });

    // ViewSwitcher callbacks — wired to both PluginObjectView instances
    const handleCreateView = useCallback(() => {
        setShowCreateViewDialog(true);
    }, []);

    const handleViewAction = useCallback((actionType: string, viewType: string) => {
        if (actionType === 'settings') {
            // `type` is optional on a view entry until the grid-like default
            // pass fills it in, so the predicate must tolerate its absence.
            const matchedView = views.find((v: { id: string; type?: string }) => v.type === viewType);
            if (matchedView) handleViewChange(matchedView.id);
            setViewConfigPanelMode('edit');
            setShowViewConfigPanel(true);
        }
    }, [views, handleViewChange]);

    // ─── ViewTabBar CRUD callbacks (Phase 2) ────────────────────────────
    /** Returns true if the view is backed by a sys_view record (mutable). */
    const isSavedView = useCallback((vid: string) => {
        return isSavedViewId(savedViews, vid);
    }, [savedViews]);

    const handleRenameView = useCallback(async (vid: string, newName: string) => {
        if (!isSavedView(vid)) {
            toast.error(t('console.objectView.cannotEditMetaView'));
            return;
        }
        try {
            // Metadata overlay path — `vid` is the view's `name` field.
            if (typeof (dataSource as any)?.updateView === 'function') {
                await (dataSource as any).updateView(objectName, vid, { label: newName });
            }
            setRefreshKey(k => k + 1);
        } catch (err) {
            console.error('[ViewTabBar] Failed to rename view:', err);
            toast.error(t('objectViewActions.renameFailed'));
        }
    }, [dataSource, objectName, isSavedView, t]);

    const handleDeleteView = useCallback(async (vid: string) => {
        if (!dataSource) return;
        if (!isSavedView(vid)) {
            toast.error(t('console.objectView.cannotDeleteMetaView'));
            return;
        }
        const targetView = views.find((v: any) => v.id === vid);
        const viewLabel = targetView?.label || vid;
        const confirmed = await confirmHandler(
            t('console.objectView.deleteViewConfirm', { name: viewLabel }),
            {
                title: t('console.objectView.deleteViewTitle'),
                confirmText: t('console.objectView.delete'),
                cancelText: t('console.objectView.cancel'),
            },
        );
        if (!confirmed) return;
        try {
            if (typeof (dataSource as any)?.deleteView === 'function') {
                await (dataSource as any).deleteView(objectName, vid);
            }
            // If we deleted the active view, fall back to the first remaining view.
            if (vid === activeViewId) {
                const fallback = views.find((v: any) => v.id !== vid);
                if (fallback) navigate(viewId ? `../${fallback.id}` : `view/${fallback.id}`, viewId ? { relative: 'path' } : undefined);
            }
            setRefreshKey(k => k + 1);
        } catch (err) {
            console.error('[ViewTabBar] Failed to delete view:', err);
            toast.error(t('objectViewActions.deleteFailed'));
        }
    }, [dataSource, isSavedView, activeViewId, views, viewId, navigate, t, confirmHandler]);

    const handlePinView = useCallback(async (vid: string, pinned: boolean) => {
        if (!dataSource) return;
        if (!isSavedView(vid)) {
            toast.error(t('console.objectView.cannotEditMetaView'));
            return;
        }
        try {
            if (typeof (dataSource as any)?.updateView === 'function') {
                await (dataSource as any).updateView(objectName, vid, { isPinned: pinned });
            }
            setRefreshKey(k => k + 1);
        } catch (err) {
            console.error('[ViewTabBar] Failed to pin view:', err);
        }
    }, [dataSource, objectName, isSavedView, t]);

    const handleSetDefaultView = useCallback(async (vid: string) => {
        // `objectName` is narrowed here for the same reason the override effect
        // above narrows it: the adapter keys its cache invalidation on a real
        // object name, so passing `undefined` through would write to the server
        // and then fail to invalidate what it just changed.
        if (!dataSource || !objectName) return;
        if (!isSavedView(vid)) {
            toast.error(t('console.objectView.cannotEditMetaView'));
            return;
        }
        try {
            // Clear `isDefault` on all other saved views, then set this one.
            if (typeof (dataSource as any)?.updateView !== 'function') return;
            await Promise.all(
                dispatchViewPatches(
                    dataSource,
                    objectName,
                    setDefaultViewPatches(savedViews, vid),
                ),
            );
            setRefreshKey(k => k + 1);
        } catch (err) {
            console.error('[ViewTabBar] Failed to set default view:', err);
            toast.error('Failed to set default view');
        }
    }, [dataSource, objectName, savedViews, isSavedView, t]);

    const handleReorderViews = useCallback(async (orderedIds: string[]) => {
        // Persist order for ALL views (incl. metadata) in localStorage so the
        // UI immediately reflects the new ordering, including reorderings
        // that involve metadata-only views.
        try {
            if (typeof window !== 'undefined') {
                window.localStorage?.setItem(`viewOrder:${objectName}`, JSON.stringify(orderedIds));
            }
        } catch { /* ignore */ }
        // Best-effort: also persist `sortOrder` on each saved view so other
        // sessions / users can pick up the order from the backend.
        // The localStorage write above is deliberately outside this guard — the
        // UI ordering must survive even when there is no adapter half to persist.
        if (objectName && typeof (dataSource as any)?.updateView === 'function') {
            const updates = dispatchViewPatches(
                dataSource,
                objectName,
                reorderViewPatches(savedViews, orderedIds),
            );
            try {
                await Promise.all(updates);
            } catch (err) {
                console.error('[ViewTabBar] Failed to reorder views:', err);
            }
        }
        setRefreshKey(k => k + 1);
    }, [dataSource, savedViews, objectName]);

    const handleConfigView = useCallback((vid: string) => {
        // System (metadata-defined) views are read-only — opening the
        // ViewConfigPanel against one would let the user save changes that
        // never persist.
        if (!isSavedView(vid)) {
            toast.error(t('console.objectView.cannotEditMetaView'));
            return;
        }
        if (vid !== activeViewId) handleViewChange(vid);
        setViewConfigPanelMode('edit');
        setShowViewConfigPanel(true);
    }, [activeViewId, handleViewChange, isSavedView, t]);

    const handleAddView = useCallback(() => {
        setShowCreateViewDialog(true);
    }, []);

    // Current user — also used below for `{current_user_id}` filter-token
    // substitution. The schema-action handlers (toast/navigate/api/flow/server)
    // now live in the shared `useConsoleActionRuntime` hook (declared earlier).
    const currentUser = user
        ? { id: user.id, name: user.name, avatar: user.image }
        : FALLBACK_USER;

    // Session scope for filter placeholders. Memoised so the resolved filter
    // identity is stable across renders — it feeds view schemas below.
    const filterScope = useMemo<FilterTokenScope>(
        () => ({ currentUserId: currentUser.id, currentOrgId: activeOrganization?.id ?? null }),
        [currentUser.id, activeOrganization?.id],
    );

    // Action system for toolbar operations — refreshKey moved up (declared earlier).
    // Wired to confirmHandler/toastHandler so deletes use the Shadcn AlertDialog
    // and Sonner toast instead of native window.confirm.
    const actions = useObjectActions({
        objectName: objectDef.name,
        objectLabel: objectDef.label,
        dataSource,
        onEdit,
        onRefresh: () => setRefreshKey(k => k + 1),
        onConfirm: confirmHandler,
        // ToastHandler's `type` is a string-literal union — a subset of the
        // looser `{ type?: string }` useObjectActions declares; cast is sound.
        onToast: toastHandler as (message: string, options?: { type?: string }) => void,
    });

    // Real-time: auto-refresh when server reports data changes
    const { lastMessage: realtimeMessage } = useRealtimeSubscription({
        channel: `object:${objectDef.name}`,
    });

    // Conflict resolution: detect and queue conflicts on reconnection
    const conflictUserId = objectDef.name ? `user-${objectDef.name}` : 'current-user';
    const { hasConflicts, resolveAllConflicts } = useConflictResolution(conflictUserId);

    useEffect(() => {
        if (realtimeMessage) {
            // On reconnection data change, auto-resolve with server-wins strategy
            if (hasConflicts) {
                resolveAllConflicts('remote');
            }
            setRefreshKey(k => k + 1);
        }
    }, [realtimeMessage, hasConflicts, resolveAllConflicts]);
    
    // Fetch record count for footer display.
    //
    // `$top: 0` IS the request: give me the total, send no rows. It was written
    // `limit: 0`, which is not a `QueryParams` key — `convertQueryParams` copies
    // exactly the `$`-prefixed keys the type declares — so the cap reached no
    // branch and was dropped, and the platform's GET list route has no default
    // page size. The effect therefore did the opposite of what it says: it
    // downloaded EVERY row of the object, on every mount and every refresh of
    // every list view, to read one integer off the envelope. The dead spelling
    // type-checked because `QueryParams` carries `[key: string]: any` for
    // adapter-specific params; `object-ui/no-unprefixed-query-params` rejects it
    // at write time now (objectui#5458).
    //
    // `total` is the only field that can still answer the question, so the
    // row-counting fallbacks are gone rather than repointed. Once we ask for
    // zero rows an empty `data` means "you asked for none", not "the object is
    // empty" — counting the response would report a confident `0` for any
    // adapter that does not send a total. Leaving `recordCount` `undefined`
    // omits the footer line instead of asserting a wrong number; the render is
    // already guarded by `typeof recordCount === 'number'`.
    useEffect(() => {
        if (dataSource?.find && objectDef.name) {
            dataSource.find(objectDef.name, { $top: 0 }).then((result: any) => {
                if (typeof result?.total === 'number') {
                    setRecordCount(result.total);
                }
            }).catch(() => {
                // Silently ignore — record count is non-critical
            });
        }
    }, [dataSource, objectDef.name, refreshKey]);

    // Navigation overlay for record detail (supports drawer/modal/split/popover via config)
    // Priority: activeView.navigation > objectDef.navigation > default drawer.
    //
    // Default mode = 'drawer'. Mirrors Linear / Notion / Airtable / Jira where
    // record peek is the primary interaction and full-page is the upgrade.
    // Direct URL access (`/record/:id`) still opens as a full page because
    // RecordDetailView owns its own route — only same-page click navigation
    // is drawer-by-default. Per-view config can still override (e.g. a heavy
    // detail object can set `navigation.mode = 'page'`).
    const detailNavigation: ViewNavigationConfig = useMemo(
        () => {
            const authored = activeView?.navigation ?? objectDef.navigation;
            if (authored) {
                // Authored config wins. For an overlay, resolve the `size`
                // bucket (or 'auto') to a viewport-clamped width when no explicit
                // width was given — #2578: a pixel width can't be authored blind.
                if (authored.mode === 'page') return authored;
                return {
                    ...authored,
                    width: authored.width ?? overlayWidthFor(
                        (authored as { size?: 'auto' | 'sm' | 'md' | 'lg' | 'xl' | 'full' }).size,
                        objectDef,
                    ),
                };
            }
            // #2578: derive surface + width from FIELD COUNT. Field-heavy → full
            // page (cramped in a drawer); light → a drawer sized to the content
            // and clamped to the viewport. Mobile always pages (in deriveRecordSurface).
            return deriveRecordSurface(objectDef) === 'page'
                ? { mode: 'page' }
                : { mode: 'drawer', width: overlayWidthFor('auto', objectDef) };
        },
        [activeView?.navigation, objectDef]
    );
    const drawerRecordId = searchParams.get(RECORD_DRAWER_PARAM);

    /**
     * URL-derived equality filters in the form `?filter[<field>]=<value>`.
     * Used by related-list "View All" buttons to scope the destination list
     * to a single parent record. Emitted as ObjectQL triples (`[field, '=', value]`)
     * which matches the shape consumed by the list view's data fetcher when
     * merging base filters.
     */
    // Dep on the serialized `filter[...]` entries only — `uf_*` user-filter
    // params also live in the URL and must not invalidate this memo (a new
    // array identity here rebuilds the whole list schema and refetches).
    const filterParamsKey = Array.from(searchParams.entries())
        .filter(([k]) => k.startsWith('filter['))
        .map(([k, v]) => `${k}=${v}`)
        .join('&');
    const urlFilters = useMemo(() => {
        const out: Array<[string, string, any]> = [];
        new URLSearchParams(filterParamsKey).forEach((value, key) => {
            const m = /^filter\[(.+)\]$/.exec(key);
            if (m && m[1] && value !== '') {
                out.push([m[1], '=', value]);
            }
        });
        return out;
    }, [filterParamsKey]);

    /**
     * End-user filter selections restored from `uf_*` URL params (ADR-0047
     * persistence). Captured once per ObjectView mount — UserFilters only
     * reads them at its own mount, and later URL writes must not churn the
     * schema memo.
     */
    const [initialUfSelections] = useState<Record<string, string[]> | undefined>(
        () => parseUserFilterParams(new URLSearchParams(window.location.search)),
    );
    const handleUserFilterSelectionsChange = useCallback(
        (selections: Record<string, Array<string | number | boolean>>) => {
            setSearchParams(prev => applyUserFilterParams(prev, selections), { replace: true });
        },
        [setSearchParams],
    );
    // Memoize onNavigate to prevent stale closure in useNavigationOverlay's handleClick
    const handleNavOverlayNavigate = useCallback(
        (recordId: string | number, action?: string) => {
            if (action === 'new_window') {
                // Open record detail in a new browser tab with Console-correct URL.
                // Same builder the list's link column publishes as its href
                // (objectui#4490) — one record-route shape for this surface.
                window.open(listRecordDetailUrl(window.location.pathname, recordId), '_blank');
                return;
            }
            // Default: navigate to record detail page.
            // `action` may be 'view' / 'page' / undefined, OR a custom view name
            // forwarded from `navigation.view` (e.g. 'detail_form'). The view
            // variant is resolved by RecordDetailView from its own config, so
            // any non-`new_window` action lands on the record detail route.
            const originState = {
              from: {
                pathname: location.pathname + (location.search || ''),
                label: viewLabel(objectDef.name, activeView?.name ?? '', activeView?.label ?? '') || objectLabel(objectDef),
              },
            };
            if (viewId) {
                navigate(`../../record/${encodeURIComponent(String(recordId))}`, { relative: 'path', state: originState });
            } else {
                navigate(`record/${encodeURIComponent(String(recordId))}`, { state: originState });
            }
        },
        [navigate, viewId, location.pathname, location.search, objectDef, activeView?.name, activeView?.label, viewLabel, objectLabel]
    );
    /**
     * The list surface's half of the record-link mechanism (objectui#4490):
     * publish this page's record-URL builder so the grid's `link: true` column
     * can render a real anchor instead of a click-only `span role="link"`.
     * See {@link listRecordActionsValue} for what this does and does NOT claim.
     *
     * The record drawer/overlay below mounts `RecordDetailView`, which brings
     * its own `RelatedRecordActionsBridge` around the whole detail body — that
     * nearer provider keeps owning the detail surface, exactly as before.
     */
    const listRecordActions = useMemo(
        () => listRecordActionsValue(objectDef.name, handleNavOverlayNavigate),
        [objectDef.name, handleNavOverlayNavigate],
    );
    const navOverlay = useNavigationOverlay({
        navigation: detailNavigation,
        objectName: objectDef.name,
        onNavigate: handleNavOverlayNavigate,
    });
    const handleDrawerClose = () => {
        navOverlay.close();
        const newParams = new URLSearchParams(searchParams);
        newParams.delete(RECORD_DRAWER_PARAM);
        setSearchParams(newParams);
    };
    /**
     * Row-click handler used by all list/grid/gallery/kanban surfaces inside
     * this object view. Wraps `navOverlay.handleClick` so that drawer-mode
     * opens are URL-driven (writes `?recordId=…`) — making the drawer state
     * shareable, refresh-safe, and respected by browser back/forward. The
     * URL→state sync effect below handles actually opening the drawer.
     */
    const handleRowClick = useCallback(
        (record: any, event?: React.MouseEvent | { metaKey?: boolean; ctrlKey?: boolean; button?: number }) => {
            // Cmd/Ctrl/middle-click — let the hook open in a new tab (full page)
            // regardless of configured mode. Matches browser link convention.
            const isModifier = !!(
                event && ((event as any).metaKey || (event as any).ctrlKey || (event as any).button === 1)
            );
            if (isModifier) {
                navOverlay.handleClick(record, event as any);
                return;
            }
            // Drawer mode → URL is the source of truth. Push `?recordId=…`
            // and let the existing URL-sync effect open the overlay.
            if (navOverlay.mode === 'drawer') {
                const id = (record?.id ?? record?._id) as string | number | undefined;
                if (id != null) {
                    const next = new URLSearchParams(searchParams);
                    next.set(RECORD_DRAWER_PARAM, String(id));
                    setSearchParams(next);
                    return;
                }
            }
            // All other modes (page / modal / split / popover / new_window / none)
            // — delegate to the hook.
            navOverlay.handleClick(record, event as any);
        },
        [navOverlay, searchParams, setSearchParams]
    );
    /**
     * "Expand to full page" — invoked from the drawer header chevron. Closes
     * the drawer (which clears `?recordId=…`) and router-pushes to the
     * dedicated `/record/:id` route. Mirrors Linear/Notion peek-to-page.
     */
    const handleExpandDrawer = useCallback(() => {
        const rec = navOverlay.selectedRecord as Record<string, unknown> | null;
        const id = rec && ((rec as any).id ?? (rec as any)._id);
        if (id == null) return;
        handleDrawerClose();
        handleNavOverlayNavigate(id as string | number);
    }, [navOverlay.selectedRecord, handleNavOverlayNavigate]);
    // Sync URL-based recordId to overlay state
    useEffect(() => {
        if (drawerRecordId && !navOverlay.isOpen) {
            navOverlay.open({ id: drawerRecordId });
        } else if (!drawerRecordId && navOverlay.isOpen) {
            navOverlay.close();
        }
    }, [drawerRecordId]);

    // Render multi-view content via ListView plugin (for kanban, calendar, etc.)
    const renderListView = useCallback(({ schema: listSchema, dataSource: ds, onEdit: editHandler, className, refreshKey: pluginRefreshKey }: any) => {
        // Combine local refreshKey with the plugin ObjectView's refreshKey for full propagation
        const combinedRefreshKey = refreshKey + (pluginRefreshKey || 0);
        const key = `${objectName}-${activeView.id}-${combinedRefreshKey}`;
        const viewDef = activeView;

        // Per-user, per-view runtime-filter cache (advanced filter + search).
        // Restored into ListView at mount so leaving via a nav link and coming
        // back keeps what the user was filtering — URL params alone don't
        // survive that (the nav link has no query string). Keyed on the signed-in
        // user so two accounts on one browser never share filter values.
        const listFilterKey = buildListFilterKey(user?.id, objectName, activeView.id);
        const storedListFilters = readListFilterState(listFilterKey);

        // Warn in dev mode if flat properties are used instead of nested spec format
        if (process.env.NODE_ENV === 'development') {
            const flatKeys = ['startDateField', 'endDateField', 'dateField', 'groupBy', 'groupField',
                'locationField', 'imageField', 'chartType', 'xAxisField', 'dependenciesField',
                'progressField', 'colorField', 'allDayField', 'subjectField', 'endField',
                'latitudeField', 'longitudeField', 'zoom', 'center', 'cardFields', 'subtitleField',
                'descriptionField', 'yAxisFields', 'aggregation', 'series'];
            const nestedConfig = (viewDef as any)[viewDef.type] || {};
            const found = flatKeys.filter(k => k in viewDef && !(k in nestedConfig));
            if (found.length > 0) {
                console.warn(
                    `[Spec Compliance] View "${viewDef.id}" uses flat properties ${JSON.stringify(found)}. ` +
                    `Move them under viewDef.${viewDef.type || '<type>'} per @objectstack/spec protocol.`
                );
            }
        }

        if (viewDef.type === 'chart') {
            const chartConfig = viewDef.chart || {};
            // ADR-0021 (#1890): dataset-bound chart — the single author-facing
            // shape. Selects dimensions/measures BY NAME and runs through the
            // governed queryDataset path (numbers consistent across surfaces).
            if (chartConfig.dataset) {
                const dims: string[] = Array.isArray(chartConfig.dimensions) ? chartConfig.dimensions : [];
                const vals: string[] = Array.isArray(chartConfig.values) ? chartConfig.values : [];
                return (
                    <Suspense key={key} fallback={<div className="p-4 text-sm text-muted-foreground">Loading chart…</div>}>
                        <ObjectChart
                            dataSource={ds}
                            schema={{
                                type: 'object-chart',
                                dataset: chartConfig.dataset,
                                dimensions: dims,
                                values: vals,
                                chartType: chartConfig.chartType || 'bar',
                                xAxisKey: dims[0],
                                series: vals.map((v: string) => ({ dataKey: v, label: v })),
                                config: chartConfig.config,
                                className: 'h-[400px] w-full',
                            } as any}
                        />
                    </Suspense>
                );
            }
            // ObjectChart consumes a structured `aggregate` ({ field, function,
            // groupBy }) + `xAxisKey` + `series`, NOT the flat spec-level
            // `xAxisField`/`yAxisFields`/`aggregation` keys. Translate here so the
            // chart actually runs its aggregate query (otherwise it renders empty).
            const categoryField = chartConfig.xAxisField || 'name';
            const valueField =
                (Array.isArray(chartConfig.yAxisFields) && chartConfig.yAxisFields[0]) || 'value';
            const aggFn = chartConfig.aggregation || 'count';
            const series =
                chartConfig.series && chartConfig.series.length > 0
                    ? chartConfig.series
                    : [{ dataKey: valueField, label: valueField }];
            return (
                <Suspense key={key} fallback={<div className="p-4 text-sm text-muted-foreground">Loading chart…</div>}>
                    <ObjectChart
                        dataSource={ds}
                        schema={{
                            type: 'object-chart',
                            objectName: objectDef.name,
                            chartType: chartConfig.chartType || 'bar',
                            aggregate: {
                                field: valueField,
                                function: aggFn,
                                groupBy: categoryField,
                            },
                            xAxisKey: categoryField,
                            series,
                            config: chartConfig.config,
                            filter: chartConfig.filter,
                            className: 'h-[400px] w-full',
                        } as any}
                    />
                </Suspense>
            );
        }

        // ADR-0053 wrong-context authoring: userFilters/quickFilters on an
        // object list view are suppressed below — say so instead of letting
        // the author stare at a toolbar with nothing where their filter
        // controls should be (#2219).
        warnSuppressedListNav(objectDef.name, viewDef.id || viewDef.name || '', viewDef as any, listSchema as any);

        // objectui#7029: present only when the view actually declared one.
        const calendarOptions = calendarViewOptions(viewDef);

        const fullSchema: ListViewSchema = {
            ...listSchema,
            // The active view's display label (same string the ViewTabBar
            // shows) — ListView appends it to export download filenames.
            label: viewDef.label ?? listSchema.label,
            /**
             * The active view's own description — the sentence the author wrote
             * to caveat THIS view (scope, staleness, "this lens is for
             * browsing, the dashboard is authoritative"), which is exactly the
             * text a per-view description is wanted for (objectui#7199).
             *
             * It was the one key of this relay's set with no rung, so
             * `schema.description` at the `ListView` end could only ever be the
             * object-level list's description and a per-view one was
             * unreachable — authored, validated, built and served, then
             * silently dropped here. Nothing errored: the value simply never
             * arrived, and the only symptom was a sentence missing from the
             * screen.
             *
             * ⚠️ NOT the object's own `objectDef.description`, which this page
             * renders as the `PageHeader` subtitle further down. Crossing the
             * two would put a view's caveat where the object's blurb belongs.
             * Same two-rung shape as `label` above.
             */
            description: viewDef.description ?? listSchema.description,
            // Propagate appearance/view-config properties for live preview
            rowHeight: viewDef.rowHeight ?? listSchema.rowHeight,
            densityMode: viewDef.densityMode ?? listSchema.densityMode,
            // Hydrate the persisted view settings so they survive reload
            // (Airtable-style toolbar config — objectstack#7494's ruling:
            // ORG-WIDE shared, not a per-user preference; a true per-user
            // scope is a parked v18 direction, not something to fake
            // client-side). All four below go through the same
            // persistViewPatch helper which debounces and batches concurrent
            // toggles.
            sort: (viewDef as any).sort ?? listSchema.sort,
            // The ONE place this view's effective filter is computed (#2890).
            // It used to be computed twice — once here as `filter` for the child
            // views, once further down as `filters` for ListView — with the two
            // copies subtly different (only this one fell back to
            // `listSchema.filter`; only that one ran token substitution over the
            // URL filters). Now: base ?? listSchema, concatenated with the URL
            // filters, and substituted as a whole.
            filter: (() => {
                const base = (viewDef as any).filter ?? listSchema.filter;
                const baseArr = Array.isArray(base) ? base : base ? [base] : [];
                const combined = urlFilters.length ? [...baseArr, ...urlFilters] : base;
                return substituteFilterTokens(combined, filterScope);
            })(),
            hiddenFields: (viewDef as any).hiddenFields ?? listSchema.hiddenFields,
            columnState: (viewDef as any).columnState ?? (listSchema as any).columnState,
            onDensityChange: (mode) => {
                // Persist the spec-canonical `rowHeight` (#2890). Writing the
                // legacy `densityMode` here is what kept re-seeding it into
                // stored view metadata after every toolbar toggle.
                persistViewPatch(viewDef.id, viewDef, {
                    rowHeight: DENSITY_MODE_TO_ROW_HEIGHT[mode],
                });
            },
            onSortChange: (sort: any) => {
                persistViewPatch(viewDef.id, viewDef, { sort });
            },
            // NO `onFilterChange` (objectui#4155): the filter panel is session
            // state. ListView keeps it in `currentFilters` and applies it to the
            // live query; nothing about it reaches the stored view.
            onHiddenFieldsChange: (hidden: string[]) => {
                persistViewPatch(viewDef.id, viewDef, { hiddenFields: hidden });
            },
            onColumnStateChange: (state: { order?: string[]; widths?: Record<string, number> }) => {
                persistViewPatch(viewDef.id, viewDef, { columnState: state });
            },
            inlineEdit: viewDef.inlineEdit ?? viewDef.editRecordsInline ?? listSchema.inlineEdit,
            // ADR-0047 — spec `appearance` (incl. allowedVisualizations, the
            // runtime visualization whitelist) flows from the view metadata;
            // the legacy bare `showDescription` flag is folded in on top.
            appearance: viewDef.appearance
                ? (viewDef.showDescription != null
                    ? { ...viewDef.appearance, showDescription: viewDef.showDescription }
                    : viewDef.appearance)
                : (viewDef.showDescription != null
                    ? { showDescription: viewDef.showDescription }
                    : listSchema.appearance),
            // Offer the visualization switcher only when the author
            // whitelisted more than one type; ListView intersects the
            // whitelist with capability-resolvable types.
            showViewSwitcher:
                ((viewDef.appearance ?? listSchema.appearance)?.allowedVisualizations?.length ?? 0) > 1,
            // Toolbar policy — one vocabulary (#2890). Stored views may still
            // carry the legacy bare `show*` flags, so each side is run through
            // `normalizeListViewSchema` (the single fold) and merged, view over
            // list. This relay never names a legacy key itself.
            userActions: {
                ...(normalizeListViewSchema(listSchema ?? {}) as { userActions?: object }).userActions,
                ...(normalizeListViewSchema(viewDef ?? {}) as { userActions?: object }).userActions,
            },
            allowExport: viewDef.allowExport ?? listSchema.allowExport,
            exportOptions: viewDef.allowExport === false ? undefined : (viewDef.exportOptions ?? listSchema.exportOptions),
            color: viewDef.color ?? listSchema.color,
            // Propagate view-config properties (Bug 4 / items 14-22)
            wrapHeaders: viewDef.wrapHeaders ?? listSchema.wrapHeaders,
            clickIntoRecordDetails: viewDef.clickIntoRecordDetails ?? listSchema.clickIntoRecordDetails,
            addRecordViaForm: viewDef.addRecordViaForm ?? listSchema.addRecordViaForm,
            addDeleteRecordsInline: viewDef.addDeleteRecordsInline ?? listSchema.addDeleteRecordsInline,
            collapseAllByDefault: viewDef.collapseAllByDefault ?? listSchema.collapseAllByDefault,
            fieldTextColor: viewDef.fieldTextColor ?? listSchema.fieldTextColor,
            prefixField: viewDef.prefixField ?? listSchema.prefixField,
            // ViewData source override (spec `data` key): a view authored with
            // `data: {provider:'api', read, write}` must survive this explicit
            // picklist, or ObjectGantt falls back to provider:'object'.
            data: (viewDef as any).data ?? (listSchema as any).data,
            // Propagate new spec properties (P0/P1/P2)
            navigation: viewDef.navigation ?? listSchema.navigation,
            selection: viewDef.selection ?? listSchema.selection,
            pagination: viewDef.pagination ?? listSchema.pagination,
            searchableFields: viewDef.searchableFields ?? listSchema.searchableFields,
            filterableFields: viewDef.filterableFields ?? listSchema.filterableFields,
            resizable: viewDef.resizable ?? listSchema.resizable,
            rowActions: viewDef.rowActions ?? listSchema.rowActions,
            /**
             * Row-context action definitions derived from `objectDef.actions`
             * filtered by `locations.includes('list_item')`. These are full
             * `ActionDef` records (with label/icon/variant/params/recordIdParam
             * /bodyShape) the row menu renders with i18n-correct labels and
             * dispatches via the action runner; legacy `rowActions: string[]`
             * remains for back-compat where the action lives elsewhere.
             */
            rowActionDefs: (Array.isArray((objectDef as any)?.actions)
                ? (objectDef as any).actions
                    .filter((a: any) =>
                      Array.isArray(a?.locations) && a.locations.includes('list_item'))
                    // Localize label / confirm / success the same way the
                    // record_header and list_toolbar paths do — through the ONE
                    // shared resolver (objectui#4265), so this surface cannot
                    // drift back to a label-only resolution. The `visible` CEL
                    // is forwarded untouched (spread inside the localizer) and
                    // evaluated per-row at render time inside RowActionMenu.
                    .map((a: any) => localizeActionTexts(objectDef.name, a))
                : []),
            /**
             * Selection-bar actions. Unlike `rowActionDefs` above, these are
             * NOT resolved here: `ObjectGrid` is the single convergence point
             * of all three list callers (this view, plugin-view's ObjectView
             * and plugin-list's ListView), so it resolves each `bulkActions`
             * name against `objectDef.actions` and promotes it into the def
             * list itself (`resolveBulkActions`, objectui#3002). What we pass
             * through is the view author's own declaration.
             */
            bulkActions: viewDef.bulkActions ?? listSchema.bulkActions,
            bulkActionDefs: (viewDef as any).bulkActionDefs ?? (listSchema as any).bulkActionDefs,
            sharing: viewDef.sharing ?? listSchema.sharing,
            addRecord: viewDef.addRecord ?? listSchema.addRecord,
            conditionalFormatting: viewDef.conditionalFormatting ?? listSchema.conditionalFormatting,
            // ADR-0047 (amended, objectui #2338): this is the object default
            // list = "views" mode. `dropdown` (value-chip) userFilters ARE
            // allowed here — they're the Airtable quick-filter pills. Only the
            // `tabs` preset style stays page-only (it would collide with the
            // ViewTabBar above, which owns the tab-bar role — use `listViews`
            // for named presets). `quickFilters` stays suppressed entirely.
            quickFilters: undefined,
            userFilters: (() => {
                const uf = (viewDef.userFilters ?? listSchema.userFilters) as
                    | { element?: string; tabs?: unknown }
                    | undefined;
                return uf && uf.element !== 'tabs' && uf.tabs == null ? uf : undefined;
            })(),
            showRecordCount: viewDef.showRecordCount ?? listSchema.showRecordCount,
            allowPrinting: viewDef.allowPrinting ?? listSchema.allowPrinting,
            emptyState:
                viewEmptyState(
                    objectDef.name,
                    viewDef.name || viewDef.id || '',
                    viewDef.emptyState
                        ?? listSchema.emptyState
                        ?? resolveManagedByEmptyState((objectDef as any)?.managedBy, t, objectDef.name, (objectDef as any)?.userActions),
                ),
            aria: viewDef.aria ?? listSchema.aria,
            // (the legacy `filters` twin of the `filter` above lived here until
            // #2890 — see the note at its single remaining computation)
            ...(viewDef.sort?.length ? { sort: viewDef.sort } : {}),
            options: {
                kanban: {
                    // ADR-0085: when the view doesn't pick a lane field, the
                    // object's declared lifecycle (`stageField`) decides —
                    // including the strict `stageField: false` suppression
                    // (no default lanes; the status-shaped field is declared
                    // non-linear) and the shared name/type heuristic, which
                    // never invents a field the object doesn't have (the old
                    // hard-coded 'status' did).
                    ...(() => {
                        const lane =
                            viewDef.kanban?.groupByField ||
                            viewDef.kanban?.groupField ||
                            detectStatusField(objectDef as any) ||
                            undefined;
                        return lane ? { groupBy: lane, groupField: lane } : {};
                    })(),
                    titleField: viewDef.kanban?.titleField || 'name',
                    cardFields: viewDef.kanban?.columns,
                },
                // The calendar config the view DECLARED, or no calendar key at
                // all — never an invented field name (objectui#7029). With the
                // key absent, ListView's capability gate stops offering the
                // Calendar toggle for a view that configured none, and a view
                // forced onto the calendar renderer reaches its refusal screen.
                ...(calendarOptions ? { calendar: calendarOptions } : {}),
                // The date axis is resolved once, in ListView — this face only
                // forwards what the view declared, floored at 'name'
                // (objectui#3129, objectui#6557). See `timelineViewOptions`.
                timeline: timelineViewOptions(viewDef),
                map: {
                    locationField: viewDef.map?.locationField,
                    titleField: viewDef.map?.titleField || 'name',
                    latitudeField: viewDef.map?.latitudeField,
                    longitudeField: viewDef.map?.longitudeField,
                    zoom: viewDef.map?.zoom,
                    center: viewDef.map?.center,
                },
                gallery: {
                    // Spread the full view-defined gallery first so spec
                    // fields (cardSize, visibleFields, coverField, coverFit)
                    // make it through; then layer legacy field aliases that
                    // ObjectGallery still consults.
                    ...(viewDef.gallery || {}),
                    imageField: viewDef.gallery?.imageField || viewDef.gallery?.coverField || 'image',
                    coverField: viewDef.gallery?.coverField || viewDef.gallery?.imageField,
                    titleField: viewDef.gallery?.titleField || 'name',
                },
                // The gantt config the view DECLARED, title floored at 'name' —
                // never an invented date field (objectui#7070). With no date
                // binding to forward, ListView's capability gate stops offering
                // the Gantt toggle to a view that configured none, and a view
                // forced onto the gantt renderer reaches its refusal screen.
                // See `ganttViewOptions`.
                gantt: ganttViewOptions(viewDef),
                tree: {
                    // Self-referencing tree-grid config (plugin-tree). Spread the
                    // full view-defined tree first so parentField/fields/
                    // defaultExpandedDepth survive; labelField falls back to the
                    // view's own `tree.titleField`, then to 'name'. parentField
                    // auto-detects when omitted.
                    ...((viewDef as any).tree || {}),
                    labelField: (viewDef as any).tree?.labelField || (viewDef as any).tree?.titleField || 'name',
                },
                chart: {
                    chartType: viewDef.chart?.chartType,
                    xAxisField: viewDef.chart?.xAxisField,
                    yAxisFields: viewDef.chart?.yAxisFields,
                    aggregation: viewDef.chart?.aggregation,
                    series: viewDef.chart?.series,
                    config: viewDef.chart?.config,
                },
            },
        };

        return (
            <ListView
                key={key}
                schema={fullSchema}
                className={className}
                onEdit={editHandler}
                onDelete={(record: any) => {
                    if (record?.id != null) {
                        // useObjectActions.deleteRecord wraps execute() which
                        // already shows a confirmation dialog + success toast
                        // and triggers onRefresh on success.
                        // Pass the row so sys_permission_set package rows
                        // get the honest reset copy (ADR-0094).
                        actions.deleteRecord(String(record.id), record);
                    }
                }}
                onBulkDelete={(records: any[]) => {
                    const valid = records.filter((r: any) => r?.id != null);
                    if (valid.length === 0) return;
                    // Route through actions.execute so the shared AlertDialog
                    // confirms once for the whole batch and the existing
                    // delete handler (now batch-aware) handles refresh + toast.
                    actions.execute({
                        type: 'delete',
                        confirmText: t('console.objectView.bulkDeleteConfirm', {
                            count: valid.length,
                            defaultValue: `Delete ${valid.length} selected records? This cannot be undone.`,
                        }),
                        params: { records: valid },
                    });
                }}
                onRowClick={(record: any, event?: any) => {
                    handleRowClick(record, event);
                }}
                onSortChange={(sort: any) => {
                    persistViewPatch(viewDef.id, viewDef, { sort });
                }}
                onFilterChange={(filter: any) => {
                    // SESSION state only (objectui#4155) — localStorage keeps
                    // the BUILDER's group verbatim, read back into
                    // `initialFilters`, which needs `conditions` (and the row
                    // ids) to rehydrate the toolbar. This restore is per
                    // browser and the panel's own "Clear all" clears it: it
                    // writes an empty group through this same handler. Nothing
                    // here touches the view's stored body.
                    writeListFilterState(listFilterKey, { filters: filter });
                }}
                onSearchChange={(search: string) => {
                    writeListFilterState(listFilterKey, { search });
                }}
                onHiddenFieldsChange={(hidden: string[]) => {
                    persistViewPatch(viewDef.id, viewDef, { hiddenFields: hidden });
                }}
                onInlineEditChange={(next: boolean) => {
                    persistViewPatch(viewDef.id, viewDef, { inlineEdit: next });
                }}
                onColumnStateChange={(state: { order?: string[]; widths?: Record<string, number> }) => {
                    persistViewPatch(viewDef.id, viewDef, { columnState: state });
                }}
                userFilterSelections={initialUfSelections}
                onUserFilterSelectionsChange={handleUserFilterSelectionsChange}
                initialFilters={storedListFilters?.filters as any}
                initialSearchTerm={storedListFilters?.search}
                dataSource={ds}
            />
        );
    }, [activeView, objectDef, objectName, refreshKey, navOverlay, actions, persistViewPatch, urlFilters, initialUfSelections, handleUserFilterSelectionsChange, user?.id]);

    // Memoize the merged views array so PluginObjectView doesn't get a new
    // reference on every render (which would trigger unnecessary data refetches).
    const mergedViews = useMemo(() =>
        views.map((v: any) =>
            v.id === activeViewId && viewDraft && viewDraft.id === v.id
                ? { ...v, ...viewDraft }
                : v
        ),
        [views, activeViewId, viewDraft]
    );

    // Build the ObjectViewSchema for the plugin — reads from activeView (which merges draft)
    const objectViewSchema = useMemo(() => ({
        type: 'object-view' as const,
        objectName: objectDef.name,
        layout: 'page' as const,
        showSearch: activeView?.showSearch !== false,
        showFilters: activeView?.showFilters !== false,
        showSort: activeView?.showSort !== false,
        showCreate: false, // We render our own create button in the header
        allowCreateView: isAdmin,
        viewActions: isAdmin ? [
            { type: 'settings' as const },
            { type: 'share' as const },
            { type: 'delete' as const },
        ] : [],
        onNavigate: (recordId: string | number, mode: 'view' | 'edit') => {
            if (mode === 'edit') {
                onEdit?.({ id: recordId });
            } else if (mode === 'view') {
                const originState = {
                  from: {
                    pathname: location.pathname + (location.search || ''),
                    label: viewLabel(objectDef.name, activeView?.name ?? '', activeView?.label ?? '') || objectLabel(objectDef),
                  },
                };
                if (viewId) {
                    navigate(`../../record/${encodeURIComponent(String(recordId))}`, { relative: 'path', state: originState });
                } else {
                    navigate(`record/${encodeURIComponent(String(recordId))}`, { state: originState });
                }
            }
        },
    }), [objectDef, onEdit, activeView?.showSearch, activeView?.showFilters, activeView?.showSort, activeView?.name, activeView?.label, navigate, viewId, isAdmin, location.pathname, location.search, viewLabel, objectLabel]);

    return (
        <ActionProvider {...actionRuntime.actionProviderProps}>
        <RelatedRecordActionsProvider value={listRecordActions}>
        <div className="h-full flex flex-col bg-background min-w-0 overflow-hidden">
             {/* 1. Header with breadcrumb + description.
                 The managed-by badge sits inline with the title so the
                 lifecycle bucket (system / config / append-only /
                 better-auth) is communicated at a glance; the previous
                 full-width banner was deliberately removed because it
                 (a) leaked engine-internal terminology and (b) repeated
                 itself on list/detail/form for the same record.

                 Mobile: hide the entire PageHeader. The title is already
                 surfaced in the top bar (e.g. "线索"), so re-rendering
                 the icon-pill + title again wastes ~60px of viewport
                 chrome that real-app conventions (Gmail / Notion / Linear)
                 reclaim for content. The create / import / overflow
                 actions move to a floating action button (see below). */}
             <div className="hidden sm:block">
             <PageHeader
                 title={
                   <span className="inline-flex items-center gap-2">
                     <span className="truncate">{objectLabel(objectDef)}</span>
                     <ManagedByBadge managedBy={(objectDef as any)?.managedBy} />
                   </span>
                 }
                 subtitle={objectDef.description ? objectDesc(objectDef) : undefined}
                 icon={(() => { const I = getIcon((objectDef as any)?.icon); return <I className="h-4 w-4" />; })()}
                 actions={
                   <>
                    {/* Favorite toggle */}
                    {objectName && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleFavorite({
                          id: `object:${objectName}`,
                          label: objectLabel(objectDef),
                          href: `/apps/${appName}/${objectName}`,
                          type: 'object',
                        })}
                        className="h-8 sm:h-9 px-2"
                        aria-pressed={isFavorite(`object:${objectName}`)}
                        aria-label={isFavorite(`object:${objectName}`)
                          ? t('common.removeFromFavorites', { defaultValue: 'Remove from favorites' })
                          : t('common.addToFavorites', { defaultValue: 'Add to favorites' })}
                        data-testid={`object-favorite-btn-${objectName}`}
                      >
                        {isFavorite(`object:${objectName}`)
                          ? <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          : <StarOff className="h-4 w-4" />}
                      </Button>
                    )}

                    {/* Primary action.
                        [#5153] `objectCanCreate && createVisible` — the
                        object-level verdict, then the toolbar-scope
                        `visibleWhen` layer on top of it. Greyed, not gone, is
                        the `disabledWhen` case. Same pair drives the phone FAB
                        below, so the two render points cannot disagree. */}
                    {objectCanCreate && createVisible && (
                    <Button
                        size="sm"
                        onClick={actions.create}
                        disabled={createDisabled}
                        className="shadow-none gap-1.5 sm:gap-2 h-8 sm:h-9"
                        data-testid="object-view-new-button"
                    >
                        <Plus className="h-4 w-4" />
                        <span className="hidden sm:inline">{t('console.objectView.new')}</span>
                    </Button>
                    )}

                    {/* Data import — desktop only on phones. CSV imports
                        are inherently a desk/laptop workflow; the button
                        was eating header space on mobile next to the
                        primary "+" action. */}
                    {/* [#5142] `objectCanImport && importVisible` — the object-level
                        verdict, then the toolbar-scope `visibleWhen` layer on top of
                        it. Greyed, not gone, is the `disabledWhen` case below. */}
                    {(identityImportEnabled || (objectCanImport && importVisible)) && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowImport(true)}
                        disabled={importDisabled}
                        className="hidden sm:inline-flex shadow-none gap-1.5 sm:gap-2 h-8 sm:h-9"
                        title={t('console.objectView.importTitle')}
                        data-testid="object-view-import-button"
                    >
                        <Upload className="h-4 w-4" />
                        <span className="hidden sm:inline">{t('console.objectView.import')}</span>
                    </Button>
                    )}

                    {/* Schema-driven toolbar actions */}
                    {objectDef.actions?.some((a: any) => a.locations?.includes('list_toolbar')) && (
                      isEnvironmentList ? (
                        <EnvironmentListToolbar
                          actions={localizedToolbarActions}
                          entitlements={environmentEntitlements}
                          onUpgrade={actionRuntime.openEntitlementDialog}
                        />
                      ) : (
                      <SchemaRenderer schema={{
                        type: 'action:bar',
                        location: 'list_toolbar',
                        actions: toolbarActionsWithDeepLink,
                        size: 'sm',
                        variant: 'outline',
                        // On mobile, collapse all schema-driven toolbar actions
                        // into a single overflow menu so the icon-only New /
                        // Import buttons stay visible without pushing the page
                        // title off-screen.
                        mobileMaxVisible: 0,
                      }} />
                      )
                    )}

                    {/*
                       Design Tools dropdown removed — its items were redundant:
                       - "Edit view"  → use chevron menu's "Edit view config"
                       - "Add view"   → use the `+` button on the tab bar or the "Add new view" footer in Manage Views
                       - "Metadata inspector" → still toggleable via the `?__debug` URL flag (see useMetadataInspector)
                    */}
                   </>
                 }
             />
             </div>

             {/* Floating "+" action button — phone-only counterpart to the
                 PageHeader's primary create action we just hid. Positioned
                 above the bottom mobile-nav (h-12 + safe-area) so it
                 doesn't collide with it. Hidden on tablets/desktops
                 because the inline header button is already visible.

                 [#5153] Second render point of the SAME affordance, so it
                 consumes the SAME `objectCanCreate && createVisible` /
                 `createDisabled` pair as the header button — a phone user and a
                 desktop user must not get different verdicts for one
                 `userActions.create` declaration.

                 DISABLED, on a control with no greyed form of its own: this is
                 a bare `<button>`, not the design system's `Button`, so it
                 carries none of the latter's `disabled:` treatment. Rather than
                 collapse the three states to two (which would map
                 `disabledWhen` onto "hidden" and lose the distinction the spec
                 draws between hidden and greyed), it takes the native
                 `disabled` — which is what conveys the state to assistive tech
                 — plus the same `disabled:opacity-50
                 disabled:pointer-events-none` utilities `Button` itself uses,
                 so the visual affordance matches the header button's. */}
             {objectCanCreate && createVisible && (
               <button
                 type="button"
                 onClick={actions.create}
                 disabled={createDisabled}
                 className="sm:hidden fixed right-4 bottom-36 z-40 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform inline-flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none"
                 aria-label={t('console.objectView.new')}
                 data-testid="mobile-fab-create"
               >
                 <Plus className="h-5 w-5" />
               </button>
             )}

             {/* CSV Import wizard (lazy-loaded) — opened from the toolbar
                 button above. On completion we bump refreshKey to re-fetch
                 the list so newly-imported rows show up. */}
             {showImport && (
               <Suspense fallback={null}>
                 <ImportWizard
                   open={showImport}
                   onOpenChange={setShowImport}
                   objectName={objectDef.name}
                   objectLabel={objectLabel(objectDef)}
                   fields={identityImportEnabled
                     // Identity import has a curated target set — the generic
                     // writable-field filter below would drop phone_number
                     // (readonly for CRUD; identity writes go through
                     // better-auth, framework#2782).
                     ? identityImportFields(objectDef.fields)
                     // Writable fields as WRITE targets + storage-backed
                     // readonly/autonumber fields as MATCH-ONLY targets (so
                     // update/upsert can match on the record number, #020) —
                     // see importTargetFields for the full derivation.
                     : importTargetFields(objectDef.name, objectDef.fields, perms)}
                   dataSource={identityDataSource ?? dataSource}
                   {...(identityImportEnabled ? {
                     extraOptionsContent: (
                       <IdentityImportOptions
                         policy={identityPasswordPolicy}
                         onPolicyChange={setIdentityPasswordPolicy}
                       />
                     ),
                     renderResultExtra: (res: any) => (
                       <IdentityImportResultExtra serverResult={res?.serverResult} />
                     ),
                   } : {})}
                   onComplete={(result) => {
                     setRefreshKey(k => k + 1);
                     const ok = result.importedRows;
                     const skip = result.skippedRows;
                     if (skip > 0) {
                       toast.warning(t('console.objectView.importedWithSkipped', { ok, skipped: skip }));
                     } else if (ok > 0) {
                       toast.success(t('console.objectView.importedToast', { count: ok }));
                     }
                   }}
                 />
               </Suspense>
             )}

             {/* View Tabs — Airtable-style switcher with rename / delete /
                 duplicate / pin / set-default / drag-reorder. Built-in views
                 (sourced from objectDef.listViews) only support switching;
                 mutating callbacks short-circuit with a toast. */}
             {views.length >= 1 && (() => {
               const viewTabItems: ViewTabItem[] = views.map((view: any) => {
                 const saved = savedViews.find((sv: any) => viewRowId(sv) === view.id);
                 // System views (loaded from objectDef.listViews / metadata) are
                 // *read-only*. Only sys_view-backed records can be mutated by
                 // the user; admins must duplicate a system view to customize it.
                 const isSystem = !saved;
                 return {
                   id: view.id,
                   label: viewLabel(objectDef.name, view.name || view.id, view.label || view.name || view.id),
                   type: view.type,
                   hasActiveFilters: Array.isArray(view.filter) && view.filter.length > 0,
                   hasActiveSort: Array.isArray(view.sort) && view.sort.length > 0,
                   isDefault: !!(saved?.isDefault ?? view.isDefault),
                   isPinned: !!(saved?.isPinned ?? view.isPinned),
                   visibility: saved?.visibility ?? view.visibility,
                   readonly: isSystem,
                   readonlyReason: isSystem
                     ? t('console.objectView.systemViewReadonly')
                     : undefined,
                 } as ViewTabItem;
               });
               return (
               <>
               <div className="hidden sm:block border-b px-3 sm:px-4 bg-background overflow-x-auto shrink-0">
                 <ViewTabBar
                   views={viewTabItems}
                   activeViewId={activeViewId}
                   onViewChange={handleViewChange}
                   viewTypeIcons={VIEW_TYPE_ICONS}
                   config={{
                     reorderable: false,
                     showAddButton: isAdmin,
                     showPinnedSection: true,
                     showVisibilityGroups: true,
                   }}
                   onAddView={isAdmin ? handleAddView : undefined}
                   onRenameView={isAdmin ? handleRenameView : undefined}
                   onDeleteView={isAdmin ? handleDeleteView : undefined}
                   onPinView={isAdmin ? handlePinView : undefined}
                   onSetDefaultView={isAdmin ? handleSetDefaultView : undefined}
                   onConfigView={isAdmin ? handleConfigView : undefined}
                   onManageViews={isAdmin ? () => setManageViewsOpen(true) : undefined}
                 />
                 {isAdmin && (
                   <ManageViewsDialog
                     open={manageViewsOpen}
                     onOpenChange={setManageViewsOpen}
                     views={viewTabItems}
                     activeViewId={activeViewId}
                     viewTypeIcons={VIEW_TYPE_ICONS}
                     onRename={handleRenameView}
                     onDelete={handleDeleteView}
                     onSetDefault={handleSetDefaultView}
                     onSetPinned={handlePinView}
                     onReorder={handleReorderViews}
                     onAddView={handleAddView}
                     onConfigView={handleConfigView}
                   />
                 )}
               </div>
               {/* Mobile view switcher is rendered by AppHeader via
                   MobileViewSwitcherContext (registered above). */}
               </>
               );
             })()}

             {/* 2. Content — Plugin ObjectView with ViewSwitcher + Filter + Sort */}
             <div className="flex-1 overflow-hidden relative flex flex-row">
                {navOverlay.mode === 'split' && navOverlay.isOpen ? (
                    <NavigationOverlay
                        {...navOverlay}
                        setIsOpen={(open: boolean) => { if (!open) handleDrawerClose(); }}
                        title={objectLabel(objectDef)}
                        onExpand={handleExpandDrawer}
                        expandLabel={t('console.objectView.expandToPage', { defaultValue: 'Open as full page' })}
                        storageKey={`drawer-width:${objectDef.name}`}
                        mainContent={
                            <div className="flex-1 min-w-0 relative h-full flex flex-col">
                                <div className="flex-1 relative overflow-hidden">
                                    <div className="h-full overflow-auto">
                                        <PluginObjectView
                                            schema={objectViewSchema}
                                            dataSource={dataSource}
                                            views={mergedViews}
                                            activeViewId={activeViewId}
                                            onViewChange={handleViewChange}
                                            onEdit={(record: any) => onEdit?.(record)}
                                            onRowClick={(record: any, event?: any) => {
                                                handleRowClick(record, event);
                                            }}
                                            renderListView={renderListView}
                                            onCreateView={handleCreateView}
                                            hideNamedViewTabs
                                            onViewAction={handleViewAction}
                                        />
                                    </div>
                                </div>
                                {typeof recordCount === 'number' && (
                                    <div data-testid="record-count-footer" className="border-t px-3 sm:px-4 py-1.5 text-xs text-muted-foreground bg-muted/5 shrink-0">
                                        {t('console.objectView.recordCount', { count: recordCount })}
                                    </div>
                                )}
                            </div>
                        }
                    >
                        {(record: Record<string, unknown>) => {
                            const recordId = (record.id || record._id) as string;
                            return (
                                <RecordDetailView
                                    dataSource={dataSource}
                                    objects={objects}
                                    onEdit={onEdit}
                                    objectNameOverride={objectDef.name}
                                    recordIdOverride={recordId}
                                    embedded
                                />
                            );
                        }}
                    </NavigationOverlay>
                ) : (
                <div className="flex-1 min-w-0 relative h-full flex flex-col">
                    <div className="flex-1 relative overflow-hidden">
                        <div className="h-full overflow-auto">
                            <PluginObjectView
                                schema={objectViewSchema}
                                dataSource={dataSource}
                                views={mergedViews}
                                activeViewId={activeViewId}
                                onViewChange={handleViewChange}
                                onEdit={(record: any) => onEdit?.(record)}
                                onRowClick={(record: any, event?: any) => {
                                    handleRowClick(record, event);
                                }}
                                renderListView={renderListView}
                                onCreateView={handleCreateView}
                                hideNamedViewTabs
                                onViewAction={handleViewAction}
                            />
                        </div>
                    </div>
                    {/* Record count footer removed — ListView already renders record-count-bar */}
                </div>
                )}
                {/* Metadata panel only shows for admin users */}
                <MetadataPanel
                    open={showDebug && isAdmin}
                    sections={[
                        { title: 'View Configuration', data: activeView },
                        { title: 'Object Definition', data: objectDef },
                    ]}
                />
                {/* Inline View Config Panel — Airtable-style right sidebar with slide animation */}
                <div
                    data-testid="view-config-panel-wrapper"
                    className={`transition-[max-width,opacity] duration-300 ease-in-out overflow-hidden ${
                        showViewConfigPanel && isAdmin ? 'max-w-[280px] opacity-100' : 'max-w-0 opacity-0'
                    }`}
                >
                    <ViewConfigPanel
                        open={showViewConfigPanel && isAdmin}
                        onClose={() => { setShowViewConfigPanel(false); setViewConfigPanelMode('edit'); }}
                        mode={viewConfigPanelMode}
                        activeView={activeView}
                        objectDef={objectDef}
                        recordCount={recordCount}
                        onSave={handleViewConfigSave}
                        onViewUpdate={handleViewUpdate}
                        onCreate={handleViewCreate}
                        metadataClient={metadataClient}
                        dataSource={dataSource}
                        onAfterChange={() => setRefreshKey(k => k + 1)}
                    />
                </div>
                <CreateViewDialog
                    open={showCreateViewDialog && isAdmin}
                    onOpenChange={setShowCreateViewDialog}
                    existingLabels={views.map((v: any) => v.label).filter(Boolean)}
                    objectDef={objectDef}
                    onCreate={(cfg) => handleViewCreate(cfg)}
                />
             </div>

             {/* Record Detail Overlay — navigation mode driven by objectDef.navigation */}
             {navOverlay.mode !== 'split' && (
             <NavigationOverlay
                 {...navOverlay}
                 setIsOpen={(open: boolean) => { if (!open) handleDrawerClose(); }}
                 title={objectLabel(objectDef)}
                 onExpand={handleExpandDrawer}
                 expandLabel={t('console.objectView.expandToPage', { defaultValue: 'Open as full page' })}
                 storageKey={`drawer-width:${objectDef.name}`}
             >
                 {(record: Record<string, unknown>) => {
                     const recordId = (record.id || record._id) as string;
                     return (
                         <RecordDetailView
                             dataSource={dataSource}
                             objects={objects}
                             onEdit={onEdit}
                             objectNameOverride={objectDef.name}
                             recordIdOverride={recordId}
                             embedded
                         />
                     );
                 }}
             </NavigationOverlay>
             )}
        </div>
        {actionRuntime.dialogs}
        </RelatedRecordActionsProvider>
        </ActionProvider>
    );
}