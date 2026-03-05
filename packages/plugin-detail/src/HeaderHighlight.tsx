/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn, Card, CardContent, Badge } from '@object-ui/components';
import type { HighlightField } from '@object-ui/types';
import { formatCurrency, formatPercent, formatDate, formatDateTime, humanizeLabel } from '@object-ui/fields';
import { useSafeFieldLabel } from '@object-ui/react';

/**
 * Coerce any value to a safe primitive string.
 * Handles MongoDB types ($numberDecimal, $oid), expanded references, arrays, etc.
 */
function toSafeString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((v) => {
      if (v != null && typeof v === 'object') {
        const obj = v as Record<string, unknown>;
        return obj.name || obj.label || obj._id || '[Object]';
      }
      return String(v);
    }).join(', ');
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return String(obj.name || obj.label || obj._id || '[Object]');
  }
  return String(value);
}

/**
 * Semantic color mapping for select/status badge auto-coloring.
 */
const SEMANTIC_COLOR_MAP: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-300',
  urgent: 'bg-red-100 text-red-800 border-red-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  normal: 'bg-blue-100 text-blue-800 border-blue-300',
  low: 'bg-gray-100 text-gray-800 border-gray-300',
  paid: 'bg-green-100 text-green-800 border-green-300',
  completed: 'bg-green-100 text-green-800 border-green-300',
  done: 'bg-green-100 text-green-800 border-green-300',
  active: 'bg-green-100 text-green-800 border-green-300',
  approved: 'bg-green-100 text-green-800 border-green-300',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-300',
  open: 'bg-blue-100 text-blue-800 border-blue-300',
  draft: 'bg-gray-100 text-gray-800 border-gray-300',
  new: 'bg-gray-100 text-gray-800 border-gray-300',
  closed: 'bg-gray-100 text-gray-800 border-gray-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
  rejected: 'bg-red-100 text-red-800 border-red-300',
  failed: 'bg-red-100 text-red-800 border-red-300',
};

/** Map named colors to full Tailwind class strings (JIT-safe, no template interpolation) */
const COLOR_CLASS_MAP: Record<string, string> = {
  gray: 'bg-gray-100 text-gray-800 border-gray-300',
  red: 'bg-red-100 text-red-800 border-red-300',
  orange: 'bg-orange-100 text-orange-800 border-orange-300',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  green: 'bg-green-100 text-green-800 border-green-300',
  blue: 'bg-blue-100 text-blue-800 border-blue-300',
  indigo: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  purple: 'bg-purple-100 text-purple-800 border-purple-300',
  pink: 'bg-pink-100 text-pink-800 border-pink-300',
};

function getSemanticBadgeClasses(val: string): string {
  const key = val.toLowerCase().replace(/[\s-]/g, '_');
  return SEMANTIC_COLOR_MAP[key] || 'bg-muted text-muted-foreground border-border';
}

export interface HeaderHighlightProps {
  fields: HighlightField[];
  data?: any;
  className?: string;
  /** Object name for i18n field label resolution */
  objectName?: string;
  /** Object schema for field metadata enrichment */
  objectSchema?: any;
}

export const HeaderHighlight: React.FC<HeaderHighlightProps> = ({
  fields,
  data,
  className,
  objectName,
  objectSchema,
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
            // Resolve field metadata from objectSchema
            const objectDefField = objectSchema?.fields?.[field.name];
            const resolvedType = field.type || objectDefField?.type;
            const options: Array<{ value: string; label: string; color?: string }> =
              objectDefField?.options || (field as any).options || [];
            const currency: string = objectDefField?.currency || (field as any).currency || 'USD';
            const precision: number = objectDefField?.precision ?? (field as any).precision ?? 0;

            // Format the value as a safe string based on field type.
            // Uses direct formatting functions instead of CellRenderers
            // to guarantee only primitives reach JSX (prevents React error #310).
            let displayNode: React.ReactNode;

            switch (resolvedType) {
              case 'currency': {
                const num = Number(toSafeString(value));
                displayNode = isNaN(num) ? toSafeString(value) : formatCurrency(num, currency);
                break;
              }
              case 'number': {
                const num = Number(toSafeString(value));
                displayNode = isNaN(num) ? toSafeString(value) : new Intl.NumberFormat('en-US', {
                  minimumFractionDigits: precision,
                  maximumFractionDigits: precision,
                }).format(num);
                break;
              }
              case 'percent': {
                const num = Number(toSafeString(value));
                displayNode = isNaN(num) ? toSafeString(value) : formatPercent(num, precision);
                break;
              }
              case 'date':
                displayNode = formatDate(toSafeString(value), objectDefField?.format);
                break;
              case 'datetime':
                displayNode = formatDateTime(toSafeString(value));
                break;
              case 'boolean':
                displayNode = value ? 'Yes' : 'No';
                break;
              case 'select':
              case 'status': {
                const strVal = toSafeString(value);
                const option = options.find((opt) => String(opt.value) === strVal);
                const label = option?.label || humanizeLabel(strVal);
                const colorClasses = option?.color
                  ? (COLOR_CLASS_MAP[option.color] || 'bg-muted text-muted-foreground border-border')
                  : getSemanticBadgeClasses(strVal);
                displayNode = (
                  <Badge variant="outline" className={colorClasses}>
                    {label}
                  </Badge>
                );
                break;
              }
              default:
                displayNode = toSafeString(value);
                break;
            }

            return (
              <div key={field.name} className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {field.icon && <span className="mr-1">{field.icon}</span>}
                  {fieldLabel(objectName || '', field.name, field.label)}
                </span>
                <span className="text-sm font-semibold truncate">
                  {displayNode}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
