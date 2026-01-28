/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { ToggleSchema } from '@object-ui/types';
import { Toggle } from '../../ui';
import { renderChildren } from '../../lib/utils';

ComponentRegistry.register('toggle', 
  ({ schema, ...props }: { schema: ToggleSchema; [key: string]: any }) => (
    <Toggle 
      variant={schema.variant} 
      size={schema.size} 
      pressed={schema.pressed}
      aria-label={schema.ariaLabel}
      {...props}
    >
      {schema.label || renderChildren(schema.children)}
    </Toggle>
  ),
  {
    label: 'Toggle',
    inputs: [
      { name: 'label', type: 'string', label: 'Label' },
      { name: 'pressed', type: 'boolean', label: 'Pressed' },
      { name: 'variant', type: 'enum', enum: ['default', 'outline'], defaultValue: 'default', label: 'Variant' },
      { name: 'size', type: 'enum', enum: ['default', 'sm', 'lg'], defaultValue: 'default', label: 'Size' },
      { name: 'ariaLabel', type: 'string', label: 'Aria Label' }
    ],
    defaultProps: {
      label: 'Toggle',
      variant: 'default',
      size: 'default'
    }
  }
);
