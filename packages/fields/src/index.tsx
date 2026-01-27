/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import type { FieldMetadata, SelectOptionMetadata } from '@object-ui/types';
import { Badge, Avatar, AvatarFallback, Button } from '@object-ui/components';
import { Check, X } from 'lucide-react';

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
export function formatCurrency(value: number, currency: string = 'USD'): string {
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
export function formatPercent(value: number, precision: number = 2): string {
  return `${(value * 100).toFixed(precision)}%`;
}

/**
 * Format date value
 */
export function formatDate(value: string | Date, _format?: string): string {
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
export function formatDateTime(value: string | Date): string {
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
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
          <Check className="size-3" />
          True
        </Badge>
      ) : (
        <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 gap-1">
          <X className="size-3" />
          False
        </Badge>
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
  
  // Color to Tailwind class mapping for custom Badge styling
  const getColorClasses = (color?: string) => {
    const colorMap: Record<string, string> = {
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
    return colorMap[color || 'blue'] || colorMap.blue;
  };
  
  // Handle multiple values
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((val, idx) => {
          const option = options.find(opt => opt.value === val);
          const label = option?.label || val;
          const colorClasses = getColorClasses(option?.color);
          
          return (
            <Badge
              key={idx}
              variant="outline"
              className={colorClasses}
            >
              {label}
            </Badge>
          );
        })}
      </div>
    );
  }
  
  // Handle single value
  const option = options.find(opt => opt.value === value);
  const label = option?.label || value;
  const colorClasses = getColorClasses(option?.color);
  
  return (
    <Badge
      variant="outline"
      className={colorClasses}
    >
      {label}
    </Badge>
  );
}

/**
 * Email field cell renderer
 */
export function EmailCellRenderer({ value }: CellRendererProps): React.ReactElement {
  if (!value) return <span>-</span>;
  
  return (
    <Button
      variant="link"
      className="p-0 h-auto font-normal text-blue-600 hover:text-blue-800"
      asChild
    >
      <a
        href={`mailto:${value}`}
        onClick={(e) => e.stopPropagation()}
      >
        {value}
      </a>
    </Button>
  );
}

/**
 * URL field cell renderer
 */
export function UrlCellRenderer({ value }: CellRendererProps): React.ReactElement {
  if (!value) return <span>-</span>;
  
  return (
    <Button
      variant="link"
      className="p-0 h-auto font-normal text-blue-600 hover:text-blue-800"
      asChild
    >
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        {value}
      </a>
    </Button>
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
            className="size-8 rounded-md border-2 border-white object-cover"
          />
        ))}
        {value.length > 3 && (
          <div className="size-8 rounded-md border-2 border-white bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
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
      className="size-10 rounded-md object-cover"
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
            <Avatar
              key={idx}
              className="size-8 border-2 border-white"
              title={name}
            >
              <AvatarFallback className="bg-blue-500 text-white text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          );
        })}
        {value.length > 3 && (
          <Avatar className="size-8 border-2 border-white">
            <AvatarFallback className="bg-gray-200 text-gray-600 text-xs">
              +{value.length - 3}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    );
  }
  
  const name = value.name || value.username || 'User';
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  
  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-8">
        <AvatarFallback className="bg-blue-500 text-white text-xs">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="truncate">{name}</span>
    </div>
  );
}

/**
 * Field Registry
 * Stores mapping between field types and their renderers.
 */
const fieldRegistry = new Map<string, React.FC<CellRendererProps>>();

/**
 * Register a custom field renderer
 * @param type Field type (e.g. 'text', 'location', 'my-custom-type')
 * @param renderer React component to render the field
 */
export function registerFieldRenderer(type: string, renderer: React.FC<CellRendererProps>) {
  fieldRegistry.set(type, renderer);
}

/**
 * Get the appropriate cell renderer for a field type
 */
export function getCellRenderer(fieldType: string): React.FC<CellRendererProps> {
  // 1. Try exact match in registry
  if (fieldRegistry.has(fieldType)) {
    return fieldRegistry.get(fieldType)!;
  }
  
  // 2. Fallback to standard mappings if not overridden
  const standardMap: Record<string, React.FC<CellRendererProps>> = {
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
    lookup: SelectCellRenderer, // Default fallback
    master_detail: SelectCellRenderer, // Default fallback
    email: EmailCellRenderer,
    url: UrlCellRenderer,
    phone: PhoneCellRenderer,
    file: FileCellRenderer,
    image: ImageCellRenderer,
    formula: FormulaCellRenderer,
    summary: FormulaCellRenderer,
    auto_number: TextCellRenderer,
    user: UserCellRenderer,
    owner: UserCellRenderer,
    password: () => <span>••••••</span>,
    location: TextCellRenderer, // Default fallback
    object: () => <span className="text-gray-500 italic">[Object]</span>,
    vector: () => <span className="text-gray-500 italic">[Vector]</span>,
    grid: () => <span className="text-gray-500 italic">[Grid]</span>,
  };

  // 3. Register standard renderers implicitly if not present
  // This ensures that if we call registerFieldRenderer('text', Custom), it works,
  // but if we don't, we get the standard one.
  return standardMap[fieldType] || TextCellRenderer;
}

// Register standard renderers immediately
registerFieldRenderer('lookup', LookupCellRenderer);
registerFieldRenderer('master_detail', LookupCellRenderer);
registerFieldRenderer('select', SelectCellRenderer);



/**
 * Map field type to form component type
 * 
 * @param fieldType - The ObjectQL field type identifier to convert
 * (for example: `"text"`, `"number"`, `"date"`, `"lookup"`).
 * @returns The normalized form field type string used in the form schema
 * (for example: `"input"`, `"textarea"`, `"date-picker"`, `"select"`).
 */
