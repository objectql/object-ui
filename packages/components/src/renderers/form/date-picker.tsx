/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { DatePickerSchema } from '@object-ui/types';
import { Calendar, Button, Popover, PopoverTrigger, PopoverContent, Label } from '../../ui';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import { toFormControlDomProps } from '../../lib/form-control-dom-props';

ComponentRegistry.register('date-picker', 
  ({ schema, className, value, onChange, ...props }: { schema: DatePickerSchema; className?: string; value?: Date; onChange?: (date: Date | undefined) => void; [key: string]: any }) => {
    const handleSelect = (date: Date | undefined) => {
      if (onChange) {
        onChange(date);
      }
    };

    // Extract designer-related props
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style, 
        ...triggerProps 
    } = props;

    return (
      <div 
        className={`grid w-full max-w-sm items-center gap-1.5 ${schema.wrapperClass || ''}`}
        data-obj-id={dataObjId}
        data-obj-type={dataObjType}
        style={style}
      >
        {schema.label && <Label htmlFor={schema.id}>{schema.label}</Label>}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id={schema.id}
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !value && 'text-muted-foreground',
                className
              )}
              {...toFormControlDomProps(triggerProps)}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {value ? format(value, schema.format || 'PPP') : <span>{schema.placeholder || 'Pick a date'}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={value}
              onSelect={handleSelect}
              autoFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  },
  {
    namespace: 'ui',
    label: 'Date Picker',
    inputs: [
      { name: 'label', type: 'string', label: 'Label' },
      { name: 'placeholder', type: 'string', label: 'Placeholder' },
      { name: 'format', type: 'string', label: 'Date Format', description: 'date-fns format string (e.g., "PPP", "yyyy-MM-dd")' },
      { name: 'id', type: 'string', label: 'ID', required: true }
    ],
    defaultProps: {
      label: 'Date',
      placeholder: 'Pick a date',
      format: 'PPP',
      id: 'date-picker-field'
    }
  }
);
