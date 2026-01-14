import { ComponentRegistry } from '@object-ui/core';
import type { LoadingSchema } from '@object-ui/types';
import { Spinner } from '@/ui';
import { cn } from '@/lib/utils';

ComponentRegistry.register('loading', 
  ({ schema, className, ...props }: { schema: LoadingSchema; className?: string; [key: string]: any }) => {
    const size = schema.size || 'md';
    const fullscreen = schema.fullscreen || false;
    
    const loadingContent = (
      <div className={cn('flex flex-col items-center justify-center gap-2', className)}>
        <Spinner 
          className={cn(
            size === 'sm' && 'h-4 w-4',
            size === 'md' && 'h-8 w-8',
            size === 'lg' && 'h-12 w-12',
            size === ('xl' as any) && 'h-16 w-16'
          )}
        />
        {schema.text && (
          <p className="text-sm text-muted-foreground">{schema.text}</p>
        )}
      </div>
    );

    if (fullscreen) {
      return (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          {...props}
        >
          {loadingContent}
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center p-8" {...props}>
        {loadingContent}
      </div>
    );
  },
  {
    label: 'Loading',
    inputs: [
      { name: 'text', type: 'string', label: 'Loading Text' },
      { 
        name: 'size', 
        type: 'enum', 
        enum: ['sm', 'md', 'lg', 'xl'],
        label: 'Size',
        defaultValue: 'md'
      },
      { 
        name: 'fullscreen', 
        type: 'boolean', 
        label: 'Fullscreen Overlay', 
        defaultValue: false
      },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      text: 'Loading...',
      size: 'md',
      fullscreen: false
    }
  }
);
