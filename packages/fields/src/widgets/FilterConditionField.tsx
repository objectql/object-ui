import React from 'react';
import { FilterBuilder, cn } from '@object-ui/components';
import { SchemaRendererContext } from '@object-ui/react';
import type { FieldWidgetComponentProps } from './types.js';
import { toDomProps } from './toDomProps.js';
import { useFieldTranslation } from './useFieldTranslation.js';

/**
 * FilterConditionField — visual criteria builder for a stored FilterCondition
 * (e.g. `sys_sharing_rule.criteria_json`), scoped to the object chosen in a
 * sibling `object_name` field.
 *
 * Reached via the field `widget: 'filter-condition'` hint (resolves as
 * `field:filter-condition`). Reads the live `object_name` from
 * `dependentValues`, loads that object's fields via
 * `dataSource.getObjectSchema(...)`, and renders `<FilterBuilder>` over them —
 * so an admin builds `type == "customer" AND is_active == true` by picking
 * fields/operators instead of hand-writing JSON.
 *
 * Storage contract: the value round-trips as a **MongoDB-style object filter**
 * (`{ field: value }`, `{ field: { $gt: n } }`, `{ $or: [...] }`), JSON-encoded
 * — the exact shape the sharing evaluator spreads into `engine.find(object,
 * { filter })`. Criteria that can't be represented in the builder (nested
 * mixes, unknown operators) fall back to a raw-JSON editor so nothing is hidden
 * or lost; an "Edit as JSON" toggle is always available.
 */

interface FilterFieldDef {
  value: string;
  label: string;
  type?: string;
  options?: Array<{ value: string; label: string }>;
  referenceTo?: string;
}

interface BuilderCondition {
  id: string;
  field: string;
  operator: string;
  value: any;
}
interface BuilderGroup {
  id: string;
  logic: 'and' | 'or';
  conditions: BuilderCondition[];
}

const EMPTY_GROUP: BuilderGroup = { id: 'root', logic: 'and', conditions: [] };

/**
 * Opt-in FilterBuilder operators this widget offers (objectui#4023,
 * objectui#4736).
 *
 * The shared dropdown withholds these because two of its three consumers
 * persist into dialects that cannot carry them (see `OPT_IN_OPERATORS` in
 * `@object-ui/components`'s `filter-builder.tsx`). THIS widget can: its value
 * is a MongoDB-style `FieldOperatorsSchema` criteria that the server's engine
 * evaluates directly — never lowered through the array/triplet AST and never
 * folded into a `ViewFilterRule` — so the spec's `FILTER_OPERATORS` is the only
 * vocabulary it has to satisfy.
 *
 *   - `containsCaseInsensitive` authors `$icontains`, executable on every
 *     driver and evaluation face the platform ships (objectstack#5702 +
 *     objectstack#6520).
 *   - `exists` / `notExists` author `$exists`, which `condToMongo` has emitted
 *     and `kvToCondition` has read back since objectui#2942. Naming them here
 *     is what KEEPS them reachable now that the shared dropdown no longer
 *     offers them to the list and view surfaces, whose dialects have no
 *     existence operator at all (objectui#4736).
 *
 * Module scope, not an inline literal: a fresh array each render would reset
 * `FilterBuilder`'s memo inputs on every keystroke.
 *
 * @internal exported for tests
 */
export const FILTER_CONDITION_EXTRA_OPERATORS: readonly string[] = [
  'containsCaseInsensitive',
  'exists',
  'notExists',
];

/** Field types that are not meaningfully filterable in a simple builder. */
const NON_FILTERABLE = new Set([
  'object', 'vector', 'file', 'image', 'avatar', 'signature',
  'richtext', 'html', 'markdown', 'location', 'grid', 'json', 'code',
]);

