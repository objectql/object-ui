import React, { useId, useEffect } from 'react';
import { Checkbox, Label, EmptyValue, Badge } from '@object-ui/components';
import type { OptionLike } from '@object-ui/core';
import { FieldWidgetProps } from './types';
import { useCascadingOptions } from './useCascadingOptions';

type Option = OptionLike;

/**
 * CheckboxesField - select zero or more values from a fixed option set, rendered
 * as a list of checkboxes. The stored value is a string[]. Used for the
 * `checkboxes` field type.
 *
 * Options support the same per-option `visibleWhen` cascading + `dependsOn`
 * gating as `MultiSelectField` (ADR-0058 / #2715), resolved through the shared
 * {@link useCascadingOptions} hook: the offered boxes narrow against the live
 * form record + `current_user`, the control is gated behind a "select the parent
 * first" hint while a dependency is empty, and selections no longer offered
 * (parent changed / predicate flipped) are pruned from the array.
 */
export function CheckboxesField({
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
  const groupId = useId();
  const fieldName = (props as any).name || config?.name || (props as any).id || '';

  const dependsOn = config?.dependsOn ?? dependsOnProp;
  const { options, gated, dependsOnFields } = useCascadingOptions<Option>(
    rawOptions,
    dependsOn,
    dependentValues,
  );

  // Cascade clear: prune selected values the offered set no longer includes
  // (parent changed / predicate flipped), keeping the ones still valid — the
  // per-element clear the multi-value case needs (cf. the scalar select/radio).
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
  // empty checkbox list: a dependency-gated list prompts for its controlling
  // field; an unconfigured / fully-filtered list says so. Mirrors the select.
  if (options.length === 0) {
    const hint = gated
      ? `Select ${dependsOnFields.join(' / ')} first`
      : 'No options available';
    return (
      <div
        data-testid={fieldName ? `checkboxes-empty-${fieldName}` : undefined}
        className="flex min-h-9 w-full items-center rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
      >
        {hint}
      </div>
    );
  }

  const toggle = (v: string, checked: boolean) => {
    const next = checked ? [...selected.filter((x) => x !== v), v] : selected.filter((x) => x !== v);
    onChange(next);
  };

  return (
    <div
      className={className}
      data-testid={fieldName ? `checkboxes-${fieldName}` : undefined}
    >
      {options.map((opt) => {
        const id = `${groupId}-${opt.value}`;
        return (
          <div key={opt.value} className="flex items-center space-x-2 py-0.5">
            <Checkbox
              id={id}
              checked={selected.includes(opt.value)}
              onCheckedChange={(checked) => toggle(opt.value, !!checked)}
              disabled={(props as any).disabled}
              data-testid={`checkboxes-option-${opt.value}`}
            />
            <Label htmlFor={id} className="font-normal">{opt.label}</Label>
          </div>
        );
      })}
    </div>
  );
}
