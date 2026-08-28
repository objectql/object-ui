/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn, Button, Input, Popover, PopoverContent, PopoverTrigger, LookupValuePicker } from '@object-ui/components';
import { ChevronDown, X, Plus } from 'lucide-react';
import type { ListViewSchema } from '@object-ui/types';
import { normalizeFilterOperator } from '@objectstack/spec/ui';
import { useSafeFieldLabel, useObjectTranslation } from '@object-ui/i18n';
// THE GATE the maintainer ruled onto `@object-ui/fields`' surface
// (objectui#4914, ruling B); the implementation is homed in
// `@object-ui/core` and re-exported there, so both spellings are one
// function and one dedupe set.
import { isRetiredFieldType, reportRetiredFieldType } from '@object-ui/fields';

function useMoreLabel(): string {
  // useObjectTranslation is provider-safe (never throws); no try/catch, which
  // would wrap the hook call and violate rules-of-hooks. The 'More' fallback
  // still applies when the key is missing/untranslated.
  const { t } = useObjectTranslation();
  const v = t('common.more');
  return !v || v === 'common.more' ? 'More' : v;
}

/** Resolved option with optional count */
interface ResolvedOption {
  label: string;
  value: string | number | boolean;
  color?: string;
  count?: number;
}

/** Resolved field with options derived from objectDef when not provided */
interface ResolvedField {
  field: string;
  label?: string;
  type?: string;
  options: ResolvedOption[];
  showCount?: boolean;
  defaultValues?: (string | number | boolean)[];
  /** Lookup-like fields: referenced object name */
  referenceTo?: string;
  /** Lookup-like fields: display field on referenced object */
  displayField?: string;
  /** Lookup-like fields: id field on referenced object */
  idField?: string;
}

/**
 * Lookup-like control types.
 *
 * `owner` left this set with objectui#4914 — a RETIRED spelling, refused by the
 * gate in {@link UserFilters}' badge renderer before this membership test runs.
 * The deletion is lockstep hygiene; the gate is the behavioural half.
 */
const LOOKUP_LIKE_TYPES = new Set(['lookup', 'master_detail', 'user']);

/**
 * Control kind for every filter control type the spec's
 * `UserFilterFieldSchema.type` (`ui/view.zod.ts`) publishes:
 *
 * - the enum names BOTH `select` and `multi-select`, so `select` necessarily
 *   means single-choice — rendering it as accumulating checkboxes made a
 *   single-choice filter silently accept many values (#2941);
 * - `date-range` and `text` used to be dead controls — the chip rendered and
 *   the popover said the literal "No options" (#2942). They now render a
 *   from/to date pair and a search input.
 *
 * Applies to the AUTHORED `type` only: when the author omits it, the control
 * is inferred from the field definition and keeps the historical multi-check
 * UX. Exported for the spec-parity test, which fails the moment the spec's
 * vocabulary and this table drift in either direction.
 */
export const FILTER_CONTROL_KINDS: Record<string, 'single-choice' | 'multi-choice' | 'range' | 'text'> = {
  select: 'single-choice',
  'multi-select': 'multi-choice',
  boolean: 'multi-choice',
  'date-range': 'range',
  text: 'text',
};

export interface UserFiltersProps {
  config: NonNullable<ListViewSchema['userFilters']>;
  /** Object definition for auto-deriving field options */
  objectDef?: any;
  /** Current data for computing counts */
  data?: any[];
  /** Callback when filter state changes */
  onFilterChange: (filters: any[]) => void;
  /** Maximum visible filter badges before collapsing into "More" dropdown (dropdown mode only) */
  maxVisible?: number;
  className?: string;
  /**
   * Initial selections to restore (e.g. from URL params). Keyed by field
   * name → selected values; the active tab preset is carried under the
   * reserved `_tab` key as a single-entry array.
   */
  initialSelections?: Record<string, Array<string | number | boolean>>;
  /**
   * Fires with the raw selection state on every user change (same shape as
   * `initialSelections`). Hosts use this to persist selections — e.g.
   * ObjectView/InterfaceListPage mirror them into `uf_*` URL params.
   */
  onSelectionsChange?: (selections: Record<string, Array<string | number | boolean>>) => void;
}

