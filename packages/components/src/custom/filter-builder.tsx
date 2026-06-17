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
import { SchemaRendererContext } from "@object-ui/react"
import { createSafeTranslation } from "@object-ui/i18n"

import { cn } from "../lib/utils"
import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Input } from "../ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"

export interface FilterCondition {
  id: string
  field: string
  operator: string
  value: string | number | boolean | (string | number | boolean)[]
}

export interface FilterGroup {
  id: string
  logic: "and" | "or"
  conditions: FilterCondition[]
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
}

// `label` is the English fallback; the actual rendered text comes from
// `filterBuilder.operators.<value>` so operators are translated like the rest
// of the builder. Keep the two in sync when adding operators.
const defaultOperators = [
  { value: "equals", label: "Equals" },
  { value: "notEquals", label: "Does not equal" },
  { value: "contains", label: "Contains" },
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
]

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
    'filterBuilder.operators.equals': 'Equals',
    'filterBuilder.operators.notEquals': 'Does not equal',
    'filterBuilder.operators.contains': 'Contains',
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
  },
  'filterBuilder.where',
)

const textOperators = ["equals", "notEquals", "contains", "notContains", "isEmpty", "isNotEmpty"]
const numberOperators = ["equals", "notEquals", "greaterThan", "lessThan", "greaterOrEqual", "lessOrEqual", "isEmpty", "isNotEmpty"]
const booleanOperators = ["equals", "notEquals"]
const dateOperators = ["equals", "notEquals", "before", "after", "between", "isEmpty", "isNotEmpty"]
const selectOperators = ["equals", "notEquals", "in", "notIn", "isEmpty", "isNotEmpty"]
const lookupOperators = ["equals", "notEquals", "in", "notIn", "isEmpty", "isNotEmpty"]

/** Field types that share the same operator/input behavior as number (numeric comparison operators, number input) */
const numberLikeTypes = ["number", "currency", "percent", "rating"]
/** Field types that share the same operator/input behavior as date (before/after operators, date/datetime/time input) */
const dateLikeTypes = ["date", "datetime", "time"]
/** Field types that use select operators (equals/in/notIn) and render dropdown or checkbox list when options provided */
const selectLikeTypes = ["select", "status"]
/** Relational/reference field types that use lookup operators (equals/in/notIn) and render dropdown or checkbox list when options provided */
const lookupLikeTypes = ["lookup", "master_detail", "user", "owner"]

/** Normalize a filter value into an array for multi-select scenarios */
function normalizeToArray(value: FilterCondition["value"]): (string | number | boolean)[] {
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
    const newCondition: FilterCondition = {
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

  const updateCondition = (conditionId: string, updates: Partial<FilterCondition>) => {
    handleChange({
      ...filterGroup,
      conditions: filterGroup.conditions.map((c) =>
        c.id === conditionId ? { ...c, ...updates } : c
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
    const fieldType = field?.type || "text"

    if (numberLikeTypes.includes(fieldType)) {
      return defaultOperators.filter((op) => numberOperators.includes(op.value))
    }
    if (fieldType === "boolean") {
      return defaultOperators.filter((op) => booleanOperators.includes(op.value))
    }
    if (dateLikeTypes.includes(fieldType)) {
      return defaultOperators.filter((op) => dateOperators.includes(op.value))
    }
    if (selectLikeTypes.includes(fieldType)) {
      return defaultOperators.filter((op) => selectOperators.includes(op.value))
    }
    if (lookupLikeTypes.includes(fieldType)) {
      return defaultOperators.filter((op) => lookupOperators.includes(op.value))
    }
    return defaultOperators.filter((op) => textOperators.includes(op.value))
  }

  const needsValueInput = (operator: string) => {
    return !["isEmpty", "isNotEmpty"].includes(operator)
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

  const renderValueInput = (condition: FilterCondition) => {
    const field = fields.find((f) => f.value === condition.field)
    const isMultiOperator = ["in", "notIn"].includes(condition.operator)
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
                  onValueChange={(value) =>
                    updateCondition(condition.id, { operator: value })
                  }
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

      <Button
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
  value: FilterCondition["value"]
  multiple: boolean
  onChange: (value: FilterCondition["value"]) => void
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
    // Fallback to a plain text input when no DataSource is available
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
