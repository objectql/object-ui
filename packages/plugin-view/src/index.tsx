/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { ObjectView } from './ObjectView';

export { ObjectView };
export type { ObjectViewProps } from './ObjectView';

// Register object-view component
const ObjectViewRenderer: React.FC<{ schema: any }> = ({ schema }) => {
  return <ObjectView schema={schema} dataSource={null as any} />;
};

ComponentRegistry.register('object-view', ObjectViewRenderer, {
  namespace: 'plugin-view'
});

// Simple View Renderer (Container)
const SimpleViewRenderer: React.FC<any> = ({ schema, className, children, ...props }) => {
  // If columns prop is present, use grid layout
  const style = schema.props?.columns 
    ? { display: 'grid', gridTemplateColumns: `repeat(${schema.props.columns}, 1fr)`, gap: '1rem' }
    : undefined;

  return (
    <div 
      className={className} 
      style={style}
      {...props}
    >
      {children}
    </div>
  );
};

ComponentRegistry.register('view:simple', SimpleViewRenderer, {
  namespace: 'plugin-view',
  label: 'Simple View',
  category: 'view'
});
