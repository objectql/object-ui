/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ObjectForm Component
 * 
 * A smart form component that generates forms from ObjectQL object schemas.
 * It automatically creates form fields based on object metadata.
 */

import React, { useEffect, useState, useCallback } from 'react';
import type { ObjectFormSchema, FormField, FormSchema, DataSource } from '@object-ui/types';
import { SchemaRenderer } from '@object-ui/react';

export interface ObjectFormProps {
  /**
   * The schema configuration for the form
   */
  schema: ObjectFormSchema;
  
  /**
   * Data source (ObjectQL or ObjectStack adapter)
   * Optional when using inline field definitions (customFields or fields array with field objects)
   */
  dataSource?: DataSource;
  
  /**
   * Additional CSS class
   */
  className?: string;
}

/**
 * ObjectForm Component
 * 
 * Renders a form for an ObjectQL object with automatic schema integration.
 * 
 * @example
 * ```tsx
 * <ObjectForm
 *   schema={{
 *     type: 'object-form',
 *     objectName: 'users',
 *     mode: 'create',
 *     fields: ['name', 'email', 'status']
 *   }}
 *   dataSource={dataSource}
 * />
 * ```
 */
export const ObjectForm: React.FC<ObjectFormProps> = ({
  schema,
  dataSource,
}) => {
  const [objectSchema, setObjectSchema] = useState<any>(null);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [initialData, setInitialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Check if using inline fields (fields defined as objects, not just names)
  const hasInlineFields = schema.customFields && schema.customFields.length > 0;

  // Initialize with inline data if provided
  useEffect(() => {
    if (hasInlineFields) {
      setInitialData(schema.initialData || schema.initialValues || {});
      setLoading(false);
    }
  }, [hasInlineFields, schema.initialData, schema.initialValues]);

  // Fetch object schema from ObjectQL/ObjectStack (skip if using inline fields)
  useEffect(() => {
    const fetchObjectSchema = async () => {
      try {
        if (!dataSource) {
          throw new Error('DataSource is required when using ObjectQL schema fetching (inline fields not provided)');
        }
        const schemaData = await dataSource.getObjectSchema(schema.objectName);
        setObjectSchema(schemaData);
      } catch (err) {
        console.error('Failed to fetch object schema:', err);
        setError(err as Error);
      }
    };

    // Skip fetching if we have inline fields
    if (hasInlineFields) {
      // Use a minimal schema for inline fields
      setObjectSchema({
        name: schema.objectName,
        fields: {} as Record<string, any>,
      });
    } else if (schema.objectName && dataSource) {
      fetchObjectSchema();
    }
  }, [schema.objectName, dataSource, hasInlineFields]);

  // Fetch initial data for edit/view modes (skip if using inline data)
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!schema.recordId || schema.mode === 'create') {
        setInitialData(schema.initialData || schema.initialValues || {});
        return;
      }

      // Skip fetching if using inline data
      if (hasInlineFields) {
        return;
      }

      if (!dataSource) {
        setError(new Error('DataSource is required for fetching record data (inline data not provided)'));
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await dataSource.findOne(schema.objectName, schema.recordId);
        setInitialData(data);
      } catch (err) {
        console.error('Failed to fetch record:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    if (objectSchema && !hasInlineFields) {
      fetchInitialData();
    }
  }, [schema.objectName, schema.recordId, schema.mode, schema.initialValues, schema.initialData, dataSource, objectSchema, hasInlineFields]);

  // Generate form fields from object schema or inline fields
  useEffect(() => {
    // For inline fields, use them directly
    if (hasInlineFields && schema.customFields) {
      setFormFields(schema.customFields);
      setLoading(false);
      return;
    }

    if (!objectSchema) return;

    const generatedFields: FormField[] = [];
    
    // Determine which fields to include
    const fieldsToShow = schema.fields || Object.keys(objectSchema.fields || {});
    
    fieldsToShow.forEach((fieldName) => {
      const field = objectSchema.fields?.[fieldName];
      if (!field) return;

      // Check field-level permissions for create/edit modes
      const hasWritePermission = !field.permissions || field.permissions.write !== false;
      if (schema.mode !== 'view' && !hasWritePermission) return; // Skip fields without write permission

      // Check if there's a custom field configuration
      const customField = schema.customFields?.find(f => f.name === fieldName);
      
      if (customField) {
        generatedFields.push(customField);
      } else {
        // Auto-generate field from schema
        const formField: FormField = {
          name: fieldName,
          label: field.label || fieldName,
          type: mapFieldTypeToFormType(field.type),
          required: field.required || false,
          disabled: schema.readOnly || schema.mode === 'view' || field.readonly,
          placeholder: field.placeholder,
          description: field.help || field.description,
          validation: buildValidationRules(field),
        };

        // Add field-specific properties
        if (field.type === 'select' || field.type === 'lookup' || field.type === 'master_detail') {
          formField.options = field.options || [];
          formField.multiple = field.multiple;
        }

        if (field.type === 'number' || field.type === 'currency' || field.type === 'percent') {
          formField.min = field.min;
          formField.max = field.max;
          formField.step = field.precision ? Math.pow(10, -field.precision) : undefined;
        }

        if (field.type === 'text' || field.type === 'textarea' || field.type === 'markdown' || field.type === 'html') {
          formField.maxLength = field.max_length;
          formField.minLength = field.min_length;
        }

        if (field.type === 'file' || field.type === 'image') {
          formField.multiple = field.multiple;
          formField.accept = field.accept ? field.accept.join(',') : undefined;
          // Add validation hints for file size and dimensions
          if (field.max_size) {
            const sizeHint = `Max size: ${formatFileSize(field.max_size)}`;
            formField.description = formField.description 
              ? `${formField.description} (${sizeHint})` 
              : sizeHint;
          }
        }

        if (field.type === 'email') {
          formField.inputType = 'email';
        }

        if (field.type === 'phone') {
          formField.inputType = 'tel';
        }

        if (field.type === 'url') {
          formField.inputType = 'url';
        }

        if (field.type === 'password') {
          formField.inputType = 'password';
        }

        if (field.type === 'time') {
          formField.inputType = 'time';
        }

        // Read-only fields for computed types
        if (field.type === 'formula' || field.type === 'summary' || field.type === 'auto_number') {
          formField.disabled = true;
        }

        // Add conditional visibility based on field dependencies
        if (field.visible_on) {
          formField.visible = (formData: any) => {
            return evaluateCondition(field.visible_on, formData);
          };
        }

        generatedFields.push(formField);
      }
    });

    setFormFields(generatedFields);
    setLoading(false);
  }, [objectSchema, schema.fields, schema.customFields, schema.readOnly, schema.mode, hasInlineFields]);

  // Handle form submission
  const handleSubmit = useCallback(async (formData: any) => {
    // For inline fields without a dataSource, just call the success callback
    if (hasInlineFields && !dataSource) {
      if (schema.onSuccess) {
        await schema.onSuccess(formData);
      }
      return formData;
    }

    if (!dataSource) {
      throw new Error('DataSource is required for form submission (inline mode not configured)');
    }

    try {
      let result;
      
      if (schema.mode === 'create') {
        result = await dataSource.create(schema.objectName, formData);
      } else if (schema.mode === 'edit' && schema.recordId) {
        result = await dataSource.update(schema.objectName, schema.recordId, formData);
      } else {
        throw new Error('Invalid form mode or missing record ID');
      }

      // Call success callback if provided
      if (schema.onSuccess) {
        await schema.onSuccess(result);
      }

      return result;
    } catch (err) {
      console.error('Failed to submit form:', err);
      
      // Call error callback if provided
      if (schema.onError) {
        schema.onError(err as Error);
      }
      
      throw err;
    }
  }, [schema, dataSource, hasInlineFields]);

  // Handle form cancellation
  const handleCancel = useCallback(() => {
    if (schema.onCancel) {
      schema.onCancel();
    }
  }, [schema]);

  // Render error state
  if (error) {
    return (
      <div className="p-4 border border-red-300 bg-red-50 rounded-md">
        <h3 className="text-red-800 font-semibold">Error loading form</h3>
        <p className="text-red-600 text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  // Render loading state
  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <p className="mt-2 text-sm text-gray-600">Loading form...</p>
      </div>
    );
  }

  // Convert to FormSchema
  // Note: FormSchema currently only supports 'vertical' and 'horizontal' layouts
  // Map 'grid' and 'inline' to 'vertical' as fallback
  const formSchema: FormSchema = {
    type: 'form',
    fields: formFields,
    layout: (schema.layout === 'vertical' || schema.layout === 'horizontal') 
      ? schema.layout 
      : 'vertical',
    columns: schema.columns,
    submitLabel: schema.submitText || (schema.mode === 'create' ? 'Create' : 'Update'),
    cancelLabel: schema.cancelText,
    showSubmit: schema.showSubmit !== false && schema.mode !== 'view',
    showCancel: schema.showCancel !== false,
    resetOnSubmit: schema.showReset,
    defaultValues: initialData,
    onSubmit: handleSubmit,
    onCancel: handleCancel,
    className: schema.className,
  };

  return (
    <div className="w-full">
      <SchemaRenderer schema={formSchema} />
    </div>
  );
};

/**
 * Maps an ObjectQL field type to the corresponding form field component type.
 *
 * This helper provides the translation layer between backend/ObjectQL field
 * definitions (e.g. `text`, `date`, `lookup`) and the generic form field
 * types understood by the schema renderer (e.g. `input`, `date-picker`,
 * `select`). If a field type is not explicitly mapped, the function falls
 * back to the generic `"input"` type.
 *
 * Updated to support all field types from ObjectStack Protocol:
 * text, textarea, markdown, html, select, date, datetime, time, number,
 * currency, percent, boolean, email, phone, url, image, file, location,
 * lookup, master_detail, password, formula, summary, auto_number, object,
 * vector, grid
 *
 * @param fieldType - The ObjectQL field type identifier to convert
 * (for example: `"text"`, `"number"`, `"date"`, `"lookup"`).
 * @returns The normalized form field type string used in the form schema
 * (for example: `"input"`, `"textarea"`, `"date-picker"`, `"select"`).
 */
function mapFieldTypeToFormType(fieldType: string): string {
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
function formatFileSize(bytes: number): string {
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
function buildValidationRules(field: any): any {
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
function evaluateCondition(condition: any, formData: any): boolean {
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
