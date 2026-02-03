/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DashboardSchema, DashboardWidgetSchema } from '@object-ui/types';
import { SchemaRenderer } from '@object-ui/react';
import { cn } from '@object-ui/components';
import { forwardRef } from 'react';

export const DashboardRenderer = forwardRef<HTMLDivElement, { schema: DashboardSchema; className?: string; [key: string]: any }>(
  ({ schema, className, ...props }, ref) => {
    const columns = schema.columns || 3;
    const gap = schema.gap || 4;

    // Use style to convert gap number to pixels or use tailwind classes if possible
    // Here using inline style for grid gap which maps to 0.25rem * 4 * gap = gap rem
    
    return (
      <div 
        ref={ref} 
        className={cn("grid", className)} 
        style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gap: `${gap * 0.25}rem`
        }}
        {...props}
      >
        {schema.widgets?.map((widget: DashboardWidgetSchema) => (
            <div 
                key={widget.id} 
                className={cn("border rounded-lg p-4 bg-card text-card-foreground shadow-sm")}
                style={widget.layout ? {
                    gridColumn: `span ${widget.layout.w}`,
                    gridRow: `span ${widget.layout.h}`
                }: undefined}
            >
                {widget.title && <h3 className="font-semibold mb-2">{widget.title}</h3>}
                <SchemaRenderer schema={widget.component} />
            </div>
        ))}
      </div>
    );
  }
);
