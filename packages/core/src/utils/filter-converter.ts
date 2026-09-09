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

import {
  normalizeFilterOperator,
  VIEW_FILTER_OPERATORS,
  VIEW_FILTER_LIST_VALUE_OPERATORS,
  VIEW_FILTER_PAIR_VALUE_OPERATORS,
} from '@objectstack/spec/ui';
import { isAcceptedFilterComparand, ACCEPTED_FILTER_COMPARAND_TYPES_SENTENCE } from '@objectstack/spec/data';

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
 * The `FilterCondition` combinators this lowering can carry, and the AST
 * keyword each becomes.
 *
 * The vocabulary is the spec's, not a second list: `FILTER_ARRAY_LOGIC_KEYWORDS`
 * (`@objectstack/spec/data`) is `['and', 'or']` — measured — and those two are
 * exactly the heads `isFilterAST` opens a group on. `$not` is absent from it,
 * which is why it has no row here and is refused below rather than translated.
 */
const AST_LOGIC_KEYWORD: Record<string, 'and' | 'or'> = {
  $and: 'and',
  $or: 'or',
};

/**
 * Lower ONE `$and` / `$or` group to an AST group node.
 *
 * Returns `undefined` when the group is the TRUE identity and therefore
 * constrains nothing, so the caller drops it instead of emitting a childless
 * `['and']` — which is NOT the same thing. Measured against the spec's own
 * doors: `isFilterAST(['and'])` is `false` and `parseFilterAST(['and'])` is
 * `undefined`, i.e. NO FILTER — every row. A combinator that reduces to "no
 * constraint" must therefore disappear at THIS level; emitting an empty group
 * would widen the result set, which is the one failure direction this file
 * exists to avoid.
 *
 * `#5322` (maintainer ruling 2026-08-04, recorded on `FilterConditionSchema`)
 * fixes the identities: `{ $and: [] }` is TRUE, `{ $or: [] }` is FALSE, and a
 * `{}` disjunct is TRUE and ABSORBS its `$or`. TRUE is expressible here — it is
 * the absence of a constraint. FALSE is not: the AST has no contradiction
 * literal, so `{ $or: [] }` keeps the emission it already had (see
 * {@link falseIdentityLeaf}).
 */
function lowerLogicalGroup(
  field: string,
  keyword: 'and' | 'or',
  value: unknown,
): FilterNode | undefined {
  if (!Array.isArray(value)) {
    throw new FilterOperatorError(
      `[ObjectUI] The '${field}' filter combinator takes an ARRAY of conditions. ` +
      `Received ${typeof value === 'object' ? 'an object' : typeof value}: ` +
      `${JSON.stringify(value)}. Spec: FilterCondition declares ` +
      `'${field}?: FilterCondition[]' (data/filter.zod.ts).`
    );
  }

  if (value.length === 0) {
    return keyword === 'and' ? undefined : falseIdentityLeaf(field, value);
  }

  const children: FilterNode[] = [];
  for (const child of value) {
    if (child === null || typeof child !== 'object' || Array.isArray(child)) {
      throw new FilterOperatorError(
        `[ObjectUI] Every member of '${field}' must be a filter condition OBJECT. ` +
        `Received ${JSON.stringify(child)}. Spec: FilterCondition declares ` +
        `'${field}?: FilterCondition[]' (data/filter.zod.ts).`
      );
    }
    const lowered = convertFiltersToAST(child as Record<string, any>);
    if (!Array.isArray(lowered)) {
      // `convertFiltersToAST` hands back the ORIGINAL OBJECT when the child
      // produced no conditions — a `{}` disjunct, or one holding only
      // null/undefined values. That child is the TRUE identity (#5322), so it
      // absorbs an `$or` outright and drops out of an `$and`. It must not be
      // pushed as a child either way: an object in AST child position makes
      // `isFilterAST` false (measured), and the wire face answers `400
      // INVALID_FILTER` for the whole filter.
      if (keyword === 'or') return undefined;
      continue;
    }
    children.push(lowered as FilterNode);
  }

  // Every conjunct reduced to TRUE, so the `$and` constrains nothing.
  if (children.length === 0) return undefined;

  // A one-child group is emitted as a group, not unwrapped. `['or', node]` is
  // accepted by `isFilterAST` (length >= 2 = keyword + one condition) and
  // `parseFilterAST` reduces it to the child, so the extra hop costs nothing
  // and keeps this function's output shape a function of the INPUT shape.
  return [keyword, ...children] as FilterNode;
}

