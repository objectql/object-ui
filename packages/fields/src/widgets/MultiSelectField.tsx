import React, { useEffect } from 'react';
import { Badge, EmptyValue, cn } from '@object-ui/components';
import type { OptionLike } from '@object-ui/core';
import { FieldWidgetComponentProps } from './types';
import { toDomProps } from './toDomProps';
import { toHostGroupProps } from './toHostGroupProps';
import { OptionsEmptyState } from './OptionsEmptyState';
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
  dependentValues,
  dependsOn: dependsOnProp,
  emptyHint,
  dataSource: _dataSource,
  error,
  ...props
}: FieldWidgetComponentProps<string[]>) {
  const config = field as any;
  const rawOptions: Option[] = config?.options || [];
  const selected: string[] = Array.isArray(value) ? value : value == null ? [] : [value as unknown as string];
  const fieldName = props.name || config?.name || props.id || '';

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
    // Nothing was ever CONFIGURED to prune against (objectui#4220). An empty
    // offered set has two very different causes: a list that cascaded down to
    // zero (a real decision — clear), and a field authored with no `options` at
    // all (no decision — the widget renders its "unfillable" state below). In
    // the second case pruning is not a cascade, it is deleting the stored value
    // of a field the user was only ever shown a hint for — measured on the
    // detail page's inline editor, which stages that empty array into the
    // record draft the moment the row enters edit mode, and on the grid's
    // inline cell editor, which has always taken this path.
    if (rawOptions.length === 0) return;
    if (selected.length === 0) return;
    const stillOffered = selected.filter((v) => options.some((o) => o.value === v));
    if (stillOffered.length !== selected.length) onChange(stillOffered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, gated]);

  // The host's group label has to be consumed on EVERY surface this widget can
  // render, not only the editable one (objectui#3990): both branches below
  // return before the editable container's `groupDomProps` spread, which is how
  // a field-level `readonly: true` and a zero-option list ended up with a
  // published label id and no consumer at all. See `toHostGroupProps`.
  const hostGroupProps = toHostGroupProps(props);

  if (readonly) {
    // A readonly set of values is still a set, so it takes the same `group`
    // answer the editable chip row gives. `EmptyValue` is that surface with
    // nothing in it: it publishes an `aria-label` ("No value") of its own, and
    // `aria-labelledby` outranks that per accname — correctly, because on the
    // `generic` role that placeholder span carries, an author name is prohibited
    // and never exposed, so the real choice is the field's name or no name.
    if (selected.length === 0) return <EmptyValue {...hostGroupProps} />;
    return (
      <div {...hostGroupProps} className="flex flex-wrap gap-1">
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
  // empty chip row: the host's `emptyHint` when it computed one, else this
  // widget's own translated copy. Shared with the single select / radio /
  // checkboxes so the four cannot drift again (objectui#3231).
  if (options.length === 0) {
    return (
      <OptionsEmptyState
        emptyHint={emptyHint}
        gated={gated}
        dependsOnFields={dependsOnFields}
        testId={fieldName ? `multiselect-empty-${fieldName}` : undefined}
        className="min-h-9"
        // This box IS the field in this state, so it is what the host label
        // names (objectui#3990).
        hostGroupProps={hostGroupProps}
      />
    );
  }

  const toggle = (v: string) => {
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    onChange(next);
  };

  // DOM pass-through (objectui#3318): the container carries the form
  // renderer's id / aria-describedby, but NOT its `aria-invalid` — a plain
  // wrapper div is not where assistive tech reads the invalid state. That
  // state goes onto every focusable chip button below, computed from the
  // published `error` slot (#3222), so whichever chip the user tabs to
  // announces the failure. `name` is withheld too: it is only DOM-legal on
  // form controls, and on this div it is exactly the leak #3291 sweeps for.
  const {
    'aria-invalid': _hostAriaInvalid,
    name: _domName,
    ...groupDomProps
  } = toDomProps(props);
  // When the host associated its visible label with this container by IDREF
  // (`aria-labelledby`, objectui#3961 / #3975) the container IS the labelled
  // group, so it answers with the matching role — without one, the name sits on
  // a generic `div` and contributes nothing: `label for` pointing here was
  // already inert (`HTMLLabelElement.control` is null for a div), which is the
  // whole defect. Each chip keeps its own accessible name from its text content,
  // which the group name does not override. Absent (standalone: the inline grid
  // editor, a bare SDUI node) nothing is emitted and the markup is unchanged.
  const isLabelledGroup = groupDomProps['aria-labelledby'] != null;

  return (
    <div
      {...groupDomProps}
      role={isLabelledGroup ? 'group' : undefined}
      className={cn('flex flex-wrap gap-1.5', className)}
      data-testid={fieldName ? `multiselect-${fieldName}` : undefined}
    >
      {options.map((opt) => {
        // Multi-value fields store string arrays — stringify the (possibly
        // numeric, #3090-widened) authored value at this boundary.
        const value = String(opt.value);
        const active = selected.includes(value);
        return (
          <button
            type="button"
            key={value}
            onClick={() => toggle(value)}
            disabled={props.disabled}
            aria-pressed={active}
            aria-invalid={!!error}
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
