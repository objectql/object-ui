/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { ComboboxSchema } from '@object-ui/types';
import { Combobox } from '../../custom';

ComponentRegistry.register('combobox', 
  ({ schema, ...props }: { schema: ComboboxSchema; [key: string]: any }) => {
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style,
        ...comboboxProps
    } = props;
    
    return (
    <Combobox 
        options={schema.options || []}
        placeholder={schema.placeholder}
        value={schema.value}
        disabled={schema.disabled}
        className={schema.className} 
        {...comboboxProps}
        {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style }}
    />
  );
  },
  {
    label: 'Combobox',
    inputs: [
      { name: 'placeholder', type: 'string', label: 'Placeholder' },
      { name: 'value', type: 'string', label: 'Value' },
      { name: 'disabled', type: 'boolean', label: 'Disabled', defaultValue: false },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      placeholder: 'Select option...',
      options: []
    }
  }
);
