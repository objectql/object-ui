/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * TabbedForm Component
 * 
 * A form component that organizes sections into tabs.
 * Aligns with @objectstack/spec FormView type: 'tabbed'
 */

import React, { useState, useCallback } from 'react';
import type { FormField, DataSource } from '@object-ui/types';
import { Tabs, TabsContent, TabsList, TabsTrigger, cn } from '@object-ui/components';
import { FormSection } from './FormSection';
import { SchemaRenderer, useSafeFieldLabel } from '@object-ui/react';
import { mapFieldTypeToFormType, buildValidationRules } from '@object-ui/fields';

export interface FormSectionConfig {
  /**
   * Section identifier (used as tab value)
   */
  name?: string;
  
  /**
   * Section label (used as tab trigger text)
   */
  label?: string;
  
  /**
   * Section description
   */
  description?: string;
  
  /**
   * Number of columns in the section
   * @default 1
   */
  columns?: 1 | 2 | 3 | 4;
  
  /**
   * Field names or configurations in this section
   */
  fields: (string | FormField)[];
}

export interface TabbedFormSchema {
  type: 'object-form';
  formType: 'tabbed';
  
  /**
   * Object name for ObjectQL schema lookup
   */
  objectName: string;
  
  /**
   * Form mode
   */
  mode: 'create' | 'edit' | 'view';
  
  /**
   * Record ID (for edit/view modes)
   */
  recordId?: string | number;
  
  /**
   * Tab sections configuration
   */
  sections: FormSectionConfig[];
  
  /**
   * Default active tab (section name)
   */
  defaultTab?: string;
  
  /**
   * Tab position
   * @default 'top'
   */
  tabPosition?: 'top' | 'bottom' | 'left' | 'right';
  
  /**
   * Show submit button
   * @default true
   */
  showSubmit?: boolean;
  
  /**
   * Submit button text
   */
  submitText?: string;
  
  /**
   * Show cancel button
   * @default true
   */
  showCancel?: boolean;
  
  /**
   * Cancel button text
   */
  cancelText?: string;
  
  /**
   * Initial values
   */
  initialValues?: Record<string, any>;
  
  /**
   * Initial data (alias for initialValues)
   */
  initialData?: Record<string, any>;
  
  /**
   * Read-only mode
   */
  readOnly?: boolean;
  
  /**
   * Callbacks
   */
  onSuccess?: (data: any) => void | Promise<void>;
  onError?: (error: Error) => void;
  onCancel?: () => void;
  
  /**
   * CSS class
   */
  className?: string;
}

export interface TabbedFormProps {
  schema: TabbedFormSchema;
  dataSource?: DataSource;
  className?: string;
}

/**
 * TabbedForm Component
 * 
 * Renders a form with sections organized as tabs.
 * 
 * @example
 * ```tsx
 * <TabbedForm
 *   schema={{
 *     type: 'object-form',
 *     formType: 'tabbed',
 *     objectName: 'contacts',
 *     mode: 'create',
 *     sections: [
 *       { label: 'Basic Info', fields: ['firstName', 'lastName', 'email'] },
 *       { label: 'Address', fields: ['street', 'city', 'country'] },
 *     ]
 *   }}
 *   dataSource={dataSource}
 * />
 * ```
 */
