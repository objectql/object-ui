/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { SelectSchema } from '@object-ui/types';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Label
} from '../../ui';
import { cn } from '../../lib/utils';
import { toControlValue, matchOptionValue } from './option-value';
import React from 'react';

const SelectRenderer = ({ schema, className, onChange, value, disabled: hostDisabled, ...props }: { schema: SelectSchema; className?: string; onChange?: (val: any) => void; value?: any; disabled?: boolean; [key: string]: any }) => {
  // `hostDisabled` is `SchemaRenderer`'s EVALUATED verdict on `disabled` /
  // `disabledOn`, not the raw authored key — which may be a predicate STRING,
  // truthy however it evaluates (objectui#7238, precedent objectui#6169).
  // Extract designer-related props
  const { 
      'data-obj-id': dataObjId, 
      'data-obj-type': dataObjType,
      style, 
      ...selectProps 
  } = props;

  // Map the control's string back to the AUTHORED option value (#3090): a
  // numeric/boolean option reaches the handler typed, not as "2".
  const handleValueChange = (newValue: string) => {
    if (onChange) {
      onChange(matchOptionValue(schema.options, newValue));
    }
  };

  return (
    <div 
        className={cn("grid w-full items-center gap-1.5", schema.wrapperClass)}
        data-obj-id={dataObjId}
        data-obj-type={dataObjType}
        style={style}
    >
      {schema.label && <Label className={cn(schema.required && "text-destructive after:content-['*'] after:ml-0.5")}>{schema.label}</Label>}
      <Select
        defaultValue={value === undefined ? toControlValue(schema.defaultValue) : undefined}
        value={toControlValue(value ?? schema.value)}
        onValueChange={handleValueChange}
        disabled={hostDisabled}
        required={schema.required}
        name={schema.name}
        {...selectProps}
      >
        <SelectTrigger className={className}>
          <SelectValue placeholder={schema.placeholder} />
        </SelectTrigger>
        <SelectContent>
          {schema.options?.map((opt) => (
             <SelectItem key={String(opt.value)} value={String(opt.value)} disabled={opt.disabled}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

ComponentRegistry.register('select', SelectRenderer,
  {
    namespace: 'ui',
    label: 'Select',
    inputs: [
      { name: 'label', type: 'string', label: 'Label' },
      { name: 'placeholder', type: 'string', label: 'Placeholder' },
      { name: 'defaultValue', type: 'string', label: 'Default Value' },
      { name: 'required', type: 'boolean', label: 'Required' },
      { name: 'disabled', type: 'boolean', label: 'Disabled' },
      { 
        name: 'options', 
        type: 'array', 
        label: 'Options',
        description: 'Array of {label, value} objects'
      }
    ],
    defaultProps: {
      label: 'Select an option',
      placeholder: 'Choose...',
      options: [
        { label: 'Option 1', value: 'option1' },
        { label: 'Option 2', value: 'option2' },
        { label: 'Option 3', value: 'option3' }
      ]
    }
  }
);