/**
 * `{ $or: [] }` — FALSE, the OR identity (#5322) — as the leaf this file has
 * always emitted for it.
 *
 * Deliberately unchanged, and deliberately not a group node. Three measurements
 * against `@objectstack/spec` 17.3.0 and this repo's own evaluator decide it:
 *
 *   - `parseFilterAST(['$or', '=', []])` is `{ $or: [] }` — the FilterCondition
 *     the author wrote, which every backend reduces to zero rows. Correct.
 *   - `ValueDataSource`'s matcher reads it as a comparison on a field named
 *     `$or`, which no record has, so it excludes every row. Also correct, and
 *     the same answer.
 *   - `['or']` — the "obvious" empty group — is `isFilterAST` FALSE and
 *     `parseFilterAST` `undefined`: no filter at all, i.e. EVERY row. That is
 *     the widening direction, on a filter whose whole purpose is to hide rows
 *     (#5134), so it is the one shape that must not be emitted.
 *
 * A leaf naming `$or` as a field is not a shape to be proud of; it is the shape
 * that answers FALSE at both consumers, which the alternatives do not.
 */
function falseIdentityLeaf(field: string, value: unknown[]): FilterNode {
  return [field, '=', value] as FilterNode;
}

/**
 * Is `value` an OPERATOR MAP — the shape the operator loop reads — or a
 * comparand the author wrote?
 *
 * The loop's premise is that an object which is not an accepted comparand is a
 * map of `$` operators. That premise holds for exactly one population: a PLAIN
 * object, which is what an author writes and what `JSON.parse` of stored
 * metadata produces. An exotic instance — `RegExp`, `Set`, `Map`, `URL`, a class
 * instance — is not a map of operators under any reading; it is a VALUE, and
 * `Object.entries` of each of those is `[]` (measured), which is why the loop
 * used to run zero times and push NO condition for the field.
 *
 * The PROTOTYPE is the test, deliberately, and not `Object.keys(value).length
 * === 0`: zero own entries is exactly what `{}` and `/x/` have in COMMON, and
 * they need opposite answers — `{}` is the TRUE identity that constrains
 * nothing, pinned in filter-date-comparand-8555.test.ts section 4, and a keys
 * count cannot tell the two apart. Prototype can.
 *
 * The second hop admits a CROSS-REALM plain object (an iframe, a `vm` context),
 * whose prototype is that realm's `Object.prototype` rather than this one's: a
 * plain object's prototype has a null prototype, while a `RegExp`'s chain is one
 * link longer. So the test is about SHAPE, not about object identity.
 *
 * A plain object with no entries stays an operator map with no operators — the
 * `{}` identity — whatever else it happens to be. That boundary is deliberate:
 * this predicate separates values from operator maps, and it is not a second
 * opinion about the identity objectui#5322 already ruled on.
 */
function isOperatorMap(value: object): boolean {
  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === null || proto === Object.prototype || Object.getPrototypeOf(proto) === null;
}

/**
 * Name the offending comparand for the refusal message.
 *
 * `JSON.stringify` is what every other message in this file uses, and it is
 * useless here: it renders a `RegExp`, a `Set` and a `Map` all as `{}` — the
 * spec's own refusal prints `({})` for a RegExp for exactly this reason. The
 * constructor name plus `String(value)` prints `/abc/` for a pattern and falls
 * back to the type alone when the value has no useful text form.
 *
 * Every read is guarded: a refusal message must never itself throw, or the
 * loud failure this arm exists to produce becomes a different, confusing one.
 */
