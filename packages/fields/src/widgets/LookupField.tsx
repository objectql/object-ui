import React, { useState, useEffect, useCallback, useRef, useContext, useMemo } from 'react';
import { Button, 
  Input,
  Badge,
  Popover,
  PopoverTrigger,
  PopoverContent, EmptyValue } from '@object-ui/components';
import { Search, X, Loader2, AlertCircle, Plus, TableProperties } from 'lucide-react';
import { FieldWidgetProps } from './types';
import type { DataSource, QueryParams, LookupColumnDef } from '@object-ui/types';
import { RecordPickerDialog } from './RecordPickerDialog';
import type { RecordPickerFilterColumn } from './RecordPickerDialog';
import { getCellRendererResolver } from './_cell-renderer-bridge';
import { SchemaRendererContext as ImportedSchemaRendererContext } from '@object-ui/react';
import { useFieldTranslation } from './useFieldTranslation';

export interface LookupOption {
  value: string | number;
  label: string;
  description?: string;
  [key: string]: any;
}

/** Page size for the quick-select popover typeahead */
const LOOKUP_PAGE_SIZE = 50;

/**
 * SchemaRendererContext is created by @object-ui/react.
 * Using a static import to be compatible with Next.js Turbopack SSR.
 */
const SchemaRendererContext: React.Context<any> = ImportedSchemaRendererContext;

/**
 * Render a record title from a `titleFormat` template (e.g. `{full_name}` or
 * `{case_number} - {subject}`). When a templated key resolves to an empty
 * value, the surrounding separator (`-/|·,:` plus em/en dashes) is stripped
 * so we never produce orphan glyphs like `" - foo"`.
 *
 * Mirrors the implementation in `@object-ui/plugin-detail`'s
 * `resolveDisplayTitle` and `@object-ui/plugin-calendar`'s event-title
 * renderer so labels stay consistent across the product.
 */
function formatRecordTitle(record: any, titleFormat: string): string | null {
  if (!record || typeof record !== 'object' || !titleFormat) return null;
  const EMPTY = '\u0000';
  const SEP = '[-\\u2013\\u2014|/·,:]';
  let any = false;
  const raw = titleFormat.replace(/\{([^{}]+)\}/g, (_m, key) => {
    const v = (record as any)[key.trim()];
    if (v !== null && v !== undefined && v !== '') {
      any = true;
      return String(v);
    }
    return EMPTY;
  });
  if (!any) return null;
  const out = raw
    .replace(new RegExp(`\\s*${SEP}\\s*${EMPTY}`, 'g'), '')
    .replace(new RegExp(`${EMPTY}\\s*${SEP}\\s*`, 'g'), '')
    .replace(new RegExp(EMPTY, 'g'), '')
    .replace(/\s+/g, ' ')
    .trim();
  return out || null;
}

/**
 * Map a raw record to a LookupOption using a display field and an id field.
 *
 * When `titleFormat` is supplied (typically derived from the referenced
 * object's schema), the label is rendered via the template so users see a
 * human-readable name (e.g. `"Acme - John Doe"`) instead of falling all the
 * way through to the raw record id.
 */
function recordToOption(
  record: any,
  displayField: string,
  idField: string,
  descriptionField?: string,
  titleFormat?: string | null,
): LookupOption {
  const val = record[idField] ?? record.id ?? record._id;
  const templated = titleFormat ? formatRecordTitle(record, titleFormat) : null;
  const label =
    templated ??
    record[displayField] ??
    record.label ??
    record.name ??
    record.full_name ??
    record.title ??
    record.subject ??
    String(val);
  const description = descriptionField ? record[descriptionField] : undefined;
  return { value: val, label: String(label), description, ...record };
}

/**
 * Map a LookupColumnDef.type to a filter input type for the filter bar.
 * Returns undefined if the field type is not filterable.
 */
function mapFieldTypeToFilterType(
  fieldType: string,
): RecordPickerFilterColumn['type'] | undefined {
  const mapping: Record<string, RecordPickerFilterColumn['type']> = {
    text: 'text',
    number: 'number',
    currency: 'number',
    percent: 'number',
    select: 'select',
    status: 'select',
    date: 'date',
    datetime: 'date',
    boolean: 'boolean',
  };
  return mapping[fieldType];
}

