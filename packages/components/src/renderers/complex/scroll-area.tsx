/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { ScrollAreaSchema } from '@object-ui/types';
import { ScrollArea, ScrollBar } from '../../ui';
import { renderChildren } from '../../lib/utils';

ComponentRegistry.register('scroll-area', 
  ({ schema, className, ...props }: { schema: ScrollAreaSchema; className?: string; [key: string]: any }) => {
    // Extract designer-related props
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style, 
        ...scrollAreaProps 
    } = props;

    const orientation = schema.orientation || 'vertical';

    return (
    <ScrollArea 
        className={className} 
        style={{ height: schema.height, width: schema.width, ...style }} 
        {...scrollAreaProps}
        data-obj-id={dataObjId}
        data-obj-type={dataObjType}
    >
      {renderChildren(schema.children)}
      {(orientation === 'horizontal' || orientation === 'both') && <ScrollBar orientation="horizontal" />}
      {(orientation === 'vertical' || orientation === 'both') && <ScrollBar orientation="vertical" />}
    </ScrollArea>
  )},
  {
    namespace: 'ui',
    label: 'Scroll Area',
    inputs: [
      { name: 'height', type: 'string', label: 'Height (e.g. 200px)' },
      { name: 'width', type: 'string', label: 'Width' },
      { name: 'orientation', type: 'enum', enum: ['vertical', 'horizontal', 'both'], defaultValue: 'vertical', label: 'Orientation' },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      height: '200px',
      width: '100%',
      orientation: 'vertical',
      children: [
        { type: 'div', className: 'p-4', body: [{ type: 'text', content: 'Scrollable content goes here. Add more content to see scrolling behavior.' }] }
      ],
      className: 'rounded-md border'
    }
  }
);
