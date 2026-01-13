import { ComponentRegistry } from '@object-ui/core';
import { Calendar, Button, Popover, PopoverTrigger, PopoverContent, Label } from '@/ui';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

ComponentRegistry.register('date-picker', 
  ({ schema, className, value, onChange, ...props }) => {
    const handleSelect = (date: Date | undefined) => {
      if (onChange) {
        onChange(date);
      }
    };

    return (
      <div className={`grid w-full max-w-sm items-center gap-1.5 ${schema.wrapperClass || ''}`}>
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
              {...props}
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
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  },
  {
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
