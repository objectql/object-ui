/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn, Card, CardContent } from '@object-ui/components';
import type { HighlightField } from '@object-ui/types';
import { useSafeFieldLabel } from '@object-ui/react';

export interface HeaderHighlightProps {
  fields: HighlightField[];
  data?: any;
  className?: string;
  /** Object name for i18n field label resolution */
  objectName?: string;
}

export const HeaderHighlight: React.FC<HeaderHighlightProps> = ({
  fields,
  data,
  className,
  objectName,
}) => {
  const { fieldLabel } = useSafeFieldLabel();
  if (!fields.length || !data) return null;

  // Filter to only fields with values
  const visibleFields = fields.filter((f) => {
    const val = data?.[f.name];
    return val !== null && val !== undefined && val !== '';
  });

  if (visibleFields.length === 0) return null;

  return (
    <Card className={cn('bg-muted/30 border-dashed', className)}>
      <CardContent className="py-3 px-4">
        <div className={cn(
          'grid gap-4',
          visibleFields.length === 1 ? 'grid-cols-1' :
          visibleFields.length === 2 ? 'grid-cols-2' :
          visibleFields.length === 3 ? 'grid-cols-3' :
          'grid-cols-2 md:grid-cols-4'
        )}>
          {visibleFields.map((field) => {
            const value = data[field.name];
            return (
              <div key={field.name} className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {field.icon && <span className="mr-1">{field.icon}</span>}
                  {fieldLabel(objectName || '', field.name, field.label)}
                </span>
                <span className="text-sm font-semibold truncate">
                  {String(value)}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
