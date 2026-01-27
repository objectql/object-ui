import React from 'react';
import { Input } from '@object-ui/components';
import { FieldWidgetProps } from './types';

export function LocationField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<any>) {
  // Location is stored as { latitude, longitude } object
  // For display, convert to "latitude, longitude" string format
  const displayValue = value && typeof value === 'object' 
    ? `${value.latitude || 0}, ${value.longitude || 0}`
    : '';

  if (readonly) {
    return <span className="text-sm">{displayValue || '-'}</span>;
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
      type="text"
      value={displayValue}
      onChange={handleChange}
      placeholder={field.placeholder || 'latitude, longitude'}
      disabled={readonly}
      className={props.className}
    />
  );
}