function deriveFilterFields(schema: any): FilterFieldDef[] {
  const raw = schema?.fields;
  const entries: Array<[string, any]> = Array.isArray(raw)
    ? raw.map((f: any) => [f?.name, f])
    : raw && typeof raw === 'object'
      ? Object.entries(raw)
      : [];
  const out: FilterFieldDef[] = [];
  for (const [name, f] of entries) {
    if (!name || !f || f.hidden) continue;
    const type = f.type as string | undefined;
    if (type && NON_FILTERABLE.has(type)) continue;
    out.push({
      value: name,
      label: f.label || name,
      type,
      options: Array.isArray(f.options)
        ? f.options.map((o: any) =>
            typeof o === 'string'
              ? { value: o, label: o }
              : { value: String(o?.value), label: String(o?.label ?? o?.value) },
          )
        : undefined,
      // ⚠️ objectui#6837 half 2: the READ narrows to `reference` (the only
      // spelling the protocol declares — `FieldSchema` refuses `reference_to`
      // by name). The EMITTED key is unchanged: it is what this emit's TARGET
      // contract declares, and renaming it would be a separate change.
      // Source here is `dataSource.getObjectSchema(objectName)` — an object
      // schema, i.e. the protocol. Target contract: the local `FilterFieldDef`,
      // which spells it camelCase `referenceTo`.
      referenceTo: f.reference,
    });
  }
  return out;
}

function coerceByType(value: any, type?: string): any {
  if (value == null) return value;
  if (type === 'boolean' || type === 'toggle') {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  }
  if (type === 'number' || type === 'currency' || type === 'percent' || type === 'rating' || type === 'slider') {
    const n = Number(value);
    return Number.isFinite(n) && value !== '' ? n : value;
  }
  return value;
}

function toArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
  return value == null ? [] : [value];
}

/**
 * Builder condition → `$`-operator criteria. Exported for tests: this is the
 * chokepoint where a builder token becomes a spec `FieldOperatorsSchema` key,
 * and a wrong spelling here is rejected downstream by `convertFiltersToAST`
 * rather than at authoring time. @internal
 */
export function condToMongo(c: BuilderCondition, typeOf: (f: string) => string | undefined): Record<string, any> | null {
  const { field, operator, value } = c || ({} as BuilderCondition);
  if (!field) return null;
  const t = typeOf(field);
  const cv = coerceByType(value, t);
  switch (operator) {
    case 'equals': return { [field]: cv };
    case 'notEquals': return { [field]: { $ne: cv } };
    case 'contains': return { [field]: { $contains: value } };
    // Case-insensitive contains (objectui#4023). `$contains` and its ASCII-case-
    // folding twin are two operators, not one with a flag: `contains` keeps
    // emitting `$contains` so stored criteria keep meaning what they meant.
    // The fold is ASCII-only by contract (objectstack#4706 Q1 = A) — `café` does
    // NOT match `CAFÉ` — which is why the label says "ignore case" rather than
    // promising an accent-blind search.
    case 'containsCaseInsensitive': return { [field]: { $icontains: value } };
    // `$notContains` is the spec spelling (FieldOperatorsSchema, data/filter.zod.ts).
    // This emitted `$ncontains` — a token that appears nowhere in @objectstack/spec and
    // that convertFiltersToAST throws on, so every "does not contain" rule authored here
    // was rejected downstream. See kvToCondition for reading the old spelling back.
    case 'notContains': return { [field]: { $notContains: value } };
    // String-specific spec operators — previously unreachable from the
    // builder UI even though FieldOperatorsSchema accepts them (#2942).
    case 'startsWith': return { [field]: { $startsWith: value } };
    case 'endsWith': return { [field]: { $endsWith: value } };
    case 'isEmpty': return { [field]: { $in: [null, ''] } };
    case 'isNotEmpty': return { [field]: { $nin: [null, ''] } };
    // Null / existence spec operators. Distinct from isEmpty/isNotEmpty,
    // which also treat '' as empty.
    case 'isNull': return { [field]: { $null: true } };
    case 'isNotNull': return { [field]: { $null: false } };
    case 'exists': return { [field]: { $exists: true } };
    case 'notExists': return { [field]: { $exists: false } };
    case 'greaterThan':
    case 'after': return { [field]: { $gt: cv } };
    case 'lessThan':
    case 'before': return { [field]: { $lt: cv } };
    case 'greaterOrEqual': return { [field]: { $gte: cv } };
    case 'lessOrEqual': return { [field]: { $lte: cv } };
    case 'between': {
      const [a, b] = Array.isArray(value) ? value : [undefined, undefined];
      return { [field]: { $gte: coerceByType(a, t), $lte: coerceByType(b, t) } };
    }
    case 'in': return { [field]: { $in: toArray(value).map((v) => coerceByType(v, t)) } };
    case 'notIn': return { [field]: { $nin: toArray(value).map((v) => coerceByType(v, t)) } };
    default: return { [field]: cv };
  }
}

