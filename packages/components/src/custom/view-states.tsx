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
  /**
   * Optional illustration rendered above the icon (or replacing it
   * when the icon would have shown a generic Inbox glyph). Use for
   * product-feel empty states — onboarding-style hero SVGs, brand
   * illustrations, etc. Sized to roughly 96–160px by default; pass a
   * custom `className` on the SVG to override.
   *
   * When `illustration` is set, the default Inbox icon is suppressed.
   * To show BOTH a custom icon and an illustration, pass both `icon`
   * and `illustration`.
   */
  illustration?: React.ReactNode
  /**
   * When false, the icon container is omitted entirely. Useful for
   * board-level / banner-style empty states that should not show a generic
   * inbox glyph. Defaults to true.
   */
  showIcon?: boolean
  /**
   * Override class on the icon wrapper. By default the wrapper renders as a
   * small muted rounded square (`size-10 rounded-lg bg-muted`). Pass `""` to
   * strip that styling and render the icon raw, or extend the look (e.g.
   * larger size).
   */
  iconWrapperClassName?: string
  title?: string
  description?: string
  /** Optional action rendered below the description */
  action?: React.ReactNode
}

/**
 * `role` defaults to `"status"` (objectui#7132).
 *
 * The sibling states in this file each declare what they are — `DataLoadingState`
 * is `role="status"`, `DataErrorState` is `role="alert"` — and the empty state
 * alone declared nothing, so an empty box and a failed box were the same node
 * shape to a screen reader and to any structural test. That is the exact
 * property both the hotcrm#1212 (objectui#7063) and hotcrm#1247 (objectui#7064)
 * rulings named first: an empty state must be *distinguishable from a load
 * failure at a glance*.
 *
 * With no default, every surface that wanted the property had to type it at its
 * own call site, and four independently did — `plugin-kanban`'s empty board,
 * `plugin-dashboard`'s `WidgetEmptyState`, and `plugin-charts`' `ObjectChart` —
 * while `plugin-list`, `plugin-detail`'s two timelines and the `ui:empty`
 * renderer silently did not. Four hand-copies of one line is the per-app tax
 * objectstack#13848 rules against, paid at the package level.
 *
 * It is a DEFAULT, not a fixed attribute: `role` is spread from `props` below,
 * so a call site keeps the last word. That is what makes this change inert for
 * the two ruled surfaces — both already pass `role="status"` explicitly and
 * receive the identical attribute either way — and it is what lets a call site
 * rendering something that is NOT empty say so (`plugin-list`'s load-error
 * panel borrows this component and declares `role="alert"`).
 */
function DataEmptyState({
  className,
  icon,
  illustration,
  showIcon = true,
  iconWrapperClassName,
  title = "No data",
  description,
  action,
  children,
  ...props
}: DataEmptyStateProps) {
  // When an illustration is supplied we suppress the default Inbox
  // icon — they would compete visually. A caller that explicitly
  // passes both `icon` and `illustration` opts into rendering both.
  const shouldShowIconBlock = showIcon && (icon != null || !illustration)

  return (
    <div
      role="status"
      data-slot="data-empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 p-6 text-center",
        className
      )}
      {...props}
    >
      {illustration && (
        <div
          data-slot="data-empty-state-illustration"
          className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-300 [&_svg]:max-h-40 [&_svg]:w-auto"
          aria-hidden
        >
          {illustration}
        </div>
      )}
      {shouldShowIconBlock && (
        <div
          data-slot="data-empty-state-icon"
          className={cn(
            iconWrapperClassName ??
              "flex size-10 items-center justify-center rounded-lg bg-muted"
          )}
        >
          {icon ?? <InboxIcon className="size-5 text-muted-foreground" />}
        </div>
      )}
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
  DataEmptyState as EmptyState,
  DataErrorState,
  type DataLoadingStateProps,
  type DataEmptyStateProps,
  type DataEmptyStateProps as EmptyStateProps,
  type DataErrorStateProps,
}
