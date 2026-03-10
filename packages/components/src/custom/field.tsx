/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react"
import { Slot as SlotPrimitive } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../lib/utils"
import { Label } from "../ui/label"

const fieldVariants = cva("space-y-2")

export interface FieldProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof fieldVariants> {
  label?: React.ReactNode
  description?: React.ReactNode
  error?: React.ReactNode
  required?: boolean
  htmlFor?: string
}

const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  ({ className, label, description, error, required, htmlFor, children, ...props }, ref) => {
    const id = React.useId()
    const fieldId = htmlFor || id
    const descriptionId = `${fieldId}-description`
    const errorId = `${fieldId}-error`

    return (
      <div ref={ref} className={cn(fieldVariants(), className)} {...props}>
        {label && (
          <Label 
            htmlFor={fieldId}
            className={cn(error && "text-destructive", required && "after:content-['*'] after:ml-0.5 after:text-destructive")}
          >
            {label}
          </Label>
        )}
        
        <SlotPrimitive.Slot 
          id={fieldId}
          aria-describedby={
            [description && descriptionId, error && errorId]
              .filter(Boolean)
              .join(" ") || undefined
          }
          aria-invalid={!!error}
        >
          {children}
        </SlotPrimitive.Slot>

        {description && !error && (
          <p
            id={descriptionId}
            className="text-[0.8rem] text-muted-foreground"
          >
            {description}
          </p>
        )}

        {error && (
          <p
            id={errorId}
            className="text-[0.8rem] font-medium text-destructive"
          >
            {error}
          </p>
        )}
      </div>
    )
  }
)
Field.displayName = "Field"

export { Field }
