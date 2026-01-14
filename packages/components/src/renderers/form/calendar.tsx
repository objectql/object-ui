import { ComponentRegistry } from '@object-ui/core';
import type { CalendarSchema } from '@object-ui/types';
import { Calendar } from '@/ui';

ComponentRegistry.register('calendar', 
  ({ schema, className, ...props }: { schema: CalendarSchema; className?: string; [key: string]: any }) => (
    <Calendar
      mode={schema.mode || "single"}
      selected={schema.value || schema.defaultValue}
      className={className}
      {...props}
    />
  ),
  {
    label: 'Calendar',
    inputs: [
      { name: 'mode', type: 'enum', enum: ['default', 'single', 'multiple', 'range'], defaultValue: 'single', label: 'Mode' },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      mode: 'single',
      className: 'rounded-md border'
    }
  }
);