function filterGroupToMongo(group: BuilderGroup, typeOf: (f: string) => string | undefined): Record<string, any> | null {
  const frags = (group?.conditions ?? [])
    .map((c) => condToMongo(c, typeOf))
    .filter((x): x is Record<string, any> => !!x);
  // No conditions → no predicate. NOT "match all": a sharing rule with an
  // empty criteria is refused on save, and one already stored shares nothing
  // (objectstack#3896 / ADR-0049). `null` becomes an empty stored value, which
  // is what the required-criteria messaging below keys off.
  if (frags.length === 0) return null;
  if (group.logic === 'or') return { $or: frags };
  if (frags.length === 1) return frags[0];
  const keys = frags.flatMap((f) => Object.keys(f));
  const noCollision = new Set(keys).size === keys.length;
  return noCollision ? Object.assign({}, ...frags) : { $and: frags };
}

function arraysEqual(a: any, b: any[]): boolean {
  return Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Criteria → builder condition (the reverse of {@link condToMongo}). Returning
 * `null` makes the builder refuse to load the rule ("criteria can't be
 * represented"), so this must keep accepting spellings previously written.
 * @internal
 */
export function kvToCondition(field: string, v: any, idx: number): BuilderCondition | null {
  const id = `c_${idx}_${field}`;
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    return { id, field, operator: 'equals', value: v };
  }
  const opKeys = Object.keys(v);
  if (opKeys.length === 1) {
    const op = opKeys[0];
    const val = v[op];
    switch (op) {
      case '$ne': return { id, field, operator: 'notEquals', value: val };
      case '$contains': return { id, field, operator: 'contains', value: val };
      // Without this arm a criteria the builder itself just wrote would fail to
      // load on reopen ("criteria can't be represented") and drop the admin into
      // the raw-JSON editor — the degradation objectui#4023 deliverable 2 names.
      case '$icontains': return { id, field, operator: 'containsCaseInsensitive', value: val };
      // `$ncontains` is the pre-fix spelling this widget used to emit. Criteria saved
      // before the fix still carry it, so keep reading it — dropping it here would make
      // those rules fail to load ("criteria can't be represented") instead of migrating.
      case '$notContains':
      case '$ncontains': return { id, field, operator: 'notContains', value: val };
      case '$gt': return { id, field, operator: 'greaterThan', value: val };
      case '$lt': return { id, field, operator: 'lessThan', value: val };
      case '$gte': return { id, field, operator: 'greaterOrEqual', value: val };
      case '$lte': return { id, field, operator: 'lessOrEqual', value: val };
      case '$startsWith': return { id, field, operator: 'startsWith', value: val };
      case '$endsWith': return { id, field, operator: 'endsWith', value: val };
      case '$null': return { id, field, operator: val === false ? 'isNotNull' : 'isNull', value: '' };
      case '$exists': return { id, field, operator: val === false ? 'notExists' : 'exists', value: '' };
      case '$in':
        return arraysEqual(val, [null, ''])
          ? { id, field, operator: 'isEmpty', value: '' }
          : { id, field, operator: 'in', value: val };
      case '$nin':
        return arraysEqual(val, [null, ''])
          ? { id, field, operator: 'isNotEmpty', value: '' }
          : { id, field, operator: 'notIn', value: val };
      default: return null;
    }
  }
  if (opKeys.length === 2 && '$gte' in v && '$lte' in v) {
    return { id, field, operator: 'between', value: [v.$gte, v.$lte] };
  }
  return null;
}

/** Returns a BuilderGroup, or `null` when the criteria can't be represented. */
function mongoToFilterGroup(mongo: any): BuilderGroup | null {
  if (mongo == null) return { ...EMPTY_GROUP, conditions: [] };
  if (typeof mongo !== 'object' || Array.isArray(mongo)) return null;
  const entries = Object.entries(mongo);
  if (entries.length === 0) return { ...EMPTY_GROUP, conditions: [] };
  if (entries.length === 1 && (mongo.$or || mongo.$and)) {
    const logic: 'and' | 'or' = mongo.$or ? 'or' : 'and';
    const arr = mongo.$or || mongo.$and;
    if (!Array.isArray(arr)) return null;
    const conditions: BuilderCondition[] = [];
    for (let i = 0; i < arr.length; i++) {
      const frag = arr[i];
      if (!frag || typeof frag !== 'object' || Object.keys(frag).length !== 1) return null;
      const field = Object.keys(frag)[0];
      if (field.startsWith('$')) return null;
      const c = kvToCondition(field, frag[field], i);
      if (!c) return null;
      conditions.push(c);
    }
    return { id: 'root', logic, conditions };
  }
  const conditions: BuilderCondition[] = [];
  let i = 0;
  for (const [field, v] of entries) {
    if (field.startsWith('$')) return null; // mixed logical + field → raw
    const c = kvToCondition(field, v, i++);
    if (!c) return null;
    conditions.push(c);
  }
  return { id: 'root', logic: 'and', conditions };
}

/**
 * Would this criteria select EVERY record of the object?
 *
 * Mirrors the server's `isMatchAllCriteria` (objectstack `plugin-sharing`,
 * #3896) closely enough to warn before the round-trip: blank, `{}`, `[]`, and
 * the vacuous combinators. Deliberately conservative in the same direction —
 * the cost of a false positive is one extra hint, the cost of a false negative
 * is a save that fails with a toast. The server stays authoritative.
 *
 * @internal exported for tests
 */
export function isMatchAllCriteria(parsed: any): boolean {
  if (parsed == null) return true;
  if (Array.isArray(parsed)) return parsed.every(isMatchAllCriteria);
  if (typeof parsed !== 'object') return true;
  const entries = Object.entries(parsed);
  if (entries.length === 0) return true;
  for (const [key, value] of entries) {
    if (key === '$and') {
      if (!Array.isArray(value) || value.every(isMatchAllCriteria)) continue;
      return false;
    }
    if (key === '$or') {
      if (!Array.isArray(value) || value.length === 0 || value.some(isMatchAllCriteria)) continue;
      return false;
    }
    return false;
  }
  return true;
}

function stringifyValue(value: string | object | undefined | null): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

export function FilterConditionField({
  value,
  onChange,
  readonly,
  className,
  error,
  ...props
}: FieldWidgetComponentProps<string | object>) {
  const ctx = React.useContext(SchemaRendererContext);
  const { t } = useFieldTranslation();
  const dataSource: any = props.dataSource ?? (ctx as any)?.dataSource ?? null;
  const dependentValues: Record<string, any> = (props as any).dependentValues ?? {};
  const objectName = String(dependentValues.object_name ?? '');

  const [fields, setFields] = React.useState<FilterFieldDef[] | null>(null);

  React.useEffect(() => {
    setFields(null);
    if (!dataSource || !objectName || typeof dataSource.getObjectSchema !== 'function') return;
    let cancelled = false;
    (async () => {
      try {
        const schema = await dataSource.getObjectSchema(objectName);
        if (!cancelled) setFields(deriveFilterFields(schema));
      } catch {
        if (!cancelled) setFields([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dataSource, objectName]);

  const rawValue = React.useMemo(() => stringifyValue(value), [value]);

  const parsed = React.useMemo(() => {
    if (!rawValue.trim()) return { mongo: {}, ok: true };
    try {
      return { mongo: JSON.parse(rawValue), ok: true };
    } catch {
      return { mongo: null, ok: false };
    }
  }, [rawValue]);

  const group = React.useMemo(
    () => (parsed.ok ? mongoToFilterGroup(parsed.mongo) : null),
    [parsed],
  );

  // Only flag a criteria that PARSES to match-all. Unparsable JSON has its own
  // message (`invalidJson`) and must not collect a second, contradictory one.
  const isEmptyCriteria = React.useMemo(
    () => parsed.ok && isMatchAllCriteria(parsed.mongo),
    [parsed],
  );

  // Raw JSON mode: forced when the stored value can't be represented in the
  // builder; otherwise opt-in via the toggle.
  const representable = parsed.ok && group !== null;
  const [rawMode, setRawMode] = React.useState<boolean>(!representable);
  React.useEffect(() => {
    if (!representable) setRawMode(true);
  }, [representable]);

  const typeOf = React.useMemo(() => {
    const map = new Map((fields ?? []).map((f) => [f.value, f.type]));
    return (f: string) => map.get(f);
  }, [fields]);

  const handleBuilderChange = (g: BuilderGroup) => {
    const mongo = filterGroupToMongo(g, typeOf);
    onChange((mongo == null ? '' : JSON.stringify(mongo)) as any);
  };

  if (!objectName) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        {t('fields.filterCondition.selectObjectFirst')}
      </p>
    );
  }

  if (readonly) {
    if (!rawValue.trim()) {
      // Used to read "All records" — which was both wrong and the most
      // dangerous thing this widget could say (objectstack#3896). A rule with
      // no criteria has never usefully shared everything; it now shares
      // nothing and is refused on save, so name that instead.
      return (
        <span className={cn('text-sm text-destructive', className)}>
          {t('fields.filterCondition.noCriteria')}
        </span>
      );
    }
    return (
      <pre className={cn('overflow-x-auto rounded bg-muted/40 p-2 text-xs', className)}>
        {rawValue}
      </pre>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {rawMode ? (
        <>
          <textarea
            // DOM pass-through onto the raw-JSON editing surface
            // (objectui#3318). NOTE this widget stays on the #3318 ledger
            // regardless: its dependency-gated state (no `object_name` chosen
            // yet — the state a fresh form and the registry sweep render) is a
            // plain hint paragraph with no focusable control.
            {...toDomProps(props)}
            className="min-h-[96px] w-full rounded border bg-background px-2 py-1 font-mono text-xs"
            value={rawValue}
            placeholder='{ "type": "customer", "is_active": true }'
            onChange={(e) => onChange(e.target.value as any)}
            // The form's validation slot (#3222) OR this widget's own
            // unparsable-JSON state, which already renders its red message.
            aria-invalid={!!error || !parsed.ok}
          />
          {!parsed.ok && (
            <span className="text-xs text-destructive">{t('fields.filterCondition.invalidJson')}</span>
          )}
        </>
      ) : (
        <FilterBuilder
          fields={fields ?? []}
          value={(group ?? EMPTY_GROUP) as any}
          onChange={handleBuilderChange as any}
          extraOperators={FILTER_CONDITION_EXTRA_OPERATORS}
        />
      )}
      {/*
        The server refuses to save a criteria that would select every record
        (objectstack#3896), but that rejection only arrives as a toast after
        the admin hits Save. Say it here, while they are still looking at the
        empty builder — and never imply that leaving it empty means "share
        everything", which is what this widget used to do.
      */}
      {isEmptyCriteria && (
        <span className="text-xs text-destructive">
          {t('fields.filterCondition.criteriaRequired')}
        </span>
      )}
      <button
        type="button"
        className="self-start text-xs text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => setRawMode((m) => !m)}
        disabled={!representable && !rawMode}
        title={!representable ? t('fields.filterCondition.jsonOnly') : undefined}
      >
        {rawMode
          ? t('fields.filterCondition.useVisualBuilder')
          : t('fields.filterCondition.editAsJson')}
      </button>
    </div>
  );
}

export default FilterConditionField;
