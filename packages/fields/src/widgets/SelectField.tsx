import React, { useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  EmptyValue,
} from '@object-ui/components';
import { isValueStillOffered } from '@object-ui/core';
import { SelectFieldMetadata } from '@object-ui/types';
import { useFieldTranslation } from './useFieldTranslation';
import { FieldWidgetProps } from './types';
import { MultiSelectField } from './MultiSelectField';
import { useCascadingOptions } from './useCascadingOptions';

/**
 * SelectField - dropdown selection widget.
 *
 * A field declared `multiple: true` selects zero-or-more values (spec:
 * `multiple` is valid on `select`), so it renders the multi-value chip picker
 * — the same widget the `multiselect` type uses. Delegating here (rather than
 * only at a type-resolution layer) means every surface that renders the
 * `select` widget — the object form, the inline grid editor, and
 * `ActionParamDialog` — inherits multi-select identically, with no drift
 * between them. Single-value selects keep the cascading dropdown below.
 *
 * Both branches resolve per-option `visibleWhen` cascading / role-gating through
 * the shared {@link useCascadingOptions} hook (#2715), so single and multi stay
 * in lockstep.
 */
export function SelectField(props: FieldWidgetProps<any>) {
  const config = (props.field || (props as any).schema) as SelectFieldMetadata | undefined;
  if ((config as any)?.multiple) {
    return <MultiSelectField {...props} />;
  }
  return <SingleSelectField {...(props as FieldWidgetProps<string>)} />;
}

/**
 * SingleSelectField - single-value dropdown with configurable options.
 *
 * Supports cascading / role-gated options (#2284): each option may carry a
 * `visibleWhen` CEL predicate, evaluated against the live form record +
 * `current_user`, so the offered set narrows as a controlling field changes
 * (`record.country == 'cn'`) or by role (`'admin' in current_user.positions`). A
 * field declares which sibling fields drive its list via `dependsOn`; while any
 * of those is empty the control is gated with a "select the parent first" hint,
 * mirroring the dependent-lookup UX.
 */
function SingleSelectField({
  value,
  onChange,
  field,
  readonly,
  schema,
  dependentValues,
  dependsOn: dependsOnProp,
  emptyHint: _emptyHint,
  dataSource: _dataSource,
  ...props
}: FieldWidgetProps<string>) {
  const config = (field || schema) as SelectFieldMetadata;
  const rawOptions = config?.options || [];
  const { t } = useFieldTranslation();
  // Stable hook for automation/e2e — react-hook-form + Radix Select cannot be
  // driven by synthetic DOM events, so e2e must target the trigger/options by a
  // deterministic testid keyed on the field name. `props.name` is the
  // react-hook-form field name spread in by the form renderer (FormField).
  const fieldName = (props as any).name || (config as any)?.name || props.id || '';

  const dependsOn = (config as any)?.dependsOn ?? dependsOnProp;
  const { options, gated, dependsOnFields } = useCascadingOptions(
    rawOptions,
    dependsOn,
    dependentValues,
  );

  // Cascade clear: once the offered set no longer includes the current value
  // (parent changed / predicate flipped), drop it so no stale pair persists.
  useEffect(() => {
    if (readonly) return;
    if (value === undefined || value === null || (value as unknown) === '') return;
    if (!isValueStillOffered(value, options)) onChange?.(undefined as unknown as string);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, gated]);

  if (readonly) {
    const option = rawOptions.find((o) => o.value === value);
    const display = option?.label || value;
    return display ? <span className="text-sm">{display}</span> : <EmptyValue />;
  }

  // A select with no options is unfillable — a silently-empty Radix dropdown
  // reads as "broken widget" and hides the real cause. Surface a legible state:
  // a dependency-gated list prompts for its controlling field; an unconfigured
  // list says so. Mirrors the inline form renderer's behaviour.
  if (options.length === 0) {
    const hint = gated
      ? `Select ${dependsOnFields.join(' / ')} first`
      : 'No options available';
    return (
      <div
        data-testid={fieldName ? `select-empty-${fieldName}` : undefined}
        className="flex h-9 w-full items-center rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
      >
        {hint}
      </div>
    );
  }

  return (
    <Select
      {...props}
      value={value}
      onValueChange={onChange}
      disabled={readonly || props.disabled}
    >
      <SelectTrigger className={props.className} id={props.id} data-testid={fieldName ? `select-trigger-${fieldName}` : undefined}>
        <SelectValue placeholder={config?.placeholder || t('common.selectOption')} />
      </SelectTrigger>
      <SelectContent position="popper">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} data-testid={`select-option-${option.value}`}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
