import React, { useEffect } from 'react';
import { Badge, EmptyValue, cn } from '@object-ui/components';
import type { OptionLike } from '@object-ui/core';
import { FieldWidgetProps } from './types';
import { useCascadingOptions } from './useCascadingOptions';

interface Option extends OptionLike { color?: string }

/**
 * MultiSelectField - select zero or more values from a fixed option set.
 *
 * Renders the configured options as toggleable chips. The stored value is a
 * string[] (the selected option values). Used for the `multiselect` field type
 * and for a `select` field declared `multiple: true`.
 *
 * Options support the same per-option `visibleWhen` cascading + `dependsOn`
 * gating as the single `SelectField` (ADR-0058 / #2715), resolved through the
 * shared {@link useCascadingOptions} hook: the offered chips narrow against the
 * live form record + `current_user`, the control is gated behind a "select the
 * parent first" hint while a dependency is empty, and selections no longer
 * offered (parent changed / predicate flipped) are dropped from the array.
 */
export function MultiSelectField({
  value,
  onChange,
  field,
  readonly,
  className,
  schema,
  dependentValues,
  dependsOn: dependsOnProp,
  emptyHint: _emptyHint,
  dataSource: _dataSource,
  ...props
}: FieldWidgetProps<string[]>) {
  const config = (field || schema) as any;
  const rawOptions: Option[] = config?.options || [];
  const selected: string[] = Array.isArray(value) ? value : value == null ? [] : [value as unknown as string];
  const fieldName = (props as any).name || config?.name || (props as any).id || '';

  const dependsOn = config?.dependsOn ?? dependsOnProp;
  const { options, gated, dependsOnFields } = useCascadingOptions<Option>(
    rawOptions,
    dependsOn,
    dependentValues,
  );

  // Cascade clear: drop selected values the offered set no longer includes
  // (parent changed / predicate flipped), keeping the ones still valid — unlike
  // the scalar case we prune per-element rather than clearing the whole field.
  useEffect(() => {
    if (readonly) return;
    if (selected.length === 0) return;
    const stillOffered = selected.filter((v) => options.some((o) => o.value === v));
    if (stillOffered.length !== selected.length) onChange(stillOffered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, gated]);

  if (readonly) {
    if (selected.length === 0) return <EmptyValue />;
    return (
      <div className="flex flex-wrap gap-1">
        {selected.map((v) => {
          // Label from the raw set so a stored value hidden by `visibleWhen`
          // still renders its label rather than a bare id.
          const opt = rawOptions.find((o) => o.value === v);
          return <Badge key={v} variant="outline">{opt?.label || v}</Badge>;
        })}
      </div>
    );
  }

  // No offered options is unfillable — surface a legible state instead of an
  // empty chip row: a dependency-gated list prompts for its controlling field;
  // an unconfigured / fully-filtered list says so. Mirrors the single select.
  if (options.length === 0) {
    const hint = gated
      ? `Select ${dependsOnFields.join(' / ')} first`
      : 'No options available';
    return (
      <div
        data-testid={fieldName ? `multiselect-empty-${fieldName}` : undefined}
        className="flex min-h-9 w-full items-center rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
      >
        {hint}
      </div>
    );
  }

  const toggle = (v: string) => {
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    onChange(next);
  };

  return (
    <div
      className={cn('flex flex-wrap gap-1.5', className)}
      data-testid={fieldName ? `multiselect-${fieldName}` : undefined}
    >
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <button
            type="button"
            key={opt.value}
            onClick={() => toggle(opt.value)}
            disabled={(props as any).disabled}
            aria-pressed={active}
            data-testid={`multiselect-option-${opt.value}`}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background text-foreground hover:bg-accent',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
