/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { CollapsibleSchema } from '@object-ui/types';
import { 
  Collapsible, 
  CollapsibleTrigger, 
  CollapsibleContent 
} from '../../ui';
import { renderChildren } from '../../lib/utils';

ComponentRegistry.register('collapsible', 
  // `hostDisabled` is `SchemaRenderer`'s EVALUATED verdict on `disabled` /
  // `disabledOn`, not the raw authored key — which may be a predicate STRING,
  // truthy however it evaluates (objectui#7238, precedent objectui#6169).
  ({ schema, className, disabled: hostDisabled, ...props }: { schema: CollapsibleSchema; className?: string; disabled?: boolean; [key: string]: any }) => (
    <Collapsible defaultOpen={schema.defaultOpen} disabled={hostDisabled} className={className} {...props}>
       <CollapsibleTrigger asChild>
         {renderChildren(schema.trigger)}
       </CollapsibleTrigger>
       <CollapsibleContent>
         {renderChildren(schema.content)}
       </CollapsibleContent>
    </Collapsible>
  ),
  {
    namespace: 'ui',
    label: 'Collapsible',
    inputs: [
      { name: 'defaultOpen', type: 'boolean', label: 'Default Open' },
      { name: 'disabled', type: 'boolean', label: 'Disabled' },
       { 
        name: 'trigger', 
        type: 'slot', 
        label: 'Trigger' 
      },
      { 
        name: 'content', 
        type: 'slot', 
        label: 'Content' 
      },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      trigger: [{ type: 'button', label: 'Toggle', variant: 'outline' }],
      content: [{ type: 'text', content: 'Collapsible content goes here' }],
      className: 'w-full'
    }
  }
);
