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
import { VALUELESS_FILTER_BUILDER_OPERATORS, isFilterValueComplete } from '@object-ui/components';
import { ViewSwitcherDropdown, ViewType } from './ViewSwitcher';
import { ViewSettingsPopover } from './components/ViewSettingsPopover';
import { UserFilters } from './UserFilters';
import { SchemaRenderer, useNavigationOverlay, classifyLoadError, usePredicateScope } from '@object-ui/react';
import type { LoadErrorKind } from '@object-ui/react';
import { useDensityMode } from '@object-ui/react';
import type { ListViewSchema, ObjectMapConfig } from '@object-ui/types';
import { detectStatusField } from '@object-ui/types';
import { usePullToRefresh } from '@object-ui/mobile';
import { resolveConditionalFormatting, buildExpandFields, buildExportFileName, resolveEffectiveCrudAffordances, isObjectInlineEditable, partitionRowsByPredicate, normalizeListViewSchema, rowHeightToDensityMode, mergeFilterNodes, columnIdentity, collectPredicateFieldRefs, collectGroupingFieldRefs, listViewPredicates, PLATFORM_RECORD_COLUMNS, EXPANDABLE_FIELD_TYPES, UNMATERIALIZED_FIELD_TYPES, readObjectSortability, isPlatformSortableField, filterPlatformSortableSort } from '@object-ui/core';
import { useObjectTranslation, useObjectLabel, useSafeFieldLabel, createSafeTranslation, useDisplayLocale, pickLocalized } from '@object-ui/i18n';
// Two resolvers, two vocabularies — the repo spells the distinction into the
// NAMES (objectui#4167). `resolveInlineI18nLabel` is the spec's own
// `resolveI18nLabel`: it resolves the INLINE per-locale map
// (`{ en: …, 'zh-CN': … }`) that `@objectstack/spec` 17.0.0-rc.6 folded into
// `I18nLabel`, which is what the nested `aria` bag carries. It does NOT accept
// objectui's keyed `{ key, defaultValue, params }` ref — that vocabulary lives
// on the FLAT `schema.ariaLabel` and is resolved by `SchemaRenderer` instead
// (objectui#5134).
import { resolveI18nLabel as resolveInlineI18nLabel } from '@objectstack/spec/ui';
import { usePermissions } from '@object-ui/permissions';

/**
 * The `case 'map'` branch below builds an `object-map` schema by flattening
 * `schema.options.map`'s CONTENTS to the top level. Whitelisted to these keys —
 * `ObjectMapConfigSchema`'s shape minus `style` — rather than the whole bag:
 * `style` is ALSO `BaseSchema.style` (inline CSS, legal on every node), and
 * spreading the raw `map` block collapsed the two namespaces onto one key
 * (objectui#5177).
 *
 * HAND-LISTED, not derived at runtime — deliberately, and only here (`plugin-
 * map`'s own `FLAT_MAP_CONFIG_KEYS` in `ObjectMap.tsx` DOES derive from
 * `ObjectMapConfigSchema.shape`, and should stay that way): this file is
 * reachable from `examples/console-starter`'s own `src/`, so it is part of the
 * import graph `vite-alias-closure.test.ts` walks. That walker resolves a bare
 * `@object-ui/*` specifier with plain `index.<ext>` conventions and cannot find
 * `@object-ui/types/zod`'s actual barrel file (`zod/index.zod.ts` — a
 * non-standard name) — a REAL runtime import of it here reproducibly fails
 * that gate (measured on objectui#5177's first PR, PR #5231, CI run
 * 32160288416), even though Vite's own alias table already resolves the
 * specifier correctly (`examples/console-starter/vite.config.ts` has carried
 * an explicit `@object-ui/types/zod` entry since PR #5156). `ObjectMap.tsx`
 * gets away with the runtime import only because nothing in
 * console-starter's graph reaches `@object-ui/plugin-map` today.
 *
 * Anti-drift is a TEST, not this comment: `ListView.mapFlatten.test.tsx` pins
 * this exact list against `ObjectMapConfigSchema.shape` — imported only from
 * that TEST file, which the alias-closure walker explicitly excludes from
 * traversal — so a key added to or removed from the declaration still fails
 * here, loudly and by name, without reintroducing the runtime edge that
 * breaks the walker.
 */
export const FLAT_MAP_CONFIG_KEYS = [
  'latitudeField',
  'longitudeField',
  'locationField',
  'titleField',
  'descriptionField',
  'zoom',
  'center',
] as const satisfies readonly (keyof Omit<ObjectMapConfig, 'style'>)[];

/** Pick only the declared flat map keys present on an authored `map` block. */
function pickFlatMapConfig(mapConfig: unknown): Record<string, unknown> {
  if (!mapConfig || typeof mapConfig !== 'object') return {};
  const source = mapConfig as Record<string, unknown>;
  return Object.fromEntries(FLAT_MAP_CONFIG_KEYS.filter((key) => key in source).map((key) => [key, source[key]]));
}

/**
 * The effective map configuration for a list view: the spec's VIEW-LEVEL `map`
 * block merged OVER the legacy `options.map` bag, per key.
 *
 * `map` is `ListMapConfigSchema` (objectstack#9340, consumable here since the
 * `@objectstack/spec` 17.1.0 pin) — a strict, seven-key block that flows into
 * this package's own `ListViewSchema` by reference (it is not in
 * `LIST_VIEW_LOCAL_OVERRIDES`, so `specFieldsExcept` imports it). It was
 * authorable and validated but never read: `case 'map'` forwarded only
 * `schema.options?.map`, so declaring it changed nothing at runtime
 * (objectui#5042).
 *
 * PRECEDENCE — the view-level block wins, per key. Both halves of that are the
 * convention already set by every sibling visualization in this file, not a new
 * rule: `kanban`, `calendar`, `gallery`, `timeline` and `gantt` each spread
 * `schema.options?.<kind>` FIRST and `schema.<kind>` LAST, which is a per-key
 * override in the view-level block's favour. (`tree` and `chart` also put the
 * view-level block first, but with `||` — whole-block replacement rather than a
 * merge. The direction is unanimous across all seven; only the granularity
 * differs, and this follows the five that merge, which are also the five that
 * flatten config into props the way the map branch does.)
 *
 * Both sides go through the same whitelist, so the typed block cannot
 * reintroduce the `style` namespace collision that objectui#5177 closed.
 *
 * NOT a second validation of the seven keys — that reading belongs to
 * `getMapConfig` in `ObjectMap.tsx` and stays there (objectui#5018). This is
 * the whitelist-flatten that already existed, applied to one more source.
 */
function resolveListMapConfig(schema: { map?: unknown; options?: { map?: unknown } }): Record<string, unknown> {
  return {
    ...pickFlatMapConfig(schema.options?.map),
    ...pickFlatMapConfig(schema.map),
  };
}

/**
 * The list view's props.
 *
 * ## Why there is no `[key: string]: any` here (objectui#4528)
 *
 * There used to be one, and it erased this entire interface. A string index
 * signature puts `string` into `keyof Props`, so `'ref' extends keyof Props` is
 * always true and React's `PropsWithoutRef` takes its `Omit` branch — and
 * `Omit` over a type carrying a string index signature keeps ONLY the index
 * signature. Every declared property below was dropped from the resolved type.
 * Measured on the pre-fix source:
 * `keyof React.ComponentProps< typeof ListView >` was `string | number`, and
 * `React.ComponentProps< typeof ListView >['onRowClick']` was `any`, while this
 * interface went on declaring `(record: Record< string, unknown >) => void`.
 *
 * The same trap, in `packages/components`, is objectui#4422 / PR #4438; this is
 * the sweep of the two packages that issue left unswept.
 *
 * ## The props that were only ever reachable through it
 *
 * `ListView` reads several props it never declared, because the index signature
 * was answering for them — `dataSource`, `onAddRecord`, `onBulkAction`,
 * `onPageSizeChange` are read directly, and `onEdit` / `onDelete` /
 * `onBulkDelete` ride the `{...props}` forward into the active view component
 * (`ObjectGrid` declares all three). They are declared by name below, at the
 * type each one actually lands on, rather than left to an index signature that
 * types them `any` and erases everything around them.
 */
