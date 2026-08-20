import React from 'react';
import { Combobox, EmptyValue, cn } from '@object-ui/components';
import { SchemaRendererContext } from '@object-ui/react';
import type { FieldWidgetComponentProps } from './types.js';
import { toDomProps } from './toDomProps.js';
import { useFieldTranslation } from './useFieldTranslation.js';

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
  /**
   * i18n key for the "choose one" placeholder. Keyed per type rather than
   * interpolating the enum value into an English sentence — "Select a
   * business unit" and "选择业务单元" share no structure (objectstack#3821).
   */
  placeholderKey: string;
}

const TYPE_TO_OBJECT: Record<string, RecipientMapping> = {
  user: { object: 'sys_user', storeField: 'id', labelFields: ['name', 'full_name', 'email'], placeholderKey: 'fields.recipient.selectUser' },
  team: { object: 'sys_team', storeField: 'id', labelFields: ['name', 'label'], placeholderKey: 'fields.recipient.selectTeam' },
  business_unit: { object: 'sys_business_unit', storeField: 'id', labelFields: ['name', 'label'], placeholderKey: 'fields.recipient.selectBusinessUnit' },
  unit_and_subordinates: { object: 'sys_business_unit', storeField: 'id', labelFields: ['name', 'label'], placeholderKey: 'fields.recipient.selectUnitAndSubordinates' },
  position: { object: 'sys_position', storeField: 'name', labelFields: ['label', 'name'], placeholderKey: 'fields.recipient.selectPosition' },
};

export function RecipientPickerField({
  value,
  onChange,
  readonly,
  className,
  error,
  ...props
}: FieldWidgetComponentProps<string>) {
  const ctx = React.useContext(SchemaRendererContext);
  const { t } = useFieldTranslation();
  const dataSource: any = props.dataSource ?? (ctx as any)?.dataSource ?? null;
  const disabled = props.disabled;
  const dependentValues: Record<string, any> = (props as any).dependentValues ?? {};
  const recipientType = String(dependentValues.recipient_type ?? '');
  const mapping = TYPE_TO_OBJECT[recipientType];

  const [records, setRecords] = React.useState<any[] | null>(null);

  // Reset the stored recipient when the admin PICKS a different type (an id for
  // a user is not a valid team/business-unit id).
  //
  // "Different type" means one non-empty type replacing another. The empty
  // string is not a type — it is the edit form before the record has hydrated,
  // and treating `'' → 'user'` as a change wiped the saved recipient the moment
  // an existing rule was opened for editing (objectstack#3821): the picker went
  // blank, and saving persisted the blank. Only a non-empty predecessor can
  // invalidate the stored id.
  const prevType = React.useRef<string>('');
  React.useEffect(() => {
    if (prevType.current && recipientType && prevType.current !== recipientType && value) {
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
        // Object form, not the 'name asc' clause string: the clause string is
        // supported again (objectstack#3821 fixed ApiDataSource walking it
        // character by character), but the structured form can't regress that
        // way for any data source.
        const res = await dataSource.find(mapping.object, { $top: 500, $orderby: { name: 'asc' } });
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
        {t('fields.recipient.selectTypeFirst')}
      </p>
    );
  }

  if (!mapping) {
    // Unknown / unsupported recipient type — keep a plain text input so the
    // field is never un-editable.
    return (
      <input
        // DOM pass-through onto the real focusable control (objectui#3318).
        {...toDomProps(props)}
        className={cn(
          'w-full rounded border bg-background px-2 py-1 text-sm',
          className,
        )}
        value={value ?? ''}
        disabled={disabled || readonly}
        onChange={(e) => onChange(e.target.value as any)}
        aria-invalid={!!error}
      />
    );
  }

  if (readonly) {
    if (!value) return <EmptyValue />;
    return <span className={className}>{options.find((o) => o.value === value)?.label ?? value}</span>;
  }

  // DOM pass-through onto the combobox trigger — the widget's real focusable
  // control (objectui#3318). `name` is withheld: the trigger is a button, not
  // a submission control (same reasoning as #3306's SelectTrigger).
  //
  // NOTE this widget stays on the #3318 ledger regardless: its dependency-
  // gated state (no `recipient_type` chosen yet — the state a fresh form and
  // the registry sweep render) is a plain hint paragraph with no focusable
  // control, so there is nothing there to carry the attribute.
  const { name: _domName, ...triggerDomProps } = toDomProps(props);

  return (
    <Combobox
      {...triggerDomProps}
      options={options}
      value={value ?? ''}
      onValueChange={(v) => onChange(v as any)}
      placeholder={
        records === null
          ? t('fields.recipient.loading')
          : t(mapping.placeholderKey ?? 'fields.recipient.select')
      }
      searchPlaceholder={t('fields.recipient.search')}
      emptyText={records === null ? t('fields.recipient.loading') : t('fields.recipient.empty')}
      disabled={disabled}
      className={cn('w-full', className)}
      // AFTER the spread so this widget's own computation wins (#3222).
      aria-invalid={!!error}
    />
  );
}

export default RecipientPickerField;
