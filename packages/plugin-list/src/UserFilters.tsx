/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn, Button, Popover, PopoverContent, PopoverTrigger } from '@object-ui/components';
import { ChevronDown, X, Plus, SlidersHorizontal } from 'lucide-react';
import type { ListViewSchema } from '@object-ui/types';

/** Resolved option with optional count */
interface ResolvedOption {
  label: string;
  value: string | number | boolean;
  color?: string;
  count?: number;
}

/** Resolved field with options derived from objectDef when not provided */
interface ResolvedField {
  field: string;
  label?: string;
  type?: string;
  options: ResolvedOption[];
  showCount?: boolean;
  defaultValues?: (string | number | boolean)[];
}

export interface UserFiltersProps {
  config: NonNullable<ListViewSchema['userFilters']>;
  /** Object definition for auto-deriving field options */
  objectDef?: any;
  /** Current data for computing counts */
  data?: any[];
  /** Callback when filter state changes */
  onFilterChange: (filters: any[]) => void;
  /** Maximum visible filter badges before collapsing into "More" dropdown (dropdown mode only) */
  maxVisible?: number;
  className?: string;
}

/**
 * UserFilters — Airtable Interfaces-style filter bar.
 *
 * Renders one of three modes based on `config.element`:
 * - **dropdown**: field-level dropdown selector badges
 * - **tabs**: named filter preset tab bar
 * - **toggle**: on/off toggle buttons per field
 */
export function UserFilters({
  config,
  objectDef,
  data = [],
  onFilterChange,
  maxVisible,
  className,
}: UserFiltersProps) {
  switch (config.element) {
    case 'dropdown':
      return (
        <DropdownFilters
          fields={config.fields || []}
          objectDef={objectDef}
          data={data}
          onFilterChange={onFilterChange}
          maxVisible={maxVisible}
          className={className}
        />
      );
    case 'tabs':
      return (
        <TabFilters
          tabs={config.tabs || []}
          showAllRecords={config.showAllRecords !== false}
          allowAddTab={config.allowAddTab}
          onFilterChange={onFilterChange}
          className={className}
        />
      );
    case 'toggle':
      return (
        <ToggleFilters
          fields={config.fields || []}
          onFilterChange={onFilterChange}
          className={className}
        />
      );
    default:
      return null;
  }
}

// ============================================
// Shared helper — resolve field options
// ============================================
function resolveFields(
  fields: NonNullable<NonNullable<ListViewSchema['userFilters']>['fields']>,
  objectDef: any,
  data: any[],
): ResolvedField[] {
  return fields.map(f => {
    let options: ResolvedOption[] = f.options ? [...f.options] : [];
    if (options.length === 0 && objectDef?.fields) {
      const fieldDef =
        Array.isArray(objectDef.fields)
          ? objectDef.fields.find((fd: any) => fd.name === f.field)
          : objectDef.fields[f.field];
      if (fieldDef?.options) {
        if (Array.isArray(fieldDef.options)) {
          options = fieldDef.options.map((o: any) => ({
            label: o.label ?? String(o.value ?? o),
            value: o.value ?? o,
            color: o.color,
          }));
        } else {
          options = Object.entries(fieldDef.options).map(([value, meta]) => ({
            label: (meta as any)?.label || value,
            value,
            color: (meta as any)?.color,
          }));
        }
      }
    }
    if (f.showCount && data.length > 0) {
      options = options.map(opt => ({
        ...opt,
        count: data.filter(row => row[f.field] === opt.value).length,
      }));
    }
    return { ...f, options };
  });
}

// ============================================
// Dropdown Mode
// ============================================
interface DropdownFiltersProps {
  fields: NonNullable<NonNullable<ListViewSchema['userFilters']>['fields']>;
  objectDef?: any;
  data: any[];
  onFilterChange: (filters: any[]) => void;
  maxVisible?: number;
  className?: string;
}

