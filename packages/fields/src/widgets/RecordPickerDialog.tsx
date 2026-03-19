import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Checkbox,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Separator,
  Skeleton,
} from '@object-ui/components';
import {
  Search,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { DataSource, QueryParams, LookupColumnDef, LookupFilterDef } from '@object-ui/types';

/** Default page size for the Record Picker dialog */
const DEFAULT_PAGE_SIZE = 10;

/** Minimum column width when resizing (px) */
const MIN_COL_WIDTH = 60;

/** Number of skeleton rows displayed during initial loading */
const SKELETON_ROW_COUNT = 5;

/**
 * Cell renderer function signature — matches getCellRenderer from @object-ui/fields.
 * Accepts a field type and returns a React component that renders a formatted cell.
 */
export type CellRendererResolver = (fieldType: string) => React.FC<{ value: any; field: any }>;

/**
 * Filter column definition used by the inline filter bar.
 * A subset of LookupColumnDef enriched with filter-specific metadata.
 * Compatible with FilterUISchema.filters entries for easy bridging.
 */
export interface RecordPickerFilterColumn {
  field: string;
  label?: string;
  type: 'text' | 'number' | 'select' | 'date' | 'boolean';
  options?: Array<{ label: string; value: any }>;
}

/**
 * Props passed to the custom filter bar renderer (renderFilterBar slot).
 * Allows plugging in FilterUI or any custom component.
 */
export interface RecordPickerFilterBarProps {
  /** Filter column definitions describing each filterable field */
  filterColumns: RecordPickerFilterColumn[];
  /** Current filter values keyed by field name */
  values: Record<string, any>;
  /** Called when a single filter value changes */
  onChange: (field: string, value: any) => void;
  /** Clear all filter values */
  onClear: () => void;
  /** Number of actively applied filters */
  activeCount: number;
}

/**
 * Props passed to the custom grid renderer (renderGrid slot).
 * Allows plugging in ObjectGrid or any compatible table component.
 */
export interface RecordPickerGridSlotProps {
  /** Resolved column definitions */
  columns: LookupColumnDef[];
  /** Current page of records */
  records: any[];
  /** Whether data is loading */
  loading: boolean;
  /** Total record count across all pages */
  totalCount: number;
  /** Current page number (1-based) */
  currentPage: number;
  /** Records per page */
  pageSize: number;
  /** Current sort field, null if unsorted */
  sortField: string | null;
  /** Current sort direction */
  sortDirection: 'asc' | 'desc';
  /** Called when a column header is clicked to sort */
  onSort: (field: string) => void;
  /** Called when page changes */
  onPageChange: (page: number) => void;
  /** Called when a row is clicked */
  onRowClick: (record: any) => void;
  /** Check if a record is selected */
  isSelected: (record: any) => boolean;
  /** Whether multiple selection is enabled */
  multiple: boolean;
  /** Record ID field name */
  idField: string;
  /** Cell renderer resolver */
  cellRenderer?: CellRendererResolver;
}

/**
 * Normalise a lookup_columns entry (string | LookupColumnDef) into a
 * concrete LookupColumnDef object.
 */
function normalizeColumn(col: string | LookupColumnDef): LookupColumnDef {
  return typeof col === 'string' ? { field: col } : col;
}

/**
 * Pretty-print a field name as a column header label.
 * Converts snake_case / camelCase to Title Case.
 */
function fieldToLabel(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Convert LookupFilterDef[] to a Record<string, any> compatible with
 * QueryParams.$filter.  Supports operator mapping for eq/ne/gt/lt/gte/lte/
 * contains/in/notIn.
 */
function lookupFiltersToRecord(
  filters: LookupFilterDef[],
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const f of filters) {
    switch (f.operator) {
      case 'eq':
        result[f.field] = f.value;
        break;
      case 'ne':
        result[f.field] = { $ne: f.value };
        break;
      case 'gt':
        result[f.field] = { $gt: f.value };
        break;
      case 'lt':
        result[f.field] = { $lt: f.value };
        break;
      case 'gte':
        result[f.field] = { $gte: f.value };
        break;
      case 'lte':
        result[f.field] = { $lte: f.value };
        break;
      case 'contains':
        result[f.field] = { $contains: f.value };
        break;
      case 'in':
        result[f.field] = { $in: f.value };
        break;
      case 'notIn':
        result[f.field] = { $nin: f.value };
        break;
    }
  }
  return result;
}

/**
 * Convert user-entered filter bar values into a $filter Record.
 * Each key is a field name, each value the user-entered value.
 * Empty/null values are ignored.
 */
function filterValuesToRecord(
  values: Record<string, any>,
  filterColumns: RecordPickerFilterColumn[],
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const col of filterColumns) {
    const v = values[col.field];
    if (v === undefined || v === null || v === '') continue;
    if (col.type === 'boolean') {
      result[col.field] = Boolean(v);
    } else if (col.type === 'text') {
      result[col.field] = { $contains: v };
    } else {
      result[col.field] = v;
    }
  }
  return result;
}

