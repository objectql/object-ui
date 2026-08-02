import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@object-ui/components';
import { FieldWidgetComponentProps } from './types';

/**
 * Rating field widget - provides a star rating input
 * Supports numeric values from 0 to max (default 5)
 */
export function RatingField({ value, onChange, field, readonly, className, ...props }: FieldWidgetComponentProps<number>) {
  // Get rating-specific configuration from field metadata
  const ratingField = (field || (props as any).schema) as any;
  const max = ratingField?.max ?? 5;
  const currentValue = value ?? 0;

  const [hoverValue, setHoverValue] = React.useState<number | null>(null);

  const displayValue = hoverValue !== null ? hoverValue : currentValue;

  if (readonly) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        {Array.from({ length: max }, (_, i) => (
          <Star
            key={i}
            className={`w-5 h-5 ${
              i < currentValue
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground'
            }`}
          />
        ))}
        <span className="ml-2 text-sm text-muted-foreground">
          {currentValue} / {max}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i + 1)}
          onMouseEnter={() => setHoverValue(i + 1)}
          onMouseLeave={() => setHoverValue(null)}
          className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
          disabled={readonly || props.disabled}
        >
          <Star
            className={`w-5 h-5 transition-colors ${
              i < displayValue
                ? 'fill-yellow-400 text-yellow-400 hover:fill-yellow-500 hover:text-yellow-500'
                : 'text-muted-foreground hover:text-yellow-400'
            }`}
          />
        </button>
      ))}
      <span className="ml-2 text-sm text-muted-foreground">
        {currentValue} / {max}
      </span>
    </div>
  );
}
