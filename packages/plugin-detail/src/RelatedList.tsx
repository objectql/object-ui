/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  Input,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  cn,
  useIsMobile,
} from '@object-ui/components';
import { SchemaRenderer, useCondition, toPredicateInput, type RelatedRowActionDef } from '@object-ui/react';
import {
  Plus,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ChevronDown,
  Inbox,
  icons as lucideIcons,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DataSource, FieldMetadata } from '@object-ui/types';
import type { ViewFilterRule } from '@objectstack/spec/ui';
import { getCellRenderer, resolveCellRendererType, RecordPickerDialog, deriveLookupColumns } from '@object-ui/fields';
import {
  columnIdentity,
  compareSortValues,
  getRecordDisplayName,
  getSortValue,
  isExpandableFieldType,
  isUnmaterializedFieldType,
  mergeFilterNodes,
  toFilterNode,
  userActionPredicates,
  type FilterNode,
} from '@object-ui/core';
import { useSafeFieldLabel } from '@object-ui/react';
import { usePermissions } from '@object-ui/permissions';
import { useDetailTranslation } from './useDetailTranslation';

export interface RelatedListProps {
  title: string;
  type: 'list' | 'grid' | 'table';
  api?: string;
  data?: any[];
  schema?: any;
  columns?: any[];
  className?: string;
  dataSource?: DataSource;
  /** Object name for i18n field label resolution */
  objectName?: string;
  /** Callback when "New" button is clicked */
  onNew?: () => void;
  /** Callback when "View All" button is clicked */
  onViewAll?: () => void;
  /** Callback when a row Edit action is clicked */
  onRowEdit?: (row: any) => void;
  /** Callback when a row Delete action is clicked */
  onRowDelete?: (row: any) => void;
  /**
   * Add-existing-via-picker config (generic m2m/junction assignment). When set,
   * the toolbar shows an "Add" button that opens a record picker on
   * `picker.object`; selecting records creates link rows in this list's `api`
   * object as `{[referenceField]: parentId, [linkField]: <pickedId>}` (junction
   * case), or — when `linkField` is omitted — re-parents the picked child by
   * setting its `referenceField` to `parentId` (1:m case). Server-side rules on
   * insert (e.g. the AI-seat cap) surface as an inline error.
   *
   * `picker.filter` restricts which records the dialog offers, and is typed as
   * the spec's own `ViewFilterRule[]` rather than `any` (#3831): it goes to
   * `RecordPickerDialog`'s `baseFilter` VERBATIM, so the authored vocabulary is
   * the one enforced — a looser type here is where a wrong shape would hide.
   */
  add?: {
    picker: {
      object: string;
      valueField?: string;
      labelField?: string;
      filter?: ViewFilterRule[];
    };
    linkField?: string;
    label?: string;
  };
  /** Callback when a row is clicked (opens record detail) */
  onRowClick?: (row: any) => void;
  /**
   * Child-object row actions (`locations: ['list_item']`), already localized
   * by the host. Rendered in each row's overflow menu alongside Edit/Delete.
   */
  rowActions?: RelatedRowActionDef[];
  /** Execute one of {@link rowActions} against the clicked row. */
  onRowAction?: (action: RelatedRowActionDef, row: any) => void | Promise<void>;
  /**
   * Child-object list actions (`locations: ['list_toolbar']`), already
   * localized by the host. Rendered as header buttons next to Add/New —
   * e.g. `invite_user` on an organization's Invitations list.
   */
  toolbarActions?: RelatedRowActionDef[];
  /** Execute one of {@link toolbarActions} (no row context). */
  onToolbarAction?: (action: RelatedRowActionDef) => void | Promise<void>;
  /** Maximum number of columns to auto-generate. Default 6. */
  maxColumns?: number;
  /** Page size for pagination (enables pagination when set) */
  pageSize?: number;
  /**
   * Initial sort applied while the user hasn't clicked a column sort — the
   * spec `RecordRelatedListProps.sort` shape (`'field'` / `'-field'` string or
   * `[{field, order}]`). On the auto-fetch path this becomes the server
   * `$orderby`, keeping page windows deterministic.
   */
  defaultSort?: string | Array<{ field: string; order: 'asc' | 'desc' }>;
  /**
   * Render the standalone row of sort buttons above the list.
   *
   * Only meaningful for a `list` (`data-list`) related list, which has no
   * column headers to click. A `grid`/`table` one sorts through its table
   * headers, which are live regardless of this flag — they always were, and
   * since objectui#3106 they sort the collection rather than the page, so the
   * button row above them would be a second control over the same order.
   *
   * @default false
   */
  sortable?: boolean;
  /**
   * The list's OWN scope filter — spec `RecordRelatedListProps.filter`
   * ("Additional filter criteria for related records"), which had no read site
   * on this component at all until objectstack#7118: the query was built from
   * `{ [referenceField]: parentId }` alone, so an authored `filter` (and the
   * FILTER half of a `dataSource` binding's saved view) was accepted by every
   * gate and silently dropped — the list answered wider than the metadata asked.
   *
   * ANDed with the parent-relationship condition, never substituted for it:
   * "additional" means it may only narrow this parent's children. That is also
   * why it is not routed through `data-table`'s `lookupFilters` — those render
   * as filter-bar rows the user can edit, which demotes the author's constraint
   * to a suggestion (#3831 argued this for `add.picker.filter`; it holds harder
   * for the list's own scope).
   *
   * Two shapes arrive, both produced by our own layers: the spec vocabulary
   * (`ViewFilterRule[]`) as authored, and an ObjectQL AST node as composed by
   * `ElementDataSourceGate` (which ANDs component/view/binding filters through
   * `mergeFilterNodes` before this component ever sees them). Both are lowered
   * here through that same single sink — the repo's one filter→wire exit — so no
   * second conversion dialect appears.
   */
  filter?: ViewFilterRule[] | FilterNode;
  /** Enable text filtering */
  filterable?: boolean;
  /** Whether the card is collapsible */
  collapsible?: boolean;
  /** Whether the card starts collapsed (requires collapsible=true) */
  defaultCollapsed?: boolean;
  /**
   * Foreign-key field name on child records pointing back to the parent.
   * The renderer hides this column from the table and from the schema-derived
   * column list, since the parent record is already implicit context.
   * Used in combination with `parentId` to scope the auto-fetch query.
   */
  referenceField?: string;
  /**
   * Primary-key value of the parent record. When both `parentId` and
   * `referenceField` are set, the auto-fetch query is scoped with
   * `$filter: { [referenceField]: parentId }` so only true children
   * are returned. Without this scope the list would dump the entire
   * target object table.
   */
  parentId?: string | number;
  /** Lucide icon name (kebab-case) to render next to the section title. */
  icon?: string;
}

/**
 * Resolve a kebab-case Lucide icon name (e.g. `"file-text"`) to the React
 * component. Returns the Inbox fallback when the name is missing or unknown.
 */
