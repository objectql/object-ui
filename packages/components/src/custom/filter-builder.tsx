/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client"

import * as React from "react"
import { X, Plus, Trash2, Search, Loader2, ChevronDown } from "lucide-react"
import {
  VIEW_FILTER_LIST_VALUE_OPERATORS,
  VIEW_FILTER_PAIR_VALUE_OPERATORS,
  normalizeFilterOperator,
} from "@objectstack/spec/ui"
import { SchemaRendererContext } from "@object-ui/react"
import { createSafeTranslation } from "@object-ui/i18n"

import { cn } from "../lib/utils"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Input } from "../ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"

/**
 * One row of the FilterBuilder UI.
 *
 * Deliberately NOT `FilterCondition` (objectstack#4115): the spec owns that
 * name for the RECURSIVE ObjectQL predicate AST — `{ [field]: FieldOperators }`
 * with `$and` / `$or` / `$not` branches — which is a query, not a row. This is
 * one flat `{ field, operator, value }` line plus the React key the list needs,
 * and `operator` here is the builder's own dropdown vocabulary
 * (`FILTER_BUILDER_OPERATORS`), not the spec's `$`-tokens.
 *
 * `@object-ui/types` already renamed its identical concept to
 * `FilterBuilderCondition` (objectui#3068); this is the same thing, so it takes
 * the same name rather than inventing a second dialect. Note the same name is
 * NOT the right answer everywhere: `@object-ui/app-shell`'s `FilterCondition`
 * really was the spec's ObjectQL AST and was re-exported (objectui#3169).
 */
export interface FilterBuilderCondition {
  id: string
  field: string
  operator: string
  value: string | number | boolean | (string | number | boolean)[]
}

export interface FilterGroup {
  id: string
  logic: "and" | "or"
  conditions: FilterBuilderCondition[]
}

export interface FilterBuilderProps {
  fields?: Array<{ 
    value: string
    label: string
    type?: string
    options?: Array<{ value: string; label: string }> // For select fields
    /** For lookup/master_detail/user/owner fields — referenced object name */
    referenceTo?: string
    /** Display field on the referenced object (defaults to "name") */
    displayField?: string
    /** ID field on the referenced object (defaults to "id") */
    idField?: string
  }>
  value?: FilterGroup
  onChange?: (value: FilterGroup) => void
  className?: string
  showClearAll?: boolean
  /**
   * Opt-in operator ids ({@link OPT_IN_OPERATORS}) this instance may offer, on
   * top of the ones every FilterBuilder draws.
   *
   * The dropdown is shared by consumers that persist a filter into DIFFERENT
   * dialects, and an operator one dialect can carry is not automatically
   * storable in another — so whether an opt-in operator is offered is the
   * consumer's answer, not this component's. See {@link OPT_IN_OPERATORS} for
   * the measurement that made this a prop instead of one global list.
   */
  extraOperators?: readonly string[]
}

// `label` is the English fallback; the actual rendered text comes from
// `filterBuilder.operators.<value>` so operators are translated like the rest
// of the builder. Keep the two in sync when adding operators.
const defaultOperators = [
  { value: "equals", label: "Equals" },
  { value: "notEquals", label: "Does not equal" },
  { value: "contains", label: "Contains" },
  // Case-insensitive `contains` — the spec's `$icontains` (objectui#4023).
  // OPT-IN: see `OPT_IN_OPERATORS` below for why it is not offered everywhere.
  { value: "containsCaseInsensitive", label: "Contains (ignore case)" },
  { value: "notContains", label: "Does not contain" },
  { value: "isEmpty", label: "Is empty" },
  { value: "isNotEmpty", label: "Is not empty" },
  { value: "greaterThan", label: "Greater than" },
  { value: "lessThan", label: "Less than" },
  { value: "greaterOrEqual", label: "Greater than or equal" },
  { value: "lessOrEqual", label: "Less than or equal" },
  { value: "before", label: "Before" },
  { value: "after", label: "After" },
  { value: "between", label: "Between" },
  { value: "in", label: "In" },
  { value: "notIn", label: "Not in" },
  // String-specific spec operators ($startsWith / $endsWith) — they validated
  // at the data layer but were unreachable from this dropdown (#2942).
  { value: "startsWith", label: "Starts with" },
  { value: "endsWith", label: "Ends with" },
  // Null / existence spec operators ($null / $exists). Distinct from
  // isEmpty/isNotEmpty, which also treat '' as empty.
  { value: "isNull", label: "Is null" },
  { value: "isNotNull", label: "Is not null" },
  { value: "exists", label: "Is set" },
  { value: "notExists", label: "Is not set" },
] as const

