/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { TextareaSchema } from '@object-ui/types';
import { Textarea, Label } from '../../ui';
import { cn } from '../../lib/utils';
import { toFormControlDomProps } from '../../lib/form-control-dom-props';
import React from 'react';

const TextareaRenderer = ({ schema, className, onChange, value, disabled: hostDisabled, ...props }: { schema: TextareaSchema; className?: string; onChange?: (val: any) => void; value?: any; disabled?: boolean; [key: string]: any }) => {
  // `hostDisabled` is `SchemaRenderer`'s EVALUATED verdict on `disabled` /
  // `disabledOn`, not the raw authored key — which may be a predicate STRING,
  // truthy however it evaluates (objectui#7238, precedent objectui#6169).
  // Handle change for both raw inputs and form-bound inputs
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  // Extract designer-related props
  const { 
    'data-obj-id': dataObjId, 
    'data-obj-type': dataObjType,
    style, 
    ...inputProps 
  } = props;

  return (
    <div 
      className={cn("grid w-full gap-1.5", schema.wrapperClass)}
      data-obj-id={dataObjId}
      data-obj-type={dataObjType}
      style={style}
    >
      {schema.label && <Label htmlFor={schema.id} className={cn(schema.required && "text-destructive after:content-['*'] after:ml-0.5")}>{schema.label}</Label>}
      <Textarea 
        id={schema.id} 
        name={schema.name}
        placeholder={schema.placeholder} 
        className={className} 
        disabled={hostDisabled}
        readOnly={schema.readOnly}
        required={schema.required}
        rows={schema.rows}
        value={value ?? schema.value ?? ''}
        defaultValue={value === undefined ? schema.defaultValue : undefined}
        onChange={handleChange}
        {...toFormControlDomProps(inputProps)}
      />
    </div>
  );
};

ComponentRegistry.register('textarea', TextareaRenderer,
  {
    namespace: 'ui',
    label: 'Textarea',
    inputs: [
      { name: 'label', type: 'string', label: 'Label' },
      { name: 'placeholder', type: 'string', label: 'Placeholder' },
      { name: 'rows', type: 'number', label: 'Rows' },
      { name: 'required', type: 'boolean', label: 'Required' },
      { name: 'disabled', type: 'boolean', label: 'Disabled' },
      { name: 'id', type: 'string', label: 'ID', required: true }
    ],
    defaultProps: {
      label: 'Textarea label',
      placeholder: 'Enter text here...',
      rows: 3,
      id: 'textarea-field'
    }
  }
);