/**
 * Normalize tab presets to the client shape. Accepts both:
 * - @objectstack/spec ViewTab: `{ name, label, filter: ViewFilterRule[], isDefault }`
 * - legacy client shape: `{ id, label, filters: triplet[], default }`
 *
 * **The spec rule → AST lowering is purely structural**, and deliberately owns
 * NO operator table of its own (#3470). All 19 `VIEW_FILTER_OPERATORS` are
 * already members of the wire's `VALID_AST_OPERATORS`, so nothing needs
 * translating; only the legacy spellings stored view metadata still carries
 * (`gt`, `eq`, `nin`, `notEquals`, …) need folding onto the canonical word, and
 * that is exactly what the spec's OWN {@link normalizeFilterOperator} does —
 * the same single exit the WRITE side uses (`app-shell/views/viewFilterFold.ts`)
 * and the same one `@object-ui/core`'s `viewFilterRuleToNode` uses for a saved
 * view's `filter` (#3431). One exit, so the directions cannot drift apart.
 *
 * The private table this replaced was the second hand-kept operator map in this
 * package, and it had drifted: it lowered `not_in`/`nin` to the SPACED
 * `'not in'`, which is in no spec vocabulary — `isFilterAST()` refuses it and
 * the wire answers `400 INVALID_FILTER`. Measured against a real backend
 * (published `@objectstack/*@17.0.0-rc.2` + app-showcase, `showcase_task`):
 * `[["status","not in",["done"]]]` → **400 INVALID_FILTER**;
 * `[["status","not_in",["done"]]]` → **200, 8 rows** (same rows as the
 * `["status","!=","done"]` baseline). Every other operator the old table
 * rewrote was measured to be a no-op on the answer — see below.
 *
 * **`before`/`after` are passed through, not mapped** (the one judgement call
 * this change had to make: the old table rewrote them to `<`/`>`, and both
 * words are themselves `VALID_AST_OPERATORS` members). Measured on the same
 * backend, on a `date` field and a `datetime` field, both directions —
 * identical status AND identical record ids:
 *
 *   `["due_date","before","2026-08-01"]`               → 200, 2 rows
 *   `["due_date","<","2026-08-01"]`                    → 200, the SAME 2 rows
 *   `["due_date","after","2026-08-01"]`                → 200, 8 rows
 *   `["due_date",">","2026-08-01"]`                    → 200, the SAME 8 rows
 *   `["created_at","before","2026-08-01T00:00:00.000Z"]` → 200, 6 rows  (`<` idem)
 *   `["created_at","after","2026-08-01T00:00:00.000Z"]`  → 200, 3 rows  (`>` idem)
 *
 * So dropping that rewrite is a pure fix, not a behaviour change. (The spec
 * agrees independently: `canonicalAstOperator('before')` is `'<'`.)
 *
 * An operator the spec does not know is passed through **verbatim**, so
 * `isFilterAST()` still refuses it and the server still answers a loud `400`.
 * A misspelling must never be coerced into a valid operator (AGENTS.md #0.1):
 * silently reading `bfore` as `before` would return a plausible-looking wrong
 * record set instead of an error the author can see.
 *
 * That applies to a rule which OMITS the operator too, and it is the one place
 * this is a deliberate behaviour change rather than a pure fix. The deleted
 * table opened with `case undefined: … return '='`, inventing an equality
 * predicate for a rule that has no operator at all. `ViewFilterRuleSchema`
 * REQUIRES `operator` (it is a bare `z.enum`, no default — an operator-less rule
 * fails `safeParse` with `invalid_value`), so such a rule is off-spec metadata
 * that publish validation refuses; silently answering it with `field = value`
 * was a lenient consumer standing in for the contract. It now lowers to
 * `[field, undefined, value]`, which `isFilterAST()` refuses — the same loud
 * `400` every other off-spec spelling gets.
 */
function normalizeTabPresets(tabs: any[]): Array<{ id: string; label: string; filters: any[]; default?: boolean }> {
  return (tabs || [])
    .filter((t: any) => t && (t.id || t.name))
    .map((t: any) => ({
      id: t.id ?? t.name,
      label: typeof t.label === 'string' ? t.label : (t.label?.toString?.() ?? t.id ?? t.name),
      filters: Array.isArray(t.filters)
        ? t.filters
        : (Array.isArray(t.filter)
            ? t.filter
                .filter((r: any) => r && typeof r.field === 'string')
                .map((r: any) => [r.field, normalizeFilterOperator(r.operator), r.value])
            : []),
      default: t.default ?? t.isDefault,
    }));
}

/**
 * UserFilters — Airtable Interfaces-style filter bar.
 *
 * Renders one of three modes based on `config.element`:
 * - **dropdown**: field-level dropdown selector badges
 * - **tabs**: named filter preset tab bar
 * - **toggle**: on/off toggle buttons per field
 */
