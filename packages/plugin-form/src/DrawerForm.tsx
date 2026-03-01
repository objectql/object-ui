/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * DrawerForm Component
 * 
 * A form variant that renders inside a slide-out Sheet (drawer) panel.
 * Aligns with @objectstack/spec FormView type: 'drawer'
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { FormField, DataSource } from '@object-ui/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  cn,
} from '@object-ui/components';
import { FormSection } from './FormSection';
import { SchemaRenderer, useSafeFieldLabel } from '@object-ui/react';
import { mapFieldTypeToFormType, buildValidationRules } from '@object-ui/fields';
import { applyAutoLayout } from './autoLayout';

/**
 * Container-query-based grid classes for form field layout.
 * Uses @container / @md: / @2xl: / @4xl: variants so that the grid
 * responds to the drawer's actual width instead of the viewport.
 */
const CONTAINER_GRID_COLS: Record<number, string | undefined> = {
  1: undefined,
  2: 'grid gap-4 grid-cols-1 @md:grid-cols-2',
  3: 'grid gap-4 grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-3',
  4: 'grid gap-4 grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-4',
};

export interface DrawerFormSectionConfig {
  name?: string;
  label?: string;
  description?: string;
  columns?: 1 | 2 | 3 | 4;
  fields: (string | FormField)[];
}

export interface DrawerFormSchema {
  type: 'object-form';
  formType: 'drawer';
  objectName: string;
  mode: 'create' | 'edit' | 'view';
  recordId?: string | number;
  title?: string;
  description?: string;
  sections?: DrawerFormSectionConfig[];
  fields?: string[];
  customFields?: FormField[];

  /**
   * Whether the drawer is open.
   * @default true
   */
  open?: boolean;

  /**
   * Callback when open state changes.
   */
  onOpenChange?: (open: boolean) => void;

  /**
   * Drawer side.
   * @default 'right'
   */
  drawerSide?: 'top' | 'bottom' | 'left' | 'right';

  /**
   * Drawer width (CSS value for left/right, or height for top/bottom).
   * Applied via className overrides since Sheet uses cva variants.
   * @default undefined (uses Sheet default)
   */
  drawerWidth?: string;

  // Common form props
  showSubmit?: boolean;
  submitText?: string;
  showCancel?: boolean;
  cancelText?: string;
  initialValues?: Record<string, any>;
  initialData?: Record<string, any>;
  readOnly?: boolean;
  layout?: 'vertical' | 'horizontal';
  columns?: number;
  onSuccess?: (data: any) => void | Promise<void>;
  onError?: (error: Error) => void;
  onCancel?: () => void;
  className?: string;
}

export interface DrawerFormProps {
  schema: DrawerFormSchema;
  dataSource?: DataSource;
  className?: string;
}

export const DrawerForm: React.FC<DrawerFormProps> = ({
  schema,
  dataSource,
  className,
}) => {
  const { fieldLabel } = useSafeFieldLabel();
  const [objectSchema, setObjectSchema] = useState<any>(null);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const isOpen = schema.open !== false;
  const side = schema.drawerSide || 'right';

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
  const buildSectionFields = useCallback((section: DrawerFormSectionConfig): FormField[] => {
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

  // Build fields from flat field list (when no sections provided)
  useEffect(() => {
    if (!objectSchema && dataSource) return;

    if (schema.customFields?.length) {
      setFormFields(schema.customFields);
      setLoading(false);
      return;
    }

    if (schema.sections?.length) {
      // Fields are built per-section in the render
      setLoading(false);
      return;
    }

    if (!objectSchema) return;

    const fieldsToShow = schema.fields || Object.keys(objectSchema.fields || {});
    const generated: FormField[] = [];

    for (const fieldName of fieldsToShow) {
      const name = typeof fieldName === 'string' ? fieldName : (fieldName as any).name;
      if (!name) continue;
      const field = objectSchema.fields?.[name];
      if (!field) continue;

      generated.push({
        name,
        label: fieldLabel(schema.objectName, name, field.label || name),
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
    }

    setFormFields(generated);
    setLoading(false);
  }, [objectSchema, schema.fields, schema.customFields, schema.sections, schema.readOnly, schema.mode, dataSource]);

  // Handle form submission
  const handleSubmit = useCallback(async (data: Record<string, any>) => {
    if (!dataSource) {
      if (schema.onSuccess) {
        await schema.onSuccess(data);
      }
      // Close drawer on success
      schema.onOpenChange?.(false);
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
      // Close drawer on success
      schema.onOpenChange?.(false);
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
    // Close drawer on cancel
    schema.onOpenChange?.(false);
  }, [schema]);

  // Width style for the drawer content
  const widthStyle = useMemo(() => {
    if (!schema.drawerWidth) return undefined;
    const isHorizontal = side === 'left' || side === 'right';
    return isHorizontal
      ? { width: schema.drawerWidth, maxWidth: schema.drawerWidth }
      : { height: schema.drawerWidth, maxHeight: schema.drawerWidth };
  }, [schema.drawerWidth, side]);

  const formLayout = (schema.layout === 'vertical' || schema.layout === 'horizontal')
    ? schema.layout
    : 'vertical';

  // Build base form schema
  const baseFormSchema = {
    type: 'form' as const,
    layout: formLayout,
    defaultValues: formData,
    submitLabel: schema.submitText || (schema.mode === 'create' ? 'Create' : 'Update'),
    cancelLabel: schema.cancelText,
    showSubmit: schema.showSubmit !== false && schema.mode !== 'view',
    showCancel: schema.showCancel !== false,
    onSubmit: handleSubmit,
    onCancel: handleCancel,
  };

  const renderContent = () => {
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

    // Sections layout
    if (schema.sections?.length) {
      return (
        <div className="space-y-6">
          {schema.sections.map((section, index) => {
            const sectionCols = section.columns || 1;
            return (
              <FormSection
                key={section.name || section.label || index}
                label={section.label}
                description={section.description}
                columns={sectionCols}
                gridClassName={CONTAINER_GRID_COLS[sectionCols]}
              >
                <SchemaRenderer
                  schema={{
                    ...baseFormSchema,
                    fields: buildSectionFields(section),
                    showSubmit: index === schema.sections!.length - 1 && baseFormSchema.showSubmit,
                    showCancel: index === schema.sections!.length - 1 && baseFormSchema.showCancel,
                  }}
                />
              </FormSection>
            );
          })}
        </div>
      );
    }

    // Apply auto-layout for flat fields (infer columns + colSpan)
    const autoLayoutResult = applyAutoLayout(formFields, objectSchema, schema.columns, schema.mode);

    // Flat fields layout — use container-query grid classes so the form
    // responds to the drawer width, not the viewport width.
    const containerFieldClass = CONTAINER_GRID_COLS[autoLayoutResult.columns || 1];

    return (
      <SchemaRenderer
        schema={{
          ...baseFormSchema,
          fields: autoLayoutResult.fields,
          columns: autoLayoutResult.columns,
          ...(containerFieldClass ? { fieldContainerClass: containerFieldClass } : {}),
        }}
      />
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={schema.onOpenChange}>
      <SheetContent
        side={side}
        className={cn('overflow-y-auto', className, schema.className)}
        style={widthStyle}
      >
        {(schema.title || schema.description) && (
          <SheetHeader>
            {schema.title && <SheetTitle>{schema.title}</SheetTitle>}
            {schema.description && <SheetDescription>{schema.description}</SheetDescription>}
          </SheetHeader>
        )}

        <div className="@container py-4">
          {renderContent()}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default DrawerForm;
