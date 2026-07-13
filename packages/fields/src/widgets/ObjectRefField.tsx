import React from 'react';
import { Combobox, EmptyValue, cn } from '@object-ui/components';
import { SchemaRendererContext } from '@object-ui/react';
import type { FieldWidgetProps } from './types';

/**
 * ObjectRefField — object-name picker for form fields that store the machine
 * name of a registered object (e.g. `sys_sharing_rule.object_name`).
 *
 * Reached via the field `widget: 'object-ref'` hint (declared on the object
 * metadata; resolves as `field:object-ref`). Renders a searchable dropdown of
 * the platform's registered objects instead of a free-text input where the
 * admin has to remember a machine name.
 *
 * Object catalog source, in order of preference:
 *   1. `dataSource.getObjects()` — the metadata-registry list endpoint
 *      (`GET /api/v1/meta/object`), which merges code- and DB-defined objects.
 *   2. Fallback: `dataSource.find('sys_metadata', { type: 'object' })` — the
 *      same source the Setup app's object grid browses.
 * The stored value is always the object's `name` string. If the catalog can't
 * load, the current value is still shown, so the control degrades safely.
 */
interface ObjectHeader {
  name: string;
  label?: string;
}

export function ObjectRefField({
  value,
  onChange,
  readonly,
  className,
  ...props
}: FieldWidgetProps<string>) {
  const ctx = React.useContext(SchemaRendererContext);
  const dataSource: any = (props as any).dataSource ?? (ctx as any)?.dataSource ?? null;
  const disabled = (props as any).disabled as boolean | undefined;

  const [objects, setObjects] = React.useState<ObjectHeader[] | null>(null);

  React.useEffect(() => {
    if (!dataSource) return;
    let cancelled = false;
    (async () => {
      try {
        let rows: ObjectHeader[] = [];
        if (typeof dataSource.getObjects === 'function') {
          rows = (await dataSource.getObjects()) ?? [];
        } else if (typeof dataSource.find === 'function') {
          const res = await dataSource.find('sys_metadata', {
            $filter: { type: 'object' },
            $top: 1000,
          });
          const list: any[] =
            res?.data ?? res?.records ?? (Array.isArray(res) ? res : []);
          rows = list
            .map((r) => ({
              name: String(r?.name ?? ''),
              label: r?.label != null ? String(r.label) : undefined,
            }))
            .filter((r) => r.name);
        }
        if (!cancelled) setObjects(rows);
      } catch {
        if (!cancelled) setObjects([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dataSource]);

  const options = React.useMemo(() => {
    const opts = (objects ?? []).map((o) => ({
      value: o.name,
      label: o.label ? `${o.label} (${o.name})` : o.name,
    }));
    // Keep the current value selectable even if the catalog didn't include it
    // (unknown / not-yet-published object), so editing never drops it.
    if (value && !opts.some((o) => o.value === value)) {
      opts.unshift({ value, label: value });
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [objects, value]);

  if (readonly) {
    if (!value) return <EmptyValue />;
    const label = options.find((o) => o.value === value)?.label ?? value;
    return <span className={className}>{label}</span>;
  }

  return (
    <Combobox
      options={options}
      value={value ?? ''}
      onValueChange={(v) => onChange(v as any)}
      placeholder={objects === null ? 'Loading objects…' : 'Select an object'}
      searchPlaceholder="Search objects…"
      emptyText={objects === null ? 'Loading…' : 'No objects found'}
      disabled={disabled}
      className={cn(className)}
    />
  );
}

export default ObjectRefField;
