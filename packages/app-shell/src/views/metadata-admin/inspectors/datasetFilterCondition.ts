// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Bridge between the visual {@link FilterBuilder} (a flat `FilterGroup` of
 * `{field, operator, value}` rows, camelCase operators) and the spec
 * `FilterCondition` (Mongo-style `{ field: { $op: value } }`, conjoined with
 * `$and`) stored on `dataset.filter` / `measure.filter`.
 *
 * Scope (deliberate): the visual editor supports the common case — a flat AND
 * of simple `field op value` conditions. Anything it can't faithfully round-trip
 * (nested groups, `$or`, multi-operator objects, unmapped operators) is reported
 * as NOT representable so the caller can fall back to the source editor instead
 * of silently corrupting the author's filter.
 */

/** FilterBuilder camelCase operator → FilterCondition Mongo operator. */
const OP_TO_MONGO: Record<string, string> = {
  equals: '$eq', notEquals: '$ne',
  greaterThan: '$gt', greaterOrEqual: '$gte', lessThan: '$lt', lessOrEqual: '$lte',
  after: '$gt', before: '$lt',
  contains: '$contains', in: '$in', notIn: '$nin',
};
const MONGO_TO_OP: Record<string, string> = {
  $eq: 'equals', $ne: 'notEquals',
  $gt: 'greaterThan', $gte: 'greaterOrEqual', $lt: 'lessThan', $lte: 'lessOrEqual',
  $contains: 'contains', $in: 'in', $nin: 'notIn',
};

export interface BuilderCondition { id?: string; field: string; operator: string; value?: unknown }
export interface BuilderGroup { id?: string; logic: 'and' | 'or'; conditions: BuilderCondition[] }
export type FilterCondition = Record<string, any>;

/** Serialize the visual group → a spec FilterCondition (flat `$and`). */
export function groupToCondition(group: BuilderGroup | undefined): FilterCondition | undefined {
  const conds = (group?.conditions ?? []).filter((c) => c && c.field);
  const parts: FilterCondition[] = [];
  for (const c of conds) {
    if (c.operator === 'isEmpty') { parts.push({ [c.field]: { $exists: false } }); continue; }
    if (c.operator === 'isNotEmpty') { parts.push({ [c.field]: { $exists: true } }); continue; }
    const mop = OP_TO_MONGO[c.operator];
    if (!mop) continue; // unmapped (e.g. notContains/between) — drop rather than emit a bad filter
    // Skip incomplete rows (no value typed yet) — emitting `{field:{$op:''}}` would
    // be a silently-wrong filter (matches only empty), not "no filter".
    const v = c.value;
    if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    parts.push({ [c.field]: { [mop]: v } });
  }
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return { $and: parts };
}

/**
 * Parse a stored FilterCondition → the visual group. `representable: false` when
 * the condition uses shapes the flat builder can't faithfully edit (nested
 * `$and`/`$or`, multi-op objects, unmapped operators) — callers should then show
 * the source editor instead.
 */
export function conditionToGroup(cond: FilterCondition | undefined | null): { group: BuilderGroup; representable: boolean } {
  const empty: BuilderGroup = { id: 'g', logic: 'and', conditions: [] };
  if (cond == null) return { group: empty, representable: true };
  if (typeof cond !== 'object' || Array.isArray(cond)) return { group: empty, representable: false };
  if ('$or' in cond) return { group: empty, representable: false };

  const list: FilterCondition[] = Array.isArray((cond as any).$and) ? (cond as any).$and : [cond];
  const conditions: BuilderCondition[] = [];
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (!c || typeof c !== 'object' || Array.isArray(c)) return { group: empty, representable: false };
    if ('$and' in c || '$or' in c) return { group: empty, representable: false };
    const keys = Object.keys(c);
    if (keys.length !== 1) return { group: empty, representable: false };
    const field = keys[0];
    const v = (c as any)[field];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const opKeys = Object.keys(v);
      if (opKeys.length !== 1) return { group: empty, representable: false };
      const mop = opKeys[0];
      if (mop === '$exists') {
        conditions.push({ id: `c${i}`, field, operator: v.$exists ? 'isNotEmpty' : 'isEmpty', value: '' });
      } else {
        const op = MONGO_TO_OP[mop];
        if (!op) return { group: empty, representable: false };
        conditions.push({ id: `c${i}`, field, operator: op, value: v[mop] });
      }
    } else {
      conditions.push({ id: `c${i}`, field, operator: 'equals', value: v }); // implicit equality
    }
  }
  return { group: { id: 'g', logic: 'and', conditions }, representable: true };
}