export const TabbedForm: React.FC<TabbedFormProps> = ({
  schema,
  dataSource,
  className,
}) => {
  const { fieldLabel } = useSafeFieldLabel();
  const [objectSchema, setObjectSchema] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [activeTab, setActiveTab] = useState<string>(
    schema.defaultTab || schema.sections[0]?.name || schema.sections[0]?.label || 'tab-0'
  );

  // Fetch object schema
  React.useEffect(() => {
    const fetchSchema = async () => {
      if (!dataSource) {
        setLoading(false);
        return;
      }
      
      try {
        const schemaData = await dataSource.getObjectSchema(schema.objectName);
        setObjectSchema(schemaData);
      } catch (err) {
        setError(err as Error);
      }
    };
    
    fetchSchema();
  }, [schema.objectName, dataSource]);

  // Fetch initial data for edit/view modes
  React.useEffect(() => {
    const fetchData = async () => {
      if (schema.mode === 'create' || !schema.recordId || !dataSource) {
        setFormData(schema.initialData || schema.initialValues || {});
        setLoading(false);
        return;
      }
      
      try {
        const data = await dataSource.findOne(schema.objectName, schema.recordId);
        setFormData(data || {});
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };
    
    if (objectSchema || !dataSource) {
      fetchData();
    }
  }, [objectSchema, schema.mode, schema.recordId, schema.initialData, schema.initialValues, dataSource, schema.objectName]);

  // Build form fields from section config
  const buildSectionFields = useCallback((section: FormSectionConfig): FormField[] => {
    const fields: FormField[] = [];
    
    for (const fieldDef of section.fields) {
      const fieldName = typeof fieldDef === 'string' ? fieldDef : fieldDef.name;
      
      if (typeof fieldDef === 'object') {
        // Use the field definition directly
        fields.push(fieldDef);
      } else if (objectSchema?.fields?.[fieldName]) {
        // Build from object schema
        const field = objectSchema.fields[fieldName];
        fields.push({
          name: fieldName,
          label: fieldLabel(schema.objectName, fieldName, field.label || fieldName),
          type: mapFieldTypeToFormType(field.type),
          required: field.required || false,
          disabled: schema.readOnly || schema.mode === 'view' || field.readonly,
          placeholder: field.placeholder,
          description: field.help || field.description,
          validation: buildValidationRules(field),
          field: field,
          options: field.options,
          multiple: field.multiple,
        });
      } else {
        // Fallback for unknown fields
        fields.push({
          name: fieldName,
          label: fieldName,
          type: 'input',
        });
      }
    }
    
    return fields;
  }, [objectSchema, schema.readOnly, schema.mode]);

  // Handle form submission
  const handleSubmit = useCallback(async (data: Record<string, any>) => {
    if (!dataSource) {
      if (schema.onSuccess) {
        await schema.onSuccess(data);
      }
      return data;
    }

    try {
      let result;
      
      if (schema.mode === 'create') {
        result = await dataSource.create(schema.objectName, data);
      } else if (schema.mode === 'edit' && schema.recordId) {
        result = await dataSource.update(schema.objectName, schema.recordId, data);
      }
      
      if (schema.onSuccess) {
        await schema.onSuccess(result);
      }
      
      return result;
    } catch (err) {
      if (schema.onError) {
        schema.onError(err as Error);
      }
      throw err;
    }
  }, [schema, dataSource]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (schema.onCancel) {
      schema.onCancel();
    }
  }, [schema]);

  // Generate tab value
  const getTabValue = (section: FormSectionConfig, index: number): string => {
    return section.name || section.label || `tab-${index}`;
  };

  if (error) {
    return (
      <div className="p-4 border border-red-300 bg-red-50 rounded-md">
        <h3 className="text-red-800 font-semibold">Error loading form</h3>
        <p className="text-red-600 text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <p className="mt-2 text-sm text-gray-600">Loading form...</p>
      </div>
    );
  }

  // Collect all fields across all sections for the form
  const allFields: FormField[] = schema.sections.flatMap(section => buildSectionFields(section));

  // Build the overall form schema
  const formSchema = {
    type: 'form' as const,
    fields: allFields,
    layout: 'vertical' as const,
    defaultValues: formData,
    submitLabel: schema.submitText || (schema.mode === 'create' ? 'Create' : 'Update'),
    cancelLabel: schema.cancelText,
    showSubmit: schema.showSubmit !== false && schema.mode !== 'view',
    showCancel: schema.showCancel !== false,
    onSubmit: handleSubmit,
    onCancel: handleCancel,
  };

  // Determine orientation based on tabPosition
  const isVertical = schema.tabPosition === 'left' || schema.tabPosition === 'right';

  return (
    <div className={cn('w-full', className, schema.className)}>
      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab}
        orientation={isVertical ? 'vertical' : 'horizontal'}
        className={cn(isVertical && 'flex gap-4')}
      >
        <TabsList className={cn(
          isVertical ? 'flex-col h-auto' : '',
          schema.tabPosition === 'bottom' && 'order-last',
          schema.tabPosition === 'right' && 'order-last'
        )}>
          {schema.sections.map((section, index) => (
            <TabsTrigger
              key={getTabValue(section, index)}
              value={getTabValue(section, index)}
              className={isVertical ? 'w-full justify-start' : ''}
            >
              {section.label || `Tab ${index + 1}`}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex-1">
          {schema.sections.map((section, index) => (
            <TabsContent
              key={getTabValue(section, index)}
              value={getTabValue(section, index)}
              className="mt-0"
            >
              <FormSection
                description={section.description}
                columns={section.columns || 1}
              >
                {/* Render fields for this section */}
                <SchemaRenderer 
                  schema={{
                    ...formSchema,
                    fields: buildSectionFields(section),
                    // Only show buttons on the last tab or always visible
                    showSubmit: schema.showSubmit !== false && schema.mode !== 'view',
                    showCancel: schema.showCancel !== false,
                  }} 
                />
              </FormSection>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
};

export default TabbedForm;
