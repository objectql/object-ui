/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client"

import * as React from "react"
import { X, Plus, Trash2 } from "lucide-react"

import { cn } from "../lib/utils"
import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Input } from "../ui/input"

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
  }>
  value?: FilterGroup
  onChange?: (value: FilterGroup) => void
  className?: string
  showClearAll?: boolean
}

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

function FilterBuilder({
  fields = [],
  value,
  onChange,
  className,
  showClearAll = true,
}: FilterBuilderProps) {
  const [filterGroup, setFilterGroup] = React.useState<FilterGroup>(
    value || {
      id: "root",
      logic: "and",
      conditions: [],
    }
  )

  React.useEffect(() => {
    if (value && JSON.stringify(value) !== JSON.stringify(filterGroup)) {
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
            <SelectValue placeholder="Select value" />
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
            <SelectValue placeholder="Select value" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">True</SelectItem>
            <SelectItem value="false">False</SelectItem>
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
        placeholder="Value"
        value={formatValue()}
        onChange={(e) => handleValueChange(e.target.value)}
      />
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Where</span>
          {filterGroup.conditions.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLogic}
              className="h-7 text-xs"
            >
              {filterGroup.logic.toUpperCase()}
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
            Clear all
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
                    <SelectValue placeholder="Select field" />
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
                    <SelectValue placeholder="Operator" />
                  </SelectTrigger>
                  <SelectContent>
                    {getOperatorsForField(condition.field).map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
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
              size="icon-sm"
              className="h-9 w-9 shrink-0"
              onClick={() => removeCondition(condition.id)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Remove condition</span>
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
        Add filter
      </Button>
    </div>
  )
}

FilterBuilder.displayName = "FilterBuilder"

export { FilterBuilder }
