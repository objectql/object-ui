/**
 * ObjectForm Component
 * 
 * A smart form component that generates forms from ObjectQL object schemas.
 * It automatically creates form fields based on object metadata.
 */

import React, { useEffect, useState, useCallback } from 'react';
import type { ObjectFormSchema, FormField, FormSchema } from '@object-ui/types';
import type { ObjectQLDataSource } from '@object-ui/data-objectql';
import { SchemaRenderer } from '@object-ui/react';

export interface ObjectFormProps {
  /**
   * The schema configuration for the form
   */
  schema: ObjectFormSchema;
  
  /**
   * ObjectQL data source
   */
  dataSource: ObjectQLDataSource;
  
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
 *   dataSource={objectQLDataSource}
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

  // Fetch object schema from ObjectQL
  useEffect(() => {
    const fetchObjectSchema = async () => {
      try {
        const schemaData = await dataSource.getObjectSchema(schema.objectName);
        setObjectSchema(schemaData);
      } catch (err) {
        console.error('Failed to fetch object schema:', err);
        setError(err as Error);
      }
    };

    if (schema.objectName && dataSource) {
      fetchObjectSchema();
    }
  }, [schema.objectName, dataSource]);

  // Fetch initial data for edit/view modes
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!schema.recordId || schema.mode === 'create') {
        setInitialData(schema.initialValues || {});
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

    if (objectSchema) {
      fetchInitialData();
    }
  }, [schema.objectName, schema.recordId, schema.mode, schema.initialValues, dataSource, objectSchema]);

  // Generate form fields from object schema
  useEffect(() => {
    if (!objectSchema) return;

    const generatedFields: FormField[] = [];
    
    // Determine which fields to include
    const fieldsToShow = schema.fields || Object.keys(objectSchema.fields || {});
    
    fieldsToShow.forEach((fieldName) => {
      const field = objectSchema.fields?.[fieldName];
      if (!field) return;

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
          formField.accept = field.accept?.join(',');
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

        generatedFields.push(formField);
      }
    });

    setFormFields(generatedFields);
    setLoading(false);
  }, [objectSchema, schema.fields, schema.customFields, schema.readOnly, schema.mode]);

  // Handle form submission
  const handleSubmit = useCallback(async (formData: any) => {
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
  }, [schema, dataSource]);

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
 * Updated to support all field types from @objectql/types v3.0.1:
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
