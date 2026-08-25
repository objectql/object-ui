import React from 'react';
import { Input, EmptyValue } from '@object-ui/components';
import type { LocationValue } from '@object-ui/types';
import { FieldWidgetComponentProps } from './types.js';
import { toDomProps } from './toDomProps.js';

/**
 * LocationField - Geographic coordinate input for latitude and longitude
 * Stores location as a `LocationValue` (`@object-ui/types`) -- the published
 * declaration of the `{ latitude, longitude }` shape this widget writes -- and
 * displays it as a comma-separated pair. The binding is `LocationValue | null`
 * because clearing the input emits `null` (see `handleChange` below).
 */
export function LocationField({ value, onChange, field, readonly, error, ...props }: FieldWidgetComponentProps<LocationValue | null>) {
  const config = field;
  // Location is stored as { latitude, longitude } object
  // For display, convert to "latitude, longitude" string format
  const displayValue = value && typeof value === 'object' 
    ? `${value.latitude || 0}, ${value.longitude || 0}`
    : '';

  if (readonly) {
    return <span className="text-sm">{displayValue || <EmptyValue />}</span>;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val.trim()) {
      onChange(null);
      return;
    }
    
    // Parse as coordinates (latitude, longitude)
    const parts = val.split(',').map(p => p.trim());
    if (parts.length === 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        onChange({ latitude: lat, longitude: lng });
      }
      // If invalid, don't update the value
    }
  };

  return (
    <Input
      // DOM pass-through onto the real focusable control (objectui#3318).
      {...toDomProps(props)}
      type="text"
      value={displayValue}
      onChange={handleChange}
      placeholder={config?.placeholder || 'latitude, longitude'}
      disabled={readonly || props.disabled}
      className={props.className}
      // AFTER the spread so this widget's own computation wins: `error` is
      // the published validation slot (#3222), `!!undefined` → explicit
      // "false".
      aria-invalid={!!error}
    />
  );
}
