/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react"
import { X, Plus, Trash2 } from "lucide-react"
import { createSafeTranslation } from "@object-ui/i18n"

import { cn } from "../lib/utils"
import { Button } from "../ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"

const useSafeSortTranslation = createSafeTranslation(
  {
    'sortBuilder.sortBy': 'Sort by',
    'sortBuilder.thenBy': 'Then by',
    'sortBuilder.selectField': 'Select field',
    'sortBuilder.ascending': 'A → Z',
    'sortBuilder.descending': 'Z → A',
    'sortBuilder.addSort': 'Add sort',
    'sortBuilder.removeSort': 'Remove sort',
  },
  'sortBuilder.sortBy',
)

export interface SortItem {
  id: string;
  field: string;
  order: 'asc' | 'desc';
}

export interface SortBuilderProps {
  fields?: Array<{ 
    value: string
    label: string
  }>;
  value?: SortItem[];
  onChange?: (value: SortItem[]) => void;
  className?: string;
}

export function SortBuilder({
  fields = [],
  value = [],
  onChange,
  className,
}: SortBuilderProps) {
  const { t } = useSafeSortTranslation()
  // Normalize incoming items: ensure every row has an `id` (React key) and
  // accept either `order` (internal) or `sortOrder` (spec) for the direction.
  const normalize = React.useCallback((rows: any[]): SortItem[] => {
    return (rows || []).map((row, idx) => ({
      id: row?.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `sort-${idx}-${row?.field ?? ''}`),
      field: row?.field ?? '',
      order: (row?.order ?? row?.sortOrder ?? 'asc') as 'asc' | 'desc',
    }));
  }, []);

  const [items, setItems] = React.useState<SortItem[]>(() => normalize(value));

  React.useEffect(() => {
    const next = normalize(value);
    // Compare ignoring the synthetic `id` so external updates don't loop
    const stripIds = (rs: SortItem[]) => rs.map(({ id: _id, ...rest }) => rest);
    if (JSON.stringify(stripIds(next)) !== JSON.stringify(stripIds(items))) {
      setItems(next);
    }
  }, [value, items, normalize]);

  const handleChange = (newItems: SortItem[]) => {
    setItems(newItems);
    onChange?.(newItems);
  };

  const addItem = () => {
    const newItem: SortItem = {
      id: crypto.randomUUID(),
      field: fields[0]?.value || "",
      order: 'asc',
    };
    handleChange([...items, newItem]);
  };

  const updateItem = (id: string, updates: Partial<SortItem>) => {
    handleChange(items.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const removeItem = (id: string) => {
    handleChange(items.filter(item => item.id !== id));
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={item.id} className="flex items-center gap-2">
             <span className="text-sm font-medium w-16 text-muted-foreground">
               {index === 0 ? t('sortBuilder.sortBy') : t('sortBuilder.thenBy')}
             </span>
             <div className="flex-1">
                <Select
                  value={item.field}
                  onValueChange={(val) => updateItem(item.id, { field: val })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={t('sortBuilder.selectField')} />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
             </div>
             <div className="w-28">
                <Select
                  value={item.order}
                  onValueChange={(val) => updateItem(item.id, { order: val as 'asc' | 'desc' })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">{t('sortBuilder.ascending')}</SelectItem>
                    <SelectItem value="desc">{t('sortBuilder.descending')}</SelectItem>
                  </SelectContent>
                </Select>
             </div>
             <Button
               variant="ghost"
               size="icon"
               className="h-9 w-9 shrink-0"
               onClick={() => removeItem(item.id)}
             >
               <X className="h-4 w-4" />
             </Button>
          </div>
        ))}
      </div>
       <Button
        variant="outline"
        size="sm"
        onClick={addItem}
        className="h-8"
        disabled={fields.length === 0}
      >
        <Plus className="h-3 w-3 mr-2" />
        {t('sortBuilder.addSort')}
      </Button>
    </div>
  );
}
