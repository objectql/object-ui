/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { AlertSchema } from '@object-ui/types';
import { renderChildren } from '../../lib/utils';
import {
  Alert,
  AlertTitle,
  AlertDescription
} from '../../ui';

ComponentRegistry.register('alert', 
  ({ schema, className, ...props }: { schema: AlertSchema; className?: string; [key: string]: any }) => (
    <Alert variant={schema.variant} className={className} {...props}>
      <AlertTitle>{schema.title}</AlertTitle>
      <AlertDescription>{schema.description || renderChildren(schema.body)}</AlertDescription>
    </Alert>
  ),
  {
    namespace: 'ui',
    label: 'Alert',
    inputs: [
      { name: 'title', type: 'string', required: true },
      { name: 'description', type: 'string' },
      { 
        name: 'variant', 
        type: 'enum', 
        enum: ['default', 'destructive']      },
      { name: 'className', type: 'string' }
    ],
    defaultProps: {
      title: 'Alert Title',
      description: 'This is an alert message.',
      variant: 'default'
    }
  }
);
