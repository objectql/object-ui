/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react"
import { cn } from "@object-ui/components"

const Timeline = React.forwardRef<
  HTMLOListElement,
  React.HTMLAttributes<HTMLOListElement>
>(({ className, ...props }, ref) => (
  <ol
    ref={ref}
    className={cn("relative border-l border-gray-200", className)}
    {...props}
  />
))
Timeline.displayName = "Timeline"

const TimelineItem = React.forwardRef<
  HTMLLIElement,
  React.HTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn("mb-10 ml-6", className)}
    {...props}
  />
))
TimelineItem.displayName = "TimelineItem"

const TimelineMarker = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "success" | "warning" | "danger" | "info"
  }
>(({ className, variant = "default", ...props }, ref) => {
  const variantClasses = {
    default: "bg-gray-200 border-gray-300",
    success: "bg-green-200 border-green-500",
    warning: "bg-yellow-200 border-yellow-500",
    danger: "bg-red-200 border-red-500",
    info: "bg-blue-200 border-blue-500",
  }

  return (
    <div
      ref={ref}
      className={cn(
        "absolute -left-3 w-6 h-6 rounded-full border-2 flex items-center justify-center",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
})
TimelineMarker.displayName = "TimelineMarker"

const TimelineContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={className}
    {...props}
  />
))
TimelineContent.displayName = "TimelineContent"

const TimelineTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-semibold text-lg mb-1", className)}
    {...props}
  />
))
TimelineTitle.displayName = "TimelineTitle"

const TimelineTime = React.forwardRef<
  HTMLTimeElement,
  React.TimeHTMLAttributes<HTMLTimeElement>
>(({ className, ...props }, ref) => (
  <time
    ref={ref}
    className={cn("text-sm font-normal text-gray-500 mb-2 block", className)}
    {...props}
  />
))
TimelineTime.displayName = "TimelineTime"

const TimelineDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-base text-gray-700", className)}
    {...props}
  />
))
TimelineDescription.displayName = "TimelineDescription"

// Horizontal Timeline Components
const TimelineHorizontal = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("relative flex overflow-x-auto py-8", className)}
    {...props}
  />
))
TimelineHorizontal.displayName = "TimelineHorizontal"

const TimelineHorizontalItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex-shrink-0 w-64 relative", className)}
    {...props}
  />
))
TimelineHorizontalItem.displayName = "TimelineHorizontalItem"

// Gantt-style Timeline Components (Airtable-like)
const TimelineGantt = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("relative w-full border rounded-lg overflow-hidden", className)}
    {...props}
  />
))
TimelineGantt.displayName = "TimelineGantt"

const TimelineGanttHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex border-b bg-gray-50", className)}
    {...props}
  />
))
TimelineGanttHeader.displayName = "TimelineGanttHeader"

const TimelineGanttRowLabels = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("w-48 border-r bg-white", className)}
    {...props}
  />
))
TimelineGanttRowLabels.displayName = "TimelineGanttRowLabels"

const TimelineGanttGrid = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex-1 overflow-x-auto", className)}
    {...props}
  />
))
TimelineGanttGrid.displayName = "TimelineGanttGrid"

const TimelineGanttRow = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center border-b min-h-12", className)}
    {...props}
  />
))
TimelineGanttRow.displayName = "TimelineGanttRow"

const TimelineGanttLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-4 py-2 font-medium text-sm truncate", className)}
    {...props}
  />
))
TimelineGanttLabel.displayName = "TimelineGanttLabel"

const TimelineGanttBar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    start?: number
    width?: number
    variant?: "default" | "success" | "warning" | "danger" | "info"
  }
>(({ className, start = 0, width = 100, variant = "default", ...props }, ref) => {
  const variantClasses = {
    default: "bg-blue-500 hover:bg-blue-600",
    success: "bg-green-500 hover:bg-green-600",
    warning: "bg-yellow-500 hover:bg-yellow-600",
    danger: "bg-red-500 hover:bg-red-600",
    info: "bg-purple-500 hover:bg-purple-600",
  }

  return (
    <div
      ref={ref}
      className={cn(
        "absolute h-8 rounded-md transition-colors cursor-pointer",
        variantClasses[variant],
        className
      )}
      style={{
        left: `${start}%`,
        width: `${width}%`,
      }}
      {...props}
    />
  )
})
TimelineGanttBar.displayName = "TimelineGanttBar"

const TimelineGanttBarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-2 py-1 text-white text-xs font-medium truncate", className)}
    {...props}
  />
))
TimelineGanttBarContent.displayName = "TimelineGanttBarContent"

export {
  Timeline,
  TimelineItem,
  TimelineMarker,
  TimelineContent,
  TimelineTitle,
  TimelineTime,
  TimelineDescription,
  TimelineHorizontal,
  TimelineHorizontalItem,
  TimelineGantt,
  TimelineGanttHeader,
  TimelineGanttRowLabels,
  TimelineGanttGrid,
  TimelineGanttRow,
  TimelineGanttLabel,
  TimelineGanttBar,
  TimelineGanttBarContent,
}

// Export renderer to register the component with ObjectUI
export * from './renderer';

// Export ObjectTimeline
export { ObjectTimeline } from './ObjectTimeline';
export type { ObjectTimelineProps } from './ObjectTimeline';

import { ComponentRegistry } from '@object-ui/core';
import { ObjectTimeline } from './ObjectTimeline';
import { useSchemaContext } from '@object-ui/react';

// Register object-timeline component
export const ObjectTimelineRenderer: React.FC<{ schema: any }> = ({ schema }) => {
  const { dataSource } = useSchemaContext();
  return <ObjectTimeline schema={schema} dataSource={dataSource} />;
};

ComponentRegistry.register('object-timeline', ObjectTimelineRenderer, {
  namespace: 'plugin-timeline',
  label: 'Object Timeline',
  category: 'plugin',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'variant', type: 'enum', enum: ['vertical', 'horizontal', 'gantt'], defaultValue: 'vertical' },
  ]
});
