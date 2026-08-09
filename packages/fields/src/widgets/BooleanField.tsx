import React, { useId } from 'react';
import { Switch, Checkbox, Label } from '@object-ui/components';
import { FieldWidgetComponentProps } from './types';
import { toDomProps } from './toDomProps';

/**
 * BooleanField - Toggle input supporting switch and checkbox variants
 * Renders as Switch or Checkbox based on field widget configuration
 */
export function BooleanField({ value, onChange, field, readonly, ...props }: FieldWidgetComponentProps<boolean>) {
  const config = field as any;
  // Use simple type assertion for arbitrary custom properties not in BaseFieldMetadata
  const widget = config?.widget;
  // Generate unique ID using React's useId hook - must be before early returns (rules of hooks)
  const generatedId = useId();
  /**
   * The HOST owns the control's id (objectui#3952).
   *
   * `<FormControl>` is a Radix `Slot` that hands its child the id its
   * `<FormLabel htmlFor>` already points at (`_r_N_-form-item`). This widget
   * used to REPLACE it with the field name, so the form's visible label
   * referenced an id no element carried: `label for="_r_3_-form-item"` against
   * `all ids in form = ["notifications"]`. Clicking the label — the normal
   * affordance for a switch/checkbox row — toggled nothing, on every generated
   * form in every app.
   *
   * `id` is a DECLARED key of the widget contract (`FieldWidgetDomProps`) and
   * `toDomProps` forwards it, so honouring it here is the contract's own
   * direction: the fix belongs at the consumer that discarded a delivered
   * value, not in the form renderer (AGENTS.md #0.1).
   *
   * The fallback chain stays for the STANDALONE hosts that hand down no id —
   * `FieldEditWidget` (the grid's inline cell editor) and a bare SDUI node.
   */
  const hostId = props.id;
  const id = hostId || config?.name || generatedId;
  const label = config?.label || 'Checkbox';
  /**
   * A host that supplies the id is a host that renders its own label for it
   * (that is what the id is FOR), so the widget's `sr-only` label would be the
   * second copy of one name — the other half of #3952, and why a naive
   * `getByText(label)` on a boolean field returned two nodes.
   *
   * Standalone it is the control's ONLY accessible name (`FieldEditWidget`
   * renders no label of its own), so there it stays. Deliberately keyed on the
   * host id rather than on `config.label`: inside a form the naming is the
   * host's job for EVERY widget — a text field in a label-less form row is
   * equally unnamed — and the generic `'Checkbox'` fallback emitted there was
   * an actively WRONG accessible name, not a safety net.
   */
  const emitOwnLabel = !hostId;

  if (readonly) {
    return <span className="text-sm">{value ? 'Yes' : 'No'}</span>;
  }

  const domProps = toDomProps(props);

  if (widget === 'checkbox') {
     return (
        <div className="flex items-center space-x-2">
            <Checkbox
                {...domProps}
                id={id}
                checked={!!value}
                onCheckedChange={(checked) => onChange(!!checked)}
                disabled={readonly || domProps.disabled}
            />
            {emitOwnLabel && <Label htmlFor={id} className="sr-only">{label}</Label>}
        </div>
     )
  }

  return (
    <div className="flex items-center space-x-2">
        <Switch
            {...domProps}
            id={id}
            checked={!!value}
            onCheckedChange={onChange}
            disabled={readonly || domProps.disabled}
        />
        {emitOwnLabel && <Label htmlFor={id} className="sr-only">{label}</Label>}
    </div>
  );
}
