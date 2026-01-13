import { ComponentRegistry } from '@object-ui/core';
import { 
  TooltipProvider,
  Tooltip, 
  TooltipTrigger, 
  TooltipContent 
} from '@/ui';
import { renderChildren } from '../../lib/utils';

// Helper to ensure provider exists if not already present at app root
// For now assuming provider is at root or we just wrap it here.
// Wrapping here is safer for isolated usage.

ComponentRegistry.register('tooltip', 
  ({ schema, className, ...props }) => (
    <TooltipProvider delayDuration={schema.delayDuration}>
      <Tooltip {...props}>
        <TooltipTrigger asChild>
          {renderChildren(schema.trigger)}
        </TooltipTrigger>
        <TooltipContent side={schema.side} align={schema.align} className={className}>
           {schema.content || renderChildren(schema.body)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
  {
    label: 'Tooltip',
    inputs: [
      { name: 'delayDuration', type: 'number', label: 'Delay Duration', defaultValue: 700 },
      { name: 'side', type: 'enum', enum: ['top', 'right', 'bottom', 'left'], label: 'Side' },
      { name: 'align', type: 'enum', enum: ['start', 'center', 'end'], label: 'Align' },
      { 
        name: 'trigger', 
        type: 'slot', 
        label: 'Trigger',
      },
      { 
        name: 'content', 
        type: 'string', 
        label: 'Content Text', 
      },
      { 
        name: 'body', 
        type: 'slot', 
        label: 'Rich Content' 
      },
      { name: 'className', type: 'string', label: 'Content CSS Class' }
    ],
    defaultProps: {
      trigger: [{ type: 'button', label: 'Hover me', variant: 'outline' }],
      content: 'Tooltip content',
      delayDuration: 700,
      side: 'top'
    }
  }
);
