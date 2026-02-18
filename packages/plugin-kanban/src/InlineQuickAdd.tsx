/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react"
import { Button, Input } from "@object-ui/components"
import { Check, X } from "lucide-react"
import type { InlineFieldDefinition } from "./types"

const cn = (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' ')

export interface InlineQuickAddProps {
  /** Column where the card will be added */
  columnId: string
  /** Field definitions for inline editing */
  fields: InlineFieldDefinition[]
  /** Called with field values when the form is submitted */
  onSubmit: (columnId: string, values: Record<string, any>) => void
  /** Called when the form is cancelled */
  onCancel: () => void
  /** Pre-filled values (e.g. from a card template) */
  defaultValues?: Record<string, any>
}

/**
 * InlineQuickAdd renders form fields directly inside the kanban column
 * without opening a dialog or modal. Submit with Enter or the Save button;
 * cancel with Escape or the Cancel button.
 */
export const InlineQuickAdd: React.FC<InlineQuickAddProps> = ({
  columnId,
  fields,
  onSubmit,
  onCancel,
  defaultValues,
}) => {
  const [values, setValues] = React.useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {}
    for (const field of fields) {
      initial[field.name] = defaultValues?.[field.name] ?? field.defaultValue ?? ""
    }
    return initial
  })

  const firstInputRef = React.useRef<HTMLInputElement | HTMLSelectElement>(null)

  React.useEffect(() => {
    // Auto-focus first field on mount
    const timer = setTimeout(() => firstInputRef.current?.focus(), 0)
    return () => clearTimeout(timer)
  }, [])

  const handleChange = React.useCallback((name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }))
  }, [])

  const handleSubmit = React.useCallback(() => {
    // Require at least one non-empty value
    const hasValue = Object.values(values).some(v =>
      typeof v === "string" ? v.trim().length > 0 : v != null
    )
    if (hasValue) {
      onSubmit(columnId, values)
    }
  }, [columnId, values, onSubmit])

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault()
        handleSubmit()
      } else if (e.key === "Escape") {
        e.preventDefault()
        onCancel()
      }
    },
    [handleSubmit, onCancel],
  )

  return (
    <div
      className="mt-2 rounded-lg border border-primary/30 bg-card p-3 space-y-2 shadow-sm"
      onKeyDown={handleKeyDown}
      role="form"
      aria-label="Quick add card"
    >
      {fields.map((field, idx) => (
        <div key={field.name} className="space-y-1">
          <label
            htmlFor={`qa-${columnId}-${field.name}`}
            className="text-xs font-mono text-muted-foreground"
          >
            {field.label ?? field.name}
          </label>
          {renderField(field, values[field.name], handleChange, idx === 0 ? firstInputRef : undefined, `qa-${columnId}-${field.name}`)}
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={handleSubmit}
        >
          <Check className="h-3 w-3" />
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={onCancel}
        >
          <X className="h-3 w-3" />
          Cancel
        </Button>
      </div>
    </div>
  )
}

/** Renders a single field based on its type. */
function renderField(
  field: InlineFieldDefinition,
  value: any,
  onChange: (name: string, value: any) => void,
  ref?: React.Ref<any>,
  id?: string,
) {
  const commonClasses = "text-sm h-8"

  switch (field.type) {
    case "select":
      return (
        <select
          ref={ref as React.Ref<HTMLSelectElement>}
          id={id}
          value={value ?? ""}
          onChange={e => onChange(field.name, e.target.value)}
          className={cn(
            commonClasses,
            "w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          )}
        >
          <option value="">{field.placeholder ?? `Select ${field.label ?? field.name}...`}</option>
          {(field.options ?? []).map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )

    case "number":
      return (
        <Input
          ref={ref as React.Ref<HTMLInputElement>}
          id={id}
          type="number"
          value={value ?? ""}
          onChange={e => onChange(field.name, e.target.value === "" ? "" : Number(e.target.value))}
          placeholder={field.placeholder ?? `Enter ${field.label ?? field.name}...`}
          className={commonClasses}
        />
      )

    case "text":
    default:
      return (
        <Input
          ref={ref as React.Ref<HTMLInputElement>}
          id={id}
          type="text"
          value={value ?? ""}
          onChange={e => onChange(field.name, e.target.value)}
          placeholder={field.placeholder ?? `Enter ${field.label ?? field.name}...`}
          className={commonClasses}
        />
      )
  }
}

export default InlineQuickAdd
