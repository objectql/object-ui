/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SplitForm Component
 * 
 * A form variant that displays sections in a resizable split-panel layout.
 * The first section renders in the left/top panel, remaining sections in the right/bottom panel.
 * Aligns with @objectstack/spec FormView type: 'split'
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { FormField, DataSource } from '@object-ui/types';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
  cn,
} from '@object-ui/components';
import { FormSection } from './FormSection';
import { SchemaRenderer, useSafeFieldLabel } from '@object-ui/react';
import { mapFieldTypeToFormType, buildValidationRules } from '@object-ui/fields';

export interface SplitFormSectionConfig {
  name?: string;
  label?: string;
  description?: string;
  columns?: 1 | 2 | 3 | 4;
  fields: (string | FormField)[];
}

export interface SplitFormSchema {
  type: 'object-form';
  formType: 'split';
  objectName: string;
  mode: 'create' | 'edit' | 'view';
  recordId?: string | number;
  sections: SplitFormSectionConfig[];
  
  /**
   * Split direction.
   * @default 'horizontal'
   */
  splitDirection?: 'horizontal' | 'vertical';
  
  /**
   * Size of the first panel (percentage 1-99).
   * @default 50
   */
  splitSize?: number;
  
  /**
   * Whether panels can be resized.
   * @default true
   */
  splitResizable?: boolean;

  // Common form props
  showSubmit?: boolean;
  submitText?: string;
  showCancel?: boolean;
  cancelText?: string;
  initialValues?: Record<string, any>;
  initialData?: Record<string, any>;
  readOnly?: boolean;
  onSuccess?: (data: any) => void | Promise<void>;
  onError?: (error: Error) => void;
  onCancel?: () => void;
  className?: string;
}

export interface SplitFormProps {
  schema: SplitFormSchema;
  dataSource?: DataSource;
  className?: string;
}

export const SplitForm: React.FC<SplitFormProps> = ({
  schema,
  dataSource,
  className,
}) => {
  const { fieldLabel } = useSafeFieldLabel();
  const [objectSchema, setObjectSchema] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch object schema
  useEffect(() => {
    const fetchSchema = async () => {
      if (!dataSource) {
        setLoading(false);
        return;
      }
      try {
        const data = await dataSource.getObjectSchema(schema.objectName);
        setObjectSchema(data);
      } catch (err) {
        setError(err as Error);
        setLoading(false);
      }
    };
    fetchSchema();
  }, [schema.objectName, dataSource]);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      if (schema.mode === 'create' || !schema.recordId) {
        setFormData(schema.initialData || schema.initialValues || {});
        setLoading(false);
        return;
      }

      if (!dataSource) {
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
  const buildSectionFields = useCallback((section: SplitFormSectionConfig): FormField[] => {
    const fields: FormField[] = [];

    for (const fieldDef of section.fields) {
      const fieldName = typeof fieldDef === 'string' ? fieldDef : fieldDef.name;

      if (typeof fieldDef === 'object') {
        fields.push(fieldDef);
      } else if (objectSchema?.fields?.[fieldName]) {
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

  // Split sections: first section in panel 1, rest in panel 2
  const leftSections = useMemo(() => schema.sections.slice(0, 1), [schema.sections]);
  const rightSections = useMemo(() => schema.sections.slice(1), [schema.sections]);

  // Collect all fields for a unified form submission
  const allFields: FormField[] = useMemo(
    () => schema.sections.flatMap(section => buildSectionFields(section)),
    [schema.sections, buildSectionFields]
  );

  const direction = schema.splitDirection || 'horizontal';
  const panelSize = schema.splitSize || 50;

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

  // Build base form schema for SchemaRenderer
  const baseFormSchema = {
    type: 'form' as const,
    layout: 'vertical' as const,
    defaultValues: formData,
    onSubmit: handleSubmit,
    onCancel: handleCancel,
  };

  const renderSections = (sections: SplitFormSectionConfig[], showButtons: boolean) => (
    <div className="space-y-4 p-4">
      {sections.map((section, index) => (
        <FormSection
          key={section.name || section.label || index}
          label={section.label}
          description={section.description}
          columns={section.columns || 1}
        >
          <SchemaRenderer
            schema={{
              ...baseFormSchema,
              fields: buildSectionFields(section),
              showSubmit: showButtons && schema.showSubmit !== false && schema.mode !== 'view',
              showCancel: showButtons && schema.showCancel !== false,
              submitLabel: schema.submitText || (schema.mode === 'create' ? 'Create' : 'Update'),
              cancelLabel: schema.cancelText,
            }}
          />
        </FormSection>
      ))}
    </div>
  );

  return (
    <div className={cn('w-full', className, schema.className)}>
      <ResizablePanelGroup orientation={direction as 'horizontal' | 'vertical'} className="min-h-[300px] rounded-lg border">
        {/* Left / Top Panel */}
        <ResizablePanel defaultSize={panelSize} minSize={20}>
          {renderSections(leftSections, rightSections.length === 0)}
        </ResizablePanel>

        {rightSections.length > 0 && (
          <>
            <ResizableHandle withHandle={schema.splitResizable !== false} />

            {/* Right / Bottom Panel */}
            <ResizablePanel defaultSize={100 - panelSize} minSize={20}>
              {renderSections(rightSections, true)}
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
};

export default SplitForm;
