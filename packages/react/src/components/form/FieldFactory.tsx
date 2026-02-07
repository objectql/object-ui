/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import type { FormField } from '@objectstack/spec/ui';

/**
 * Extended form field with additional properties for complex widgets
 * These properties are not part of the standard FormField schema but may be
 * provided by specific implementations
 */
export interface ExtendedFormField extends FormField {
  multiple?: boolean;
  accept?: string[];
  options?: Array<{
    label: string;
    value: string;
    disabled?: boolean;
  }>;
}

export interface FieldFactoryProps {
  /**
   * Field configuration from FormFieldSchema
   */
  field: FormField;
  /**
   * React Hook Form methods
   */
  methods: UseFormReturn<any>;
  /**
   * Whether the field is disabled
   */
  disabled?: boolean;
}

/**
 * FieldFactory component that renders different input types based on
 * the widget property or field type
 */
export const FieldFactory: React.FC<FieldFactoryProps> = ({
  field,
  methods,
  disabled = false,
}) => {
  const { register, formState: { errors } } = methods;
  
  // Cast to extended field for properties not in base schema
  const extendedField = field as ExtendedFormField;
  
  // Determine the widget type
  const widgetType = field.widget || 'text';
  const fieldName = field.field;
  const error = errors[fieldName];

  // Helper function to handle multiple select value conversion
  const handleMultipleSelectValue = (value: any) => {
    if (extendedField.multiple && value instanceof HTMLCollection) {
      return Array.from(value as HTMLCollectionOf<HTMLOptionElement>).map((opt) => opt.value);
    }
    return value;
  };

  // Handle conditional visibility
  // Fields are hidden when explicitly hidden or when visibleOn evaluates to false
  // Note: dependsOn is handled at the FormSectionRenderer level
  if (field.hidden) {
    return null;
  }

  // Common field wrapper
  const renderField = (input: React.ReactNode) => (
    <div className="space-y-2">
      {field.label && (
        <label htmlFor={fieldName} className="block text-sm font-medium text-gray-700">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {input}
      {field.helpText && (
        <p className="text-sm text-gray-500">{field.helpText}</p>
      )}
      {error && (
        <p className="text-sm text-red-600">{error.message as string}</p>
      )}
    </div>
  );

  // Render based on widget type
  switch (widgetType.toLowerCase()) {
    case 'text':
    case 'string':
    case 'email':
    case 'password':
    case 'url':
    case 'tel':
      return renderField(
        <input
          id={fieldName}
          type={widgetType === 'string' ? 'text' : widgetType}
          placeholder={field.placeholder}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          {...register(fieldName, {
            required: field.required ? `${field.label || fieldName} is required` : false,
          })}
        />
      );

    case 'number':
    case 'integer':
    case 'float':
      return renderField(
        <input
          id={fieldName}
          type="number"
          placeholder={field.placeholder}
          disabled={disabled}
          step={widgetType === 'integer' ? '1' : 'any'}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          {...register(fieldName, {
            required: field.required ? `${field.label || fieldName} is required` : false,
            valueAsNumber: true,
          })}
        />
      );

    case 'checkbox':
    case 'boolean':
      return (
        <div className="flex items-start space-x-2">
          <input
            id={fieldName}
            type="checkbox"
            disabled={disabled}
            className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            {...register(fieldName)}
          />
          <div className="flex-1">
            {field.label && (
              <label htmlFor={fieldName} className="text-sm font-medium text-gray-700">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
            )}
            {field.helpText && (
              <p className="text-sm text-gray-500 mt-1">{field.helpText}</p>
            )}
            {error && (
              <p className="text-sm text-red-600 mt-1">{error.message as string}</p>
            )}
          </div>
        </div>
      );

    case 'textarea':
      return renderField(
        <textarea
          id={fieldName}
          placeholder={field.placeholder}
          disabled={disabled}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          {...register(fieldName, {
            required: field.required ? `${field.label || fieldName} is required` : false,
          })}
        />
      );

    case 'select':
    case 'dropdown':
      return renderField(
        <select
          id={fieldName}
          disabled={disabled}
          multiple={extendedField.multiple}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          {...register(fieldName, {
            required: field.required ? `${field.label || fieldName} is required` : false,
            setValueAs: handleMultipleSelectValue,
          })}
        >
          {!extendedField.multiple && <option value="">{field.placeholder || 'Select an option'}</option>}
          {extendedField.options?.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case 'date':
      return renderField(
        <input
          id={fieldName}
          type="date"
          placeholder={field.placeholder}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          {...register(fieldName, {
            required: field.required ? `${field.label || fieldName} is required` : false,
          })}
        />
      );

    case 'datetime':
    case 'datetime-local':
      return renderField(
        <input
          id={fieldName}
          type="datetime-local"
          placeholder={field.placeholder}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          {...register(fieldName, {
            required: field.required ? `${field.label || fieldName} is required` : false,
          })}
        />
      );

    case 'time':
      return renderField(
        <input
          id={fieldName}
          type="time"
          placeholder={field.placeholder}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          {...register(fieldName, {
            required: field.required ? `${field.label || fieldName} is required` : false,
          })}
        />
      );

    case 'currency':
      return renderField(
        <div className="relative">
          <span className="absolute left-3 top-2 text-gray-500">$</span>
          <input
            id={fieldName}
            type="number"
            placeholder={field.placeholder}
            disabled={disabled}
            step="0.01"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            {...register(fieldName, {
              required: field.required ? `${field.label || fieldName} is required` : false,
              valueAsNumber: true,
            })}
          />
        </div>
      );

    case 'percent':
      return renderField(
        <div className="relative">
          <input
            id={fieldName}
            type="number"
            placeholder={field.placeholder}
            disabled={disabled}
            step="0.01"
            min="0"
            max="100"
            className="w-full pr-8 pl-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            {...register(fieldName, {
              required: field.required ? `${field.label || fieldName} is required` : false,
              valueAsNumber: true,
            })}
          />
          <span className="absolute right-3 top-2 text-gray-500">%</span>
        </div>
      );

    case 'phone':
      return renderField(
        <input
          id={fieldName}
          type="tel"
          placeholder={field.placeholder || '+1 (555) 000-0000'}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          {...register(fieldName, {
            required: field.required ? `${field.label || fieldName} is required` : false,
          })}
        />
      );

    case 'markdown':
      return renderField(
        <textarea
          id={fieldName}
          placeholder={field.placeholder || 'Enter markdown text...'}
          disabled={disabled}
          rows={8}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed font-mono"
          {...register(fieldName, {
            required: field.required ? `${field.label || fieldName} is required` : false,
          })}
        />
      );

    case 'html':
      return renderField(
        <textarea
          id={fieldName}
          placeholder={field.placeholder || 'Enter HTML...'}
          disabled={disabled}
          rows={8}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed font-mono"
          {...register(fieldName, {
            required: field.required ? `${field.label || fieldName} is required` : false,
          })}
        />
      );

    case 'file':
      return renderField(
        <input
          id={fieldName}
          type="file"
          disabled={disabled}
          multiple={extendedField.multiple}
          accept={extendedField.accept?.join(',')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          {...register(fieldName, {
            required: field.required ? `${field.label || fieldName} is required` : false,
          })}
        />
      );

    case 'image':
      return renderField(
        <input
          id={fieldName}
          type="file"
          disabled={disabled}
          multiple={extendedField.multiple}
          accept={extendedField.accept?.join(',') || 'image/*'}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          {...register(fieldName, {
            required: field.required ? `${field.label || fieldName} is required` : false,
          })}
        />
      );

    case 'location':
      return renderField(
        <div className="space-y-2">
          <input
            id={`${fieldName}-lat`}
            type="number"
            placeholder="Latitude"
            disabled={disabled}
            step="any"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            {...register(`${fieldName}.lat`, {
              required: field.required ? 'Latitude is required' : false,
              valueAsNumber: true,
            })}
          />
          <input
            id={`${fieldName}-lng`}
            type="number"
            placeholder="Longitude"
            disabled={disabled}
            step="any"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            {...register(`${fieldName}.lng`, {
              required: field.required ? 'Longitude is required' : false,
              valueAsNumber: true,
            })}
          />
        </div>
      );

    case 'lookup':
    case 'master_detail':
      return renderField(
        <select
          id={fieldName}
          disabled={disabled}
          multiple={extendedField.multiple}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          {...register(fieldName, {
            required: field.required ? `${field.label || fieldName} is required` : false,
            setValueAs: handleMultipleSelectValue,
          })}
        >
          {!extendedField.multiple && <option value="">{field.placeholder || 'Select an option'}</option>}
          {extendedField.options?.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case 'user':
    case 'owner':
      return renderField(
        <select
          id={fieldName}
          disabled={disabled}
          multiple={extendedField.multiple}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          {...register(fieldName, {
            required: field.required ? `${field.label || fieldName} is required` : false,
            setValueAs: handleMultipleSelectValue,
          })}
        >
          {!extendedField.multiple && <option value="">{field.placeholder || 'Select user'}</option>}
          {extendedField.options?.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case 'formula':
    case 'summary':
    case 'auto_number':
      // Read-only computed fields - display as disabled text input
      return renderField(
        <input
          id={fieldName}
          type="text"
          disabled={true}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 cursor-not-allowed text-gray-600"
          {...register(fieldName)}
        />
      );

    case 'object':
      return renderField(
        <textarea
          id={fieldName}
          placeholder={field.placeholder || 'Enter JSON object...'}
          disabled={disabled}
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed font-mono text-sm"
          {...register(fieldName, {
            required: field.required ? `${field.label || fieldName} is required` : false,
            validate: (value) => {
              if (!value) return true;
              try {
                JSON.parse(value);
                return true;
              } catch (e) {
                return 'Invalid JSON format';
              }
            },
          })}
        />
      );

    case 'vector':
      // Vector fields are typically read-only or require specialized input
      return renderField(
        <input
          id={fieldName}
          type="text"
          placeholder={field.placeholder || 'Vector data (read-only)'}
          disabled={true}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 cursor-not-allowed text-gray-600"
          {...register(fieldName)}
        />
      );

    case 'grid':
      // Grid fields require complex table/grid editor - placeholder for now
      return renderField(
        <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600">
          <p className="text-sm">Grid editor not yet implemented</p>
        </div>
      );

    default:
      // Default to text input
      return renderField(
        <input
          id={fieldName}
          type="text"
          placeholder={field.placeholder}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          {...register(fieldName, {
            required: field.required ? `${field.label || fieldName} is required` : false,
          })}
        />
      );
  }
};

FieldFactory.displayName = 'FieldFactory';