function describeExoticComparand(value: object): string {
  let name: unknown;
  let text: string | undefined;
  try {
    const proto = Object.getPrototypeOf(value) as { constructor?: { name?: unknown } } | null;
    name = proto?.constructor?.name;
  } catch {
    name = undefined;
  }
  if (typeof name !== 'string' || name === '') return 'an object of an unrecognised type';
  try {
    text = String(value);
  } catch {
    text = undefined;
  }
  return text && text !== `[object ${name}]` ? `a ${name} instance (${text})` : `a ${name} instance`;
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
 * @example
 * // Logical combinators (objectui#6948) — children lower recursively
 * convertFiltersToAST({ $or: [{ status: 'open' }, { status: 'blocked' }] })
 * // => ['or', ['status', '=', 'open'], ['status', '=', 'blocked']]
 *
 * @example
 * // A Date is a comparand, not an operator map (objectui#8555). It lowers as
 * // the Date INSTANCE — the spec accepts one, and the operator form already
 * // emits one.
 * convertFiltersToAST({ created: new Date('2026-01-01') })
 * // => ['created', '=', Date(2026-01-01)]
 *
 * @throws {FilterOperatorError} If an unknown operator is encountered, if
 * `$not` is used — see the `$not` arm for why the AST cannot carry it — if a
 * field's value is a bare ARRAY (`{ tags: ['a', 'b'] }`) — see the array arm for
 * why that is refused rather than read as `$in` — or if a field's value is an
 * EXOTIC object the spec does not accept as a comparand (`{ name: /abc/ }`,
 * a `Set`, a `Map`): see the exotic-comparand arm for why that is refused
 * rather than dropped (objectui#8567). An empty operator object (`{}`) is NOT
 * refused — it is the TRUE identity and constrains nothing, as it always has.
 */
export function convertFiltersToAST(filter: Record<string, any>): FilterNode | Record<string, any> {
  const conditions: FilterNode[] = [];
  
  for (const [field, value] of Object.entries(filter)) {
    if (value === null || value === undefined) continue;

    // Logical combinators are read BEFORE the field/operator machinery below,
    // because they are not fields and their value is not an operator map.
    // Without this arm `$and` / `$or` reached the simple-equality branch (their
    // value is an array, so the operator loop was skipped) and became a leaf
    // naming a field literally called `$and` / `$or`, while `$not` entered the
    // operator loop with its OWN nested object's keys read as operator names.
    const logicKeyword = AST_LOGIC_KEYWORD[field];
    if (logicKeyword) {
      const group = lowerLogicalGroup(field, logicKeyword, value);
      if (group !== undefined) conditions.push(group);
      continue;
    }

    if (field === '$not') {
      throw new FilterOperatorError(
        `[ObjectUI] The '$not' filter combinator cannot be lowered to the ObjectQL ` +
        `filter AST. '@objectstack/spec' declares it on FilterCondition, but the AST ` +
        `this layer emits has no negation keyword (FILTER_ARRAY_LOGIC_KEYWORDS is ` +
        `['and', 'or']), and rewriting the negation inward is not available either — ` +
        `'startswith', 'endswith', 'between' and 'icontains' have no negated ` +
        `counterpart in VALID_AST_OPERATORS, so the rewrite would be silently ` +
        `partial. Express the negation with a negated operator instead ($ne, $nin, ` +
        `$notContains); note those follow each operator's own answer for a missing ` +
        `value rather than $not's NULL-safe rule (objectstack#5146). ` +
        `Value: ${JSON.stringify(value)}.`
      );
    }

    // A bare ARRAY in comparand position is the third shape this file cannot
    // lower, after `$regex` and `$not` (objectui#8530). The equality `else`
    // below used to catch it and emit `[field, '=', [...]]` — an array in a
    // scalar-equality slot. The spec's own doors pass that node through
    // unjudged (`isFilterAST` is true and `parseFilterAST` hands back
    // `{ field: [...] }`; measured against @objectstack/spec 17.3.0, whose
    // `assertListComparandShapes` rules only on `$in` / `$nin` / `$between`),
    // so the refusal arrived two layers later: `@objectstack/driver-sql`
    // answers 400 INVALID_FILTER, and the in-memory matchers
    // (`@objectstack/formula`, `ValueDataSource` since objectui#8514) refuse
    // the node and exclude every row. Either way the author learned nothing at
    // lowering time. Refused HERE instead, where the field name and the
    // offending value are both still in hand.
    //
    // NOT lowered to `in`. `{ tags: ['a', 'b'] }` and `{ tags: { $in: ['a', 'b'] } }`
    // are different statements and the second is already spellable; rewriting
    // one into the other guesses at intent and silently changes which rows a
    // stored view returns — the lenient second contract objectui#8514 was
    // resolved against on this same data shape one layer down. A lowering to
    // `in` would be a deliberate, separately-argued change, not a fallback.
    //
    // `$in` / `$nin` / `$between` MEMBERS are legitimately arrays and are read
    // by the operator loop below, never here; `$and` / `$or` carry arrays of
    // conditions and were consumed by the combinator arm above.
    if (Array.isArray(value)) {
      throw new FilterOperatorError(
        `[ObjectUI] The filter on field '${field}' carries a bare ARRAY as its ` +
        `equality comparand: ${JSON.stringify(value)}. It cannot be lowered: the ` +
        `ObjectQL filter AST has no array-equality node, so the lowered node ` +
        `[${field}, '=', [...]] is refused by @objectstack/driver-sql (400 INVALID_FILTER) ` +
        `and matches no row in the in-memory matchers — it can never select anything. ` +
        `It is deliberately NOT read as membership here: { ${field}: [...] } and ` +
        `{ ${field}: { $in: [...] } } are different statements, and guessing the ` +
        `second from the first would silently change which rows a stored view ` +
        `returns (objectui#8530; the same ruling objectui#8514 applied one layer ` +
        `down). Spell membership as { ${field}: { $in: [...] } }, its negation as ` +
        `{ ${field}: { $nin: [...] } }, or a range as { ${field}: { $between: [min, max] } }.`
      );
    }

    // Check if value is a complex operator object
    if (typeof value === 'object' && !Array.isArray(value)) {
      // A `Date` is a COMPARAND, not an operator map — objectui#8555.
      //
      // `typeof new Date()` is `'object'` and a Date is not an array, so it used
      // to enter the loop below; `Object.entries(someDate)` is `[]`, the body
      // never ran, and NO condition was pushed for the field. Not refused, not
      // lowered wrongly — ABSENT, so `{ status: 'a', created: someDate }`
      // lowered to `['status', '=', 'a']` and the result set got WIDER than the
      // author asked for, silently. That is the one failure direction this file
      // exists to avoid. It also made the field's behaviour depend on its
      // SIBLINGS: a Date alone left `conditions` empty, so the original object
      // came back untouched and the defect was invisible until a second field
      // appeared.
      //
      // Lowered rather than refused, and the spec is what decides it — the
      // opposite answer to objectui#8514, which was a refusal precisely because
      // the spec DECLINED to rule on that shape. Here it rules, twice over
      // (measured against @objectstack/spec 17.3.0):
      // `ACCEPTED_FILTER_COMPARAND_TYPES` is
      // `['string','number','bigint','boolean','null','Date']`, and
      // `$gt`/`$gte`/`$lt`/`$lte`/`$between` declare `z.ZodDate` in comparand
      // position. So a Date is a first-class filter comparand, not a shape this
      // layer has to invent an answer for.
      //
      // ⛔ NOT converted to an ISO string or an epoch here. The wire form is not
      // this adapter's question to answer: `parseFilterAST(['created', '=', d])`
      // hands back `{ created: d }` with the Date INSTANCE intact (measured), and
      // `normalizeFilterComparandTypes` accepts it as-is. The operator arm below
      // already passes a Date through untouched (`{ created: { $gte: d } }` →
      // `['created', '>=', d]`), so stringifying here would make the shorthand
      // and the operator form emit two different comparand types for the same
      // author intent — a second dialect, in the file whose whole job is to have
      // one.
      //
      // The gate is the spec's own predicate rather than a local `instanceof
      // Date`, the same reason `normalizeFilterOperator` is used below instead of
      // a second operator map. Today `Date` is its only object-typed member
      // (pinned in filter-date-comparand-8555.test.ts), so this arm is a Date arm
      // in practice; if the spec ever accepts another object-shaped literal, this
      // reads it as a comparand instead of silently dropping it.
      if (isAcceptedFilterComparand(value)) {
        conditions.push([field, '=', value]);
        continue;
      }

      // An EXOTIC object in comparand position — objectui#8567, the other half
      // of the hole objectui#8555 closed.
      //
      // Same silent failure, one door further along: `Object.entries(/abc/)`,
      // `Object.entries(new Set(['x']))` and `Object.entries(new Map())` are all
      // `[]` (measured), so the loop below ran zero times and pushed NO condition
      // for the field. `{ status: 'a', created: /abc/ }` lowered to
      // `['status', '=', 'a']` — WIDER than the author asked for, with nothing
      // thrown and nothing logged. With the exotic value alone `conditions` ended
      // empty and the original object came back untouched, so the defect needed a
      // sibling field to become visible at all.
      //
      // REFUSED rather than lowered, and — unlike the arm above — the spec rules
      // it OUT rather than IN (measured against @objectstack/spec 17.3.0, floor
      // ^17.2.0): `isAcceptedFilterComparand(/x/)` is `false`, and
      // `normalizeFilterComparandTypes({ created: /x/ })` answers `INVALID_FILTER`
      // / 400 — "Filter comparand at where.created is a RegExp instance ({}),
      // which no driver can compare." Lowering it would only move that refusal
      // downstream; dropping it is the defect. So the answer the wire would give
      // two layers later is given HERE, where the field name and the offending
      // value are both still in hand.
      //
      // ⚠️ This is NOT the class the `$regex` and `$not` refusals below belong
      // to, and their message idiom is deliberately not copied. Those two answer
      // "this layer has no TARGET for your operator" — `$regex` is absent from
      // the spec's `FILTER_OPERATORS`, and `$not` is declared by the spec but has
      // no keyword in the AST dialect this file emits. This one answers a
      // question about a VALUE: the spec's own comparand-type predicate rejects
      // it. The nearest neighbour is the bare-array arm above, which is also
      // about a comparand — but that refusal rests on the spec DECLINING to rule
      // (`assertListComparandShapes` rules only on `$in` / `$nin` / `$between`),
      // which is the opposite authority to this one. What IS shared is the error
      // TYPE: `FilterOperatorError` is named for operators but already carries
      // four non-operator refusals in this file, because what it actually
      // transports is the `INVALID_FILTER` / 400 envelope `classifyLoadError`
      // reads — see its declaration.
      //
      // The accepted-type list is the spec's own sentence, not a second list
      // spelled out here, for the same reason the gate above is the spec's
      // predicate rather than a local `instanceof Date`.
      if (!isOperatorMap(value)) {
        throw new FilterOperatorError(
          `[ObjectUI] The filter on field '${field}' carries ${describeExoticComparand(value)} ` +
          `in comparand position. '@objectstack/spec' does not accept it: a comparison value must ` +
          `be ${ACCEPTED_FILTER_COMPARAND_TYPES_SENTENCE} (ACCEPTED_FILTER_COMPARAND_TYPES), so ` +
          `isAcceptedFilterComparand is false for it and normalizeFilterComparandTypes answers 400 ` +
          `INVALID_FILTER — "which no driver can compare". It is not an operator map either: only ` +
          `a plain object can be one, so until objectui#8567 this value was read as ZERO operators ` +
          `and the '${field}' condition was dropped from the filter entirely, silently WIDENING the ` +
          `result set. Spell a text match as { ${field}: { $contains: '...' } } ($startsWith / ` +
          `$endsWith; a pattern itself has no operator here, see the $regex refusal), a membership ` +
          `test as { ${field}: { $in: [...] } }, and a date bound as ` +
          `{ ${field}: { $gte: new Date(...) } }.`
        );
      }

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
 *
 * The value's SHAPE is checked too, against the operator's arity — an array on a
 * single-value operator is refused rather than passed through. See the arm
 * itself for the reasoning and for why the refusal is a throw (objectui#8557).
 *
 * @throws {FilterOperatorError} If the rule carries an ARRAY on an operator the
 * spec declares single-valued.
 */
/**
 * The view-filter operators whose `value` is legitimately an ARRAY.
 *
 * Not a local list — both halves are the spec's own, and it exports them for
 * exactly this question: `VIEW_FILTER_LIST_VALUE_OPERATORS` (`['in', 'not_in']`)
 * says which operators take a membership list, `VIEW_FILTER_PAIR_VALUE_OPERATORS`
 * (`['between']`) which take a `[min, max]` pair, and the docblock on the first
 * of them names a hard-coded `["in", "notIn"]` elsewhere in this repo as the
 * mistake it exists to prevent (`notIn` is an alias, not the canonical member).
 * Same reason the operator itself goes through `normalizeFilterOperator` rather
 * than a second map.
 */
const ARRAY_VALUED_VIEW_OPERATORS: ReadonlySet<string> = new Set<string>([
  ...VIEW_FILTER_LIST_VALUE_OPERATORS,
  ...VIEW_FILTER_PAIR_VALUE_OPERATORS,
]);

/**
 * The view-filter operators that carry NO comparand — their direction comes from
 * the operator NAME.
 *
 * The spec exports the two array-valued sets but no set for these, so this is
 * the one classification written out here. It is pinned against
 * `VIEW_FILTER_OPERATORS` (filter-view-rule-arity-8557.test.ts) so the four sets
 * partition the vocabulary exactly: an operator added to the spec lands in no
 * class, the pin reddens, and someone classifies it rather than it silently
 * inheriting a verdict.
 *
 * They are excluded from the refusal below deliberately, and on a measurement:
 * the spec DISCARDS a value on these operators — `parseFilterAST(['tags',
 * 'is_null', ['a']])` is `{ tags: { $null: true } }` — so a stray array here
 * cannot produce a node that selects the wrong rows. Refusing it would turn a
 * harmless input into a render-time throw, and the message would prescribe `in`
 * for an operator that takes no value at all.
 */
const VALUELESS_VIEW_OPERATORS: ReadonlySet<string> = new Set<string>([
  'is_empty',
  'is_not_empty',
  'is_null',
  'is_not_null',
]);

/** Every operator spelling the spec knows, canonical forms only. */
const KNOWN_VIEW_OPERATORS: ReadonlySet<string> = new Set<string>(VIEW_FILTER_OPERATORS);

function viewFilterRuleToNode(rule: ViewFilterRuleLike): FilterNode {
  const operator = normalizeFilterOperator(rule.operator as string);

  // An ARRAY on an operator that takes ONE value is refused here — objectui#8557.
  //
  // `rule.value` used to travel through unread, so a stored view rule
  // `{ field: 'tags', operator: 'equals', value: ['a'] }` became
  // `['tags', 'equals', ['a']]`. Measured against @objectstack/spec 17.3.0, the
  // spec's doors pass that node through unjudged — `isFilterAST` is `true` and
  // `parseFilterAST` hands back `{ tags: ['a'] }` — which is the SAME
  // array-in-a-scalar-slot shape the object arm above refuses (objectui#8530):
  // the ObjectQL AST has no array-equality node, `@objectstack/driver-sql`
  // answers `400 INVALID_FILTER`, and every in-memory matcher excludes every
  // row. So a hand-authored `{ tags: ['a'] }` already failed fast with a message
  // naming `$in`, while the same mistake SAVED INTO A VIEW still travelled
  // silently to a 400 the author could not attribute to their filter. This
  // closes that asymmetry.
  //
  // Keyed on the operator's ARITY, never on `Array.isArray(value)` alone:
  // `in` / `not_in` / `between` rules legitimately carry arrays through this
  // very function, and that path had no pin protecting it until this card.
  // The check runs AFTER normalization so an alias is judged by what it means —
  // `nin` is `not_in`, and is array-valued.
  //
  // An operator the spec does NOT know is left alone. `normalizeFilterOperator`
  // passes a misspelling through verbatim precisely so `isFilterAST` refuses it
  // and the server names it; refusing it HERE would report the wrong problem
  // ("use $in") for what is actually a typo.
  //
  // ## Why the refusal is a THROW, and why it belongs here
  //
  // It throws from the lowering, which for a saved view means the view fails at
  // render rather than returning a narrower answer. That is a real blast radius
  // and it was weighed:
  //
  //   - It is not a NEW blast radius. Both sinks already catch a
  //     `FilterOperatorError` from this same file — `plugin-list`'s
  //     `buildEffectiveFilter` runs inside `ListView`'s load `try` and lands in
  //     `setLoadError`, `plugin-view`'s `ObjectView` calls `mergeFilterNodes`
  //     inside its own load `try` — because the object arm has thrown for
  //     `$regex`, `$not` and bare arrays since objectui#8530. `classifyLoadError`
  //     reads this error's `INVALID_FILTER` / `400`, so what a user sees is the
  //     "filter is malformed" panel, not a crashed page and not a network error.
  //   - The alternatives are both silent. DROPPING the rule widens the result
  //     set, the one direction this file exists to avoid — and a stored view's
  //     whole purpose can be to hide rows. Rewriting `equals` into `in` changes
  //     the author's meaning, the lenient second contract objectui#8514 was
  //     resolved against on this same data shape.
  //   - The rule was authored long ago by someone who is not present, which
  //     argues for the LOUDER answer, not the quieter one: a silent 400 two
  //     layers away is attributable to nothing, whereas this names the view's
  //     field and operator at the moment the filter is built.
  if (
    Array.isArray(rule.value)
    && typeof operator === 'string'
    && KNOWN_VIEW_OPERATORS.has(operator)
    && !ARRAY_VALUED_VIEW_OPERATORS.has(operator)
    && !VALUELESS_VIEW_OPERATORS.has(operator)
  ) {
    throw new FilterOperatorError(
      `[ObjectUI] The stored view rule on field '${rule.field}' carries an ARRAY ` +
      `as the comparand of '${operator}', which takes a single value: ` +
      `${JSON.stringify(rule.value)}. It cannot be lowered: the ObjectQL filter ` +
      `AST has no array-equality node, so the lowered node ` +
      `[${rule.field}, '${operator}', [...]] is refused by @objectstack/driver-sql ` +
      `(400 INVALID_FILTER) and matches no row in the in-memory matchers — it can ` +
      `never select anything. It is deliberately NOT rewritten to 'in': that ` +
      `would change what the saved view means, and 'in' is already spellable in ` +
      `the rule itself. Spell membership as ` +
      `{ field: '${rule.field}', operator: 'in', value: [...] }, its negation as ` +
      `'not_in', or a range as { operator: 'between', value: [min, max] } — the ` +
      `three operators the spec declares array-valued, which are untouched ` +
      `(objectui#8557; the same ruling objectui#8530 applied to the object arm).`
    );
  }

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
