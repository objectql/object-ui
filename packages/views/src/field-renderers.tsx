/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Field Renderers for ObjectTable and ObjectForm
 * 
 * Provides specialized rendering functions for different field types.
 * Implements both Cell View (read mode) and Form Control (edit mode) for each field type.
 */

import React from 'react';
import type { FieldMetadata, SelectOptionMetadata } from '@object-ui/types';

/**
 * Cell renderer props
 */
export interface CellRendererProps {
  value: any;
  field: FieldMetadata;
  isEditing?: boolean;
  onChange?: (value: any) => void;
}

/**
 * Format currency value
 */
function formatCurrency(value: number, currency: string = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

/**
 * Format percent value
 */
function formatPercent(value: number, precision: number = 2): string {
  return `${(value * 100).toFixed(precision)}%`;
}

/**
 * Format date value
 */
function formatDate(value: string | Date, _format?: string): string {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '-';
  
  // Default format: MMM DD, YYYY
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format datetime value
 */
function formatDateTime(value: string | Date): string {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '-';
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Text field cell renderer
 */
export function TextCellRenderer({ value }: CellRendererProps): React.ReactElement {
  return <span className="truncate">{value || '-'}</span>;
}

/**
 * Number field cell renderer
 */
export function NumberCellRenderer({ value, field }: CellRendererProps): React.ReactElement {
  if (value == null) return <span>-</span>;
  
  const numField = field as any;
  const precision = numField.precision ?? 0;
  const formatted = typeof value === 'number' ? value.toFixed(precision) : value;
  
  return <span className="tabular-nums">{formatted}</span>;
}

/**
 * Currency field cell renderer
 */
export function CurrencyCellRenderer({ value, field }: CellRendererProps): React.ReactElement {
  if (value == null) return <span>-</span>;
  
  const currencyField = field as any;
  const currency = currencyField.currency || 'USD';
  const formatted = formatCurrency(Number(value), currency);
  
  return <span className="tabular-nums font-medium">{formatted}</span>;
}

/**
 * Percent field cell renderer
 */
export function PercentCellRenderer({ value, field }: CellRendererProps): React.ReactElement {
  if (value == null) return <span>-</span>;
  
  const percentField = field as any;
  const precision = percentField.precision ?? 2;
  const formatted = formatPercent(Number(value), precision);
  
  return <span className="tabular-nums">{formatted}</span>;
}

/**
 * Boolean field cell renderer
 */
export function BooleanCellRenderer({ value }: CellRendererProps): React.ReactElement {
  return (
    <div className="flex items-center">
      {value ? (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-green-100 text-green-600">
          ✓
        </span>
      ) : (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-gray-100 text-gray-400">
          ✗
        </span>
      )}
    </div>
  );
}

/**
 * Date field cell renderer
 */
export function DateCellRenderer({ value, field }: CellRendererProps): React.ReactElement {
  const dateField = field as any;
  const formatted = formatDate(value, dateField.format);
  
  return <span className="tabular-nums">{formatted}</span>;
}

/**
 * DateTime field cell renderer
 */
export function DateTimeCellRenderer({ value }: CellRendererProps): React.ReactElement {
  const formatted = formatDateTime(value);
  
  return <span className="tabular-nums text-sm">{formatted}</span>;
}

/**
 * Select field cell renderer (with badges)
 */
export function SelectCellRenderer({ value, field }: CellRendererProps): React.ReactElement {
  const selectField = field as any;
  const options: SelectOptionMetadata[] = selectField.options || [];
  
  if (!value) return <span>-</span>;
  
  // Color mapping for Tailwind CSS (to avoid dynamic class names)
  const colorClasses: Record<string, { bg: string; text: string }> = {
    gray: { bg: 'bg-gray-100', text: 'text-gray-800' },
    red: { bg: 'bg-red-100', text: 'text-red-800' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-800' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    green: { bg: 'bg-green-100', text: 'text-green-800' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-800' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-800' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-800' },
    pink: { bg: 'bg-pink-100', text: 'text-pink-800' },
  };
  
  // Handle multiple values
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((val, idx) => {
          const option = options.find(opt => opt.value === val);
          const label = option?.label || val;
          const color = option?.color || 'gray';
          const classes = colorClasses[color] || colorClasses.gray;
          
          return (
            <span
              key={idx}
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${classes.bg} ${classes.text}`}
            >
              {label}
            </span>
          );
        })}
      </div>
    );
  }
  
  // Handle single value
  const option = options.find(opt => opt.value === value);
  const label = option?.label || value;
  const color = option?.color || 'blue';
  const classes = colorClasses[color] || colorClasses.blue;
  
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${classes.bg} ${classes.text}`}
    >
      {label}
    </span>
  );
}

/**
 * Email field cell renderer
 */
export function EmailCellRenderer({ value }: CellRendererProps): React.ReactElement {
  if (!value) return <span>-</span>;
  
  return (
    <a
      href={`mailto:${value}`}
      className="text-blue-600 hover:text-blue-800 underline truncate"
      onClick={(e) => e.stopPropagation()}
    >
      {value}
    </a>
  );
}

/**
 * URL field cell renderer
 */
export function UrlCellRenderer({ value }: CellRendererProps): React.ReactElement {
  if (!value) return <span>-</span>;
  
  return (
    <a
      href={value}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:text-blue-800 underline truncate"
      onClick={(e) => e.stopPropagation()}
    >
      {value}
    </a>
  );
}

/**
 * Phone field cell renderer
 */
export function PhoneCellRenderer({ value }: CellRendererProps): React.ReactElement {
  if (!value) return <span>-</span>;
  
  return (
    <a
      href={`tel:${value}`}
      className="text-blue-600 hover:text-blue-800"
      onClick={(e) => e.stopPropagation()}
    >
      {value}
    </a>
  );
}

/**
 * File field cell renderer
 */
export function FileCellRenderer({ value, field }: CellRendererProps): React.ReactElement {
  if (!value) return <span>-</span>;
  
  const fileField = field as any;
  const isMultiple = fileField.multiple;
  
  if (Array.isArray(value)) {
    const count = value.length;
    return (
      <span className="text-sm text-gray-600">
        {count} {count === 1 ? 'file' : 'files'}
      </span>
    );
  }
  
  const fileName = value.name || value.original_name || 'File';
  return <span className="text-sm truncate">{fileName}</span>;
}

/**
 * Image field cell renderer (with thumbnails)
 */
export function ImageCellRenderer({ value }: CellRendererProps): React.ReactElement {
  if (!value) return <span>-</span>;
  
  if (Array.isArray(value)) {
    return (
      <div className="flex -space-x-2">
        {value.slice(0, 3).map((img, idx) => (
          <img
            key={idx}
            src={img.url || ''}
            alt={img.name || `Image ${idx + 1}`}
            className="w-8 h-8 rounded border-2 border-white object-cover"
          />
        ))}
        {value.length > 3 && (
          <div className="w-8 h-8 rounded border-2 border-white bg-gray-100 flex items-center justify-center text-xs">
            +{value.length - 3}
          </div>
        )}
      </div>
    );
  }
  
  return (
    <img
      src={value.url || ''}
      alt={value.name || 'Image'}
      className="w-10 h-10 rounded object-cover"
    />
  );
}

/**
 * Lookup/Master-Detail field cell renderer
 */
export function LookupCellRenderer({ value }: CellRendererProps): React.ReactElement {
  if (!value) return <span>-</span>;
  
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((item, idx) => {
          const label = item.name || item.label || item._id || String(item);
          return (
            <span
              key={idx}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
            >
              {label}
            </span>
          );
        })}
      </div>
    );
  }
  
  if (typeof value === 'object' && value !== null) {
    const label = value.name || value.label || value._id || '[Object]';
    return <span className="truncate">{label}</span>;
  }
  
  return <span className="truncate">{String(value)}</span>;
}

/**
 * Formula field cell renderer (read-only)
 */
export function FormulaCellRenderer({ value }: CellRendererProps): React.ReactElement {
  return (
    <span className="text-gray-700 font-mono text-sm">
      {value != null ? String(value) : '-'}
    </span>
  );
}

/**
 * User/Owner field cell renderer (with avatars)
 */
export function UserCellRenderer({ value }: CellRendererProps): React.ReactElement {
  if (!value) return <span>-</span>;
  
  if (Array.isArray(value)) {
    return (
      <div className="flex -space-x-2">
        {value.slice(0, 3).map((user, idx) => {
          const name = user.name || user.username || 'User';
          const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
          
          return (
            <div
              key={idx}
              className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-medium border-2 border-white"
              title={name}
            >
              {initials}
            </div>
          );
        })}
        {value.length > 3 && (
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs border-2 border-white">
            +{value.length - 3}
          </div>
        )}
      </div>
    );
  }
  
  const name = value.name || value.username || 'User';
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-medium">
        {initials}
      </div>
      <span className="truncate">{name}</span>
    </div>
  );
}

