/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { AlertDialogSchema } from '@object-ui/types';
import { 
  AlertDialog, 
  AlertDialogTrigger, 
  AlertDialogContent, 
  AlertDialogHeader, 
  AlertDialogFooter, 
  AlertDialogTitle, 
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel
} from '../../ui';
import { renderChildren } from '../../lib/utils';

ComponentRegistry.register('alert-dialog', 
  ({ schema, className, ...props }: { schema: AlertDialogSchema; className?: string; [key: string]: any }) => (
    <AlertDialog defaultOpen={schema.defaultOpen} {...props}>
      <AlertDialogTrigger asChild>
        {renderChildren(schema.trigger)}
      </AlertDialogTrigger>
      <AlertDialogContent className={className}>
        <AlertDialogHeader>
          {schema.title && <AlertDialogTitle>{schema.title}</AlertDialogTitle>}
          {schema.description && <AlertDialogDescription>{schema.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {renderChildren(schema.content)}
        <AlertDialogFooter>
          {schema.cancelText && <AlertDialogCancel>{schema.cancelText}</AlertDialogCancel>}
          {schema.actionText && <AlertDialogAction onClick={schema.onAction}>{schema.actionText}</AlertDialogAction>}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
  {
    namespace: 'ui',
    label: 'Alert Dialog',
    inputs: [
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'cancelText', type: 'string' },
      { name: 'actionText', type: 'string' },
       { name: 'defaultOpen', type: 'boolean' },
      { 
        name: 'trigger', 
        type: 'slot'      },
       { 
        name: 'content', 
        type: 'slot'      },
      { name: 'className', type: 'string' }
    ],
    defaultProps: {
      title: 'Are you sure?',
      description: 'This action cannot be undone.',
      cancelText: 'Cancel',
      actionText: 'Continue',
      trigger: [{ type: 'button', label: 'Open Alert', variant: 'destructive' }]
    }
  }
);