export function UserFilters({
  config,
  objectDef,
  data = [],
  onFilterChange,
  maxVisible,
  className,
  initialSelections,
  onSelectionsChange,
}: UserFiltersProps) {
  // The AUTHORING type (ADR-0053) only admits dropdown/tabs; stored metadata
  // still carries the spec-deprecated `toggle`, which must keep rendering
  // (ADR-0047 §3.4a) — hence the wider comparand.
  switch (config.element as 'dropdown' | 'tabs' | 'toggle') {
    case 'dropdown':
      return (
        <DropdownFilters
          fields={config.fields || []}
          objectDef={objectDef}
          data={data}
          onFilterChange={onFilterChange}
          maxVisible={maxVisible}
          className={className}
          initialSelections={initialSelections}
          onSelectionsChange={onSelectionsChange}
        />
      );
    case 'tabs':
      return (
        <TabFilters
          tabs={normalizeTabPresets(config.tabs || [])}
          showAllRecords={config.showAllRecords !== false}
          allowAddTab={config.allowAddTab}
          onFilterChange={onFilterChange}
          className={className}
          initialTab={typeof initialSelections?._tab?.[0] === 'string' ? (initialSelections._tab[0] as string) : undefined}
          onSelectionsChange={onSelectionsChange}
        />
      );
    // DEPRECATED in the spec (ADR-0047 §3.4a: "kept in the enum so existing
    // configs keep rendering; do not author new `toggle` filters") — but the
    // compatibility promise is the renderer's to keep, and `default: return
    // null` was deleting the ENTIRE filter bar for stored toggle configs
    // (#2942). Authoring tooling no longer offers it; this branch only keeps
    // old metadata working.
    case 'toggle':
      return (
        <ToggleFilters
          fields={config.fields || []}
          onFilterChange={onFilterChange}
          className={className}
        />
      );
    default:
      return null;
  }
}

// ============================================
// Shared helper — resolve field options
// ============================================
function resolveFields(
  fields: NonNullable<NonNullable<ListViewSchema['userFilters']>['fields']>,
  objectDef: any,
  data: any[],
  i18n?: {
    objectName?: string;
    fieldLabel: (objectName: string, fieldName: string, fallback: string) => string;
    translateOptions: (
      objectName: string,
      fieldName: string,
      options: Array<{ value: any; label: string; [k: string]: any }>
    ) => Array<{ value: any; label: string; [k: string]: any }>;
  },
): ResolvedField[] {
  return fields.map(f => {
    let options: ResolvedOption[] = f.options ? [...f.options] : [];
    let resolvedType: string | undefined = f.type;
    let referenceTo: string | undefined;
    let displayField: string | undefined;
    let idField: string | undefined;
    // Object-level field label from objectDef, used as a fallback when the
    // view author didn't supply `f.label` (or it was stripped during compile).
    // Without this the chip degrades to the raw snake_case field key.
    let objectLabel: string | undefined;

    if (objectDef?.fields) {
      const fieldDef =
        Array.isArray(objectDef.fields)
          ? objectDef.fields.find((fd: any) => fd.name === f.field)
          : objectDef.fields[f.field];
      if (fieldDef) {
        // Adopt field type from objectDef when caller didn't specify
        if (!resolvedType) resolvedType = fieldDef.type;
        objectLabel = fieldDef.label;
        // Capture lookup metadata regardless of caller-specified type
        referenceTo = fieldDef.reference_to ?? fieldDef.reference;
        displayField = fieldDef.display_field ?? fieldDef.reference_field;
        idField = fieldDef.id_field;

        if (options.length === 0 && fieldDef.options) {
          if (Array.isArray(fieldDef.options)) {
            options = fieldDef.options.map((o: any) => ({
              label: o.label ?? String(o.value ?? o),
              value: o.value ?? o,
              color: o.color,
            }));
          } else {
            options = Object.entries(fieldDef.options).map(([value, meta]) => ({
              label: (meta as any)?.label || value,
              value,
              color: (meta as any)?.color,
            }));
          }
        }
      }
    }

    // Auto-derive options for boolean fields when none were provided
    if (options.length === 0 && resolvedType === 'boolean') {
      options = [
        { label: 'True', value: true },
        { label: 'False', value: false },
      ];
    }

    if (f.showCount && data.length > 0) {
      options = options.map(opt => ({
        ...opt,
        count: data.filter(row => row[f.field] === opt.value).length,
      }));
    }

    // i18n: translate option labels and field label via the resolver.
    // Fallback chain for the displayed label: author-supplied `f.label` →
    // objectDef's `label` → raw field key. The i18n resolver takes the same
    // chain as its untranslated fallback so a stripped/omitted `f.label` still
    // renders a human label instead of the snake_case key.
    let resolvedLabel = f.label ?? objectLabel;
    if (i18n?.objectName) {
      options = i18n.translateOptions(i18n.objectName, f.field, options as any) as ResolvedOption[];
      const authored = f.label || objectLabel;
      const resolved = i18n.fieldLabel(i18n.objectName, f.field, authored || f.field);
      // Guard against auto-extracted skeleton entries: `os i18n extract` emits
      // `fields.<obj>.<field> = "<field>"` for fields with no authored label, and
      // the resolver happily returns that key-valued "translation" — clobbering
      // an explicitly authored `f.label` (e.g. '项目类型' → 'project_type'). A
      // translation equal to the raw field key carries no information, so keep the
      // authored label when the resolver only found the skeleton. A *real*
      // translation (differs from the key) still wins, preserving localization.
      resolvedLabel = resolved === f.field && authored ? authored : resolved;
    }

    return {
      ...f,
      label: resolvedLabel,
      type: resolvedType,
      options,
      referenceTo,
      displayField,
      idField,
    };
  });
}

