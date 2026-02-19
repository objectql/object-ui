/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { 
  cn, 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  Collapsible, 
  CollapsibleTrigger, 
  CollapsibleContent,
  Badge,
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@object-ui/components';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { SchemaRenderer } from '@object-ui/react';
import { getCellRenderer } from '@object-ui/fields';
import type { DetailViewSection as DetailViewSectionType, DetailViewField, FieldMetadata } from '@object-ui/types';
import { applyDetailAutoLayout } from './autoLayout';

export interface DetailSectionProps {
  section: DetailViewSectionType;
  data?: any;
  className?: string;
  /** Whether inline editing is active */
  isEditing?: boolean;
  /** Callback when a field value changes during inline editing */
  onFieldChange?: (field: string, value: any) => void;
}

export const DetailSection: React.FC<DetailSectionProps> = ({
  section,
  data,
  className,
  isEditing = false,
  onFieldChange,
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(section.defaultCollapsed ?? false);
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  const handleCopyField = React.useCallback((fieldName: string, value: any) => {
    const textValue = value !== null && value !== undefined ? String(value) : '';
    navigator.clipboard.writeText(textValue).then(() => {
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    });
  }, []);

  const renderField = (field: DetailViewField) => {
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

    const displayValue = (() => {
      if (value === null || value === undefined) return '-';
      // Use type-aware cell renderer when field.type is available
      if (field.type) {
        const CellRenderer = getCellRenderer(field.type);
        if (CellRenderer) {
          return <CellRenderer value={value} field={field as unknown as FieldMetadata} />;
        }
      }
      return String(value);
    })();
    const canCopy = value !== null && value !== undefined && value !== '';
    const isCopied = copiedField === field.name;

    // Default field rendering with copy button and touch-friendly targets
    return (
      <div key={field.name} className={cn("space-y-1.5 group", spanClass)}>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {field.label || field.name}
        </div>
        {isEditing && !field.readonly ? (
          <div className="min-h-[44px] sm:min-h-0">
            <input
              type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
              className="w-full px-2 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={value != null ? String(value) : ''}
              onChange={(e) => onFieldChange?.(field.name, e.target.value)}
            />
          </div>
        ) : (
        <div
          className={cn(
            "flex items-start justify-between gap-2 min-h-[44px] sm:min-h-0 rounded-md",
            canCopy && "cursor-pointer active:bg-muted/60 transition-colors"
          )}
          onClick={canCopy ? () => handleCopyField(field.name, value) : undefined}
          onKeyDown={canCopy ? (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleCopyField(field.name, value);
            }
          } : undefined}
          role={canCopy ? "button" : undefined}
          tabIndex={canCopy ? 0 : undefined}
        >
          <div className="text-sm flex-1 break-words py-1">
            {displayValue}
          </div>
          {canCopy && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyField(field.name, value);
                    }}
                  >
                    {isCopied ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isCopied ? 'Copied!' : 'Copy to clipboard'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        )}
      </div>
    );
  };

  // Apply auto-layout: infer columns and auto-span wide fields
  const { fields: layoutFields, columns: effectiveColumns } = applyDetailAutoLayout(
    section.fields,
    section.columns
  );

  const content = (
    <div 
      className={cn(
        "grid gap-3 sm:gap-4",
        effectiveColumns === 1 ? "grid-cols-1" :
        effectiveColumns === 2 ? "grid-cols-1 sm:grid-cols-2" :
        effectiveColumns === 3 ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3" :
        "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
      )}
    >
      {layoutFields.map(renderField)}
    </div>
  );

  if (!section.collapsible) {
    return (
      <Card className={cn(section.showBorder === false ? 'border-none shadow-none' : '', className)}>
        {section.title && (
          <CardHeader className={cn(section.headerColor && `bg-${section.headerColor}`)}>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {section.icon && <span className="text-muted-foreground">{section.icon}</span>}
                <span>{section.title}</span>
                {section.fields && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {section.fields.length}
                  </Badge>
                )}
              </div>
            </CardTitle>
            {section.description && (
              <p className="text-sm text-muted-foreground mt-1.5">{section.description}</p>
            )}
          </CardHeader>
        )}
        <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
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
          <CardHeader className={cn(
            "cursor-pointer hover:bg-muted/50 transition-colors",
            section.headerColor && `bg-${section.headerColor}`
          )}>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {section.icon && <span className="text-muted-foreground">{section.icon}</span>}
                <span>{section.title}</span>
                {section.fields && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {section.fields.length}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CardTitle>
            {section.description && !isCollapsed && (
              <p className="text-sm text-muted-foreground mt-1.5">{section.description}</p>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
            {content}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
