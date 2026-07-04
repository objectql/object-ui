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
import { SchemaRenderer, type RelatedRowActionDef } from '@object-ui/react';
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
import { getCellRenderer, resolveCellRendererType, RecordPickerDialog } from '@object-ui/fields';
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
   */
  add?: {
    picker: { object: string; valueField?: string; labelField?: string; filter?: any };
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
  /** Maximum number of columns to auto-generate. Default 6. */
  maxColumns?: number;
  /** Page size for pagination (enables pagination when set) */
  pageSize?: number;
  /** Enable column sorting */
  sortable?: boolean;
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
  add,
  maxColumns = 6,
  pageSize,
  sortable = false,
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

  React.useEffect(() => {
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
          // eslint-disable-next-line no-console
          console.warn(
            `[RelatedList] "${api}" has no referenceField/parentId — refusing to fetch all rows. Pass relationshipField + parentId to scope the query.`,
          );
        }
        setRelatedData([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const filter = { [referenceField!]: parentId } as Record<string, any>;
      if (dataSource && typeof dataSource.find === 'function') {
        dataSource.find(api, { $filter: filter }).then((result) => {
          const items = Array.isArray(result)
            ? result
            : Array.isArray((result as any)?.data)
              ? (result as any).data
              : [];
          setRelatedData(items);
          setLoading(false);
        }).catch((err) => {
          console.error('Failed to fetch related data:', err);
          setLoading(false);
        });
      } else {
        const qs = new URLSearchParams({
          [`filter[${referenceField}]`]: String(parentId),
        }).toString();
        fetch(`${api}?${qs}`)
          .then(res => res.json())
          .then(result => {
            const items = Array.isArray(result) ? result : (result?.data || []);
            setRelatedData(items);
          })
          .catch(err => {
            console.error('Failed to fetch related data:', err);
          })
          .finally(() => setLoading(false));
      }
    }
  }, [api, dataProvided, dataSource, referenceField, parentId, refreshNonce]);

  // Refetch when a mutation elsewhere signals this related object changed —
  // e.g. a child row action executed through the host retargets `api` and
  // dispatches `objectui:related-changed`. Only meaningful on the auto-fetch
  // path (parent-provided data is refreshed by the parent).
  React.useEffect(() => {
    if (!api || dataProvided) return;
    const onChanged = (ev: Event) => {
      const detail = (ev as CustomEvent).detail || {};
      if (detail.objectName && detail.objectName !== api) return;
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
        dataSource
          .find(target, { $filter: { id: { $in: ids } }, $top: ids.length })
          .then((res: any) => {
            const records: any[] = Array.isArray(res) ? res : res?.data || [];
            const map: Record<string, string> = {};
            for (const r of records) {
              const id = r?.id || r?._id;
              if (!id) continue;
              map[String(id)] =
                r?.full_name ||
                r?.fullname ||
                r?.display_name ||
                r?.name ||
                r?.subject ||
                r?.title ||
                r?.label ||
                r?.code ||
                r?.email ||
                String(id);
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

  // Filter data
  const filteredData = React.useMemo(() => {
    if (!filterText) return relatedData;
    const lower = filterText.toLowerCase();
    return relatedData.filter((row) =>
      Object.values(row).some((val) =>
        val !== null && val !== undefined && String(val).toLowerCase().includes(lower)
      )
    );
  }, [relatedData, filterText]);

  // Sort data
  const sortedData = React.useMemo(() => {
    if (!sortField) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filteredData, sortField, sortDirection]);

  // Paginate data
  const effectivePageSize = pageSize && pageSize > 0 ? pageSize : 0;
  const totalPages = effectivePageSize ? Math.max(1, Math.ceil(sortedData.length / effectivePageSize)) : 1;
  const paginatedData = effectivePageSize
    ? sortedData.slice(currentPage * effectivePageSize, (currentPage + 1) * effectivePageSize)
    : sortedData;

  // Reset to first page when filter/sort changes
  React.useEffect(() => {
    setCurrentPage(0);
  }, [filterText, sortField, sortDirection]);

  const handleSort = React.useCallback((field: string) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

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
        const key = c?.accessorKey || c?.field || c?.name;
        if (!key) return true;
        return perms.checkField(relatedObjectName, String(key), 'read');
      });
    };
    const filterFK = (cols: any[]): any[] =>
      referenceField
        ? cols.filter((c) => {
            const key = c?.accessorKey || c?.field || c?.name;
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
        const key = c?.accessorKey || c?.field || c?.name;
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
         // Object column: attach a cell renderer when it lacks one and we can
         // resolve the field def — preserves any author-supplied cell/render.
         const key = c?.accessorKey || c?.field || c?.name;
         if (c && !c.cell && !c.render && key) {
           const def = (objectSchema?.fields as any)?.[key];
           const cell = def ? makeCell(String(key), def) : undefined;
           if (cell) return { ...c, cell };
         }
         return c;
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

    const resolvedObjectName = relatedObjectName;
    const SKIP_TYPES = new Set(['image', 'file', 'attachment', 'rich_text', 'html', 'json']);
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
      const titleField = effectiveColumns[0]?.accessorKey || effectiveColumns[0]?.field || effectiveColumns[0]?.name;
      const visibleFields = effectiveColumns
        .slice(1, 4)
        .map((c: any) => c.accessorKey || c.field || c.name)
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

    // Auto-generate schema based on type. We disable the data-table's own
    // search/toolbar — RelatedList provides its own filter input above.
    switch (type) {
      case 'grid':
      case 'table':
        return {
          type: 'data-table',
          data: paginatedData,
          columns: effectiveColumns,
          pagination: false, // We handle pagination ourselves
          pageSize: effectivePageSize || 10,
          searchable: false,
          exportable: false,
          rowActions: hasRowActions,
          onRowEdit,
          onRowDelete: onRowDelete ? handleDeleteRow : undefined,
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
  }, [type, paginatedData, effectiveColumns, schema, effectivePageSize, hasRowActions, hasCustomRowActions, rowActions, onRowAction, onRowEdit, onRowDelete, handleDeleteRow, onRowClick, isMobile, api]);

  const headerClassName = collapsible ? 'cursor-pointer select-none' : undefined;
  const handleHeaderClick = collapsible ? () => setCollapsed((c) => !c) : undefined;

  const SectionIcon = resolveIconComponent(icon);
  const isEmpty = !loading && relatedData.length === 0;
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
            <SectionIcon className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
            <span className={cn('truncate', isEmpty && 'text-muted-foreground font-medium')}>
              {title}
            </span>
            <Badge
              variant="secondary"
              className={cn(
                'text-xs font-normal h-5 px-1.5',
                relatedData.length === 0 && 'bg-muted text-muted-foreground'
              )}
              aria-label={`${relatedData.length} records`}
            >
              {relatedData.length}
            </Badge>
            {isEmpty && (
              <span className="text-xs text-muted-foreground/70 italic ml-1 truncate">
                {t('detail.noRelatedRecords')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {add && (
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

        {/* Sortable column headers */}
        {sortable && effectiveColumns && effectiveColumns.length > 0 && relatedData.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {effectiveColumns.map((col: any) => {
              const field = col.accessorKey || col.field || col.name;
              if (!field) return null;
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

        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
            {t('detail.loading')}
          </div>
        ) : (
          <SchemaRenderer schema={viewSchema} />
        )}

        {/* Pagination controls */}
        {effectivePageSize > 0 && sortedData.length > effectivePageSize && (
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
              disabled={currentPage >= totalPages - 1}
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              {t('detail.nextPage')}
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Footer "View all" link — only when records are truncated (more than displayed) */}
        {onViewAll && !isEmpty && effectivePageSize > 0 && sortedData.length > effectivePageSize && (
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
      {add && dataSource && (
        <RecordPickerDialog
          open={pickerOpen}
          onOpenChange={(o) => setPickerOpen(o)}
          multiple
          dataSource={dataSource as any}
          objectName={add.picker.object}
          title={add.label || t('detail.add', { defaultValue: 'Add' })}
          onSelect={() => {}}
          onSelectRecords={(records: any[]) => { void handleAddRecords(records); }}
        />
      )}
    </Card>
  );
};
