/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Filter Converter Utilities
 *
 * Shared utilities for converting MongoDB-like filter operators
 * to ObjectStack FilterNode AST format.
 */

import { normalizeFilterOperator } from '@objectstack/spec/ui';

/**
 * FilterNode AST type definition
 * Represents a filter condition or a logical combination of conditions
 * 
 * @example
 * // Simple condition
 * ['status', '=', 'active']
 * 
 * // Logical combination
 * ['and', ['age', '>=', 18], ['status', '=', 'active']]
 */
export type FilterNode = 
  | [string, string, any]  // [field, operator, value]
  | [string, ...FilterNode[]];  // [logic, ...conditions]

/**
 * Map MongoDB-like operators to ObjectStack filter operators.
 * 
 * @param operator - MongoDB-style operator (e.g., '$gte', '$in')
 * @returns ObjectStack operator or null if not recognized
 */
/**
 * A filter operator this layer will not translate.
 *
 * Carries the data API's own code and status for the same refusal so a failed
 * list renders "the filter is malformed" rather than "check your connection" —
 * `classifyLoadError` reads these, and a bare `Error` classifies as a network
 * fault, which is the one thing this is definitely not.
 */
export class FilterOperatorError extends Error {
  readonly code = 'INVALID_FILTER';
  readonly httpStatus = 400;
  constructor(message: string) {
    super(message);
    this.name = 'FilterOperatorError';
  }
}

export function convertOperatorToAST(operator: string): string | null {
  // Spec reference: framework/packages/spec/src/data/filter.zod.ts
  // Canonical MongoDB-style keys are camelCase ($startsWith, $endsWith, $notContains).
  // Lowercase aliases are accepted for tolerance.
  const operatorMap: Record<string, string> = {
    '$eq': '=',
    '$ne': '!=',
    '$gt': '>',
    '$gte': '>=',
    '$lt': '<',
    '$lte': '<=',
    '$in': 'in',
    '$nin': 'nin',
    '$notin': 'nin',
    '$between': 'between',
    '$contains': 'contains',
    '$notContains': 'notcontains',
    '$notcontains': 'notcontains',
    '$startsWith': 'startswith',
    '$startswith': 'startswith',
    '$endsWith': 'endswith',
    '$endswith': 'endswith',
  };
  
  return operatorMap[operator] || null;
}

/**
 * Convert object-based filters to ObjectStack FilterNode AST format.
 * Converts MongoDB-like operators to ObjectStack filter expressions.
 * 
 * @param filter - Object-based filter with optional operators
 * @returns FilterNode AST array
 * 
 * @example
 * // Simple filter - converted to AST
 * convertFiltersToAST({ status: 'active' })
 * // => ['status', '=', 'active']
 * 
 * @example
 * // Complex filter with operators
 * convertFiltersToAST({ age: { $gte: 18 } })
 * // => ['age', '>=', 18]
 * 
 * @example
 * // Multiple conditions
 * convertFiltersToAST({ age: { $gte: 18, $lte: 65 }, status: 'active' })
 * // => ['and', ['age', '>=', 18], ['age', '<=', 65], ['status', '=', 'active']]
 * 
 * @throws {Error} If an unknown operator is encountered
 */
