/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { TooltipSchema } from '@object-ui/types';
import { 
  TooltipProvider,
  Tooltip, 
  TooltipTrigger, 
  TooltipContent 
} from '../../ui';
import { renderChildren } from '../../lib/utils';

// Helper to ensure provider exists if not already present at app root
// For now assuming provider is at root or we just wrap it here.
// Wrapping here is safer for isolated usage.

ComponentRegistry.register('tooltip', 
  ({ schema, className, ...props }: { schema: TooltipSchema; className?: string; [key: string]: any }) => (
    <TooltipProvider delayDuration={schema.delayDuration}>
      <Tooltip {...props}>
        <TooltipTrigger asChild>
          {renderChildren(schema.trigger)}
        </TooltipTrigger>
        <TooltipContent side={schema.side} align={schema.align} className={className}>
           {(schema.content || renderChildren(schema.body)) as any}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
  {
    namespace: 'ui',
    label: 'Tooltip',
    inputs: [
      { name: 'delayDuration', type: 'number' },
      { name: 'side', type: 'enum', enum: ['top', 'right', 'bottom', 'left'] },
      { name: 'align', type: 'enum', enum: ['start', 'center', 'end'] },
      { 
        name: 'trigger', 
        type: 'slot', 
      },
      { 
        name: 'content', 
        type: 'string', 
      },
      { 
        name: 'body', 
        type: 'slot'      },
      { name: 'className', type: 'string' }
    ],
    defaultProps: {
      trigger: [{ type: 'button', label: 'Hover me', variant: 'outline' }],
      content: 'Tooltip content',
      delayDuration: 700,
      side: 'top'
    }
  }
);
