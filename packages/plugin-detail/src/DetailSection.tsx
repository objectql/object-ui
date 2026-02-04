/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn, Card, CardHeader, CardTitle, CardContent, Collapsible, CollapsibleTrigger, CollapsibleContent } from '@object-ui/components';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SchemaRenderer } from '@object-ui/react';
import type { DetailViewSection as DetailViewSectionType } from '@object-ui/types';

export interface DetailSectionProps {
  section: DetailViewSectionType;
  data?: any;
  className?: string;
}

export const DetailSection: React.FC<DetailSectionProps> = ({
  section,
  data,
  className,
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(section.defaultCollapsed ?? false);

  const renderField = (field: any) => {
    const value = data?.[field.name] ?? field.value;
    
    // If custom renderer provided
    if (field.render) {
      return <SchemaRenderer schema={field.render} data={{ ...data, value }} />;
    }

    // Calculate span class based on field.span value
    const spanClass = field.span === 1 ? 'col-span-1' :
                      field.span === 2 ? 'col-span-2' :
                      field.span === 3 ? 'col-span-3' :
                      field.span === 4 ? 'col-span-4' :
                      field.span === 5 ? 'col-span-5' :
                      field.span === 6 ? 'col-span-6' : '';

    // Default field rendering
    return (
      <div key={field.name} className={cn("space-y-1", spanClass)}>
        <div className="text-sm font-medium text-muted-foreground">
          {field.label || field.name}
        </div>
        <div className="text-sm">
          {value !== null && value !== undefined ? String(value) : '-'}
        </div>
      </div>
    );
  };

  const content = (
    <div 
      className={cn(
        "grid gap-4",
        section.columns === 1 ? "grid-cols-1" :
        section.columns === 2 ? "grid-cols-2" :
        section.columns === 3 ? "grid-cols-3" :
        "grid-cols-2 md:grid-cols-3"
      )}
    >
      {section.fields.map(renderField)}
    </div>
  );

  if (!section.collapsible) {
    return (
      <Card className={className}>
        {section.title && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {section.icon && <span className="text-muted-foreground">{section.icon}</span>}
              <span>{section.title}</span>
            </CardTitle>
            {section.description && (
              <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
            )}
          </CardHeader>
        )}
        <CardContent>
          {content}
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible
      open={!isCollapsed}
      onOpenChange={(open) => setIsCollapsed(!open)}
      className={className}
    >
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {section.icon && <span className="text-muted-foreground">{section.icon}</span>}
                <span>{section.title}</span>
              </div>
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CardTitle>
            {section.description && !isCollapsed && (
              <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            {content}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