export function mapFieldTypeToFormType(fieldType: string): string {
  const typeMap: Record<string, string> = {
    // Text-based fields
    text: 'input',
    textarea: 'textarea',
    markdown: 'textarea', // Markdown editor (fallback to textarea)
    html: 'textarea', // Rich text editor (fallback to textarea)
    
    // Numeric fields
    number: 'input',
    currency: 'input',
    percent: 'input',
    
    // Date/Time fields
    date: 'date-picker',
    datetime: 'date-picker',
    time: 'input', // Time picker (fallback to input with type="time")
    
    // Boolean
    boolean: 'switch',
    
    // Selection fields
    select: 'select',
    lookup: 'select',
    master_detail: 'select',
    
    // Contact fields
    email: 'input',
    phone: 'input',
    url: 'input',
    
    // File fields
    file: 'file-upload',
    image: 'file-upload',
    
    // Special fields
    password: 'input',
    location: 'input', // Location/map field (fallback to input)
    
    // Auto-generated/computed fields (typically read-only)
    formula: 'input',
    summary: 'input',
    auto_number: 'input',
    
    // Complex data types
    object: 'input', // JSON object (fallback to input)
    vector: 'input', // Vector/embedding data (fallback to input)
    grid: 'input', // Grid/table data (fallback to input)
  };

  return typeMap[fieldType] || 'input';
}

/**
 * Formats file size in bytes to human-readable string
 * @param bytes - File size in bytes (must be non-negative)
 * @returns Formatted string (e.g., "5 MB", "1.5 GB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 0 || !Number.isFinite(bytes)) {
    return '0 B';
  }
  
  if (bytes === 0) {
    return '0 B';
  }
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

/**
 * Build validation rules from field metadata
 * @param field - Field metadata from ObjectStack
 * @returns Validation rule object compatible with react-hook-form
 */
export function buildValidationRules(field: any): any {
  const rules: any = {};

  // Required validation
  if (field.required) {
    rules.required = typeof field.required_message === 'string' 
      ? field.required_message 
      : `${field.label || field.name} is required`;
  }

  // Length validation for text fields
  if (field.min_length) {
    rules.minLength = {
      value: field.min_length,
      message: field.min_length_message || `Minimum length is ${field.min_length} characters`,
    };
  }

  if (field.max_length) {
    rules.maxLength = {
      value: field.max_length,
      message: field.max_length_message || `Maximum length is ${field.max_length} characters`,
    };
  }

  // Number range validation
  if (field.min !== undefined) {
    rules.min = {
      value: field.min,
      message: field.min_message || `Minimum value is ${field.min}`,
    };
  }

  if (field.max !== undefined) {
    rules.max = {
      value: field.max,
      message: field.max_message || `Maximum value is ${field.max}`,
    };
  }

  // Pattern validation
  if (field.pattern) {
    rules.pattern = {
      value: typeof field.pattern === 'string' ? new RegExp(field.pattern) : field.pattern,
      message: field.pattern_message || 'Invalid format',
    };
  }

  // Email validation
  if (field.type === 'email') {
    rules.pattern = {
      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: 'Please enter a valid email address',
    };
  }

  // URL validation
  if (field.type === 'url') {
    rules.pattern = {
      value: /^https?:\/\/.+/,
      message: 'Please enter a valid URL',
    };
  }

  // Custom validation function
  if (field.validate) {
    rules.validate = field.validate;
  }

  return Object.keys(rules).length > 0 ? rules : undefined;
}

/**
 * Evaluate a conditional expression for field visibility
 * @param condition - Condition object from field metadata
 * @param formData - Current form values
 * @returns Whether the condition is met
 */
export function evaluateCondition(condition: any, formData: any): boolean {
  if (!condition) return true;

  // Simple field equality check
  if (condition.field && condition.value !== undefined) {
    const fieldValue = formData[condition.field];
    if (condition.operator === '=' || condition.operator === '==') {
      return fieldValue === condition.value;
    } else if (condition.operator === '!=') {
      return fieldValue !== condition.value;
    } else if (condition.operator === '>') {
      return fieldValue > condition.value;
    } else if (condition.operator === '>=') {
      return fieldValue >= condition.value;
    } else if (condition.operator === '<') {
      return fieldValue < condition.value;
    } else if (condition.operator === '<=') {
      return fieldValue <= condition.value;
    } else if (condition.operator === 'in') {
      return Array.isArray(condition.value) && condition.value.includes(fieldValue);
    }
  }

  // AND/OR logic
  if (condition.and && Array.isArray(condition.and)) {
    return condition.and.every((c: any) => evaluateCondition(c, formData));
  }

  if (condition.or && Array.isArray(condition.or)) {
    return condition.or.some((c: any) => evaluateCondition(c, formData));
  }

  // Default to true if condition format is unknown
  return true;
}

import { ComponentRegistry } from '@object-ui/core';
import { TextField } from './widgets/TextField';
import { NumberField } from './widgets/NumberField';
import { BooleanField } from './widgets/BooleanField';
import { SelectField } from './widgets/SelectField';
import { DateField } from './widgets/DateField';

export function registerFields() {
  ComponentRegistry.register('text', TextField);
  ComponentRegistry.register('textarea', TextField); // TextField handles rows logic inside
  ComponentRegistry.register('number', NumberField);
  ComponentRegistry.register('boolean', BooleanField);
  ComponentRegistry.register('select', SelectField);
  ComponentRegistry.register('date', DateField);
  
  // Register aliases or specific widgets
  ComponentRegistry.register('field:text', TextField);
  ComponentRegistry.register('field:number', NumberField); 
}

export * from './widgets/types';
export * from './widgets/TextField';
export * from './widgets/NumberField';
export * from './widgets/BooleanField';
export * from './widgets/SelectField';
export * from './widgets/DateField';
