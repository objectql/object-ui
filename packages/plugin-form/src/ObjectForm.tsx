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
import { mapFieldTypeToFormType, buildValidationRules, evaluateCondition, formatFileSize } from '@object-ui/fields';

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
          formField.inputType = 'number';
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
    console.log('ObjectForm submitting data:', formData);
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

  // Calculate default values from schema fields
  const schemaDefaultValues = React.useMemo(() => {
    if (!objectSchema?.fields) return {};
    const defaults: Record<string, any> = {};
    Object.keys(objectSchema.fields).forEach(key => {
        const field = objectSchema.fields[key];
        if (field.defaultValue !== undefined) {
            defaults[key] = field.defaultValue;
        }
    });
    return defaults;
  }, [objectSchema]);

  const finalDefaultValues = {
     ...schemaDefaultValues,
     ...initialData
  };

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
    defaultValues: finalDefaultValues,
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