/**
 * Operator ids the dropdown draws ONLY when the consumer names them in
 * `extraOperators`. Every other id in `defaultOperators` is offered to every
 * consumer.
 *
 * ## Why an operator would ever be opt-in (objectui#4023, objectui#4736)
 *
 * This one dropdown feeds three different at-rest dialects, and they do not
 * accept the same operators:
 *
 *   - **MongoDB-style `FieldOperatorsSchema` criteria** — what
 *     `FilterConditionField` writes into a sharing rule's `criteria_json`,
 *     evaluated by the server's engine. Its vocabulary is the spec's
 *     `FILTER_OPERATORS`, the widest of the three.
 *   - **`ViewFilterRule[]`** — what `viewFilterFold` persists for a saved view,
 *     and what the Studio inspector's `FilterBuilderField` writes. Its
 *     vocabulary is the spec's `VIEW_FILTER_OPERATORS`; a rule outside that
 *     enum is refused by `ViewFilterRuleSchema`.
 *   - **The array/triplet filter AST** — what `ListView` sends for the live
 *     grid, via `mapOperator`. Its vocabulary is the spec's
 *     `VALID_AST_OPERATORS`; an unmapped operator is emitted verbatim and the
 *     query comes back broken (see
 *     `packages/data-objectstack/src/filter-operator-ast-parity.test.ts` for
 *     what "broken" costs — an unfiltered read or a 400, either way not the
 *     filter the user asked for).
 *
 * So an operator only one dialect can carry is offered only by the consumer
 * that speaks that dialect. Mapping it onto a near-equivalent in the others is
 * NOT the alternative: that is a different question silently answered — the
 * same reason `view-operator-builder-parity.test.ts` refuses to map `is_null`
 * onto `isEmpty`.
 *
 * Which side of the line an id falls on is not left to this comment.
 * `plugin-list`'s `list-offered-operator-expressible-parity.test.ts` forces the
 * set the list toolbar offers to EQUAL the set its two dialects can express, in
 * both directions: an unexpressible id that stays offered fails, and an id that
 * becomes expressible while still withheld fails too.
 *
 * ### `containsCaseInsensitive` — the spec's `$icontains` (objectui#4023)
 *
 * Carried by the Mongo criteria dialect, where every driver and evaluation face
 * the platform ships executes it (objectstack#5702 + objectstack#6520). The
 * other two vocabularies have no case-insensitive contains at all, so offering
 * it everywhere is the exact hazard objectui#4023 was held blocked over,
 * relocated from the drivers to this repo's own bridges.
 *
 * ### `exists` / `notExists` — the spec's `$exists` (objectui#4736)
 *
 * Added by objectui#2942 to make `$exists` reachable from
 * `FilterConditionField`, but offered to every consumer, including the two that
 * cannot store them. Measured on `@objectstack/spec` 17.0.0-rc.6: neither
 * `VIEW_FILTER_OPERATORS` nor `VALID_AST_OPERATORS` contains an existence
 * operator — not under this spelling, not under any other; both sets have ZERO
 * members matching `/exist/`. So there was nothing to map onto and the id went
 * out verbatim.
 *
 * Collapsing them onto `isNotNull` / `isNull` would be a semantic claim, not a
 * bridge, and it is refused on three counts:
 *
 *   1. The builder already offers `isNull` / `isNotNull` as their own rows, so
 *      the collapse would draw two labels for one wire predicate.
 *   2. The round trip is lossy: a saved `exists` reads back through
 *      `specToBuilderOperator('is_not_null')` as `isNotNull`, silently
 *      rewriting the author's choice on reopen.
 *   3. The equivalence is not this repo's to declare. `@objectstack/spec`'s own
 *      `data/index.d.ts` records `$exists` = has-value (`!= null`) as settled
 *      and shipped on `formula` and `driver-memory`'s reference matcher, while
 *      `driver-memory`'s live mingo path and `driver-mongodb` still read
 *      KEY-PRESENCE, both frozen by objectstack#5499 — which is why upstream
 *      cannot enrol a `$exists` conformance row yet either.
 *
 * The lasting fix for both families is upstream — the view and AST vocabularies
 * gaining the operator — at which point the entry below is deleted, the parity
 * test flips it back on by itself, and the operator becomes ordinary.
 */
const OPT_IN_OPERATORS = new Set<string>([
  "containsCaseInsensitive",
  "exists",
  "notExists",
])

/**
 * The FilterBuilder's own operator vocabulary — every id its dropdown can
 * hold, derived from the operators it actually renders. Includes the opt-in
 * ids: they are drawable, just not offered unconditionally.
 *
 * Exported because several translation tables map an external vocabulary
 * (the spec's `VIEW_FILTER_OPERATORS`, Mongo `$`-tokens) *onto* this one, and
 * a value that is not in this list produces a condition row whose operator
 * select has nothing to select. Those tables assert against this export
 * rather than restating it, so adding an operator here is the only edit
 * needed to widen them.
 */
export const FILTER_BUILDER_OPERATORS = defaultOperators.map(o => o.value)

/** An operator id the FilterBuilder can render. */
export type FilterBuilderOperator = (typeof defaultOperators)[number]['value']

/**
 * Operator ids for which this builder renders NO value input — so "no value"
 * is the row's FINISHED state, not an unfinished one (objectui#4744).
 *
 * This is the source of truth for that distinction, and it lives here because
 * this component is the thing that decides it: `needsValueInput` below is
 * defined as the complement of this set, so the two cannot say different
 * things. Every consumer that has to tell a complete value-less row from a
 * half-filled one reads it FROM here rather than restating it:
 *
 *   - `plugin-list`'s `convertFilterGroupToAST` — what the live grid QUERIES;
 *   - `app-shell`'s `foldFilterGroupToSpecRules` — what a saved view PERSISTS
 *     (its `VALUELESS_FILTER_OPERATORS` is this set plus the canonical spec
 *     spellings, which only that layer sees).
 *
 * Placement is forced by the dependency graph — `app-shell` depends on
 * `plugin-list` depends on this package, so this is the only module all three
 * can reach — and it is also where the set belongs on the merits: the fact it
 * states is a fact about what this dropdown draws.
 *
 * Why it exists at all: each consumer used to keep its own copy, and the
 * live-grid copy listed only `isEmpty`/`isNotEmpty`. A fresh row is seeded
 * `{ operator: 'equals', value: '' }` and the operator dropdown preserves
 * `value`, so picking **Is null** as the first action left `value: ''` — the
 * grid read that as an unfinished row, dropped it, and applied NO filter at
 * all while the panel showed one. Silent, and every record came back.
 *
 * `exists` / `notExists` stay listed even though `OPT_IN_OPERATORS` withholds
 * them from most consumers (objectui#4736): the builder still draws them
 * value-less for `FilterConditionField`, which is exactly what this set
 * describes. Whether a consumer can EXPRESS an operator is a separate
 * question, answered by `OPT_IN_OPERATORS` and by each consumer's parity test.
 */
