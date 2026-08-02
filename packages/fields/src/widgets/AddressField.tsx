import React from 'react';
import { Input, Label, EmptyValue } from '@object-ui/components';
import { FieldWidgetComponentProps } from './types';

/**
 * Address data structure
 */
export interface AddressValue {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

/**
 * Address field widget - provides a structured address input
 * Supports street, city, state, zip code, and country
 */
export function AddressField({ value, onChange, field, readonly, ...props }: FieldWidgetComponentProps<AddressValue>) {
  const address = value || {};

  const handleFieldChange = (fieldName: keyof AddressValue, fieldValue: string) => {
    onChange({
      ...address,
      [fieldName]: fieldValue,
    });
  };

  const formatAddress = (addr: AddressValue): string => {
    const parts = [
      addr.street,
      addr.city,
      [addr.state, addr.zipCode].filter(Boolean).join(' '),
      addr.country,
    ].filter(Boolean);
    return parts.join(', ');
  };

  if (readonly) {
    const formatted = formatAddress(address);
    return formatted ? <span className="text-sm">{formatted}</span> : <EmptyValue />;
  }

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="street" className="text-xs">Street Address</Label>
        <Input
          id="street"
          type="text"
          value={address.street || ''}
          onChange={(e) => handleFieldChange('street', e.target.value)}
          placeholder="123 Main St"
          disabled={readonly || props.disabled}
          className={props.className}
        />
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="city" className="text-xs">City</Label>
          <Input
            id="city"
            type="text"
            value={address.city || ''}
            onChange={(e) => handleFieldChange('city', e.target.value)}
            placeholder="San Francisco"
            disabled={readonly || props.disabled}
          />
        </div>
        
        <div>
          <Label htmlFor="state" className="text-xs">State / Province</Label>
          <Input
            id="state"
            type="text"
            value={address.state || ''}
            onChange={(e) => handleFieldChange('state', e.target.value)}
            placeholder="CA"
            disabled={readonly || props.disabled}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="zipCode" className="text-xs">ZIP / Postal Code</Label>
          <Input
            id="zipCode"
            type="text"
            value={address.zipCode || ''}
            onChange={(e) => handleFieldChange('zipCode', e.target.value)}
            placeholder="94102"
            disabled={readonly || props.disabled}
          />
        </div>
        
        <div>
          <Label htmlFor="country" className="text-xs">Country</Label>
          <Input
            id="country"
            type="text"
            value={address.country || ''}
            onChange={(e) => handleFieldChange('country', e.target.value)}
            placeholder="United States"
            disabled={readonly || props.disabled}
          />
        </div>
      </div>
    </div>
  );
}
