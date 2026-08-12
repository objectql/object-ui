/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import { renderChildren } from '../../lib/utils';
import { forwardRef } from 'react';

const tags = ['aside', 'main', 'header', 'nav', 'footer', 'section', 'article'] as const;

tags.forEach(tag => {
  // Index signature on the parameter annotation, not on the `forwardRef` type
  // argument — mechanism note on `action:bar` (objectui#4422), pinned by
  // `__tests__/forwardref-props-annotation.guard.test.ts`. This factory covers
  // seven semantic tags with no schema type of their own, so `schema` stays
  // `any`; the annotation is written like its siblings' so the guard needs no
  // per-file carve-out.
  const Component = forwardRef<HTMLElement, { schema: any; className?: string }>(({ schema, className, ...props }: { schema: any; className?: string; [key: string]: any }, ref) => {
      // Extract designer-related props
      const { 
          'data-obj-id': dataObjId, 
          'data-obj-type': dataObjType,
          style,
          ...restProps
      } = props;
      
      const Tag = tag;
      
      return (
      <Tag 
          ref={ref}
          className={className} 
          {...restProps}
          {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style }}
      >
        {renderChildren(schema.children || schema.body)}
      </Tag>
    );
  });
  Component.displayName = `Semantic${tag.charAt(0).toUpperCase() + tag.slice(1)}`;

  ComponentRegistry.register(tag, Component, {
      namespace: 'ui',
      label: tag.charAt(0).toUpperCase() + tag.slice(1),
      category: 'layout',
      inputs: [
        { name: 'className', type: 'string', label: 'CSS Class' }
      ]
  });
});
