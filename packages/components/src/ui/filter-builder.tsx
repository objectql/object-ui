"use client"

import * as React from "react"
import { X, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import { Input } from "@/ui/input"

export interface FilterCondition {
  id: string
  field: string
  operator: string
  value: string | number | boolean
}

export interface FilterGroup {
  id: string
  logic: "and" | "or"
  conditions: FilterCondition[]
}

export interface FilterBuilderProps {
  fields?: Array<{ value: string; label: string; type?: string }>
  value?: FilterGroup
  onChange?: (value: FilterGroup) => void
  className?: string
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
]

const textOperators = ["equals", "notEquals", "contains", "notContains", "isEmpty", "isNotEmpty"]
const numberOperators = ["equals", "notEquals", "greaterThan", "lessThan", "greaterOrEqual", "lessOrEqual", "isEmpty", "isNotEmpty"]
const booleanOperators = ["equals", "notEquals"]

function FilterBuilder({
  fields = [],
  value,
  onChange,
  className,
}: FilterBuilderProps) {
  const [filterGroup, setFilterGroup] = React.useState<FilterGroup>(
    value || {
      id: "root",
      logic: "and",
      conditions: [],
    }
  )

  React.useEffect(() => {
    if (value && value !== filterGroup) {
      setFilterGroup(value)
    }
  }, [value])

  const handleChange = (newGroup: FilterGroup) => {
    setFilterGroup(newGroup)
    onChange?.(newGroup)
  }

  const addCondition = () => {
    const newCondition: FilterCondition = {
      id: `condition-${Date.now()}`,
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

    switch (fieldType) {
      case "number":
        return defaultOperators.filter((op) => numberOperators.includes(op.value))
      case "boolean":
        return defaultOperators.filter((op) => booleanOperators.includes(op.value))
      case "text":
      default:
        return defaultOperators.filter((op) => textOperators.includes(op.value))
    }
  }

  const needsValueInput = (operator: string) => {
    return !["isEmpty", "isNotEmpty"].includes(operator)
  }

  return (
    <div className={cn("space-y-3", className)}>
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
                  <Input
                    className="h-9 text-sm"
                    placeholder="Value"
                    value={condition.value as string}
                    onChange={(e) =>
                      updateCondition(condition.id, { value: e.target.value })
                    }
                  />
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
