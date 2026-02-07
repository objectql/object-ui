/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import {
  cn,
  Button,
  Checkbox,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@object-ui/components';
import { cva } from 'class-variance-authority';
import { SlidersHorizontal, X } from 'lucide-react';
import type { FilterUISchema } from '@object-ui/types';

export type FilterUIProps = {
  schema: FilterUISchema;
  className?: string;
  onChange?: (values: Record<string, any>) => void;
  [key: string]: any;
};

type FilterValue = Record<string, any>;

type FilterConfig = FilterUISchema['filters'][number];

type DateRangeValue = {
  start?: string;
  end?: string;
};

const filterContainerVariants = cva('flex', {
  variants: {
    layout: {
      inline: 'flex-col space-y-4',
      popover: 'items-center',
      drawer: 'items-center',
    },
  },
  defaultVariants: {
    layout: 'inline',
  },
});

const isEmptyValue = (value: any): boolean => {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') {
    return Object.values(value).every(v => v === null || v === undefined || v === '');
  }
  return false;
};

const getDateRangeValue = (value: any): DateRangeValue => {
  if (Array.isArray(value)) {
    return { start: value[0] || '', end: value[1] || '' };
  }
  if (value && typeof value === 'object') {
    return { start: value.start || '', end: value.end || '' };
  }
  return { start: '', end: '' };
};

export const FilterUI: React.FC<FilterUIProps> = ({
  schema,
  className,
  onChange,
}) => {
  const [values, setValues] = React.useState<FilterValue>(schema.values || {});
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (schema.values) {
      setValues(schema.values);
    }
  }, [schema.values]);

  const notifyChange = React.useCallback((nextValues: FilterValue) => {
    onChange?.(nextValues);

    if (schema.onChange && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(schema.onChange, {
          detail: { values: nextValues },
        })
      );
    }
  }, [onChange, schema.onChange]);

  const updateValue = React.useCallback((field: string, value: any) => {
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);

    if (!schema.showApply) {
      notifyChange(nextValues);
    }
  }, [notifyChange, schema.showApply, values]);

  const clearValues = React.useCallback(() => {
    const nextValues: FilterValue = {};
    setValues(nextValues);

    if (schema.showApply) {
      notifyChange(nextValues);
      return;
    }

    notifyChange(nextValues);
  }, [notifyChange, schema.showApply]);

  const applyValues = React.useCallback(() => {
    notifyChange(values);
    setOpen(false);
  }, [notifyChange, values]);

  const activeCount = React.useMemo(() => {
    return Object.values(values).filter(value => !isEmptyValue(value)).length;
  }, [values]);

  const renderInput = (filter: FilterConfig) => {
    const label = filter.label || filter.field;
    const placeholder = filter.placeholder || `Filter by ${label}`;

    switch (filter.type) {
      case 'number':
        return (
          <Input
            type="number"
            value={values[filter.field] ?? ''}
            placeholder={placeholder}
            onChange={(event) => {
              const raw = event.target.value;
              const parsed = raw === '' ? '' : Number(raw);
              updateValue(filter.field, parsed);
            }}
          />
        );
      case 'select':
        return (
          <Select
            value={values[filter.field] !== undefined ? String(values[filter.field]) : ''}
            onValueChange={(value) => {
              const option = filter.options?.find(opt => String(opt.value) === value);
              updateValue(filter.field, option ? option.value : value);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {filter.options?.map(option => (
                <SelectItem key={String(option.value)} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'date':
        return (
          <Input
            type="date"
            value={values[filter.field] ?? ''}
            onChange={(event) => updateValue(filter.field, event.target.value)}
          />
        );
      case 'date-range': {
        const range = getDateRangeValue(values[filter.field]);
        return (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={range.start ?? ''}
              onChange={(event) => {
                updateValue(filter.field, { ...range, start: event.target.value });
              }}
            />
            <Input
              type="date"
              value={range.end ?? ''}
              onChange={(event) => {
                updateValue(filter.field, { ...range, end: event.target.value });
              }}
            />
          </div>
        );
      }
      case 'boolean':
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={Boolean(values[filter.field])}
              onCheckedChange={(checked) => updateValue(filter.field, Boolean(checked))}
            />
            <span className="text-sm text-muted-foreground">Enabled</span>
          </div>
        );
      case 'text':
      default:
        return (
          <Input
            value={values[filter.field] ?? ''}
            placeholder={placeholder}
            onChange={(event) => updateValue(filter.field, event.target.value)}
          />
        );
    }
  };

  const form = (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {schema.filters.map(filter => (
          <div key={filter.field} className="space-y-2">
            <Label className="text-xs text-muted-foreground">{filter.label || filter.field}</Label>
            {renderInput(filter)}
          </div>
        ))}
      </div>

      {(schema.showApply || schema.showClear) && (
        <div className="flex items-center justify-end gap-2 border-t pt-3">
          {schema.showClear && (
            <Button type="button" variant="ghost" size="sm" onClick={clearValues}>
              Clear
            </Button>
          )}
          {schema.showApply && (
            <Button type="button" size="sm" onClick={applyValues}>
              Apply
            </Button>
          )}
        </div>
      )}
    </div>
  );

  const layout = schema.layout || 'inline';

  if (layout === 'popover') {
    return (
      <div className={cn(filterContainerVariants({ layout }), className)}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant={activeCount > 0 ? 'secondary' : 'outline'} size="sm" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeCount > 0 && (
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-1 text-xs font-medium text-primary">
                  {activeCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[520px] p-4">
            {form}
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  if (layout === 'drawer') {
    return (
      <div className={cn(filterContainerVariants({ layout }), className)}>
        <Button type="button" variant={activeCount > 0 ? 'secondary' : 'outline'} size="sm" className="gap-2" onClick={() => setOpen(true)}>
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-1 text-xs font-medium text-primary">
              {activeCount}
            </span>
          )}
        </Button>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Filters</DrawerTitle>
              <DrawerDescription>Refine the data with advanced filters.</DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-6">{form}</div>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  return (
    <div className={cn(filterContainerVariants({ layout }), className)}>
      {form}
      {!schema.showApply && schema.showClear && (
        <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={clearValues}>
          <X className="h-3.5 w-3.5" />
          Clear filters
        </Button>
      )}
    </div>
  );
};