/**
 * Lookup field for selecting related records.
 * Supports single and multi-select with search.
 *
 * When a `dataSource` is provided (either via props, via `field.dataSource`,
 * or via SchemaRendererContext), the dialog will dynamically load records
 * from the referenced object using `DataSource.find()`.
 * Falls back to static `options` when no DataSource is available.
 */
export function LookupField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<any>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { t } = useFieldTranslation();

  // Dynamic data loading state
  const [fetchedOptions, setFetchedOptions] = useState<LookupOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Records selected via RecordPickerDialog (Level 2).
  // Stored as LookupOption so that findOption can resolve display labels
  // even when the record wasn't part of the Level 1 popover fetch.
  const [pickerResolvedRecords, setPickerResolvedRecords] = useState<LookupOption[]>([]);

  // Arrow-key active index (-1 = none)
  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  const lookupField = (field || (props as any).schema) as any;

  // When rendered via createFieldRenderer wrapper the actual objectSchema field
  // metadata (reference_to, display_field, etc.) lives at lookupField.field.
  // Unwrap it so lookup-specific properties resolve correctly.
  // ObjectStack convention uses `reference` while the types use `reference_to`,
  // so we check for both property names.
  const innerField = lookupField?.field;
  const fieldMeta = (innerField && typeof innerField === 'object' && ('reference_to' in innerField || 'reference' in innerField || 'type' in innerField))
    ? innerField
    : lookupField;

  const staticOptions: LookupOption[] = fieldMeta?.options || [];
  const multiple = fieldMeta?.multiple || false;
  const displayField = fieldMeta?.display_field || fieldMeta?.reference_field || 'name';
  const descriptionField: string | undefined = fieldMeta?.description_field;
  const idField = fieldMeta?.id_field || 'id';
  // ObjectStack convention uses `reference`; types define `reference_to` — support both
  const referenceTo: string | undefined = fieldMeta?.reference_to || fieldMeta?.reference;

  // Enterprise Record Picker configuration
  const lookupColumns: Array<string | LookupColumnDef> | undefined = fieldMeta?.lookup_columns;
  const lookupPageSize: number | undefined = fieldMeta?.lookup_page_size;
  const lookupFilters: import('@object-ui/types').LookupFilterDef[] | undefined = fieldMeta?.lookup_filters;

  /**
   * Dependent lookups — restrict candidates based on values of *other* fields
   * in the same form. Two shapes are accepted:
   *
   * 1. `depends_on: ['country']` → shorthand. The dependent field value is sent
   *    as both the filter field and the source field (i.e. `country = ${country}`).
   * 2. `depends_on: [{ field: 'country', param: 'country_id' }]` → explicit.
   *    The remote field name (`param`) can differ from the local field name.
   *
   * When any dependency is empty, the lookup is gated and the user sees a
   * helpful "Select {field} first" hint instead of unfiltered records.
   */
  const dependsOn = useMemo<Array<{ field: string; param: string }>>(() => {
    const raw = fieldMeta?.depends_on ?? fieldMeta?.dependsOn;
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw.map((d: any) =>
        typeof d === 'string' ? { field: d, param: d } : { field: d.field, param: d.param ?? d.field },
      );
    }
    return [];
  }, [fieldMeta?.depends_on, fieldMeta?.dependsOn]);

  // Resolve dependent field values from explicit prop or SchemaRendererContext.data
  const dependentValuesProp = (props as any).dependentValues as Record<string, any> | undefined;
  // Derive filter columns from lookup_columns that have type info
  const filterColumns = useMemo<RecordPickerFilterColumn[] | undefined>(() => {
    if (!lookupColumns) return undefined;
    const cols: RecordPickerFilterColumn[] = [];
    for (const c of lookupColumns) {
      if (typeof c === 'object' && c.type) {
        const filterType = mapFieldTypeToFilterType(c.type);
        if (filterType) {
          cols.push({
            field: c.field,
            label: c.label,
            type: filterType,
          });
        }
      }
    }
    return cols.length > 0 ? cols : undefined;
  }, [lookupColumns]);

  // Resolve DataSource: explicit prop > field-level > wrapper field > SchemaRendererContext > none
  const ctx = useContext(SchemaRendererContext);
  const contextDataSource = ctx?.dataSource ?? null;
  const dataSource: DataSource | null =
    (props as any).dataSource ?? lookupField?.dataSource ?? fieldMeta?.dataSource ?? contextDataSource;

  /** Resolve dependent values from the explicit prop (preferred), the form-data
   *  context provided by @object-ui/react, or finally `ctx.data` (record scope). */
  const resolvedDependentValues: Record<string, any> = useMemo(() => {
    if (dependentValuesProp) return dependentValuesProp;
    return (ctx?.formValues ?? ctx?.data ?? {}) as Record<string, any>;
  }, [dependentValuesProp, ctx?.formValues, ctx?.data]);

  /** True when at least one dependency is missing (empty). The picker is gated
   *  in that state so we never issue an unfiltered query that ignores the
   *  user's earlier choices. */
  const dependenciesMissing = useMemo(() => {
    if (dependsOn.length === 0) return false;
    return dependsOn.some(({ field }) => {
      const v = resolvedDependentValues[field];
      return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    });
  }, [dependsOn, resolvedDependentValues]);

  const hasDataSource = dataSource != null && typeof dataSource.find === 'function' && !!referenceTo;

  // Fetch the referenced object's schema so we can render option labels via
  // its `titleFormat` template (e.g. `{full_name}`, `{case_number} - {subject}`).
  // Without this the label fell back to a non-existent `name` field and
  // ultimately to the raw record id.
  const [refObjectSchema, setRefObjectSchema] = useState<any>(null);
  useEffect(() => {
    if (!dataSource || !referenceTo) return;
    const getSchema = (dataSource as any).getObjectSchema;
    if (typeof getSchema !== 'function') return;
    let alive = true;
    Promise.resolve(getSchema.call(dataSource, referenceTo))
      .then((s: any) => { if (alive) setRefObjectSchema(s); })
      .catch(() => { /* fall back to displayField chain */ });
    return () => { alive = false; };
  }, [dataSource, referenceTo]);

  const refTitleFormat: string | null = useMemo(() => {
    const raw = refObjectSchema?.titleFormat;
    if (typeof raw === 'string') return raw;
    if (raw && typeof raw === 'object' && typeof raw.source === 'string') return raw.source;
    return null;
  }, [refObjectSchema]);

  // Optional create-new callback
  const onCreateNew: ((searchQuery: string) => void) | undefined =
    (props as any).onCreateNew ?? lookupField?.onCreateNew;

  // State for the full Record Picker dialog (Level 2)
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Determine which options to display
  const allOptions = hasDataSource ? fetchedOptions : staticOptions;

  // For static options, filter locally based on search
  const filteredOptions = useMemo(() => {
    if (hasDataSource) return allOptions;
    if (!searchQuery) return allOptions;
    const q = searchQuery.toLowerCase();
    return allOptions.filter(opt =>
      opt.label.toLowerCase().includes(q) ||
      (opt.description && opt.description.toLowerCase().includes(q))
    );
  }, [hasDataSource, allOptions, searchQuery]);

  // Reset active index when options change
  useEffect(() => {
    setActiveIndex(-1);
  }, [filteredOptions.length]);

  // Fetch data from DataSource
  const fetchLookupData = useCallback(
    async (search?: string) => {
      if (!dataSource || !referenceTo) return;
      // Don't issue a request that ignores configured dependencies.
      if (dependenciesMissing) {
        setFetchedOptions([]);
        setTotalCount(0);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params: QueryParams = {
          $top: LOOKUP_PAGE_SIZE,
        };
        if (search && search.trim()) {
          params.$search = search.trim();
        }

        // Build a dependent-lookup filter chain: AND of `param eq value`.
        // QueryParams.$filter is a Record<string, any> — adapters convert to
        // the underlying query language (OData, ObjectQL, etc).
        if (dependsOn.length > 0) {
          const filterEntries: Record<string, any> = {};
          for (const { field, param } of dependsOn) {
            const v = resolvedDependentValues[field];
            if (v === undefined || v === null || v === '') continue;
            filterEntries[param] = typeof v === 'number' ? v : String(v);
          }
          if (Object.keys(filterEntries).length > 0) {
            params.$filter = filterEntries;
          }
        }

        const result = await dataSource.find(referenceTo, params);
        const records: any[] = result?.data ?? result ?? [];
        const mapped = records.map(r => recordToOption(r, displayField, idField, descriptionField, refTitleFormat));

        setFetchedOptions(mapped);
        setTotalCount(result?.total ?? records.length);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setFetchedOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [dataSource, referenceTo, displayField, idField, descriptionField, refTitleFormat, dependenciesMissing, dependsOn, resolvedDependentValues],
  );

  // Re-fetch when dependent values change while the picker is open. This keeps
  // a "City" dropdown reactive when the user changes "Country" without closing.
  const dependencySignature = useMemo(
    () => dependsOn.map(d => `${d.param}=${resolvedDependentValues[d.field] ?? ''}`).join('|'),
    [dependsOn, resolvedDependentValues],
  );
  useEffect(() => {
    if (isOpen && hasDataSource && dependsOn.length > 0) {
      fetchLookupData(searchQuery || undefined);
      // Clear local selection if it no longer satisfies the new filter chain —
      // out of scope here; consumer should validate on submit.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependencySignature]);

  // Fetch data when dialog opens.
  // We intentionally depend only on `isOpen` so the effect fires once per
  // open/close transition. `fetchLookupData` is stable-enough via its own
  // useCallback deps; including it here would cause spurious re-fetches.
  useEffect(() => {
    if (isOpen && hasDataSource) {
      fetchLookupData(searchQuery || undefined);
    }
    // Clean up fetched data when dialog closes
    if (!isOpen) {
      setSearchQuery('');
      setError(null);
      setActiveIndex(-1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Debounced search
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);

      if (!hasDataSource) return;

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        fetchLookupData(query || undefined);
      }, 300);
    },
    [hasDataSource, fetchLookupData],
  );

  // Clean up debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  /**
   * Hydrate the picker's display when the field already has a value (e.g.
   * edit-mode load, prefill via query-string from a related-list "+ New")
   * but no option resolves it yet. Fetches the referenced record(s) via
   * the DataSource and caches them in `pickerResolvedRecords` so the chip
   * shows a friendly label instead of an empty placeholder.
   */
  useEffect(() => {
    if (!hasDataSource || !dataSource || !referenceTo) return;
    const ids: any[] = multiple
      ? Array.isArray(value) ? value : []
      : value != null && value !== '' ? [value] : [];
    if (!ids.length) return;
    // Only fetch records we haven't resolved yet.
    const unresolved = ids.filter((v) => !findOption(v));
    if (!unresolved.length) return;

    let cancelled = false;
    (async () => {
      try {
        const fetched: LookupOption[] = [];
        for (const id of unresolved) {
          if (typeof (dataSource as any).findOne === 'function') {
            const rec = await (dataSource as any).findOne(referenceTo, id);
            if (rec) fetched.push(recordToOption(rec, displayField, idField, descriptionField, refTitleFormat));
          } else {
            const res = await dataSource.find(referenceTo, {
              $filter: { [idField]: id },
              $top: 1,
            } as QueryParams);
            const rows = res?.data ?? res ?? [];
            if (rows[0]) fetched.push(recordToOption(rows[0], displayField, idField, descriptionField, refTitleFormat));
          }
        }
        if (!cancelled && fetched.length) {
          setPickerResolvedRecords((prev) => {
            const map = new Map(prev.map((o) => [o.value, o]));
            for (const o of fetched) map.set(o.value, o);
            return Array.from(map.values());
          });
        }
      } catch {
        // Ignore — chip will fall back to showing the raw id.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, hasDataSource, referenceTo, displayField, idField, descriptionField, multiple]);

  // Get selected option(s) — check static, fetched, and picker-resolved options
  const findOption = useCallback(
    (v: any): LookupOption | undefined => {
      return (
        staticOptions.find(opt => opt.value === v) ??
        fetchedOptions.find(opt => opt.value === v) ??
        pickerResolvedRecords.find(opt => opt.value === v)
      );
    },
    [staticOptions, fetchedOptions, pickerResolvedRecords],
  );

  const selectedOptions = multiple
    ? (Array.isArray(value) ? value : []).map(findOption).filter(Boolean)
    : value ? [findOption(value)].filter(Boolean) : [];

  const handleSelect = useCallback(
    (option: LookupOption) => {
      if (multiple) {
        const currentValues = Array.isArray(value) ? value : [];
        const isSelected = currentValues.includes(option.value);
        
        if (isSelected) {
          onChange(currentValues.filter((v: any) => v !== option.value));
        } else {
          onChange([...currentValues, option.value]);
        }
      } else {
        onChange(option.value);
        setIsOpen(false);
      }
    },
    [multiple, value, onChange],
  );

  const handleRemove = (optionValue: any) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      onChange(currentValues.filter((v: any) => v !== optionValue));
    } else {
      onChange(null);
    }
  };

  // Callback from RecordPickerDialog — caches selected records so that
  // findOption can resolve display labels after the dialog closes.
  const handlePickerSelectRecords = useCallback(
    (records: any[]) => {
      const mapped = records.map(r => recordToOption(r, displayField, idField, descriptionField, refTitleFormat));
      setPickerResolvedRecords(mapped);
    },
    [displayField, idField, descriptionField, refTitleFormat],
  );

  // Keyboard handler for the search input — arrow keys + Enter
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev,
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
          handleSelect(filteredOptions[activeIndex]);
        }
      }
    },
    [filteredOptions, activeIndex, handleSelect],
  );

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const el = listRef.current.querySelector(`[data-lookup-index="${activeIndex}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  if (readonly) {
    if (!selectedOptions.length) {
      return <EmptyValue />;
    }

    if (multiple) {
      return (
        <div className="flex flex-wrap gap-1">
          {selectedOptions.map((opt, idx) => (
            <Badge key={idx} variant="outline">
              {opt?.label || opt?.[displayField]}
            </Badge>
          ))}
        </div>
      );
    }

    return (
      <span className="text-sm">
        {selectedOptions[0]?.label || selectedOptions[0]?.[displayField]}
      </span>
    );
  }

  return (
    <div className="space-y-2">
      {/* Selected values display */}
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedOptions.map((opt, idx) => (
            <Badge 
              key={idx} 
              variant="outline"
              className="gap-1"
            >
              {opt?.label || opt?.[displayField]}
              <button
                onClick={() => handleRemove(opt?.value)}
                className="ml-1 hover:text-destructive"
                type="button"
                aria-label={`Remove ${opt?.label || opt?.[displayField]}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Level 1: Quick-select Popover (inline typeahead) */}
      <div className="flex items-center gap-1.5">
      <Popover open={isOpen} onOpenChange={(o) => !dependenciesMissing && setIsOpen(o)}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            className="min-w-0 flex-1 justify-start text-left font-normal"
            type="button"
            disabled={dependenciesMissing || (props as any).disabled}
            data-testid={dependenciesMissing ? 'lookup-trigger-gated' : undefined}
            title={dependenciesMissing
              ? `Select ${dependsOn.map(d => d.field).join(', ')} first`
              : undefined}
          >
            <Search className="mr-2 size-4" />
            {dependenciesMissing
              ? `Select ${dependsOn.map(d => d.field).join(', ')} first`
              : selectedOptions.length === 0 
                ? lookupField?.placeholder || t('common.select')
                : multiple ? t('table.selected', { count: selectedOptions.length }) : t('common.select')
            }
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          {/* Search input */}
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder={t('common.search') + '...'}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-full pl-9 h-8 text-sm"
              />
              {loading && (
                <Loader2
                  className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground"
                  data-testid="lookup-loading"
                />
              )}
            </div>
          </div>

          {/* Error state */}
          {error && (
            <div className="flex flex-col items-center gap-2 py-4 px-2" role="alert">
              <AlertCircle className="size-5 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLookupData(searchQuery || undefined)}
                type="button"
              >
                Retry
              </Button>
            </div>
          )}

          {/* Loading state (initial load only, not search refinement) */}
          {loading && filteredOptions.length === 0 && !error && (
            <div className="flex flex-col items-center gap-2 py-6" role="status" aria-live="polite">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading…</p>
            </div>
          )}

          {/* Options list */}
          {!error && !(loading && filteredOptions.length === 0) && (
            <div ref={listRef} className="max-h-64 overflow-y-auto px-1 pb-1" role="listbox">
              {filteredOptions.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    No options found
                  </p>
                  {/* Quick-create entry */}
                  {onCreateNew && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 gap-1"
                      type="button"
                      onClick={() => {
                        onCreateNew(searchQuery);
                        setIsOpen(false);
                      }}
                    >
                      <Plus className="size-4" />
                      Create new
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {filteredOptions.map((option, idx) => {
                    const isSelected = multiple
                      ? (Array.isArray(value) ? value : []).includes(option.value)
                      : value === option.value;
                    const isActive = idx === activeIndex;

                    return (
                      <button
                        key={option.value}
                        data-lookup-index={idx}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelect(option)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent flex items-center justify-between ${
                          isActive
                            ? 'bg-accent text-accent-foreground'
                            : isSelected
                              ? 'bg-accent/50 text-accent-foreground'
                              : ''
                        }`}
                        type="button"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="block truncate">{option.label}</span>
                          {option.description && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          )}
                        </div>
                        {isSelected && (
                          <Badge variant="default" className="ml-2 shrink-0">Selected</Badge>
                        )}
                      </button>
                    );
                  })}
                  {/* Show total count when fetched from DataSource */}
                  {hasDataSource && totalCount > filteredOptions.length && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Showing {filteredOptions.length} of {totalCount} results.
                    </p>
                  )}
                  {/* "Show All Results" button — opens the full Record Picker (Level 2) */}
                  {hasDataSource && totalCount > filteredOptions.length && (
                    <button
                      type="button"
                      className="w-full text-center px-3 py-2 rounded-md text-sm font-medium text-primary hover:bg-accent flex items-center justify-center gap-1.5"
                      onClick={() => {
                        setIsOpen(false);
                        setIsPickerOpen(true);
                      }}
                      data-testid="show-all-results"
                    >
                      <TableProperties className="size-3.5" />
                      Show All Results ({totalCount})
                    </button>
                  )}
                  {/* Quick-create entry (below results) */}
                  {onCreateNew && (
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent flex items-center gap-1.5 text-muted-foreground"
                      onClick={() => {
                        onCreateNew(searchQuery);
                        setIsOpen(false);
                      }}
                    >
                      <Plus className="size-3.5" />
                      Create new{searchQuery ? ` "${searchQuery}"` : ''}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* "Browse All" button — always visible when DataSource is available */}
      {hasDataSource && (
        <Button
          variant="outline"
          size="icon"
          className="shrink-0"
          type="button"
          onClick={() => setIsPickerOpen(true)}
          aria-label="Browse all records"
          title="Browse all records"
          data-testid="browse-all-records"
        >
          <TableProperties className="size-4" />
        </Button>
      )}
      </div>

      {/* Level 2: Full Record Picker Dialog */}
      {hasDataSource && dataSource && referenceTo && (
        <RecordPickerDialog
          open={isPickerOpen}
          onOpenChange={setIsPickerOpen}
          title={lookupField?.label || 'Select'}
          multiple={multiple}
          dataSource={dataSource}
          objectName={referenceTo}
          columns={lookupColumns}
          displayField={displayField}
          titleFormat={refTitleFormat}
          idField={idField}
          pageSize={lookupPageSize}
          value={value}
          onSelect={onChange}
          onSelectRecords={handlePickerSelectRecords}
          lookupFilters={lookupFilters}
          cellRenderer={getCellRendererResolver()}
          filterColumns={filterColumns}
        />
      )}
    </div>
  );
}
