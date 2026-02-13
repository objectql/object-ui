/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { TimelineSchema } from '@object-ui/types';
import {
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
} from './index';
import { renderChildren, cn } from '@object-ui/components';

// Constants
const MILLISECONDS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// Helper function to calculate date range from items
function calculateDateRange(items: any[]): { minDate: string; maxDate: string } {
  const allDates = items.flatMap((row: any) =>
    (row.items || []).flatMap((item: any) => [item.startDate, item.endDate])
  );
  
  const minTimestamp = Math.min(...allDates.map((d: string) => new Date(d).getTime()));
  const maxTimestamp = Math.max(...allDates.map((d: string) => new Date(d).getTime()));
  
  return {
    minDate: new Date(minTimestamp).toISOString().split('T')[0],
    maxDate: new Date(maxTimestamp).toISOString().split('T')[0],
  };
}

// Helper function to calculate bar position and width based on dates
function calculateBarDimensions(
  startDate: string,
  endDate: string,
  minDate: string,
  maxDate: string
): { start: number; width: number } {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const min = new Date(minDate).getTime();
  const max = new Date(maxDate).getTime();

  const totalDuration = max - min;
  const startOffset = start - min;
  const duration = end - start;

  return {
    start: (startOffset / totalDuration) * 100,
    width: (duration / totalDuration) * 100,
  };
}

