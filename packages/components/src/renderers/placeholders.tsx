/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { cn } from '../lib/utils';
import { Box, FileQuestion } from 'lucide-react';

export const PlaceholderRenderer = ({ schema, className }: any) => {
  const type = schema.type;
  const isView = type.startsWith('view:');
  const isWidget = type.startsWith('widget:');
  const isField = type.startsWith('field:');

  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-muted/30 transition-colors hover:bg-muted/50",
      isView && "border-blue-300 bg-blue-50/50 min-h-[200px]",
      isWidget && "border-purple-300 bg-purple-50/50 min-h-[150px]",
      isField && "border-yellow-300 bg-yellow-50/50 p-2 min-h-[40px] flex-row gap-2 justify-start",
      className
    )}>
      <div className={cn("flex items-center gap-2 text-muted-foreground", isField && "text-sm")}>
        {isField ? <Box className="h-4 w-4" /> : <FileQuestion className="h-8 w-8 mb-2 opacity-50" />}
        <div className="flex flex-col items-center text-center">
             <span className="font-mono font-medium text-foreground">{type}</span>
             {!isField && <span className="text-xs">Component Placeholder</span>}
        </div>
      </div>
      {schema.props && !isField && (
        <div className="mt-4 w-full text-xs text-muted-foreground bg-background/50 p-2 rounded overflow-hidden">
            <div className="opacity-70">Properties:</div>
            <pre className="mt-1 truncate">{JSON.stringify(schema.props, null, 0)}</pre>
        </div>
      )}
    </div>
  );
};

// List of all protocol-defined components that need placeholders
const PROTOCOL_COMPONENTS = [
  // 1. Views (List)
  'view:grid', 'view:kanban', 'view:map', 'view:calendar', 'view:gantt', 
  'view:timeline', 'view:gallery',
  
  // 2. Views (Form)
  'view:simple', 'view:wizard', 'view:tabbed', 'view:drawer', 'view:modal', 'view:split',

  // 3. Fields (Textual)
  'field:text', 'field:textarea', 'field:password', 'field:email', 'field:url', 'field:phone',
  
  // 4. Fields (Rich)
  'field:markdown', 'field:html', 'field:code',

  // 5. Fields (Numeric)
  'field:number', 'field:currency', 'field:percent', 'field:slider',

  // 6. Fields (Selection)
  'field:boolean', 'field:checkboxes', 'field:select', 'field:multiselect', 'field:radio',

  // 7. Fields (Date/Time)
  'field:date', 'field:datetime', 'field:time', 'field:duration',

  // 8. Fields (Relational)
  'field:lookup', 'field:master_detail', 'field:tree',

  // 9. Fields (Media)
  'field:image', 'field:file', 'field:video', 'field:audio', 'field:avatar',

  // 10. Fields (Visual)
  'field:color', 'field:rating', 'field:signature', 'field:qrcode', 'field:progress',

  // 11. Fields (Structure)
  'field:json', 'field:address', 'field:location',

  // 12. Page Components
  'page:header', 'page-header', // Added headers
  'page:footer', 'page:tabs', 'page:accordion', 'page:card', 'page:sidebar',
  'record:details', 'record:highlights', 'record:related_list', 'record:activity', 
  'record:chatter', 'record:path',
  'app:launcher', 'nav:menu', 'nav:breadcrumb',
  'global:search', 'global:notifications', 'user:profile',

  // 13. Dashboard Widgets
  'widget:metric', 'widget:bar', 'widget:line', 'widget:pie', 'widget:funnel', 
  'widget:radar', 'widget:scatter', 'widget:heatmap', 'widget:pivot', 'widget:table', 'widget:text', 'widget:image',

  // 14. Smart Actions (implemented in ./action/)
  // 'action:button', 'action:group', 'action:menu', 'action:icon',

  // 15. AI
  'ai:chat_window', 'ai:input', 'ai:suggestion', 'ai:feedback'
];

export function registerPlaceholders() {
    PROTOCOL_COMPONENTS.forEach(type => {
        // Only register if not already registered (to avoid overwriting real implementations)
        if (!ComponentRegistry.get(type)) {
            ComponentRegistry.register(type, PlaceholderRenderer);
        }
    });
}
