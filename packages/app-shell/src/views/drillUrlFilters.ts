/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * URL filter (de)serialization shared by the drill "escape hatch"
 * (`useOpenRecordList`, the WRITE side) and the ADR-0055 bare data surface
 * (`ObjectDataPage`, the READ side). Keeping both sides in ONE module keeps the
 * `filter[<field>][<op>]` operator contract (#1752) from drifting between the
 * code that emits a URL and the code that parses it back.
 *
 * Contract:
 *   - equality      `filter[field]=value`              → `[field, '=', value]`
 *   - range / cmp   `filter[field][gte|lte|gt|lt]=v`   → `[field, '>=' | … , v]`
 * A date-bucket drill emits `gte` + `lt` to scope a list to a time bucket.
 */

/** Filter triple shape shared with view metadata: [field, operator, value]. */
export type FilterTriple = [string, string, unknown];

/** URL range/comparison operator suffix → ObjectQL operator (READ side). */
export const URL_FILTER_OPS: Record<string, string> = { gte: '>=', lte: '<=', gt: '>', lt: '<' };

/** ObjectQL range operator key → URL param suffix (WRITE side). Inverse of the
 *  relevant `URL_FILTER_OPS` entries. */
export const RANGE_OP_PARAM: Record<string, string> = { $gte: 'gte', $lte: 'lte', $gt: 'gt', $lt: 'lt' };

/**
 * Parse `filter[<field>]=<value>` (equality) and `filter[<field>][<op>]=<value>`
 * (range/comparison) search params into ObjectQL triples. An unknown operator
 * suffix is ignored (never silently downgraded to equality).
 */
export function parseUrlFilterTriples(searchParams: URLSearchParams): FilterTriple[] {
  const out: FilterTriple[] = [];
  searchParams.forEach((value, key) => {
    if (value === '') return;
    // Operator form FIRST — the field capture must not swallow the `[op]` suffix.
    const mOp = /^filter\[([^\]]+)\]\[([a-z]+)\]$/.exec(key);
    if (mOp) {
      const op = URL_FILTER_OPS[mOp[2]];
      if (op) out.push([mOp[1], op, value]);
      return;
    }
    const m = /^filter\[([^\]]+)\]$/.exec(key);
    if (m && m[1]) out.push([m[1], '=', value]);
  });
  return out;
}

/**
 * Serialize a drill filter object into `filter[...]` search params. An ObjectQL
 * range operator object (`{ $gte, $lt }`) becomes `filter[field][gte|lt]`; a
 * plain value becomes `filter[field]`. `null`/`undefined` values and objects
 * with no recognized operator are skipped (drill degrades to a superset) rather
 * than stringified to `"[object Object]"`.
 */
export function serializeDrillFilterParams(
  filter: Record<string, unknown> | undefined,
): URLSearchParams {
  const params = new URLSearchParams();
  if (!filter) return params;
  for (const [field, value] of Object.entries(filter)) {
    if (value == null) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      for (const [op, suffix] of Object.entries(RANGE_OP_PARAM)) {
        const bound = (value as Record<string, unknown>)[op];
        if (bound != null) params.set(`filter[${field}][${suffix}]`, String(bound));
      }
      continue; // handled (range ops) or skipped — never String(object)
    }
    params.set(`filter[${field}]`, String(value));
  }
  return params;
}

/**
 * Delete the equality param AND every operator param (both range bounds) for a
 * field, so removing a date-range chip drops the whole range together (#1752).
 * Mutates and returns `params`.
 */
export function deleteFieldFilterParams(params: URLSearchParams, field: string): URLSearchParams {
  const prefix = `filter[${field}]`;
  for (const key of Array.from(params.keys())) {
    if (key === prefix || key.startsWith(`${prefix}[`)) params.delete(key);
  }
  return params;
}

/**
 * Group filter triples into ONE display chip per field, preserving first-seen
 * order. A date-bucket drill contributes two triples for the same field
 * (`>= start`, `< end`); they collapse into a single `start → end` range chip.
 */
export function groupFilterChips(triples: FilterTriple[]): Array<{ field: string; text: string }> {
  const order: string[] = [];
  const byField = new Map<string, FilterTriple[]>();
  for (const tr of triples) {
    if (!byField.has(tr[0])) {
      byField.set(tr[0], []);
      order.push(tr[0]);
    }
    byField.get(tr[0])!.push(tr);
  }
  return order.map((field) => {
    const list = byField.get(field)!;
    const gte = list.find(([, op]) => op === '>=' || op === '>');
    const lt = list.find(([, op]) => op === '<' || op === '<=');
    const text =
      gte || lt
        ? `${gte ? String(gte[2]) : '…'} → ${lt ? String(lt[2]) : '…'}`
        : `= ${String(list[0][2])}`;
    return { field, text };
  });
}