function DropdownFilters({ fields, objectDef, data, onFilterChange, maxVisible, className }: DropdownFiltersProps) {
  const [selectedValues, setSelectedValues] = React.useState<
    Record<string, (string | number | boolean)[]>
  >(() => {
    const init: Record<string, (string | number | boolean)[]> = {};
    fields.forEach(f => {
      if (f.defaultValues && f.defaultValues.length > 0) {
        init[f.field] = f.defaultValues;
      }
    });
    return init;
  });

  const resolvedFields = React.useMemo(
    () => resolveFields(fields, objectDef, data),
    [fields, objectDef, data],
  );

  const emitFilters = React.useCallback(
    (next: Record<string, (string | number | boolean)[]>) => {
      const conditions = Object.entries(next)
        .filter(([, v]) => v.length > 0)
        .map(([field, values]) => [field, 'in', values]);
      onFilterChange(conditions);
    },
    [onFilterChange],
  );

  const handleChange = (field: string, values: (string | number | boolean)[]) => {
    const next = { ...selectedValues, [field]: values };
    setSelectedValues(next);
    emitFilters(next);
  };

  // Emit default filters on mount
  React.useEffect(() => {
    const hasDefaults = Object.values(selectedValues).some(v => v.length > 0);
    if (hasDefaults) emitFilters(selectedValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Split fields into visible and overflow based on maxVisible
  const visibleFields = maxVisible !== undefined && maxVisible < resolvedFields.length
    ? resolvedFields.slice(0, maxVisible)
    : resolvedFields;
  const overflowFields = maxVisible !== undefined && maxVisible < resolvedFields.length
    ? resolvedFields.slice(maxVisible)
    : [];

  const renderBadge = (f: ResolvedField) => {
    const selected = selectedValues[f.field] || [];
    const hasSelection = selected.length > 0;

    return (
      <Popover key={f.field}>
        <PopoverTrigger asChild>
          <button
            data-testid={`filter-badge-${f.field}`}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border h-7 px-2.5 text-xs font-medium transition-colors shrink-0',
              hasSelection
                ? 'border-primary/30 bg-primary/5 text-primary'
                : 'border-border bg-background hover:bg-accent text-foreground',
            )}
          >
            <span className="truncate max-w-[100px]">{f.label || f.field}</span>
            {hasSelection && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary/10 text-[10px]">
                {selected.length}
              </span>
            )}
            {hasSelection ? (
              <X
                className="h-3 w-3 opacity-60"
                data-testid={`filter-clear-${f.field}`}
                onClick={e => {
                  e.stopPropagation();
                  handleChange(f.field, []);
                }}
              />
            ) : (
              <ChevronDown className="h-3 w-3 opacity-60" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-2">
          <div className="max-h-60 overflow-y-auto space-y-0.5" data-testid={`filter-options-${f.field}`}>
            {f.options.map(opt => {
              const selected = selectedValues[f.field] || [];
              return (
                <label
                  key={String(opt.value)}
                  className={cn(
                    'flex items-center gap-2 text-sm py-1.5 px-2 rounded cursor-pointer',
                    selected.includes(opt.value) ? 'bg-primary/5 text-primary' : 'hover:bg-muted',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.value)}
                    onChange={() => {
                      const next = selected.includes(opt.value)
                        ? selected.filter(v => v !== opt.value)
                        : [...selected, opt.value];
                      handleChange(f.field, next);
                    }}
                    className="rounded border-input"
                  />
                  {opt.color && (
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: opt.color }}
                    />
                  )}
                  <span className="truncate flex-1">{opt.label}</span>
                  {opt.count !== undefined && (
                    <span className="text-xs text-muted-foreground">{opt.count}</span>
                  )}
                </label>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className={cn('flex items-center gap-1 overflow-x-auto', className)} data-testid="user-filters-dropdown">
      <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      {resolvedFields.length === 0 ? (
        <span className="text-xs text-muted-foreground" data-testid="user-filters-empty">
          No filter fields
        </span>
      ) : (
        <>
          {visibleFields.map(renderBadge)}
          {overflowFields.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  data-testid="user-filters-more"
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background hover:bg-accent text-foreground h-7 px-2.5 text-xs font-medium transition-colors shrink-0"
                >
                  <span>More</span>
                  <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                    {overflowFields.length}
                  </span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-2" data-testid="user-filters-more-content">
                <div className="space-y-1">
                  {overflowFields.map(renderBadge)}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </>
      )}
      <button
        className="inline-flex items-center gap-1 h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors shrink-0"
        data-testid="user-filters-add"
        title="Add filter"
      >
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Add filter</span>
      </button>
    </div>
  );
}

// ============================================
// Tabs Mode
// ============================================
interface TabFiltersProps {
  tabs: NonNullable<NonNullable<ListViewSchema['userFilters']>['tabs']>;
  showAllRecords?: boolean;
  allowAddTab?: boolean;
  onFilterChange: (filters: any[]) => void;
  className?: string;
}

function TabFilters({ tabs, showAllRecords, allowAddTab, onFilterChange, className }: TabFiltersProps) {
  const [activeTab, setActiveTab] = React.useState<string>(() => {
    const defaultTab = tabs.find(t => t.default);
    return defaultTab?.id || (showAllRecords ? '__all__' : tabs[0]?.id || '');
  });

  const handleTabChange = React.useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      if (tabId === '__all__') {
        onFilterChange([]);
      } else {
        const tab = tabs.find(t => t.id === tabId);
        onFilterChange(tab?.filters || []);
      }
    },
    [tabs, onFilterChange],
  );

  const allTabs = React.useMemo(() => {
    const result = [...tabs];
    if (showAllRecords) {
      result.push({ id: '__all__', label: 'All records', filters: [] });
    }
    return result;
  }, [tabs, showAllRecords]);

  // Emit default tab filters on mount
  React.useEffect(() => {
    const defaultTab = tabs.find(t => t.default);
    if (defaultTab) {
      onFilterChange(defaultTab.filters || []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn('flex items-center gap-0.5 overflow-x-auto', className)} data-testid="user-filters-tabs">
      {allTabs.map(tab => (
        <button
          key={tab.id}
          data-testid={`filter-tab-${tab.id}`}
          onClick={() => handleTabChange(tab.id)}
          className={cn(
            'inline-flex items-center h-7 px-3 text-xs font-medium rounded-md transition-colors shrink-0',
            activeTab === tab.id
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted',
          )}
        >
          {tab.label}
        </button>
      ))}
      {allowAddTab && (
        <button
          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
          data-testid="filter-tab-add"
          title="Add filter tab"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ============================================
// Toggle Mode
// ============================================
interface ToggleFiltersProps {
  fields: NonNullable<NonNullable<ListViewSchema['userFilters']>['fields']>;
  onFilterChange: (filters: any[]) => void;
  className?: string;
}

function ToggleFilters({ fields, onFilterChange, className }: ToggleFiltersProps) {
  const [activeToggles, setActiveToggles] = React.useState<Set<string>>(() => {
    const defaults = new Set<string>();
    fields.forEach(f => {
      if (f.defaultValues && f.defaultValues.length > 0) defaults.add(f.field);
    });
    return defaults;
  });

  const emitFilters = React.useCallback(
    (active: Set<string>) => {
      const conditions = Array.from(active).map(fieldName => {
        const fieldDef = fields.find(fd => fd.field === fieldName);
        return fieldDef?.defaultValues
          ? [fieldName, 'in', fieldDef.defaultValues]
          : [fieldName, '!=', null];
      });
      onFilterChange(conditions);
    },
    [fields, onFilterChange],
  );

  const handleToggle = (field: string) => {
    setActiveToggles(prev => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      emitFilters(next);
      return next;
    });
  };

  // Emit default filters on mount
  React.useEffect(() => {
    if (activeToggles.size > 0) emitFilters(activeToggles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn('flex items-center gap-1 overflow-x-auto', className)} data-testid="user-filters-toggle">
      {fields.map(f => {
        const isActive = activeToggles.has(f.field);
        return (
          <Button
            key={f.field}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-3 text-xs shrink-0"
            data-testid={`filter-toggle-${f.field}`}
            onClick={() => handleToggle(f.field)}
          >
            {f.label || f.field}
          </Button>
        );
      })}
    </div>
  );
}
