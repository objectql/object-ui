/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react"
import { Slot as SlotPrimitive } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../lib/utils"
import { Label } from "../ui/label"

const fieldVariants = cva("space-y-2")

/**
 * Props for {@link FieldContainer}.
 *
 * Note this one keeps its natural name: the spec does not export `FieldProps`.
 * Only the component itself had to move — see the note on `FieldContainer`.
 */
export interface FieldProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof fieldVariants> {
  label?: React.ReactNode
  description?: React.ReactNode
  error?: React.ReactNode
  required?: boolean
  htmlFor?: string
}

/**
 * A labelled form-control wrapper: label, slotted control, description, error.
 *
 * Named `FieldContainer`, not `Field` (objectstack#4115): `@objectstack/spec/data`
 * exports `Field` — an object FIELD's metadata (type, reference_to, options,
 * permissions, …) and its builder namespace — which has nothing to do with this
 * `<div>`. Two unrelated things under one name is the defect that issue exists
 * to remove; `@object-ui/app-shell` already renamed the same kind of collision
 * (`FieldInput` → `ScreenFieldInput`, objectui#3169) for the same reason.
 * `__tests__/share-filter-sort-spec-parity.test.ts` pins that the spec does not
 * own the new name.
 */
const FieldContainer = React.forwardRef<HTMLDivElement, FieldProps>(
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
        
        <SlotPrimitive 
          id={fieldId}
          aria-describedby={
            [description && descriptionId, error && errorId]
              .filter(Boolean)
              .join(" ") || undefined
          }
          aria-invalid={!!error}
        >
          {children}
        </SlotPrimitive>

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
FieldContainer.displayName = "FieldContainer"

export { FieldContainer }
