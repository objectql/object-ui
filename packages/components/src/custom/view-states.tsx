/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react"
import { Loader2, InboxIcon, AlertCircle } from "lucide-react"

import { cn } from "../lib/utils"
import { Button } from "../ui/button"

// ---------------------------------------------------------------------------
// DataLoadingState
// ---------------------------------------------------------------------------

interface DataLoadingStateProps extends React.ComponentProps<"div"> {
  /** Message displayed below the spinner */
  message?: string
}

function DataLoadingState({
  className,
  message = "Loading…",
  ...props
}: DataLoadingStateProps) {
  return (
    <div
      role="status"
      aria-label={message}
      data-slot="data-loading-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 p-6 text-center",
        className
      )}
      {...props}
    >
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DataEmptyState
// ---------------------------------------------------------------------------

interface DataEmptyStateProps extends React.ComponentProps<"div"> {
  /** Icon rendered above the title */
  icon?: React.ReactNode
  title?: string
  description?: string
  /** Optional action rendered below the description */
  action?: React.ReactNode
}

function DataEmptyState({
  className,
  icon,
  title = "No data",
  description,
  action,
  children,
  ...props
}: DataEmptyStateProps) {
  return (
    <div
      data-slot="data-empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 p-6 text-center",
        className
      )}
      {...props}
    >
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
        {icon ?? <InboxIcon className="size-5 text-muted-foreground" />}
      </div>
      {title && (
        <h3 className="text-sm font-medium">{title}</h3>
      )}
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action}
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DataErrorState
// ---------------------------------------------------------------------------

interface DataErrorStateProps extends React.ComponentProps<"div"> {
  title?: string
  /** Error message or description */
  message?: string
  /** Callback invoked when the retry button is clicked */
  onRetry?: () => void
  /** Label for the retry button */
  retryLabel?: string
}

function DataErrorState({
  className,
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Retry",
  children,
  ...props
}: DataErrorStateProps) {
  return (
    <div
      role="alert"
      data-slot="data-error-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 p-6 text-center",
        className
      )}
      {...props}
    >
      <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10">
        <AlertCircle className="size-5 text-destructive" />
      </div>
      {title && (
        <h3 className="text-sm font-medium">{title}</h3>
      )}
      {message && (
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      )}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
      {children}
    </div>
  )
}

export {
  DataLoadingState,
  DataEmptyState,
  DataErrorState,
  type DataLoadingStateProps,
  type DataEmptyStateProps,
  type DataErrorStateProps,
}