// ============================================
// Dropdown Mode
// ============================================
interface DropdownFiltersProps {
  fields: NonNullable<NonNullable<ListViewSchema['userFilters']>['fields']>;
  objectDef?: any;
  data: any[];
  onFilterChange: (filters: any[]) => void;
  maxVisible?: number;
  className?: string;
  initialSelections?: Record<string, Array<string | number | boolean>>;
  onSelectionsChange?: (selections: Record<string, Array<string | number | boolean>>) => void;
}

function DropdownFilters({ fields, objectDef, data, onFilterChange, maxVisible, className, initialSelections, onSelectionsChange }: DropdownFiltersProps) {
  const { fieldLabel, translateOptions } = useSafeFieldLabel();
  const moreLabel = useMoreLabel();
  const objectName: string | undefined = objectDef?.name;
  // Control kind per field, from the AUTHORED type only. Keyed off the raw
  // config, not the resolved field: `resolveFields` back-fills `type` from
  // the object definition, and an inferred type must keep the historical
  // multi-check UX (#2941).
  const controlKinds = React.useMemo(
    () => new Map(fields.map(f => [f.field, FILTER_CONTROL_KINDS[f.type ?? '']])),
    [fields],
  );
  const [selectedValues, setSelectedValues] = React.useState<
    Record<string, (string | number | boolean)[]>
  >(() => {
    const init: Record<string, (string | number | boolean)[]> = {};
    fields.forEach(f => {
      if (f.defaultValues && f.defaultValues.length > 0) {
        init[f.field] = f.defaultValues;
      }
      // Restored selections (e.g. from URL params) override author defaults.
      const restored = initialSelections?.[f.field];
      if (restored && restored.length > 0) {
        init[f.field] = restored;
      }
      // A single-choice control can never hold more than one value, whatever
      // an author default or a hand-edited URL claims. (A `range` holds its
      // [from, to] pair; `text` its one query — both self-limit.)
      if (controlKinds.get(f.field) === 'single-choice' && (init[f.field]?.length ?? 0) > 1) {
        init[f.field] = init[f.field].slice(0, 1);
      }
    });
    return init;
  });

  // Option counts must reflect the result set BEFORE the field's own
  // selection narrows it — the server returns already-filtered rows, so
  // counting those would zero out every unselected option the moment one
  // value is picked. Snapshot each field's counts while it has no active
  // selection and replay the snapshot while one is active.
  const countsSnapshotRef = React.useRef<Record<string, Map<string, number>>>({});
  const resolvedFields = React.useMemo(() => {
    const resolved = resolveFields(fields, objectDef, data, { objectName, fieldLabel, translateOptions });
    return resolved.map(f => {
      if (!f.showCount) return f;
      const selected = selectedValues[f.field] || [];
      if (selected.length === 0) {
        countsSnapshotRef.current[f.field] = new Map(
          f.options.map(o => [String(o.value), o.count ?? 0]),
        );
        return f;
      }
      const snapshot = countsSnapshotRef.current[f.field];
      if (!snapshot) return f;
      return {
        ...f,
        options: f.options.map(o => ({ ...o, count: snapshot.get(String(o.value)) ?? o.count })),
      };
    });
  }, [fields, objectDef, data, objectName, fieldLabel, translateOptions, selectedValues]);

  const emitFilters = React.useCallback(
    (next: Record<string, (string | number | boolean)[]>) => {
      // Condition shape per control kind (#2942): a `range` lowers to
      // >=/<= bounds, `text` to a contains query; option controls keep the
      // historical `in` set.
      const conditions = Object.entries(next).flatMap(([field, values]) => {
        if (values.length === 0) return [];
        switch (controlKinds.get(field)) {
          case 'range': {
            const [from, to] = values as [unknown?, unknown?];
            const bounds: Array<[string, string, unknown]> = [];
            if (from !== undefined && from !== '') bounds.push([field, '>=', from]);
            if (to !== undefined && to !== '') bounds.push([field, '<=', to]);
            return bounds;
          }
          case 'text': {
            const query = String(values[0] ?? '').trim();
            return query ? [[field, 'contains', query] as [string, string, unknown]] : [];
          }
          default:
            return [[field, 'in', values] as [string, string, unknown]];
        }
      });
      onFilterChange(conditions);
    },
    [onFilterChange, controlKinds],
  );

  const handleChange = (field: string, values: (string | number | boolean)[]) => {
    const next = { ...selectedValues, [field]: values };
    setSelectedValues(next);
    emitFilters(next);
    onSelectionsChange?.(next);
  };

  // Emit default/restored filters on mount. URL-restored values arrive as
  // strings; coerce them against the resolved option value types so the
  // checkbox state (`selected.includes(opt.value)`) matches typed options
  // (numbers, booleans) — the query condition uses the same coerced value.
  React.useEffect(() => {
    let current = selectedValues;
    const coerced: Record<string, (string | number | boolean)[]> = {};
    let changed = false;
    for (const [field, values] of Object.entries(current)) {
      const rf = resolvedFields.find(f => f.field === field);
      const next = values.map(v => {
        if (!rf || typeof v !== 'string') return v;
        const opt = rf.options.find(o => String(o.value) === v);
        if (opt && opt.value !== v) return opt.value;
        if (rf.type === 'boolean' && (v === 'true' || v === 'false')) return v === 'true';
        return v;
      });
      coerced[field] = next;
      if (next.some((v, i) => v !== values[i])) changed = true;
    }
    if (changed) {
      setSelectedValues(coerced);
      current = coerced;
    }
    const hasSelections = Object.values(current).some(v => v.length > 0);
    if (hasSelections) emitFilters(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Split fields into visible and overflow based on maxVisible
  const visibleFields = maxVisible !== undefined && maxVisible < resolvedFields.length
    ? resolvedFields.slice(0, maxVisible)
    : resolvedFields;
  const overflowFields = maxVisible !== undefined && maxVisible < resolvedFields.length
    ? resolvedFields.slice(maxVisible)
    : [];

  const renderBadge = (f: ResolvedField) => {
    const selected = selectedValues[f.field] || [];
    const kind = controlKinds.get(f.field);
    // A range stores ['', to] / [from, ''] placeholders — count real values.
    const activeCount = selected.filter(v => v !== '' && v !== undefined && v !== null).length;
    const hasSelection = activeCount > 0;
    const singleChoice = kind === 'single-choice';
    // THE GATE (objectui#4914, ruling B), ahead of the lookup-like test.
    //
    // This face was the one the measurement had to work hardest to prove live
    // (comment 5324769751). The docblock on `FILTER_CONTROL_KINDS` says the
    // control type comes from the spec's published `UserFilterFieldSchema.type`
    // — an enum that never held `owner` — which would make this dead. The line
    // `if (!resolvedType) resolvedType = fieldDef.type;` in `resolveFields`
    // refutes it: when the view author omits the filter `type`, the resolved
    // type is adopted VERBATIM from the object definition, so a backend column
    // typed `owner` flows straight into this predicate.
    //
    // The gate answers that traffic the way the maintainer ruled it must be
    // answered: a retired spelling arriving through a backend-vocabulary
    // normalizer is an authoring error to refuse loudly, not foreign input to
    // tolerate. The chip still renders — refusing to draw it would strip a
    // stored filter out of the toolbar with nothing in its place — but it gets
    // the ordinary control instead of the remote person picker, and the author
    // gets the prescription once.
    const retiredType = isRetiredFieldType(f.type);
    if (retiredType) reportRetiredFieldType(f.type as string);
    const isLookupLike =
      !retiredType &&
      LOOKUP_LIKE_TYPES.has(f.type || '') &&
      f.options.length === 0 &&
      (f.referenceTo || f.type === 'user');
    const popoverWidth = isLookupLike ? 'w-72' : 'w-56';

    return (
      <Popover key={f.field}>
        <PopoverTrigger asChild>
          <button
            // Inside a <form> a bare <button> defaults to type="submit", so an
            // untyped trigger would submit the enclosing form on every click
            // (objectui#3344). Radix's PopoverTrigger happens to supply
            // type="button" via its Slot today, but that is an upstream
            // implementation detail — declare the contract locally, exactly as
            // the Combobox trigger does.
            type="button"
            data-testid={`filter-badge-${f.field}`}
            className={cn(
              'inline-flex items-center gap-1 h-7 px-2 text-xs transition-colors shrink-0 rounded-md',
              hasSelection
                ? 'text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="truncate max-w-[100px]">{f.label || f.field}</span>
            {hasSelection && (
              <span className="text-[10px] text-muted-foreground/80 tabular-nums">
                {activeCount}
              </span>
            )}
            {hasSelection ? (
              <X
                className="h-3 w-3 opacity-60 hover:opacity-100"
                data-testid={`filter-clear-${f.field}`}
                onClick={e => {
                  e.stopPropagation();
                  handleChange(f.field, []);
                }}
              />
            ) : (
              <ChevronDown className="h-3 w-3 opacity-60" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className={cn(popoverWidth, 'p-2')}>
          {isLookupLike ? (
            <div data-testid={`filter-lookup-${f.field}`}>
              <LookupValuePicker
                field={{
                  value: f.field,
                  label: f.label || f.field,
                  type: f.type,
                  referenceTo: f.referenceTo,
                  displayField: f.displayField,
                  idField: f.idField,
                }}
                value={selected}
                multiple={true}
                onChange={(value) => {
                  const arr = Array.isArray(value)
                    ? (value as (string | number | boolean)[])
                    : (value === undefined || value === null || value === '')
                      ? []
                      : [value as string | number | boolean];
                  handleChange(f.field, arr);
                }}
              />
            </div>
          ) : kind === 'range' ? (
            // Authored `type: 'date-range'` — a from/to day-granularity pair.
            // Used to render the literal "No options" dead control (#2942).
            <div className="space-y-2 p-1" data-testid={`filter-range-${f.field}`}>
              {([0, 1] as const).map((slot) => (
                <label key={slot} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-8 shrink-0">{slot === 0 ? 'From' : 'To'}</span>
                  <input
                    type="date"
                    data-testid={`filter-range-${f.field}-${slot === 0 ? 'from' : 'to'}`}
                    value={String(selected[slot] ?? '')}
                    onChange={(e) => {
                      const next: (string | number | boolean)[] = [
                        String(selected[0] ?? ''),
                        String(selected[1] ?? ''),
                      ];
                      next[slot] = e.target.value;
                      handleChange(f.field, next[0] === '' && next[1] === '' ? [] : next);
                    }}
                    className="h-7 flex-1 rounded border border-input bg-background px-2 text-xs text-foreground"
                  />
                </label>
              ))}
            </div>
          ) : kind === 'text' ? (
            // Authored `type: 'text'` — a contains query, committed on Enter /
            // blur so typing doesn't refire the list query per keystroke.
            <input
              type="search"
              data-testid={`filter-text-${f.field}`}
              defaultValue={String(selected[0] ?? '')}
              placeholder={f.label || f.field}
              onBlur={(e) => {
                const q = e.target.value.trim();
                handleChange(f.field, q ? [q] : []);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const q = (e.target as HTMLInputElement).value.trim();
                  handleChange(f.field, q ? [q] : []);
                }
              }}
              className="h-8 w-full rounded border border-input bg-background px-2 text-xs text-foreground"
            />
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-0.5" data-testid={`filter-options-${f.field}`}>
              {f.options.length === 0 ? (
                <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                  No options
                </div>
              ) : (
                f.options.map(opt => (
                  <label
                    key={String(opt.value)}
                    className={cn(
                      'flex items-center gap-2 text-sm py-1.5 px-2 rounded cursor-pointer',
                      selected.includes(opt.value) ? 'bg-primary/5 text-primary' : 'hover:bg-muted',
                    )}
                  >
                    <input
                      type={singleChoice ? 'radio' : 'checkbox'}
                      name={singleChoice ? `user-filter-${f.field}` : undefined}
                      checked={selected.includes(opt.value)}
                      onChange={() => {
                        // Single-choice replaces the selection; multi toggles
                        // the clicked value in place (#2941). Clearing a
                        // single-choice pick is the badge ×.
                        const next = singleChoice
                          ? [opt.value]
                          : selected.includes(opt.value)
                            ? selected.filter(v => v !== opt.value)
                            : [...selected, opt.value];
                        handleChange(f.field, next);
                      }}
                      className={singleChoice ? 'border-input' : 'rounded border-input'}
                    />
                    {opt.color && (
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: opt.color }}
                      />
                    )}
                    <span className="truncate flex-1">{opt.label}</span>
                    {opt.count !== undefined && (
                      <span className="text-xs text-muted-foreground">{opt.count}</span>
                    )}
                  </label>
                ))
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className={cn('flex items-center gap-0.5 overflow-x-auto', className)} data-testid="user-filters-dropdown">
      {resolvedFields.length === 0 ? (
        <span className="text-xs text-muted-foreground" data-testid="user-filters-empty">
          No filter fields
        </span>
      ) : (
        <>
          {visibleFields.map(renderBadge)}
          {overflowFields.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  // Same as the chip trigger above: Radix supplies type="button"
                  // via its Slot today, but the contract is declared locally
                  // (objectui#3344).
                  type="button"
                  data-testid="user-filters-more"
                  className="inline-flex items-center gap-1 h-7 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 rounded-md"
                >
                  <span>{moreLabel}</span>
                  <span className="text-[10px] text-muted-foreground/80 tabular-nums">
                    {overflowFields.length}
                  </span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-2" data-testid="user-filters-more-content">
                <div className="space-y-1">
                  {overflowFields.map(renderBadge)}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </>
      )}
    </div>
  );
}

// ============================================
// Tabs Mode
// ============================================
interface TabFiltersProps {
  tabs: NonNullable<NonNullable<ListViewSchema['userFilters']>['tabs']>;
  showAllRecords?: boolean;
  allowAddTab?: boolean;
  onFilterChange: (filters: any[]) => void;
  className?: string;
  /** Tab id to activate on mount (e.g. restored from URL); wins over `default`. */
  initialTab?: string;
  /** Fires with `{ _tab: [tabId] }` when the user switches tabs. */
  onSelectionsChange?: (selections: Record<string, Array<string | number | boolean>>) => void;
}

/**
 * A tab the END USER added at runtime through `allowAddTab` — never an
 * authored preset, never metadata. See {@link TabFilters} for the scope rules.
 */
interface SessionTab {
  id: string;
  label: string;
  filters: any[];
}

function TabFilters({ tabs, showAllRecords, allowAddTab, onFilterChange, className, initialTab, onSelectionsChange }: TabFiltersProps) {
  const [activeTab, setActiveTab] = React.useState<string>(() => {
    // URL-restored tab wins over the author's default.
    if (initialTab && (initialTab === '__all__' || tabs.some(t => t.id === initialTab))) {
      return initialTab;
    }
    const defaultTab = tabs.find(t => t.default);
    return defaultTab?.id || (showAllRecords ? '__all__' : tabs[0]?.id || '');
  });

  /**
   * User-added tabs (`allowAddTab`), held in **component state only**.
   *
   * ADR-0047 scopes an end user's filter choices to the session and forbids
   * them ever becoming metadata, so this renderer stays a metadata READER:
   * adding a tab writes no `sys_metadata`, calls no API, and touches no
   * storage. Component state (not `sessionStorage`) is the deliberate pick —
   * `UserFilters` receives no object/view identity, so a shared
   * `sessionStorage` key would surface one list's ad-hoc tabs on another
   * list's bar in the same browser tab. Persistence beyond the mount, if it
   * is ever wanted, belongs to the host that already owns the session channel
   * for filter selections (`onSelectionsChange` → `uf_*` URL params) and can
   * key it by view.
   */
  const [sessionTabs, setSessionTabs] = React.useState<SessionTab[]>([]);
  const [addOpen, setAddOpen] = React.useState(false);
  const [draftLabel, setDraftLabel] = React.useState('');

  /**
   * Conditions currently applied for `tabId` — the preset's filters, the
   * session tab's snapshot, or `[]` for the synthetic "All records" tab (and
   * for an id nothing answers to, which is how a stale restored `_tab`
   * degrades). In tabs mode this IS the whole filter state of the bar: the
   * component owns no other filter surface.
   */
  const filtersForTab = React.useCallback(
    (tabId: string): any[] => {
      if (tabId === '__all__') return [];
      // `normalizeTabPresets` guarantees `id` on every preset it emits.
      const preset = tabs.find(t => t.id === tabId);
      if (preset) return preset.filters || [];
      return sessionTabs.find(t => t.id === tabId)?.filters || [];
    },
    [tabs, sessionTabs],
  );

  const handleTabChange = React.useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      onFilterChange(filtersForTab(tabId));
      onSelectionsChange?.({ _tab: [tabId] });
    },
    [filtersForTab, onFilterChange, onSelectionsChange],
  );

  const allTabs = React.useMemo(() => {
    const result = [...tabs];
    if (showAllRecords) {
      result.push({ id: '__all__', label: 'All records', filters: [] });
    }
    return result;
  }, [tabs, showAllRecords]);

  /**
   * Confirm the naming input: snapshot the conditions currently applied under
   * the typed label and select the new tab.
   *
   * The snapshot source is the active tab's conditions because that is the
   * entire filter state tabs mode carries (see {@link filtersForTab}) — the
   * new tab therefore reproduces exactly the rows the user is looking at when
   * they press Add. Each condition is copied so a later preset change cannot
   * alias into the session tab.
   *
   * The synthetic id is reported through `onSelectionsChange` like any other
   * tab switch, so the host's mirror stays truthful. A host that persists it
   * (`uf__tab` in the URL) hands it back as `initialTab` on the next mount,
   * where the existing id check finds no such tab and falls back to the
   * author's default — a session tab cannot outlive the mount by the back door.
   */
  const handleAddTab = React.useCallback(() => {
    const label = draftLabel.trim();
    if (!label) return;
    // Synthetic, session-only id. `__…__` mirrors the "__all__" spelling this
    // component already uses for the tab it invents; the loop keeps it clear
    // of author-defined preset ids.
    const taken = new Set<string>([
      ...tabs.map(t => t.id ?? t.name ?? ''),
      ...sessionTabs.map(t => t.id),
    ]);
    let seq = sessionTabs.length + 1;
    while (taken.has(`__session_${seq}__`)) seq += 1;
    const id = `__session_${seq}__`;
    const snapshot = filtersForTab(activeTab).map(c => (Array.isArray(c) ? [...c] : c));
    setSessionTabs(prev => [...prev, { id, label, filters: snapshot }]);
    setActiveTab(id);
    setDraftLabel('');
    setAddOpen(false);
    onFilterChange(snapshot);
    onSelectionsChange?.({ _tab: [id] });
  }, [draftLabel, tabs, sessionTabs, filtersForTab, activeTab, onFilterChange, onSelectionsChange]);

  /**
   * Drop a session tab. Removing the ACTIVE one re-selects the author's
   * default with the same precedence the initial mount uses, so the bar is
   * never left with no active tab while the removed tab's conditions stay
   * applied. Presets have no remove affordance — they are metadata.
   */
  const handleRemoveTab = React.useCallback(
    (tabId: string) => {
      setSessionTabs(prev => prev.filter(t => t.id !== tabId));
      if (activeTab !== tabId) return;
      const defaultTab = tabs.find(t => t.default);
      handleTabChange(defaultTab?.id || (showAllRecords ? '__all__' : tabs[0]?.id || ''));
    },
    [activeTab, tabs, showAllRecords, handleTabChange],
  );

  // Emit the initially-active tab's filters on mount (restored tab or
  // author default — `activeTab` already resolved the precedence).
  React.useEffect(() => {
    if (activeTab && activeTab !== '__all__') {
      const tab = tabs.find(t => t.id === activeTab);
      if (tab) onFilterChange(tab.filters || []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn('flex items-center gap-0.5 overflow-x-auto', className)} data-testid="user-filters-tabs">
      {allTabs.map(tab => {
        // Tab identity: canonical `name`, falling back to the deprecated `id`
        // (mirrors `normalizeTabPresets`). The synthetic "__all__" tab sets `id`.
        const tabId = tab.id ?? tab.name ?? '';
        return (
          <button
            key={tabId}
            // A plain button, NOT a Radix trigger — nothing supplied a type, so
            // this one really did render as type="submit" and clicking a preset
            // tab inside a <form> submitted it (objectui#3344 family;
            // objectstack#6952 measured it: the two triggers above already read
            // `button`, this one read `null`).
            type="button"
            data-testid={`filter-tab-${tabId}`}
            onClick={() => handleTabChange(tabId)}
            className={cn(
              'inline-flex items-center h-7 px-3 text-xs font-medium rounded-md transition-colors shrink-0',
              activeTab === tabId
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {tab.label}
          </button>
        );
      })}
      {/* User-added tabs, in the same bar as the presets. They carry a remove
          affordance (presets don't — those are metadata), so the pill is a
          wrapper around two buttons rather than one button. */}
      {sessionTabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <span
            key={tab.id}
            className={cn(
              'inline-flex items-center h-7 rounded-md transition-colors shrink-0',
              isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            <button
              type="button"
              data-testid={`filter-tab-${tab.id}`}
              onClick={() => handleTabChange(tab.id)}
              className="inline-flex items-center h-7 pl-3 pr-1 text-xs font-medium rounded-l-md"
            >
              {tab.label}
            </button>
            <button
              type="button"
              data-testid={`filter-tab-remove-${tab.id}`}
              onClick={() => handleRemoveTab(tab.id)}
              title="Remove tab"
              aria-label={`Remove tab ${tab.label}`}
              className="inline-flex items-center h-7 pl-0.5 pr-2 rounded-r-md opacity-60 hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}
      {allowAddTab && (
        <Popover
          open={addOpen}
          onOpenChange={open => {
            setAddOpen(open);
            if (!open) setDraftLabel('');
          }}
        >
          <PopoverTrigger asChild>
            <button
              // Same as the chip trigger: Radix supplies type="button" via its
              // Slot today, but the contract is declared locally (objectui#3344).
              // (Corrected from "a Radix trigger keeps the HTML default of
              // submit" — objectstack#6952 measured that it does not.)
              type="button"
              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
              data-testid="filter-tab-add"
              title="Add filter tab"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2 space-y-2" data-testid="filter-tab-add-content">
            <p className="text-xs text-muted-foreground">
              Name this tab. It keeps the filters applied right now, and lives in this session only.
            </p>
            <Input
              autoFocus
              value={draftLabel}
              onChange={e => setDraftLabel(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTab();
                }
              }}
              placeholder="Tab name"
              className="h-7 text-xs"
              data-testid="filter-tab-add-input"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={!draftLabel.trim()}
                data-testid="filter-tab-add-confirm"
                onClick={handleAddTab}
              >
                Add tab
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

// ============================================
// Toggle Mode
// ============================================
interface ToggleFiltersProps {
  fields: NonNullable<NonNullable<ListViewSchema['userFilters']>['fields']>;
  onFilterChange: (filters: any[]) => void;
  className?: string;
}

function ToggleFilters({ fields, onFilterChange, className }: ToggleFiltersProps) {
  const [activeToggles, setActiveToggles] = React.useState<Set<string>>(() => {
    const defaults = new Set<string>();
    fields.forEach(f => {
      if (f.defaultValues && f.defaultValues.length > 0) defaults.add(f.field);
    });
    return defaults;
  });

  const emitFilters = React.useCallback(
    (active: Set<string>) => {
      const conditions = Array.from(active).map(fieldName => {
        const fieldDef = fields.find(fd => fd.field === fieldName);
        return fieldDef?.defaultValues
          ? [fieldName, 'in', fieldDef.defaultValues]
          : [fieldName, '!=', null];
      });
      onFilterChange(conditions);
    },
    [fields, onFilterChange],
  );

  const handleToggle = (field: string) => {
    setActiveToggles(prev => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      emitFilters(next);
      return next;
    });
  };

  // Emit default filters on mount
  React.useEffect(() => {
    if (activeToggles.size > 0) emitFilters(activeToggles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn('flex items-center gap-1 overflow-x-auto', className)} data-testid="user-filters-toggle">
      {fields.map(f => {
        const isActive = activeToggles.has(f.field);
        return (
          <Button
            key={f.field}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-3 text-xs shrink-0"
            data-testid={`filter-toggle-${f.field}`}
            onClick={() => handleToggle(f.field)}
          >
            {f.label || f.field}
          </Button>
        );
      })}
    </div>
  );
}
