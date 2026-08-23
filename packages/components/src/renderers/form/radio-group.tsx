/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { RadioGroupSchema } from '@object-ui/types';
import { RadioGroup, RadioGroupItem, Label } from '../../ui';
import { toControlValue } from './option-value';
import { toFormControlDomProps } from '../../lib/form-control-dom-props';

ComponentRegistry.register('radio-group', 
  ({ schema, className, ...props }: { schema: RadioGroupSchema; className?: string; [key: string]: any }) => {
    // Extract designer-related props
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style, 
        ...radioProps 
    } = props;

    return (
    // Radix speaks strings — stringify authored (possibly numeric) values for
    // the control; ids stay stable via the same stringification (#3090).
    <RadioGroup
        defaultValue={toControlValue(schema.defaultValue)}
        className={className}
        {...toFormControlDomProps(radioProps)}
        // Apply designer props to the root element
        {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style }}
    >
      {schema.options?.map((item) => (
        <div key={String(item.value)} className="flex items-center space-x-2">
          <RadioGroupItem value={String(item.value)} id={`${schema.id}-${String(item.value)}`} />
          <Label htmlFor={`${schema.id}-${String(item.value)}`}>{item.label}</Label>
        </div>
      ))}
    </RadioGroup>
  );
  },
  {
    namespace: 'ui',
    label: 'Radio Group',
    inputs: [
      { name: 'defaultValue', type: 'string', label: 'Default Value' },
      { name: 'id', type: 'string', label: 'Group ID', required: true },
      { 
        name: 'options', 
        type: 'array', 
        label: 'Options',
        description: 'Array of {label, value} objects'
      },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      id: 'radio-group', // Will be made unique by designer's ensureNodeIds
      options: [
        { label: 'Option 1', value: 'option1' },
        { label: 'Option 2', value: 'option2' },
        { label: 'Option 3', value: 'option3' }
      ]
    }
  }
);