export const VALUELESS_FILTER_BUILDER_OPERATORS: ReadonlySet<string> = new Set([
  "isEmpty",
  "isNotEmpty",
  "isNull",
  "isNotNull",
  "exists",
  "notExists",
])

/**
 * The SHAPE an operator's `value` must have — the question
 * `ViewFilterRuleSchema` asks, asked here in the one place that decides what
 * input the user is given (objectui#3958).
 *
 *   - `list` — membership over any arity, `[]` included (`in` / `not_in`).
 *   - `pair` — exactly two bounds, in order (`between`).
 *   - `scalar` — everything else, including the value-less operators above
 *     (they draw no input at all, so their shape never reaches storage).
 */
export type FilterValueArity = "scalar" | "list" | "pair"

/**
 * The two families are IMPORTED from `@objectstack/spec`, never restated
 * (objectstack#6227 exports them for exactly this).
 *
 * This component used to decide the same fact from a local
 * `["in", "notIn"]` literal, and that literal was already one spelling adrift:
 * `notIn` is an ALIAS, the canonical member is `not_in`. Any path that hands
 * this builder a canonical operator — a stored view read back through a reader
 * that does not camelCase it — matched neither entry, so a SET operator got
 * the single-value input and the user typed a scalar into it.
 * `ViewFilterRuleSchema` then refused the row at save time, on a shape this
 * builder's own UI led them into building.
 */
const LIST_VALUE_OPERATORS: ReadonlySet<string> = new Set(VIEW_FILTER_LIST_VALUE_OPERATORS)
const PAIR_VALUE_OPERATORS: ReadonlySet<string> = new Set(VIEW_FILTER_PAIR_VALUE_OPERATORS)

/**
 * Which value shape `operator` takes, in EITHER dialect.
 *
 * The argument is folded through the spec's own `normalizeFilterOperator`
 * first, so the builder's camelCase dropdown ids (`notIn`) and the canonical
 * spellings a stored rule carries (`not_in`) land on the same answer. That
 * fold is the whole point: one vocabulary, declared upstream, consulted here —
 * not a second local dialect that has to be kept in sync by hand.
 *
 * @internal exported for tests
 */
export function filterValueArity(operator: string): FilterValueArity {
  const canonical = normalizeFilterOperator(operator)
  if (LIST_VALUE_OPERATORS.has(canonical)) return "list"
  if (PAIR_VALUE_OPERATORS.has(canonical)) return "pair"
  return "scalar"
}

/**
 * Re-shape a row's `value` for the operator it is being changed TO.
 *
 * Switching the operator dropdown used to update `operator` alone, so the
 * value the previous family had produced simply survived the switch — a scalar
 * `"acme"` (or the seed `""`) still sitting there under `in`, which is
 * precisely the shape `ViewFilterRuleSchema` refuses. Re-shaping rather than
 * blanking keeps what the user typed wherever it still means something:
 *
 *   - to `list`: a scalar becomes a one-element list (`"acme"` → `["acme"]`),
 *     an empty scalar becomes `[]` — a real, spec-valid predicate;
 *   - to `pair`: the first two entries become `[min, max]`, padded with `""`;
 *     with nothing to carry it collapses to `[]`, which the write path reads
 *     as "row not filled in yet" and drops, exactly as it drops an empty
 *     scalar today;
 *   - to `scalar`: the first entry of a list survives; the rest cannot, and
 *     dropping them is the honest answer — `equals` compares against one value.
 *
 * @internal exported for tests
 */
export function reshapeFilterValue(
  value: FilterBuilderCondition["value"],
  nextOperator: string,
): FilterBuilderCondition["value"] {
  switch (filterValueArity(nextOperator)) {
    case "list":
      return Array.isArray(value) ? value : normalizeToArray(value)
    case "pair": {
      const [min = "", max = ""] = normalizeToArray(value)
      return min === "" && max === "" ? [] : [min, max]
    }
    default:
      return Array.isArray(value) ? (value[0] ?? "") : value
  }
}

/** The two bounds a `pair` row edits, with the gaps filled in for rendering. */
function toPairBounds(
  value: FilterBuilderCondition["value"],
): [string | number | boolean, string | number | boolean] {
  const [min = "", max = ""] = normalizeToArray(value)
  return [min, max]
}