// Helper function to format date
function formatDate(dateString: string, format?: string): string {
  const date = new Date(dateString);
  if (format === 'short') {
    return date.toLocaleDateString();
  }
  if (format === 'long') {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
  return date.toISOString().split('T')[0];
}

export const TimelineRenderer = ({ schema, className, ...props }: { schema: TimelineSchema; className?: string; [key: string]: any }) => {
    const {
      variant = 'vertical',
      items = [],
      dateFormat = 'short',
      onItemClick,
    } = schema;

    // Vertical Timeline
    if (variant === 'vertical') {
      return (
        <Timeline className={className} {...props}>
          {items.map((item: any, index: number) => (
            <TimelineItem key={index} className={item.className}>
              <TimelineMarker variant={item.variant || 'default'}>
                {item.icon && <span className="text-xs">{item.icon}</span>}
              </TimelineMarker>
              <TimelineContent>
                {item.time && (
                  <TimelineTime dateTime={item.time}>
                    {formatDate(item.time, dateFormat)}
                  </TimelineTime>
                )}
                {item.title && <TimelineTitle>{item.title}</TimelineTitle>}
                {item.description && (
                  <TimelineDescription className="line-clamp-2 sm:line-clamp-none">{item.description}</TimelineDescription>
                )}
                {item.content && renderChildren(item.content)}
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      );
    }

    // Horizontal Timeline
    if (variant === 'horizontal') {
      return (
        <TimelineHorizontal className={cn("overflow-x-auto [-webkit-overflow-scrolling:touch]", className)} {...props}>
          {items.map((item: any, index: number) => (
            <TimelineHorizontalItem key={index} className={item.className}>
              <div className="flex flex-col items-center">
                <TimelineMarker variant={item.variant || 'default'}>
                  {item.icon && <span className="text-xs">{item.icon}</span>}
                </TimelineMarker>
                <div className="mt-4 text-center">
                  {item.time && (
                    <TimelineTime dateTime={item.time}>
                      {formatDate(item.time, dateFormat)}
                    </TimelineTime>
                  )}
                  {item.title && <TimelineTitle>{item.title}</TimelineTitle>}
                  {item.description && (
                    <TimelineDescription className="text-center line-clamp-2 sm:line-clamp-none">
                      {item.description}
                    </TimelineDescription>
                  )}
                  {item.content && renderChildren(item.content)}
                </div>
              </div>
              {index < items.length - 1 && (
                <div className="absolute left-full w-16 border-t-2 border-gray-200 top-3" />
              )}
            </TimelineHorizontalItem>
          ))}
        </TimelineHorizontal>
      );
    }

    // Gantt/Airtable-style Timeline
    if (variant === 'gantt') {
      // Calculate date range from all items
      const dateRange = calculateDateRange(items);
      const minDate = schema.minDate || dateRange.minDate;
      const maxDate = schema.maxDate || dateRange.maxDate;

      // Generate time scale headers (months, weeks, etc.)
      const timeScale = schema.timeScale || 'month';
      const generateTimeHeaders = () => {
        const headers: string[] = [];
        const start = new Date(minDate);
        const end = new Date(maxDate);

        if (timeScale === 'month') {
          const current = new Date(start);
          while (current <= end) {
            headers.push(
              current.toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              })
            );
            current.setMonth(current.getMonth() + 1);
          }
        } else if (timeScale === 'week') {
          const current = new Date(start);
          while (current <= end) {
            headers.push(
              `Week ${Math.ceil(
                (current.getTime() - start.getTime()) / MILLISECONDS_PER_WEEK
              ) + 1}`
            );
            current.setDate(current.getDate() + 7);
          }
        } else if (timeScale === 'day') {
          const current = new Date(start);
          while (current <= end) {
            headers.push(
              current.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })
            );
            current.setDate(current.getDate() + 1);
          }
        }

        return headers;
      };

      const timeHeaders = generateTimeHeaders();

      return (
        <TimelineGantt className={cn("overflow-x-auto [-webkit-overflow-scrolling:touch]", className)} {...props}>
          {/* Header */}
          <TimelineGanttHeader>
            <TimelineGanttRowLabels className="flex items-center px-2 sm:px-4 py-2 sm:py-3">
              <span className="font-semibold text-xs sm:text-sm">
                {schema.rowLabel || 'Items'}
              </span>
            </TimelineGanttRowLabels>
            <TimelineGanttGrid>
              <div className="flex h-full">
                {timeHeaders.map((header, index) => (
                  <div
                    key={index}
                    className="flex-1 px-1 sm:px-2 py-2 sm:py-3 border-r text-xs font-medium text-center"
                  >
                    {header}
                  </div>
                ))}
              </div>
            </TimelineGanttGrid>
          </TimelineGanttHeader>

          {/* Rows */}
          <div>
            <div className="flex">
              <TimelineGanttRowLabels>
                {items.map((row: any, rowIndex: number) => (
                  <TimelineGanttRow key={rowIndex}>
                    <TimelineGanttLabel title={row.label} className="truncate">
                      {row.label}
                    </TimelineGanttLabel>
                  </TimelineGanttRow>
                ))}
              </TimelineGanttRowLabels>
              <TimelineGanttGrid className="relative">
                {items.map((row: any, rowIndex: number) => (
                  <TimelineGanttRow key={rowIndex} className="relative">
                    {(row.items || []).map((item: any, itemIndex: number) => {
                      const dimensions = calculateBarDimensions(
                        item.startDate,
                        item.endDate,
                        minDate,
                        maxDate
                      );

                      return (
                        <TimelineGanttBar
                          key={itemIndex}
                          start={dimensions.start}
                          width={dimensions.width}
                          variant={item.variant || 'default'}
                          onClick={() => onItemClick?.(item, row, rowIndex, itemIndex)}
                          title={`${item.title || ''}\n${formatDate(item.startDate, dateFormat)} - ${formatDate(item.endDate, dateFormat)}`}
                        >
                          <TimelineGanttBarContent>
                            {item.title}
                          </TimelineGanttBarContent>
                        </TimelineGanttBar>
                      );
                    })}
                  </TimelineGanttRow>
                ))}
              </TimelineGanttGrid>
            </div>
          </div>
        </TimelineGantt>
      );
    }

    return null;
  };

