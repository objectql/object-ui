import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { Search, X, Loader2, AlertCircle } from 'lucide-react';
import { FieldWidgetProps } from './types';
import type { DataSource, QueryParams } from '@object-ui/types';

export interface LookupOption {
  value: string | number;
  label: string;
  [key: string]: any;
}

/** Default page size for lookup data fetching */
const LOOKUP_PAGE_SIZE = 50;

/**
 * Map a raw record to a LookupOption using a display field and an id field.
 */
function recordToOption(record: any, displayField: string, idField: string): LookupOption {
  const val = record[idField] ?? record._id ?? record.id;
  const label = record[displayField] ?? record.label ?? record.name ?? String(val);
  return { value: val, label: String(label), ...record };
}

/**
 * Lookup field for selecting related records.
 * Supports single and multi-select with search.
 *
 * When a `dataSource` is provided (either via props or via `field.dataSource`),
 * the dialog will dynamically load records from the referenced object using
 * `DataSource.find()`. Falls back to static `options` when no DataSource is available.
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

  const lookupField = (field || (props as any).schema) as any;
  const staticOptions: LookupOption[] = lookupField?.options || [];
  const multiple = lookupField.multiple || false;
  const displayField = lookupField.display_field || lookupField.reference_field || 'name';
  const idField = lookupField.id_field || '_id';
  const referenceTo: string | undefined = lookupField?.reference_to;

  // Resolve DataSource: explicit prop > field-level > none
  const dataSource: DataSource | null =
    (props as any).dataSource ?? lookupField?.dataSource ?? null;

  const hasDataSource = dataSource != null && typeof dataSource.find === 'function' && !!referenceTo;

  // Determine which options to display
  const allOptions = hasDataSource ? fetchedOptions : staticOptions;

  // For static options, filter locally based on search
  const filteredOptions = hasDataSource
    ? allOptions
    : allOptions.filter(opt =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase())
      );

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
        const mapped = records.map(r => recordToOption(r, displayField, idField));

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
    [dataSource, referenceTo, displayField, idField],
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

  const handleSelect = (option: LookupOption) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      const isSelected = currentValues.includes(option.value);
      
      if (isSelected) {
        onChange(currentValues.filter(v => v !== option.value));
      } else {
        onChange([...currentValues, option.value]);
      }
    } else {
      onChange(option.value);
      setIsOpen(false);
    }
  };

  const handleRemove = (optionValue: any) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      onChange(currentValues.filter(v => v !== optionValue));
    } else {
      onChange(null);
    }
  };

  // Keyboard handler for Enter/Space-to-select.
  // We inline the selection logic to avoid depending on the `handleSelect`
  // closure which changes on every render.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, option: LookupOption) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSelect(option);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value, multiple, onChange],
  );

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
              <div className="max-h-64 overflow-y-auto space-y-1">
                {filteredOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No options found
                  </p>
                ) : (
                  <>
                    {filteredOptions.map((option) => {
                      const isSelected = multiple
                        ? (Array.isArray(value) ? value : []).includes(option.value)
                        : value === option.value;

                      return (
                        <button
                          key={option.value}
                          onClick={() => handleSelect(option)}
                          onKeyDown={(e) => handleKeyDown(e, option)}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent flex items-center justify-between ${
                            isSelected ? 'bg-accent text-accent-foreground' : ''
                          }`}
                          type="button"
                        >
                          <span>{option.label}</span>
                          {isSelected && (
                            <Badge variant="default" className="ml-2">Selected</Badge>
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
