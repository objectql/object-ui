// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * InspectorComboField — a searchable single-select for scoped inspectors that
 * still lets the author type a value not in the list.
 *
 * Mainstream low-code dataset designers let you *pick* an object / relationship
 * / field from the live schema instead of recalling its API name. This combo
 * renders that picker (grouped, searchable) over a catalog the caller supplies,
 * while keeping the power-user escape hatch: when the typed text matches no
 * option, a "Use «text»" row commits the raw value verbatim (so an offline
 * catalog, a computed path, or a server-only field is never a dead end).
 *
 * Self-filters (`shouldFilter={false}`) for predictable label+value matching.
 */

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import {
  cn,
  Button,
  Label,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@object-ui/components';

export interface InspectorComboOption {
  value: string;
  label: string;
  /** Small muted suffix, e.g. a field type. */
  hint?: string;
  /** Optional group heading; options sharing a group render together. */
  group?: string;
}

export interface InspectorComboFieldProps {
  label?: string;
  value: string;
  onCommit: (v: string) => void;
  options: InspectorComboOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  loading?: boolean;
  /** Allow committing a typed value that matches no option (default true). */
  allowCustom?: boolean;
  /** Render the trigger value in a monospace font. */
  mono?: boolean;
  /** Override the trigger label for the currently-selected custom value. */
  className?: string;
}

function matches(option: InspectorComboOption, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    option.value.toLowerCase().includes(needle) ||
    option.label.toLowerCase().includes(needle) ||
    (option.group?.toLowerCase().includes(needle) ?? false)
  );
}

export function InspectorComboField({
  label,
  value,
  onCommit,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search or type…',
  emptyText = 'No match — keep typing to use a custom value.',
  disabled,
  loading,
  allowCustom = true,
  mono,
  className,
}: InspectorComboFieldProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const selected = options.find((o) => o.value === value);
  const triggerText = selected ? selected.label : value || (loading ? 'Loading…' : placeholder);

  const filtered = React.useMemo(() => options.filter((o) => matches(o, search)), [options, search]);
  const groups = React.useMemo(() => {
    const order: string[] = [];
    const byGroup = new Map<string, InspectorComboOption[]>();
    for (const o of filtered) {
      const g = o.group ?? '';
      if (!byGroup.has(g)) {
        byGroup.set(g, []);
        order.push(g);
      }
      byGroup.get(g)!.push(o);
    }
    return order.map((g) => ({ heading: g, items: byGroup.get(g)! }));
  }, [filtered]);

  const trimmed = search.trim();
  const showCustom =
    allowCustom && !!trimmed && !options.some((o) => o.value === trimmed);

  const commit = (v: string) => {
    onCommit(v);
    setOpen(false);
    setSearch('');
  };

  const field = (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('h-8 w-full justify-between px-2 text-sm font-normal', className)}
        >
          <span className={cn('truncate', mono && 'font-mono', !selected && !value && 'text-muted-foreground')}>
            {triggerText}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[14rem] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder={searchPlaceholder} />
          <CommandList>
            {!showCustom && filtered.length === 0 && <CommandEmpty>{emptyText}</CommandEmpty>}
            {showCustom && (
              <CommandGroup>
                <CommandItem value={`__custom__${trimmed}`} onSelect={() => commit(trimmed)}>
                  <span className="truncate">
                    Use <span className="font-mono">“{trimmed}”</span>
                  </span>
                </CommandItem>
              </CommandGroup>
            )}
            {groups.map((g, gi) => (
              <CommandGroup key={g.heading || `g${gi}`} heading={g.heading || undefined}>
                {g.items.map((o) => (
                  <CommandItem key={o.value} value={o.value} onSelect={() => commit(o.value)}>
                    <Check className={cn('h-3.5 w-3.5', o.value === value ? 'opacity-100' : 'opacity-0')} />
                    <span className="truncate font-mono">{o.value}</span>
                    {o.label && o.label !== o.value && (
                      <span className="ml-1 truncate text-muted-foreground">{o.label}</span>
                    )}
                    {o.hint && <span className="ml-auto pl-2 text-[10px] text-muted-foreground">{o.hint}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  if (!label) return field;
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {field}
    </div>
  );
}