export function convertFiltersToAST(filter: Record<string, any>): FilterNode | Record<string, any> {
  const conditions: FilterNode[] = [];
  
  for (const [field, value] of Object.entries(filter)) {
    if (value === null || value === undefined) continue;
    
    // Check if value is a complex operator object
    if (typeof value === 'object' && !Array.isArray(value)) {
      // Handle operator-based filters
      for (const [operator, operatorValue] of Object.entries(value)) {
        // `$regex` is refused, not downgraded. It used to become `contains`
        // behind a `console.warn` — but substring matching is a DIFFERENT
        // QUESTION, not a weaker version of the same one: `$regex: 'a.c'`
        // matches "abc", `contains 'a.c'` does not, and neither result looks
        // wrong on screen. A warning is not an error channel; nobody reads the
        // console of a deployed app.
        //
        // The spec has no `$regex` (`FILTER_OPERATORS`, data/filter.zod.ts), so
        // there is nothing to translate it INTO. Same treatment the unknown
        // operator below already gets, and for the same stated reason.
        if (operator === '$regex') {
          throw new FilterOperatorError(
            `[ObjectUI] The '$regex' filter operator is not supported. It used to be ` +
            `converted to 'contains', which matches a literal substring rather than a ` +
            `pattern — a different result, not a degraded one. ` +
            `Field: '${field}', Value: ${JSON.stringify(operatorValue)}. ` +
            `Use $contains, $startsWith or $endsWith.`
          );
        }

        // $null / $exists translate based on their boolean value (per spec semantics).
        // $null: true  → IS NULL    | $null: false  → IS NOT NULL
        // $exists: true → IS NOT NULL | $exists: false → IS NULL
        if (operator === '$null') {
          conditions.push([field, operatorValue ? 'is_null' : 'is_not_null', true]);
          continue;
        }
        if (operator === '$exists') {
          conditions.push([field, operatorValue ? 'is_not_null' : 'is_null', true]);
          continue;
        }

        const astOperator = convertOperatorToAST(operator);
        
        if (astOperator) {
          conditions.push([field, astOperator, operatorValue]);
        } else {
          // Unknown operator - throw error to avoid silent failure
          throw new FilterOperatorError(
            `[ObjectUI] Unknown filter operator '${operator}' for field '${field}'. ` +
            `Supported operators: $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $between, ` +
            `$contains, $notContains, $startsWith, $endsWith, $null, $exists. ` +
            `If you need exact object matching, use the value directly without an operator.`
          );
        }
      }
    } else {
      // Simple equality filter
      conditions.push([field, '=', value]);
    }
  }
  
  // If no conditions, return original filter
  if (conditions.length === 0) {
    return filter;
  }
  
  // If only one condition, return it directly
  if (conditions.length === 1) {
    return conditions[0];
  }
  
  // Multiple conditions: combine with 'and'
  return ['and', ...conditions];
}

/**
 * A spec `ViewFilterRule` as it arrives from stored view metadata.
 *
 * Structurally recognisable and NOT guessed at: every AST node is an ARRAY, a
 * rule is a plain OBJECT. The two can never be confused, so this predicate is
 * exact rather than heuristic.
 *
 * A blank `field` is deliberately NOT a rule — same predicate the write side
 * uses to drop the row `Add filter` inserts before a column is picked. Lowering
 * it would produce `['', op, value]`, which `isFilterAST` ACCEPTS and the
 * server answers `200` with zero rows (measured) — a silently-empty list. Left
 * unlowered it stays an object in AST position, which the server refuses with
 * `400 INVALID_FILTER` naming the element. Loud beats silently-empty.
 */
interface ViewFilterRuleLike {
  field: string;
  operator?: unknown;
  value?: unknown;
}

function isViewFilterRule(value: unknown): value is ViewFilterRuleLike {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const field = (value as { field?: unknown }).field;
  return typeof field === 'string' && field !== '';
}

/**
 * Lower ONE spec `ViewFilterRule` to an ObjectQL AST comparison node.
 *
 * The operator goes through the spec's OWN {@link normalizeFilterOperator} —
 * the exact exit the WRITE side uses (`app-shell/views/viewFilterFold.ts`), so
 * the two directions cannot drift into two dialects. No second canonical map is
 * introduced, and none is needed: all 19 `VIEW_FILTER_OPERATORS` are already
 * members of the wire's `VALID_AST_OPERATORS`, so the lowering is purely
 * structural. An operator the spec does not know is passed through VERBATIM, so
 * `isFilterAST` still refuses it and the server still answers `400
 * INVALID_FILTER` — a misspelling must not be coerced into a valid one.
 *
 * `value` is emitted only when the rule carries one. A rule that omits it
 * (`is_empty` / `is_null`, whose direction comes from the operator NAME) would
 * otherwise gain an invented `null` the author never wrote — `JSON.stringify`
 * turns a hole in an array into `null`, and `['x', 'equals', null]` is a real
 * `{x: null}` predicate, i.e. a silently-wrong filter. Same rule the write side
 * applies (`if (c.value !== undefined)`).
 */
function viewFilterRuleToNode(rule: ViewFilterRuleLike): FilterNode {
  const operator = normalizeFilterOperator(rule.operator as string);
  return (
    rule.value === undefined
      ? [rule.field, operator]
      : [rule.field, operator, rule.value]
  ) as FilterNode;
}

