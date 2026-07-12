import React from 'react';
import { Badge, EmptyValue, cn } from '@object-ui/components';
import { SchemaRendererContext } from '@object-ui/react';
import type { DataSource, QueryParams } from '@object-ui/types';
import { FieldWidgetProps } from './types';

/**
 * CapabilityMultiSelectField — structured picker for a permission set's
 * `system_permissions` (ADR-0056 / epic #2398, phase P2).
 *
 * `sys_permission_set.system_permissions` is framework-declared as a
 * `Field.textarea` that stores a **JSON-serialized array of capability names**
 * (e.g. `["setup.access","studio.access"]`; `security-plugin.ts` writes
 * `JSON.stringify(...)` and reads `parseJson(...)`). Editing that as raw JSON is
 * the anti-pattern ADR-0056 removes. This widget renders the same value as a
 * multi-select over the live `sys_capability` registry — grouped by scope,
 * labelled, with the capability description on hover — while round-tripping the
 * stored value **byte-for-byte** as a JSON string of names.
 *
 * Reached via the field `widget: 'capability-multiselect'` hint (stamped onto
 * the object metadata in MetadataProvider), registered in the field registry as
 * `field:capability-multiselect`.
 */

interface Capability {
  name: string;
  label?: string;
  description?: string;
  scope?: string;
  active?: boolean;
}

/**
 * Parse the stored value into the selected capability-name list. The canonical
 * storage is a JSON-string array; we also tolerate an already-parsed array (in
 * case a caller hands us the parsed value) and a bare comma-separated string
 * (legacy/hand-authored) so no selection is silently dropped.
 */
export function parseCapabilityNames(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v)).filter(Boolean);
      // A JSON scalar (unexpected) — treat as a single name.
      return [String(parsed)].filter(Boolean);
    } catch {
      // Not JSON — fall back to comma-splitting so legacy values survive.
      return s.split(',').map((x) => x.trim()).filter(Boolean);
    }
  }
  return [];
}

/** Scope → group header. Order is intentional (platform powers first). */
const SCOPE_ORDER = ['platform', 'org', 'other'] as const;
const SCOPE_LABEL: Record<string, string> = {
  platform: 'Platform',
  org: 'Organization',
  other: 'Other',
};

export function CapabilityMultiSelectField({
  value,
  onChange,
  readonly,
  className,
  ...props
}: FieldWidgetProps<string | string[]>) {
  const ctx = React.useContext(SchemaRendererContext);
  const dataSource: DataSource | null =
    (props as any).dataSource ?? (ctx as any)?.dataSource ?? null;
  const disabled = (props as any).disabled as boolean | undefined;

  const [caps, setCaps] = React.useState<Capability[] | null>(null);

  const selected = React.useMemo(() => parseCapabilityNames(value), [value]);

  // Load the live capability registry (active only). Mirrors LookupField's
  // context-dataSource access — createFieldRenderer does not forward the
  // dataSource prop, so the SchemaRenderer context is the reliable source.
  React.useEffect(() => {
    if (!dataSource || typeof (dataSource as any).find !== 'function') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await dataSource.find('sys_capability', {
          $filter: { active: true },
          $top: 500,
        } as QueryParams);
        const rows: Capability[] =
          (res as any)?.data ?? (res as any)?.records ?? (Array.isArray(res) ? res : []);
        if (!cancelled) setCaps(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setCaps([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dataSource]);

  // Emit as a JSON string so the value round-trips byte-equivalent to the
  // `system_permissions` textarea's `JSON.stringify(string[])` storage.
  const emit = React.useCallback(
    (names: string[]) => onChange(JSON.stringify(names) as any),
    [onChange],
  );

  // Union of the fetched registry and any *selected* names not present in it
  // (unknown / legacy / package-owned-inactive), so no current grant is hidden
  // or dropped. Unknown names land in the "other" group.
  const byName = React.useMemo(() => {
    const map = new Map<string, Capability>();
    for (const c of caps ?? []) if (c?.name) map.set(c.name, c);
    for (const n of selected) if (!map.has(n)) map.set(n, { name: n, label: n, scope: 'other' });
    return map;
  }, [caps, selected]);

  const labelFor = (name: string) => byName.get(name)?.label || name;

  // Group options by scope for the editable grid. Computed BEFORE the readonly
  // early-return so the hook order stays stable regardless of `readonly`.
  const groups = React.useMemo(() => {
    const buckets = new Map<string, Capability[]>();
    for (const c of byName.values()) {
      const key = (SCOPE_ORDER as readonly string[]).includes(c.scope as string)
        ? (c.scope as string)
        : 'other';
      const list = buckets.get(key) ?? [];
      list.push(c);
      buckets.set(key, list);
    }
    return SCOPE_ORDER.filter((s) => buckets.has(s)).map((s) => ({
      scope: s,
      label: SCOPE_LABEL[s] ?? s,
      items: (buckets.get(s) ?? []).sort((a, b) =>
        (a.label || a.name).localeCompare(b.label || b.name),
      ),
    }));
  }, [byName]);

  if (readonly) {
    if (selected.length === 0) return <EmptyValue />;
    return (
      <div className="flex flex-wrap gap-1">
        {selected.map((name) => (
          <Badge key={name} variant="outline" title={byName.get(name)?.description}>
            {labelFor(name)}
          </Badge>
        ))}
      </div>
    );
  }

  const toggle = (name: string) => {
    const next = selected.includes(name)
      ? selected.filter((x) => x !== name)
      : [...selected, name];
    emit(next);
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {caps === null && groups.length === 0 && (
        <span className="text-sm text-muted-foreground">Loading capabilities…</span>
      )}
      {groups.map((group) => (
        <div key={group.scope} className="flex flex-col gap-1.5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {group.label}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {group.items.map((cap) => {
              const active = selected.includes(cap.name);
              return (
                <button
                  type="button"
                  key={cap.name}
                  onClick={() => toggle(cap.name)}
                  disabled={disabled}
                  aria-pressed={active}
                  title={cap.description || undefined}
                  className={cn(
                    'rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-background text-foreground hover:bg-accent',
                  )}
                >
                  {cap.label || cap.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default CapabilityMultiSelectField;
