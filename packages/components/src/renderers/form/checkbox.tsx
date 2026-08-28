/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { CheckboxSchema } from '@object-ui/types';
import { Checkbox, Label } from '../../ui';
import { cn } from '../../lib/utils';
import { toFormControlDomProps } from '../../lib/form-control-dom-props';
import React from 'react';

const CheckboxRenderer = ({ schema, className, onChange, value, ...props }: { schema: CheckboxSchema; className?: string; onChange?: (val: any) => void; value?: any; [key: string]: any }) => {
  // Extract designer-related props
  const { 
      'data-obj-id': dataObjId, 
      'data-obj-type': dataObjType,
      style, 
      ...checkboxProps 
  } = props;

  const handleCheckedChange = (checked: boolean) => {
    if (onChange) {
      onChange(checked);
    }
  };

  return (
    <div 
        className={cn("flex items-center space-x-2", schema.wrapperClass)}
        data-obj-id={dataObjId}
        data-obj-type={dataObjType}
        style={style}
    >
      <Checkbox 
        id={schema.id} 
        className={className} 
        checked={value ?? schema.checked ?? false}
        defaultChecked={value === undefined ? schema.defaultChecked : undefined}
        onCheckedChange={handleCheckedChange}
        disabled={schema.disabled}
        required={schema.required}
        name={schema.name}
        {...toFormControlDomProps(checkboxProps)}
      />
      <Label htmlFor={schema.id} className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", schema.required && "text-destructive after:content-['*'] after:ml-0.5")}>
        {schema.label}
      </Label>
    </div>
  );
};

ComponentRegistry.register('checkbox', CheckboxRenderer,
  {
    namespace: 'ui',
    label: 'Checkbox',
    inputs: [
      { name: 'label', type: 'string', label: 'Label', required: true },
      { name: 'id', type: 'string', label: 'ID', required: true },
      { name: 'checked', type: 'boolean', label: 'Checked' },
      { name: 'required', type: 'boolean', label: 'Required' },
      { name: 'disabled', type: 'boolean', label: 'Disabled' }
    ],
    defaultProps: {
      label: 'Checkbox label',
      id: 'checkbox-field'
    }
  }
);
