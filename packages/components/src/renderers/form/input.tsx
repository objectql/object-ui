/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import type { InputSchema } from '@object-ui/types';
import { Input, Label } from '../../ui';
import { cn } from '../../lib/utils';
import { toFormControlDomProps } from '../../lib/form-control-dom-props';

const InputRenderer = ({ schema, className, onChange, value, ...props }: { schema: InputSchema; className?: string; onChange?: (val: any) => void; value?: any; [key: string]: any }) => {
  // Handle change for both raw inputs and form-bound inputs
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  // Extract designer-related props to apply to the wrapper
  // These props are injected by SchemaRenderer for designer interaction
  const { 
    'data-obj-id': dataObjId, 
    'data-obj-type': dataObjType,
    style, 
    ...inputProps 
  } = props;

  return (
    <div 
      className={cn("grid w-full items-center gap-1.5", schema.wrapperClass)}
      data-obj-id={dataObjId}
      data-obj-type={dataObjType}
      style={style}
    >
      {schema.label && <Label htmlFor={schema.id} className={cn(schema.required && "text-destructive after:content-['*'] after:ml-0.5")}>{schema.label}</Label>}
      <Input 
        type={schema.inputType || 'text'} 
        id={schema.id} 
        name={schema.name}
        placeholder={schema.placeholder} 
        className={className}
        required={schema.required}
        disabled={schema.disabled}
        readOnly={schema.readOnly}
        value={value ?? schema.value ?? ''} // Controlled if value provided
        defaultValue={value === undefined ? schema.defaultValue : undefined}
        onChange={handleChange}
        min={schema.min}
        max={schema.max}
        step={schema.step}
        maxLength={schema.maxLength}
        pattern={schema.pattern}
        {...toFormControlDomProps(inputProps)}
      />
      {schema.description && <p className="text-sm text-muted-foreground">{schema.description}</p>}
      {schema.error && <p className="text-sm font-medium text-destructive">{schema.error}</p>}
    </div>
  );
};

ComponentRegistry.register('input', InputRenderer, {
    namespace: 'ui',
    label: 'Input Field',
    inputs: [
      { name: 'label', type: 'string', label: 'Label' },
      { name: 'name', type: 'string', label: 'Field Name' },
      { name: 'placeholder', type: 'string', label: 'Placeholder' },
      { 
        name: 'inputType', 
        type: 'enum', 
        label: 'Type',
        enum: ['text', 'email', 'password', 'number', 'tel', 'url', 'date', 'time', 'datetime-local'],
        defaultValue: 'text'
      },
      { name: 'required', type: 'boolean', label: 'Required' },
      { name: 'disabled', type: 'boolean', label: 'Disabled' },
      { name: 'description', type: 'string', label: 'Description' }
    ],
    defaultProps: {
      inputType: 'text'
    }
  }
);

ComponentRegistry.register('email', 
  (props: any) => <InputRenderer {...props} schema={{ ...props.schema, inputType: 'email' }} />,
  {
    namespace: 'ui',
    label: 'Email Input',
    icon: 'mail', 
    inputs: [
      { name: 'label', type: 'string', label: 'Label' },
      { name: 'name', type: 'string', label: 'Field Name' },
      { name: 'placeholder', type: 'string', label: 'Placeholder' },
      { name: 'required', type: 'boolean', label: 'Required' },
      { name: 'disabled', type: 'boolean', label: 'Disabled' },
      { name: 'description', type: 'string', label: 'Description' }
    ]
  }
);

ComponentRegistry.register('password', 
  (props: any) => <InputRenderer {...props} schema={{ ...props.schema, inputType: 'password' }} />,
  {
    namespace: 'ui',
    label: 'Password Input',
    icon: 'lock',
    inputs: [
      { name: 'label', type: 'string', label: 'Label' },
      { name: 'name', type: 'string', label: 'Field Name' },
      { name: 'placeholder', type: 'string', label: 'Placeholder' },
      { name: 'required', type: 'boolean', label: 'Required' },
      { name: 'disabled', type: 'boolean', label: 'Disabled' },
      { name: 'description', type: 'string', label: 'Description' }
    ]
  }
);
