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

  return (
    <div className={cn('form-section', className)}>
      {/* Section Header */}
      {(label || description) && (
        <div
          className={cn(
            'flex items-start gap-2 mb-4',
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
              <h3 className="text-base font-semibold text-foreground">
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
      )}

      {/* Section Content */}
      {!isCollapsed && (
        <div className={cn('grid gap-4', gridCols[columns])}>
          {children}
        </div>
      )}
    </div>
  );
};

export default FormSection;
