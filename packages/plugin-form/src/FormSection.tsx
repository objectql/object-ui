/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * FormSection Component
 * 
 * A form section component that groups fields together with optional
 * collapsibility and multi-column layout. Aligns with @objectstack/spec FormSection.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@object-ui/components';
import { Card, CardContent, CardHeader } from '@object-ui/components';

export interface FormSectionProps {
  /**
   * Section title/label
   */
  label?: string;
  
  /**
   * Section description
   */
  description?: string;
  
  /**
   * Whether the section can be collapsed
   * @default false
   */
  collapsible?: boolean;
  
  /**
   * Whether the section is initially collapsed
   * @default false
   */
  collapsed?: boolean;
  
  /**
   * Number of columns for field layout
   * @default 1
   */
  columns?: 1 | 2 | 3 | 4;
  
  /**
   * Section children (form fields)
   */
  children: React.ReactNode;
  
  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Override the default responsive grid classes.
   * When provided, replaces the viewport-based grid-cols classes
   * (e.g. with container-query-based classes like `@md:grid-cols-2`).
   */
  gridClassName?: string;

  /**
   * Wrap the section in Card chrome (border + subtle background).
   * When `undefined`, defaults to `true` for sections with a `label`
   * (so titled sections feel like discrete cards) and `false` for
   * untitled fallback sections (so the form looks like one flat block).
   * Mirrors the same auto-default used by DetailSection on detail pages.
   */
  showBorder?: boolean;
}

/**
 * FormSection Component
 * 
 * Groups form fields with optional header, collapsibility, and multi-column layout.
 * 
 * @example
 * ```tsx
 * <FormSection label="Contact Details" columns={2} collapsible>
 *   <FormField name="firstName" />
 *   <FormField name="lastName" />
 * </FormSection>
 * ```
 */
export const FormSection: React.FC<FormSectionProps> = ({
  label,
  description,
  collapsible = false,
  collapsed: initialCollapsed = false,
  columns = 1,
  children,
  className,
  gridClassName,
  showBorder,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  const gridCols: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  const handleToggle = () => {
    if (collapsible) {
      setIsCollapsed(!isCollapsed);
    }
  };

  // Auto-default: titled sections render as Card; untitled sections stay flat.
  const wrapInCard = showBorder ?? Boolean(label);

  const headerNode = (label || description) ? (
    <div
      className={cn(
        'flex items-start gap-2',
        !wrapInCard && 'mb-4',
        collapsible && 'cursor-pointer select-none'
      )}
      onClick={handleToggle}
      role={collapsible ? 'button' : undefined}
      aria-expanded={collapsible ? !isCollapsed : undefined}
    >
      {collapsible && (
        <span className="mt-0.5 text-muted-foreground">
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </span>
      )}
      <div className="flex-1">
        {label && (
          <h3 className="text-sm font-semibold text-foreground">
            {label}
          </h3>
        )}
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">
            {description}
          </p>
        )}
      </div>
    </div>
  ) : null;

  const contentNode = !isCollapsed ? (
    <div className={cn('grid gap-4', gridClassName || gridCols[columns])}>
      {children}
    </div>
  ) : null;

  if (wrapInCard) {
    return (
      <Card className={cn('form-section bg-muted/40 shadow-none', className)}>
        {headerNode && <CardHeader className="border-b border-border pb-3">{headerNode}</CardHeader>}
        {contentNode && <CardContent className="pt-4">{contentNode}</CardContent>}
      </Card>
    );
  }

  return (
    <div className={cn('form-section', className)}>
      {headerNode}
      {contentNode}
    </div>
  );
};

export default FormSection;