export interface RecordPickerDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when the dialog should close */
  onOpenChange: (open: boolean) => void;

  /** Dialog title */
  title?: string;
  /** Allow multiple selection */
  multiple?: boolean;

  /** DataSource to fetch records from */
  dataSource: DataSource;
  /** Object name to query (e.g. 'customers') */
  objectName: string;

  /** Columns to display. Defaults to [displayField, descriptionField]. */
  columns?: Array<string | LookupColumnDef>;
  /** Primary display field (default: 'name') */
  displayField?: string;
  /** Record id field (default: 'id') */
  idField?: string;

  /** Page size (default: 10) */
  pageSize?: number;

  /** Currently selected value(s) */
  value?: any;
  /** Called when selection changes */
  onSelect: (value: any) => void;

  /**
   * Base filters applied to every query.
   * Converted from LookupFieldMetadata.lookup_filters.
   * Restricts which records are selectable (e.g. only active records).
   */
  lookupFilters?: LookupFilterDef[];

  /**
   * Cell renderer resolver function.
   * When provided, columns with a `type` property will be rendered using the
   * resolved cell renderer (e.g. badges for select, formatted currency, etc.).
   * Typically pass `getCellRenderer` from @object-ui/fields.
   */
  cellRenderer?: CellRendererResolver;

  /**
   * Filter bar column definitions.
   * When provided, shows an inline filter bar below the search input.
   * Columns can include type-specific inputs (text, number, select, date, boolean).
   */
  filterColumns?: RecordPickerFilterColumn[];

  /**
   * Custom filter bar renderer slot.
   * When provided, replaces the built-in filter bar with a custom component
   * (e.g. FilterUI from @object-ui/plugin-view).
   * Receives filter state and callbacks via RecordPickerFilterBarProps.
   *
   * @example
   * renderFilterBar={(props) => (
   *   <FilterUI
   *     schema={{ type: 'filter-ui', filters: props.filterColumns, layout: 'inline' }}
   *     onChange={(values) => Object.entries(values).forEach(([k, v]) => props.onChange(k, v))}
   *   />
   * )}
   */
  renderFilterBar?: (props: RecordPickerFilterBarProps) => React.ReactNode;

  /**
   * Custom grid renderer slot.
   * When provided, replaces the built-in table with a custom grid component
   * (e.g. ObjectGrid from @object-ui/plugin-grid).
   * Receives data, columns, and interaction callbacks via RecordPickerGridSlotProps.
   *
   * @example
   * renderGrid={(props) => (
   *   <ObjectGrid
   *     schema={{ type: 'object-grid', objectName, columns: props.columns }}
   *     dataSource={dataSource}
   *   />
   * )}
   */
  renderGrid?: (props: RecordPickerGridSlotProps) => React.ReactNode;
}

/**
 * RecordPickerDialog — Enterprise-grade record selection dialog.
 *
 * Renders records in a table with multi-column display, search,
 * pagination, column sorting, keyboard navigation, loading/error/empty
 * states, and single/multi-select.  Responsive: mobile-friendly width
 * via Tailwind breakpoints.
 */
