import React, { useState, useEffect, useCallback, useRef, useContext, useMemo } from 'react';
import { 
  Button, 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Badge
} from '@object-ui/components';
import { Search, X, Loader2, AlertCircle, Plus } from 'lucide-react';
import { FieldWidgetProps } from './types';
import type { DataSource, QueryParams } from '@object-ui/types';

export interface LookupOption {
  value: string | number;
  label: string;
  description?: string;
  [key: string]: any;
}

/** Default page size for lookup data fetching */
const LOOKUP_PAGE_SIZE = 50;

/**
 * Resolve SchemaRendererContext from @object-ui/react at runtime.
 * Uses the same dynamic-require fallback that plugin-view uses to avoid
 * a hard dependency on @object-ui/react (which would create a cycle).
 */
const FallbackContext = React.createContext<any>(null);
let SchemaRendererContext: React.Context<any> = FallbackContext;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@object-ui/react');
  if (mod.SchemaRendererContext) {
    SchemaRendererContext = mod.SchemaRendererContext;
  }
} catch {
  // @object-ui/react not available — dataSource must be passed via props
}

/**
 * Map a raw record to a LookupOption using a display field and an id field.
 */
function recordToOption(
  record: any,
  displayField: string,
  idField: string,
  descriptionField?: string,
): LookupOption {
  const val = record[idField] ?? record.id ?? record._id;
  const label = record[displayField] ?? record.label ?? record.name ?? String(val);
  const description = descriptionField ? record[descriptionField] : undefined;
  return { value: val, label: String(label), description, ...record };
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

  // Dynamic data loading state
  const [fetchedOptions, setFetchedOptions] = useState<LookupOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Resolve DataSource: explicit prop > field-level > wrapper field > SchemaRendererContext > none
  const ctx = useContext(SchemaRendererContext);
  const contextDataSource = ctx?.dataSource ?? null;
  const dataSource: DataSource | null =
    (props as any).dataSource ?? lookupField?.dataSource ?? fieldMeta?.dataSource ?? contextDataSource;

  const hasDataSource = dataSource != null && typeof dataSource.find === 'function' && !!referenceTo;

  // Optional create-new callback
  const onCreateNew: ((searchQuery: string) => void) | undefined =
    (props as any).onCreateNew ?? lookupField?.onCreateNew;

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

      setLoading(true);
      setError(null);

      try {
        const params: QueryParams = {
          $top: LOOKUP_PAGE_SIZE,
        };
        if (search && search.trim()) {
          params.$search = search.trim();
        }

        const result = await dataSource.find(referenceTo, params);
        const records: any[] = result?.data ?? result ?? [];
        const mapped = records.map(r => recordToOption(r, displayField, idField, descriptionField));

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
    [dataSource, referenceTo, displayField, idField, descriptionField],
  );

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

  // Get selected option(s) — check both static and fetched options
  const findOption = useCallback(
    (v: any): LookupOption | undefined => {
      return (
        staticOptions.find(opt => opt.value === v) ??
        fetchedOptions.find(opt => opt.value === v)
      );
    },
    [staticOptions, fetchedOptions],
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
      return <span className="text-sm">-</span>;
    }

    if (multiple) {
      return (
        <div className="flex flex-wrap gap-1">
          {selectedOptions.map((opt, idx) => (
            <Badge key={idx} variant="outline">
              {opt?.[displayField] || opt?.label}
            </Badge>
          ))}
        </div>
      );
    }

    return (
      <span className="text-sm">
        {selectedOptions[0]?.[displayField] || selectedOptions[0]?.label}
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
              {opt?.[displayField] || opt?.label}
              <button
                onClick={() => handleRemove(opt?.value)}
                className="ml-1 hover:text-destructive"
                type="button"
                aria-label={`Remove ${opt?.[displayField] || opt?.label}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Lookup dialog trigger */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            className="w-full justify-start text-left font-normal"
            type="button"
          >
            <Search className="mr-2 size-4" />
            {selectedOptions.length === 0 
              ? lookupField?.placeholder || 'Select...'
              : multiple ? `${selectedOptions.length} selected` : 'Change selection'
            }
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {lookupField?.label || 'Select'} {multiple && '(multiple)'}
            </DialogTitle>
          </DialogHeader>
          
          {/* Search input */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-full pl-9"
              />
              {loading && (
                <Loader2
                  className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground"
                  data-testid="lookup-loading"
                />
              )}
            </div>

            {/* Error state */}
            {error && (
              <div className="flex flex-col items-center gap-2 py-4" role="alert">
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
              <div ref={listRef} className="max-h-64 overflow-y-auto space-y-1" role="listbox">
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
                        Showing {filteredOptions.length} of {totalCount} results. Refine your search to find more.
                      </p>
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
