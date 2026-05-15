/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { cva, type VariantProps } from "class-variance-authority"
import { useObjectTranslation } from "@object-ui/i18n"

import { cn } from "../lib/utils"

function useEmptyValueLabel(): string {
  try {
    const { t } = useObjectTranslation()
    const v = t("detail.noValue")
    return !v || v === "detail.noValue" ? "No value" : v
  } catch {
    return "No value"
  }
}

function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border-dashed p-6 text-center text-balance md:p-12",
        className
      )}
      {...props}
    />
  )
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn(
        "flex max-w-sm flex-col items-center gap-2 text-center",
        className
      )}
      {...props}
    />
  )
}

const emptyMediaVariants = cva(
  "flex shrink-0 items-center justify-center mb-2 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function EmptyMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      className={cn(emptyMediaVariants({ variant, className }))}
      {...props}
    />
  )
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-title"
      className={cn("text-lg font-medium tracking-tight", className)}
      {...props}
    />
  )
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <div
      data-slot="empty-description"
      className={cn(
        "text-muted-foreground [&>a:hover]:text-primary text-sm/relaxed [&>a]:underline [&>a]:underline-offset-4",
        className
      )}
      {...props}
    />
  )
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn(
        "flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance",
        className
      )}
      {...props}
    />
  )
}

/**
 * EmptyValue — universal inline placeholder for missing cell/field values.
 *
 * Use this anywhere a renderer would otherwise show "-" or "—" for a null,
 * undefined or empty value. It renders a muted, non-interactive en-dash that
 * does not inherit link/button colors from surrounding ancestors, so a missing
 * value never looks clickable.
 */
function EmptyValue({
  className,
  glyph = "—",
  ...props
}: React.ComponentProps<"span"> & { glyph?: string }) {
  const ariaLabel = useEmptyValueLabel()
  return (
    <span
      data-slot="empty-value"
      aria-label={ariaLabel}
      className={cn(
        "select-none text-muted-foreground/50 no-underline pointer-events-none",
        className
      )}
      {...props}
    >
      {glyph}
    </span>
  )
}

export {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
  EmptyValue,
}