export interface ListViewProps {
  schema: ListViewSchema;
  className?: string;
  /**
   * Data-source adapter. Read directly (`dataSource.find`,
   * `dataSource.getObjectSchema`, `dataSource.onMutation`) and forwarded to the
   * active view component. Typed `any` deliberately: that is what it resolved
   * to before objectui#4528, so declaring it changes what is DECLARED without
   * changing what any call site is held to. Narrowing it to a real adapter type
   * is a separate change with its own consumer sweep.
   */
  dataSource?: any;
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
  /** Called when the user asks for a new record (toolbar "+ New" and the empty-state CTA). */
  onAddRecord?: () => void;
  /** Called with a non-delete bulk action key and the currently selected rows. */
  onBulkAction?: (action: string, records: any[]) => void;
  /** Called when the user picks a different page size in the pager. */
  onPageSizeChange?: (pageSize: number) => void;
  /**
   * Row-level affordances forwarded to the active view component. `ObjectGrid`
   * declares all three with exactly these signatures; they are named here so the
   * hosts that pass them (`ObjectView`, `StudioDesignSurface`) are held to a
   * contract instead of to an index signature.
   */
  onEdit?: (record: any) => void;
  onDelete?: (record: any) => void;
  onBulkDelete?: (records: any[]) => void;
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
    // Canonical in `VIEW_FILTER_OPERATORS` as of @objectstack/spec 17.1.0
    // (objectui#5328), and an explicit arm rather than a `default` fall-through
    // even though the emitted spelling is identical: `icontains` is its own
    // member of `VALID_AST_OPERATORS`, so the raw passthrough happens to be
    // accepted today, and relying on that is the exact slack this file's own
    // header records as how it stopped discriminating in #3641.
    case 'icontains': return 'icontains';
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

/**
 * Opt-in `FilterBuilder` operators the list toolbar offers — deliberately NONE
 * (objectui#4736).
 *
 * `OPT_IN_OPERATORS` in `@object-ui/components` withholds the operator ids that
 * only the MongoDB-style criteria dialect can carry. This toolbar persists into
 * the other two, and into BOTH of them at once:
 *
 *   - the array/triplet filter AST, via `mapOperator` above, for the live grid;
 *   - `ViewFilterRule[]`, via app-shell's `foldFilterGroupToSpecRules`, when the
 *     user saves the panel's group as a view.
 *
 * Neither vocabulary has a case-insensitive contains or an existence operator,
 * so this surface opts into nothing. Named and passed explicitly rather than
 * omitted at the call site: this constant is the handle
 * `list-offered-operator-expressible-parity.test.ts` reads to compute what the
 * toolbar actually offers, and an inline `extraOperators` added later would
 * otherwise widen the dropdown without the parity test noticing.
 *
 * @internal exported for that test
 */
export const LIST_VIEW_EXTRA_OPERATORS: readonly string[] = [];

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

/**
 * Format an action identifier string into a human-readable label.
 * e.g., 'send_email' → 'Send Email'
 */
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
      // A value-less OPERATOR is complete without a value — the builder draws
      // no value input for it, so "no value" is the row's finished state
      // (objectui#4744). Read from `@object-ui/components`, which is the thing
      // that decides it; the two-operator literal that used to stand here
      // listed `isEmpty`/`isNotEmpty` only, so a fresh `Is null` row — seeded
      // `value: ''` by `addCondition`, and left that way because the operator
      // dropdown preserves `value` — was dropped as unfinished. The grid then
      // applied NO filter while the panel showed one.
      if (VALUELESS_FILTER_BUILDER_OPERATORS.has(c.operator)) return true;
      // Skip incomplete rows (no value entered yet). Emitting `[field, op, '']`
      // would be a silently-wrong filter (matches only empty) rather than
      // "no filter", excluding all rows. Matches groupToCondition in
      // datasetFilterCondition.ts (#1964).
      //
      // Read from `@object-ui/components` rather than spelled out here
      // (objectstack#8815): the local predicate this replaces was blind to the
      // operator's ARITY, so a `between` row with one bound typed
      // (`["2024-01-01", ""]` — an array of length 2) counted as complete and
      // this function emitted a range with an empty end. The server refuses
      // that outright (`400 INVALID_FILTER`) and the whole view fails to load,
      // so the row the user half-filled took down the rows they had already
      // filtered. The builder decides when one of its rows is finished; this
      // asks it.
      return isFilterValueComplete(c.operator, c.value);
    })
    .map(c => {
      if (c.operator === 'isEmpty') return [c.field, '=', null];
      if (c.operator === 'isNotEmpty') return [c.field, '!=', null];
      // A value-less row's third slot is emitted as `null` rather than as
      // whatever `c.value` still holds: the operator dropdown PRESERVES the
      // previous operator's value, so an `Is null` row can carry a leftover
      // `'abc'` the user can no longer see or edit. The spec's own lowering
      // (`convertComparison`, `@objectstack/spec/data`) ignores the third slot
      // for `isnull`/`isnotnull` — it emits `{ [field]: { $null: true|false } }`
      // — so `null` is inert on the wire and keeps the emission a function of
      // the operator alone. Same shape the `isEmpty` arms above already use.
      if (VALUELESS_FILTER_BUILDER_OPERATORS.has(c.operator)) {
        return [c.field, mapOperator(c.operator), null];
      }
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

// Default English translations for fallback when I18nProvider is not available.
//
// Every row whose key the `en` pack also defines must stay byte-identical to it,
// or the same control is labelled one way here and another in the console.
// Enforced since objectui#4401 by
// `app-shell/src/__tests__/defaults-maps-mirror-en-pack.test.tsx`.
//
// Exported for that gate — the same reason
// `DETAIL_DEFAULT_TRANSLATIONS` and `COLLAB_DEFAULT_TRANSLATIONS` are exported
// from their packages. The gate cannot live in `@object-ui/i18n` (that would
// invert the dependency, see `gantt-count-interpolation-4157.test.ts`), so it
// reads this map from downstream instead of parsing this file's text.
export const LIST_DEFAULT_TRANSLATIONS: Record<string, string> = {
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
  // Load DENIED BY THE OBJECT — the server answered 404 `OBJECT_API_DISABLED`
  // or 405 `OBJECT_API_METHOD_NOT_ALLOWED`. This is not "no records", not a
  // permission grant anyone can give, and not something a retry can change:
  // the object's `enable` block withholds the API, for every user, permanently.
  // Say that, because the alternative reads as an empty list (objectui#4408).
  'list.loadErrorApiDisabledTitle': 'This object isn’t available through the API',
  'list.loadErrorApiDisabledMessage': 'This page can’t load its records because the object is not exposed through the API. That is a setting on the object itself, not a permission — an administrator has to enable API access for it before this page can work.',
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
  // "add a formula field" — on the exact surface the card is about.
  //
  // That byte-identity is no longer hand-held: objectui#4401 generalized
  // #3440's collaboration gate to this table, so a pack-only reword now fails
  // in `app-shell/src/__tests__/defaults-maps-mirror-en-pack.test.tsx`. (What
  // #4294 recorded here — that `check:i18n-keys` judges inline
  // `t(key, { defaultValue })` options and never a `createSafeTranslation`
  // table — is still true of that script; it is simply no longer the only
  // thing looking.)
  'list.sortRelationalHint':
    'Columns that link to another record are not listed: they can only be sorted by the stored ID, not by the name shown in the cell. To sort by that name, denormalize it onto this object as a stored field, written when the source changes, and sort by that. Not a formula field: it is virtual, so no column is stored for it and the server refuses to sort by one.',
  // objectui#4396 — the sort popover's reset action. Read bare
  // (`t('list.resetSortToDefault')`, no inline `defaultValue`), so before this
  // row a provider-less host rendered the raw key as the menu item's label.
  'list.resetSortToDefault': 'Reset to view default',
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
  // objectui#4462 — the Print button's tooltip/aria sentence. Borrowed from
  // `common.*` (like the `table.*`/`grid.*`/`detail.*` rows here) because the
  // identical sentence labels the report viewer's Print button and the
  // dashboard's print action: one control semantic, one translation. Byte-
  // identical to `en.common.printDialogHint` — enforced by
  // `app-shell/src/__tests__/defaults-maps-mirror-en-pack.test.tsx`.
  'common.printDialogHint': 'Opens your browser’s print dialog (not a PDF export)',
  'list.hideFieldsTitle': 'Hide Fields',
  'table.rowsPerPage': 'Rows per page',
  'grid.toolbar.densityMode': 'Density',
  'grid.toolbar.densityCompact': 'Compact',
  'grid.toolbar.densityComfortable': 'Comfortable',
  'grid.toolbar.densitySpacious': 'Spacious',
  'grid.toolbar.densityCycleHint': '{{label}} (click to cycle)',
  'grid.toolbar.densityCycleShortHint': 'Click to cycle',
  'list.viewSettings': 'View settings',
  'list.viewSettingsHint': 'Grouping, color, density, and visible fields. Applies to everyone who uses this view.',
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
}: ListViewProps & { [key: string]: any }, ref) => {
  // The switcher can be enabled either by the host component (prop) or by
  // the schema itself (ADR-0047 — ObjectView/InterfaceListPage stamp it on
  // the schema when appearance.allowedVisualizations whitelists >1 type).
  const showViewSwitcher = showViewSwitcherProp ?? (propSchema as any)?.showViewSwitcher ?? false;
  // i18n support for record count and other labels
  const { t } = useListViewTranslation();
  const { fieldLabel: resolveFieldLabel, actionLabel: resolveActionLabel, objectLabel: resolveObjectLabel } = useListFieldLabel();
  const { translateOptions } = useSafeFieldLabel();
  // The audience's BCP-47 tag (tenant locale → UI language → `en`), used below
  // to resolve the inline locale map the nested `aria` bag admits.
  const displayLocale = useDisplayLocale();

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
    //
    // This is the VIEW half of a NAME COLLISION, and the right half here:
    // `userActions` on a VIEW is toolbar policy (`UserActionsConfigSchema`),
    // while `userActions` on an OBJECT is the CRUD-predicate block
    // (`edit`/`delete`/`create` with `visibleWhen`/`disabledWhen`). So this
    // read stays `schema`-only and must never gain an
    // `?? (objectDef as any)?.userActions` fallback: the object block carries
    // no toolbar key, and the mirrored mistake — reading VIEW-first where only
    // the object block is interpretable — is exactly what the `$select`
    // predicate harvest below was fixed for (objectui#5398, the sibling of
    // objectui#5240). Pinned by `__tests__/ListView.userActionsCollision.test.tsx`.
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
  // Classified by the shared `classifyLoadError` (`@object-ui/react`,
  // objectui#4693 — lifted from this file so `RecordAttachmentsPanel` can
  // reuse the same "api-disabled is retry-invariant" verdict).
  const [loadErrorKind, setLoadErrorKind] = React.useState<LoadErrorKind>('network');
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
  // The params of the last successful fetch — the query behind the window this
  // view is currently showing (objectui#4501). Handed DOWN with that window, in
  // the same block as `rowCount`/`page`: whoever renders the rows may need to
  // re-issue the query (the grid's cross-page "select all N matching" fans out
  // over the whole match set), and this view is the only side that knows what it
  // asked for. Held in state rather than a ref so a consumer re-renders when the
  // query moves, and written only inside the stale-request guard below, so it is
  // always the query that produced the rows on screen.
  const [lastFindParams, setLastFindParams] = React.useState<Record<string, unknown> | null>(null);

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

  /**
   * [objectui#4420] The PER-RECORD half of the same key, for the same bar.
   *
   * `permittedBulkActions` above reads `userActions.delete` as a BOOLEAN — the
   * object-level verdict — and that is all it ever read. Since objectui#2614
   * the key also accepts `{ enabled?, visibleWhen?, disabledWhen? }`, whose
   * `visibleWhen` gates the affordance **per record**; the row kebab has
   * honoured it since, and this bar did not. Tick only a record the predicate
   * excludes and the bar still offered the red Delete — the same declared key
   * meaning two different things on two surfaces.
   *
   * ## What was ruled (maintainer, 2026-08-17 — behaviour 1 of three)
   *
   * Filter the operation and report the skipped. The bar evaluates
   * `visibleWhen` once per selected record, Delete runs over the allowed
   * SUBSET, and the excluded records are reported rather than silently
   * dropped. Two rejected alternatives, restated because each is a way to
   * misread this code: the button is **never hidden or disabled** by the
   * predicate (behaviour 2 — one stray tick would disable the whole bar), and
   * the predicate is **not** declared out of scope for set operations
   * (behaviour 3 — the key must not mean different things on two surfaces).
   * A selection where EVERY row is excluded therefore still renders the
   * button; what the user gets is a legible refusal, not an absence.
   *
   * ## Why `evalRowPredicate`, never `useRowPredicate`
   *
   * A bulk gate evaluates N records in a LOOP, and React forbids a hook per
   * iteration. `partitionRowsByPredicate` is that loop — the shared,
   * fail-closed fold in `@object-ui/core` that the grid's own bulk bar reads
   * through `partitionBulkRows`, so the two bars cannot drift on what
   * "eligible" means.
   *
   * ## Why `objectDef`, and only the built-in `delete`
   *
   * The predicates come off the OBJECT's `userActions` block (the CRUD
   * predicate vocabulary), never the VIEW's `schema.userActions` (toolbar
   * policy) — the same name collision `toolbarFlags` above is pinned against.
   * Only the built-in `delete` entry is filtered: custom action ids route
   * through the action runner carrying their own gates, exactly as the
   * object-level gate above leaves them alone.
   */
  const deleteVisibleWhen = React.useMemo(
    () => resolveEffectiveCrudAffordances(objectDef as any, effectiveApiOps).deletePredicates?.visibleWhen,
    [objectDef, effectiveApiOps],
  );
  const predicateScope = usePredicateScope();
  const bulkDeleteEligibility = React.useMemo(
    () => partitionRowsByPredicate(deleteVisibleWhen as never, selectedRows as Array<Record<string, unknown>>, {
      scope: predicateScope,
      fields: objectDef?.fields,
      label: 'delete',
    }),
    [deleteVisibleWhen, selectedRows, predicateScope, objectDef],
  );

  /**
   * [#4647] Is the grid toolbar's inline-edit toggle offered at all?
   *
   * Two gaps closed together, because both end at this one render condition.
   *
   * ## Gap 1 — the permission gate
   *
   * The toggle used to render on the sole conditions "grid view", "the host
   * wired `onInlineEditChange`" and "not the compact toolbar" — and every host
   * passes that callback unconditionally. It was the ONE affordance on this
   * toolbar with no permission check: New and Import are hidden for an account
   * without the grant, the bulk-delete entry directly above ANDs
   * `can(obj, 'delete')`, and inline edit alone stayed available to a read-only
   * principal, who could flip it, edit cells and press "Save all" to earn a
   * server 403. No data ever landed (the server gate is solid), but the UI
   * walked the user through a round-trip guaranteed to fail.
   *
   * The gate is `permittedBulkActions`' verbatim, with the operation moved from
   * `delete` to `update`: the object's resolved affordance — ADR-0103 bucket ∧
   * `userActions.edit` ∧ the server's effective API operations (#3391) — AND
   * the CURRENT PRINCIPAL's grant (#4096). The first half is spelled
   * `isObjectInlineEditable`, which IS
   * `resolveEffectiveCrudAffordances(...).edit` under the name that says what
   * this surface is asking; it is the same helper the record body's
   * double-click/pencil affordances read, so a list and a record page cannot
   * disagree about whether an object's rows are editable in place.
   *
   * `can()` answers `true` with no `PermissionProvider`, so standalone embeds
   * and the Studio designer keep today's behavior — the same fail-open the
   * bulk gate above relies on.
   *
   * ## Gap 2 — consuming the declared `userActions.editInline`
   *
   * `ListViewSchema.userActions.editInline` is spec-declared and, on this
   * toolbar, was read by nothing: an author could not switch inline editing off
   * even unconditionally. It is read here as an explicit opt-OUT (`!== false`).
   *
   * That default is deliberate and it does NOT enforce the spec's
   * `.default(false)`. Enforcing it would take the toggle away from every
   * existing console list view in one release, since nothing folds a legacy key
   * into `editInline` and no stored view declares it — the console's own
   * channel for this capability is the view's `inlineEdit` property, which the
   * host relays as `onInlineEditChange`. This is `toolbarFlags`' stated rule
   * for exactly this block (defaults "matching what these flags have always
   * done"; `hideFields`/`rowColor` keep their historical OFF because flipping
   * them "would grow two buttons on every existing view") applied in the
   * direction that would REMOVE one. So: an explicit `false` is honoured, an
   * explicit `true` is honoured, and absence defers to the host channel that
   * already governs this surface. `InterfaceListPage` — the other consumer of
   * this key — reads the absent case as OFF (`=== true`), because the
   * ADR-0047 interface page has no such host channel to defer to.
   */
  const inlineEditOffered = React.useMemo(() => {
    if ((schema.userActions as Record<string, boolean | undefined> | undefined)?.editInline === false) {
      return false;
    }
    return (
      isObjectInlineEditable(objectDef as any, effectiveApiOps) &&
      (schema.objectName ? canDo(schema.objectName, 'update') : true)
    );
  }, [schema.userActions, schema.objectName, objectDef, effectiveApiOps, canDo]);

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
  // Annotated `string[]` rather than inferred: `resolvedExportOptions.formats`
  // is the spec's literal union, so the inferred element type made the
  // `exportableFormats.includes(f)` below (whose `f` is a plain `string`) a
  // TS2345. Only visible since objectui#4528 gave this render function a real
  // `schema` type — the index signature used to resolve it to `any`.
  const exportableFormats = React.useMemo<string[]>(() => {
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
  //
  // `rowHeightToDensityMode` answers only for the five spec row heights and
  // abstains for anything else (#4440), so an off-spec value lands on the same
  // `'compact'` an ABSENT `rowHeight` has always landed on — which is also
  // `ObjectGrid`'s own default (`schema.rowHeight ?? 'compact'`). Do NOT drop
  // the `??` and let `undefined` reach `useDensityMode`: its parameter default
  // is `'comfortable'`, so the coercion #4440 retired would simply reappear one
  // frame lower, and the two surfaces would disagree again.
  const resolvedDensity = React.useMemo(
    () => rowHeightToDensityMode(schema.rowHeight) ?? 'compact',
    [schema.rowHeight],
  );
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

  // Permissions context — must be read before the `$expand` memo below AND
  // before the data-fetch effect, so both can FLS-gate what they ask the server
  // for (preventing it from returning denied fields). Also feeds the column-list
  // gate further down the file.
  //
  // ⚠️ The position is load-bearing, not cosmetic: `useMemo` runs its callback
  // DURING the render that declares it, so a memo above this line that read
  // `perms` would hit the temporal dead zone and throw
  // `Cannot access 'perms' before initialization` — not a stale value, a crash.
  const perms = usePermissions();

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
    // [objectui#7179] The GRID's grouping block, which this collector had no
    // arm for: it reads `groupByField` (kanban / gantt / timeline) but the grid
    // groups through `grouping.fields[]`, a different key with a different
    // shape. Without this, a grid grouped by a LOOKUP gets the field into
    // `$select` but never into `populate`, so every row carries the bare
    // foreign key and the groups bucket by raw id instead of by name — the
    // exact failure the comment above this memo records for kanban
    // ("list view shows 'Initech Solutions' but kanban used to show
    // '8UY9zHWBfjYjYor4'"). Better than one `(empty)` bucket, still wrong.
    //
    // Unguarded AGAINST UNKNOWN KEYS is safe here, and here only:
    // `buildExpandFields` returns a subset of the object's declared
    // reference-bearing fields, so a grouping field the object does not have —
    // or has as a non-relation — is dropped structurally. The `$select` half
    // below needs a real gate for that, and takes one. It is NOT unguarded
    // against FLS: that gate is on this helper's OUTPUT, below (objectui#7215),
    // where every route into the expand list — columns, view bindings and this
    // grouping union alike — passes through it exactly once.
    for (const f of collectGroupingFieldRefs(groupingConfig)) collected.add(f);
    const augmented = collected.size > 0 ? Array.from(collected) : undefined;
    const expandable = buildExpandFields(objectDef?.fields, augmented);
    // [objectui#7215] FIELD-LEVEL SECURITY ON `$expand`, the half objectui#6898
    // left open on both projection sites. `$select` on a denied lookup asks for
    // its BARE FOREIGN KEY; `$expand` asks the server to RESOLVE it and return
    // the related record, so the larger disclosure was the ungated one.
    //
    // ON THIS SITE IT ALSO REOPENED `$select`, which is not a second defect but
    // the measured reach of this one: the projection below gates the columns
    // (`rawCols.filter(c => perms.checkField(...))`) and then adds these roots
    // back unconditionally — `for (const e of expandFields) required.add(e)`,
    // on the ground that they are "known-valid because `buildExpandFields()`
    // derived them from the object schema". Valid, yes; READABLE, never asked.
    // A denied lookup column walked straight back through that union, so
    // objectui#6898's gate was being defeated here by the expand roots rather
    // than by its own filter. Gating at this single point closes both halves.
    //
    // ⭐ THE GATE GOES ON THE OUTPUT, NOT ON `augmented`, for two measured
    // reasons (`__tests__/ListView.expandFls-7215.test.tsx` pins both):
    // `buildExpandFields` reads an EMPTY column list as "no column restriction"
    // and falls back to every declared relation, so gating its INPUT would
    // WIDEN a view whose collected columns are all denied from one expansion to
    // all of them; and the no-columns case passes `undefined`, which has no
    // input to gate at all. Gating the output also gives the required ordering
    // structurally — this helper returns a subset of the object's DECLARED
    // reference-bearing fields, so every name judged here is declared and the
    // "`checkField` answers false for an undeclared key" trap is unreachable.
    //
    // An unanswered policy filters nothing, exactly as the `$select` gate
    // defers; `perms` is in the dep list so the expansion is rebuilt the moment
    // the answer arrives, and the fetch effect already depends on `perms` too.
    if (!perms?.isLoaded || !schema.objectName) return expandable;
    return expandable.filter((f) => perms.checkField(schema.objectName!, f, 'read'));
  }, [
    objectDef?.fields,
    groupingConfig,
    schema.columns,
    (schema as any).kanban,
    (schema as any).calendar,
    (schema as any).gallery,
    (schema as any).timeline,
    (schema as any).gantt,
    (schema as any).options,
    perms,
    schema.objectName,
  ]);

  // A gantt view whose `data` names the api provider is fed by a composite
  // endpoint that ObjectGantt resolves itself (resolveDataSource →
  // ApiDataSource, reads AND write-backs). ListView must neither fetch
  // schema.objectName rows for it nor hand its rows `data` prop down.
  //
  // ⛔ What the second half does NOT do (objectui#7222). It does not
  // "short-circuit the renderer's own fetch" — an earlier version of this
  // comment said it did, and believing that is exactly what made objectui#7210's
  // double fetch invisible on a read-through. No host prop reaches the chart at
  // all: the registered `object-gantt` renderer (`plugin-gantt/src/index.tsx`)
  // destructures `({ schema })` and hands `ObjectGantt` exactly `schema` and
  // `dataSource`, so `data`, `onRowClick`, `rowHeight` and the rest of
  // `baseProps` are dropped one layer up, and the chart queries for itself
  // whichever branch the render below takes. It is the one view wrapper that
  // forwards nothing — `object-grid`, `object-kanban`, `object-calendar`,
  // `object-map` and `object-tree` all spread `{...props}`. Pinned
  // behaviourally, one package over, in
  // `plugin-gantt/src/ObjectGantt.hostDataProp-7210.test.tsx`.
  //
  // The withholding is kept anyway: it is unreachable, not wrong, and it stops
  // being unreachable the moment that wrapper forwards host props — whether a
  // non-grid view may fetch unbounded at all is an open maintainer decision
  // (objectui#7210, half 2). `ObjectGantt.reload` takes its `rest.data`
  // short-circuit on `data && Array.isArray(data)`, and `[]` satisfies both,
  // while this view's rows array is never filled (the fetch effect below
  // returns early for it). Forwarding it would therefore replace the endpoint's
  // tree with an EMPTY chart — not with the stale object rows the old comment
  // warned about.
  const ganttOwnsData =
    currentView === 'gantt' &&
    !!schema.data &&
    typeof schema.data === 'object' &&
    !Array.isArray(schema.data) &&
    (schema.data as any).provider === 'api';

  /**
   * Does the surface rendered below draw the rows THIS component fetched?
   *
   * objectui#7210. The record-count bar at the foot of this component reports
   * this component's own paged query — `data.length` (or `serverTotal`), the
   * `dataLimitReached` warning that goes with `$top: effectivePageSize`, and a
   * rows-per-page selector that re-issues it. It is the only paging disclosure
   * on the screen, so a reader takes it as describing whatever is drawn above
   * it.
   *
   * On `gantt` that reading is false, and the bar is then worse than no bar.
   * MEASURED rather than inferred: the registered `object-gantt` renderer
   * (`plugin-gantt/src/index.tsx`) resolves to
   * `< ObjectGantt schema={bound} dataSource={dataSource} / >` and forwards no
   * other prop — unlike `object-grid` / `object-kanban` / `object-calendar` /
   * `object-map` / `object-tree`, whose wrappers all spread `{...props}`. The
   * `data` handed to the SchemaRenderer below therefore never reaches the
   * chart, `ObjectGantt.reload` issues its OWN query, and that query carries no
   * `$top` at all. Harness: 18 rows, `pagination.pageSize: 6` — the chart drew
   * 18 rows while this bar read "6 records · Showing first 6 records. More data
   * may be available." The same harness on `grid` ("18 records", the server
   * total, no warning) and on `kanban` ("6 records …", and the board really is
   * drawing those 6) is why this is scoped to `gantt` alone: everywhere else
   * the bar is telling the truth and must keep telling it.
   *
   * ⛔ The correction is NOT to forward `data` to the chart. That would cap a
   * gantt at one page, turning a complete schedule into a quietly truncated one
   * that still looks like a schedule. Whether a non-grid view may fetch
   * unbounded is an open maintainer decision (objectui#7210, half 2) — this
   * line is correct whichever way that lands, which is why it did not wait for
   * it.
   *
   * ⛔ Nor does suppressing the bar make this component's query dead: `data`
   * still gates the loading skeleton and the load-error panel (so it decides
   * whether the chart mounts at all), feeds `UserFilters`' option counts, and
   * is what the client-side CSV/JSON export writes out. Measured with the paged
   * response delayed: while it was in flight the skeleton was up and the chart
   * had 0 rows, though its own unbounded response had already arrived.
   */
  const surfaceDrawsFetchedRows = currentView !== 'gantt';

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
          // [objectui#7216] TWO gates, asked in this order and of this
          // population — they answer unrelated questions and neither
          // substitutes for the other:
          //
          //   1. KNOWN-FIELD gate (above) — keeps an UNKNOWN key out, because
          //      some backends answer an unknown `$select` key with an EMPTY
          //      result set rather than ignoring it.
          //   2. FLS gate (here) — keeps a KNOWN BUT DENIED key out, because
          //      sending it leaks the value at the server boundary even though
          //      the UI hides it (objectui#6898).
          //
          // A field can be perfectly well-declared and still denied; that is
          // the case this helper did not handle. The user-declared `cols` are
          // FLS-filtered a few lines up, so every OTHER route into `$select`
          // was gated and this one — the auto-included view bindings, the
          // predicate refs, the grouping fields — was not.
          //
          // ⚠️ ORDER IS LOAD-BEARING (objectui#7179's shape): intersect against
          // the declared fields FIRST, ask `checkField` only about the
          // survivors. `checkField` answers **false for an undeclared key**, so
          // asking it first would drop derived and computed bindings that are
          // not real object fields — and would be the REASON they were dropped,
          // which is a different and much worse failure than the known-field
          // gate declining them.
          //
          // ⚠️ The platform columns are carved out for the same reason they are
          // carved out of `addPredicateField`: every object CARRIES them and
          // none DECLARES them, so no field policy mentions them and
          // `checkField` answers false for every one. Without the carve-out a
          // calendar bound to `created_at` would go blank for everybody.
          const addSpeculative = (f: unknown) => {
            if (typeof f !== 'string' || !f) return;
            if (knownObjectFields && !knownObjectFields.has(f)) return;
            if (perms?.isLoaded && schema.objectName
                && knownObjectFields?.has(f)
                && !PLATFORM_RECORD_COLUMNS.has(f)
                && !perms.checkField(schema.objectName, f, 'read')) return;
            required.add(f);
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
          // [objectui#7179] The GRID's grouping fields. `collectViewFields`
          // above covers every OTHER view kind's grouping — they all spell it
          // `groupByField`, a plain string — but the grid spells it
          // `grouping.fields[]`, so it had no arm here and its projection was
          // built from `columns` alone. The measured symptom: one group
          // labelled `(empty)` holding every row, no error, no warning.
          //
          // Through `addSpeculative` for the reason stated at its definition,
          // which applies to a `grouping.fields[]` entry more sharply than to
          // anything else routed through it: this card's whole premise is that
          // the grouping field is NOT a column, so it has never been through
          // column validation, and `GroupingFieldSchema.field` is a bare
          // string. Unioned unguarded on a backend that rejects unknown
          // `$select` keys with an empty result set, it would turn one
          // `(empty)` group holding 186 rows into ZERO rows, just as silently.
          //
          // FLS-gated on top (objectui#6898): the grid half of this same fix
          // takes `passesProjectionGate`, and a grouping field can name a
          // denied field exactly as a column can.
          //
          // [objectui#7216] That FLS check used to live in an `addGroupingField`
          // wrapper right here. It now lives INSIDE `addSpeculative`, with a
          // byte-identical predicate, because every OTHER caller of that helper
          // needed the same gate and gating them one call site at a time is how
          // this asymmetry arose in the first place. The wrapper is gone rather
          // than left as a duplicate: two spellings of one gate is the shape
          // that lets them drift. `ListView.speculativeFls-7216.test.tsx` PIN 9
          // pins this path through the moved gate — plugin-list had no FLS pin
          // for grouping before it.
          for (const f of collectGroupingFieldRefs(groupingConfig)) addSpeculative(f);

          for (const f of collectPredicateFieldRefs(listViewPredicates({
            conditionalFormatting: schema.conditionalFormatting as unknown[] | undefined,
            rowActionDefs: (schema as any).rowActionDefs,
            bulkActionDefs: (schema as any).bulkActionDefs,
            objectActions: (objectDef as any)?.actions,
            // KEY COLLISION — `userActions` names TWO different blocks, and
            // only the OBJECT's is interpretable here. This read is therefore
            // `objectDef`-only; it must never regain a
            // `(schema as any).userActions ??` left operand. Maintainer ruling
            // of 2026-08-20 on objectui#5240 (Q1=A), whose `plugin-grid` half
            // landed as objectui#5426 — this is the sibling read site named in
            // that ruling (objectui#5398), carrying the same shape and the same
            // reason on purpose rather than a second spelling of one fix. The
            // measurements, re-taken here against `@objectstack/spec@17.0.0`:
            //
            //   - VIEW-level `userActions` is TOOLBAR POLICY —
            //     `UserActionsConfigSchema` (`sort`, `search`, `filter`,
            //     `refresh`, `rowHeight`, `addRecordForm`, `editInline`,
            //     `buttons`), which REJECTS `edit` BY NAME
            //     (`unrecognized_keys`). `ListViewSchema` accepts it, so it is
            //     spec-legal and really authored — it is the very block
            //     `toolbarFlags` and `inlineEditOffered` read above, and
            //     `normalizeListViewSchema` MANUFACTURES one from a legacy
            //     `show*` view that never wrote the key at all.
            //   - OBJECT-level `userActions` is the CRUD-PREDICATE block
            //     (`edit` / `delete` / `create` carrying `visibleWhen` /
            //     `disabledWhen`, objectui#2614) — what
            //     `resolveEffectiveCrudAffordances` / `isObjectInlineEditable`
            //     consume off `objectDef` above, and the only shape
            //     `listViewPredicates` can read: its loop skips every
            //     non-object value, so a toolbar block yields ZERO predicates.
            //
            // Read view-first, a legitimately authored toolbar block therefore
            // SHADOWED the object's CRUD predicates and dropped their operands
            // from `$select`; CEL then faults `No such key`, fails CLOSED, and
            // the row Edit/Delete button vanishes for everyone with nothing
            // pointing at the projection (objectui#3501 — the whole reason this
            // harvest exists, stated six lines up).
            //
            // On THIS component the shadowing was TOTAL rather than occasional:
            // `app-shell/src/views/ObjectView.tsx` builds the `userActions` it
            // hands down as an object literal of two spreads, so the left
            // operand was `{}` at worst — never nullish, so `??` never fell
            // through and the object's CRUD block was never reached AT ALL on
            // that path.
            //
            // Pinned by `__tests__/ListView.userActionsCollision.test.tsx`.
            userActions: (objectDef as any)?.userActions,
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

        // Hoisted out of the `find` call so the exact params that produced this
        // window can be handed down with it (objectui#4501). One object, one
        // query — a second literal reconstructed for the consumer would be a
        // copy free to drift from what was actually asked.
        const findParams: Record<string, unknown> = {
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
        };

        const results = await dataSource.find(schema.objectName, findParams);

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
        // Past the stale-request guard, so this is the query behind the rows
        // that were just set — never an in-flight one that lost the race.
        setLastFindParams(findParams);
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
    // objectui#6697 — this effect names the `expandFields` memo's INPUTS, not
    // the memo's OUTPUT. `useMemo` is a pure optimisation, not a correctness
    // dependency: React may discard the cache and recompute even when the
    // deps compare equal, and `buildExpandFields` hands back a FRESH array on
    // every call, so naming `expandFields` here re-issued the whole
    // `dataSource.find` on a discard alone. Its inputs are all props and
    // state, which a discard cannot move — so the effect is discard-immune
    // WITHOUT losing a single re-run it used to have.
    //
    // ⚠️ A value key over `expandFields` (`JSON.stringify(...)`) is NOT the
    // route here, and this is the measured reason: `buildExpandFields`
    // collapses the whole collected set down to the relation roots, so the
    // key it produces is not content-equivalent to what this effect reads —
    // the body builds `$select` from `schema.columns` and the view bindings
    // too. It also DEFEATS objectui#4567's live-dependency pin, which drives
    // "+ Add field" on the Studio grid: that appends an unpublished field, so
    // the producer's `gridColumns` rebuilds with EQUAL content and only a new
    // identity, and a value key cannot see it. objectui#4567 ruled that
    // "ListView's by-identity dependency is correct for a real column change"
    // and put the stabilisation at the PRODUCER; naming the props keeps that
    // ruling intact.
    //
    // The sibling re-keys in this fix take the other route on purpose:
    // `RelatedList`'s memos are keyed on exactly one primitive each, and
    // `PageTabsRenderer`'s probe memo is keyed on another MEMO's output
    // (`items`), which is not discard-immune. Key on the nearest
    // discard-immune thing — props/state where they are the memo's inputs, a
    // value key where they are not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.objectName, schema.data, dataSource, schema.filter, effectivePageSize, currentSort, currentFilters, userFilterConditions, refreshKey, searchTerm, schema.searchableFields, schema.columns, (schema as any).kanban, (schema as any).calendar, (schema as any).gallery, (schema as any).timeline, (schema as any).gantt, (schema as any).options, objectDef?.fields, objectDefLoaded, schema.refreshTrigger, perms, serverPage, currentView, groupingConfig, ganttOwnsData]); // Re-fetch on filter/sort/search/refreshTrigger/perms/page change

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

    // Check for Map capabilities (spec config takes precedence)
    //
    // Asked of the SAME merged config the render branch forwards
    // (`resolveListMapConfig`), not of `options.map` alone: the gate and the
    // seam must answer one question, or a view that binds its coordinates in
    // the view-level `map` block renders fine but is filtered out of
    // `allowedVisualizations` below — whitelist ∩ resolvable — and falls back
    // to `['grid']`. That is what made the spec block inert for the SWITCHER
    // even where the forward alone would have been enough (objectui#5042).
    // Sharing the resolver also means a split binding (`latitudeField` on the
    // block, `longitudeField` in the bag) is judged the way it will render.
    const mapConfig = resolveListMapConfig(schema);
    if (mapConfig.locationField || (mapConfig.latitudeField && mapConfig.longitudeField)) {
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
  }, [schema.options, schema.viewType, schema.kanban, schema.calendar, schema.gantt, schema.gallery, schema.timeline, schema.map, (schema as any).tree, schema.appearance?.allowedVisualizations]);

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
  // No assertion, deliberately. `schema.navigation` is the spec-derived
  // `ListViewSchema['navigation']` and the hook's `NavigationConfig` is now the
  // spec's authored config verbatim — `mode` optional and all (objectui#4550).
  // Two spellings of one spec object, so they simply agree.
  //
  // This call carried `as NavigationConfig | undefined` from objectui#4528
  // until then. That cast bridged nothing real: the alias re-declared `mode` as
  // required while the hook it fronts defaults it (`navigation?.mode ?? 'page'`),
  // so the cast's only job was to get a valid value past an over-tight type.
  // objectui#4550 fixed that at the producer, which deleted the reason for the
  // cast — and a cast kept past its reason is how the next reader learns the
  // wrong thing about the contract. Neither the cast nor its removal touches
  // the runtime value.
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

  /**
   * Did the AUTHOR declare a column projection at all? (objectui#6598)
   *
   * `effectiveFields` is `[]` in two situations the child grid cannot tell
   * apart, and sending the same empty array for both is what produced this
   * issue's headline symptom: `<list-view objectName="opportunity" />` on an
   * html-kind page rendered the row count, the toolbar and the index column —
   * and not one data column, with no diagnostic anywhere.
   *
   *   1. The author declared none (`columns` absent, or `[]`). `ObjectGrid`
   *      derives defaults from the object schema for exactly this case
   *      ("Default columns priority (when schema doesn't specify columns)"),
   *      and `normalizeColumns` already reads an empty `columns` as unauthored
   *      — the same rule `ElementDataSourceGate`'s precedence table states.
   *      But that derivation is gated on `schema.fields` being ABSENT, and an
   *      empty array is truthy, so the `fields: []` this component sent read as
   *      "show exactly these zero columns" and the defaults never ran.
   *      Single-variable measurement: a bare `<object-grid objectName="…" />`
   *      on the same tier, same data source, renders four default columns; the
   *      same object behind `<list-view>` renders none.
   *   2. The author declared some and the gates above removed them all — FLS
   *      denied every one, or every one is hidden. That case must KEEP sending
   *      the empty projection. Falling through to the grid's defaults there
   *      would show fields the author never asked for.
   *
   *      ⭐ THE REASON CHANGED; THE PREDICATE DID NOT (objectui#6799). This
   *      clause used to end "…and `ObjectGrid` re-applies FLS only on the
   *      DERIVED path, not on the explicit-columns one — so widening here would
   *      be a widening past the field gate." That is no longer true. As of
   *      objectui#6799 the grid re-applies FLS on ALL THREE of its default
   *      paths, the authored `columns` one included, so a fall-through here no
   *      longer escapes the field gate. The predicate stays exactly as it is
   *      for the half of the sentence that never depended on the grid: an empty
   *      projection is the AUTHOR's projection after filtering, and handing the
   *      grid "unauthored" would replace it with the object's default columns —
   *      fields the author never declared. FLS-checked now, but still not what
   *      was authored. AUTHORING INTENT is what this predicate protects, and
   *      that was always the load-bearing half.
   *
   * Hence the question is about the AUTHORED value and never about what
   * survived filtering.
   */
  const hasAuthoredColumns = React.useMemo(
    () => Array.isArray(schema.columns) && schema.columns.length > 0,
    [schema.columns],
  );

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
          // Unauthored ⇒ hand the grid NO projection, so its default-columns
          // derivation runs (see `hasAuthoredColumns`). `fields` has to be
          // cleared with it: it rides in on `baseProps`, and it is the key the
          // derivation is gated on.
          ...(hasAuthoredColumns
            ? { columns: effectiveFields }
            : { fields: undefined, columns: undefined }),
          ...(schema.conditionalFormatting ? { conditionalFormatting: schema.conditionalFormatting } : {}),
          // [#4647] The MODE, not just its toggle. Gating only the toggle would
          // leave the issue's own consequence reachable by a different door: a
          // stored view carrying `inlineEdit: true` (the console persists it
          // per view) drops a read-only principal straight into editable cells
          // with no toggle to press, and "Save all" still earns the 403. The
          // toggle can only ever be the cheapest entrance to this state; the
          // state is what needs the grant.
          editable: inlineEdit && inlineEditOffered,
          ...(schema.wrapHeaders != null ? { wrapHeaders: schema.wrapHeaders } : {}),
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
      case 'calendar': {
        // objectui#7029: only ever restate a binding the view actually
        // DECLARED. These two keys used to be floored at 'start_date' /
        // 'end_date' — field names no view had written and most objects do not
        // carry. `ObjectCalendar` decides whether it has a usable configuration
        // by asking whether a start-date binding is present, so a fabricated
        // one short-circuited its own refusal screen and every record landed on
        // today. The `titleField` rung next door has always been conditional;
        // these two now match it, and the whole branch matches the sibling
        // faces that never invent (`resolveTimelineDateBinding` above,
        // app-shell's `calendarViewOptions` / `defaultCalendarFromObject`).
        const startDateField =
          schema.calendar?.startDateField || schema.options?.calendar?.startDateField;
        const endDateField =
          schema.calendar?.endDateField || schema.options?.calendar?.endDateField;
        const titleField =
          schema.calendar?.titleField || schema.options?.calendar?.titleField;
        return {
          type: 'object-calendar',
          ...baseProps,
          ...(startDateField ? { startDateField } : {}),
          ...(endDateField ? { endDateField } : {}),
          ...(titleField ? { titleField } : {}),
          ...(schema.calendar?.defaultView ? { defaultView: schema.calendar.defaultView } : {}),
          ...(schema.options?.calendar || {}),
          ...(schema.calendar || {}),
        };
      }
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
      case 'gantt': {
        // objectui#7070: only ever restate a binding the view actually DECLARED
        // — the same correction objectui#7029 made to the calendar branch above,
        // which fenced this one out and reported it separately. These two keys
        // used to be floored at 'start_date' / 'end_date', field names no view
        // had written and most objects do not carry. `ObjectGantt.getGanttConfig`
        // takes its flat branch as soon as BOTH date props are present, so a
        // fabricated pair short-circuited the renderer's own refusal screen and
        // produced a plausible, fully wrong chart instead. MEASURED first, since
        // #7029's mechanic is only correct where a refusal path exists:
        // ObjectGantt REFUSES an absent binding (it does not render empty and
        // does not throw) — pinned in
        // `plugin-gantt/src/ObjectGantt.unconfiguredRefusal-7070.test.tsx`.
        //
        // ⛔ `progressField` / `dependenciesField` keep their floors here: they
        // are NOT date axes, their absent-value semantics differ, and #7070
        // scoped them out deliberately. Leaving them cannot resurrect a config —
        // `getGanttConfig` gates on the two date fields alone (pinned in the same
        // file), so the refusal stays reachable with the pair still present.
        const startDateField = schema.gantt?.startDateField || schema.options?.gantt?.startDateField;
        const endDateField = schema.gantt?.endDateField || schema.options?.gantt?.endDateField;
        return {
          type: 'object-gantt',
          ...baseProps,
          // ViewData pass-through: a view authored with `data: {provider:'api',
          // read, write}` (composite endpoint) must reach ObjectGantt, whose
          // getDataConfig prefers schema.data over the objectName fallback.
          ...(schema.data ? { data: schema.data } : {}),
          ...(startDateField ? { startDateField } : {}),
          ...(endDateField ? { endDateField } : {}),
          progressField: schema.gantt?.progressField || schema.options?.gantt?.progressField || 'progress',
          dependenciesField: schema.gantt?.dependenciesField || schema.options?.gantt?.dependenciesField || 'dependencies',
          ...(schema.gantt?.titleField ? { titleField: schema.gantt.titleField } : {}),
          ...(schema.options?.gantt || {}),
          ...(schema.gantt || {}),
        };
      }
      case 'map': {
        // Whitelisted flatten (objectui#5177) — see `FLAT_MAP_CONFIG_KEYS`.
        // `schema.options.map` is an untyped bag; a raw spread here forwarded
        // every key the author wrote, including `style`, which `ObjectMap`'s
        // `FlatMapConfigKeys` declares OUT of this flat form.
        //
        // The spec's view-level `map` block merges over that bag — see
        // `resolveListMapConfig` for the precedence and its sibling evidence.
        //
        // Emitted in the FLAT form, deliberately, exactly as before: a nested
        // `map` key would win OUTRIGHT at `getMapConfig` (objectui#5018), which
        // would turn this per-key merge into whole-block replacement of the bag
        // and would trip `warnOnShadowedFlatMapKeys`. That precedence rule is
        // written around the flatten product — "neither flattener emits a `map`
        // key at all" — and this branch keeps that true.
        //
        // No camera is synthesized here: `pickFlatMapConfig` copies only keys
        // the author actually wrote, so an undeclared `zoom`/`center` stays
        // absent and `ObjectMap` still fits the camera to the queried records
        // (objectui#5000, objectui#4941).
        const mapConfig = resolveListMapConfig(schema);
        return {
          type: 'object-map',
          ...baseProps,
          locationField: mapConfig.locationField || 'location',
          ...mapConfig,
        };
      }
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
  // `inlineEditOffered` joins the deps for #4647: the permission verdict lands
  // asynchronously (`/me/permissions`) and `objectDef` loads into state, so a
  // grid schema built before either resolved must be rebuilt when they do —
  // otherwise `editable` keeps the pre-verdict answer for the session.
  }, [currentView, schema, currentSort, effectiveFields, hasAuthoredColumns, groupingConfig, rowColorConfig, navigation.handleClick, density.mode, galleryCardSize, inlineEdit, inlineEditOffered, objectDef]);

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
  // is a separate question, answered by the two rules below.
  //

  // This view's sort becomes a server `$orderby` on the FLAT field name, and a
  // relational field stores a foreign-key id — so "sort by Owner" orders the
  // whole collection by `rec_7f3…` while the column shows names. It reads as
  // "sorting is broken", with nothing saying the key is something else. The
  // server cannot sort by the related record's name without a join
  // (objectstack#4256 settled that it won't), so the honest move is to stop
  // offering the illusion: relational fields leave the picker, and the hint
  // below points at the supported alternative (a stored field that
  // denormalizes the name onto this object, written when the source changes).
  //
  // Second rule — THE PLATFORM SAYS which field names it will order by
  // (objectstack#10235 ruling A, consumed here via #5729's landed spelling in
  // `@object-ui/core`). `isPlatformSortableField` is the contract: an entry
  // must EXIST in the served projection and say `sortable: true`. Absence is a
  // refusal — an unknown name, a dotted path, an unprovisioned audit column —
  // never a default of `true`. Withheld silently, so the relational hint below
  // stays strictly about relations, which is what its sentence describes.
  //
  // This picker used to re-derive that verdict from the field's TYPE, reading
  // `UNMATERIALIZED_FIELD_TYPES` (#3950 consolidated the local copy into core).
  // The two agree about `formula` — the platform computes its own projection
  // from the same `@objectstack/spec` storage fact — which is exactly why the
  // drift went unnoticed: they part company on everything the projection
  // encodes as ABSENCE, and on any verdict the runtime doors add later, where
  // a type read answers `sortable` and the platform answers `400 INVALID_SORT`.
  // One judgement, served; not a fourth copy of it drifting apart.
  //
  // NO SIGNAL SERVED (`undefined`) is a different question from "nothing is
  // sortable": a deployment older than objectstack#10235, an inline/mock data
  // source, or `objectDef` not yet loaded. That branch keeps the type read as a
  // compatibility floor — behaviour identical to before this card — and is
  // meant to be deleted when the supported floor passes that release.
  //
  // Exception (both rules): a field the CURRENT sort already uses stays listed
  // — relational ones flagged as ordering by ID — so opening this popover on a
  // view that was authored (or saved before this change) with such a sort
  // neither renders a blank row nor silently drops that sort on the next edit.
  // For a platform-refused field that exception is the only way to REMOVE the
  // offending row, since the sort it names is one the server refuses outright.
  //
  // ONE read of the served projection, for BOTH legs below — the list this
  // picker renders, and the sort it emits for a host to persist. Read twice,
  // the two copies could answer differently about the same field on the same
  // render, which is the drift `isPlatformSortableField` was consolidated to
  // end. `undefined` stays "no signal served", never "nothing is sortable".
  const platformSortability = React.useMemo(
    () => readObjectSortability(objectDef),
    [objectDef],
  );

  const { sortFields, sortHasRelationalField } = React.useMemo(() => {
    const inUse = new Set(currentSort.map((item) => item.field).filter(Boolean));
    let excluded = false;
    const fields: Array<{ value: string; label: string }> = [];
    for (const field of candidateFields) {
      const relational = EXPANDABLE_FIELD_TYPES.has(field.type);
      const platformSortable = platformSortability
        ? isPlatformSortableField(platformSortability, field.value)
        : !UNMATERIALIZED_FIELD_TYPES.has(field.type);
      if (!relational && platformSortable) {
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
  }, [candidateFields, currentSort, t, platformSortability]);

  /**
   * [#6455] THE persist boundary: what this picker LISTS is not what it
   * PERSISTS.
   *
   * The exception just above deliberately keeps a platform-refused field
   * listed while the CURRENT sort names it — it is the only way a user can
   * REMOVE a sort the server refuses outright. But the picker used to render
   * and emit from the SAME array, so any OTHER edit in the popover — adding a
   * second key, flipping a direction — re-emitted the refused entry, and the
   * host's `onSortChange` turned it into `persistViewPatch({ sort })`: a
   * personalization PUT storing a column the platform answers
   * `400 INVALID_SORT` for, written by a user who never touched that row.
   *
   * So the two legs part company HERE, at the one boundary every emit crosses,
   * exactly as #5729 parted them at the grid seam (`ObjectGrid`'s
   * `manualSort` / `manualOnSortChange` pair). The refused entry stays in
   * `currentSort` — listed, removable, and still the order this list asks the
   * server for — while no write ever carries it. Removing it persists the
   * removal; a sort with nothing refused in it is emitted unchanged.
   *
   * Every `onSortChange` in this component goes through here rather than each
   * call site filtering for itself: a builder edit, a header click and a
   * "reset to default" are three doors onto ONE stored `sort`, and a filter
   * spelled three times is a filter one new door can be added without.
   *
   * Only under a served projection: with no signal there is no verdict to
   * filter by, and the pre-objectstack#10235 behaviour stands unchanged.
   */
  const emitSortChange = React.useCallback((next: SortItem[]) => {
    if (!onSortChange) return;
    onSortChange(
      platformSortability
        ? filterPlatformSortableSort(next, platformSortability)
        : next,
    );
  }, [onSortChange, platformSortability]);

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
    emitSortChange(items);
  }, [emitSortChange]);

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
    emitSortChange(restored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaSortKey, emitSortChange]);

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

  /**
   * The accessible name for the list region, resolved — not cast.
   *
   * The NESTED bag is the spec's `AriaPropsSchema`, whose `ariaLabel` is
   * `I18nLabel`: a plain string **or** an inline locale map
   * (`{ en: 'Accounts', 'zh-CN': '客户' }`). This read site used to spread it
   * with `as string` — a cast, not a conversion — so a map-valued label
   * reached the DOM as `aria-label="[object Object]"` and a screen reader
   * announced that as the view's accessible name, in every locale
   * (objectui#5134). `as string` is invisible to the compiler by
   * construction, which is why the sweep that fixed the compile-visible sites
   * (objectui#4163 part 1) could not see this one.
   *
   * A miss resolves to `undefined` and the attribute is omitted, which is what
   * an attribute wants — no accessible name beats a garbage one. That is also
   * why this uses the spec's resolver rather than objectui's `pickLocalized`
   * (`''` on a miss, the spelling a TEXT NODE wants — see `TabBar.tsx`); the
   * two agree limb for limb, pinned by `i18nLabel-resolver-parity.test.ts` in
   * this package.
   *
   * ⚠️ The FLAT `schema.ariaLabel` is a different vocabulary — objectui's
   * keyed `{ key, defaultValue?, params? }` ref, resolved by `SchemaRenderer`'s
   * `resolveKeyedI18nLabel` — and is deliberately NOT touched here. Neither
   * resolver accepts the other's shape.
   */
  const ariaLabel = resolveInlineI18nLabel(schema.aria?.ariaLabel, displayLocale);

  /**
   * The view's description, resolved — not type-tested (objectui#7199).
   *
   * `ListViewSchema.description` is `I18nLabel`, the same vocabulary as the
   * sibling `label`: a plain string **or** an inline locale map
   * (`{ en: 'Open work only', 'zh-CN': '仅未完成' }`). This read site used to
   * be `typeof schema.description === 'string' ? schema.description : ''`,
   * which is not a resolution — it is a type test that answers the empty
   * string for every map an author is entitled to write. So a locale-map
   * description rendered as a blank strip in EVERY locale, which is the same
   * silent-blank symptom as the dropped relay one layer up, reached by a
   * second route.
   *
   * `pickLocalized` is the spelling a TEXT NODE wants (`''` on a miss) — the
   * same helper `TabBar.tsx` resolves the sibling `label` with, one component
   * tree away. The attribute next door deliberately uses the spec's resolver
   * instead, for its `undefined`; the two agree limb for limb, pinned by
   * `i18nLabel-resolver-parity.test.ts` in this package.
   *
   * Guarding on the RESOLVED text rather than on `schema.description` is what
   * keeps a map with no usable entry from rendering an empty strip: the raw
   * value is a truthy object, its resolution is `''`.
   */
  const viewDescription = pickLocalized(schema.description, displayLocale);

  return (
    <div
      ref={pullRef}
      className={cn('flex flex-col h-full bg-background relative min-w-0 overflow-hidden', className)}
      {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
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
      {viewDescription && (schema.appearance?.showDescription !== false) && (
        <div className="px-4 pt-1.5 text-xs text-muted-foreground bg-background" data-testid="view-description">
          {viewDescription}
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

        {/* `data-print-hide`: the tool cluster is pure interaction (print,
            share, export, filter, sort, density, search) and reads as clutter
            on paper. The RULE lives in the shared print sheet
            (`@object-ui/app-shell/styles.css`, objectui#4462) — this is only
            the marker it needs, because the cluster carries no stable
            selector of its own and its Tailwind class string is not
            distinguishable from a content div's. The left half of the toolbar
            (view tabs + active filter chips) deliberately still prints: it
            says WHICH slice of the data is on the page. */}
        <div className="flex items-center gap-0 shrink-0 rounded-lg border border-border bg-muted/40 p-0.5 shadow-sm" data-print-hide>
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
              `inlineEdit` on the view via onInlineEditChange.
              [#4647] `inlineEditOffered` carries BOTH the `can(obj,'update')`
              permission gate this affordance was missing and the declared
              `userActions.editInline` switch — see its definition above. */}
          {currentView === 'grid' && onInlineEditChange && !toolbarFlags.compactToolbar && inlineEditOffered && (
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
                  extraOperators={LIST_VIEW_EXTRA_OPERATORS}
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
                    // `setCurrentSort` takes the array WHOLE (the in-use
                    // exception depends on it); `emitSortChange` is what the
                    // host persists. See the boundary's docblock above.
                    setCurrentSort(newSort);
                    emitSortChange(newSort);
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
              /* [#4647] The compact toolbar's inline-edit entry — the SECOND
                 render site for this affordance, and the one with no gate at
                 all: it never even required `onInlineEditChange`. Same
                 `inlineEditOffered` verdict as the wide toolbar's toggle, or a
                 read-only principal would keep the entry on mobile after
                 losing it on desktop. */
              showInlineEdit={currentView === 'grid' && inlineEditOffered}
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

          {/* Print — hands off to the browser's own print dialog against the
              shared `@media print` sheet in `@object-ui/app-shell/styles.css`.
              It is NOT a PDF export (that primitive is objectstack#1301,
              closed NOT_PLANNED), and it was being accepted against "export
              PDF" requirements precisely because nothing said so
              (objectui#4462). `aria-label` + `title` carry that sentence —
              same two-attribute shape as the density button below. */}
          {schema.allowPrinting && (() => {
            const printHint = t('common.printDialogHint');
            return (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150"
                onClick={() => window.print()}
                aria-label={`${t('list.print')}: ${printHint}`}
                title={printHint}
                data-testid="print-button"
              >
                <Printer className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">{t('list.print')}</span>
              </Button>
            );
          })()}

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
            // This panel is NOT an empty state — it is the load FAILURE, and it
            // borrows `DataEmptyState` only for its layout. Since objectui#7132
            // that component defaults to `role="status"`, which would announce a
            // 403 or an outage as a routine status update, so this call site
            // declares what it actually is. (Measured: before #7132 neither this
            // panel nor the empty state below carried any role, so "you don't
            // have access" and "nothing here yet" were the same node shape.)
            role="alert"
            data-testid="list-error-state"
            data-error-kind={loadErrorKind}
            className="h-full min-h-[200px] p-8 gap-1 [&>h3]:text-lg [&>h3]:font-medium [&>h3]:text-foreground [&>p]:max-w-md"
            icon={loadErrorKind === 'network'
              ? <AlertTriangle className="h-12 w-12 text-destructive/60" />
              : <ShieldAlert className="h-12 w-12 text-destructive/60" />}
            iconWrapperClassName="mb-3"
            title={t(
              loadErrorKind === 'api-disabled' ? 'list.loadErrorApiDisabledTitle'
                : loadErrorKind === 'forbidden' ? 'list.loadErrorForbiddenTitle'
                  : loadErrorKind === 'unauthorized' ? 'list.loadErrorUnauthorizedTitle'
                    : loadErrorKind === 'rejected' ? 'list.loadErrorRejectedTitle'
                      : 'list.loadErrorTitle',
            )}
            description={t(
              loadErrorKind === 'api-disabled' ? 'list.loadErrorApiDisabledMessage'
                : loadErrorKind === 'forbidden' ? 'list.loadErrorForbiddenMessage'
                  : loadErrorKind === 'unauthorized' ? 'list.loadErrorUnauthorizedMessage'
                    : loadErrorKind === 'rejected' ? 'list.loadErrorRejectedMessage'
                      : 'list.loadErrorMessage',
            )}
            action={loadErrorKind === 'api-disabled' ? undefined : (
              // No Retry for an `enable`-block denial. The verdict is a pure
              // function of the object's metadata, so every retry re-fetches
              // the identical refusal — offering the button is the same wrong
              // advice as "check your connection", just spelled as a control.
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
            {...(ganttOwnsData
              // Withheld, not dropped. See `ganttOwnsData` above for why this
              // branch cannot be observed at the chart today (objectui#7222)
              // and why it is still the correct value to hand down.
              ? {}
              : { data })}
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
                  // …and the query itself (objectui#4501). The grid's
                  // cross-page "select all N matching" re-issues it to collect
                  // the whole match set; on this path the grid never ran a
                  // fetch, so without this it had no query to replay and asked
                  // the server for the unfiltered object. Handed down here
                  // rather than anywhere else because this block IS the
                  // handoff: the window, its total, its page — and what was
                  // asked to get them.
                  findParams: lastFindParams,
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
              // [objectui#4420] The built-in `delete` runs over the ALLOWED
              // SUBSET — the records `userActions.delete.visibleWhen` admits —
              // never the raw tick list. The button itself is untouched by the
              // predicate (ruled: never hidden, never disabled); what shrinks
              // is what it acts on, and the notice below owns up to it. Only
              // the canonical `delete` is filtered: every other id routes
              // through the action runner with its own gates.
              const rowsForAction = actionStr === 'delete'
                ? (bulkDeleteEligibility.eligible as any[])
                : selectedRows;
              return (
                <Button
                  key={action}
                  variant={isDestructive ? 'destructive' : 'outline'}
                  size="sm"
                  className="h-7 px-2.5 text-xs gap-1.5"
                  onClick={() => props.onBulkAction?.(action, rowsForAction)}
                  data-testid={`bulk-action-${action}`}
                >
                  {Icon && <Icon className="h-3 w-3" />}
                  {tActionLabel(action)}
                </Button>
              );
            })}
          </div>
          {/* [objectui#4420] The report half of the ruling, on the surface that
              has one. This bar dispatches straight through `onBulkAction` — it
              never opens `BulkActionDialog`, so there is no confirm step to
              carry the grid's `bulk-skipped-notice`; the bar states it up
              front instead, which also makes the all-excluded case a legible
              refusal BEFORE the click rather than a dead press. Same testid as
              the dialog's slot: one name for one fact, whichever surface says
              it. */}
          {bulkDeleteEligibility.skipped > 0
            && permittedBulkActions.some((a: any) => String(a).toLowerCase() === 'delete') && (
            <span
              className="text-muted-foreground ml-3"
              data-testid="bulk-skipped-notice"
            >
              {/* The grid dialog's own key, deliberately: this is the same
                  sentence about the same fact, already translated in every
                  locale pack. A `list.*` alias would be a second spelling of
                  one string — ten packs to keep in step for no new meaning. */}
              {t('grid.bulk.skippedIneligible', {
                count: bulkDeleteEligibility.skipped,
                defaultValue: `${bulkDeleteEligibility.skipped} selected record(s) are not eligible for this action and will be skipped.`,
              })}
            </span>
          )}
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
      {!loading && data.length > 0 && surfaceDrawsFetchedRows && schema.showRecordCount !== false && (
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