import React from 'react';
import { FilterBuilder, cn } from '@object-ui/components';
import { SchemaRendererContext } from '@object-ui/react';
import type { FieldWidgetProps } from './types';

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
      referenceTo: f.reference_to || f.reference,
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

function condToMongo(c: BuilderCondition, typeOf: (f: string) => string | undefined): Record<string, any> | null {
  const { field, operator, value } = c || ({} as BuilderCondition);
  if (!field) return null;
  const t = typeOf(field);
  const cv = coerceByType(value, t);
  switch (operator) {
    case 'equals': return { [field]: cv };
    case 'notEquals': return { [field]: { $ne: cv } };
    case 'contains': return { [field]: { $contains: value } };
    case 'notContains': return { [field]: { $ncontains: value } };
    case 'isEmpty': return { [field]: { $in: [null, ''] } };
    case 'isNotEmpty': return { [field]: { $nin: [null, ''] } };
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
  if (frags.length === 0) return null; // empty = match all
  if (group.logic === 'or') return { $or: frags };
  if (frags.length === 1) return frags[0];
  const keys = frags.flatMap((f) => Object.keys(f));
  const noCollision = new Set(keys).size === keys.length;
  return noCollision ? Object.assign({}, ...frags) : { $and: frags };
}

function arraysEqual(a: any, b: any[]): boolean {
  return Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);
}

function kvToCondition(field: string, v: any, idx: number): BuilderCondition | null {
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
      case '$ncontains': return { id, field, operator: 'notContains', value: val };
      case '$gt': return { id, field, operator: 'greaterThan', value: val };
      case '$lt': return { id, field, operator: 'lessThan', value: val };
      case '$gte': return { id, field, operator: 'greaterOrEqual', value: val };
      case '$lte': return { id, field, operator: 'lessOrEqual', value: val };
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
  ...props
}: FieldWidgetProps<string | object>) {
  const ctx = React.useContext(SchemaRendererContext);
  const dataSource: any = (props as any).dataSource ?? (ctx as any)?.dataSource ?? null;
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
        Select an object first.
      </p>
    );
  }

  if (readonly) {
    if (!rawValue.trim()) {
      return <span className={cn('text-sm text-muted-foreground', className)}>All records</span>;
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
            className="min-h-[96px] w-full rounded border bg-background px-2 py-1 font-mono text-xs"
            value={rawValue}
            placeholder='{ "type": "customer", "is_active": true }'
            onChange={(e) => onChange(e.target.value as any)}
          />
          {!parsed.ok && (
            <span className="text-xs text-destructive">Invalid JSON — the rule will match no records until fixed.</span>
          )}
        </>
      ) : (
        <FilterBuilder
          fields={fields ?? []}
          value={(group ?? EMPTY_GROUP) as any}
          onChange={handleBuilderChange as any}
        />
      )}
      <button
        type="button"
        className="self-start text-xs text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => setRawMode((m) => !m)}
        disabled={!representable && !rawMode}
        title={!representable ? 'This criteria can only be edited as JSON' : undefined}
      >
        {rawMode ? 'Use visual builder' : 'Edit as JSON'}
      </button>
    </div>
  );
}

export default FilterConditionField;
