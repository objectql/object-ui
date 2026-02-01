/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { AspectRatioSchema } from '@object-ui/types';
import { AspectRatio } from '../../ui/aspect-ratio';
import { renderChildren } from '../../lib/utils';

ComponentRegistry.register('aspect-ratio', 
  ({ schema, ...props }: { schema: AspectRatioSchema; [key: string]: any }) => {
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style,
        ...aspectRatioProps
    } = props;
    
    return (
      <AspectRatio 
        ratio={schema.ratio || 16 / 9}
        className={schema.className} 
        {...aspectRatioProps}
        {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style }}
      >
        {schema.image ? (
          <img src={schema.image} alt={schema.alt || ''} className="rounded-md object-cover w-full h-full" />
        ) : (
          renderChildren(schema.children || schema.body)
        )}
      </AspectRatio>
    );
  },
  {
    namespace: 'ui',
    label: 'Aspect Ratio',
    inputs: [
      { name: 'ratio', type: 'number', label: 'Ratio', defaultValue: 16/9 },
      { name: 'image', type: 'string', label: 'Image URL' },
      { name: 'alt', type: 'string', label: 'Alt Text' },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      ratio: 16 / 9
    }
  }
);