const useSafeFilterTranslation = createSafeTranslation(
  {
    'filterBuilder.where': 'Where',
    'filterBuilder.and': 'AND',
    'filterBuilder.or': 'OR',
    'filterBuilder.clearAll': 'Clear all',
    'filterBuilder.selectField': 'Select field',
    'filterBuilder.operator': 'Operator',
    'filterBuilder.selectValue': 'Select value',
    'filterBuilder.value': 'Value',
    'filterBuilder.addFilter': 'Add filter',
    'filterBuilder.removeCondition': 'Remove condition',
    'filterBuilder.trueLabel': 'True',
    'filterBuilder.falseLabel': 'False',
    'filterBuilder.noResults': 'No results',
    'filterBuilder.searchField': 'Search {{label}}…',
    'filterBuilder.enterId': 'Enter {{label}} id',
    'filterBuilder.addValue': 'Type a value, press Enter',
    'filterBuilder.removeValue': 'Remove {{value}}',
    'filterBuilder.rangeStart': 'From',
    'filterBuilder.rangeEnd': 'To',
    'filterBuilder.operators.equals': 'Equals',
    'filterBuilder.operators.notEquals': 'Does not equal',
    'filterBuilder.operators.contains': 'Contains',
    'filterBuilder.operators.containsCaseInsensitive': 'Contains (ignore case)',
    'filterBuilder.operators.notContains': 'Does not contain',
    'filterBuilder.operators.isEmpty': 'Is empty',
    'filterBuilder.operators.isNotEmpty': 'Is not empty',
    'filterBuilder.operators.greaterThan': 'Greater than',
    'filterBuilder.operators.lessThan': 'Less than',
    'filterBuilder.operators.greaterOrEqual': 'Greater than or equal',
    'filterBuilder.operators.lessOrEqual': 'Less than or equal',
    'filterBuilder.operators.before': 'Before',
    'filterBuilder.operators.after': 'After',
    'filterBuilder.operators.between': 'Between',
    'filterBuilder.operators.in': 'In',
    'filterBuilder.operators.notIn': 'Not in',
    'filterBuilder.operators.startsWith': 'Starts with',
    'filterBuilder.operators.endsWith': 'Ends with',
    'filterBuilder.operators.isNull': 'Is null',
    'filterBuilder.operators.isNotNull': 'Is not null',
    'filterBuilder.operators.exists': 'Is set',
    'filterBuilder.operators.notExists': 'Is not set',
  },
  'filterBuilder.where',
)

const NULLNESS_OPERATORS = ["isNull", "isNotNull", "exists", "notExists"]
const textOperators = ["equals", "notEquals", "contains", "containsCaseInsensitive", "notContains", "startsWith", "endsWith", "isEmpty", "isNotEmpty", ...NULLNESS_OPERATORS]
const numberOperators = ["equals", "notEquals", "greaterThan", "lessThan", "greaterOrEqual", "lessOrEqual", "isEmpty", "isNotEmpty", ...NULLNESS_OPERATORS]
const booleanOperators = ["equals", "notEquals"]
const dateOperators = ["equals", "notEquals", "before", "after", "between", "isEmpty", "isNotEmpty", ...NULLNESS_OPERATORS]
const selectOperators = ["equals", "notEquals", "in", "notIn", "isEmpty", "isNotEmpty", ...NULLNESS_OPERATORS]
const lookupOperators = ["equals", "notEquals", "in", "notIn", "isEmpty", "isNotEmpty", ...NULLNESS_OPERATORS]

/** Field types that share the same operator/input behavior as number (numeric comparison operators, number input) */
const numberLikeTypes = ["number", "currency", "percent", "rating"]
/** Field types that share the same operator/input behavior as date (before/after operators, date/datetime/time input) */
const dateLikeTypes = ["date", "datetime", "time"]
/** Field types that use select operators (equals/in/notIn) and render dropdown or checkbox list when options provided */
const selectLikeTypes = ["select", "status"]
/** Relational/reference field types that use lookup operators (equals/in/notIn) and render dropdown or checkbox list when options provided */
const lookupLikeTypes = ["lookup", "master_detail", "user", "owner"]

/**
 * The operators the dropdown offers for a field of `fieldType`, given the
 * opt-in ids this instance was granted.
 *
 * A pure function rather than a closure so the selection rule — and above all
 * the {@link OPT_IN_OPERATORS} gate, whose whole job is to keep an operator OFF
 * the surfaces that cannot store it — is assertable without driving a Radix
 * popover open in jsdom.
 *
 * @internal exported for tests
 */
export function operatorsForFieldType(
  fieldType: string | undefined,
  extraOperators: readonly string[] = [],
): ReadonlyArray<{ value: string; label: string }> {
  const type = fieldType || "text"
  const bucket = numberLikeTypes.includes(type)
    ? numberOperators
    : type === "boolean"
      ? booleanOperators
      : dateLikeTypes.includes(type)
        ? dateOperators
        : selectLikeTypes.includes(type)
          ? selectOperators
          : lookupLikeTypes.includes(type)
            ? lookupOperators
            : textOperators

  const granted = new Set(extraOperators)
  return defaultOperators.filter(
    (op) => bucket.includes(op.value) && (!OPT_IN_OPERATORS.has(op.value) || granted.has(op.value)),
  )
}

/** Normalize a filter value into an array for multi-select scenarios */
function normalizeToArray(value: FilterBuilderCondition["value"]): (string | number | boolean)[] {
  if (Array.isArray(value)) return value
  if (value !== undefined && value !== null && value !== "") return [value as string | number | boolean]
  return []
}

/**
 * Defensive guard — only accept an external `value` that matches the
 * `FilterGroup` shape. Reports/Views may persist filters in protocol-native
 * shapes (e.g. MongoDB-style `{field: value}` from `@objectstack/spec`)
 * which would otherwise crash the renderer once it reaches
 * `filterGroup.conditions.length`.
 */
