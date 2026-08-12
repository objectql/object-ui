/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn, Button, Input, Popover, PopoverContent, PopoverTrigger, FilterBuilder, SortBuilder, NavigationOverlay, GroupingEditor, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, RefreshIndicator, DataEmptyState } from '@object-ui/components';
import type { SortItem } from '@object-ui/components';
import { Search, SlidersHorizontal, ArrowUpDown, X, EyeOff, Pencil, Group, Paintbrush, Ruler, Inbox, Download, AlignJustify, Rows4, Rows3, Rows2, Share2, Printer, Plus, Trash2, CheckSquare, AlertTriangle, ShieldAlert, RotateCw, Loader2, icons, type LucideIcon } from 'lucide-react';
import type { FilterGroup } from '@object-ui/components';
import { ViewSwitcherDropdown, ViewType } from './ViewSwitcher';
import { ViewSettingsPopover } from './components/ViewSettingsPopover';
import { UserFilters } from './UserFilters';
import { SchemaRenderer, useNavigationOverlay } from '@object-ui/react';
import { useDensityMode } from '@object-ui/react';
import type { ListViewSchema } from '@object-ui/types';
import { detectStatusField } from '@object-ui/types';
import { usePullToRefresh } from '@object-ui/mobile';
import { resolveConditionalFormatting, buildExpandFields, buildExportFileName, resolveEffectiveCrudAffordances, normalizeListViewSchema, rowHeightToDensityMode, mergeFilterNodes, columnIdentity, collectPredicateFieldRefs, listViewPredicates, PLATFORM_RECORD_COLUMNS, EXPANDABLE_FIELD_TYPES } from '@object-ui/core';
import { useObjectTranslation, useObjectLabel, useSafeFieldLabel, createSafeTranslation } from '@object-ui/i18n';
import { usePermissions } from '@object-ui/permissions';

export interface ListViewProps {
  schema: ListViewSchema;
  className?: string;
  onViewChange?: (view: ViewType) => void;
  onFilterChange?: (filters: any) => void;
  onSortChange?: (sort: any) => void;
  onSearchChange?: (search: string) => void;
  /** Called when the user toggles fields via the Hide Fields popover. */
  onHiddenFieldsChange?: (hidden: string[]) => void;
  /** Called when the user toggles inline record editing in View settings. */
  onInlineEditChange?: (next: boolean) => void;
  /** Called when the user resizes/reorders columns in the underlying grid. */
  onColumnStateChange?: (state: { order?: string[]; widths?: Record<string, number> }) => void;
  /** Callback when a row/item is clicked (overrides NavigationConfig) */
  onRowClick?: (record: Record<string, unknown>) => void;
  /** Show view type switcher (Grid/Kanban/etc). Default: false (view type is fixed) */
  showViewSwitcher?: boolean;
  /** Initial user-filter selections to restore (field → values; `_tab` for the active preset). */
  userFilterSelections?: Record<string, Array<string | number | boolean>>;
  /** Fires with the raw user-filter selections whenever the user changes them. */
  onUserFilterSelectionsChange?: (selections: Record<string, Array<string | number | boolean>>) => void;
  /**
   * Initial advanced-filter (FilterBuilder) group to restore at mount, e.g.
   * from a per-user localStorage cache. Read once by the lazy initializer —
   * later prop changes don't override in-flight user edits, so hosts remount
   * (via `key`) when they need to swap the restored value (view switch).
   */
  initialFilters?: FilterGroup;
  /** Initial search term to restore at mount (same one-shot semantics as `initialFilters`). */
  initialSearchTerm?: string;
  [key: string]: any;
}

// Helper to convert FilterBuilder group to ObjectStack AST.
// Accepts both the FilterBuilder vocabulary (camelCase) and the
// @objectstack/spec ViewFilterRule vocabulary (snake_case).
/**
 * Filter-builder / view operator → filter-AST operator.
 *
 * Every value returned must be a member of the spec's `VALID_AST_OPERATORS`
 * (`@objectstack/spec/data`). That set gates `isFilterAST()`, and a filter it
 * rejects is passed through unconverted and then silently DROPPED by driver-sql
 * — an unfiltered result set with no error (objectstack#3948). Pinned by
 * `filter-operator-ast-parity.test.ts`.
 *
 * Exported for that test. @internal
 */
export function mapOperator(op: string) {
  // The spec's alias table carries the same operator in up to four spellings
  // (`not_equals`, `notEquals`, `notequals`, `ne`), and stored view metadata
  // holds all of them — `saveMeta` persists the authored body verbatim, so the
  // spec's own normalization never reaches the row. Matching them case- and
  // underscore-insensitively collapses that whole class instead of enumerating
  // it: a switch listing spellings by hand had already missed eight.
  switch (op.toLowerCase().replace(/[_\s]/g, '')) {
    case 'equals': case 'eq': return '=';
    case 'notequals': case 'ne': case 'neq': return '!=';
    case 'contains': return 'contains';
    case 'notcontains': return 'notcontains';
    case 'startswith': return 'startswith';
    case 'endswith': return 'endswith';
    case 'greaterthan': case 'gt': return '>';
    case 'greaterorequal': case 'greaterthanorequal': case 'gte': return '>=';
    case 'lessthan': case 'lt': return '<';
    case 'lessorequal': case 'lessthanorequal': case 'lte': return '<=';
    case 'in': return 'in';
    // `nin`, not `'not in'`: the spaced spelling is in no spec vocabulary, so
    // `isFilterAST()` rejected it and driver-sql skipped the filter entirely.
    // The array case never reached the wire (normalizeFilterCondition expands
    // it below), but a non-array value escaped as an unfiltered query.
    case 'notin': case 'nin': return 'nin';
    // Canonical `VIEW_FILTER_OPERATORS` members with no AST counterpart; the
    // gap here is what returned unfiltered rows for a stored date filter.
    case 'before': return '<';
    case 'after': return '>';
    case 'between': return 'between';
    case 'isnull': return 'isnull';
    case 'isnotnull': return 'isnotnull';
    default: return op;
  }
}

/** Every not-in spelling this normalizer expands. See the note at the call site. */
const NOT_IN_SPELLINGS = new Set(['nin', 'not_in', 'notIn', 'notin', 'not in']);

/**
 * Normalize a single filter condition: convert `in`/not-in operators
 * into backend-compatible `or`/`and` of equality conditions.
 * E.g., ['status', 'in', ['a','b']] → ['or', ['status','=','a'], ['status','=','b']]
 */
export function normalizeFilterCondition(condition: any[]): any[] {
  if (!Array.isArray(condition) || condition.length < 3) return condition;

  const [field, op, value] = condition;

  // Recurse into logical groups
  if (typeof field === 'string' && (field === 'and' || field === 'or')) {
    return [field, ...condition.slice(1).map((c: any) =>
      Array.isArray(c) ? normalizeFilterCondition(c) : c
    )];
  }

  if (op === 'in' && Array.isArray(value)) {
    if (value.length === 0) return [];
    if (value.length === 1) return [field, '=', value[0]];
    return ['or', ...value.map((v: any) => [field, '=', v])];
  }

  // `nin` is what mapOperator now emits; the rest are spellings an external
  // caller may still pass, since this function is part of plugin-list's public
  // surface. Accepting all of them keeps the expansion working either way.
  if (NOT_IN_SPELLINGS.has(op) && Array.isArray(value)) {
    if (value.length === 0) return [];
    if (value.length === 1) return [field, '!=', value[0]];
    return ['and', ...value.map((v: any) => [field, '!=', v])];
  }

  return condition;
}

/**
 * Format an action identifier string into a human-readable label.
 * e.g., 'send_email' → 'Send Email'
 */
/**
 * Field types the SERVER refuses to order by, so the sort picker must not
 * offer them (objectui#4243).
 *
 * This mirrors `UNMATERIALIZED_SORT_TYPES` in objectstack
 * `packages/metadata-protocol/src/protocol.ts` — a `formula` value is computed
 * on read, no driver materialises a column for it, and since objectstack#6994
 * a sort naming one is a hard 400 (before that it degraded silently: the
 * response carried the very values it was asked to order by, out of order,
 * under a 200, with `asc` and `desc` byte-identical).
 *
 * The set is `formula` ALONE, deliberately — NOT the spec's
 * `COMPUTED_VALUE_TYPES` (`formula` / `summary` / `autonumber`). That set is
 * the WRITE contract ("never client-written"); `summary` and `autonumber` each
 * get a real maintained column and order correctly. objectstack's own
 * conformance test pins that trap by name ("a summary field still sorts, in
 * both directions — the family is `formula`, not 'computed'"), so widening
 * this set would withhold two types that work.
 *
 * Kept local to this renderer rather than added to `@object-ui/core`: it is
 * one sortability rule for one picker.
 */
const UNSORTABLE_FIELD_TYPES: ReadonlySet<string> = new Set(['formula']);

/**
 * Normalize a view's `sort` declaration to SortItem[]. @objectstack/spec
 * ListViewSchema.sort is `string | Array<{ field, order }>` — the TOP-LEVEL
 * value may be a bare string ("name desc"); array entries may be strings
 * (legacy "field desc") or `{ field, order }` objects. Calling `.map` on the
 * bare-string form threw "schema.sort.map is not a function" and crashed the
 * list (spec/renderer shape-mismatch audit, objectui#2578 follow-up).
 */
