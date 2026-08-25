import React from 'react';
import { Badge, EmptyValue, cn } from '@object-ui/components';
import { SchemaRendererContext } from '@object-ui/react';
import type { DataSource, QueryParams } from '@object-ui/types';
import { PLATFORM_CAPABILITIES } from '@objectstack/spec/security';
import { FieldWidgetComponentProps } from './types.js';
import { useFieldTranslation } from './useFieldTranslation.js';

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
 * ## Not a registry field widget (objectui#3308)
 *
 * This is a plain component, imported directly by its host — Studio's
 * `PermissionMatrixEditor` (`packages/app-shell`), which is where ADR-0056 P2
 * put the capability editor. It is deliberately NOT reachable through the field
 * registry, and `widget: 'capability-multiselect'` is a **retired** hint: the
 * key only ever existed on the docs-site-only `registerFields()` path, nothing
 * ever stamped the hint (ADR-0056 P1 stamps `permission-facet-link` on all six
 * `sys_permission_set` facets), and it was removed under ADR-0049
 * enforce-or-remove. Do not re-register it without re-deciding ADR-0056 P2 —
 * a field carrying that hint now degrades to its declared `type` renderer,
 * which is the defined behavior for an unregistered widget.
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

/**
 * Scope → group header order (platform powers first). The visible header is
 * localized via `capability.group.<scope>` (objectui#2600 B5) — the capability
 * *labels themselves* still come from the sys_capability registry, whose
 * per-locale localization is tracked separately (framework).
 */
const SCOPE_ORDER = ['platform', 'org', 'other'] as const;

/**
 * objectui#2600 B5 — the curated platform capabilities whose labels this picker
 * localizes client-side via `capability.label.<name>`; package- and
 * admin-authored capabilities keep their authored `sys_capability` label.
 *
 * ## objectui#6285 — DERIVED from the spec, not restated
 *
 * This used to be a seven-member literal under a doc comment that said it
 * mirrored `@objectstack/spec/security`'s `PLATFORM_CAPABILITIES`. Nothing held
 * the claim, and the copy had already fallen a member behind: the spec grew
 * `manage_sharing`, the literal did not, so that one capability fell through to
 * its registry label and rendered untranslated in all ten packs beside seven
 * siblings that localize. Deriving retires the claim by making it structural —
 * there is no longer a second list to drift from.
 *
 * ## The dot → underscore transform is deliberate, and it belongs here too
 *
 * The spec spells three of the eight names with a dot (`setup.access`,
 * `setup.write`, `studio.access`) while the i18n keys spell them with an
 * underscore, and `labelFor` bridges that at the call site. The derivation
 * applies the SAME transform, so membership is in the same alphabet as the
 * keys. Deriving without it would silently un-localize those three — members
 * that work today — which is the one regression this shape can ship.
 *
 * ## What replaced the gate coverage this cost
 *
 * `scripts/check-i18n-call-site-keys.mjs` registered this symbol as a `kind:
 * 'set'` vocabulary and expanded `capability.label.<member>` into exact key
 * checks. Its reader parses repo source and needs a literal `new Set([…])`, so
 * a computed initialiser is `unreadable-vocabulary` there; the family is now
 * declared `enumerable: false` / `external-vocabulary`, and the member-to-label
 * tie is pinned at test time — where importing the spec is free — by
 * `CapabilityMultiSelectField.specDerivation-6285.test.tsx`, which covers the
 * `en` pack AND `useFieldTranslation`'s provider-less defaults map. That is
 * strictly more than the gate could state, because the gate could not see a
 * member the literal never named.
 */
const CURATED_CAPABILITY_LABELS: ReadonlySet<string> = new Set(
  PLATFORM_CAPABILITIES.map((c) => c.name.replace(/\./g, '_')),
);

export function CapabilityMultiSelectField({
  value,
  onChange,
  readonly,
  className,
  ...props
}: FieldWidgetComponentProps<string | string[]>) {
  const { t } = useFieldTranslation();
  const ctx = React.useContext(SchemaRendererContext);
  const dataSource: DataSource | null =
    (props.dataSource as any) ?? (ctx as any)?.dataSource ?? null;
  const disabled = props.disabled;

  const [caps, setCaps] = React.useState<Capability[] | null>(null);

  const selected = React.useMemo(() => parseCapabilityNames(value), [value]);

  // Load the live capability registry (active only). Mirrors LookupField's
  // context-dataSource access: no registration path forwards a `dataSource`
  // prop to a field widget, so the SchemaRenderer context is the reliable
  // source. (The absent forwarder named here used to be the docs-demo
  // `createFieldRenderer`, removed in objectui#3910 — the conclusion is
  // unchanged and now holds for the only remaining path.)
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

  // Curated platform caps get a localized label (objectui#2600 B5); everything
  // else keeps the registry-served label.
  const labelFor = (name: string) => {
    const registryLabel = byName.get(name)?.label || name;
    const norm = name.replace(/\./g, '_');
    if (!CURATED_CAPABILITY_LABELS.has(norm)) return registryLabel;
    // objectui#6285 — the membership is now open-ended: a capability the spec
    // adds joins this set the moment the pin is bumped, which is the point, but
    // its `capability.label.*` key still has to be authored by a human in the
    // ten packs. `defaultValue` makes that window degrade to the registry's
    // English label — exactly what this picker did for `manage_sharing` before
    // this change — instead of rendering a raw i18n key at the user, which
    // would be strictly worse than the defect being fixed. It is a fallback of
    // last resort, not the mechanism: the spec-derivation test fails in CI on
    // the same event, so the window should never reach a screen.
    return t(`capability.label.${norm}`, { defaultValue: registryLabel });
  };

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
      label: t(`capability.group.${s}`),
      items: (buckets.get(s) ?? []).sort((a, b) =>
        (a.label || a.name).localeCompare(b.label || b.name),
      ),
    }));
  }, [byName, t]);

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
                  {labelFor(cap.name)}
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