function resolveIconComponent(name: string | undefined): LucideIcon {
  if (!name) return Inbox;
  const pascal = name
    .split(/[-_\s]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
  return ((lucideIcons as Record<string, LucideIcon>)[pascal]) || Inbox;
}

/**
 * Resolve one referenced record to the label its cell should show.
 *
 * Goes through the unified ADR-0079 resolver when the target object's schema
 * is available, so an object that declares its display name (e.g.
 * `sys_permission_set` with `nameField: 'label'`, whose `name` is the API
 * name) resolves to the same string the cell's own `useLookupName` fetch
 * shows — the two used to disagree, making the column flash from the display
 * name to the API name once this batch map landed (objectui#3330). Falls back
 * to the legacy hard-coded chain when no schema reached us or the resolver
 * bottoms out at its `Record #<id>` / `Untitled` floor.
 */
function resolveRelatedLookupLabel(record: any, refSchema: any): string | undefined {
  const id = record?.id ?? record?._id;
  if (refSchema) {
    const resolved = getRecordDisplayName(refSchema, record);
    const isFloor =
      resolved === 'Untitled' || (id != null && resolved === `Record #${id}`);
    if (resolved && !isFloor) return resolved;
  }
  return (
    record?.full_name ||
    record?.fullname ||
    record?.display_name ||
    record?.name ||
    record?.subject ||
    record?.title ||
    record?.label ||
    record?.code ||
    record?.email ||
    (id != null ? String(id) : undefined)
  );
}

/**
 * Normalize the spec `sort` union (`'field'` / `'-field'` string or
 * `[{field, order}]`) into the object-array form fed to `$orderby`.
 */
function normalizeSortSpec(
  sort: RelatedListProps['defaultSort'],
): Array<{ field: string; order: 'asc' | 'desc' }> {
  if (!sort) return [];
  if (typeof sort === 'string') {
    const trimmed = sort.trim();
    if (!trimmed) return [];
    return trimmed.startsWith('-')
      ? [{ field: trimmed.slice(1), order: 'desc' }]
      : [{ field: trimmed, order: 'asc' }];
  }
  return sort.filter((s) => !!s?.field);
}

/**
 * One `list_toolbar` action button on a related-list header (e.g. "Invite
 * User" on an organization's Invitations list). Extracted into its own
 * component so the action's `visible` CEL predicate can be evaluated with a
 * hook (`useCondition`) without violating the rules-of-hooks inside a `.map()`.
 *
 * The SAME bridge (`RelatedRecordActionsBridge.deriveActions`) feeds both a
 * child object's row actions (`list_item`) and these header toolbar actions
 * (`list_toolbar`), spreading each action's `visible` predicate through
 * untouched. The row path already honors `visible` (via the data-table's
 * `DataTableRowActionItem`); this brings the toolbar path to parity so e.g.
 * `invite_user` (`visible: "features.organization != false"`) hides when its
 * predicate is false. `features`/`user` resolve from the ambient
 * ExpressionProvider scope.
 */
export const RelatedToolbarButton: React.FC<{
  action: RelatedRowActionDef;
  onToolbarAction: (action: RelatedRowActionDef) => void | Promise<void>;
}> = ({ action, onToolbarAction }) => {
  const visiblePred = action.visible;
  const isVisible = useCondition(toPredicateInput(visiblePred));
  if (visiblePred && !isVisible) return null;
  const ActionIcon = action.icon ? resolveIconComponent(action.icon) : null;
  return (
    <Button
      variant={action.variant === 'primary' ? 'default' : 'outline'}
      size="sm"
      onClick={(e) => { e.stopPropagation(); void onToolbarAction(action); }}
      className="gap-1 h-9 sm:h-7 text-xs shadow-none"
      data-testid={`related-toolbar-action-${action.name}`}
    >
      {/* Dynamic icon resolution from Lucide, not component creation during render */}
      {/* eslint-disable-next-line react-hooks/static-components */}
      {ActionIcon && <ActionIcon className="h-3.5 w-3.5" />}
      {action.label || action.name}
    </Button>
  );
};

export const RelatedList: React.FC<RelatedListProps> = ({
  title,
  type,
  api,
  data,
  schema,
  columns,
  className,
  dataSource,
  objectName,
  onNew,
  onViewAll,
  onRowEdit,
  onRowDelete,
  onRowClick,
  rowActions,
  onRowAction,
  toolbarActions,
  onToolbarAction,
  add,
  maxColumns = 6,
  pageSize,
  defaultSort,
  sortable = false,
  filter,
  filterable = false,
  collapsible = false,
  defaultCollapsed = false,
  referenceField,
  parentId,
  icon,
}) => {
  // Distinguish "caller did not provide data" (auto-fetch) from
  // "caller passed an empty array" (no related records — do not fetch).
  const dataProvided = data !== undefined;
  const initialData = data ?? [];
  const [relatedData, setRelatedData] = React.useState(initialData);
  // Start in loading state when we'll auto-fetch (api provided and caller
  // didn't pass data), so the empty state doesn't flash before the fetch
  // effect runs.
  const [loading, setLoading] = React.useState<boolean>(() => !!api && !dataProvided);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [sortField, setSortField] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');
  const [filterText, setFilterText] = React.useState('');
  // Server-reported collection size / next-page hint (windowed fetch only —
  // see `windowed` below). `total` drives the count badge and page indicator;
  // `hasMore` keeps "Next" usable when a non-conforming backend omits `total`.
  const [total, setTotal] = React.useState<number | null>(null);
  const [hasMore, setHasMore] = React.useState(false);
  const [objectSchema, setObjectSchema] = React.useState<any>(null);
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  // Add-by-picker (generic m2m/junction assignment). `refreshNonce` re-runs the
  // auto-fetch after an add/remove so the list reflects the new link rows.
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [addBusy, setAddBusy] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = React.useState(0);
  // Per-lookup-field cache of resolved labels: fieldName -> Map<id, label>
  const [lookupLabels, setLookupLabels] = React.useState<Record<string, Record<string, string>>>({});
  const { t } = useDetailTranslation();
  const { fieldLabel: resolveFieldLabel } = useSafeFieldLabel();

  const effectivePageSize = pageSize && pageSize > 0 ? pageSize : 0;
  // The built-in contains-filter is a CLIENT-side sweep over every field —
  // inexpressible as a generic server filter. While the user is typing in it
  // (opt-in `filterable` consumers only) we drop back to the legacy
  // fetch-everything mode so the filter keeps seeing the whole collection.
  const filterActive = filterable && filterText !== '';
  // Windowed (server-paged) mode — issue #2711: on the auto-fetch path with
  // pagination enabled, ask the server for ONE page ($top/$skip) plus the
  // running total instead of dumping every child row into the browser.
  // Caller-provided `data` and the raw-URL fallback keep the historical
  // client-side slicing.
  const windowed =
    !dataProvided &&
    !!api &&
    effectivePageSize > 0 &&
    !!dataSource &&
    typeof dataSource.find === 'function' &&
    !filterActive;
  // Freeze paging/sort fetch inputs while not windowed so the fetch effect
  // doesn't re-run (and re-download the full collection) on page clicks or
  // column sorts that the client pipeline already handles in memory.
  const fetchPage = windowed ? currentPage : 0;
  const fetchSortField = windowed ? sortField : null;
  const fetchSortDirection = windowed ? sortDirection : 'asc';
  // Key the memo on content, not identity — inline `sort` arrays from schema
  // nodes would otherwise re-trigger the fetch effect every render.
  const defaultSortKey = JSON.stringify(defaultSort ?? null);
  const defaultSortSpec = React.useMemo(
    () => normalizeSortSpec(defaultSort),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [defaultSortKey],
  );
  // The list's own scope filter, lowered to an ObjectQL node once. Keyed on
  // CONTENT for the reason `defaultSortSpec` is: an inline `filter` array on a
  // schema node is a new identity every render, and this value is a dependency
  // of the fetch effect — keying on identity would refetch the collection on
  // every render. `undefined` means "nothing authored", so the query below stays
  // byte-identical to what it sent before this key had a read site.
  const filterKey = JSON.stringify(filter ?? null);
  const listFilterNode = React.useMemo(
    () => toFilterNode(filter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterKey],
  );

  // Sync internal state when data prop changes (e.g., parent fetches async data)
  React.useEffect(() => {
    if (dataProvided) {
      setRelatedData(data ?? []);
    }
  }, [data, dataProvided]);

  // Fetch the related object's schema whenever we can. Needed BOTH to
  // auto-derive columns (no `columns` prop) AND to attach type-aware cell
  // renderers to explicitly-supplied columns (so a `status` column resolves to
  // a "Planned" badge instead of the raw `planned`). The fetch is cheap/cached.
  React.useEffect(() => {
    if (api && dataSource?.getObjectSchema) {
      dataSource.getObjectSchema(api).then(setObjectSchema).catch((err: unknown) => {
        console.warn(`[RelatedList] Failed to fetch schema for ${api}:`, err);
      });
    }
  }, [api, dataSource]);

  // Add-picker target schema, fetched lazily on first open. It drives the
  // picker's display column (`add.picker.labelField` → displayField), the
  // auto-derived multi-column layout, and type-aware cell rendering — without
  // it the dialog fell back to a single title-cased NAME column showing
  // machine names even though the page metadata declared `labelField: 'label'`
  // (#3365: sys_position / sys_permission_set Add pickers).
  const pickerObject = add?.picker?.object;
  const [pickerSchema, setPickerSchema] = React.useState<any>(null);
  React.useEffect(() => {
    if (!pickerOpen || !pickerObject || pickerSchema || !dataSource?.getObjectSchema) return;
    let cancelled = false;
    dataSource.getObjectSchema(pickerObject).then((s: any) => {
      if (!cancelled) setPickerSchema(s);
    }).catch((err: unknown) => {
      console.warn(`[RelatedList] Failed to fetch schema for ${pickerObject}:`, err);
    });
    return () => { cancelled = true; };
  }, [pickerOpen, pickerObject, pickerSchema, dataSource]);
  const pickerDisplayField = add?.picker?.labelField || 'name';
  const pickerColumns = React.useMemo(() => {
    const derived = deriveLookupColumns(pickerSchema, { displayField: pickerDisplayField });
    return derived.length > 0 ? derived : undefined;
  }, [pickerSchema, pickerDisplayField]);

  // Developer hint for an `add` that cannot be honoured (#3838). `picker` is
  // REQUIRED on `add` by the spec (`RecordRelatedListProps.add`), so getting
  // here means the page metadata is off-spec — but nothing on the render path
  // parses it (the sdui-parser manifest gate compares top-level key names and
  // coarse types only), so the renderer is the first place able to say so. It
  // says WHICH key is missing, because the failure it replaces — a bare
  // `add.picker.object` read that threw and made SchemaRenderer swap the whole
  // list for a "failed to render" card — never mentioned `picker` at all.
  // Console-only, matching the in-file hint for the other partial
  // misconfiguration (`no referenceField/parentId` below): the block-level
  // dashed placeholder precedent in `renderers/record-related-list.tsx` is for
  // blocks that can render NOTHING (missing objectName), whereas here only the
  // Add affordance is unconfigured and the list body is perfectly fine.
  React.useEffect(() => {
    if (!add || pickerObject) return;
    console.warn(
      `[RelatedList] "${api || objectName || 'related list'}" declares add without add.picker.object — the Add affordance is not rendered. add.picker is required by the spec (RecordRelatedListProps.add): set add.picker.object to the object the picker should list.`,
    );
  }, [add, pickerObject, api, objectName]);

  React.useEffect(() => {
    // Stale-response guard: page flips re-run this effect while an earlier
    // window may still be in flight — a slow page-2 response must not
    // overwrite page 3 after the fact.
    let cancelled = false;
    // Only auto-fetch when the caller didn't pass `data` at all. If the parent
    // explicitly passed an empty array, that means "no related records" — we
    // must NOT fall back to fetching all rows of the API (which would surface
    // unrelated data and confuse users).
    if (api && !dataProvided) {
      // Bug guard: if we don't know how to scope the query to the current
      // parent, the unfiltered fetch would dump the entire target object.
      // Render an explicit empty state instead — better than wrong data.
      const canScope = !!referenceField && parentId !== undefined && parentId !== null && parentId !== '';
      if (!canScope) {
        if (api && (parentId === undefined || parentId === null || parentId === '') && !referenceField) {
          // Developer hint: only surface in console once per mount.
          console.warn(
            `[RelatedList] "${api}" has no referenceField/parentId — refusing to fetch all rows. Pass relationshipField + parentId to scope the query.`,
          );
        }
        setRelatedData([]);
        setTotal(null);
        setHasMore(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      const parentScope = { [referenceField!]: parentId } as Record<string, any>;
      // Parent relationship AND the list's own scope (objectstack#7118). The
      // parent condition is never negotiable — an "additional" criterion may only
      // narrow this parent's children — and with nothing authored the query is
      // the untouched MongoDB-style object it has always been, rather than a
      // freshly lowered AST that means the same thing (the difference is
      // invisible on screen and visible to every caller pinning the wire).
      const queryFilter =
        listFilterNode === undefined
          ? parentScope
          : mergeFilterNodes(parentScope, listFilterNode);
      if (dataSource && typeof dataSource.find === 'function') {
        const params: Record<string, any> = { $filter: queryFilter };
        if (windowed) {
          params.$top = effectivePageSize;
          params.$skip = fetchPage * effectivePageSize;
          // A user column sort becomes a server $orderby so ordering stays
          // global across pages; otherwise the schema's declared `sort` wins.
          const orderby = fetchSortField
            ? [{ field: fetchSortField, order: fetchSortDirection }]
            : defaultSortSpec;
          if (orderby.length > 0) params.$orderby = orderby;
        }
        dataSource.find(api, params).then((result) => {
          if (cancelled) return;
          const isArrayResult = Array.isArray(result);
          const items = isArrayResult
            ? (result as any[])
            : Array.isArray((result as any)?.data)
              ? (result as any).data
              : [];
          setRelatedData(items);
          if (windowed) {
            const reportedTotal = !isArrayResult && typeof (result as any)?.total === 'number'
              ? (result as any).total as number
              : null;
            setTotal(reportedTotal);
            // Prefer the server's own hint; a full page implies "maybe more"
            // when the backend reports neither total nor hasMore.
            setHasMore(
              !isArrayResult && typeof (result as any)?.hasMore === 'boolean'
                ? (result as any).hasMore as boolean
                : items.length === effectivePageSize,
            );
          } else {
            setTotal(null);
            setHasMore(false);
          }
          setLoading(false);
        }).catch((err) => {
          console.error('Failed to fetch related data:', err);
          if (!cancelled) setLoading(false);
        });
      } else if (listFilterNode !== undefined) {
        // No adapter — the legacy raw-URL path, whose query language is
        // `filter[<field>]=<value>` and cannot carry an operator, let alone a
        // rule array. Dropping the authored filter here would answer with MORE
        // rows than the metadata asked for, silently: the exact class this key's
        // wiring exists to remove (objectstack#7118), so it refuses and says so
        // instead. Empty-and-loud beats wider-and-quiet; the guard above refuses
        // an unscoped fetch on the same reasoning.
        console.warn(
          `[RelatedList] "${api}" declares a filter but has no dataSource adapter — the raw-URL fallback cannot express it, so no rows are fetched. Pass a dataSource (RecordContext) to use a filtered related list.`,
        );
        setRelatedData([]);
        setTotal(null);
        setHasMore(false);
        setLoading(false);
      } else {
        const qs = new URLSearchParams({
          [`filter[${referenceField}]`]: String(parentId),
        }).toString();
        fetch(`${api}?${qs}`)
          .then(res => res.json())
          .then(result => {
            if (cancelled) return;
            const items = Array.isArray(result) ? result : (result?.data || []);
            setRelatedData(items);
            setTotal(null);
            setHasMore(false);
          })
          .catch(err => {
            console.error('Failed to fetch related data:', err);
          })
          .finally(() => { if (!cancelled) setLoading(false); });
      }
    }
    return () => {
      cancelled = true;
    };
  }, [api, dataProvided, dataSource, referenceField, parentId, refreshNonce, windowed, effectivePageSize, fetchPage, fetchSortField, fetchSortDirection, defaultSortSpec, listFilterNode]);

  // Windowed mode: a page beyond the (shrunken) collection — e.g. the last
  // row of the last page was just deleted — comes back empty. Step back one
  // page instead of stranding the user on an empty window.
  React.useEffect(() => {
    if (!windowed || loading) return;
    if (currentPage > 0 && relatedData.length === 0) {
      setCurrentPage((p) => Math.max(0, p - 1));
    }
  }, [windowed, loading, relatedData, currentPage]);

  // A different parent (or relationship, or list scope) is a different
  // collection — restart from the first page. `filterKey` belongs here for the
  // same reason the other three do: page 3 of the unfiltered children is not
  // page 3 of the filtered ones.
  React.useEffect(() => {
    setCurrentPage(0);
  }, [api, referenceField, parentId, filterKey]);

  // Refetch when a mutation elsewhere signals this related object changed —
  // e.g. a child row action executed through the host retargets `api` and
  // dispatches `objectui:related-changed`. Only meaningful on the auto-fetch
  // path (parent-provided data is refreshed by the parent).
  //
  // `'*'` is the invalidation bus's "unknown scope — everything is stale"
  // wildcard (undo of an unknown operation, the record header's manual ⟳ in
  // objectui#3460): it must match EVERY list, exactly as `dataChangeMatches` in
  // `@object-ui/react` already does for the bus's own readers. A concrete
  // object name still has to be this list's own — a write to some other object
  // is not a reason to refetch here.
  React.useEffect(() => {
    if (!api || dataProvided) return;
    const onChanged = (ev: Event) => {
      const detail = (ev as CustomEvent).detail || {};
      if (detail.objectName && detail.objectName !== '*' && detail.objectName !== api) return;
      setRefreshNonce((n) => n + 1);
    };
    window.addEventListener('objectui:related-changed', onChanged as EventListener);
    return () => window.removeEventListener('objectui:related-changed', onChanged as EventListener);
  }, [api, dataProvided]);

  // Resolve lookup-field display labels by batch-fetching referenced records.
  // For each lookup/master_detail column whose data is a primitive ID, gather
  // unique IDs and fetch them in one round trip per target object. The
  // resulting id → name map is exposed via `options` on the field meta so
  // the existing LookupCellRenderer renders a friendly label instead of the
  // raw ID.
  React.useEffect(() => {
    if (!dataSource?.find || !objectSchema?.fields || !relatedData.length) return;
    const fields = objectSchema.fields as Record<string, any>;
    const tasks: Array<{ fieldName: string; target: string; ids: string[] }> = [];
    for (const [fieldName, def] of Object.entries(fields)) {
      if (!def || (def.type !== 'lookup' && def.type !== 'master_detail')) continue;
      const target = def.reference_to || def.reference;
      if (!target) continue;
      const ids = new Set<string>();
      for (const row of relatedData) {
        const v = row?.[fieldName];
        if (v == null) continue;
        if (typeof v === 'string' && v) ids.add(v);
        else if (typeof v === 'number') ids.add(String(v));
      }
      // Skip ids already cached
      const cached = lookupLabels[fieldName] || {};
      const missing = Array.from(ids).filter((id) => !(id in cached));
      if (missing.length > 0) tasks.push({ fieldName, target, ids: missing });
    }
    if (tasks.length === 0) return;
    let cancelled = false;
    Promise.all(
      tasks.map(({ fieldName, target, ids }) =>
        Promise.all([
          dataSource.find(target, { $filter: { id: { $in: ids } }, $top: ids.length }),
          // Target object's schema (nameField / titleFormat) so the batch map
          // resolves display names through the same ADR-0079 resolver as the
          // cell's own fetch — see resolveRelatedLookupLabel (objectui#3330).
          typeof dataSource.getObjectSchema === 'function'
            ? dataSource.getObjectSchema(target).catch(() => undefined)
            : Promise.resolve(undefined),
        ])
          .then(([res, refSchema]: [any, any]) => {
            const records: any[] = Array.isArray(res) ? res : res?.data || [];
            const map: Record<string, string> = {};
            for (const r of records) {
              const id = r?.id || r?._id;
              if (!id) continue;
              map[String(id)] = resolveRelatedLookupLabel(r, refSchema) ?? String(id);
            }
            return { fieldName, map };
          })
          .catch((err: unknown) => {
            console.warn(`[RelatedList] Failed to resolve lookups for ${fieldName}:`, err);
            return { fieldName, map: {} as Record<string, string> };
          }),
      ),
    ).then((results) => {
      if (cancelled) return;
      setLookupLabels((prev) => {
        const next = { ...prev };
        for (const { fieldName, map } of results) {
          next[fieldName] = { ...(next[fieldName] || {}), ...map };
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // Intentionally exclude `lookupLabels` from deps: we add to the cache and
    // would otherwise loop. We dedupe via the `missing` check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSource, objectSchema, relatedData]);

  // Filter data (client mode only — windowed mode filters/sorts server-side)
  const filteredData = React.useMemo(() => {
    if (windowed || !filterText) return relatedData;
    const lower = filterText.toLowerCase();
    return relatedData.filter((row) =>
      Object.values(row).some((val) =>
        val !== null && val !== undefined && String(val).toLowerCase().includes(lower)
      )
    );
  }, [relatedData, filterText, windowed]);

  // Sort data (client mode only — a windowed sort is a server $orderby)
  //
  // A relational column holds a raw foreign-key id (this list resolves labels
  // itself, see `lookupLabels`) or — when the parent handed us `$expand`-ed
  // rows — the related record object. `String(aVal)` ordered the first by an
  // opaque id and reduced the second to "[object Object]", i.e. every row equal.
  // Feeding the resolved label map to `getSortValue` sorts by the string the
  // cell actually renders (objectui#3096).
  const sortedData = React.useMemo(() => {
    if (windowed || !sortField) return filteredData;
    const labels = lookupLabels[sortField];
    const keyed = filteredData.map((row) => ({ row, key: getSortValue(row[sortField], { labels }) }));
    keyed.sort((a, b) => {
      const cmp = compareSortValues(a.key, b.key);
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return keyed.map((entry) => entry.row);
  }, [filteredData, sortField, sortDirection, windowed, lookupLabels]);

  // Paginate data. Windowed mode already holds exactly one page; client mode
  // slices the in-memory collection as before.
  const paginatedData = effectivePageSize && !windowed
    ? sortedData.slice(currentPage * effectivePageSize, (currentPage + 1) * effectivePageSize)
    : sortedData;
  const totalPages = !effectivePageSize
    ? 1
    : windowed
      ? total != null
        ? Math.max(1, Math.ceil(total / effectivePageSize))
        : currentPage + (hasMore ? 2 : 1)
      : Math.max(1, Math.ceil(sortedData.length / effectivePageSize));
  const canGoNext = windowed
    ? (total != null ? (currentPage + 1) * effectivePageSize < total : hasMore)
    : currentPage < totalPages - 1;
  const showPagination = effectivePageSize > 0 && (windowed
    ? currentPage > 0 || canGoNext
    : sortedData.length > effectivePageSize);

  // Reset to first page when filter/sort changes
  React.useEffect(() => {
    setCurrentPage(0);
  }, [filterText, sortField, sortDirection]);

  const handleSort = React.useCallback((field: string) => {
    // Same-batch page reset: in windowed mode sort + page feed one fetch, so
    // resetting here avoids an extra request against the stale page index.
    setCurrentPage(0);
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  /**
   * The order the embedded table's headers display — this list's own sort, so
   * the arrow on a column header and the rows underneath it come from the same
   * place (objectui#3106).
   *
   * Before any click that is the declared `defaultSort`, which is what the
   * windowed fetch above sends. A header showing nothing while the server was
   * asked for `created_at desc` would make the first click on that column
   * request `asc` on a list that is already `desc`.
   */
  const activeSort = React.useMemo(
    () => (sortField ? [{ field: sortField, order: sortDirection }] : defaultSortSpec),
    [sortField, sortDirection, defaultSortSpec],
  );

  /**
   * A header click from the embedded table. It arrives with the direction
   * already resolved against {@link activeSort}, so this assigns rather than
   * toggling — running it back through `handleSort`'s own toggle would undo it
   * whenever the two disagreed about the current state.
   */
  const handleTableSort = React.useCallback(
    (next: Array<{ field: string; order: 'asc' | 'desc' }>) => {
      const first = next[0];
      if (!first) return;
      setCurrentPage(0);
      setSortField(first.field);
      setSortDirection(first.order);
    },
    [],
  );

  // Confirm-delete dialog state. Replaces window.confirm() so the related
  // list matches the rest of the app's Shadcn AlertDialog UX.
  const [deleteTarget, setDeleteTarget] = React.useState<any | null>(null);

  const handleDeleteRow = React.useCallback((row: any) => {
    setDeleteTarget(row);
  }, []);

  const handleConfirmDelete = React.useCallback(async () => {
    if (deleteTarget) {
      try {
        await onRowDelete?.(deleteTarget);
        setRefreshNonce((n) => n + 1); // reflect the removal
      } catch (err) {
        console.error('[RelatedList] remove failed', err);
      }
    }
    setDeleteTarget(null);
  }, [deleteTarget, onRowDelete]);

  // Add existing records via picker → create link rows (junction) or re-parent
  // (1:m). Server-side insert rules (e.g. the AI-seat cap) surface inline.
  const handleAddRecords = React.useCallback(async (records: any[]) => {
    if (!add || !dataSource || !api || referenceField == null || parentId === undefined || parentId === null) return;
    const vf = add.picker.valueField || 'id';
    setAddBusy(true);
    setAddError(null);
    try {
      for (const rec of records || []) {
        const pickedId = rec?.[vf] ?? rec?.id;
        if (pickedId == null) continue;
        if (add.linkField) {
          await (dataSource as any).create?.(api, { [referenceField]: parentId, [add.linkField]: pickedId });
        } else {
          await (dataSource as any).update?.(add.picker.object, String(pickedId), { [referenceField]: parentId });
        }
      }
      setRefreshNonce((n) => n + 1);
    } catch (err: any) {
      const raw = err?.body?.error ?? err?.error ?? err?.message ?? String(err);
      setAddError(typeof raw === 'string' ? raw : 'Failed to add');
    } finally {
      setAddBusy(false);
      setPickerOpen(false);
    }
  }, [add, dataSource, api, referenceField, parentId]);

  // Generate effective columns from explicit prop or object schema fields.
  // Behavior:
  //  - Hide the parent FK column (already implicit context).
  //  - Skip image and large-blob fields that bloat row height.
  //  - Skip fields with no visible value across the current rows.
  //  - Prefer name-like fields (name, title, subject, ...) first.
  //  - Cap at `maxColumns` to keep the related card readable; users can
  //    click "View All" to see the full list.
  const perms = usePermissions();
  const effectiveColumns = React.useMemo(() => {
    const relatedObjectName = objectName || api || '';
    // FLS: drop columns the current user cannot read on the related object.
    const filterFLS = (cols: any[]): any[] => {
      if (!perms?.isLoaded || !relatedObjectName) return cols;
      return cols.filter((c) => {
        const key = c?.accessorKey || columnIdentity(c);
        if (!key) return true;
        return perms.checkField(relatedObjectName, String(key), 'read');
      });
    };
    const filterFK = (cols: any[]): any[] =>
      referenceField
        ? cols.filter((c) => {
            const key = c?.accessorKey || columnIdentity(c);
            return key !== referenceField;
          })
        : cols;

    const isValueEmpty = (v: any) =>
      v === null ||
      v === undefined ||
      (typeof v === 'string' && v.trim() === '') ||
      (Array.isArray(v) && v.length === 0);

    const pruneEmpty = (cols: any[]): any[] => {
      if (!relatedData.length) return cols;
      return cols.filter((c) => {
        const key = c?.accessorKey || columnIdentity(c);
        if (!key) return true;
        return relatedData.some((r) => !isValueEmpty(r?.[key]));
      });
    };

    // Build a type-aware cell renderer for a field — so select options resolve
    // to friendly labels/badges, lookups to names, currency/date to formatted
    // values, etc. Shared by BOTH the explicit-columns path and the
    // auto-derived path so a `status` column reads "Planned" (badge), never the
    // raw `planned`, regardless of how the columns were supplied.
    const makeCell = (key: string, def: any): ((value: any) => any) | undefined => {
      if (!def?.type) return undefined;
      const rendererType = resolveCellRendererType({ type: def.type, format: def.format }) || def.type;
      const CellRenderer = getCellRenderer(rendererType);
      if (!CellRenderer) return undefined;
      const isLookup = def.type === 'lookup' || def.type === 'master_detail';
      const resolvedMap = isLookup ? lookupLabels[key] : undefined;
      const lookupOptions =
        resolvedMap && Object.keys(resolvedMap).length > 0
          ? Object.entries(resolvedMap).map(([id, label]) => ({ value: id, label }))
          : undefined;
      const fieldMeta: FieldMetadata = {
        name: key,
        label: def.label || key,
        type: def.type,
        ...((lookupOptions || def.options) && { options: lookupOptions || def.options }),
        ...(def.currency && { currency: def.currency }),
        ...(def.precision !== undefined && { precision: def.precision }),
        ...((def as any).scale !== undefined && { scale: (def as any).scale }),
        ...(def.format && { format: def.format }),
        ...((def.reference_to || def.reference) && { reference_to: def.reference_to || def.reference }),
        ...(def.reference_field && { reference_field: def.reference_field }),
      };
      return (value: any) => {
        if (value === null || value === undefined) {
          return React.createElement('span', { className: 'text-muted-foreground/50 text-xs italic' }, '—');
        }
        return React.createElement(CellRenderer, { value, field: fieldMeta });
      };
    };

    // Normalize bare-string column entries (e.g. `'user_agent'`) into the
     // `{accessorKey, header}` shape the data-table renderer expects, and attach
     // a type-aware cell renderer resolved from the object schema.
     // Without this, page authors passing `columns: ['status', 'amount']`
     // would see raw values (e.g. `planned`, unformatted numbers).
     const normalizeColumn = (c: any): any => {
       if (typeof c !== 'string') {
         // Object column: resolve the identity ONCE, then hand the table an
         // entry that already speaks the table's own vocabulary.
         //
         // Every read in this file resolves identity canonical-first through
         // the shared `columnIdentity` reader (objectui#3104), so
         // `{ field: 'status' }` passes
         // the FLS filter, the FK filter, `pruneEmpty` and the sort row. The
         // data-table it feeds does NOT: it normalizes its accessor as
         // `accessorKey: col.accessorKey || col.name` and never looks at
         // `field`. An entry authored in the spec-canonical spelling therefore
         // used to survive every metadata-aware filter and then render a header
         // over `row[undefined]` — blank cells, no warning (objectui#5022; the
         // objectui#3951 shape, one spelling over).
         //
         // The stamp goes HERE rather than in the table's normalization
         // because `accessorKey` is the table LIBRARY's key, not metadata:
         // `column-identity.ts` names it `TABLE_ADAPTER_COLUMN_KEY` and keeps
         // the canonicalizing fold away from it on purpose. Resolving the
         // metadata vocabulary inside the adapter would merge the two
         // vocabularies in the one place that module says must stay separate;
         // translating at the boundary keeps the adapter monolingual.
         //
         // Mirror, don't move: the authored spelling is left in place (a host
         // reading `field`/`name` off these columns keeps working), and an
         // author-supplied `accessorKey` is never overwritten — a deliberate
         // divergence between the table slot and the metadata key belongs to
         // the author. An entry with no resolvable identity is returned
         // untouched, so nothing is invented for it.
         const key = c?.accessorKey || columnIdentity(c);
         if (!c || !key) return c;
         const patch: Record<string, unknown> = {};
         if (!c.accessorKey) patch.accessorKey = key;
         // Attach a cell renderer when it lacks one and we can resolve the
         // field def — preserves any author-supplied cell/render.
         if (!c.cell && !c.render) {
           const def = (objectSchema?.fields as any)?.[key];
           const cell = def ? makeCell(String(key), def) : undefined;
           if (cell) patch.cell = cell;
         }
         // Nothing to add: return the INPUT entry by reference, so the
         // downstream `useMemo`s keep a stable dependency on the common path.
         return Object.keys(patch).length > 0 ? { ...c, ...patch } : c;
       }
       const fieldDef = objectSchema?.fields?.[c] as any;
       const header = fieldDef?.label || resolveFieldLabel(relatedObjectName, c, fieldDef) || c;
       const col: any = { accessorKey: c, header, fieldDef, fieldType: fieldDef?.type };
       const cell = fieldDef ? makeCell(c, fieldDef) : undefined;
       if (cell) col.cell = cell;
       return col;
     };
     if (columns && columns.length > 0) {
       const normalized = columns.map(normalizeColumn);
       return pruneEmpty(filterFLS(filterFK(normalized)));
     }
    if (!objectSchema?.fields) return [];

    // ADR-0085 prominence: when the child object declares `highlightFields` —
    // the canonical "how to list this object" set, the SAME source the lookup
    // picker (`deriveLookupColumns`) leads with — auto-derive from those before
    // the heuristic field walk below, so a related list and a picker of the
    // same object agree on columns with zero per-surface config. Run through the
    // identical normalize / FK / FLS / empty pruning as explicit columns; fall
    // through to the walk if nothing survives (e.g. all FLS-blocked).
    const declaredHighlights = Array.isArray((objectSchema as any).highlightFields)
      ? ((objectSchema as any).highlightFields as any[]).filter(
          (n): n is string => typeof n === 'string' && n.length > 0,
        )
      : [];
    if (declaredHighlights.length > 0) {
      const hf = pruneEmpty(filterFLS(filterFK(declaredHighlights.map(normalizeColumn))));
      if (hf.length > 0) return hf.slice(0, Math.max(1, maxColumns));
    }

    const resolvedObjectName = relatedObjectName;
    // file/image are NOT skipped: they have dedicated cell renderers (name
    // chip / thumbnail), and dropping them hid business columns like a line's
    // receipt attachment (objectui#2360). Only types with no useful tabular
    // rendering stay excluded. (`attachment` is intentionally absent — it is not
    // a `@objectstack/spec` field type, so the renderer does not model it, #2655.)
    //
    // SPELLING: matched against the RAW `def.type`, so every member must be a
    // `@objectstack/spec` `FieldType` name. `rich_text` was not one. The spec
    // spells the type `richtext` and REJECTS `rich_text` / `rich-text`
    // outright — they survive only as typo keys in the spec's own
    // `suggestFieldType` table, i.e. spellings no producer can emit. So the
    // member excluded nothing while a real `richtext` field fell straight
    // through into a derived column (#4250).
    //
    // `markdown` joins its siblings on MEASURED behaviour, not on the
    // raw-markup story: markdown, richtext and html all render FORMATTED here
    // (the first two via `MarkdownCellRenderer`, html via `HtmlCellRenderer`).
    // What makes all three unusable in a table is that the formatted output is
    // BLOCK-level (`<h1>` / `<p>` / `<ul>`) inside a `truncate` single-line
    // cell, so a document renders as one clipped heading with the rest
    // invisible. `textarea` stays OUT by the same measurement read the other
    // way — it renders as plain truncated text, which is a useful cell.
    // Author-declared columns are unaffected: this set only filters the
    // zero-config auto-derive walk.
    const SKIP_TYPES = new Set(['richtext', 'markdown', 'html', 'json']);
    const PRIORITY_NAMES = [
      'name',
      'full_name',
      'fullname',
      'title',
      'subject',
      'label',
      'code',
      'number',
    ];
    const entries = Object.entries(objectSchema.fields)
      .filter(([key, def]: [string, any]) => {
        if (key.startsWith('_')) return false;
        if (key === 'id' || key === referenceField) return false;
        if (def?.hidden) return false;
        if (def?.type && SKIP_TYPES.has(def.type)) return false;
        // FLS: drop unreadable fields from auto-derived columns too.
        if (perms?.isLoaded && resolvedObjectName
            && !perms.checkField(resolvedObjectName, key, 'read')) {
          return false;
        }
        return true;
      });

    // System audit fields are technically real columns, but they should never
    // *lead* an auto-derived related list — a child object with no name/title
    // (e.g. invoice lines) would otherwise show "Created At / Last Modified At"
    // before its business fields (qty, price, amount). Push them last so the
    // maxColumns slice keeps the meaningful columns.
    const SYSTEM_LAST = new Set([
      'created_at', 'updated_at', 'created_by', 'updated_by',
      'owner_id', 'organization_id',
    ]);
    // Sort by priority: name-like → status/select → others → system audit last.
    entries.sort(([aKey, aDef]: any, [bKey, bDef]: any) => {
      const aSys = SYSTEM_LAST.has(aKey);
      const bSys = SYSTEM_LAST.has(bKey);
      if (aSys !== bSys) return aSys ? 1 : -1;
      const aPri = PRIORITY_NAMES.indexOf(aKey);
      const bPri = PRIORITY_NAMES.indexOf(bKey);
      const aScore = aPri >= 0 ? aPri : 100;
      const bScore = bPri >= 0 ? bPri : 100;
      if (aScore !== bScore) return aScore - bScore;
      const aIsStatus = aDef?.type === 'select' || aKey.includes('status');
      const bIsStatus = bDef?.type === 'select' || bKey.includes('status');
      if (aIsStatus !== bIsStatus) return aIsStatus ? -1 : 1;
      return 0;
    });

    const generated = entries.map(([key, def]: [string, any]) => {
      const col: any = {
        accessorKey: key,
        header: resolveFieldLabel(resolvedObjectName, key, def.label || key),
      };
      if (def.type) {
        const cell = makeCell(key, def);
        if (cell) col.cell = cell;
      }
      return col;
    });

    const pruned = pruneEmpty(generated);
    return pruned.slice(0, Math.max(1, maxColumns));
  }, [columns, objectSchema, objectName, api, resolveFieldLabel, referenceField, relatedData, maxColumns, lookupLabels, perms]);

  /**
   * The same columns, with the sort affordance withheld from the ones a server
   * `$orderby` cannot honestly order by.
   *
   * A windowed sort goes out as `$orderby` on the flat field name, and two kinds
   * of column cannot survive that trip (objectui#3096, #3950):
   *
   *  - a relational column stores a foreign-key id, so "sort by Owner" would
   *    order the collection by `rec_7f3…` while the cells show names
   *    (objectstack#4256 settled that no relation join is coming);
   *  - a `formula` column has no materialised column to order by at all —
   *    silently unordered rows under a `200` before objectstack#6994, a
   *    `400 INVALID_SORT` after it.
   *
   * This is the rule the sort-button row already applied; the headers inherit it
   * rather than re-opening the same door.
   *
   * In client mode the sort keys off the value the cell shows — the resolved
   * label, the hydrated formula result — so those headers stay live: the same
   * split `sortedData` makes.
   */
  const sortableColumns = React.useMemo(() => {
    if (!windowed) return effectiveColumns;
    return effectiveColumns.map((col: any) => {
      const field = col.accessorKey || columnIdentity(col);
      const fieldDef = field ? (objectSchema?.fields as any)?.[field] : undefined;
      return isExpandableFieldType(fieldDef) || isUnmaterializedFieldType(fieldDef)
        ? { ...col, sortable: false }
        : col;
    });
  }, [effectiveColumns, windowed, objectSchema]);

  // A `grid`/`table` list renders a real table, whose column headers carry the
  // sort. `list` renders `data-list`, which has none — so it keeps the button
  // row as its only sort control. A caller-supplied `schema` renders whatever
  // it says, so we cannot claim headers for it either.
  const hasSortableHeaders = !schema && (type === 'grid' || type === 'table');

  const hasCustomRowActions = Array.isArray(rowActions) && rowActions.length > 0;
  const hasRowActions = !!onRowEdit || !!onRowDelete || hasCustomRowActions;
  const isMobile = useIsMobile();

  const viewSchema = React.useMemo(() => {
    if (schema) return schema;

    // Mobile: render grid/table data as a card gallery — single-column,
    // tap-friendly, visually consistent with the standalone gallery view.
    // Reuses the registered `object-gallery` schema so we don't ship a
    // duplicate renderer. Falls back to the data-table on desktop and
    // when explicit `type='list'` is requested (legacy path).
    if (isMobile && (type === 'grid' || type === 'table')) {
      const titleField = effectiveColumns[0]?.accessorKey || columnIdentity(effectiveColumns[0]);
      const visibleFields = effectiveColumns
        .slice(1, 4)
        .map((c: any) => c.accessorKey || columnIdentity(c))
        .filter(Boolean);
      return {
        type: 'object-gallery',
        data: paginatedData,
        objectName: api,
        gallery: {
          titleField: titleField || 'name',
          visibleFields,
          cardSize: 'medium',
        },
        onRowClick,
      };
    }

    // Per-record CEL predicates for the built-in row Edit/Delete, from the
    // CHILD object's `userActions.edit` / `delete` object form (#2614) — the
    // master-detail case where a child row freezes on a parent state change
    // renders through this path. Boolean forms yield no predicates. Parsed by
    // the shared `@object-ui/core` normalizer so there is one parser platform-wide.
    const rowEditPredicates = userActionPredicates(objectSchema?.userActions?.edit);
    const rowDeletePredicates = userActionPredicates(objectSchema?.userActions?.delete);

    // Auto-generate schema based on type. We disable the data-table's own
    // search/toolbar — RelatedList provides its own filter input above.
    switch (type) {
      case 'grid':
      case 'table':
        return {
          type: 'data-table',
          data: paginatedData,
          columns: sortableColumns,
          pagination: false, // We handle pagination ourselves
          pageSize: effectivePageSize || 10,
          searchable: false,
          exportable: false,
          // Sorting is THIS list's, in both modes (objectui#3106).
          //
          // Windowed: `data` is one page, so a table-local sort would order
          // that page and call it the list — the defect. Client mode: this
          // list's own sort resolves a relational column through the label map
          // it built (`lookupLabels`), which the table cannot see, so its sort
          // is the better one even when both are possible.
          //
          // Either way there is now ONE sort behind the headers instead of a
          // table-local order sitting on top of a server order.
          manualSorting: true,
          sort: activeSort,
          onSortChange: handleTableSort,
          rowActions: hasRowActions,
          onRowEdit,
          onRowDelete: onRowDelete ? handleDeleteRow : undefined,
          rowEditPredicates,
          rowDeletePredicates,
          onRowClick,
          // Child-object row actions (locations:['list_item']) rendered in the
          // same overflow menu, dispatched with the clicked row as target.
          rowActionDefs: hasCustomRowActions ? rowActions : undefined,
          onRowActionDef: hasCustomRowActions ? onRowAction : undefined,
        };
      case 'list':
        return {
          type: 'data-list',
          data: paginatedData,
        };
      default:
        return { type: 'div', children: 'No view configured' };
    }
  }, [type, paginatedData, sortableColumns, effectiveColumns, schema, effectivePageSize, hasRowActions, hasCustomRowActions, rowActions, onRowAction, onRowEdit, onRowDelete, handleDeleteRow, onRowClick, isMobile, api, objectSchema, activeSort, handleTableSort]);

  const headerClassName = collapsible ? 'cursor-pointer select-none' : undefined;
  const handleHeaderClick = collapsible ? () => setCollapsed((c) => !c) : undefined;

  const SectionIcon = resolveIconComponent(icon);
  // Badge shows the COLLECTION size: the server total in windowed mode (only
  // one page is in memory), the loaded row count otherwise.
  const recordCount = windowed && total != null ? total : relatedData.length;
  // In windowed mode an empty page beyond page 0 is a transient overflow (the
  // step-back effect above corrects it), not an empty collection.
  const isEmpty = !loading && relatedData.length === 0 && (!windowed || currentPage === 0);
  // When the consumer explicitly enables `filterable`, always render the
  // filter input — they're opting in. (data-table's own auto-search is
  // suppressed via the viewSchema below to avoid a duplicate input.)
  const showFilterInput = filterable;

  return (
    <Card className={cn('shadow-none border-border/60 bg-transparent', isEmpty && 'bg-muted/10', className)}>
      <CardHeader
        className={cn('py-3 px-4 sm:py-3 min-h-12 sm:min-h-0', headerClassName)}
        onClick={handleHeaderClick}
      >
        <CardTitle className="flex items-center justify-between gap-2 text-sm font-semibold">
          <div className="flex items-center gap-2 min-w-0">
            {collapsible && (
              collapsed
                ? (<ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />)
                : (<ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />)
            )}
            {/* eslint-disable-next-line react-hooks/static-components -- resolveIconComponent returns a stable icon component from a static registry, not a component created during render */}
            <SectionIcon className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
            <span className={cn('truncate', isEmpty && 'text-muted-foreground font-medium')}>
              {title}
            </span>
            <Badge
              variant="secondary"
              className={cn(
                'text-xs font-normal h-5 px-1.5',
                recordCount === 0 && 'bg-muted text-muted-foreground'
              )}
              aria-label={`${recordCount} records`}
            >
              {recordCount}
            </Badge>
            {isEmpty && (
              <span className="text-xs text-muted-foreground/70 italic ml-1 truncate">
                {t('detail.noRelatedRecords')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Child-object list_toolbar actions (e.g. Invite User) — the
                related-list equivalent of the object list's toolbar buttons.
                Rendered before Add/New so the domain action leads. */}
            {onToolbarAction && (toolbarActions ?? []).map((a) => (
              <RelatedToolbarButton
                key={a.name}
                action={a}
                onToolbarAction={onToolbarAction}
              />
            ))}
            {/* Gated on the RESOLVED picker target, not merely on `add` being
                truthy: an `add` without `picker` is metadata the spec rejects,
                and offering a button that could never open a picker is worse
                than withholding it (#3838 — the console hint above names the
                missing key).

                `dataSource` is part of the SAME gate, because the dialog this
                button opens (below, `add && pickerObject && dataSource`) and the
                callback it ends in (`handleAddRecords`: `if (!add ||
                !dataSource || …) return`) both require it. Without it the button
                rendered, `setPickerOpen(true)` ran, and no dialog existed to
                observe the flag: a click with NO visible reaction and no
                message. Hosts where that is real are the ones passing
                `dataSource={ctx?.dataSource}` with no `RecordContext` bound —
                the Studio designer preview and context-free embeds
                (`renderers/record-related-list.tsx`). Same principle as #3838
                one condition further: an affordance is offered only where the
                capability behind it exists (objectui#3895). */}
            {add && pickerObject && dataSource && (
              <Button
                variant={isEmpty ? 'ghost' : 'outline'}
                size="sm"
                disabled={addBusy}
                onClick={(e) => { e.stopPropagation(); setAddError(null); setPickerOpen(true); }}
                className="gap-1 h-9 sm:h-7 text-xs shadow-none"
              >
                <Plus className="h-3.5 w-3.5" />
                {add.label || t('detail.add', { defaultValue: 'Add' })}
              </Button>
            )}
            {onNew && (
              <Button
                variant={isEmpty ? 'ghost' : 'outline'}
                size="sm"
                onClick={(e) => { e.stopPropagation(); onNew(); }}
                className="gap-1 h-9 sm:h-7 text-xs shadow-none"
              >
                <Plus className="h-3.5 w-3.5" />
                {t('detail.new')}
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      {!collapsed && !isEmpty && <CardContent className={cn('pt-0 pb-4 px-4')}>
        {/* Filter bar — only when records justify it */}
        {showFilterInput && (
          <div className="mb-3">
            <Input
              placeholder={t('detail.filterPlaceholder')}
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        )}

        {/* Sort buttons — only where there are no column headers to click.
            A `grid`/`table` related list renders a real table whose headers now
            drive this same sort (objectui#3106), so a second row of buttons
            above it would be two controls over one order — and, before the
            headers were wired up, two DIFFERENT orders: the buttons sorted the
            collection through the server while the headers sorted the page in
            the browser, in one card, with nothing saying so. `data-list` has no
            headers, so there the buttons stay the only way to sort. */}
        {sortable && !hasSortableHeaders && effectiveColumns && effectiveColumns.length > 0 && relatedData.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {effectiveColumns.map((col: any) => {
              const field = col.accessorKey || columnIdentity(col);
              if (!field) return null;
              // A windowed sort goes out as a server `$orderby` on the flat
              // field name, so a relational column would order the collection by
              // its stored foreign-key id while the cells show related-record
              // names — sorting looks broken (objectui#3096) — and a `formula`
              // column has no materialised column to order by at all, which the
              // platform now refuses outright (objectstack#6994, objectui#3950).
              // No button rather than a button that sorts by something invisible
              // or that cannot be answered. The client-mode branch keeps its
              // button: there the sort key is the value the cell shows (see
              // `sortedData`).
              const fieldDef = (objectSchema?.fields as any)?.[field];
              if (windowed && (isExpandableFieldType(fieldDef) || isUnmaterializedFieldType(fieldDef))) {
                return null;
              }
              const label = col.header || col.label || field;
              const isActive = sortField === field;
              return (
                <Button
                  key={field}
                  variant={isActive ? 'secondary' : 'ghost'}
                  size="sm"
                  className="gap-1 h-7 text-xs"
                  onClick={() => handleSort(field)}
                >
                  <ArrowUpDown className="h-3 w-3" />
                  {label}
                  {isActive && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                </Button>
              );
            })}
          </div>
        )}

        {loading && relatedData.length === 0 ? (
          // Placeholder only while there's nothing to show (first load). Page
          // flips keep the previous rows in place (slightly dimmed) until the
          // next window arrives — swapping to a placeholder collapses the
          // card and makes the whole related section visibly jump.
          <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
            {t('detail.loading')}
          </div>
        ) : (
          <div className={cn(loading && 'opacity-60 pointer-events-none transition-opacity')}>
            <SchemaRenderer schema={viewSchema} />
          </div>
        )}

        {/* Pagination controls */}
        {showPagination && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-3 w-3" />
              {t('detail.previousPage')}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t('detail.pageOf', { current: currentPage + 1, total: totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={!canGoNext}
              onClick={() => setCurrentPage((p) => (canGoNext ? p + 1 : p))}
            >
              {t('detail.nextPage')}
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Footer "View all" link — only when records are truncated (more than displayed) */}
        {onViewAll && !isEmpty && showPagination && (
          <div className="mt-3 pt-3 border-t flex justify-center">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onViewAll(); }}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
            >
              {t('detail.viewAll')}
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        )}
      </CardContent>}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('detail.deleteRowTitle', { defaultValue: 'Delete record' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('detail.deleteRowConfirmation')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('detail.cancel', { defaultValue: 'Cancel' })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('detail.delete', { defaultValue: 'Delete' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {addError && (
        <div
          className="mx-4 mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {addError}
        </div>
      )}
      {/* Same gate as the Add button above — `pickerObject` (i.e.
          `add?.picker?.object`, computed once near the picker-schema fetch) is
          what the dialog needs, so requiring it here removes the last
          render-path bare read of `add.picker` rather than optional-chaining
          it: off-spec `add` still does nothing at all, so no second dialect
          appears (AGENTS.md #0.1). #3838. */}
      {add && pickerObject && dataSource && (
        <RecordPickerDialog
          open={pickerOpen}
          onOpenChange={(o) => setPickerOpen(o)}
          multiple
          dataSource={dataSource as any}
          objectName={pickerObject}
          title={add.label || t('detail.add', { defaultValue: 'Add' })}
          displayField={pickerDisplayField}
          columns={pickerColumns}
          cellRenderer={getCellRenderer}
          fieldsMeta={pickerSchema?.fields}
          // The author's candidate restriction, handed over VERBATIM (#3831).
          // `baseFilter` — never `lookupFilters`, which renders its entries as
          // filter-bar rows the user can edit, i.e. demotes the restriction to a
          // suggestion. The picker lowers the rule array through the repo's
          // single filter sink, so no conversion belongs on this side.
          baseFilter={add.picker.filter}
          onSelect={() => {}}
          onSelectRecords={(records: any[]) => { void handleAddRecords(records); }}
        />
      )}
    </Card>
  );
};
