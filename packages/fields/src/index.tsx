/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import type { FieldMetadata, SelectOptionMetadata } from '@object-ui/types';
import { ComponentRegistry } from '@object-ui/core';
import { Badge, Avatar, AvatarFallback, Button, Checkbox } from '@object-ui/components';
import { Check, X } from 'lucide-react';

import { TextField } from './widgets/TextField';
import { NumberField } from './widgets/NumberField';
import { BooleanField } from './widgets/BooleanField';
import { SelectField } from './widgets/SelectField';
import { DateField } from './widgets/DateField';
import { EmailField } from './widgets/EmailField';
import { PhoneField } from './widgets/PhoneField';
import { UrlField } from './widgets/UrlField';
import { CurrencyField } from './widgets/CurrencyField';
import { TextAreaField } from './widgets/TextAreaField';
import { RichTextField } from './widgets/RichTextField';
import { LookupField } from './widgets/LookupField';
import { DateTimeField } from './widgets/DateTimeField';
import { TimeField } from './widgets/TimeField';
import { PercentField } from './widgets/PercentField';
import { PasswordField } from './widgets/PasswordField';
import { FileField } from './widgets/FileField';
import { ImageField } from './widgets/ImageField';
import { LocationField } from './widgets/LocationField';
import { FormulaField } from './widgets/FormulaField';
import { SummaryField } from './widgets/SummaryField';
import { AutoNumberField } from './widgets/AutoNumberField';
import { UserField } from './widgets/UserField';
import { ObjectField } from './widgets/ObjectField';
import { VectorField } from './widgets/VectorField';
import { GridField } from './widgets/GridField';
// New widgets according to @objectstack/spec
import { ColorField } from './widgets/ColorField';
import { SliderField } from './widgets/SliderField';
import { RatingField } from './widgets/RatingField';
import { CodeField } from './widgets/CodeField';
import { AvatarField } from './widgets/AvatarField';
import { AddressField } from './widgets/AddressField';
import { GeolocationField } from './widgets/GeolocationField';
import { SignatureField } from './widgets/SignatureField';
import { QRCodeField } from './widgets/QRCodeField';
import { MasterDetailField } from './widgets/MasterDetailField';

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
 * Format currency value in compact form for mobile display.
 * E.g., $150,000 → $150K, $1,200,000 → $1.2M
 */
export function formatCompactCurrency(value: number, currency: string = 'USD'): string {
  try {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
    // Strip trailing ".0" before compact suffix for consistent cross-environment output
    // e.g. "$150.0K" → "$150K" while keeping "$1.5M" intact
    return formatted.replace(/\.0(?=[KMBT]|$)/, '');
  } catch {
    return `${currency} ${value}`;
  }
}

/**
 * Format percent value
 * Handles both decimal (0.8 = 80%) and whole number (80 = 80%) inputs.
 */
export function formatPercent(value: number, precision: number = 0): string {
  // If value is between -1 and 1 (exclusive), treat as decimal (e.g. 0.8 → 80%)
  const displayValue = (value > -1 && value < 1) ? value * 100 : value;
  return `${displayValue.toFixed(precision)}%`;
}

/**
 * Format date value
 */
