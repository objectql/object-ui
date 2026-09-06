/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { BadgeSchema } from '@object-ui/types';
import { Badge } from '../../ui';
import { renderChildren } from '../../lib/utils';

ComponentRegistry.register('badge', 
  ({ schema, ...props }: { schema: BadgeSchema; [key: string]: any }) => {
    // Extract designer-related props
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style,
        ...badgeProps
    } = props;
    
    return (
    <Badge 
        variant={schema.variant} 
        className={schema.className} 
        {...badgeProps}
        // Apply designer props
        {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style }}
    >
      {schema.label || renderChildren(schema.body)}
    </Badge>
  );
  },
  {
    namespace: 'ui',
    label: 'Badge',
    inputs: [
      { name: 'label', type: 'string' },
      { 
        name: 'variant', 
        type: 'enum', 
        enum: ['default', 'secondary', 'destructive', 'outline']      },
      { name: 'className', type: 'string' }
    ],
    defaultProps: {
      label: 'Badge',
      variant: 'default'
    }
  }
);