function isValidGroup(v: unknown): v is FilterGroup {
  return (
    !!v &&
    typeof v === "object" &&
    Array.isArray((v as FilterGroup).conditions) &&
    ((v as FilterGroup).logic === "and" || (v as FilterGroup).logic === "or")
  )
}

const EMPTY_GROUP: FilterGroup = { id: "root", logic: "and", conditions: [] }

function FilterBuilder({
  fields = [],
  value,
  onChange,
  className,
  showClearAll = true,
  extraOperators,
}: FilterBuilderProps) {
  const { t } = useSafeFilterTranslation()
  const [filterGroup, setFilterGroup] = React.useState<FilterGroup>(
    isValidGroup(value) ? value : EMPTY_GROUP,
  )

  React.useEffect(() => {
    if (!isValidGroup(value)) return
    if (JSON.stringify(value) !== JSON.stringify(filterGroup)) {
      setFilterGroup(value)
    }
  }, [value])

  const handleChange = (newGroup: FilterGroup) => {
    setFilterGroup(newGroup)
    onChange?.(newGroup)
  }

  const addCondition = () => {
    const newCondition: FilterBuilderCondition = {
      id: crypto.randomUUID(),
      field: fields[0]?.value || "",
      operator: "equals",
      value: "",
    }
    handleChange({
      ...filterGroup,
      conditions: [...filterGroup.conditions, newCondition],
    })
  }

  const removeCondition = (conditionId: string) => {
    handleChange({
      ...filterGroup,
      conditions: filterGroup.conditions.filter((c) => c.id !== conditionId),
    })
  }

  const clearAllConditions = () => {
    handleChange({
      ...filterGroup,
      conditions: [],
    })
  }

  const updateCondition = (conditionId: string, updates: Partial<FilterBuilderCondition>) => {
    handleChange({
      ...filterGroup,
      conditions: filterGroup.conditions.map((c) =>
        c.id === conditionId ? { ...c, ...updates } : c
      ),
    })
  }

  /**
   * Change a row's operator AND bring its value into the shape the new
   * operator's family takes (objectui#3958).
   *
   * Deliberately not `updateCondition(id, { operator })`: that update carried
   * the previous family's value through untouched, which is how a scalar ended
   * up under `in`. The two edits are one edit — a row's operator and the shape
   * of its value are not independently settable — so they are made together
   * here rather than left for each caller to remember.
   */
  const changeOperator = (conditionId: string, nextOperator: string) => {
    handleChange({
      ...filterGroup,
      conditions: filterGroup.conditions.map((c) =>
        c.id === conditionId
          ? { ...c, operator: nextOperator, value: reshapeFilterValue(c.value, nextOperator) }
          : c,
      ),
    })
  }

  const toggleLogic = () => {
    handleChange({
      ...filterGroup,
      logic: filterGroup.logic === "and" ? "or" : "and",
    })
  }

  const getOperatorsForField = (fieldValue: string) => {
    const field = fields.find((f) => f.value === fieldValue)
    return operatorsForFieldType(field?.type, extraOperators)
  }

  // The complement of the exported set, never a second literal beside it:
  // that set's whole job is to let other layers know which rows this builder
  // leaves value-less, and a hand-kept copy here is how they drifted apart.
  const needsValueInput = (operator: string) => {
    return !VALUELESS_FILTER_BUILDER_OPERATORS.has(operator)
  }

  const getInputType = (fieldValue: string) => {
    const field = fields.find((f) => f.value === fieldValue)
    const fieldType = field?.type || "text"
    
    if (numberLikeTypes.includes(fieldType)) return "number"
    if (fieldType === "date") return "date"
    if (fieldType === "datetime") return "datetime-local"
    if (fieldType === "time") return "time"
    return "text"
  }

  const renderValueInput = (condition: FilterBuilderCondition) => {
    const field = fields.find((f) => f.value === condition.field)
    // The spec's vocabulary, not a local literal — and folded through
    // `normalizeFilterOperator`, so a stored `not_in` read back in canonical
    // form gets the multi-value input its alias `notIn` already got.
    const arity = filterValueArity(condition.operator)
    const isMultiOperator = arity === "list"
    const isLookupLike = lookupLikeTypes.includes(field?.type || "")

    // Lookup-like fields without static options → use remote search picker
    if (isLookupLike && !field?.options && (field?.referenceTo || field?.type === "user" || field?.type === "owner")) {
      return (
        <LookupValuePicker
          field={field!}
          value={condition.value}
          multiple={isMultiOperator}
          onChange={(value) => updateCondition(condition.id, { value })}
        />
      )
    }

    // For select/lookup fields with options and multi-select operator (in/notIn)
    if (field?.options && isMultiOperator) {
      const selectedValues = normalizeToArray(condition.value)
      return (
        <div className="max-h-40 overflow-y-auto space-y-0.5 border rounded-md p-2">
          {field.options.map((opt) => {
            const isChecked = selectedValues.map(String).includes(String(opt.value))
            return (
              <label
                key={opt.value}
                className={cn(
                  "flex items-center gap-2 text-sm py-1 px-1.5 rounded cursor-pointer",
                  isChecked ? "bg-primary/5 text-primary" : "hover:bg-muted",
                )}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...selectedValues, opt.value]
                      : selectedValues.filter((v) => String(v) !== String(opt.value))
                    updateCondition(condition.id, { value: next })
                  }}
                />
                <span className="truncate">{opt.label}</span>
              </label>
            )
          })}
        </div>
      )
    }

    // A LIST operator on a field with no static options and no remote picker —
    // a plain text or number column (objectui#3958). This used to fall all the
    // way through to the single-value input below, so `in` on such a field
    // could only ever produce a scalar: refused by `ViewFilterRuleSchema` at
    // save time, and read as an unfiltered query by the live grid before that.
    // A token input is the input that matches the shape, so the row the user
    // builds is a row the spec accepts.
    if (isMultiOperator) {
      return (
        <MultiValueInput
          values={normalizeToArray(condition.value)}
          inputType={getInputType(condition.field)}
          numeric={numberLikeTypes.includes(field?.type || "")}
          testId={`filter-multi-value-${condition.field}`}
          onChange={(next) => updateCondition(condition.id, { value: next })}
        />
      )
    }

    // A PAIR operator (`between`) — two bounds, in order. One input could only
    // ever produce one of them, and the spec refuses an incomplete range as
    // firmly as it refuses a scalar for `in`.
    if (arity === "pair") {
      const bounds = toPairBounds(condition.value)
      const inputType = getInputType(condition.field)
      const numeric = numberLikeTypes.includes(field?.type || "")
      const setBound = (index: 0 | 1, raw: string) => {
        const next: [string | number | boolean, string | number | boolean] = [bounds[0], bounds[1]]
        next[index] = numeric && raw !== "" ? parseFloat(raw) || 0 : raw
        // Both bounds cleared → back to the "nothing filled in yet" shape the
        // write path drops, rather than persisting an empty range.
        updateCondition(condition.id, {
          value: next[0] === "" && next[1] === "" ? [] : next,
        })
      }
      return (
        <div className="flex items-center gap-1.5" data-testid={`filter-range-${condition.field}`}>
          <Input
            type={inputType}
            className="h-9 text-sm"
            placeholder={t('filterBuilder.rangeStart')}
            aria-label={t('filterBuilder.rangeStart')}
            value={bounds[0] === "" ? "" : String(bounds[0])}
            onChange={(e) => setBound(0, e.target.value)}
          />
          <span className="text-xs text-muted-foreground shrink-0">-</span>
          <Input
            type={inputType}
            className="h-9 text-sm"
            placeholder={t('filterBuilder.rangeEnd')}
            aria-label={t('filterBuilder.rangeEnd')}
            value={bounds[1] === "" ? "" : String(bounds[1])}
            onChange={(e) => setBound(1, e.target.value)}
          />
        </div>
      )
    }

    // For select/lookup fields with options (single select)
    if (field?.options && (selectLikeTypes.includes(field.type || "") || lookupLikeTypes.includes(field.type || ""))) {
      return (
        <Select
          value={String(condition.value || "")}
          onValueChange={(value) =>
            updateCondition(condition.id, { value })
          }
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder={t('filterBuilder.selectValue')} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    // For boolean fields
    if (field?.type === "boolean") {
      return (
        <Select
          value={String(condition.value || "")}
          onValueChange={(value) =>
            updateCondition(condition.id, { value: value === "true" })
          }
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder={t('filterBuilder.selectValue')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">{t('filterBuilder.trueLabel')}</SelectItem>
            <SelectItem value="false">{t('filterBuilder.falseLabel')}</SelectItem>
          </SelectContent>
        </Select>
      )
    }

    // Default input for text, number, date
    const inputType = getInputType(condition.field)
    
    // Format value based on field type
    const formatValue = () => {
      if (!condition.value) return ""
      if (inputType === "date" && typeof condition.value === "string") {
        // Ensure date is in YYYY-MM-DD format
        return condition.value.split('T')[0]
      }
      return String(condition.value)
    }
    
    // Handle value change with proper type conversion
    const handleValueChange = (newValue: string) => {
      let convertedValue: string | number | boolean = newValue
      
      if (numberLikeTypes.includes(field?.type || "") && newValue !== "") {
        convertedValue = parseFloat(newValue) || 0
      } else if (dateLikeTypes.includes(field?.type || "")) {
        convertedValue = newValue // Keep as ISO string
      }
      
      updateCondition(condition.id, { value: convertedValue })
    }
    
    return (
      <Input
        type={inputType}
        className="h-9 text-sm"
        placeholder={t('filterBuilder.value')}
        value={formatValue()}
        onChange={(e) => handleValueChange(e.target.value)}
      />
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t('filterBuilder.where')}</span>
          {filterGroup.conditions.length > 1 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleLogic}
              className="h-7 text-xs"
            >
              {filterGroup.logic === "or" ? t('filterBuilder.or') : t('filterBuilder.and')}
            </Button>
          )}
        </div>
        {showClearAll && filterGroup.conditions.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAllConditions}
            className="h-7 text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            {t('filterBuilder.clearAll')}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {filterGroup.conditions.map((condition) => (
          <div key={condition.id} className="flex items-start gap-2">
            <div className="flex-1 grid grid-cols-12 gap-2">
              <div className="col-span-4">
                <Select
                  value={condition.field}
                  onValueChange={(value) =>
                    updateCondition(condition.id, { field: value })
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder={t('filterBuilder.selectField')} />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-4">
                <Select
                  value={condition.operator}
                  onValueChange={(value) => changeOperator(condition.id, value)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder={t('filterBuilder.operator')} />
                  </SelectTrigger>
                  <SelectContent>
                    {getOperatorsForField(condition.field).map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {t(`filterBuilder.operators.${op.value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {needsValueInput(condition.operator) && (
                <div className="col-span-4">
                  {renderValueInput(condition)}
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => removeCondition(condition.id)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">{t('filterBuilder.removeCondition')}</span>
            </Button>
          </div>
        ))}
      </div>

      {/* Every control here is `type="button"` on purpose: a bare <button> inside
          a <form> defaults to type="submit", and FilterBuilder is embedded in one
          (the sharing-rule dialog's criteria field). Adding a condition used to
          submit the dialog — firing validation, and saving outright once the form
          was valid (objectstack#3821). */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addCondition}
        className="h-8"
        disabled={fields.length === 0}
      >
        <Plus className="h-3 w-3" />
        {t('filterBuilder.addFilter')}
      </Button>
    </div>
  )
}

FilterBuilder.displayName = "FilterBuilder"

// ============================================================================
// MultiValueInput — token input for the LIST operators on an optionless field
// ============================================================================

interface MultiValueInputProps {
  values: (string | number | boolean)[]
  /** The `<input type>` the field's own type asks for (`text` / `number` / …). */
  inputType: string
  /** Numeric field → committed tokens are numbers, so the wire carries numbers. */
  numeric: boolean
  testId: string
  onChange: (next: (string | number | boolean)[]) => void
}

/**
 * A list of committed tokens plus a draft input — the same interaction
 * `@object-ui/fields`' `TagsField` uses (type, Enter or comma commits, `×` or
 * Backspace removes), rebuilt here because `fields` depends on this package and
 * not the other way round.
 *
 * It exists so that `in` / `not_in` have a value input AT ALL on a field with
 * no static options. Its only contract with the outside is the shape it emits:
 * always an array, `[]` when empty — never the scalar
 * {@link https://github.com/objectstack-ai/objectstack/issues/6227 |
 * ViewFilterRuleSchema} refuses for a membership operator.
 */
function MultiValueInput({ values, inputType, numeric, testId, onChange }: MultiValueInputProps) {
  const { t } = useSafeFilterTranslation()
  const [draft, setDraft] = React.useState("")

  const commit = (raw: string) => {
    const trimmed = raw.trim()
    if (trimmed === "") return
    const next = numeric ? (parseFloat(trimmed) || 0) : trimmed
    setDraft("")
    if (values.some((v) => String(v) === String(next))) return
    onChange([...values, next])
  }

  const removeAt = (index: number) => {
    onChange(values.filter((_, i) => i !== index))
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      // Enter inside a <form> would submit it (objectstack#3821, the same
      // hazard every control here is `type="button"` for).
      e.preventDefault()
      commit(draft)
    } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
      removeAt(values.length - 1)
    }
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background p-1.5"
      data-testid={testId}
    >
      {values.map((v, index) => (
        <Badge key={`${String(v)}-${index}`} variant="secondary" className="gap-1">
          <span className="truncate max-w-[12ch]">{String(v)}</span>
          <button
            type="button"
            onClick={() => removeAt(index)}
            className="ml-0.5 rounded-full text-muted-foreground hover:text-foreground"
            aria-label={t('filterBuilder.removeValue', { value: String(v) })}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Input
        type={inputType}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
        placeholder={values.length === 0 ? t('filterBuilder.addValue') : ""}
        aria-label={t('filterBuilder.addValue')}
        // `min-w-[6ch]`, not the `8ch` its `TagsField` twin uses: that utility
        // is produced ONLY by `@object-ui/fields`, and its CSS build subtracts
        // the components sheet from its own — emitting it here would delete it
        // from the fields bundle, which `build-css.mjs` refuses as
        // over-subtraction (objectui#4059).
        className="h-7 flex-1 border-0 bg-transparent p-0 px-1 shadow-none focus-visible:ring-0 min-w-[6ch] text-sm"
      />
    </div>
  )
}

MultiValueInput.displayName = "MultiValueInput"

// ============================================================================
// LookupValuePicker — remote-search picker for lookup/master_detail/user/owner
// ============================================================================

interface LookupOption {
  value: string | number
  label: string
}

interface LookupValuePickerProps {
  field: {
    value: string
    label: string
    type?: string
    referenceTo?: string
    displayField?: string
    idField?: string
  }
  value: FilterBuilderCondition["value"]
  multiple: boolean
  onChange: (value: FilterBuilderCondition["value"]) => void
}

function LookupValuePicker({ field, value, multiple, onChange }: LookupValuePickerProps) {
  const { t } = useSafeFilterTranslation()
  const ctx = React.useContext(SchemaRendererContext)
  const dataSource: any = ctx?.dataSource ?? null

  // Default `referenceTo` for user/owner field types when not explicitly set
  const referenceTo =
    field.referenceTo ||
    (field.type === "user" || field.type === "owner" ? "users" : undefined)
  const displayField = field.displayField || "name"
  const idField = field.idField || "id"

  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [options, setOptions] = React.useState<LookupOption[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  // Resolved labels for currently selected ids (so we can render chips even
  // when the selection isn't part of the latest fetched page).
  const [resolved, setResolved] = React.useState<Record<string, string>>({})
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedIds: string[] = React.useMemo(() => {
    if (multiple) {
      return normalizeToArray(value).map((v) => String(v))
    }
    if (value === undefined || value === null || value === "") return []
    return [String(value)]
  }, [value, multiple])

  const hasDataSource =
    dataSource != null && typeof dataSource.find === "function" && !!referenceTo

  const recordToOption = React.useCallback(
    (r: any): LookupOption => {
      const id = r?.[idField] ?? r?.id ?? r?._id
      const label = r?.[displayField] ?? r?.label ?? r?.name ?? String(id)
      return { value: id, label: String(label) }
    },
    [displayField, idField],
  )

  const fetchData = React.useCallback(
    async (search?: string) => {
      if (!hasDataSource) return
      setLoading(true)
      setError(null)
      try {
        const params: any = { $top: 50 }
        if (search && search.trim()) params.$search = search.trim()
        const result = await dataSource.find(referenceTo, params)
        const records: any[] = result?.data ?? result ?? []
        const mapped = records.map(recordToOption)
        setOptions(mapped)
        // Cache resolved labels for any matching selected ids
        if (mapped.length > 0) {
          setResolved((prev) => {
            const next = { ...prev }
            for (const opt of mapped) next[String(opt.value)] = opt.label
            return next
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        setOptions([])
      } finally {
        setLoading(false)
      }
    },
    [dataSource, referenceTo, hasDataSource, recordToOption],
  )

  // Resolve labels for already-selected ids that we haven't seen yet
  React.useEffect(() => {
    if (!hasDataSource || selectedIds.length === 0) return
    const missing = selectedIds.filter((id) => !(id in resolved))
    if (missing.length === 0) return
    let cancelled = false
    ;(async () => {
      try {
        const result = await dataSource.find(referenceTo, {
          $top: missing.length,
          $filter: { [idField]: { $in: missing } },
        })
        const records: any[] = result?.data ?? result ?? []
        if (cancelled) return
        setResolved((prev) => {
          const next = { ...prev }
          for (const r of records) {
            const opt = recordToOption(r)
            next[String(opt.value)] = opt.label
          }
          return next
        })
      } catch {
        // Best-effort label resolution; ignore failures
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedIds, hasDataSource, dataSource, referenceTo, idField, recordToOption, resolved])

  // Fetch initial data when popover opens
  React.useEffect(() => {
    if (open && hasDataSource && options.length === 0) {
      fetchData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleSearch = (q: string) => {
    setSearchQuery(q)
    if (!hasDataSource) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchData(q || undefined), 300)
  }

  const toggleId = (id: string | number) => {
    if (multiple) {
      const arr = normalizeToArray(value)
      const exists = arr.map(String).includes(String(id))
      const next = exists
        ? arr.filter((v) => String(v) !== String(id))
        : [...arr, id]
      onChange(next)
    } else {
      onChange(id)
      setOpen(false)
    }
  }

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(multiple ? [] : "")
  }

  const renderTrigger = () => {
    if (selectedIds.length === 0) {
      return (
        <span className="text-muted-foreground truncate">
          {t('filterBuilder.searchField', { label: field.label })}
        </span>
      )
    }
    if (multiple) {
      return (
        <span className="truncate">
          {selectedIds.length === 1
            ? resolved[selectedIds[0]] || selectedIds[0]
            : `${selectedIds.length} selected`}
        </span>
      )
    }
    return (
      <span className="truncate">
        {resolved[selectedIds[0]] || selectedIds[0]}
      </span>
    )
  }

  if (!hasDataSource) {
    // Fallback when no DataSource is available: ids are typed in by hand.
    // A MULTIPLE picker still has to emit a LIST here (objectui#3958) — this
    // branch used to hand back `e.target.value`, a scalar, which is the shape
    // `ViewFilterRuleSchema` refuses for `in` / `not_in`. The single case keeps
    // the plain input it always had.
    if (multiple) {
      return (
        <MultiValueInput
          values={normalizeToArray(value)}
          inputType="text"
          numeric={false}
          testId={`lookup-ids-${field.value}`}
          onChange={onChange}
        />
      )
    }
    return (
      <Input
        className="h-9 text-sm"
        placeholder={t('filterBuilder.enterId', { label: field.label })}
        value={selectedIds[0] ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm",
            "hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
          )}
          data-testid={`lookup-picker-${field.value}`}
        >
          {renderTrigger()}
          <span className="flex items-center gap-1 shrink-0">
            {selectedIds.length > 0 && (
              <X
                className="h-3.5 w-3.5 opacity-60 hover:opacity-100"
                onClick={clearAll}
              />
            )}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t('filterBuilder.searchField', { label: field.label })}
            className="flex h-9 w-full bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground"
            data-testid={`lookup-search-${field.value}`}
          />
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        <div className="max-h-64 overflow-y-auto p-1" data-testid={`lookup-options-${field.value}`}>
          {error && (
            <div className="px-3 py-2 text-xs text-destructive">{error}</div>
          )}
          {!error && !loading && options.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              {t('filterBuilder.noResults')}
            </div>
          )}
          {options.map((opt) => {
            const isSelected = selectedIds.includes(String(opt.value))
            return (
              <label
                key={String(opt.value)}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer",
                  isSelected ? "bg-primary/5 text-primary" : "hover:bg-muted",
                )}
              >
                {multiple ? (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleId(opt.value)}
                  />
                ) : (
                  <input
                    type="radio"
                    checked={isSelected}
                    onChange={() => toggleId(opt.value)}
                    className="rounded-full border-input"
                  />
                )}
                <span className="truncate flex-1">{opt.label}</span>
              </label>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { FilterBuilder, LookupValuePicker }