/**
 * Get the appropriate cell renderer for a field type
 */
export function getCellRenderer(fieldType: string): React.FC<CellRendererProps> {
  const rendererMap: Record<string, React.FC<CellRendererProps>> = {
    text: TextCellRenderer,
    textarea: TextCellRenderer,
    markdown: TextCellRenderer,
    html: TextCellRenderer,
    number: NumberCellRenderer,
    currency: CurrencyCellRenderer,
    percent: PercentCellRenderer,
    boolean: BooleanCellRenderer,
    date: DateCellRenderer,
    datetime: DateTimeCellRenderer,
    time: TextCellRenderer,
    select: SelectCellRenderer,
    email: EmailCellRenderer,
    url: UrlCellRenderer,
    phone: PhoneCellRenderer,
    file: FileCellRenderer,
    image: ImageCellRenderer,
    lookup: LookupCellRenderer,
    master_detail: LookupCellRenderer,
    formula: FormulaCellRenderer,
    summary: FormulaCellRenderer,
    auto_number: TextCellRenderer,
    user: UserCellRenderer,
    owner: UserCellRenderer,
    password: () => <span>••••••</span>,
    location: TextCellRenderer,
    object: () => <span className="text-gray-500 italic">[Object]</span>,
    vector: () => <span className="text-gray-500 italic">[Vector]</span>,
    grid: () => <span className="text-gray-500 italic">[Grid]</span>,
  };
  
  return rendererMap[fieldType] || TextCellRenderer;
}