ComponentRegistry.register(
  'timeline', 
  TimelineRenderer,
  {
    namespace: 'plugin-timeline',
    label: 'Timeline',
    category: 'data-display',
    inputs: [
      {
        name: 'variant',
        type: 'enum',
        enum: ['vertical', 'horizontal', 'gantt'],
        label: 'Timeline Variant',
        defaultValue: 'vertical',
      },
      {
        name: 'items',
        type: 'array',
        label: 'Timeline Items',
        description:
          'For vertical/horizontal: Array of { time, title, description, variant, icon, content }. For gantt: Array of { label, items: [{ title, startDate, endDate, variant }] }',
      },
      {
        name: 'dateFormat',
        type: 'enum',
        enum: ['short', 'long', 'iso'],
        label: 'Date Format',
        defaultValue: 'short',
      },
      {
        name: 'timeScale',
        type: 'enum',
        enum: ['day', 'week', 'month'],
        label: 'Time Scale (Gantt only)',
        defaultValue: 'month',
      },
      {
        name: 'rowLabel',
        type: 'string',
        label: 'Row Label (Gantt only)',
        defaultValue: 'Items',
      },
      {
        name: 'minDate',
        type: 'string',
        label: 'Min Date (Gantt only)',
        description: 'Override auto-calculated min date (YYYY-MM-DD)',
      },
      {
        name: 'maxDate',
        type: 'string',
        label: 'Max Date (Gantt only)',
        description: 'Override auto-calculated max date (YYYY-MM-DD)',
      },
      { name: 'className', type: 'string', label: 'CSS Class' },
    ],
    defaultProps: {
      variant: 'vertical',
      dateFormat: 'short',
      items: [
        {
          time: '2024-01-15',
          title: 'Project Started',
          description: 'Kickoff meeting and initial planning',
          variant: 'success',
          icon: '🚀',
        },
        {
          time: '2024-02-01',
          title: 'First Milestone',
          description: 'Completed initial design phase',
          variant: 'info',
          icon: '🎨',
        },
        {
          time: '2024-03-15',
          title: 'Beta Release',
          description: 'Released beta version to testers',
          variant: 'warning',
          icon: '⚡',
        },
        {
          time: '2024-04-01',
          title: 'Launch',
          description: 'Official product launch',
          variant: 'success',
          icon: '🎉',
        },
      ],
    },
    examples: {
      vertical: {
        variant: 'vertical',
        dateFormat: 'long',
        items: [
          {
            time: '2024-01-15',
            title: 'Project Started',
            description: 'Kickoff meeting and initial planning',
            variant: 'success',
          },
          {
            time: '2024-02-01',
            title: 'First Milestone',
            description: 'Completed initial design phase',
            variant: 'info',
          },
        ],
      },
      horizontal: {
        variant: 'horizontal',
        dateFormat: 'short',
        items: [
          {
            time: '2024-01-01',
            title: 'Q1',
            description: 'First quarter',
            variant: 'default',
          },
          {
            time: '2024-04-01',
            title: 'Q2',
            description: 'Second quarter',
            variant: 'info',
          },
          {
            time: '2024-07-01',
            title: 'Q3',
            description: 'Third quarter',
            variant: 'warning',
          },
          {
            time: '2024-10-01',
            title: 'Q4',
            description: 'Fourth quarter',
            variant: 'success',
          },
        ],
      },
      gantt: {
        variant: 'gantt',
        dateFormat: 'short',
        timeScale: 'month',
        rowLabel: 'Projects',
        items: [
          {
            label: 'Backend Development',
            items: [
              {
                title: 'API Design',
                startDate: '2024-01-01',
                endDate: '2024-01-31',
                variant: 'success',
              },
              {
                title: 'Implementation',
                startDate: '2024-02-01',
                endDate: '2024-03-31',
                variant: 'info',
              },
            ],
          },
          {
            label: 'Frontend Development',
            items: [
              {
                title: 'UI Design',
                startDate: '2024-01-15',
                endDate: '2024-02-15',
                variant: 'warning',
              },
              {
                title: 'Component Dev',
                startDate: '2024-02-15',
                endDate: '2024-04-15',
                variant: 'default',
              },
            ],
          },
          {
            label: 'Testing',
            items: [
              {
                title: 'QA Phase',
                startDate: '2024-03-01',
                endDate: '2024-04-30',
                variant: 'danger',
              },
            ],
          },
        ],
      },
    },
  }
);
