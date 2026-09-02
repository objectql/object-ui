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
import { toFormControlDomProps } from '../../lib/form-control-dom-props';

ComponentRegistry.register('combobox', 
  ({ schema, disabled: hostDisabled, ...props }: { schema: ComboboxSchema; disabled?: boolean; [key: string]: any }) => {
  // `hostDisabled` is `SchemaRenderer`'s EVALUATED verdict on `disabled` /
  // `disabledOn`, not the raw authored key — which may be a predicate STRING,
  // truthy however it evaluates (objectui#7238, precedent objectui#6169).
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
        disabled={hostDisabled}
        className={schema.className} 
        {...toFormControlDomProps(comboboxProps)}
        {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style }}
    />
  );
  },
  {
    namespace: 'ui',
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
