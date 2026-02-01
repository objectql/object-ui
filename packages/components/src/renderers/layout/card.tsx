/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { CardSchema } from '@object-ui/types';
import { renderChildren, cn } from '../../lib/utils';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from '../../ui';
import { forwardRef } from 'react';

const CardRenderer = forwardRef<HTMLDivElement, { schema: CardSchema; className?: string; [key: string]: any }>(
  ({ schema, className, ...props }, ref) => {
    // Extract designer-related props
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style, 
        ...cardProps 
    } = props;
    
    const isClickable = schema.clickable || !!props.onClick;
    const isHoverable = schema.hoverable || isClickable;

    return (
    <Card 
        ref={ref}
        className={cn(
          className, 
          isHoverable && "transition-colors hover:bg-muted/50",
          isClickable && "cursor-pointer active:bg-muted"
        )} 
        {...cardProps}
        // Apply designer props
        {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style }}
    >
      {(schema.title || schema.description || schema.header) && (
        <CardHeader>
          {schema.title && <CardTitle>{schema.title}</CardTitle>}
          {schema.description && <CardDescription>{schema.description}</CardDescription>}
          {schema.header && renderChildren(schema.header)}
        </CardHeader>
      )}
      {(schema.children || schema.body) && <CardContent>{renderChildren(schema.children || schema.body)}</CardContent>}
      {schema.footer && <CardFooter className="flex justify-between">{renderChildren(schema.footer)}</CardFooter>}
    </Card>
    );
  }
);

ComponentRegistry.register('card', 
  CardRenderer,
  {
    namespace: 'ui',
    label: 'Card',
    inputs: [
      { name: 'title', type: 'string', label: 'Title' },
      { name: 'description', type: 'string', label: 'Description' },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      title: 'Card Title',
      description: 'Card description goes here',
      className: 'w-full'
    },
    isContainer: true,
    resizable: true,
    resizeConstraints: {
      width: true,
      height: true,
      minWidth: 200,
      minHeight: 100
    }
  }
);