export function RecordPickerDialog({
  open,
  onOpenChange,
  title = 'Select Record',
  multiple = false,
  dataSource,
  objectName,
  columns: columnsProp,
  displayField = 'name',
  idField = 'id',
  pageSize = DEFAULT_PAGE_SIZE,
  value,
  onSelect,
  lookupFilters,
  cellRenderer,
  filterColumns,
  renderFilterBar,
  renderGrid,
}: RecordPickerDialogProps) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Column sorting state
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // For multi-select, track pending selections before confirming
  const [pendingSelection, setPendingSelection] = useState<Set<any>>(new Set());

  // Keyboard navigation: focused row index
  const [focusedRow, setFocusedRow] = useState(-1);
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);

  // Filter bar state
  const [filterBarOpen, setFilterBarOpen] = useState(false);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});

  // Column resize state: widths keyed by field name
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizeRef = useRef<{ field: string; startX: number; startWidth: number } | null>(null);

  // Page jump input state
  const [pageJumpValue, setPageJumpValue] = useState('');

  // Resolved columns
  const resolvedColumns = useMemo<LookupColumnDef[]>(() => {
    if (columnsProp && columnsProp.length > 0) {
      return columnsProp.map(normalizeColumn);
    }
    // Auto-infer: just use displayField
    return [{ field: displayField, label: fieldToLabel(displayField) }];
  }, [columnsProp, displayField]);

  // Auto-generate filter columns from lookupFilters when no explicit filterColumns given.
  // Each LookupFilterDef becomes a filterable field with inferred type.
  const effectiveFilterColumns = useMemo<RecordPickerFilterColumn[] | undefined>(() => {
    if (filterColumns && filterColumns.length > 0) return filterColumns;
    // Auto-derive from lookupFilters: each filter entry becomes a filterable field
    if (lookupFilters && lookupFilters.length > 0) {
      return lookupFilters.map(f => {
        // Infer filter input type from value type first, then fall back to operator
        let type: RecordPickerFilterColumn['type'] = 'text';
        if (typeof f.value === 'boolean') {
          type = 'boolean';
        } else if (Array.isArray(f.value)) {
          type = 'select';
        } else if (typeof f.value === 'number') {
          type = 'number';
        } else if (f.operator === 'gt' || f.operator === 'lt' || f.operator === 'gte' || f.operator === 'lte') {
          type = 'number';
        } else if (f.operator === 'in' || f.operator === 'notIn') {
          type = 'select';
        }
        return {
          field: f.field,
          label: fieldToLabel(f.field),
          type,
          // For array values (in/notIn), derive selectable options
          ...(Array.isArray(f.value) ? {
            options: (f.value as any[]).map(v => {
              if (v != null && typeof v === 'object') {
                const obj = v as Record<string, unknown>;
                return { label: String(obj.name || obj.label || obj.title || v), value: v };
              }
              return { label: String(v), value: v };
            }),
          } : {}),
        };
      });
    }
    return undefined;
  }, [filterColumns, lookupFilters]);

  // Merge base lookup_filters with user filter bar values
  const mergedFilter = useMemo<Record<string, any> | undefined>(() => {
    const baseFilter = lookupFilters?.length
      ? lookupFiltersToRecord(lookupFilters)
      : {};
    const userFilter = effectiveFilterColumns?.length
      ? filterValuesToRecord(filterValues, effectiveFilterColumns)
      : {};
    const combined = { ...baseFilter, ...userFilter };
    return Object.keys(combined).length > 0 ? combined : undefined;
  }, [lookupFilters, effectiveFilterColumns, filterValues]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Fetch records
  const fetchRecords = useCallback(
    async (search?: string, page = 1, sort?: { field: string; direction: 'asc' | 'desc' } | null, customFilter?: Record<string, any>) => {
      if (!dataSource || !objectName) return;

      setLoading(true);
      setError(null);

      try {
        const params: QueryParams = {
          $top: pageSize,
          $skip: (page - 1) * pageSize,
        };
        if (search && search.trim()) {
          params.$search = search.trim();
        }
        if (sort) {
          params.$orderby = { [sort.field]: sort.direction };
        }
        // Inject filters (lookup_filters + filter bar values)
        const effectiveFilter = customFilter !== undefined ? customFilter : mergedFilter;
        if (effectiveFilter && Object.keys(effectiveFilter).length > 0) {
          params.$filter = effectiveFilter;
        }

        const result = await dataSource.find(objectName, params);
        const data: any[] = result?.data ?? result ?? [];

        setRecords(data);
        setTotalCount(result?.total ?? data.length);
        setFocusedRow(-1);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setRecords([]);
      } finally {
        setLoading(false);
      }
    },
    [dataSource, objectName, pageSize, mergedFilter],
  );

  // Build current sort object for passing to fetchRecords
  const currentSort = useMemo(
    () => sortField ? { field: sortField, direction: sortDirection } : null,
    [sortField, sortDirection],
  );

  // Reset state when dialog closes — separate from the fetch effect so that
  // resetting currentPage / sortField (which are fetch-effect deps) does not
  // re-trigger the fetch effect and cause cascading re-renders (React #185).
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setCurrentPage(1);
      setError(null);
      setRecords([]);
      setSortField(null);
      setSortDirection('asc');
      setFocusedRow(-1);
      setFilterBarOpen(false);
      setFilterValues({});
      setColumnWidths({});
      setPageJumpValue('');
      setPendingSelection(new Set(
        multiple ? (Array.isArray(value) ? value : []) : [],
      ));
    }
    // Intentionally depends only on `open` — `multiple` and `value` are
    // captured at close-time and don't need to trigger resets while closed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fetch when dialog is open and pagination / sort / filter deps change
  useEffect(() => {
    if (open) {
      fetchRecords(searchQuery || undefined, currentPage, currentSort);
    }
    // `fetchRecords` and `searchQuery` are intentionally excluded:
    // fetchRecords is stable (useCallback), searchQuery triggers its own
    // debounced fetch in handleSearchChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentPage, currentSort, mergedFilter]);

  // Initialize pending selection when dialog opens
  useEffect(() => {
    if (open && multiple) {
      setPendingSelection(new Set(Array.isArray(value) ? value : []));
    }
  }, [open, multiple, value]);

  // Debounced search
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setCurrentPage(1);

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        fetchRecords(query || undefined, 1, currentSort);
      }, 300);
    },
    [fetchRecords, currentSort],
  );

  // Clean up debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // Column sort handler
  const handleSort = useCallback((field: string) => {
    setSortField(prev => {
      if (prev === field) {
        // Toggle direction
        setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        return field;
      }
      setSortDirection('asc');
      return field;
    });
    setCurrentPage(1);
  }, []);

  // Get record id
  const getRecordId = useCallback(
    (record: any) => record[idField] ?? record.id ?? record._id,
    [idField],
  );

  // Check if a record is selected
  const isSelected = useCallback(
    (record: any) => {
      const rid = getRecordId(record);
      if (multiple) {
        return pendingSelection.has(rid);
      }
      return value === rid;
    },
    [multiple, value, pendingSelection, getRecordId],
  );

  // Handle row click
  const handleRowClick = useCallback(
    (record: any) => {
      const rid = getRecordId(record);

      if (multiple) {
        setPendingSelection(prev => {
          const next = new Set(prev);
          if (next.has(rid)) {
            next.delete(rid);
          } else {
            next.add(rid);
          }
          return next;
        });
      } else {
        // Single select — immediately close
        onSelect(rid);
        onOpenChange(false);
      }
    },
    [multiple, getRecordId, onSelect, onOpenChange],
  );

  // Confirm multi-select
  const handleConfirm = useCallback(() => {
    onSelect(Array.from(pendingSelection));
    onOpenChange(false);
  }, [pendingSelection, onSelect, onOpenChange]);

  // Page navigation
  const handlePrevPage = useCallback(() => {
    setCurrentPage(p => Math.max(1, p - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage(p => Math.min(totalPages, p + 1));
  }, [totalPages]);

  // Page jump handler
  const handlePageJump = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return;
      const page = parseInt(pageJumpValue, 10);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        setCurrentPage(page);
      }
      setPageJumpValue('');
    },
    [pageJumpValue, totalPages],
  );

  // Keyboard navigation for the table
  const handleTableKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (records.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedRow(prev => Math.min(prev + 1, records.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedRow(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (focusedRow >= 0 && focusedRow < records.length) {
          handleRowClick(records[focusedRow]);
        }
      }
    },
    [records, focusedRow, handleRowClick],
  );

  // Scroll focused row into view
  useEffect(() => {
    if (focusedRow >= 0 && tableBodyRef.current) {
      const row = tableBodyRef.current.querySelector(`[data-row-index="${focusedRow}"]`);
      if (row && typeof row.scrollIntoView === 'function') {
        row.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [focusedRow]);

  // Get display value for a cell — type-aware rendering when cellRenderer is provided
  const renderCellContent = useCallback((record: any, col: LookupColumnDef): React.ReactNode => {
    const val = record[col.field];

    // Use type-aware renderer when column type and resolver are available
    if (col.type && cellRenderer) {
      const Renderer = cellRenderer(col.type);
      if (Renderer) {
        return <Renderer value={val} field={{ name: col.field, type: col.type } as any} />;
      }
    }

    // Fallback: plain text formatting
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
      // Handle MongoDB types / expanded references
      if (val.$numberDecimal) return String(Number(val.$numberDecimal));
      if (val.$oid) return String(val.$oid);
      if (val.$date) return new Date(val.$date).toLocaleDateString();
      if (val.name || val.label) return String(val.name || val.label);
      return JSON.stringify(val);
    }
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return String(val);
  }, [cellRenderer]);

  // Render sort indicator for a column
  const renderSortIcon = useCallback((field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 size-3 opacity-40" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="ml-1 size-3" />
      : <ArrowDown className="ml-1 size-3" />;
  }, [sortField, sortDirection]);

  // Column resize: mouse-down on drag handle
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, field: string, currentWidth: number) => {
      e.preventDefault();
      e.stopPropagation();
      resizeRef.current = { field, startX: e.clientX, startWidth: currentWidth };

      const handleMouseMove = (moveEvt: MouseEvent) => {
        if (!resizeRef.current) return;
        const delta = moveEvt.clientX - resizeRef.current.startX;
        const newWidth = Math.max(MIN_COL_WIDTH, resizeRef.current.startWidth + delta);
        setColumnWidths(prev => ({ ...prev, [resizeRef.current!.field]: newWidth }));
      };

      const handleMouseUp = () => {
        resizeRef.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [],
  );

  // Filter bar: update a single field value
  const handleFilterChange = useCallback(
    (field: string, val: any) => {
      setFilterValues(prev => ({ ...prev, [field]: val }));
      setCurrentPage(1);
    },
    [],
  );

  // Filter bar: clear all filter values
  const handleFilterClear = useCallback(() => {
    setFilterValues({});
    setCurrentPage(1);
  }, []);

  // Active filter count for badge
  const activeFilterCount = useMemo(
    () => Object.values(filterValues).filter(v => v !== undefined && v !== null && v !== '').length,
    [filterValues],
  );

  // Render a single filter bar input
  const renderFilterInput = useCallback(
    (col: RecordPickerFilterColumn) => {
      const val = filterValues[col.field];
      const label = col.label || fieldToLabel(col.field);

      switch (col.type) {
        case 'select':
          return (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <Select
                value={val !== undefined && val !== null ? String(val) : ''}
                onValueChange={v => handleFilterChange(col.field, v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={`Filter ${label}`} />
                </SelectTrigger>
                <SelectContent>
                  {col.options?.map(opt => (
                    <SelectItem key={String(opt.value)} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        case 'number':
          return (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                value={val ?? ''}
                placeholder={`Filter ${label}`}
                onChange={e => {
                  const raw = e.target.value;
                  handleFilterChange(col.field, raw === '' ? '' : Number(raw));
                }}
              />
            </div>
          );
        case 'date':
          return (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <Input
                type="date"
                className="h-8 text-xs"
                value={val ?? ''}
                onChange={e => handleFilterChange(col.field, e.target.value)}
              />
            </div>
          );
        case 'boolean':
          return (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <div className="flex items-center gap-2 h-8">
                <Checkbox
                  checked={Boolean(val)}
                  onCheckedChange={checked => handleFilterChange(col.field, Boolean(checked))}
                />
                <span className="text-xs text-muted-foreground">Yes</span>
              </div>
            </div>
          );
        case 'text':
        default:
          return (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <Input
                className="h-8 text-xs"
                value={val ?? ''}
                placeholder={`Filter ${label}`}
                onChange={e => handleFilterChange(col.field, e.target.value)}
              />
            </div>
          );
      }
    },
    [filterValues, handleFilterChange],
  );

  // Row background class logic: selected > odd-striped > default
  const getRowBgClass = useCallback((selected: boolean, idx: number) => {
    if (selected) return 'bg-primary/5 hover:bg-primary/10';
    if (idx % 2 === 1) return 'bg-muted/20 hover:bg-accent/30';
    return 'hover:bg-accent/30';
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[95vw] sm:max-w-3xl lg:max-w-5xl max-h-[85vh] sm:max-h-[80vh] flex flex-col gap-0"
        data-testid="record-picker-dialog"
      >
        <DialogHeader>
          <DialogTitle>
            {title}
            {multiple && <span className="sr-only"> (multiple selection)</span>}
          </DialogTitle>
        </DialogHeader>

        {/* Search bar */}
        <div className="relative rounded-md border bg-muted/30 mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 border-0 bg-transparent shadow-none focus-visible:ring-0"
            data-testid="record-picker-search"
          />
          {loading && (
            <Loader2
              className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground"
              data-testid="record-picker-loading-indicator"
            />
          )}
        </div>

        {/* Filter bar (inline) — supports external FilterUI via renderFilterBar slot */}
        {effectiveFilterColumns && effectiveFilterColumns.length > 0 && (
          <div className="py-2">
            {renderFilterBar ? (
              /* External filter bar (e.g. FilterUI from plugin-view) */
              <div data-testid="record-picker-filter-bar">
                {renderFilterBar({
                  filterColumns: effectiveFilterColumns,
                  values: filterValues,
                  onChange: handleFilterChange,
                  onClear: handleFilterClear,
                  activeCount: activeFilterCount,
                })}
              </div>
            ) : (
              /* Built-in filter bar (default) */
              <>
                <div className="flex items-center gap-2" data-testid="record-picker-filter-bar">
                  <Button
                    type="button"
                    variant={activeFilterCount > 0 ? 'secondary' : 'outline'}
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={() => setFilterBarOpen(prev => !prev)}
                  >
                    <SlidersHorizontal className="size-3.5" />
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-1 text-xs font-medium text-primary">
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>
                  {activeFilterCount > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={handleFilterClear}
                    >
                      <X className="size-3" />
                      Clear
                    </Button>
                  )}
                </div>
                {filterBarOpen && (
                  <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 border rounded-md p-3 bg-muted/30" data-testid="record-picker-filter-panel">
                    {effectiveFilterColumns.map(col => (
                      <div key={col.field}>{renderFilterInput(col)}</div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex flex-col items-center gap-2 py-4" role="alert">
            <AlertCircle className="size-5 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchRecords(searchQuery || undefined, currentPage, currentSort)}
              type="button"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Grid area — external ObjectGrid via renderGrid slot, or built-in table */}
        {renderGrid ? (
          /* External grid component (e.g. ObjectGrid from plugin-grid) */
          <div className="flex-1 min-h-0" data-testid="record-picker-grid-slot">
            {renderGrid({
              columns: resolvedColumns,
              records,
              loading,
              totalCount,
              currentPage,
              pageSize,
              sortField,
              sortDirection,
              onSort: handleSort,
              onPageChange: setCurrentPage,
              onRowClick: handleRowClick,
              isSelected,
              multiple,
              idField,
              cellRenderer,
            })}
          </div>
        ) : (
          /* Built-in table (default) */
          <>
            {/* Skeleton loading state (initial) */}
            {loading && records.length === 0 && !error && (
              <div className="flex-1 overflow-hidden min-h-0 border rounded-md" role="status" aria-live="polite" data-testid="record-picker-skeleton">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      {multiple && <TableHead className="w-10" />}
                      {resolvedColumns.map(col => (
                        <TableHead key={col.field}>
                          <Skeleton className="h-4 w-20" />
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
                      <TableRow key={i}>
                        {multiple && (
                          <TableCell className="w-10">
                            <Skeleton className="size-4 rounded" />
                          </TableCell>
                        )}
                        {resolvedColumns.map(col => (
                          <TableCell key={col.field}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && records.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No records found</p>
              </div>
            )}

            {/* Table */}
            {!error && records.length > 0 && (
              <div
                className="relative flex-1 overflow-auto min-h-0 border rounded-md"
                tabIndex={0}
                onKeyDown={handleTableKeyDown}
                role="grid"
                aria-label="Records"
              >
                {/* Loading overlay for subsequent fetches (page/sort/filter) */}
                {loading && (
                  <div
                    className="absolute inset-0 z-10 flex items-center justify-center bg-background/60"
                    data-testid="record-picker-loading-overlay"
                  >
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                )}
                <Table style={Object.keys(columnWidths).length > 0 ? { tableLayout: 'fixed' } : undefined}>
                  <TableHeader className="sticky top-0 z-[5] bg-muted/50 [&_tr]:border-b" data-testid="record-picker-sticky-header">
                    <TableRow>
                      {multiple && (
                        <TableHead className="w-10" />
                      )}
                      {resolvedColumns.map(col => {
                        const w = columnWidths[col.field];
                        const styleWidth = w ? { width: `${w}px`, minWidth: `${w}px` } : col.width ? { width: col.width } : undefined;
                        return (
                          <TableHead
                            key={col.field}
                            style={styleWidth}
                            className="cursor-pointer select-none relative group text-xs font-semibold uppercase tracking-wider"
                            onClick={() => handleSort(col.field)}
                            aria-sort={sortField === col.field ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                          >
                            <span className="inline-flex items-center">
                              {col.label || fieldToLabel(col.field)}
                              {renderSortIcon(col.field)}
                            </span>
                            {/* Column resize handle */}
                            <span
                              role="separator"
                              aria-orientation="vertical"
                              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize opacity-0 group-hover:opacity-100 bg-border hover:bg-primary/50 transition-opacity"
                              onMouseDown={e => {
                                const th = e.currentTarget.parentElement;
                                const rect = th?.getBoundingClientRect();
                                handleResizeStart(e, col.field, rect?.width ?? 100);
                              }}
                              onClick={e => e.stopPropagation()}
                              data-testid={`resize-handle-${col.field}`}
                            />
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody ref={tableBodyRef}>
                    {records.map((record, idx) => {
                      const rid = getRecordId(record);
                      const selected = isSelected(record);
                      const focused = idx === focusedRow;

                      return (
                        <TableRow
                          key={rid ?? idx}
                          data-row-index={idx}
                          className={cn(
                            'cursor-pointer transition-colors',
                            getRowBgClass(selected, idx),
                            focused && 'ring-2 ring-primary ring-inset',
                          )}
                          onClick={() => handleRowClick(record)}
                          data-testid={`record-row-${rid}`}
                          aria-selected={selected}
                        >
                          {multiple && (
                            <TableCell className="w-10">
                              {selected && <Check className="size-4 text-primary" />}
                            </TableCell>
                          )}
                          {resolvedColumns.map(col => (
                            <TableCell key={col.field} className="py-2.5">
                              {renderCellContent(record, col)}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination — fixed bottom bar */}
            {!error && totalCount > 0 && (
              <div
                className="flex items-center justify-between text-sm text-muted-foreground border-t pt-3 mt-2 px-1"
                data-testid="record-picker-pagination"
              >
                <span>
                  {totalCount} {totalCount === 1 ? 'record' : 'records'}
                  {totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
                </span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      onClick={handlePrevPage}
                      disabled={currentPage <= 1}
                      type="button"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Input
                      className="h-7 w-12 text-center text-xs px-1"
                      placeholder={String(currentPage)}
                      value={pageJumpValue}
                      onChange={e => setPageJumpValue(e.target.value)}
                      onKeyDown={handlePageJump}
                      aria-label="Jump to page"
                      data-testid="record-picker-page-jump"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      onClick={handleNextPage}
                      disabled={currentPage >= totalPages}
                      type="button"
                      aria-label="Next page"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Multi-select confirmation */}
        {multiple && (
          <DialogFooter>
            <div className="flex items-center gap-2 w-full justify-between">
              <span className="text-sm text-muted-foreground">
                {pendingSelection.size} selected
              </span>
              <div className="flex gap-2">
                <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleConfirm}>
                  Confirm
                </Button>
              </div>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