/**
 * Normalize ONE filter source into a single filter node.
 *
 * A "source" is whatever a view hands a renderer, and there are three shapes in
 * circulation, all legitimate:
 *
 *   - `[{ field, operator, value }, ...]`  a spec `ViewFilterRule[]`
 *   - `[['stage', '=', 'won'], ...]`       an AST node / legacy flat array
 *   - `{ status: 'active' }`               a MongoDB-style object
 *
 * The third is the one that kept getting lost. Renderers tested `source.length
 * > 0` before using it, which is `undefined > 0` for an object — so a
 * `table.defaultFilters` (declared `Record<string, any>`) was DROPPED and the
 * view returned every record. Silently: no error, just a wider answer.
 *
 * The FIRST never worked at all (objectui#3431). The array branch returned
 * every array VERBATIM, so a saved view's `ViewFilterRule[]` travelled to
 * `$filter` as bare rule objects — which the server refuses: `isFilterAST` is
 * false for an array of objects, and the wire face answers `400
 * INVALID_FILTER`. Verified against a real backend on the showcase's SHIPPED
 * `showcase_task.in_progress` view (`filter: [{field:'status',
 * operator:'equals', value:'in_progress'}]`): 400 as sent, 200 with its 2 rows
 * once lowered to `[['status','equals','in_progress']]`. Every saved view
 * carrying a filter was a failed list. `mergeFilterNodes` below has warned
 * about exactly this hazard since it was written — the warning was accurate,
 * and the sink it warns for never implemented the lowering it describes.
 *
 * **Why the fold lives HERE and not at the producer.** `ListViewSchema.filter`
 * / `ViewTab.filter` are spec-declared `z.array(ViewFilterRuleSchema)`, and a
 * view hands a renderer a `ListViewSchema` — so folding one hop earlier (in
 * `app-shell`'s ObjectView, say) would write ObjectQL AST triples INTO a
 * spec-declared rule-array slot: an off-spec value in a spec field, AGENTS.md
 * #0.1 inverted. This function is the last hop before the wire, where the value
 * legitimately leaves the spec's view vocabulary and becomes an ObjectQL AST.
 * It is also the single sink both producers already share — `plugin-list`'s
 * `buildEffectiveFilter` (which feeds the grid AND the export) and
 * `plugin-view`'s ObjectView (calendar / kanban / gallery / timeline). One
 * lowering, one place; the same reason the MongoDB-style shape is lowered here
 * rather than at each of its callers.
 *
 * Mixed arrays fold ELEMENT-WISE, because that is what reaches this function in
 * practice: `ObjectView` concatenates a saved view's rules with the
 * `?filter[<field>]=<value>` URL triples into one array. Triples pass through
 * untouched.
 *
 * Returns `undefined` for an absent or empty source, so callers can skip
 * `$filter` rather than sending an empty array.
 */
export function toFilterNode(source: unknown): FilterNode | Record<string, any> | undefined {
  if (source === null || source === undefined) return undefined;
  if (Array.isArray(source)) {
    if (source.length === 0) return undefined;
    // Spec `ViewFilterRule[]` (possibly mixed with AST nodes) → AST nodes. Left
    // untouched when the array holds no rule objects, which is the common case:
    // user-filter conditions and URL triples are already nodes.
    return (
      source.some(isViewFilterRule)
        ? source.map((el) => (isViewFilterRule(el) ? viewFilterRuleToNode(el) : el))
        : source
    ) as FilterNode;
  }
  if (typeof source !== 'object') return undefined;
  const obj = source as Record<string, any>;
  if (Object.keys(obj).length === 0) return undefined;
  // MongoDB-style → AST, so it can sit beside the other shapes under one `and`.
  return convertFiltersToAST(obj);
}

/**
 * Combine filter sources under a single `and`, each as its OWN child.
 *
 * Wrapping rather than spreading, on purpose. `['and', ...rules]` looks
 * equivalent and is not: spreading a `ViewFilterRule[]` puts bare rule OBJECTS
 * where the AST expects nodes, and the server does not accept that —
 * `isFilterAST` says no and the wire face answers `400 INVALID_FILTER`
 * (objectstack#4121). Spreading is only correct when the source happens to be
 * an array of nodes, which is why it survived.
 *
 * Since objectui#3431 the rule objects never reach that position anyway:
 * `toFilterNode` lowers a `ViewFilterRule[]` to AST nodes on the way in. The
 * paragraph above is kept because it is why each source stays its own child —
 * and because it correctly diagnosed the bug the sink itself was carrying.
 *
 * Sources that normalize to nothing are skipped; one surviving source is
 * returned as-is rather than wrapped in a pointless `and`.
 */
export function mergeFilterNodes(
  ...sources: unknown[]
): FilterNode | Record<string, any> | undefined {
  const nodes = sources.map(toFilterNode).filter((n) => n !== undefined);
  if (nodes.length === 0) return undefined;
  if (nodes.length === 1) return nodes[0];
  return ['and', ...nodes] as FilterNode;
}