export function parseSortConfig(sort: unknown): SortItem[] {
  const entries = typeof sort === 'string' ? [sort] : Array.isArray(sort) ? sort : [];
  const items: SortItem[] = [];
  for (const s of entries) {
    if (typeof s === 'string') {
      const parts = s.trim().split(/\s+/);
      if (!parts[0]) continue;
      items.push({
        id: crypto.randomUUID(),
        field: parts[0],
        order: (parts[1]?.toLowerCase() === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc',
      });
    } else if (s && typeof s === 'object' && typeof (s as any).field === 'string') {
      items.push({
        id: crypto.randomUUID(),
        field: (s as any).field,
        order: ((s as any).order as 'asc' | 'desc') || 'asc',
      });
    }
  }
  return items;
}

function formatActionLabel(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Resolve the spec `AddRecordConfigSchema.position` (`ui/view.zod.ts`:
 * `top | bottom | both`) to the two render slots. A binary ternary used to
 * collapse `both` to `top`, so the bottom button never rendered (#2941).
 *
 * An absent or unrecognized value keeps this renderer's historical `top`
 * placement. (The spec's own default is `bottom`; spec-parsed metadata
 * arrives with it materialized, but raw stored JSON predating the spec
 * default relied on `top` — moving it is a UX change out of scope here.)
 *
 * Exported for the spec-parity test, which fails the moment the spec's
 * position vocabulary and this mapping drift in either direction.
 */
export function resolveAddRecordPlacement(position: unknown): { top: boolean; bottom: boolean } {
  switch (position) {
    case 'bottom':
      return { top: false, bottom: true };
    case 'both':
      return { top: true, bottom: true };
    case 'top':
    default:
      return { top: true, bottom: false };
  }
}

/**
 * The date axis a timeline view renders on.
 *
 * ONE resolution, consumed by both read-sites that decide the timeline's fate:
 * the capability gate (may this view offer the Timeline visualization?) and the
 * timeline render branch (which field does it bucket by?). Those two used to
 * carry separate, unequal source lists, and the gate was the wider of the pair —
 * it accepted `options.calendar.startDateField` as a timeline-resolvable axis
 * while the render branch never read calendar config at all. A view that binds
 * its dates under `calendar` therefore got the Timeline option offered and then
 * bucketed every record into "No date" (objectui#3129), which is exactly the
 * shape the report isolated: the same fields render fine in Calendar and Gantt.
 *
 * A calendar binding IS a legitimate timeline axis in this product, not a
 * lenient fallback bolted on here: the capability gate has always said so, and
 * `InterfaceListPage` derives a timeline's default binding from the very same
 * `defaultCalendarFromObject` helper it uses for calendars. What was missing is
 * that one of the two read-sites never honoured the promise the other made.
 *
 * Both nestings are read at each level, spec-canonical key first: the
 * spec-authored `schema.timeline` / `schema.calendar` and the legacy
 * `schema.options.*` twin that app-shell's object pages still emit. `dateField`
 * is the pre-#2231 alias for `startDateField`.
 *
 * Exported for the regression suite, which pins each authoring shape.
 */
export function resolveTimelineDateBinding(schema: any): {
  startDateField?: string;
  endDateField?: string;
  titleField?: string;
} {
  const sources = [
    schema?.timeline,
    schema?.options?.timeline,
    schema?.calendar,
    schema?.options?.calendar,
  ];
  const pick = (read: (src: any) => unknown): string | undefined => {
    for (const src of sources) {
      if (!src) continue;
      const value = read(src);
      if (typeof value === 'string' && value) return value;
    }
    return undefined;
  };
  return {
    startDateField: pick((s) => s.startDateField ?? s.dateField),
    endDateField: pick((s) => s.endDateField),
    titleField: pick((s) => s.titleField),
  };
}

/**
 * Normalize an array of filter conditions, expanding `in`/`not in` operators
 * and ensuring consistent AST structure.
 */
export function normalizeFilters(filters: any[]): any[] {
  if (!Array.isArray(filters) || filters.length === 0) return [];
  return filters
    .map(f => Array.isArray(f) ? normalizeFilterCondition(f) : f)
    .filter(f => Array.isArray(f) && f.length > 0);
}

/**
 * Merge the three filter sources a list can have — the view's own `filter`, the
 * filter-panel group, and the per-field user filters — into one AST node.
 *
 * ONE definition on purpose. The data fetch and the export used to carry
 * verbatim copies of this, and those two decide, respectively, **what the user
 * sees** and **what they download**. Two copies that must agree, where a
 * divergence is a file that silently disagrees with the screen — the same shape
 * of bug that had already bitten the adapter, whose duplicated filter-shape
 * check drifted apart unnoticed (#3072).
 *
 * Returns `undefined` when nothing is active, so callers can skip `$filter`
 * entirely rather than sending an empty array.
 *
 * A MongoDB-style object `schema.filter` used to be dropped here (`.length` is
 * `undefined` on an object, so the guard read false) and the list returned every
 * record. An earlier version of this comment called that unreachable, on the
 * grounds that nothing in the repo hands a list view an object filter. That was
 * wrong: `ObjectView` passes `mergedFilters` straight into this schema's
 * `filter`, and its last fallback is `table.defaultFilters`, declared
 * `Record<string, any>`. `toFilterNode` now converts it instead.
 */
export function buildEffectiveFilter(
  baseFilter: unknown,
  currentFilters: FilterGroup,
  userFilterConditions: any[],
): any[] | Record<string, any> | undefined {
  const userFilter = convertFilterGroupToAST(currentFilters);
  return mergeFilterNodes(
    baseFilter,
    userFilter.length > 0 ? userFilter : undefined,
    // Normalize the per-field conditions (expands `in` into an `or` of `=`),
    // each of which is already its own node.
    ...normalizeFilters(userFilterConditions),
  );
}

export function convertFilterGroupToAST(group: FilterGroup): any[] {
  if (!group || !group.conditions || group.conditions.length === 0) return [];

  const conditions = group.conditions
    .filter(c => {
      // isEmpty/isNotEmpty carry no value input — always keep them.
      if (c.operator === 'isEmpty' || c.operator === 'isNotEmpty') return true;
      // Skip incomplete rows (no value entered yet). Emitting `[field, op, '']`
      // would be a silently-wrong filter (matches only empty) rather than
      // "no filter", excluding all rows. Matches groupToCondition in
      // datasetFilterCondition.ts (#1964).
      const v = c.value;
      return !(v == null || v === '' || (Array.isArray(v) && v.length === 0));
    })
    .map(c => {
      if (c.operator === 'isEmpty') return [c.field, '=', null];
      if (c.operator === 'isNotEmpty') return [c.field, '!=', null];
      return [c.field, mapOperator(c.operator), c.value];
    });

  // Normalize in/not-in conditions for backend compatibility
  const normalized = normalizeFilters(conditions);
  if (normalized.length === 0) return [];
  if (normalized.length === 1) return normalized[0];
  
  return [group.logic, ...normalized];
}

/**
 * Evaluate conditional formatting rules against a record.
 * Returns a CSSProperties object for the first matching rule, or empty object.
 * Supports all three historical rule shapes (spec `{ condition, style }`,
 * ObjectUI `{ expression, … }`, native `{ field, operator, value, … }`).
 *
 * Thin wrapper over `@object-ui/core`'s `resolveConditionalFormatting`, which
 * evaluates every predicate on the canonical CEL engine (with a legacy-dialect
 * fallback) so a list view speaks the same expression dialect the server does
 * (issue #1584 / ADR-0058). Kept exported for back-compat with consumers that
 * evaluate formatting outside the ListView component.
 *
 * @param scope  Extra top-level scope (the host predicate scope) bound
 *               alongside the row, so `features.*` / `current_user.*`
 *               conditions resolve as they do on grid rows / kanban cards.
 * @param fields The object's field definitions, so a rule comparing a relation
 *               field sees the stored foreign key rather than the record
 *               `$expand` substituted for it (see `toPredicateRecord`).
 */
export function evaluateConditionalFormatting(
  record: Record<string, unknown>,
  rules?: ListViewSchema['conditionalFormatting'],
  scope?: Record<string, unknown>,
  fields?: unknown,
): React.CSSProperties {
  return resolveConditionalFormatting(record, rules as any, scope, fields as never) as React.CSSProperties;
}

/**
 * Classify a failed data fetch by HTTP status / error code so the error panel
 * can say what actually happened. A 403 rendered as "check your connection"
 * is indistinguishable from a real outage — users were told to debug their
 * network when the server had (correctly) denied them access.
 */
function classifyLoadError(err: unknown): 'forbidden' | 'unauthorized' | 'rejected' | 'network' {
  const e = err as any;
  // The ObjectStack client decorates errors with `httpStatus`; raw fetch
  // wrappers surface `status` / `statusCode`; some adapters only embed the
  // status in the message ("HTTP 403 Forbidden — …").
  let status = [e?.httpStatus, e?.status, e?.statusCode]
    .find((s: unknown): s is number => typeof s === 'number');
  if (status === undefined) {
    const m = /HTTP (\d{3})\b/.exec(String(e?.message ?? ''));
    if (m) status = Number(m[1]);
  }
  const code = typeof e?.code === 'string' ? e.code.toUpperCase() : '';
  if (status === 403 || code === 'PERMISSION_DENIED' || code === 'FORBIDDEN') return 'forbidden';
  if (status === 401 || code === 'UNAUTHORIZED' || code === 'UNAUTHENTICATED') return 'unauthorized';
  // The server understood the request and refused it as malformed. Retrying
  // sends the identical bad request, so "check your connection and try again"
  // is the same wrong advice this function exists to stop giving — one status
  // code over. The server now rejects a `$filter` that is not a filter AST
  // (objectstack#4121) and an unsupported `$`-parameter, both as 400.
  if (status === 400 || REJECTED_REQUEST_CODES.has(code)) return 'rejected';
  return 'network';
}

/** 400-class error codes the data API returns for a request it will never accept. */
const REJECTED_REQUEST_CODES = new Set([
  'INVALID_FILTER',
  'UNSUPPORTED_QUERY_PARAM',
  'INVALID_QUERY',
]);

// Default English translations for fallback when I18nProvider is not available
const LIST_DEFAULT_TRANSLATIONS: Record<string, string> = {
  'list.recordCount': '{{count}} records',
  'list.recordCountOne': '{{count}} record',
  'list.noItems': 'No items found',
  'list.noItemsMessage': 'There are no records to display. Try adjusting your filters or adding new data.',
  // First-run (truly empty, no filter/search) vs filtered-to-empty. Showing
  // "adjust your filters" to a brand-new user with nothing to adjust is wrong.
  'list.firstRunTitle': 'Nothing here yet',
  'list.firstRunMessage': 'Create your first record to get started.',
  'list.noMatches': 'No matching records',
  'list.noMatchesMessage': 'No records match your current filters or search. Try adjusting or clearing them.',
  'list.loading': 'Loading records…',
  // Load FAILED (network / server error) — distinct from empty. Offer retry.
  'list.loadErrorTitle': 'Couldn\u2019t load records',
  'list.loadErrorMessage': 'Something went wrong while loading this data. Check your connection and try again.',
  // Load DENIED — the server answered, with a 403/401. Blaming the network
  // here sends users chasing connectivity ghosts.
  'list.loadErrorForbiddenTitle': 'You don’t have access',
  'list.loadErrorForbiddenMessage': 'You don’t have permission to view these records. Contact your administrator if you think you should have access.',
  'list.loadErrorUnauthorizedTitle': 'Sign in required',
  'list.loadErrorUnauthorizedMessage': 'Your session has expired or you are signed out. Sign in again to view these records.',
  // Load REJECTED — the server answered 400: the request itself is malformed
  // (usually a stored filter it cannot parse). Retrying resends the same bad
  // request, so the copy points at the filter instead of the network.
  'list.loadErrorRejectedTitle': 'This view’s query was rejected',
  'list.loadErrorRejectedMessage': 'The server could not process this view’s filter or query options. Clearing the filters usually fixes it; if the view is saved this way, an administrator needs to correct it.',
  'list.retry': 'Retry',
  // The bare NOUN, for the search button's tooltip. It is deliberately NOT the
  // input placeholder: that is `table.search` below (objectui#4375).
  'list.search': 'Search',
  // Placeholder of the search popover's input. Borrowed from the `table.*`
  // namespace rather than minted as `list.searchPlaceholder`, on the same
  // reasoning as `detail.recordDetail` below: `table.search` is already THE
  // search-input placeholder key in this repo — `data-table`, `RecordPickerDialog`
  // and `PeoplePicker` all render it — and one control should not get two
  // translations that can drift apart in a locale.
  //
  // Until objectui#4375 this read `t('list.search') + '...'`, so the ellipsis was
  // a literal concatenated in code: it stayed ASCII in all ten locales (on a
  // screen where objectui#3878 had converged everything else on U+2026), and no
  // pack could opt out of it — sharpest in `ar`, which got a left-to-right run
  // appended to right-to-left text. As a pack value the ellipsis is the ar
  // pack's own (`بحث…`) and the bidi algorithm places it at the logical end.
  //
  // Byte-identical to `en`, like every entry here — a provider-less host renders
  // THIS copy, so a divergence would make the two paths disagree on one control.
  'table.search': 'Search…',
  'list.filter': 'Filter',
  'list.filterRecords': 'Filter Records',
  'list.sort': 'Sort',
  'list.sortRecords': 'Sort Records',
  'list.sortByIdSuffix': '(by ID)',
  // objectui#4294 — the remedy sentence must match `en`'s byte for byte. It is
  // this copy, not the pack, that renders on a provider-less host (and in this
  // package's own tests), so a pack-only reword would leave the old advice —
  // "add a formula field" — on the exact surface the card is about. No gate
  // compares this table to `en`: `check:i18n-keys` judges inline
  // `t(key, { defaultValue })` options, never a `createSafeTranslation` table.
  'list.sortRelationalHint':
    'Columns that link to another record are not listed: they can only be sorted by the stored ID, not by the name shown in the cell. To sort by that name, denormalize it onto this object as a stored field, written when the source changes, and sort by that. Not a formula field: it is virtual, so no column is stored for it and the server refuses to sort by one.',
  'list.group': 'Group',
  'list.groupBy': 'Group By',
  'list.export': 'Export',
  'list.exportAs': 'Export as {{format}}',
  'list.color': 'Color',
  'list.rowColor': 'Row Color',
  'list.colorByField': 'Color by field',
  'list.clear': 'Clear',
  'list.none': 'None',
  'list.hideFields': 'Hide fields',
  'list.showAll': 'Show all',
  'list.pullToRefresh': 'Pull to refresh',
  'list.refresh': 'Refresh',
  'list.refreshing': 'Refreshing…',
  'list.dataLimitReached': 'Showing first {{limit}} records. More data may be available.',
  'list.addRecord': 'Add record',
  'list.tabs': 'Tabs',
  'list.allRecords': 'All Records',
  'list.share': 'Share',
  'list.print': 'Print',
  'list.hideFieldsTitle': 'Hide Fields',
  'table.rowsPerPage': 'Rows per page',
  'grid.toolbar.densityMode': 'Density',
  'grid.toolbar.densityCompact': 'Compact',
  'grid.toolbar.densityComfortable': 'Comfortable',
  'grid.toolbar.densitySpacious': 'Spacious',
  'grid.toolbar.densityCycleHint': '{{label}} (click to cycle)',
  'grid.toolbar.densityCycleShortHint': 'Click to cycle',
  'list.viewSettings': 'View settings',
  'list.viewSettingsHint': 'Grouping, color, density, and visible fields.',
  // Heading of the record-detail overlay this view opens when a child view's
  // row is clicked (objectui#3426). Borrowed from the `detail.*` namespace
  // rather than minted as `list.recordDetail`: `NavigationOverlay` already
  // resolves `detail.recordDetail` for hosts that pass no title, and one
  // heading on one control should not get two translations that can drift
  // apart. Both entries must exist HERE too — a provider-less host (a
  // standalone list, this package's own tests) never reaches the locale packs.
  'detail.recordDetail': 'Record Detail',
  'detail.recordDetailWithLabel': '{{label}} Detail',
};

/**
 * Safe wrapper for useObjectTranslation that falls back to English defaults
 * when I18nProvider is not available (e.g., standalone usage outside console).
 *
 * Delegates to `@object-ui/i18n`'s `createSafeTranslation`. The local copy
 * this replaced wrapped the hook in try/catch — the very thing the comment on
 * `useListViewObjectLabel` below warns against (objectui#2879).
 */
const useListViewTranslation = createSafeTranslation(
  LIST_DEFAULT_TRANSLATIONS,
  'list.recordCount',
);

/**
 * Thin selector over useObjectLabel. The underlying hook is provider-safe
 * (optional context + global i18n fallback), so no try/catch — wrapping a
 * hook call in try/catch violates rules-of-hooks: a throw after other hooks
 * ran would desync hook order on the next render (same fix as
 * fields#useFieldLabel, objectui#2595).
 */
function useListFieldLabel() {
  const { fieldLabel, actionLabel, objectLabel } = useObjectLabel();
  return { fieldLabel, actionLabel, objectLabel };
}

/**
 * Imperative handle exposed by ListView via React.forwardRef.
 * Allows parent components to trigger a data refresh programmatically.
 *
 * @example
 * ```tsx
 * const listRef = React.useRef<ListViewHandle>(null);
 * <ListView ref={listRef} schema={schema} />
 * // After a mutation:
 * listRef.current?.refresh();
 * ```
 */
export interface ListViewHandle {
  /** Force the ListView to re-fetch data from the DataSource */
  refresh(): void;
}

export const ListView = React.forwardRef<ListViewHandle, ListViewProps>(({
  schema: propSchema,
  className,
  onViewChange,
  onFilterChange,
  onSortChange,
  onSearchChange,
  onHiddenFieldsChange,
  onInlineEditChange,
  onColumnStateChange,
  onRowClick,
  showViewSwitcher: showViewSwitcherProp,
  userFilterSelections,
  onUserFilterSelectionsChange,
  initialFilters,
  initialSearchTerm,
  ...props
}, ref) => {
  // The switcher can be enabled either by the host component (prop) or by
  // the schema itself (ADR-0047 — ObjectView/InterfaceListPage stamp it on
  // the schema when appearance.allowedVisualizations whitelists >1 type).
  const showViewSwitcher = showViewSwitcherProp ?? (propSchema as any)?.showViewSwitcher ?? false;
  // i18n support for record count and other labels
  const { t } = useListViewTranslation();
  const { fieldLabel: resolveFieldLabel, actionLabel: resolveActionLabel, objectLabel: resolveObjectLabel } = useListFieldLabel();
  const { translateOptions } = useSafeFieldLabel();

  // Canonicalize the view vocabulary ONCE, here, before anything reads it
  // (#2890): the legacy `fields` folds into the spec's `columns`, and `viewType`
  // is defaulted to a RENDERABLE kind. Nothing on this path parses the schema
  // through zod, so this call site — not `ListViewSchema` — is what guarantees
  // the fold runs. See `normalizeListViewSchema` for why the legacy key is
  // dropped rather than dual-read.
  // Perf: the normalizer returns propSchema by reference when there is nothing
  // to fold, so downstream useMemos keep a stable dependency identity on the
  // already-canonical path (the common case).
  const schema = React.useMemo(() => normalizeListViewSchema(propSchema), [propSchema]);

  // Convenience: resolve field label with schema.objectName pre-bound
  const tFieldLabel = React.useCallback(
    (fieldName: string, fallback: string) =>
      schema.objectName ? resolveFieldLabel(schema.objectName, fieldName, fallback) : fallback,
    [schema.objectName, resolveFieldLabel],
  );

  // Convenience: resolve action label with schema.objectName pre-bound.
  // Falls back to title-casing the action key when no i18n resource is found,
  // matching the previous local `formatActionLabel` helper.
  const tActionLabel = React.useCallback(
    (actionName: string) => {
      const fallback = formatActionLabel(actionName);
      if (schema.objectName && typeof resolveActionLabel === 'function') {
        return resolveActionLabel(schema.objectName, actionName, fallback);
      }
      return fallback;
    },
    [schema.objectName, resolveActionLabel],
  );

  // Resolve toolbar visibility flags: userActions overrides showX flags
  const toolbarFlags = React.useMemo(() => {
    // Every toolbar toggle reads from `userActions` (#2890). The legacy bare
    // `show*` flags are folded into it by `normalizeListViewSchema` above, so
    // there is no dual-read here — one vocabulary, one place.
    //
    // The DEFAULTS are per-toggle and deliberately asymmetric, matching what
    // these flags have always done: the four view-shaping affordances plus
    // grouping are on unless turned off; column visibility and row coloring are
    // off unless turned on. (`hideFields`/`rowColor` default OFF is objectui's
    // historical behavior, kept deliberately — flipping it would grow two
    // buttons on every existing view.)
    const ua = schema.userActions as Record<string, boolean | undefined> | undefined;
    const addRecordEnabled = schema.addRecord?.enabled === true && ua?.addRecordForm !== false;
    const addRecordPlacement = resolveAddRecordPlacement(schema.addRecord?.position);
    return {
      showSearch: ua?.search !== false,
      showSort: ua?.sort !== false,
      showFilters: ua?.filter !== false,
      showRefresh: ua?.refresh !== false,
      showDensity: ua?.rowHeight !== false,
      showGroup: ua?.group !== false,
      showHideFields: ua?.hideFields === true,
      showColor: ua?.rowColor === true,
      compactToolbar: schema.compactToolbar === true,
      // Position-independent switch (empty-state CTA) + the two placement
      // slots. `position: 'both'` renders both buttons — it used to collapse
      // to `top` through a binary ternary (#2941).
      showAddRecord: addRecordEnabled,
      showAddRecordTop: addRecordEnabled && addRecordPlacement.top,
      showAddRecordBottom: addRecordEnabled && addRecordPlacement.bottom,
    };
  }, [schema.userActions, schema.compactToolbar, schema.addRecord]);

  const [currentView, setCurrentView] = React.useState<ViewType>(
    (schema.viewType as ViewType)
  );
  const [searchTerm, setSearchTerm] = React.useState(() => initialSearchTerm ?? '');
  const [showSearchPopover, setShowSearchPopover] = React.useState(false);
  
  // Sort State
  const [showSort, setShowSort] = React.useState(false);
  const [currentSort, setCurrentSort] = React.useState<SortItem[]>(() =>
    parseSortConfig(schema.sort),
  );

  // Sync when parent schema.sort changes (view switch / reload pulls a
  // saved override). Compare by stringified payload to avoid render loops.
  const schemaSortKey = React.useMemo(
    () => JSON.stringify(schema.sort || []),
    [schema.sort]
  );
  React.useEffect(() => {
    setCurrentSort(parseSortConfig(schema.sort));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaSortKey]);

  /**
   * The view's DECLARED sort, for the "reset to default" affordance
   * (objectui#4243).
   *
   * One click on a column header replaces the whole sort array with that one
   * column, so a view shipping a two-level default lost it for the rest of the
   * session — the declared `sort` acted as an initial value with no way back
   * short of a page reload.
   *
   * Read through `parseSortConfig(schema.sort)` — THE resolver the initial
   * state and the view-switch effect above already use, not a re-derivation:
   * "what did this view declare" must have exactly one answer, or the reset
   * button and the first render could disagree about it.
   */
  const declaredSort = React.useMemo(
    () => parseSortConfig(schema.sort),
    // Keyed on the same stringified payload as the effect above; `schema.sort`
    // is a fresh array identity on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schemaSortKey],
  );

  // Compared by (field, order) IN ORDER — never by `id`, which `parseSortConfig`
  // mints fresh from `crypto.randomUUID()` on every call, so an id comparison
  // would report "differs" against the view's own declared sort.
  const sortDiffersFromDeclared = React.useMemo(() => {
    if (currentSort.length !== declaredSort.length) return true;
    return currentSort.some(
      (item, i) => item.field !== declaredSort[i].field || item.order !== declaredSort[i].order,
    );
  }, [currentSort, declaredSort]);

  const [showFilters, setShowFilters] = React.useState(false);

  const [currentFilters, setCurrentFilters] = React.useState<FilterGroup>(() =>
    initialFilters && Array.isArray(initialFilters.conditions)
      ? initialFilters
      : {
          id: 'root',
          logic: 'and',
          conditions: []
        }
  );

  // Data State
  const dataSource = props.dataSource;
  const [data, setData] = React.useState<any[]>([]);
  // Load failure (network / server error) is distinct from "empty": we must
  // not tell a user to "create your first record" when the fetch actually
  // failed. Captured here so the render can show a retryable error panel.
  const [loadError, setLoadError] = React.useState<string | null>(null);
  // What KIND of failure `loadError` is — drives which error panel copy shows.
  const [loadErrorKind, setLoadErrorKind] = React.useState<'forbidden' | 'unauthorized' | 'rejected' | 'network'>('network');
  // Start in loading state when we will fetch from a dataSource so the empty
  // state doesn't flash before the first effect runs. Inline data (schema.data
  // as an array or a `value` provider) starts as not-loading.
  const [loading, setLoading] = React.useState<boolean>(() => {
    if (Array.isArray(schema.data)) return false;
    if (
      schema.data &&
      typeof schema.data === 'object' &&
      (schema.data as any).provider === 'value' &&
      Array.isArray((schema.data as any).items)
    ) {
      return false;
    }
    // Renderer-owned data (gantt + api provider): ListView never fetches,
    // so don't flash its skeleton either.
    if (
      schema.viewType === 'gantt' &&
      schema.data &&
      typeof schema.data === 'object' &&
      !Array.isArray(schema.data) &&
      (schema.data as any).provider === 'api'
    ) {
      return false;
    }
    return true;
  });
  const [objectDef, setObjectDef] = React.useState<any>(null);
  const [objectDefLoaded, setObjectDefLoaded] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [dataLimitReached, setDataLimitReached] = React.useState(false);

  // --- P1: Imperative refresh API ---
  React.useImperativeHandle(ref, () => ({
    refresh: () => setRefreshKey(k => k + 1),
  }), []);

  // --- P2: Auto-subscribe to DataSource mutation events ---
  // Refetch whenever the bound object is mutated through the DataSource. This
  // is the ONLY refresh signal for inline-edit "Save All": ObjectGrid persists
  // those edits by calling dataSource.update() directly, with no form-success
  // handler to bump an external refreshTrigger — so subscribing even when
  // `refreshTrigger` is provided is required, not redundant. Form/delete flows
  // also bump refreshTrigger; the extra refetch that produces is harmless
  // because find() coalesces concurrent identical reads into one round-trip.
  React.useEffect(() => {
    if (!dataSource?.onMutation || !schema.objectName) return;
    const unsub = dataSource.onMutation((event: any) => {
      if (event.resource === schema.objectName) {
        setRefreshKey(k => k + 1);
      }
    });
    return unsub;
  }, [dataSource, schema.objectName]);

  // Dynamic page size state (wired from pageSizeOptions selector)
  const [dynamicPageSize, setDynamicPageSize] = React.useState<number | undefined>(undefined);
  const effectivePageSize = dynamicPageSize ?? schema.pagination?.pageSize ?? 100;

  // --- Server-side pagination (#2212) ---
  // ListView owns the fetch, so it owns paging too: it requests one window at a
  // time ($skip = (page-1)*size) and reads the real match `total` from the
  // result. That total + page controls are handed DOWN to the flat grid view so
  // its existing (single) DataTable pager becomes server-driven — records past
  // the first window are reachable, and we never stack a second pager on top.
  const [serverPage, setServerPage] = React.useState(1);
  const [serverTotal, setServerTotal] = React.useState<number | null>(null);

  // Grouping state (initialized from schema, user can add/remove via popover).
  // Supports three input shapes from the schema:
  //   1. Spec-compliant `grouping: { fields: [...] }` (preferred — supports
  //      arbitrary nesting depth).
  //   2. Shorthand `groupBy: 'fieldname'` written by the view config UI for
  //      the primary group.
  //   3. Optional `groupBy2: 'fieldname'` for a secondary (nested) group,
  //      enabling Airtable-style two-level grouping from the visual editor.
  // Any combination of (2) + (3) is normalized into a multi-level
  // GroupingConfig so the renderer honors grouping configured visually.
  const initialGroupingConfig = React.useMemo(() => {
    if (schema.grouping?.fields?.length) return schema.grouping;
    const primary = typeof schema.groupBy === 'string' ? schema.groupBy.trim() : '';
    const secondary = typeof schema.groupBy2 === 'string' ? schema.groupBy2.trim() : '';
    const fields: Array<{ field: string; order: 'asc'; collapsed: boolean }> = [];
    if (primary) fields.push({ field: primary, order: 'asc', collapsed: false });
    if (secondary && secondary !== primary) {
      fields.push({ field: secondary, order: 'asc', collapsed: false });
    }
    return fields.length > 0 ? { fields } : undefined;
  }, [schema.grouping, schema.groupBy, schema.groupBy2]);
  const [groupingConfig, setGroupingConfig] = React.useState(initialGroupingConfig);
  const [showGroupPopover, setShowGroupPopover] = React.useState(false);

  // Re-sync grouping when the underlying schema-driven config changes (e.g. the
  // user edits `groupBy` in the view designer). User-driven changes via the
  // popover keep the latest interaction since this only fires on schema deltas.
  const lastSchemaGroupingRef = React.useRef(initialGroupingConfig);
  React.useEffect(() => {
    if (lastSchemaGroupingRef.current !== initialGroupingConfig) {
      lastSchemaGroupingRef.current = initialGroupingConfig;
      setGroupingConfig(initialGroupingConfig);
    }
  }, [initialGroupingConfig]);

  // Row color state (initialized from schema, user can configure via popover)
  const [rowColorConfig, setRowColorConfig] = React.useState(schema.rowColor);
  const [showColorPopover, setShowColorPopover] = React.useState(false);

  // Bulk action state
  const [selectedRows, setSelectedRows] = React.useState<any[]>([]);

  // Request counter for debounce — only the latest request writes data
  const fetchRequestIdRef = React.useRef(0);


  // User Filters State (Airtable Interfaces-style)
  const [userFilterConditions, setUserFilterConditions] = React.useState<any[]>([]);

  // User filters render ONLY when explicitly configured (ADR-0047 §data
  // mode): saved list views already act as the preset switcher, so an
  // unconfigured view keeps a clean toolbar instead of growing auto-derived
  // dropdowns. When a config asks for dropdown/toggle elements without
  // naming fields, fill the field list from objectDef select-like fields so
  // authors can write `userFilters: { element: 'dropdown' }` as shorthand.
  const resolvedUserFilters = React.useMemo<ListViewSchema['userFilters'] | undefined>(() => {
    const configured = schema.userFilters;
    if (!configured) return undefined;
    if (configured.element === 'tabs') return configured;
    if (configured.fields && configured.fields.length > 0) return configured;
    if (!objectDef?.fields) return configured;

    const FILTERABLE_FIELD_TYPES = new Set(['select', 'multi-select', 'boolean']);
    const derivedFields: NonNullable<NonNullable<ListViewSchema['userFilters']>['fields']> = [];

    const fieldsEntries: Array<[string, any]> = Array.isArray(objectDef.fields)
      ? objectDef.fields.map((f: any) => [f.name, f])
      : Object.entries(objectDef.fields);

    for (const [key, field] of fieldsEntries) {
      // Include fields with a filterable type, or fields that have options without an explicit type
      if (FILTERABLE_FIELD_TYPES.has(field.type) || (field.options && !field.type)) {
        derivedFields.push({
          field: key,
          label: tFieldLabel(key, field.label || key),
          type: field.type === 'boolean' ? 'boolean' : field.type === 'multi-select' ? 'multi-select' : 'select',
        });
      }
    }

    if (derivedFields.length === 0) return configured;

    return { ...configured, fields: derivedFields };
  }, [schema.userFilters, objectDef, tFieldLabel]);

  // ADR-0053: userFilters (dropdown | tabs) is the sole page filter control.
  const filterElements = resolvedUserFilters;

  // Hidden Fields State (initialized from schema)
  const [hiddenFields, setHiddenFields] = React.useState<Set<string>>(
    () => new Set(schema.hiddenFields || [])
  );
  // Sync when parent schema changes (e.g. switching between views, reload
  // pulls a saved override). Wrapped in JSON to avoid Set identity churn.
  const schemaHiddenKey = React.useMemo(
    () => JSON.stringify(schema.hiddenFields || []),
    [schema.hiddenFields]
  );
  React.useEffect(() => {
    setHiddenFields(new Set(schema.hiddenFields || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaHiddenKey]);

  // Setter that also notifies parent for persistence (debounced upstream).
  const updateHiddenFields = React.useCallback(
    (next: Set<string>) => {
      setHiddenFields(next);
      onHiddenFieldsChange?.(Array.from(next));
    },
    [onHiddenFieldsChange]
  );
  const [showHideFields, setShowHideFields] = React.useState(false);

  // Inline-edit State (initialized from schema). Kept local — like hiddenFields
  // — so the toolbar toggle flips the grid immediately. The parent persists via
  // onInlineEditChange (debounced) and doesn't update the `inlineEdit` prop
  // synchronously, so reading `schema.inlineEdit` directly would make the button
  // appear dead until a full reload.
  const [inlineEdit, setInlineEdit] = React.useState<boolean>(() => !!schema.inlineEdit);
  React.useEffect(() => {
    setInlineEdit(!!schema.inlineEdit);
  }, [schema.inlineEdit]);
  // Setter that also notifies parent for persistence (debounced upstream).
  const updateInlineEdit = React.useCallback(
    (next: boolean) => {
      setInlineEdit(next);
      onInlineEditChange?.(next);
    },
    [onInlineEditChange]
  );

  // Export State
  const [showExport, setShowExport] = React.useState(false);
  // Server-streamed export (xlsx / type-aware csv|json) in-flight + last error.
  const [exportBusy, setExportBusy] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);

  // Object-level export permission gate. Default-allow: export stays enabled
  // unless `allowExport === false` or `operations.export === false`, AND — when
  // the server hands down an effective API operation set for this object
  // (/me/permissions `apiOperations`, #3391) — unless it excludes `export`.
  // Missing effective set (unrestricted object / old backend / no provider)
  // keeps the current behavior. The frontend consumes the effective set the
  // server resolved; it never reads the raw `apiMethods`.
  const { getObjectApiOperations, can: canDo } = usePermissions();
  const effectiveApiOps = schema.objectName ? getObjectApiOperations(schema.objectName) : undefined;
  const exportPermitted =
    schema.allowExport !== false &&
    schema.operations?.export !== false &&
    (effectiveApiOps ? effectiveApiOps.includes('export') : true);

  // [#3720] Bulk-action gate for the NON-grid views (kanban / calendar /
  // gallery / …), whose bulk bar this component renders itself — the grid path
  // delegates to ObjectGrid, which gates its own. A declared `bulkActions`
  // entry is a WIRING declaration, not a permission grant, so the built-in
  // `delete` is dropped unless the object's resolved delete affordance allows
  // it: the ADR-0103 bucket lock ∧ `userActions.delete` ∧ the server's
  // effective API operation set (#3391). Custom action ids pass through
  // untouched — they route through the action runner with their own gates.
  // [#4096] ∧ the CURRENT PRINCIPAL's `allowDelete` — the three layers above
  // all describe the OBJECT, so without this the most destructive entry on a
  // kanban/gallery board stayed visible for an account with no delete grant.
  // `can()` answers `true` with no `PermissionProvider` (standalone embeds).
  const permittedBulkActions = React.useMemo(() => {
    const declared = schema.bulkActions;
    if (!declared || declared.length === 0) return declared;
    const objectDeleteAllowed =
      resolveEffectiveCrudAffordances(objectDef as any, effectiveApiOps).delete &&
      (schema.objectName ? canDo(schema.objectName, 'delete') : true);
    if (objectDeleteAllowed) return declared;
    return declared.filter((a: unknown) => String(a).toLowerCase() !== 'delete');
  }, [schema.bulkActions, schema.objectName, objectDef, effectiveApiOps, canDo]);

  // Normalize exportOptions: support both ObjectUI object format and spec string[] format
  const resolvedExportOptions = React.useMemo(() => {
    if (!schema.exportOptions) return undefined;
    // Spec format: simple string[] like ['csv', 'xlsx']
    if (Array.isArray(schema.exportOptions)) {
      return { formats: schema.exportOptions as Array<'csv' | 'xlsx' | 'json' | 'pdf'> };
    }
    // ObjectUI format: already an object
    return schema.exportOptions;
  }, [schema.exportOptions]);

  // Formats this list can actually deliver (objectui#2942): the server stream
  // handles csv/xlsx/json, the client fallback only csv/json, and pdf exists
  // nowhere (declined platform-side — objectstack#1301). Declared-but-dead
  // formats used to render as menu items whose click did nothing; now they're
  // dropped from the menu (with a one-time warning for the app author).
  const exportableFormats = React.useMemo(() => {
    const declared = resolvedExportOptions?.formats || ['csv', 'json'];
    const serverAvailable = typeof dataSource?.exportDownload === 'function'
      && !!schema.objectName
      && (resolvedExportOptions as any)?.streaming !== false;
    const supported = serverAvailable ? ['csv', 'xlsx', 'json'] : ['csv', 'json'];
    return declared.filter((f: string) => supported.includes(f));
  }, [resolvedExportOptions, dataSource, schema.objectName]);
  React.useEffect(() => {
    const declared = resolvedExportOptions?.formats;
    if (!declared) return;
    const dropped = declared.filter((f: string) => !exportableFormats.includes(f));
    if (dropped.length > 0) {
      console.warn(`[ObjectUI] ListView export: unsupported format(s) hidden from the menu: ${dropped.join(', ')}`);
    }
  }, [resolvedExportOptions, exportableFormats]);

  // Toolbar density, resolved from the spec-canonical `rowHeight` (#2890). The
  // legacy `densityMode` is folded into it by `normalizeListViewSchema` above —
  // it used to be read FIRST here, so a view carrying both rendered the legacy
  // value, backwards from every other pair's canonical-wins precedence.
  const resolvedDensity = React.useMemo(() => {
    if (schema.rowHeight) return rowHeightToDensityMode(schema.rowHeight);
    return 'compact';
  }, [schema.rowHeight]);
  const density = useDensityMode(resolvedDensity, {
    onChange: schema.onDensityChange,
  });

  // ── Gallery card density ────────────────────────────────────────────
  // Separate from the table `density.mode` (which controls rowHeight) —
  // the gallery uses 3 column counts mapped to `GalleryConfig.cardSize`
  // (small/medium/large). Persisted per-object so users can keep
  // Accounts compact while leaving Products comfortable.
  type GalleryCardSize = 'small' | 'medium' | 'large';
  const galleryDensityKey = React.useMemo(
    () => `objectui:gallery:density:${schema.objectName ?? 'default'}`,
    [schema.objectName],
  );
  const [galleryCardSize, setGalleryCardSize] = React.useState<GalleryCardSize>(() => {
    if (typeof window === 'undefined') return (schema.gallery?.cardSize as GalleryCardSize) ?? 'medium';
    try {
      const v = window.localStorage.getItem(galleryDensityKey);
      if (v === 'small' || v === 'medium' || v === 'large') return v;
    } catch { /* private mode — fall through */ }
    return (schema.gallery?.cardSize as GalleryCardSize) ?? 'medium';
  });
  const cycleGalleryDensity = React.useCallback(() => {
    setGalleryCardSize((prev) => {
      const next: GalleryCardSize = prev === 'large' ? 'medium' : prev === 'medium' ? 'small' : 'large';
      try { window.localStorage.setItem(galleryDensityKey, next); } catch { /* ignore */ }
      return next;
    });
  }, [galleryDensityKey]);

  const handlePullRefresh = React.useCallback(async () => {
    setRefreshKey(k => k + 1);
  }, []);

  const { ref: pullRef, isRefreshing, pullDistance } = usePullToRefresh<HTMLDivElement>({
    onRefresh: handlePullRefresh,
    enabled: !!dataSource && !!schema.objectName,
  });

  const storageKey = React.useMemo(() => {
    return schema.id 
      ? `listview-${schema.objectName}-${schema.id}-view`
      : `listview-${schema.objectName}-view`;
  }, [schema.objectName, schema.id]);

  // Fetch object definition
  React.useEffect(() => {
    let isMounted = true;
    // Reset loaded flag so data fetch waits for the new schema
    setObjectDefLoaded(false);
    setObjectDef(null);
    const fetchObjectDef = async () => {
      if (!dataSource || !schema.objectName) {
        setObjectDefLoaded(true);
        return;
      }
      if (typeof dataSource.getObjectSchema !== 'function') {
        setObjectDefLoaded(true);
        return;
      }
      try {
        const def = await dataSource.getObjectSchema(schema.objectName);
        if (isMounted) {
          setObjectDef(def);
        }
      } catch (err) {
        console.warn("Failed to fetch object schema for ListView:", err);
      } finally {
        if (isMounted) {
          setObjectDefLoaded(true);
        }
      }
    };
    fetchObjectDef();
    return () => { isMounted = false; };
  }, [schema.objectName, dataSource]);

  // Auto-compute $expand fields from objectDef (lookup / master_detail).
  //
  // Important: include not only the user-declared `schema.columns` (table
  // columns) but also the runtime fields used by alternate view types
  // (kanban cardFields, calendar dateField, gallery coverField, etc.).
  // Otherwise a kanban whose card shows `account` would request
  // `?select=...,account,...` but never `populate=account`, so the server
  // returns the bare FK ID instead of the expanded record. This is why
  // list view shows "Initech Solutions" but kanban used to show
  // "8UY9zHWBfjYjYor4" for the same field.
  const expandFields = React.useMemo(() => {
    const baseColumns = Array.isArray(schema.columns)
      ? (schema.columns as any[])
          .map((f) => columnIdentity(f))
          .filter((v): v is string => typeof v === 'string' && v.length > 0)
      : [];
    const collected = new Set<string>(baseColumns);
    const collectViewFields = (v: any) => {
      if (!v) return;
      const candidates = [
        // Spec keys first, then the legacy objectui aliases (#2231).
        v.groupByField, v.groupField, v.groupBy,
        v.summarizeField,
        v.titleField, v.cardTitle,
        v.startDateField, v.endDateField, v.dateField, v.endField,
        v.colorField, v.allDayField,
        v.coverField, v.imageField,
        v.swimlaneField, v.valueField,
        // Spec `columns` = the fields shown on each kanban card (legacy: cardFields).
        ...(Array.isArray(v.columns) ? v.columns : []),
        ...(Array.isArray(v.cardFields) ? v.cardFields : []),
        ...(Array.isArray(v.visibleFields) ? v.visibleFields : []),
        ...(Array.isArray(v.metaFields) ? v.metaFields : []),
      ];
      for (const f of candidates) {
        if (typeof f === 'string' && f) collected.add(f);
      }
    };
    collectViewFields((schema as any).kanban);
    collectViewFields((schema as any).options?.kanban);
    collectViewFields((schema as any).calendar);
    collectViewFields((schema as any).options?.calendar);
    collectViewFields((schema as any).gallery);
    collectViewFields((schema as any).options?.gallery);
    collectViewFields((schema as any).timeline);
    collectViewFields((schema as any).options?.timeline);
    collectViewFields((schema as any).gantt);
    collectViewFields((schema as any).options?.gantt);
    const augmented = collected.size > 0 ? Array.from(collected) : undefined;
    return buildExpandFields(objectDef?.fields, augmented);
  }, [
    objectDef?.fields,
    schema.columns,
    (schema as any).kanban,
    (schema as any).calendar,
    (schema as any).gallery,
    (schema as any).timeline,
    (schema as any).gantt,
    (schema as any).options,
  ]);

  // Permissions context — must be read before the data-fetch effect so
  // the effect can FLS-gate the `$select` projection (preventing the
  // server from returning denied fields). Also feeds the column-list
  // gate further down the file.
  const perms = usePermissions();

  // A gantt view whose `data` names the api provider is fed by a composite
  // endpoint that ObjectGantt resolves itself (resolveDataSource →
  // ApiDataSource, reads AND write-backs). ListView must neither fetch
  // schema.objectName rows for it nor pass its `data` prop down — the prop
  // short-circuits the renderer's own fetch, so stale object rows would
  // replace the endpoint's tree.
  const ganttOwnsData =
    currentView === 'gantt' &&
    !!schema.data &&
    typeof schema.data === 'object' &&
    !Array.isArray(schema.data) &&
    (schema.data as any).provider === 'api';

  // Fetch data effect — supports schema.data (ViewDataSchema) provider modes
  React.useEffect(() => {
    let isMounted = true;
    const requestId = ++fetchRequestIdRef.current;

    // Check for inline data via schema.data provider: 'value'
    if (schema.data && typeof schema.data === 'object' && !Array.isArray(schema.data)) {
      const dataConfig = schema.data as any;
      if (dataConfig.provider === 'value' && Array.isArray(dataConfig.items)) {
        let items = dataConfig.items;
        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          items = items.filter((row: any) =>
            Object.values(row).some(
              (v) => v != null && String(v).toLowerCase().includes(q),
            ),
          );
        }
        setData(items);
        setLoading(false);
        setDataLimitReached(false);
        return;
      }
    }
    // Also support schema.data as a plain array (shorthand for value provider)
    if (Array.isArray(schema.data)) {
      let items = schema.data as any[];
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        items = items.filter((row: any) =>
          Object.values(row).some(
            (v) => v != null && String(v).toLowerCase().includes(q),
          ),
        );
      }
      setData(items);
      setLoading(false);
      setDataLimitReached(false);
      return;
    }

    // Renderer-owned data (gantt + api provider): the view component fetches
    // from its endpoint itself; just clear the loading state.
    if (ganttOwnsData) {
      setLoading(false);
      setDataLimitReached(false);
      return;
    }

    // Wait for objectDef to load before fetching data so that $expand is computed
    if (!objectDefLoaded) return;
    
    const fetchData = async () => {
      if (!dataSource || !schema.objectName) {
        // No way to fetch — clear the loading state so the empty state
        // (or downstream view) can render instead of an indefinite skeleton.
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setLoadError(null);
      try {
        // Construct filter — shared with the export path so the file a user
        // downloads is built from the same three sources as the rows on screen.
        const finalFilter = buildEffectiveFilter(schema.filter, currentFilters, userFilterConditions);

        // Convert sort to query format
        // Use array format to ensure order is preserved (Object keys are not guaranteed ordered)
        const sort: any = currentSort.length > 0
          ? currentSort
              .filter(item => item.field) // Ensure field is selected
              .map(item => ({ field: item.field, order: item.order }))
          : undefined;

        // Build a $select projection from the columns the listview actually
        // shows (plus required relational keys). This trims server payload
        // significantly for wide objects.
        //
        // FLS: also drop columns the current user cannot read. Sending a
        // denied field in $select would leak the value at the server
        // boundary even though the UI hides it — server-side trust must
        // never be defeated by what the client requests.
        const selectFields = (() => {
          const rawCols = Array.isArray(schema.columns)
            ? (schema.columns as any[])
                .map(f => columnIdentity(f))
                .filter((v): v is string => typeof v === 'string' && v.length > 0)
            : [];
          const cols = (perms?.isLoaded && schema.objectName)
            ? rawCols.filter(c => perms.checkField(schema.objectName!, c, 'read'))
            : rawCols;
          if (cols.length === 0) return undefined;
          // Don't speculatively add `_id` / `name` — some backends reject
          // unknown select keys with an empty result set rather than
          // ignoring them. Stick to the user-requested columns plus the
          // expanded relation roots (which we know are valid because
          // buildExpandFields() derived them from the object schema).
          const required = new Set<string>(['id']);
          for (const c of cols) required.add(c);
          for (const e of expandFields) required.add(e);

          // Real fields of the object, used to gate the SPECULATIVE
          // view-binding fields below. The comment above is the tell: "some
          // backends reject unknown select keys with an empty result set
          // rather than ignoring them" — the cloud multi-tenant runtime does
          // exactly that, so a single unknown column in $select silently
          // zeroes the whole list (an AI-built `product` view auto-requesting
          // `status`/`due_date`/`image` then looks like "no data exists").
          // The user-declared `cols` and `expandFields` are already
          // known-valid (perms.checkField / buildExpandFields derived them
          // from the schema); only the auto-included view-binding fields are
          // unsafe. When the object schema isn't loaded yet we can't
          // validate, so we keep the prior permissive behavior (the data
          // fetch waits for objectDefLoaded, so this is virtually never hit).
          const knownObjectFields = (() => {
            const f = objectDef?.fields;
            if (!f) return null;
            const names = Array.isArray(f)
              ? (f as any[]).map(x => x?.name).filter((n): n is string => typeof n === 'string')
              : Object.keys(f);
            const s = new Set<string>(names);
            s.add('id'); s.add('created_at'); s.add('updated_at');
            return s;
          })();
          const addSpeculative = (f: unknown) => {
            if (typeof f !== 'string' || !f) return;
            if (!knownObjectFields || knownObjectFields.has(f)) required.add(f);
          };
          // Predicate refs take the same guard, widened by the platform columns
          // every object carries but no object DECLARES (`owner_id` and the
          // audit FKs) — `record.owner_id == os.user.id` is the commonest
          // ownership gate there is, and `knownObjectFields` alone drops it.
          const addPredicateField = (f: string) => {
            if (PLATFORM_RECORD_COLUMNS.has(f)) required.add(f);
            else addSpeculative(f);
          };

          // View-specific runtime fields. Each non-grid view binds to one
          // or more record fields (groupBy for kanban, dates for calendar/
          // timeline/gantt, image/title for gallery). Without these in the
          // projection the view renders correctly-shaped records but with
          // blank values — e.g. a kanban grouped by `industry` puts every
          // card into the implicit "no value" column. Added via
          // addSpeculative so a binding naming a field this object lacks is
          // dropped instead of poisoning the query.
          const collectViewFields = (v: any) => {
            if (!v) return;
            const candidates = [
              // Spec keys first, then the legacy objectui aliases (#2231).
              v.groupByField, v.groupField, v.groupBy,
              v.summarizeField,
              v.titleField, v.cardTitle,
              v.startDateField, v.endDateField, v.dateField, v.endField,
              v.colorField, v.allDayField,
              v.coverField, v.imageField,
              v.swimlaneField, v.valueField,
              // Spec `columns` = the fields shown on each kanban card (legacy: cardFields).
              ...(Array.isArray(v.columns) ? v.columns : []),
              ...(Array.isArray(v.cardFields) ? v.cardFields : []),
              ...(Array.isArray(v.visibleFields) ? v.visibleFields : []),
              ...(Array.isArray(v.metaFields) ? v.metaFields : []),
            ];
            for (const f of candidates) addSpeculative(f);
          };
          collectViewFields(schema.kanban);
          collectViewFields(schema.options?.kanban);
          collectViewFields(schema.calendar);
          collectViewFields(schema.options?.calendar);
          collectViewFields(schema.gallery);
          collectViewFields(schema.options?.gallery);
          collectViewFields(schema.timeline);
          collectViewFields(schema.options?.timeline);
          // Timeline plugin shows status / priority chips inline. Auto-include
          // them when no explicit metaFields was configured so views like
          // `task_timeline` ({ columns: ['subject', 'status'] }) still get
          // priority badges out of the box. Gated through addSpeculative: only
          // added when the object actually has these fields (a `product` with
          // no status/priority must not get them, or the list goes empty).
          {
            const tCfg: any = schema.timeline ?? schema.options?.timeline;
            if (tCfg && !Array.isArray(tCfg.metaFields)) {
              addSpeculative('status');
              addSpeculative('priority');
            }
          }
          collectViewFields(schema.gantt);
          collectViewFields(schema.options?.gantt);

          // The fields the view's PREDICATES read (objectui#3501).
          // `$select` was built from the COLUMNS alone, so a row action gated on
          // `record.owner` while the view shows Title / Status asked the server
          // for everything except `owner` — and an absent key is a CEL FAULT
          // (`No such key`), not a null, which fail-closed hides the button for
          // everyone. Routed through addSpeculative for the same reason the view
          // bindings are: a typo'd predicate must not put an unknown column in
          // `$select` and zero the whole list.
          for (const f of collectPredicateFieldRefs(listViewPredicates({
            conditionalFormatting: schema.conditionalFormatting as unknown[] | undefined,
            rowActionDefs: (schema as any).rowActionDefs,
            bulkActionDefs: (schema as any).bulkActionDefs,
            objectActions: (objectDef as any)?.actions,
            userActions: (schema as any).userActions ?? (objectDef as any)?.userActions,
          }))) addPredicateField(f);

          return Array.from(required);
        })();

        // Only send $filter when there is one. Sending an empty array results in
        // `?filter=%5B%5D` which is wasted bandwidth and can defeat server-side
        // query parsing/caching. `buildEffectiveFilter` returns a non-empty AST
        // or `undefined`, so this is the whole test.
        const hasFilter = finalFilter !== undefined;

        // Window the request only for the flat grid view. Grouped grids and the
        // visual views (kanban/calendar/gantt/gallery) consume the whole batch,
        // so they keep their single-window fetch and in-memory handling.
        const paginate = currentView === 'grid' && !(groupingConfig?.fields?.length);
        const skip = paginate ? (serverPage - 1) * effectivePageSize : 0;

        const results = await dataSource.find(schema.objectName, {
           ...(hasFilter ? { $filter: finalFilter } : {}),
           $orderby: sort,
           $top: effectivePageSize,
           ...(skip > 0 ? { $skip: skip } : {}),
           ...(selectFields ? { $select: selectFields } : {}),
           ...(expandFields.length > 0 ? { $expand: expandFields } : {}),
           ...(searchTerm ? {
             $search: searchTerm,
             ...(schema.searchableFields && schema.searchableFields.length > 0
               ? { $searchFields: schema.searchableFields }
               : {}),
           } : {}),
        });

        // Stale request guard: only apply the latest request's results
        if (!isMounted || requestId !== fetchRequestIdRef.current) return;
        
        let items: any[] = [];
        if (Array.isArray(results)) {
            items = results;
        } else if (results && typeof results === 'object') {
           if (Array.isArray((results as any).data)) {
              items = (results as any).data; 
           } else if (Array.isArray((results as any).records)) {
              items = (results as any).records;
           } else if (Array.isArray((results as any).value)) {
              items = (results as any).value;
           }
        }
        
        setData(items);

        // Capture the real match total (framework #2212: findData now returns it).
        // With a known total the grid pages server-side, so the "showing first N"
        // cap warning no longer applies; without one we fall back to the old
        // single-window behaviour and keep the warning.
        const rawTotal = (results && typeof results === 'object')
          ? ((results as any).total ?? (results as any).count)
          : undefined;
        const knownTotal = typeof rawTotal === 'number' ? rawTotal : null;
        setServerTotal(paginate ? knownTotal : null);
        setDataLimitReached(
          !(paginate && knownTotal != null) && items.length >= effectivePageSize,
        );
      } catch (err) {
        // Only log + surface errors from the latest request. A failed fetch is
        // NOT an empty result — record it so the render shows an error panel
        // (with retry) rather than "Create your first record".
        if (requestId === fetchRequestIdRef.current) {
          console.error("ListView data fetch error:", err);
          setData([]);
          setLoadError((err as any)?.message ? String((err as any).message) : String(err ?? 'Unknown error'));
          setLoadErrorKind(classifyLoadError(err));
        }
      } finally {
        if (isMounted && requestId === fetchRequestIdRef.current) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => { isMounted = false; };
  }, [schema.objectName, schema.data, dataSource, schema.filter, effectivePageSize, currentSort, currentFilters, userFilterConditions, refreshKey, searchTerm, schema.searchableFields, expandFields, objectDefLoaded, schema.refreshTrigger, perms, serverPage, currentView, groupingConfig, ganttOwnsData]); // Re-fetch on filter/sort/search/refreshTrigger/perms/page change

  // Any change to the result-defining inputs (object, filters, sort, search,
  // grouping, page size) invalidates the current page number — snap back to
  // page 1 so the user never lands on a now-out-of-range window. We compare by
  // VALUE via a JSON signature (not effect deps): ListView re-initializes sort/
  // grouping references during mount, which would otherwise reset the page out
  // from under a user who just turned it. serverPage is deliberately NOT part of
  // the signature, so turning the page never triggers a reset.
  const pageResetSignature = JSON.stringify([
    schema.objectName, schema.filter, effectivePageSize, currentSort,
    currentFilters, userFilterConditions, searchTerm, currentView, groupingConfig,
  ]);
  const prevPageResetSignature = React.useRef(pageResetSignature);
  React.useEffect(() => {
    if (prevPageResetSignature.current !== pageResetSignature) {
      prevPageResetSignature.current = pageResetSignature;
      setServerPage(1);
    }
  }, [pageResetSignature]);

  // Available view types based on schema configuration
  const availableViews = React.useMemo(() => {
    // Capability-resolvable types: a visualization is only offered when its
    // required field bindings resolve (ADR-0047) — kanban needs a groupBy,
    // calendar a start date, etc. `grid` always renders.
    const resolvable: ViewType[] = ['grid'];

    // Check for Kanban capabilities (spec config takes precedence)
    if (schema.kanban?.groupByField || schema.kanban?.groupField || schema.options?.kanban?.groupField) {
      resolvable.push('kanban');
    }

    // Check for Gallery capabilities (spec config takes precedence)
    if (schema.gallery?.coverField || schema.gallery?.imageField || schema.options?.gallery?.imageField) {
      resolvable.push('gallery');
    }

    // Check for Calendar capabilities (spec config takes precedence)
    if (schema.calendar?.startDateField || schema.options?.calendar?.startDateField) {
      resolvable.push('calendar');
    }

    // Check for Timeline capabilities — the SAME resolution the render branch
    // buckets by, so the switcher can never offer a Timeline the renderer then
    // fails to bind (objectui#3129).
    if (resolveTimelineDateBinding(schema).startDateField) {
      resolvable.push('timeline');
    }

    // Check for Gantt capabilities (spec config takes precedence)
    if (schema.gantt?.startDateField || schema.options?.gantt?.startDateField) {
      resolvable.push('gantt');
    }

    // Check for Map capabilities
    if (schema.options?.map?.locationField || (schema.options?.map?.latitudeField && schema.options?.map?.longitudeField)) {
      resolvable.push('map');
    }

    // Check for Tree capabilities — a self-referencing parent pointer.
    if ((schema as any).tree?.parentField || schema.options?.tree?.parentField || schema.viewType === 'tree') {
      resolvable.push('tree');
    }

    // Always allow switching back to the viewType defined in schema
    if (schema.viewType && !resolvable.includes(schema.viewType as ViewType) &&
       ['grid', 'kanban', 'calendar', 'timeline', 'gantt', 'map', 'gallery', 'chart', 'tree'].includes(schema.viewType)) {
      resolvable.push(schema.viewType as ViewType);
    }

    // appearance.allowedVisualizations is the author whitelist (ADR-0047):
    // effective options = whitelist ∩ resolvable. Types whose bindings don't
    // resolve are hidden even when whitelisted — a kanban without a groupBy
    // field renders garbage, so it must not be offered.
    const whitelist = schema.appearance?.allowedVisualizations;
    if (Array.isArray(whitelist) && whitelist.length > 0) {
      const filtered = whitelist.filter((v: any) => resolvable.includes(v)) as ViewType[];
      return filtered.length > 0 ? filtered : (['grid'] as ViewType[]);
    }

    return resolvable;
  }, [schema.options, schema.viewType, schema.kanban, schema.calendar, schema.gantt, schema.gallery, schema.timeline, (schema as any).tree, schema.appearance?.allowedVisualizations]);

  // Sync view from props
  React.useEffect(() => {
     if (schema.viewType) {
        setCurrentView(schema.viewType as ViewType);
     }
  }, [schema.viewType]);

  // Load saved view preference (DISABLED: interfering with schema-defined views)
  /*
  React.useEffect(() => {
    try {
      const savedView = localStorage.getItem(storageKey);
      if (savedView && ['grid', 'kanban', 'calendar', 'timeline', 'gantt', 'map', 'gallery'].includes(savedView) && availableViews.includes(savedView as ViewType)) {
        setCurrentView(savedView as ViewType);
      }
    } catch (error) {
      console.warn('Failed to load view preference from localStorage:', error);
    }
  }, [storageKey, availableViews]);
  */

  const handleViewChange = React.useCallback((view: ViewType) => {
    setCurrentView(view);
    try {
      localStorage.setItem(storageKey, view);
    } catch (error) {
      console.warn('Failed to save view preference to localStorage:', error);
    }
    onViewChange?.(view);
  }, [storageKey, onViewChange]);

  const handleSearchChange = React.useCallback((value: string) => {
    setSearchTerm(value);
    onSearchChange?.(value);
  }, [onSearchChange]);

  // --- NavigationConfig support ---
  const navigation = useNavigationOverlay({
    navigation: schema.navigation,
    objectName: schema.objectName,
    onNavigate: schema.onNavigate,
    onRowClick,
  });

  // Heading of the record-detail overlay rendered at the bottom of this file.
  //
  // Keyed, not string-built (objectui#3426). This value is handed to
  // `NavigationOverlay`'s `title` prop, which means the overlay's own
  // `detail.recordDetail` default never applies here — whatever this computes
  // IS the visible heading of the drawer/modal/split/popover. Interpolating
  // the label through `detail.recordDetailWithLabel` instead of splicing it
  // into an English template lets each pack choose its own word order; the
  // no-label branch reuses the overlay's own key rather than a twin.
  //
  // English output is unchanged in all three branches (`Contacts Detail` /
  // `Contacts Detail` / `Record Detail`), including with no `I18nProvider`
  // mounted — `createSafeTranslation`'s fallback interpolates `{{label}}` from
  // `LIST_DEFAULT_TRANSLATIONS`.
  const detailTitle = schema.label
    ? t('detail.recordDetailWithLabel', { label: schema.label })
    : schema.objectName
      ? t('detail.recordDetailWithLabel', {
          label: schema.objectName.charAt(0).toUpperCase() + schema.objectName.slice(1),
        })
      : t('detail.recordDetail');

  // Field-level permission gate. Filter unreadable columns from the
  // field list BEFORE any downstream column construction so they also
  // disappear from the hide-fields popover, filter/sort builders, and
  // grid `$select`. (`perms` was hoisted to before the data-fetch
  // effect so $select can be gated server-side too.)
  // Apply hiddenFields and fieldOrder to produce effective fields
  const effectiveFields = React.useMemo(() => {
    // Defensive: `columns` is `string[] | ListColumn[]`, but metadata is
    // user-authored — anything non-array degrades to "no declared columns".
    let fields: any[] = Array.isArray(schema.columns) ? (schema.columns as any[]) : [];

    // FLS: drop columns the current user cannot read.
    if (perms?.isLoaded && schema.objectName) {
      fields = fields.filter((f: any) => {
        const fieldName = columnIdentity(f);
        if (!fieldName) return true;
        return perms.checkField(schema.objectName!, fieldName, 'read');
      });
    }

    // Remove hidden fields
    if (hiddenFields.size > 0) {
      fields = fields.filter((f: any) => {
        const fieldName = columnIdentity(f);
        return fieldName != null && !hiddenFields.has(fieldName);
      });
    }

    // Apply field order
    if (schema.fieldOrder && schema.fieldOrder.length > 0) {
      const orderMap = new Map<string, number>(schema.fieldOrder.map((f: any, i: number) => [f as string, i]));
      fields = [...fields].sort((a: any, b: any) => {
        const orderA: number = orderMap.get(columnIdentity(a) as string) ?? Infinity;
        const orderB: number = orderMap.get(columnIdentity(b) as string) ?? Infinity;
        return orderA - orderB;
      });
    }
    
    return fields;
  }, [schema.columns, schema.objectName, hiddenFields, schema.fieldOrder, perms]);

  // Generate the appropriate view component schema
  const viewComponentSchema = React.useMemo(() => {
    const densityRowHeight = density.mode === 'compact'
      ? 'compact'
      : density.mode === 'spacious'
        ? 'tall'
        : 'medium';
    const baseProps = {
      objectName: schema.objectName,
      fields: effectiveFields,
      // Spec-canonical `filter` (#2890). Every child view — ObjectGrid,
      // ObjectGallery, ObjectKanban, ObjectCalendar, ObjectGantt, ObjectMap,
      // ObjectTree, ObjectChart — reads `schema.filter`; ListView was the only
      // surface speaking `filters`, so a child that fetches its own rows (the
      // chart branch below, and any of these rendered standalone) never saw the
      // view's base filter at all.
      filter: schema.filter,
      sort: currentSort,
      className: "h-full w-full",
      // Disable internal controls that clash with ListView toolbar
      showSearch: false,
      // Pass navigation click handler to child views
      onRowClick: navigation.handleClick,
      // Forward density to child views (overrides schema.rowHeight at runtime)
      rowHeight: densityRowHeight,
      // Suppress child grid's own row-height toggle since ListView toolbar controls it
      hideRowHeightToggle: true,
      // Forward display properties to child views
      ...(schema.striped != null ? { striped: schema.striped } : {}),
      ...(schema.bordered != null ? { bordered: schema.bordered } : {}),
      // Forward column-state callback (resize/reorder) so a parent can
      // persist user adjustments alongside the view definition.
      ...(onColumnStateChange ? { onColumnStateChange } : {}),
      // Hydrate child grid with previously persisted column state.
      ...(schema.columnState ? { columnState: schema.columnState } : {}),
    };

    switch (currentView) {
      // `default` deliberately shares the grid branch: an unrecognized
      // viewType must degrade to a working table, never to a typeless schema
      // (SchemaRenderer shows those as a red "Unknown component type" box).
      default:
      case 'grid':
        return {
          type: 'object-grid',
          ...baseProps,
          columns: effectiveFields,
          ...(schema.conditionalFormatting ? { conditionalFormatting: schema.conditionalFormatting } : {}),
          editable: inlineEdit,
          ...(schema.wrapHeaders != null ? { wrapHeaders: schema.wrapHeaders } : {}),
          ...(schema.virtualScroll != null ? { virtualScroll: schema.virtualScroll } : {}),
          ...(schema.resizable != null ? { resizable: schema.resizable } : {}),
          ...(schema.selection ? { selection: schema.selection } : {}),
          ...(schema.pagination ? { pagination: schema.pagination } : {}),
          ...(groupingConfig ? { grouping: groupingConfig } : {}),
          ...(rowColorConfig ? { rowColor: rowColorConfig } : {}),
          ...(schema.rowActions ? { rowActions: schema.rowActions } : {}),
          ...((schema as any).rowActionDefs ? { rowActionDefs: (schema as any).rowActionDefs } : {}),
          ...(schema.bulkActions ? { batchActions: schema.bulkActions } : {}),
          ...((schema as any).bulkActionDefs ? { bulkActionDefs: (schema as any).bulkActionDefs } : {}),
          ...(schema.options?.grid || {}),
        };
      case 'kanban': {
        // The spec's lane field is `groupByField`; `groupField` is the legacy
        // objectui alias. Read the canonical key FIRST — reading only the alias
        // meant a spec-authored config (what CreateViewDialog emits) passed the
        // capability gate above but rendered lanes from the detector instead.
        // ADR-0085: with neither key set, fall back to the object's declared
        // lifecycle (`stageField`, incl. strict-false suppression) via the shared
        // detector — mirrors ObjectView's default so both entry paths agree.
        // objectDef loads async: until it lands this stays undefined and the board
        // re-derives lanes once it does.
        const kanbanCfg = { ...(schema.options?.kanban || {}), ...(schema.kanban || {}) };
        // `columns` is the spec's list of fields shown on each card. ObjectKanban's
        // own `columns` prop is its LANES, so passing this through verbatim built
        // lanes with undefined id/title. Map it to `cardFields` and strip the
        // vocabulary keys from the passthrough (mirrors plugin-view's adapter).
        const { columns: kanbanCardColumns, groupByField, groupField, cardFields, titleField, ...restKanban } = kanbanCfg as Record<string, any>;
        const laneField = groupByField || groupField || detectStatusField(objectDef) || undefined;
        return {
          type: 'object-kanban',
          ...baseProps,
          groupBy: laneField,
          groupField: laneField,
          ...(titleField ? { titleField } : {}),
          cardFields: cardFields || kanbanCardColumns || effectiveFields || [],
          ...(groupingConfig ? { grouping: groupingConfig } : {}),
          ...restKanban,
        };
      }
      case 'calendar':
        return {
          type: 'object-calendar',
          ...baseProps,
          startDateField: schema.calendar?.startDateField || schema.options?.calendar?.startDateField || 'start_date',
          endDateField: schema.calendar?.endDateField || schema.options?.calendar?.endDateField || 'end_date',
          ...(schema.calendar?.titleField || schema.options?.calendar?.titleField
            ? { titleField: schema.calendar?.titleField || schema.options?.calendar?.titleField }
            : {}),
          ...(schema.calendar?.defaultView ? { defaultView: schema.calendar.defaultView } : {}),
          ...(schema.options?.calendar || {}),
          ...(schema.calendar || {}),
        };
      case 'gallery': {
        // Merge spec config over legacy options into nested gallery prop
        const mergedGallery = {
          ...(schema.options?.gallery || {}),
          ...(schema.gallery || {}),
          // User's runtime override from the toolbar density button wins
          // over schema defaults. Persisted to localStorage in ListView.
          cardSize: galleryCardSize,
        };
        return {
          type: 'object-gallery',
          ...baseProps,
          // Nested gallery config (spec-compliant, used by ObjectGallery)
          gallery: Object.keys(mergedGallery).length > 0 ? mergedGallery : undefined,
          // Deprecated top-level props for backward compat
          imageField: schema.gallery?.coverField || schema.gallery?.imageField || schema.options?.gallery?.imageField,
          titleField: schema.gallery?.titleField || schema.options?.gallery?.titleField || 'name',
          ...(groupingConfig ? { grouping: groupingConfig } : {}),
        };
      }
      case 'timeline': {
        // Merge spec config over legacy options into nested timeline prop
        const mergedTimeline = {
          ...(schema.options?.timeline || {}),
          ...(schema.timeline || {}),
        };
        // The one resolution the capability gate above also uses (objectui#3129).
        const dateBinding = resolveTimelineDateBinding(schema);
        // The resolved axis has to appear on the NESTED config too, not just on
        // the flat prop: `ObjectTimeline` prefers `timeline.startDateField` over
        // `schema.startDateField`, so a timeline config object that exists but
        // carries no date key (app-shell emits one for every object view) would
        // otherwise mask a binding resolved from elsewhere.
        const resolvedTimeline = {
          ...mergedTimeline,
          ...(dateBinding.startDateField ? { startDateField: dateBinding.startDateField } : {}),
          ...(dateBinding.endDateField ? { endDateField: dateBinding.endDateField } : {}),
        };
        return {
          type: 'object-timeline',
          ...baseProps,
          // Nested timeline config (spec-compliant, used by ObjectTimeline)
          timeline: Object.keys(resolvedTimeline).length > 0 ? resolvedTimeline : undefined,
          // Deprecated top-level props for backward compat. `created_at` stays
          // the last resort for a view that declares no date axis anywhere.
          startDateField: dateBinding.startDateField || 'created_at',
          titleField: dateBinding.titleField || 'name',
          ...(dateBinding.endDateField ? { endDateField: dateBinding.endDateField } : {}),
          ...(schema.timeline?.groupByField ? { groupByField: schema.timeline.groupByField } : {}),
          ...(schema.timeline?.colorField ? { colorField: schema.timeline.colorField } : {}),
          ...(schema.timeline?.scale ? { scale: schema.timeline.scale } : {}),
        };
      }
      case 'gantt':
        return {
          type: 'object-gantt',
          ...baseProps,
          // ViewData pass-through: a view authored with `data: {provider:'api',
          // read, write}` (composite endpoint) must reach ObjectGantt, whose
          // getDataConfig prefers schema.data over the objectName fallback.
          ...(schema.data ? { data: schema.data } : {}),
          startDateField: schema.gantt?.startDateField || schema.options?.gantt?.startDateField || 'start_date',
          endDateField: schema.gantt?.endDateField || schema.options?.gantt?.endDateField || 'end_date',
          progressField: schema.gantt?.progressField || schema.options?.gantt?.progressField || 'progress',
          dependenciesField: schema.gantt?.dependenciesField || schema.options?.gantt?.dependenciesField || 'dependencies',
          ...(schema.gantt?.titleField ? { titleField: schema.gantt.titleField } : {}),
          ...(schema.options?.gantt || {}),
          ...(schema.gantt || {}),
        };
      case 'map':
        return {
          type: 'object-map',
          ...baseProps,
          locationField: schema.options?.map?.locationField || 'location',
          ...(schema.options?.map || {}),
        };
      case 'tree': {
        // Self-referencing tree-grid. Config lives under view.tree.* (direct)
        // or options.tree.* (app-shell object pages). parentField auto-detects
        // from the object's tree/self-reference field when omitted.
        const treeCfg = (schema as any).tree || schema.options?.tree || {};
        return {
          type: 'object-tree',
          ...baseProps,
          parentField: treeCfg.parentField,
          labelField: treeCfg.labelField || treeCfg.titleField || 'name',
          fields: treeCfg.fields || effectiveFields,
          defaultExpandedDepth: treeCfg.defaultExpandedDepth,
          ...treeCfg,
        };
      }
      case 'chart': {
        // A `chart` list view renders an aggregated chart of the object's
        // records (e.g. sum of estimate_hours grouped by status), delegating
        // to the same object-chart component the dashboard uses.
        const chartCfg = (schema as any).chart || schema.options?.chart || {};
        // ADR-0021 (#1890): the single author-facing shape binds to a semantic
        // `dataset` and selects dimensions/measures BY NAME, so the chart runs
        // through the governed queryDataset path (numbers consistent everywhere).
        if (chartCfg.dataset) {
          const dims: string[] = Array.isArray(chartCfg.dimensions) ? chartCfg.dimensions : [];
          const vals: string[] = Array.isArray(chartCfg.values) ? chartCfg.values : [];
          return {
            type: 'object-chart',
            dataset: chartCfg.dataset,
            dimensions: dims,
            values: vals,
            chartType: chartCfg.chartType || 'bar',
            xAxisKey: dims[0],
            series: vals.map((v: string) => ({ dataKey: v, label: v })),
            className: 'h-[400px] w-full',
          };
        }
        // Legacy inline aggregate (deprecated — pre-ADR-0021 metadata). Kept as a
        // fallback so existing authored chart views keep rendering.
        const valueField = (Array.isArray(chartCfg.yAxisFields) && chartCfg.yAxisFields[0])
          || chartCfg.valueField || 'value';
        const categoryField = chartCfg.xAxisField || chartCfg.categoryField || 'name';
        return {
          type: 'object-chart',
          objectName: schema.objectName,
          chartType: chartCfg.chartType || 'bar',
          // `ObjectChart` reads `schema.filter` and never read `filters`, so a
          // chart list view with a base filter used to aggregate the WHOLE
          // object (#2890).
          filter: schema.filter,
          aggregate: {
            field: valueField,
            function: chartCfg.aggregation || 'count',
            groupBy: categoryField,
          },
          xAxisKey: categoryField,
          series: [{ dataKey: valueField, label: valueField }],
          className: 'h-[400px] w-full',
        };
      }
    }
  // objectDef is in the deps because the kanban default lane field derives
  // from it (ADR-0085 stageField) and it loads async — without it the board
  // would keep the null-def result forever.
  }, [currentView, schema, currentSort, effectiveFields, groupingConfig, rowColorConfig, navigation.handleClick, density.mode, galleryCardSize, inlineEdit, objectDef]);

  const hasFilters = currentFilters.conditions && currentFilters.conditions.length > 0;

  /**
   * Every field this view can name, before any per-builder rule narrows it.
   *
   * Was `filterFields` — the whitelist used to be applied inside this memo, so
   * `filterableFields` was the ONLY base set either builder could see, and the
   * sort picker inherited a whitelist authored for filtering (objectui#4243).
   * The two narrowings now sit downstream of it, one per builder.
   */
  const candidateFields = React.useMemo(() => {
    let fields: Array<{ value: string; label: string; type: string; options?: any; referenceTo?: string; displayField?: string; idField?: string }>;

    // Translate select-field option labels through the i18n resolver.
    // fieldDef.options may be an array of { value, label } or a keyed object;
    // we normalize to array form so FilterBuilder's value-pickers show
    // localized option labels (e.g. 网站 instead of "Web").
    const buildOptions = (key: string, raw: any): any[] | undefined => {
      if (!raw) return undefined;
      const arr: Array<{ value: any; label: string; [k: string]: any }> = Array.isArray(raw)
        ? raw.map((o: any) => ({
            value: o?.value ?? o,
            label: o?.label ?? String(o?.value ?? o),
            ...(o && typeof o === 'object' ? o : {}),
          }))
        : Object.entries(raw as Record<string, any>).map(([value, meta]) => ({
            value,
            label: (meta as any)?.label || value,
            ...(meta as any),
          }));
      return schema.objectName ? translateOptions(schema.objectName, key, arr) : arr;
    };

    if (!objectDef?.fields) {
        // Fallback to the declared columns if objectDef not loaded yet
        fields = (Array.isArray(schema.columns) ? (schema.columns as any[]) : [])
          .flatMap((f: any) => {
           if (typeof f === 'string') return [{ value: f, label: f, type: 'text' }];
           // A column with no resolvable identity cannot be filtered or sorted
           // on — it used to become an option keyed `undefined`. Drop it.
           const fieldName = columnIdentity(f);
           if (!fieldName) return [];
           return [{
              value: fieldName,
              // The label falls back to the identity, not to the raw `name`:
              // after #3104 a legacy `name` mirrors the identity anyway, and
              // reading it here would resurrect the second spelling.
              label: tFieldLabel(fieldName, f.label || fieldName),
              type: f.type || 'text',
              options: buildOptions(fieldName, f.options),
              referenceTo: f.reference_to || f.reference,
              displayField: f.display_field || f.reference_field,
              idField: f.id_field,
           }];
        });
    } else {
        fields = Object.entries(objectDef.fields).map(([key, field]: [string, any]) => ({
            value: key,
            label: tFieldLabel(key, field.label || key),
            type: field.type || 'text',
            options: buildOptions(key, field.options),
            referenceTo: field.reference_to || field.reference,
            displayField: field.display_field || field.reference_field,
            idField: field.id_field,
        }));
    }

    return fields;
  }, [objectDef, schema.columns, schema.objectName, tFieldLabel, translateOptions]);

  /**
   * The FILTER builder's candidates: the view's `filterableFields` whitelist,
   * applied to the full set. Behaviour is unchanged by objectui#4243 — the
   * whitelist simply moved out of the shared memo into the one builder it was
   * authored for, so widening the SORT picker cannot widen this.
   */
  const filterFields = React.useMemo(() => {
    if (!schema.filterableFields || schema.filterableFields.length === 0) return candidateFields;
    const allowed = new Set(schema.filterableFields);
    return candidateFields.filter(f => allowed.has(f.value));
  }, [candidateFields, schema.filterableFields]);

  // Sort candidates: ALL fields the view can name, minus the ones the sort
  // cannot honestly reach (objectui#4243 — previously ⊂ filter candidates).
  //
  // The base set used to be `filterFields`, so `filterableFields` doubled as
  // the sort whitelist: a field meant to be sortable but not offered as a
  // filter condition could not be expressed, and a view was free to DECLARE a
  // sort on a field this picker then refused to list — the declared sort
  // worked on load, while its rows rendered blank and the user could neither
  // reproduce nor modify it. The whitelist is a FILTER contract; sortability
  // is a property of the field's type, which is what the two rules below read.
  //

  // This view's sort becomes a server `$orderby` on the FLAT field name, and a
  // relational field stores a foreign-key id — so "sort by Owner" orders the
  // whole collection by `rec_7f3…` while the column shows names. It reads as
  // "sorting is broken", with nothing saying the key is something else. The
  // server cannot sort by the related record's name without a join
  // (objectstack#4256 settled that it won't), so the honest move is to stop
  // offering the illusion: relational fields leave the picker, and the hint
  // below points at the supported alternative (a formula field that
  // denormalizes the name onto this object, which sorts like any text column).
  //
  // Second rule — {@link UNSORTABLE_FIELD_TYPES}: a `formula` field has no
  // materialised column, so the server answers a sort naming one with a 400.
  // It matters here precisely BECAUSE the base set widened: a formula field
  // used to reach this picker only if someone had whitelisted it, and now
  // every formula field on the object would be offered. Withheld silently —
  // the relational hint below stays strictly about relations, which is what
  // its sentence describes.
  //
  // Exception (both rules): a field the CURRENT sort already uses stays listed
  // — relational ones flagged as ordering by ID — so opening this popover on a
  // view that was authored (or saved before this change) with such a sort
  // neither renders a blank row nor silently drops that sort on the next edit.
  // For a formula field that exception is the only way to REMOVE the offending
  // row, since the sort it names is one the server refuses outright.
  const { sortFields, sortHasRelationalField } = React.useMemo(() => {
    const inUse = new Set(currentSort.map((item) => item.field).filter(Boolean));
    let excluded = false;
    const fields: Array<{ value: string; label: string }> = [];
    for (const field of candidateFields) {
      const relational = EXPANDABLE_FIELD_TYPES.has(field.type);
      if (!relational && !UNSORTABLE_FIELD_TYPES.has(field.type)) {
        fields.push({ value: field.value, label: field.label });
        continue;
      }
      if (inUse.has(field.value)) {
        fields.push({
          value: field.value,
          label: relational ? `${field.label} ${t('list.sortByIdSuffix')}` : field.label,
        });
        continue;
      }
      if (relational) excluded = true;
    }
    return { sortFields: fields, sortHasRelationalField: excluded };
  }, [candidateFields, currentSort, t]);

  /**
   * A column-header sort from the child grid (#3106).
   *
   * It lands in `currentSort` — the same state the toolbar's sort builder
   * writes — so it becomes a server `$orderby` over the whole collection and
   * the two controls can never disagree about what the list is sorted by. The
   * table hands back `{field, order}`; `SortItem` carries an `id` for the
   * builder's React keys, so one is minted here exactly as `parseSortConfig`
   * does when reading a view's declared sort.
   *
   * The page goes back to 1: a new order makes "page 5" a different set of
   * rows, and staying there would show a slice of an ordering the user has not
   * seen the start of. `onSortChange` fires so a host persists this the same
   * way it persists a builder edit — a header sort is not a lesser sort.
   */
  const handleHeaderSort = React.useCallback((next: Array<{ field: string; order: 'asc' | 'desc' }>) => {
    const items: SortItem[] = next.map((s) => ({
      id: crypto.randomUUID(),
      field: s.field,
      order: s.order,
    }));
    setCurrentSort(items);
    setServerPage(1);
    onSortChange?.(items);
  }, [onSortChange]);

  /**
   * "Reset to the view's default sort" (objectui#4243) — the way back the
   * header click above does not leave.
   *
   * It restores the declared array WHOLE: multi-level, in declared order.
   * Clearing the sort would not put the view back, and rebuilding it by hand
   * is what the card reports as impossible. Deliberately the SIBLING of
   * `handleHeaderSort`, not a special case of it — same `currentSort`, same
   * page reset (a different order makes "page 5" a different set of rows), and
   * the same `onSortChange` notification, so a host persists a reset exactly
   * as it persists a header click or a builder edit.
   *
   * The header click's own semantics are untouched by this: it still replaces
   * the whole array. The ruling adds a way back; it does not change the click.
   */
  const handleResetSort = React.useCallback(() => {
    const restored = parseSortConfig(schema.sort);
    setCurrentSort(restored);
    setServerPage(1);
    onSortChange?.(restored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaSortKey, onSortChange]);

  // Export handler
  const handleExport = React.useCallback((format: 'csv' | 'xlsx' | 'json' | 'pdf') => {
    // Object-level export permission gate. Default-allow.
    if (!exportPermitted) return;
    const exportConfig = resolvedExportOptions;
    const maxRecords = exportConfig?.maxRecords || 0;
    const includeHeaders = exportConfig?.includeHeaders !== false;
    // Download filename: `<配置前缀|对象中文标签|API名>-<视图名>-<日期时间>.<ext>`,
    // e.g. `合同-进行中-20260714-153045.xlsx`. The translated object label
    // (client i18n override → server-translated objectDef.label) beats the raw
    // API name; a configured exportOptions.fileNamePrefix beats both (and
    // suppresses the view label).
    const translatedLabel = objectDef?.label && objectDef?.name && typeof resolveObjectLabel === 'function'
      ? resolveObjectLabel(objectDef)
      : objectDef?.label;
    const fileNameFor = (ext: string) => buildExportFileName(ext, {
      prefix: exportConfig?.fileNamePrefix,
      label: translatedLabel,
      objectName: schema.objectName,
      viewLabel: schema.label || (schema as any).title,
    });

    // Server-streamed path: csv / xlsx / json via dataSource.exportDownload.
    // XLSX is server-only; type-aware value formatting, field resolution and
    // permission enforcement all happen server-side. Mirrors the active view's
    // filter + SEARCH + sort so the exported file matches what the user sees.
    //
    // The search half was missing, and this comment asserted the match anyway:
    // exporting during a search downloaded the unsearched superset. The client
    // fallback below was always right (it serializes `data`, already searched);
    // only this path was wrong, and it is the one that handles xlsx.
    const serverEligible = (format === 'csv' || format === 'xlsx' || format === 'json')
      && typeof dataSource?.exportDownload === 'function'
      && !!schema.objectName
      && (exportConfig as any)?.streaming !== false;
    if (serverEligible) {
      const fields = effectiveFields
        .map((f: any) => columnIdentity(f))
        .filter(Boolean) as string[];

      // The same three filter sources as the data fetch, from the same function.
      const finalFilter = buildEffectiveFilter(schema.filter, currentFilters, userFilterConditions);

      const sort = currentSort.length > 0
        ? currentSort
            .filter(item => item.field)
            .map(item => ({ field: item.field, direction: item.order as 'asc' | 'desc' }))
        : undefined;

      setExportError(null);
      setExportBusy(true);
      void (async () => {
        try {
          const blob = await dataSource!.exportDownload!(schema.objectName!, {
            format: format as 'csv' | 'xlsx' | 'json',
            fields: fields.length ? fields : undefined,
            filter: finalFilter,
            // The other half of what the list is showing. Without it an export
            // taken during a search returned the UNSEARCHED superset — more rows
            // than the screen, in a file that looks authoritative. Needs a server
            // with objectstack#4230; older ones ignore it and behave as before.
            ...(searchTerm ? {
              search: searchTerm,
              ...(schema.searchableFields && schema.searchableFields.length > 0
                ? { searchFields: schema.searchableFields }
                : {}),
            } : {}),
            sort,
            includeHeaders,
            limit: maxRecords > 0 ? maxRecords : undefined,
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileNameFor(format);
          a.rel = 'noopener';
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          setShowExport(false);
        } catch (err) {
          // Surface the failure instead of swallowing it (e.g. permission denied
          // or a server error) — the toolbar shows the message.
          console.error('ListView export failed:', err);
          setExportError(err instanceof Error ? err.message : String(err));
        } finally {
          setExportBusy(false);
        }
      })();
      return;
    }

    // Client-side fallback (csv / json only).
    const exportData = maxRecords > 0 ? data.slice(0, maxRecords) : data;

    if (format === 'csv') {
      const fields = effectiveFields.map((f: any) => columnIdentity(f)).filter(Boolean) as string[];
      const rows: string[] = [];
      if (includeHeaders) {
        rows.push(fields.join(','));
      }
      exportData.forEach(record => {
        rows.push(fields.map((f: string) => {
          const val = record[f];
          // Type-safe serialization: handle arrays, objects, null/undefined
          let str: string;
          if (val == null) {
            str = '';
          } else if (Array.isArray(val)) {
            str = val.map(v =>
              (v != null && typeof v === 'object') ? JSON.stringify(v) : String(v ?? ''),
            ).join('; ');
          } else if (typeof val === 'object') {
            str = JSON.stringify(val);
          } else {
            str = String(val);
          }
          // Escape CSV special characters
          const needsQuoting = str.includes(',') || str.includes('"')
            || str.includes('\n') || str.includes('\r');
          return needsQuoting ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(','));
      });
      const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileNameFor('csv');
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'json') {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileNameFor('json');
      a.click();
      URL.revokeObjectURL(url);
    }
    setShowExport(false);
    // `searchTerm` / `searchableFields` belong here: the export now narrows by
    // the active search, so a stale closure would export the wrong row set.
  }, [data, effectiveFields, resolvedExportOptions, schema.objectName, schema.filter, schema.searchableFields, exportPermitted, dataSource, currentFilters, userFilterConditions, currentSort, searchTerm, objectDef, resolveObjectLabel]);

  // All available fields for hide/show (with i18n)
  const allFields = React.useMemo(() => {
    return (Array.isArray(schema.columns) ? (schema.columns as any[]) : []).flatMap((f: any) => {
      if (typeof f === 'string') {
        return [{ name: f, label: tFieldLabel(f, f) }];
      }
      // `name` here is this popover's OWN key (it drives `hiddenFields`), which
      // is why it keeps that shape — but the value is the column identity, so
      // hiding a column and projecting it now agree (#3104).
      const name = columnIdentity(f);
      // No resolvable identity → nothing to hide or show; it used to render a
      // checkbox keyed `undefined` that could never match a column.
      if (!name) return [];
      return [{ name, label: tFieldLabel(name, f.label || name) }];
    });
  }, [schema.columns, tFieldLabel]);

  return (
    <div
      ref={pullRef}
      className={cn('flex flex-col h-full bg-background relative min-w-0 overflow-hidden', className)}
      {...(schema.aria?.ariaLabel ? { 'aria-label': schema.aria.ariaLabel as string } : {})}
      {...(schema.aria?.ariaDescribedBy ? { 'aria-describedby': schema.aria.ariaDescribedBy } : {})}
      {...(schema.aria?.live ? { 'aria-live': schema.aria.live } : {})}
      role={schema.aria?.role ?? 'region'}
      aria-busy={loading || undefined}
      data-state={loading ? 'loading' : 'idle'}
    >
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center text-xs text-muted-foreground"
          style={{ height: pullDistance }}
        >
          {isRefreshing ? t('list.refreshing') : t('list.pullToRefresh')}
        </div>
      )}
      {/* View Description (single line, no border duplication) */}
      {schema.description && (schema.appearance?.showDescription !== false) && (
        <div className="px-4 pt-1.5 text-xs text-muted-foreground bg-background" data-testid="view-description">
          {typeof schema.description === 'string' ? schema.description : ''}
        </div>
      )}

      {/* Unified toolbar — Tabs + UserFilters (left) + Tool buttons (right) on one row.
          The right-hand cluster is wrapped in a single rounded pill container
          with vertical dividers (Linear / Notion style) so utility buttons
          read as one segmented control rather than a loose bag of icons. */}
      <div className="border-b px-2 sm:px-4 py-1.5 flex items-center justify-between gap-1 sm:gap-2 bg-background">
        <div className="flex items-center gap-2 overflow-x-auto min-w-0">
          {/* User Filters — filter elements (dropdown chips / preset tabs /
              toggles). Mutually exclusive with view tabs above, so at most
              one filter element group ever renders here. On mobile we keep
              them visible (single line, scrollable) to match the Airtable
              Interface pattern. */}
          {filterElements && (
              <div className="shrink-0 min-w-0 overflow-x-auto" data-testid="user-filters">
                <UserFilters
                  config={filterElements}
                  objectDef={objectDef}
                  data={data}
                  onFilterChange={setUserFilterConditions}
                  maxVisible={3}
                  initialSelections={userFilterSelections}
                  onSelectionsChange={onUserFilterSelectionsChange}
                />
              </div>
          )}
        </div>

        <div className="flex items-center gap-0 shrink-0 rounded-lg border border-border bg-muted/40 p-0.5 shadow-sm">
          {/* Visualization switcher — compact dropdown (Airtable-style
              "List ▾"), first slot of the right tool cluster so the whole
              toolbar stays a single row. */}
          {showViewSwitcher && (
            <>
              <ViewSwitcherDropdown
                currentView={currentView}
                availableViews={availableViews}
                onViewChange={handleViewChange}
              />
              <div className="h-4 w-px bg-border/60 mx-0.5" />
            </>
          )}
          {/* Inline edit — toggle record editing for this (grid) view. Persists
              `inlineEdit` on the view via onInlineEditChange. */}
          {currentView === 'grid' && onInlineEditChange && !toolbarFlags.compactToolbar && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateInlineEdit(!inlineEdit)}
              className={cn(
                "hidden sm:inline-flex h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150",
                inlineEdit && "text-primary"
              )}
              title={t('list.inlineEditLabel', { defaultValue: 'Edit records inline (click a cell to edit)' })}
              data-testid="toolbar-inline-edit-toggle"
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">{t('list.inlineEditShort', { defaultValue: 'Edit inline' })}</span>
            </Button>
          )}
          {/* Hide Fields — hidden on mobile (collapsed into ViewSettingsPopover) */}
          {toolbarFlags.showHideFields && !toolbarFlags.compactToolbar && (
          <Popover open={showHideFields} onOpenChange={setShowHideFields}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "hidden sm:inline-flex h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150",
                  hiddenFields.size > 0 && "text-primary"
                )}
              >
                <EyeOff className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">{t('list.hideFields')}</span>
                {hiddenFields.size > 0 && (
                  <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center text-[10px] font-medium text-muted-foreground tabular-nums">
                    {hiddenFields.size}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-medium text-sm">{t('list.hideFieldsTitle')}</h4>
                  {hiddenFields.size > 0 && (
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => updateHiddenFields(new Set())}>
                      {t('list.showAll')}
                    </Button>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {allFields.map((field: any) => (
                    <label key={field.name} className="flex items-center gap-2 text-sm py-1 px-1 rounded hover:bg-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!hiddenFields.has(field.name)}
                        onChange={() => {
                          const next = new Set(hiddenFields);
                          if (next.has(field.name)) {
                            next.delete(field.name);
                          } else {
                            next.add(field.name);
                          }
                          updateHiddenFields(next);
                        }}
                        className="rounded border-input"
                      />
                      <span className="truncate">{field.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          )}

          {/* --- Separator: Hide Fields | Data Manipulation --- */}
          {toolbarFlags.showHideFields && !toolbarFlags.compactToolbar && (toolbarFlags.showFilters || toolbarFlags.showSort || toolbarFlags.showGroup) && (
            <div className="hidden sm:block h-5 w-px bg-border/50 mx-1 shrink-0" />
          )}

          {/* Filter — universal advanced filter builder.
              Always shown when enabled. The left-side quick-filter chips
              (filterElements) are predefined named filters; the
              right-side Popover is a free-form field-by-field builder that
              can express filters the chips cannot. They serve different
              purposes and must coexist. */}
          {toolbarFlags.showFilters && (
          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150",
                  hasFilters && "text-foreground font-medium"
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">{t('list.filter')}</span>
                {hasFilters && (
                  <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center text-[10px] font-medium text-muted-foreground tabular-nums">
                    {currentFilters.conditions?.length || 0}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[calc(100vw-2rem)] sm:w-[600px] max-w-[600px] p-3 sm:p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-medium text-sm">{t('list.filterRecords')}</h4>
                </div>
                <FilterBuilder
                  fields={filterFields}
                  value={currentFilters}
                  onChange={(newFilters) => {
                    setCurrentFilters(newFilters);
                    if (onFilterChange) onFilterChange(newFilters);
                  }}
                />
              </div>
            </PopoverContent>
          </Popover>
          )}

          {/* Group — hidden on mobile (collapsed into ViewSettingsPopover) */}
          {toolbarFlags.showGroup && !toolbarFlags.compactToolbar && (
          <Popover open={showGroupPopover} onOpenChange={setShowGroupPopover}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "hidden sm:inline-flex h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150",
                  groupingConfig && "text-foreground font-medium"
                )}
              >
                <Group className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">{t('list.group')}</span>
                {groupingConfig && groupingConfig.fields?.length > 0 && (
                  <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center text-[10px] font-medium text-muted-foreground tabular-nums">
                    {groupingConfig.fields.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-medium text-sm">{t('list.groupBy')}</h4>
                  {groupingConfig && (
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setGroupingConfig(undefined)} data-testid="clear-grouping">
                      {t('list.clear')}
                    </Button>
                  )}
                </div>
                <div data-testid="group-field-list">
                  <GroupingEditor
                    value={groupingConfig as any}
                    fieldOptions={allFields.map((f: any) => ({ value: f.name, label: f.label || f.name }))}
                    maxLevels={3}
                    labels={{
                      addGroup: t('list.addGroup', { defaultValue: 'Add group field' }),
                      collapseTitle: t('list.collapsedByDefault', { defaultValue: 'Collapsed by default' }),
                      removeTitle: t('list.removeGroup', { defaultValue: 'Remove' }),
                    }}
                    onChange={(next) => setGroupingConfig(next as any)}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
          )}

          {/* Sort — desktop only. Mobile relies on the (typically pre-sorted)
              default view; users who need ad-hoc sorting switch to desktop. */}
          {toolbarFlags.showSort && (
          <Popover open={showSort} onOpenChange={setShowSort}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "hidden sm:inline-flex h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150",
                  currentSort.length > 0 && "text-foreground font-medium"
                )}
              >
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">{t('list.sort')}</span>
                {currentSort.length > 0 && (
                  <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center text-[10px] font-medium text-muted-foreground tabular-nums">
                    {currentSort.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[calc(100vw-2rem)] sm:w-[600px] max-w-[600px] p-3 sm:p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-medium text-sm">{t('list.sortRecords')}</h4>
                  {/* Reset to the view's declared sort (objectui#4243).
                      Rendered only when the view DECLARES one: with nothing
                      declared there is no default to return to, and a control
                      under this label that merely cleared the sort would be a
                      second, differently-named way to do what removing the
                      rows already does. Disabled — not hidden — while the
                      active sort already equals the declared one, so the
                      affordance stays discoverable and says "you are at the
                      default" instead of vanishing. */}
                  {declaredSort.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-primary"
                      disabled={!sortDiffersFromDeclared}
                      onClick={handleResetSort}
                      data-testid="sort-reset-default"
                    >
                      {t('list.resetSortToDefault')}
                    </Button>
                  )}
                </div>
                <SortBuilder
                  fields={sortFields}
                  value={currentSort}
                  onChange={(newSort) => {
                    setCurrentSort(newSort);
                    if (onSortChange) onSortChange(newSort);
                  }}
                />
                {sortHasRelationalField && (
                  <p className="text-xs text-muted-foreground" data-testid="sort-relational-hint">
                    {t('list.sortRelationalHint')}
                  </p>
                )}
              </div>
            </PopoverContent>
          </Popover>
          )}

          {/* --- Separator: Data Manipulation | Appearance --- */}
          {!toolbarFlags.compactToolbar && (toolbarFlags.showFilters || toolbarFlags.showSort || toolbarFlags.showGroup) && (toolbarFlags.showColor || toolbarFlags.showDensity) && (
            <div className="hidden sm:block h-5 w-px bg-border/50 mx-1 shrink-0" />
          )}

          {/* Color — hidden on mobile (collapsed into ViewSettingsPopover) */}
          {toolbarFlags.showColor && !toolbarFlags.compactToolbar && (
          <Popover open={showColorPopover} onOpenChange={setShowColorPopover}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "hidden sm:inline-flex h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150",
                  rowColorConfig && "text-foreground font-medium"
                )}
              >
                <Paintbrush className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">{t('list.color')}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-medium text-sm">{t('list.rowColor')}</h4>
                  {rowColorConfig && (
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setRowColorConfig(undefined)} data-testid="clear-row-color">
                      {t('list.clear')}
                    </Button>
                  )}
                </div>
                <div className="space-y-2" data-testid="color-field-list">
                  <label className="text-xs text-muted-foreground">{t('list.colorByField')}</label>
                  <select
                    className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
                    value={rowColorConfig?.field || ''}
                    onChange={(e) => {
                      const field = e.target.value;
                      if (!field) {
                        setRowColorConfig(undefined);
                      } else {
                        setRowColorConfig({ field, colors: rowColorConfig?.colors || {} });
                      }
                    }}
                    data-testid="color-field-select"
                  >
                    <option value="">{t('list.none')}</option>
                    {allFields.map((field: any) => (
                      <option key={field.name} value={field.name}>{field.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          )}

          {/* Row Height / Density Mode — table-style density (rowHeight) */}
          {toolbarFlags.showDensity && !toolbarFlags.compactToolbar && currentView !== 'gallery' && (() => {
            const DensityIcon = density.mode === 'compact' ? Rows4 : density.mode === 'comfortable' ? Rows3 : Rows2;
            const modeLabel =
              density.mode === 'compact'
                ? t('grid.toolbar.densityCompact', { defaultValue: 'Compact' })
                : density.mode === 'comfortable'
                  ? t('grid.toolbar.densityComfortable', { defaultValue: 'Comfortable' })
                  : t('grid.toolbar.densitySpacious', { defaultValue: 'Spacious' });
            const densityLabel = t('grid.toolbar.densityMode', { defaultValue: 'Density' });
            const ariaLabel = `${densityLabel}: ${modeLabel}`;
            const titleLabel = t('grid.toolbar.densityCycleHint', {
              defaultValue: '{{label}} (click to cycle)',
              label: ariaLabel,
            });
            return (
              <Button
                variant="ghost"
                size="sm"
                aria-label={ariaLabel}
                className={cn(
                  "hidden sm:inline-flex h-7 w-7 p-0 text-muted-foreground hover:text-primary transition-colors duration-150",
                  density.mode !== 'compact' && "text-foreground font-medium"
                )}
                onClick={density.cycle}
                title={titleLabel}
              >
                <DensityIcon className="h-3.5 w-3.5" />
              </Button>
            );
          })()}

          {/* Gallery card density — same toolbar slot, only when gallery view is active */}
          {toolbarFlags.showDensity && !toolbarFlags.compactToolbar && currentView === 'gallery' && (() => {
            const GalleryDensityIcon = galleryCardSize === 'small' ? Rows4 : galleryCardSize === 'medium' ? Rows3 : Rows2;
            const modeLabel =
              galleryCardSize === 'small'
                ? t('grid.toolbar.densityCompact', { defaultValue: 'Compact' })
                : galleryCardSize === 'medium'
                  ? t('grid.toolbar.densityComfortable', { defaultValue: 'Comfortable' })
                  : t('grid.toolbar.densitySpacious', { defaultValue: 'Spacious' });
            const densityLabel = t('grid.toolbar.densityMode', { defaultValue: 'Density' });
            const ariaLabel = `${densityLabel}: ${modeLabel}`;
            const titleLabel = t('grid.toolbar.densityCycleHint', {
              defaultValue: '{{label}} (click to cycle)',
              label: ariaLabel,
            });
            return (
              <Button
                variant="ghost"
                size="sm"
                aria-label={ariaLabel}
                className={cn(
                  "hidden sm:inline-flex h-7 w-7 p-0 text-muted-foreground hover:text-primary transition-colors duration-150",
                  galleryCardSize !== 'small' && "text-foreground font-medium",
                )}
                onClick={cycleGalleryDensity}
                title={titleLabel}
              >
                <GalleryDensityIcon className="h-3.5 w-3.5" />
              </Button>
            );
          })()}

          {/* (Removed) Previously a mobile-only ViewSettingsPopover gear was
              rendered here to expose HideFields / Group / Color / Density on
              phones. Those controls are essentially no-ops on a single-column
              mobile layout, so on mobile we now drop the gear entirely. The
              same controls remain available on desktop via the individual
              buttons above, and on tablet via the existing compactToolbar
              gear below. */}

          {/* Compact View Settings popover (P1-4): bundles Group + Color + Density + Hide Fields
              into a single gear button when schema.compactToolbar is enabled. */}
          {toolbarFlags.compactToolbar && (
            toolbarFlags.showGroup || toolbarFlags.showColor || toolbarFlags.showDensity || toolbarFlags.showHideFields
          ) && (
            <ViewSettingsPopover
              t={t as any}
              allFields={allFields as any}
              showGroup={toolbarFlags.showGroup}
              groupingConfig={groupingConfig}
              setGroupingConfig={setGroupingConfig}
              showColor={toolbarFlags.showColor}
              rowColorConfig={rowColorConfig}
              setRowColorConfig={setRowColorConfig}
              showDensity={toolbarFlags.showDensity}
              density={density as any}
              showHideFields={toolbarFlags.showHideFields}
              hiddenFields={hiddenFields}
              updateHiddenFields={updateHiddenFields}
              showInlineEdit={currentView === 'grid'}
              inlineEdit={inlineEdit}
              setInlineEdit={updateInlineEdit}
            />
          )}

          {/* --- Separator: Appearance | Export --- */}
          {(toolbarFlags.showColor || toolbarFlags.showDensity || toolbarFlags.compactToolbar) && resolvedExportOptions && exportPermitted && exportableFormats.length > 0 && (
            <div className="h-5 w-px bg-border/50 mx-1 shrink-0" />
          )}

          {/* Refresh — re-fetch the current view from the backend without a full page
              reload. Filters / sort / pagination / search all live in component state,
              so bumping refreshKey re-queries while preserving the view. Always visible
              (mobile + desktop) since reloading data is a primary list action. */}
          {toolbarFlags.showRefresh && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary transition-colors duration-150"
              onClick={() => setRefreshKey(k => k + 1)}
              disabled={loading}
              title={t('list.refresh')}
              aria-label={t('list.refresh')}
              data-testid="refresh-button"
            >
              <RotateCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </Button>
          )}

          {/* Export */}
          {resolvedExportOptions && exportPermitted && exportableFormats.length > 0 && (
            <Popover open={showExport} onOpenChange={setShowExport}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  <span className="hidden sm:inline">{t('list.export')}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-48 p-2">
                <div className="space-y-1">
                  {exportableFormats.map((format: any) => (
                    <Button
                      key={format}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start h-8 text-xs"
                      disabled={exportBusy}
                      onClick={() => handleExport(format)}
                    >
                      {exportBusy
                        ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                        : <Download className="h-3.5 w-3.5 mr-2" />}
                      {t('list.exportAs', { format: format.toUpperCase() })}
                    </Button>
                  ))}
                  {exportError && (
                    <div
                      className="px-2 py-1 text-xs"
                      style={{ color: 'var(--destructive, #ef4444)' }}
                      role="alert"
                    >
                      {exportError}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Share — supports both ObjectUI visibility model and spec personal/collaborative model */}
          {schema.sharing?.type && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150"
              title={`Sharing: ${schema.sharing.type}`}
              data-testid="share-button"
            >
              <Share2 className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">{t('list.share')}</span>
            </Button>
          )}

          {/* Print */}
          {schema.allowPrinting && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150"
              onClick={() => window.print()}
              data-testid="print-button"
            >
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">{t('list.print')}</span>
            </Button>
          )}

          {/* --- Separator: Print/Share/Export | Search --- */}
          {(() => {
            const hasLeftSideItems = schema.allowPrinting || !!schema.sharing?.type || (resolvedExportOptions && exportPermitted && exportableFormats.length > 0);
            return toolbarFlags.showSearch && hasLeftSideItems ? (
              <div className="h-5 w-px bg-border/50 mx-1 shrink-0" />
            ) : null;
          })()}

          {/* Search (icon button + popover) — desktop only. The global
              top-bar search (⌘K) is already prominent on mobile, so an
              additional list-scoped search popover would be redundant chrome.
              Filter remains the primary way to narrow data on phones. */}
          {toolbarFlags.showSearch && (
            <Popover open={showSearchPopover} onOpenChange={setShowSearchPopover}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "hidden sm:inline-flex h-7 text-muted-foreground hover:text-primary text-xs transition-colors duration-150",
                    searchTerm ? "px-2 text-foreground font-medium" : "w-7 p-0"
                  )}
                  data-testid="search-icon-button"
                  title={searchTerm ? `${t('list.search')}: ${searchTerm}` : t('list.search')}
                >
                  <Search className="h-3.5 w-3.5" />
                  {/* Persisted keyword restored from storage keeps filtering after
                      navigation while the popover starts closed — surface it on the
                      trigger so the active search is visible without opening it. */}
                  {searchTerm && (
                    <span
                      className="ml-1.5 max-w-[8rem] truncate text-[11px]"
                      data-testid="search-active-keyword"
                    >
                      {searchTerm}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[calc(100vw-2rem)] sm:w-64 p-2" data-testid="search-popover">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder={t('table.search')}
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-7 h-8 text-xs"
                    autoFocus
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-0.5 top-1/2 -translate-y-1/2 h-5 w-5 p-0 hover:bg-muted-foreground/20"
                      onClick={() => handleSearchChange('')}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Add Record (top position) */}
          {toolbarFlags.showAddRecordTop && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150"
              data-testid="add-record-button"
              onClick={() => props.onAddRecord?.()}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">{t('list.addRecord')}</span>
            </Button>
          )}
        </div>
      </div>


      {/* Filters Panel - Removed as it is now in Popover */}

      {/* View Content */}
      <div key={currentView} className="flex-1 min-h-0 bg-background relative overflow-hidden animate-in fade-in-0 duration-200">
        {/* Re-fetch indicator: thin top progress bar shown when refreshing
            existing data (filter/sort/search change). Skipped during the
            initial load — the full skeleton below handles that case. */}
        <RefreshIndicator active={loading && data.length > 0} />
        {/* Empty state is rendered here ONLY for tabular/list-like views.
            Structural views (kanban/calendar/gallery/gantt/timeline/map) own
            their own empty rendering so their column/lane/grid structure
            stays visible — otherwise users see a generic "No items found"
            on Task Board / Calendar etc. even though the view exists. */}
        {/* Loading state — shown when fetching with no data yet. Rendered at
            the ListView level so every inner view (grid/kanban/calendar/...)
            gets a consistent indicator instead of momentarily showing an
            empty state on slow networks. */}
        {loadError && data.length === 0 ? (
          <DataEmptyState
            data-testid="list-error-state"
            data-error-kind={loadErrorKind}
            className="h-full min-h-[200px] p-8 gap-1 [&>h3]:text-lg [&>h3]:font-medium [&>h3]:text-foreground [&>p]:max-w-md"
            icon={loadErrorKind === 'network'
              ? <AlertTriangle className="h-12 w-12 text-destructive/60" />
              : <ShieldAlert className="h-12 w-12 text-destructive/60" />}
            iconWrapperClassName="mb-3"
            title={t(
              loadErrorKind === 'forbidden' ? 'list.loadErrorForbiddenTitle'
                : loadErrorKind === 'unauthorized' ? 'list.loadErrorUnauthorizedTitle'
                  : loadErrorKind === 'rejected' ? 'list.loadErrorRejectedTitle'
                    : 'list.loadErrorTitle',
            )}
            description={t(
              loadErrorKind === 'forbidden' ? 'list.loadErrorForbiddenMessage'
                : loadErrorKind === 'unauthorized' ? 'list.loadErrorUnauthorizedMessage'
                  : loadErrorKind === 'rejected' ? 'list.loadErrorRejectedMessage'
                    : 'list.loadErrorMessage',
            )}
            action={(
              <Button
                variant="outline"
                size="sm"
                data-testid="list-error-retry"
                onClick={() => setRefreshKey((k) => k + 1)}
              >
                <RotateCw className="h-4 w-4 mr-1.5" />
                {t('list.retry')}
              </Button>
            )}
          />
        ) : loading && data.length === 0 ? (
          <div
            className="flex flex-col h-full min-h-[200px] p-4 gap-2"
            data-testid="list-loading"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <span className="sr-only">{t('list.loading')}</span>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-9 rounded bg-muted/60 animate-pulse"
                style={{ opacity: Math.max(0.25, 1 - i * 0.12) }}
              />
            ))}
          </div>
        ) : !loading && data.length === 0 && currentView === 'grid' ? (
          (() => {
            const iconName = schema.emptyState?.icon;
            const ResolvedIcon: LucideIcon = iconName
              ? ((icons as Record<string, LucideIcon>)[
                  iconName.split('-').map((w: any) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
                ] ?? Inbox)
              : Inbox;
            // Distinguish "filtered/searched to empty" from "truly empty
            // (first run)". A new user with no filters shouldn't be told to
            // "adjust your filters" — they should be invited to create.
            //
            // The VIEW's own `filter` counts as an active query too
            // (objectui#4155). It used to be excluded, so a view that returns
            // nothing *because it is filtered* — the declared `status not_in
            // [archived]`, or a stale stored condition — rendered the first-run
            // copy ("no data yet / create your first record") over an object
            // full of records. That reads as data loss or a permission problem
            // and sends triage away from the view layer, which is exactly what
            // this issue reported.
            const hasBaseFilter =
              Array.isArray(schema.filter)
                ? schema.filter.length > 0
                : !!schema.filter && typeof schema.filter === 'object'
                  ? Object.keys(schema.filter).length > 0
                  : false;
            const hasActiveQuery =
              !!(searchTerm && searchTerm.trim()) ||
              hasBaseFilter ||
              (Array.isArray(userFilterConditions) && userFilterConditions.length > 0) ||
              (Array.isArray(currentFilters?.conditions) && currentFilters.conditions.length > 0);
            const title = (typeof schema.emptyState?.title === 'string' ? schema.emptyState.title : undefined)
              ?? (hasActiveQuery ? t('list.noMatches') : t('list.firstRunTitle'));
            const description = (typeof schema.emptyState?.message === 'string' ? schema.emptyState.message : undefined)
              ?? (hasActiveQuery ? t('list.noMatchesMessage') : t('list.firstRunMessage'));
            return (
              <DataEmptyState
                data-testid="empty-state"
                className="h-full min-h-[200px] p-8 gap-1 [&>h3]:text-lg [&>h3]:font-medium [&>h3]:text-foreground [&>p]:max-w-md"
                icon={<ResolvedIcon className="h-12 w-12 text-muted-foreground/50" />}
                iconWrapperClassName="mb-3"
                title={title}
                description={description}
                action={toolbarFlags.showAddRecord ? (
                  <Button
                    variant="default"
                    size="sm"
                    data-testid="empty-state-add-record"
                    onClick={() => props.onAddRecord?.()}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    {t('list.addRecord')}
                  </Button>
                ) : undefined}
              />
            );
          })()
        ) : (
          <SchemaRenderer
            schema={viewComponentSchema}
            {...props}
            {...(ganttOwnsData ? {} : { data })}
            loading={loading}
            onRowSelect={setSelectedRows}
            {...(currentView === 'grid' && !(groupingConfig?.fields?.length) && serverTotal != null
              ? {
                  // Drive the flat grid's single (DataTable) pager from the
                  // server: it renders THIS window as the current page, the real
                  // total sets the page count, and turning the page asks ListView
                  // to refetch the next window. One pager, server-backed (#2212).
                  manualPagination: true,
                  rowCount: serverTotal,
                  page: serverPage,
                  pageSize: effectivePageSize,
                  onPageChange: (p: number) => setServerPage(p),
                  onPageSizeChange: (n: number) => { setDynamicPageSize(n); setServerPage(1); },
                  // …and its sort from the same place (#3106). The column
                  // headers and the toolbar's sort builder are two controls over
                  // ONE `currentSort`, so a header click is a shortcut into the
                  // builder rather than a second, page-local sort with its own
                  // rules. That is what makes "priority of a header sort vs. the
                  // saved view's sort" a non-question: there is one sort.
                  sort: currentSort,
                  onSortChange: handleHeaderSort,
                }
              : {})}
          />
        )}
      </div>

      {/* Add Record (bottom position) */}
      {toolbarFlags.showAddRecordBottom && (
        <div className="border-t px-2 sm:px-4 py-1 bg-background shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150"
            data-testid="add-record-button"
            onClick={() => props.onAddRecord?.()}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">{t('list.addRecord')}</span>
          </Button>
        </div>
      )}

      {/* Bulk Actions Bar — skip for grid view since ObjectGrid renders its own BulkActionBar */}
      {permittedBulkActions && permittedBulkActions.length > 0 && selectedRows.length > 0 && currentView !== 'grid' && (
        <div
          className="border-t border-primary/30 px-4 py-2 flex items-center gap-2 text-xs bg-primary/10 text-foreground shrink-0 shadow-sm"
          role="region"
          aria-label="Bulk actions"
          data-testid="bulk-actions-bar"
        >
          <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="font-medium">
            {selectedRows.length} {selectedRows.length === 1 ? 'item' : 'items'} selected
          </span>
          <div className="flex items-center gap-1.5 ml-3">
            {permittedBulkActions.map((action: any) => {
              const actionStr = String(action).toLowerCase();
              const isDestructive = actionStr.includes('delete') || actionStr.includes('remove') || actionStr.includes('destroy');
              const Icon = isDestructive ? Trash2 : null;
              return (
                <Button
                  key={action}
                  variant={isDestructive ? 'destructive' : 'outline'}
                  size="sm"
                  className="h-7 px-2.5 text-xs gap-1.5"
                  onClick={() => props.onBulkAction?.(action, selectedRows)}
                  data-testid={`bulk-action-${action}`}
                >
                  {Icon && <Icon className="h-3 w-3" />}
                  {tActionLabel(action)}
                </Button>
              );
            })}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs ml-auto gap-1"
            onClick={() => setSelectedRows([])}
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        </div>
      )}

      {/* Record count status bar (Airtable-style) */}
      {!loading && data.length > 0 && schema.showRecordCount !== false && (
        <div
          className="border-t px-4 py-2 flex items-center gap-3 text-xs text-muted-foreground bg-background shrink-0"
          data-testid="record-count-bar"
        >
          <span className="font-medium text-foreground/80">
            {/* Under server pagination `data` is only the current page, so the
                honest record count is the server's grand total (#586). When the
                whole result set is in memory, serverTotal is null and data.length
                already IS the total. */}
            {(() => {
              const totalCount = serverTotal ?? data.length;
              return totalCount === 1
                ? t('list.recordCountOne', { count: totalCount })
                : t('list.recordCount', { count: totalCount });
            })()}
          </span>
          {dataLimitReached && (
            <span className="text-amber-600" data-testid="data-limit-warning">
              {t('list.dataLimitReached', { limit: effectivePageSize })}
            </span>
          )}
          {/* Grid view delegates the rows-per-page selector to the DataTable's
              own server-driven pager (ObjectGrid passes pagination.pageSizeOptions
              straight through). Rendering a second native <select> here produced a
              duplicate control, so for grid we suppress it and only keep this
              fallback selector for pager-less views (gallery/kanban/calendar). */}
          {currentView !== 'grid' && schema.pagination?.pageSizeOptions && schema.pagination.pageSizeOptions.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <span>{t('table.rowsPerPage', { defaultValue: 'Rows per page' })}</span>
              <select
                data-testid="page-size-selector"
                className="h-7 w-[72px] px-2 py-1 text-xs rounded-md border border-input bg-background"
                value={String(effectivePageSize)}
                onChange={(e) => {
                  const newSize = Number(e.target.value);
                  setDynamicPageSize(newSize);
                  if (props.onPageSizeChange) props.onPageSizeChange(newSize);
                }}
              >
                {schema.pagination.pageSizeOptions.map((size: any) => (
                  <option key={size} value={String(size)}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Navigation Overlay (drawer/modal/popover) */}
      {navigation.isOverlay && (
        <NavigationOverlay
          {...navigation}
          title={detailTitle}
        >
          {(record) => (
            <div className="space-y-3">
              {Object.entries(record).map(([key, value]) => (
                <div key={key} className="flex flex-col">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm">{String(value ?? '—')}</span>
                </div>
              ))}
            </div>
          )}
        </NavigationOverlay>
      )}
    </div>
  );
});

ListView.displayName = 'ListView';