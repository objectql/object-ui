import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import type { HtmlSchema } from '@object-ui/types';
import { cn } from '@/lib/utils';

ComponentRegistry.register('html', 
  ({ schema, className, ...props }: { schema: HtmlSchema; className?: string; [key: string]: any }) => (
    <div 
      className={cn("prose prose-sm max-w-none dark:prose-invert", className)} 
      dangerouslySetInnerHTML={{ __html: schema.html }}
      {...props}
    />
  ),
  {
    label: 'HTML Content',
    inputs: [
      { name: 'html', type: 'string', label: 'HTML', component: 'code-editor' }
    ]
  }
);
