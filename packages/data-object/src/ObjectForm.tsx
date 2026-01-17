/**
 * ObjectForm Component
 * 
 * A smart form component that generates forms from ObjectQL object schemas.
 * It automatically creates form fields based on object metadata.
 */

import React, { useEffect, useState, useCallback } from 'react';
import type { ObjectFormSchema, FormField } from '@object-ui/types';
import type { ObjectQLDataSource } from '@object-ui/data-objectql';
import { Form } from '@object-ui/components';

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
  className,
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
        // TODO: Implement actual schema fetching from ObjectQL
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
        if (field.type === 'select' || field.type === 'lookup') {
          formField.options = field.options || [];
        }

        if (field.type === 'number' || field.type === 'currency') {
          formField.min = field.min;
          formField.max = field.max;
          formField.step = field.precision ? Math.pow(10, -field.precision) : undefined;
        }

        if (field.type === 'text' || field.type === 'textarea') {
          formField.maxLength = field.maxLength;
        }

        // Add validation rules
        if (field.required) {
          formField.validation = formField.validation || [];
          formField.validation.push({
            type: 'required',
            message: `${field.label || fieldName} is required`,
          });
        }

        if (field.pattern) {
          formField.validation = formField.validation || [];
          formField.validation.push({
            type: 'pattern',
            pattern: field.pattern,
            message: field.patternErrorMessage || `Invalid ${field.label || fieldName} format`,
          });
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

  // Convert to Form schema and render
  const formSchema = {
    type: 'form' as const,
    title: schema.title,
    description: schema.description,
    fields: formFields,
    layout: schema.layout || 'vertical',
    columns: schema.columns,
    submitText: schema.submitText || (schema.mode === 'create' ? 'Create' : 'Update'),
    cancelText: schema.cancelText,
    showSubmit: schema.showSubmit !== false && schema.mode !== 'view',
    showCancel: schema.showCancel !== false,
    showReset: schema.showReset,
    className: schema.className,
  };

  return (
    <Form 
      schema={formSchema} 
      initialValues={initialData}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
    />
  );
};

/**
 * Map ObjectQL field type to form field type
 */
function mapFieldTypeToFormType(fieldType: string): FormField['type'] {
  const typeMap: Record<string, FormField['type']> = {
    text: 'input',
    textarea: 'textarea',
    number: 'input',
    currency: 'input',
    percent: 'input',
    date: 'date-picker',
    datetime: 'date-picker',
    boolean: 'switch',
    select: 'select',
    email: 'input',
    url: 'input',
    password: 'input',
    lookup: 'select',
    master_detail: 'select',
    fileupload: 'file-upload',
  };

  return typeMap[fieldType] || 'input';
}
