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
import { FieldWidgetComponentProps } from './types';
import { toDomProps } from './toDomProps';
import { MultiSelectField } from './MultiSelectField';
import { OptionsEmptyState } from './OptionsEmptyState';
import { useCascadingOptions } from './useCascadingOptions';

/**
 * SelectField - dropdown selection widget.
 *
 * A field declared `multiple: true` selects zero-or-more values (spec:
 * `multiple` is valid on `select`), so it renders the multi-value chip picker
 * — the same widget the `multiselect` type uses. Single-value selects keep the
 * cascading dropdown below.
 *
 * The FORM no longer arrives here with `multiple` (objectui#3986):
 * `mapFieldTypeToFormType` now resolves a `select` + `multiple: true` field to
 * `field:multiselect`, so the object-form path renders `MultiSelectField`
 * directly under its own registry id — which is what carries the
 * `labelling: 'group'` declaration the host label needs. Deciding the widget at
 * the type-resolution layer is what keeps the declaration and the render from
 * disagreeing; a delegation invisible to the resolver could not.
 *
 * The branch below stays because it is NOT dead — measured entrances that reach
 * it with `multiple` set, none of which consult that resolver:
 *
 *  - **the inline grid editor** — `FieldEditWidget` looks `select` up in its own
 *    `EDIT_WIDGETS` table, which SHORT-CIRCUITS before the alias map is
 *    consulted, and forwards the whole metadata object as `field`;
 *  - **`ActionParamDialog`** — `paramToField` resolves through
 *    `resolveFormWidgetType`, which likewise returns `select` from
 *    `fieldWidgetMap` before reaching the alias map, and carries
 *    `multiple: param.multiple` on the field it builds;
 *  - **hand-written SDUI** — a `{ type: 'field:select' }` node whose metadata
 *    declares `multiple`, which addresses this widget by name.
 *
 * All three then inherit multi-select from here identically, with no drift.
 *
 * Both branches resolve per-option `visibleWhen` cascading / role-gating through
 * the shared {@link useCascadingOptions} hook (#2715), so single and multi stay
 * in lockstep.
 */
export function SelectField(props: FieldWidgetComponentProps<any>) {
  const config = props.field as SelectFieldMetadata | undefined;
  if ((config as any)?.multiple) {
    // NOT `toDomProps` — this is a widget-to-widget delegation, not a DOM
    // spread. `MultiSelectField` implements the same contract and needs the
    // whole of it (`value`, `onChange`, `field`, `dataSource`, …); narrowing
    // here to the DOM whitelist would hand it an empty widget.
    return <MultiSelectField {...props} />;
  }
  return <SingleSelectField {...(props as FieldWidgetComponentProps<string>)} />;
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
  error,
  dependentValues,
  dependsOn: dependsOnProp,
  emptyHint,
  dataSource: _dataSource,
  ...props
}: FieldWidgetComponentProps<string>) {
  const config = field as SelectFieldMetadata;
  const rawOptions = config?.options || [];
  const { t } = useFieldTranslation();
  // Stable hook for automation/e2e — react-hook-form + Radix Select cannot be
  // driven by synthetic DOM events, so e2e must target the trigger/options by a
  // deterministic testid keyed on the field name. `props.name` is the
  // react-hook-form field name spread in by the form renderer (FormField).
  const fieldName = props.name || (config as any)?.name || props.id || '';

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
    // Never configured → nothing to prune against; see `MultiSelectField`'s
    // copy of this guard for the measured failure (objectui#4220). Kept
    // identical across the four option widgets: an authored list is what the
    // cascade prunes, and all four render the same `OptionsEmptyState` when
    // there is none.
    if (rawOptions.length === 0) return;
    // Gated → the authored list is withheld until the `dependsOn` parent is
    // chosen, so the empty offered set is missing information, not a verdict on
    // the stored value; clearing here fired on mount (objectui#4247). Same
    // reasoning, at length, in `MultiSelectField`.
    if (gated) return;
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
  // the host's `emptyHint` when it computed one (it knows the controlling
  // fields' LABELS), else this widget's own translated copy. Shared with the
  // other option widgets so the four cannot drift again (objectui#3231).
  if (options.length === 0) {
    return (
      <OptionsEmptyState
        emptyHint={emptyHint}
        gated={gated}
        dependsOnFields={dependsOnFields}
        testId={fieldName ? `select-empty-${fieldName}` : undefined}
        className="h-9"
      />
    );
  }

  // Radix `Select.Root` renders no DOM element of its own — anything it does
  // not recognise (every `aria-*` / `data-*` a host hands this widget) is
  // silently DROPPED, never reaching a real element. That is how a required
  // select failed validation with the red message on screen while assistive
  // tech was told nothing (objectui#3306): the form renderer's `aria-invalid`
  // / `aria-describedby` / `aria-required` landed on Root and vanished. The
  // DOM pass-through therefore goes to `SelectTrigger` — the focusable
  // `<button role="combobox">` a user and their screen reader actually
  // interact with — with two deliberate exceptions kept on Root:
  //
  // - `name`: the ONE whitelist key Root genuinely consumes — it forwards it
  //   to the hidden native `<select>` that takes part in form submission.
  //   On the trigger it would sit uselessly on a non-submitter `<button>`.
  // - `disabled`: Root is the single authority (it disables trigger, item
  //   interaction and the hidden select together); forwarding the raw prop to
  //   the trigger as well would give the state a second, OR-merged author.
  const { name: domName, disabled: _domDisabled, ...triggerDomProps } = toDomProps(props);

  return (
    <Select
      name={domName}
      value={value}
      onValueChange={onChange}
      disabled={readonly || props.disabled}
    >
      <SelectTrigger
        {...triggerDomProps}
        data-testid={fieldName ? `select-trigger-${fieldName}` : undefined}
        // AFTER the spread so this widget's own computation wins, the #3222
        // discipline: `error` is the published validation slot
        // (`FieldWidgetPropsSchema`), and `!!undefined` must yield an explicit
        // `"false"` — a valid field SAYS it is valid rather than staying mute.
        aria-invalid={!!error}
      >
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
