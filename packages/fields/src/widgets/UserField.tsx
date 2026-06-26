import React from 'react';
import { FieldWidgetProps } from './types';
import { LookupField } from './LookupField';

/**
 * UserField — person picker for the `user` field type.
 *
 * `user` is a lookup specialized to the `sys_user` system object (see framework
 * "lookup → sys_user" specialization). Rather than re-implement candidate search,
 * the searchable picker, the record-picker dialog and id resolution, this widget
 * **delegates to the shared {@link LookupField}** with the reference fixed to
 * `sys_user`. The author writes `Field.user({ multiple })`; we normalise the field
 * metadata so the lookup machinery targets users with a sensible display field.
 *
 * Table-cell display (avatars / initials) is handled separately by
 * `UserCellRenderer`; this is the form/editor widget.
 */
export function UserField(props: FieldWidgetProps<any>) {
  const raw = (props.field || (props as any).schema) as any;

  // The objectSchema field metadata may live directly on `field`, or nested at
  // `field.field` when rendered via the createFieldRenderer wrapper — mirror the
  // unwrap LookupField itself performs.
  const metaIsNested = raw?.field && typeof raw.field === 'object'
    && ('reference' in raw.field || 'reference_to' in raw.field || 'type' in raw.field);
  const meta = metaIsNested ? raw.field : raw;

  // Ensure the picker always targets sys_user (even if the author omitted an
  // explicit reference) and presents user names by default.
  const normalized = {
    ...(meta || {}),
    reference: meta?.reference || meta?.reference_to || 'sys_user',
    display_field: meta?.display_field || meta?.displayField || meta?.reference_field || 'name',
  };

  const fieldProp = metaIsNested ? { ...raw, field: normalized } : normalized;

  return <LookupField {...(props as any)} field={fieldProp} />;
}
