/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react"
import { cn, cva } from "@object-ui/components"
import type { VariantProps } from "class-variance-authority"

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

const timelineItemVariants = cva("ml-6", {
  variants: {
    density: {
      default: "mb-10",
      compact: "mb-3",
      comfortable: "mb-6",
    },
  },
  defaultVariants: { density: "default" },
})

const TimelineItem = React.forwardRef<
  HTMLLIElement,
  React.HTMLAttributes<HTMLLIElement> & VariantProps<typeof timelineItemVariants>
>(({ className, density, ...props }, ref) => (
  <li
    ref={ref}
    className={cn(timelineItemVariants({ density }), className)}
    {...props}
  />
))
TimelineItem.displayName = "TimelineItem"

const timelineMarkerVariants = cva(
  "absolute -left-3 w-6 h-6 rounded-full border-2 flex items-center justify-center",
  {
    variants: {
      variant: {
        default: "bg-blue-200 border-blue-400",
        success: "bg-emerald-200 border-emerald-500",
        warning: "bg-amber-200 border-amber-500",
        danger: "bg-red-200 border-red-500",
        info: "bg-purple-200 border-purple-500",
        todo: "bg-slate-200 border-slate-400",
        "in-progress": "bg-blue-200 border-blue-500",
        done: "bg-emerald-200 border-emerald-500",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

type TimelineMarkerVariant = VariantProps<typeof timelineMarkerVariants>["variant"]

const TimelineMarker = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: TimelineMarkerVariant
  }
>(({ className, variant = "default", ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(timelineMarkerVariants({ variant }), className)}
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
  timelineItemVariants,
  TimelineMarker,
  timelineMarkerVariants,
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
export const ObjectTimelineRenderer: React.FC<any> = ({ schema, ...props }) => {
  const { dataSource } = useSchemaContext();
  return <ObjectTimeline schema={schema} dataSource={dataSource} {...props} />;
};

ComponentRegistry.register('object-timeline', ObjectTimelineRenderer, {
  namespace: 'plugin-timeline',
  label: 'Object Timeline',
  category: 'view',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'variant', type: 'enum', enum: ['vertical', 'horizontal', 'gantt'], defaultValue: 'vertical' },
  ]
});

ComponentRegistry.register('timeline', ObjectTimelineRenderer, {
  namespace: 'view',
  label: 'Timeline View',
  category: 'view',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'variant', type: 'enum', enum: ['vertical', 'horizontal', 'gantt'], defaultValue: 'vertical' },
  ]
});