export function formatDate(value: string | Date, style?: string): string {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '-';

  if (style === 'short') {
    // Compact format for mobile: "Jan 15, '24"
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const year = String(date.getFullYear()).slice(-2);
    return `${month} ${day}, '${year}`;
  }
  
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
  if (value == null) return <span className="text-muted-foreground">-</span>;
  
  const numField = field as any;
  const precision = numField.precision ?? 0;
  const formatted = typeof value === 'number'
    ? new Intl.NumberFormat('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision }).format(value)
    : value;
  
  return <span className="tabular-nums">{formatted}</span>;
}

/**
 * Currency field cell renderer
 */
export function CurrencyCellRenderer({ value, field }: CellRendererProps): React.ReactElement {
  if (value == null) return <span className="text-muted-foreground">-</span>;
  
  const currencyField = field as any;
  const currency = currencyField.currency || 'USD';
  const formatted = formatCurrency(Number(value), currency);
  
  return <span className="tabular-nums font-medium whitespace-nowrap">{formatted}</span>;
}

/**
 * Percent field cell renderer with mini progress bar
 */
export function PercentCellRenderer({ value, field }: CellRendererProps): React.ReactElement {
  if (value == null) return <span className="text-muted-foreground">-</span>;
  
  const percentField = field as any;
  const precision = percentField.precision ?? 0;
  const numValue = Number(value);
  const formatted = formatPercent(numValue, precision);
  // Normalize to 0-100 range for progress bar
  const barValue = (numValue > -1 && numValue < 1) ? numValue * 100 : numValue;
  const clampedBar = Math.max(0, Math.min(100, barValue));
  
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-16 rounded-full bg-muted overflow-hidden flex-shrink-0"
        role="progressbar"
        aria-valuenow={clampedBar}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${clampedBar}%` }}
        />
      </div>
      <span className="tabular-nums whitespace-nowrap">{formatted}</span>
    </div>
  );
}

/**
 * Boolean field cell renderer (Airtable-style checkbox)
 */
export function BooleanCellRenderer({ value }: CellRendererProps): React.ReactElement {
  return (
    <div className="flex items-center justify-center">
      <Checkbox checked={!!value} disabled className="pointer-events-none" />
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
 * DateTime field cell renderer (Airtable-style with date and time visually separated)
 */
export function DateTimeCellRenderer({ value }: CellRendererProps): React.ReactElement {
  if (!value) return <span className="text-muted-foreground">-</span>;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return <span className="text-muted-foreground">-</span>;

  const datePart = date.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).toLowerCase();

  return (
    <span className="tabular-nums text-sm whitespace-nowrap">
      <span>{datePart}</span>
      <span className="ml-2 text-muted-foreground">{timePart}</span>
    </span>
  );
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
    text: 'field:text',
    textarea: 'field:textarea',
    markdown: 'field:markdown', // Markdown editor (fallback to textarea)
    html: 'field:html', // Rich text editor (fallback to textarea)
    
    // Numeric fields
    number: 'field:number',
    currency: 'field:currency',
    percent: 'field:percent',
    
    // Date/Time fields
    date: 'field:date',
    datetime: 'field:datetime',
    time: 'field:time',
    
    // Boolean
    boolean: 'field:boolean',
    
    // Selection fields
    select: 'field:select',
    lookup: 'field:lookup',
    master_detail: 'field:master_detail',
    
    // Contact fields
    email: 'field:email',
    phone: 'field:phone',
    url: 'field:url',
    
    // File fields
    file: 'field:file',
    image: 'field:image',
    
    // Special fields
    password: 'field:password',
    location: 'field:location', // Location/map field (fallback to input)
    
    // Auto-generated/computed fields (typically read-only)
    formula: 'field:formula',
    summary: 'field:summary',
    auto_number: 'field:auto_number',
  };

  return typeMap[fieldType] || 'field:text';
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

// Create wrapper renderers for field widgets to work with ComponentDemo
function createFieldRenderer(FieldWidget: React.ComponentType<any>) {
  const FieldRenderer: React.FC<any> = ({ schema, className, value: initialValue, ...props }) => {
    const [value, setValue] = React.useState(initialValue ?? schema?.value ?? '');
    
    const field = {
      name: schema?.name || 'field',
      label: schema?.label,
      type: schema?.type,
      placeholder: schema?.placeholder,
      required: schema?.required,
      readonly: schema?.readonly || schema?.readOnly,
      help: schema?.help,
      description: schema?.description,
      defaultValue: schema?.defaultValue || schema?.value,
      ...schema,
    };

    const handleChange = React.useCallback((newValue: any) => {
      setValue(newValue);
      if (props.onChange) {
        props.onChange(newValue);
      }
    }, [props]);

    const readonly = schema?.readonly || schema?.readOnly || false;

    return (
      <div 
        className="grid w-full items-center gap-1.5"
        data-obj-id={schema?.id}
        data-obj-type={schema?.type}
      >
        {schema?.label && (
          <label htmlFor={schema.id} className={schema.required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ""}>
            {schema.label}
          </label>
        )}
        <FieldWidget
          value={value}
          onChange={handleChange}
          field={field}
          readonly={readonly}
          className={className}
        />
        {schema?.description && (
          <p className="text-sm text-gray-500">{schema.description}</p>
        )}
      </div>
    );
  };
  
  FieldRenderer.displayName = `FieldRenderer(${FieldWidget.displayName || FieldWidget.name || 'Component'})`;
  
  return FieldRenderer;
}

/**
 * Field widget map for lazy loading
 * Maps field type to widget component
 */
const fieldWidgetMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  // Basic fields
  'text': () => import('./widgets/TextField').then(m => ({ default: m.TextField })),
  'textarea': () => import('./widgets/TextAreaField').then(m => ({ default: m.TextAreaField })),
  'number': () => import('./widgets/NumberField').then(m => ({ default: m.NumberField })),
  'boolean': () => import('./widgets/BooleanField').then(m => ({ default: m.BooleanField })),
  'select': () => import('./widgets/SelectField').then(m => ({ default: m.SelectField })),
  'date': () => import('./widgets/DateField').then(m => ({ default: m.DateField })),
  'datetime': () => import('./widgets/DateTimeField').then(m => ({ default: m.DateTimeField })),
  'time': () => import('./widgets/TimeField').then(m => ({ default: m.TimeField })),
  
  // Contact fields
  'email': () => import('./widgets/EmailField').then(m => ({ default: m.EmailField })),
  'phone': () => import('./widgets/PhoneField').then(m => ({ default: m.PhoneField })),
  'url': () => import('./widgets/UrlField').then(m => ({ default: m.UrlField })),
  
  // Specialized fields
  'currency': () => import('./widgets/CurrencyField').then(m => ({ default: m.CurrencyField })),
  'percent': () => import('./widgets/PercentField').then(m => ({ default: m.PercentField })),
  'password': () => import('./widgets/PasswordField').then(m => ({ default: m.PasswordField })),
  'markdown': () => import('./widgets/RichTextField').then(m => ({ default: m.RichTextField })),
  'html': () => import('./widgets/RichTextField').then(m => ({ default: m.RichTextField })),
  'lookup': () => import('./widgets/LookupField').then(m => ({ default: m.LookupField })),
  'master_detail': () => import('./widgets/MasterDetailField').then(m => ({ default: m.MasterDetailField })),
  
  // File fields
  'file': () => import('./widgets/FileField').then(m => ({ default: m.FileField })),
  'image': () => import('./widgets/ImageField').then(m => ({ default: m.ImageField })),
  
  // Location field
  'location': () => import('./widgets/LocationField').then(m => ({ default: m.LocationField })),
  
  // Computed/Read-only fields
  'formula': () => import('./widgets/FormulaField').then(m => ({ default: m.FormulaField })),
  'summary': () => import('./widgets/SummaryField').then(m => ({ default: m.SummaryField })),
  'auto_number': () => import('./widgets/AutoNumberField').then(m => ({ default: m.AutoNumberField })),
  
  // User fields
  'user': () => import('./widgets/UserField').then(m => ({ default: m.UserField })),
  'owner': () => import('./widgets/UserField').then(m => ({ default: m.UserField })),
  
  // Complex data types
  'object': () => import('./widgets/ObjectField').then(m => ({ default: m.ObjectField })),
  'vector': () => import('./widgets/VectorField').then(m => ({ default: m.VectorField })),
  'grid': () => import('./widgets/GridField').then(m => ({ default: m.GridField })),
  
  // Additional field types from @objectstack/spec
  'color': () => import('./widgets/ColorField').then(m => ({ default: m.ColorField })),
  'slider': () => import('./widgets/SliderField').then(m => ({ default: m.SliderField })),
  'rating': () => import('./widgets/RatingField').then(m => ({ default: m.RatingField })),
  'code': () => import('./widgets/CodeField').then(m => ({ default: m.CodeField })),
  'avatar': () => import('./widgets/AvatarField').then(m => ({ default: m.AvatarField })),
  'address': () => import('./widgets/AddressField').then(m => ({ default: m.AddressField })),
  'geolocation': () => import('./widgets/GeolocationField').then(m => ({ default: m.GeolocationField })),
  'signature': () => import('./widgets/SignatureField').then(m => ({ default: m.SignatureField })),
  'qrcode': () => import('./widgets/QRCodeField').then(m => ({ default: m.QRCodeField })),
};

/**
 * Register a specific field type lazily
 * @param fieldType - The field type to register (e.g., 'text', 'number')
 * 
 * @example
 * // Register only the text field
 * registerField('text');
 */
export function registerField(fieldType: string): void {
  const loader = fieldWidgetMap[fieldType];
  if (!loader) {
    console.warn(`Unknown field type: ${fieldType}`);
    return;
  }
  
  // Create lazy component
  const LazyFieldWidget = React.lazy(loader);
  
  // Register with field namespace - NO WRAPPER to allow form renderer to control label/layout
  ComponentRegistry.register(fieldType, LazyFieldWidget, { namespace: 'field' });
}

/**
 * Register all field types (for backward compatibility)
 * This function auto-registers all field widgets on import.
 * 
 * For better tree-shaking, use registerField() to register only needed fields.
 * 
 * @example
 * // Register all fields at once
 * registerAllFields();
 */
export function registerAllFields(): void {
  Object.keys(fieldWidgetMap).forEach(fieldType => {
    registerField(fieldType);
  });
}

/**
 * Legacy function - kept for backward compatibility
 * @deprecated Use registerAllFields() instead
 */
export function registerFields() {
  // Basic fields - wrapped for documentation compatibility
  ComponentRegistry.register('text', createFieldRenderer(TextField), { namespace: 'field' });
  ComponentRegistry.register('textarea', createFieldRenderer(TextAreaField), { namespace: 'field' });
  ComponentRegistry.register('number', createFieldRenderer(NumberField), { namespace: 'field' });
  ComponentRegistry.register('boolean', createFieldRenderer(BooleanField), { namespace: 'field' });
  ComponentRegistry.register('select', createFieldRenderer(SelectField), { namespace: 'field' });
  ComponentRegistry.register('date', createFieldRenderer(DateField), { namespace: 'field' });
  ComponentRegistry.register('datetime', createFieldRenderer(DateTimeField), { namespace: 'field' });
  ComponentRegistry.register('time', createFieldRenderer(TimeField), { namespace: 'field' });
  
  // Contact fields - wrapped for documentation compatibility
  ComponentRegistry.register('email', createFieldRenderer(EmailField), { namespace: 'field' });
  ComponentRegistry.register('phone', createFieldRenderer(PhoneField), { namespace: 'field' });
  ComponentRegistry.register('url', createFieldRenderer(UrlField), { namespace: 'field' });
  
  // Specialized fields - wrapped for documentation compatibility
  ComponentRegistry.register('currency', createFieldRenderer(CurrencyField), { namespace: 'field' });
  ComponentRegistry.register('percent', createFieldRenderer(PercentField), { namespace: 'field' });
  ComponentRegistry.register('password', createFieldRenderer(PasswordField), { namespace: 'field' });
  ComponentRegistry.register('markdown', createFieldRenderer(RichTextField), { namespace: 'field' });
  ComponentRegistry.register('html', createFieldRenderer(RichTextField), { namespace: 'field' });
  ComponentRegistry.register('lookup', createFieldRenderer(LookupField), { namespace: 'field' });
  ComponentRegistry.register('master_detail', createFieldRenderer(MasterDetailField), { namespace: 'field' });
  
  // File fields
  ComponentRegistry.register('file', createFieldRenderer(FileField), { namespace: 'field' });
  ComponentRegistry.register('image', createFieldRenderer(ImageField), { namespace: 'field' });
  
  // Location field
  ComponentRegistry.register('location', createFieldRenderer(LocationField), { namespace: 'field' });
  
  // Computed/Read-only fields
  ComponentRegistry.register('formula', createFieldRenderer(FormulaField), { namespace: 'field' });
  ComponentRegistry.register('summary', createFieldRenderer(SummaryField), { namespace: 'field' });
  ComponentRegistry.register('auto_number', createFieldRenderer(AutoNumberField), { namespace: 'field' });
  
  // User fields
  ComponentRegistry.register('user', createFieldRenderer(UserField), { namespace: 'field' });
  ComponentRegistry.register('owner', createFieldRenderer(UserField), { namespace: 'field' });
  
  // Complex data types
  ComponentRegistry.register('object', createFieldRenderer(ObjectField), { namespace: 'field' });
  ComponentRegistry.register('vector', createFieldRenderer(VectorField), { namespace: 'field' });
  ComponentRegistry.register('grid', createFieldRenderer(GridField), { namespace: 'field' });
  
  // NEW: Additional field types from @objectstack/spec
  ComponentRegistry.register('color', createFieldRenderer(ColorField), { namespace: 'field' });
  ComponentRegistry.register('slider', createFieldRenderer(SliderField), { namespace: 'field' });
  ComponentRegistry.register('rating', createFieldRenderer(RatingField), { namespace: 'field' });
  ComponentRegistry.register('code', createFieldRenderer(CodeField), { namespace: 'field' });
  ComponentRegistry.register('avatar', createFieldRenderer(AvatarField), { namespace: 'field' });
  ComponentRegistry.register('address', createFieldRenderer(AddressField), { namespace: 'field' });
  ComponentRegistry.register('geolocation', createFieldRenderer(GeolocationField), { namespace: 'field' });
  ComponentRegistry.register('signature', createFieldRenderer(SignatureField), { namespace: 'field' });
  ComponentRegistry.register('qrcode', createFieldRenderer(QRCodeField), { namespace: 'field' });
}

export * from './widgets/types';
export * from './widgets/TextField';
export * from './widgets/NumberField';
export * from './widgets/BooleanField';
export * from './widgets/SelectField';
export * from './widgets/DateField';
export * from './widgets/DateTimeField';
export * from './widgets/TimeField';
export * from './widgets/EmailField';
export * from './widgets/PhoneField';
export * from './widgets/UrlField';
export * from './widgets/CurrencyField';
export * from './widgets/PercentField';
export * from './widgets/PasswordField';
export * from './widgets/TextAreaField';
export * from './widgets/RichTextField';
export * from './widgets/LookupField';
export * from './widgets/FileField';
export * from './widgets/ImageField';
export * from './widgets/LocationField';
export * from './widgets/FormulaField';
export * from './widgets/SummaryField';
export * from './widgets/AutoNumberField';
export * from './widgets/UserField';
export * from './widgets/ObjectField';
export * from './widgets/VectorField';
export * from './widgets/GridField';
// New widgets according to @objectstack/spec
export * from './widgets/ColorField';
export * from './widgets/SliderField';
export * from './widgets/RatingField';
export * from './widgets/CodeField';
export * from './widgets/AvatarField';
export * from './widgets/AddressField';
export * from './widgets/GeolocationField';
export * from './widgets/SignatureField';
export * from './widgets/QRCodeField';
export * from './widgets/MasterDetailField';

// Initialize registry
registerAllFields();
