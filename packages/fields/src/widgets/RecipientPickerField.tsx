import React from 'react';
import { Combobox, EmptyValue, cn } from '@object-ui/components';
import { SchemaRendererContext } from '@object-ui/react';
import type { FieldWidgetProps } from './types';

/**
 * RecipientPickerField — dependent record picker for a polymorphic recipient
 * reference (e.g. `sys_sharing_rule.recipient_id`), whose target object is
 * decided by a sibling `recipient_type` select.
 *
 * Reached via the field `widget: 'recipient-picker'` hint (resolves as
 * `field:recipient-picker`). Reads the live `recipient_type` from
 * `dependentValues` (the form record), loads candidate records of the mapped
 * object via `dataSource.find(...)`, and stores the value the sharing evaluator
 * expects for that type:
 *
 *   user                  → sys_user, store `id`
 *   team                  → sys_team, store `id`
 *   business_unit         → sys_business_unit, store `id`
 *   unit_and_subordinates → sys_business_unit, store `id`
 *   position              → sys_position, store `name` (matched against
 *                           sys_user_position.position at evaluation time)
 *
 * When `recipient_type` changes after mount the stored id is reset (an id valid
 * for one type is meaningless for another). Unknown types degrade to a plain
 * text input so nothing breaks.
 */
interface RecipientMapping {
  object: string;
  /** Which record field to persist into recipient_id. */
  storeField: 'id' | 'name';
  /** Candidate display-label fields, in preference order. */
  labelFields: string[];
}

const TYPE_TO_OBJECT: Record<string, RecipientMapping> = {
  user: { object: 'sys_user', storeField: 'id', labelFields: ['name', 'full_name', 'email'] },
  team: { object: 'sys_team', storeField: 'id', labelFields: ['name', 'label'] },
  business_unit: { object: 'sys_business_unit', storeField: 'id', labelFields: ['name', 'label'] },
  unit_and_subordinates: { object: 'sys_business_unit', storeField: 'id', labelFields: ['name', 'label'] },
  position: { object: 'sys_position', storeField: 'name', labelFields: ['label', 'name'] },
};

export function RecipientPickerField({
  value,
  onChange,
  readonly,
  className,
  ...props
}: FieldWidgetProps<string>) {
  const ctx = React.useContext(SchemaRendererContext);
  const dataSource: any = (props as any).dataSource ?? (ctx as any)?.dataSource ?? null;
  const disabled = (props as any).disabled as boolean | undefined;
  const dependentValues: Record<string, any> = (props as any).dependentValues ?? {};
  const recipientType = String(dependentValues.recipient_type ?? '');
  const mapping = TYPE_TO_OBJECT[recipientType];

  const [records, setRecords] = React.useState<any[] | null>(null);

  // Reset the stored recipient when the type changes AFTER mount (an id for a
  // user is not a valid team/business-unit id). The ref starts null so the
  // initial render of an existing rule never clears its value.
  const prevType = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (prevType.current !== null && prevType.current !== recipientType && value) {
      onChange('' as any);
    }
    prevType.current = recipientType;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientType]);

  React.useEffect(() => {
    setRecords(null);
    if (!dataSource || !mapping || typeof dataSource.find !== 'function') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await dataSource.find(mapping.object, { $top: 500, $orderby: 'name asc' });
        const list: any[] = res?.data ?? res?.records ?? (Array.isArray(res) ? res : []);
        if (!cancelled) setRecords(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setRecords([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dataSource, mapping?.object]);

  const labelOf = (r: any): string => {
    for (const f of mapping?.labelFields ?? ['name']) if (r?.[f]) return String(r[f]);
    return String(r?.id ?? '');
  };
  const valueOf = (r: any): string => String(r?.[mapping?.storeField ?? 'id'] ?? '');

  const options = React.useMemo(() => {
    const opts = (records ?? [])
      .map((r) => ({ value: valueOf(r), label: labelOf(r) }))
      .filter((o) => o.value);
    if (value && !opts.some((o) => o.value === value)) opts.unshift({ value, label: value });
    return opts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, value, mapping]);

  if (!recipientType) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        Select a recipient type first.
      </p>
    );
  }

  if (!mapping) {
    // Unknown / unsupported recipient type — keep a plain text input so the
    // field is never un-editable.
    return (
      <input
        className={cn(
          'w-full rounded border bg-background px-2 py-1 text-sm',
          className,
        )}
        value={value ?? ''}
        disabled={disabled || readonly}
        onChange={(e) => onChange(e.target.value as any)}
      />
    );
  }

  if (readonly) {
    if (!value) return <EmptyValue />;
    return <span className={className}>{options.find((o) => o.value === value)?.label ?? value}</span>;
  }

  return (
    <Combobox
      options={options}
      value={value ?? ''}
      onValueChange={(v) => onChange(v as any)}
      placeholder={
        records === null ? 'Loading…' : `Select a ${recipientType.replace(/_/g, ' ')}`
      }
      searchPlaceholder="Search…"
      emptyText={records === null ? 'Loading…' : 'No matches'}
      disabled={disabled}
      className={className}
    />
  );
}

export default RecipientPickerField;
