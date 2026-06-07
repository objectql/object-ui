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

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { ObjectFormSchema, FormField, FormSchema, DataSource } from '@object-ui/types';
import { SchemaRenderer, useSafeFieldLabel } from '@object-ui/react';
import { mapFieldTypeToFormType, buildValidationRules, evaluateCondition, formatFileSize } from '@object-ui/fields';
import { useIsMobile } from '@object-ui/components';
import { usePermissions } from '@object-ui/permissions';
import { TabbedForm } from './TabbedForm';
import { WizardForm } from './WizardForm';
import { SplitForm } from './SplitForm';
import { DrawerForm } from './DrawerForm';
import { ModalForm } from './ModalForm';
import { MasterDetailForm } from './MasterDetailForm';
import { FormSection } from './FormSection';
import { applyAutoLayout } from './autoLayout';

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
  schema: rawSchema,
  dataSource,
}) => {
  const perms = usePermissions();
  // Apply field-level permissions to the entire schema (sections + flat
  // fields) BEFORE dispatching to any variant. This way all variants
  // (Tabbed/Wizard/Split/Drawer/Modal/Simple) transparently honour FLS.
  // Fail-open when no provider mounted (perms.isLoaded false).
  const schema = useMemo<ObjectFormProps['schema']>(() => {
    if (!perms?.isLoaded) return rawSchema;
    const gateField = (f: any) => {
      if (!f?.name) return f;
      const canRead = perms.checkField(rawSchema.objectName, f.name, 'read');
      if (!canRead) return null;
      const canWrite = perms.checkField(rawSchema.objectName, f.name, 'write');
      if (!canWrite && rawSchema.mode !== 'view') {
        return { ...f, readOnly: true, disabled: true };
      }
      return f;
    };
    const filterArr = (arr?: any[]) =>
      Array.isArray(arr) ? arr.map(gateField).filter(Boolean) : arr;
    return {
      ...rawSchema,
      fields: filterArr(rawSchema.fields as any[]),
      sections: rawSchema.sections?.map((s: any) => ({
        ...s,
        fields: filterArr(s.fields),
      })),
    } as ObjectFormProps['schema'];
  }, [rawSchema, perms]);
  const { sectionLabel } = useSafeFieldLabel();
  const tSec = (s: any) =>
    s?.name ? sectionLabel(schema.objectName, s.name, s.label || s.name) : s?.label;

  // Master-detail: when the schema declares inline child collections, render as
  // a master-detail form (parent fields + child grids, persisted atomically).
  // This lets a plain form view become master-detail by config — no bespoke
  // page. Skipped in view mode (read-only detail uses related lists instead).
  // For drawer/modal formTypes we fall through to DrawerForm/ModalForm, which
  // host the master-detail form INSIDE their envelope.
  if ((schema as any).subforms?.length && schema.mode !== 'view'
      && schema.formType !== 'drawer' && schema.formType !== 'modal') {
    return (
      <MasterDetailForm
        schema={{
          type: 'object-master-detail-form',
          objectName: schema.objectName,
          mode: schema.mode === 'edit' ? 'edit' : 'create',
          recordId: schema.recordId,
          formType: schema.formType === 'tabbed' ? 'tabbed' : 'simple',
          sections: schema.sections as any,
          fields: schema.fields as any,
          title: schema.title,
          submitText: schema.submitText,
          details: (schema as any).subforms,
          onSuccess: schema.onSuccess,
          onError: schema.onError,
          onCancel: schema.onCancel,
          className: schema.className,
        }}
        dataSource={dataSource}
      />
    );
  }

  // Route to specialized form variant based on formType
  if (schema.formType === 'tabbed' && schema.sections?.length) {
    return (
      <TabbedForm
        schema={{
          ...schema,
          formType: 'tabbed',
          sections: schema.sections.map(s => ({
            name: s.name,
            label: tSec(s),
            description: s.description,
            columns: s.columns,
            fields: s.fields,
          })),
          defaultTab: schema.defaultTab,
          tabPosition: schema.tabPosition,
        }}
        dataSource={dataSource}
        className={schema.className}
      />
    );
  }

  if (schema.formType === 'wizard' && schema.sections?.length) {
    return (
      <WizardForm
        schema={{
          ...schema,
          formType: 'wizard',
          sections: schema.sections.map(s => ({
            name: s.name,
            label: tSec(s),
            description: s.description,
            columns: s.columns,
            fields: s.fields,
          })),
          allowSkip: schema.allowSkip,
          showStepIndicator: schema.showStepIndicator,
          nextText: schema.nextText,
          prevText: schema.prevText,
          onStepChange: schema.onStepChange,
        }}
        dataSource={dataSource}
        className={schema.className}
      />
    );
  }

  if (schema.formType === 'split' && schema.sections?.length) {
    return (
      <SplitForm
        schema={{
          ...schema,
          formType: 'split',
          sections: schema.sections.map(s => ({
            name: s.name,
            label: tSec(s),
            description: s.description,
            columns: s.columns,
            fields: s.fields,
          })),
          splitDirection: schema.splitDirection,
          splitSize: schema.splitSize,
          splitResizable: schema.splitResizable,
        }}
        dataSource={dataSource}
        className={schema.className}
      />
    );
  }

  if (schema.formType === 'drawer') {
    const { layout: _layout, ...drawerRest } = schema;
    const drawerLayout = (schema.layout === 'vertical' || schema.layout === 'horizontal') ? schema.layout : undefined;
    return (
      <DrawerForm
        schema={{
          ...drawerRest,
          layout: drawerLayout,
          formType: 'drawer',
          sections: schema.sections?.map(s => ({
            name: s.name,
            label: tSec(s),
            description: s.description,
            columns: s.columns,
            fields: s.fields,
            collapsible: (s as any).collapsible,
            collapsed: (s as any).collapsed,
          })),
          open: schema.open,
          onOpenChange: schema.onOpenChange,
          drawerSide: schema.drawerSide,
          drawerWidth: schema.drawerWidth,
        }}
        dataSource={dataSource}
        className={schema.className}
      />
    );
  }

  if (schema.formType === 'modal') {
    const { layout: _layout2, ...modalRest } = schema;
    const modalLayout = (schema.layout === 'vertical' || schema.layout === 'horizontal') ? schema.layout : undefined;
    return (
      <ModalForm
        schema={{
          ...modalRest,
          layout: modalLayout,
          formType: 'modal',
          sections: schema.sections?.map(s => ({
            name: s.name,
            label: tSec(s),
            description: s.description,
            columns: s.columns,
            fields: s.fields,
          })),
          open: schema.open,
          onOpenChange: schema.onOpenChange,
          modalSize: schema.modalSize,
          modalCloseButton: schema.modalCloseButton,
        }}
        dataSource={dataSource}
        className={schema.className}
      />
    );
  }

  // Default: simple form
  return <SimpleObjectForm schema={schema} dataSource={dataSource} />;
};

/**
 * SimpleObjectForm — default form variant with auto-generated fields from ObjectQL schema.
 */
const SimpleObjectForm: React.FC<ObjectFormProps> = ({
  schema,
  dataSource,
}) => {
  const { fieldLabel, sectionLabel } = useSafeFieldLabel();
  const isMobile = useIsMobile();
  // Field-level permission gate. When the consumer hasn't mounted a
  // PermissionProvider / MePermissionsProvider, `usePermissions` returns
  // a permissive default (isLoaded:false, checkField always true) so we
  // remain backward-compatible.
  const perms = usePermissions();
  const applyFieldPerms = useCallback(
    (fields: FormField[]): FormField[] => {
      if (!perms?.isLoaded) return fields;
      const out: FormField[] = [];
      for (const f of fields) {
        const canRead = perms.checkField(schema.objectName, f.name, 'read');
        if (!canRead) continue; // omit hidden fields entirely
        const canWrite = perms.checkField(schema.objectName, f.name, 'write');
        if (!canWrite && schema.mode !== 'view') {
          out.push({
            ...f,
            readOnly: true,
            disabled: true,
            description: f.description ?? 'You do not have edit access to this field.',
          });
        } else {
          out.push(f);
        }
      }
      return out;
    },
    [perms, schema.objectName, schema.mode],
  );

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
        if (!schemaData) {
          throw new Error(`No schema found for object "${schema.objectName}"`);
        }
        setObjectSchema(schemaData);
      } catch (err) {
        setError(err as Error);
        setLoading(false);
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
    } else if (!hasInlineFields) {
      // No objectName or dataSource and no inline fields — cannot proceed
      setLoading(false);
    }
  }, [schema.objectName, dataSource, hasInlineFields]);

  // Fetch initial data for edit/view modes (skip if using inline data)
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!schema.recordId || schema.mode === 'create') {
        setInitialData(schema.initialData || schema.initialValues || {});
        setLoading(false);
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

  // Normalize a single FormField: if it carries a string `visibleOn`
  // (spec FormFieldSchema CEL expression — see packages/spec FormFieldSchema),
  // convert it to a reactive `visible(formData)` predicate so plugin-form
  // variants honor live field-level visibility. Mirrors the schema-derived
  // `field.visible_on` branch below.
  const normalizeVisibility = useCallback((f: any): any => {
    if (!f || typeof f.visible === 'function') return f;
    const expr = f.visibleOn;
    if (typeof expr === 'string' && expr.trim()) {
      return {
        ...f,
        visible: (formData: any) => evaluateCondition(expr, formData),
      };
    }
    return f;
  }, []);

  // Generate form fields from object schema or inline fields
  useEffect(() => {
    // For inline fields, use them directly
    if (hasInlineFields && schema.customFields) {
      setFormFields(schema.customFields.map(normalizeVisibility));
      setLoading(false);
      return;
    }

    if (!objectSchema) return;

    const generatedFields: FormField[] = [];
    
    // Determine which fields to include
    const fieldsToShow = schema.fields || Object.keys(objectSchema.fields || {});
    
    // Support object format for fields in schema (legacy/compat)
    const fieldNames = Array.isArray(fieldsToShow) 
        ? fieldsToShow 
        : Object.keys(fieldsToShow);

    fieldNames.forEach((fieldName) => {
      // If fieldsToShow is an array of strings, fieldName is the string
      // If fieldsToShow is array of objects (unlikely but possible in some formats), we need to extract name
      const name = typeof fieldName === 'string' ? fieldName : (fieldName as any).name;
      if (!name) return;

      const field = objectSchema.fields?.[name];
      if (!field && !hasInlineFields) return; // Skip if not found in object definition unless inline

      // Check field-level permissions for create/edit modes
      const hasWritePermission = !field?.permissions || field?.permissions.write !== false;
      if (schema.mode !== 'view' && !hasWritePermission) return; // Skip fields without write permission

      // Check if there's a custom field configuration
      const customField = schema.customFields?.find(f => f.name === name);
      
      if (customField) {
        generatedFields.push(normalizeVisibility(customField));
      } else if (field) {
        // Auto-generate field from schema
        const formField: FormField = {
          name: name,
          label: fieldLabel(schema.objectName, name, field.label || fieldName),
          type: mapFieldTypeToFormType(field.type),
          required: field.required || false,
          disabled: schema.readOnly || schema.mode === 'view' || field.readonly || (objectSchema?.managedBy && objectSchema.managedBy !== 'platform'),
          placeholder: field.placeholder,
          description: field.help || field.description,
          validation: buildValidationRules(field),
          // Field-level CEL conditional rules (B2). Carried through verbatim so
          // the form renderer evaluates them reactively via the canonical
          // engine (same dialect the server enforces). Undefined when absent.
          visibleWhen: field.visibleWhen,
          readonlyWhen: field.readonlyWhen,
          requiredWhen: field.requiredWhen ?? field.conditionalRequired,
          // Important: Pass the original field metadata so widgets can access properties like precision, currency, etc.
          field: field,
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

        if (field.type === 'date') {
          formField.inputType = 'date';
        }

        if (field.type === 'datetime') {
          formField.inputType = 'datetime-local';
        }

        if (field.type === 'text' || field.type === 'textarea' || field.type === 'markdown' || field.type === 'html') {
          formField.maxLength = field.max_length;
          formField.minLength = field.min_length;
        }

        if (field.type === 'file' || field.type === 'image') {
          formField.inputType = 'file';
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

    // Only set loading to false if we are not going to fetch data
    // This prevents a flash of empty form before data is loaded in edit mode
    const willFetchData = !hasInlineFields && (schema.recordId && schema.mode !== 'create' && dataSource);
    if (!willFetchData) {
      setLoading(false);
    }
  }, [objectSchema, schema.fields, schema.customFields, schema.readOnly, schema.mode, hasInlineFields, schema.recordId, dataSource]);

  // Handle form submission
  const handleSubmit = useCallback(async (formData: any, e?: any) => {
    // If we receive an event as the first argument, it means the Form renderer passed the event instead of data
    // This happens when react-hook-form's handleSubmit is bypassed or configured incorrectly
    if (formData && (formData.nativeEvent || formData._reactName === 'onSubmit')) {
      console.warn('ObjectForm: Received Event instead of data in handleSubmit! This suggests a Form renderer issue.');
      // Proceed defensively - we can't do much if we don't have data, but let's try to not crash
      // If we are here, formData is actually the event
      if (e === undefined) {
         e = formData;
         formData = {}; // Reset to empty object or we try to submit the Event object
      }
    }

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

    // Strip non-editable fields from the payload (FLS — never trust the
    // client form state; if the user lacked edit access we MUST NOT
    // include the field in the create/update request).
    let payload = formData;
    if (perms?.isLoaded && formData && typeof formData === 'object') {
      payload = {} as Record<string, unknown>;
      for (const k of Object.keys(formData)) {
        if (perms.checkField(schema.objectName, k, 'write')) {
          (payload as Record<string, unknown>)[k] = formData[k];
        }
      }
    }

    try {
      let result;

      if (schema.submitHandler) {
        // The host owns persistence (e.g. MasterDetailForm batching the parent
        // + children into one atomic transaction). The form just validates and
        // hands over the values; it does NOT create/update itself.
        result = await schema.submitHandler(payload);
      } else if (schema.mode === 'create') {
        result = await dataSource.create(schema.objectName, payload);
      } else if (schema.mode === 'edit' && schema.recordId) {
        result = await dataSource.update(schema.objectName, schema.recordId, payload);
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
  }, [schema, dataSource, hasInlineFields, perms]);

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
      <div className="p-3 sm:p-4 border border-red-300 bg-red-50 rounded-md">
        <h3 className="text-red-800 font-semibold">Error loading form</h3>
        <p className="text-red-600 text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  // Render loading state
  if (loading) {
    return (
      <div className="p-4 sm:p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <p className="mt-2 text-sm text-gray-600">Loading form...</p>
      </div>
    );
  }

  // Convert to FormSchema
  // Note: FormSchema currently only supports 'vertical' and 'horizontal' layouts
  // Map 'grid' and 'inline' to 'vertical' as fallback
  const formLayout = (schema.layout === 'vertical' || schema.layout === 'horizontal') 
    ? schema.layout 
    : 'vertical';

  // If sections are provided for the simple form, render with FormSection grouping
  if (schema.sections?.length && (!schema.formType || schema.formType === 'simple')) {
    return (
      <div className="w-full space-y-6">
        {schema.sections.map((section, index) => {
          // Filter formFields to only include fields in this section
          const sectionFieldNames = section.fields.map(f => typeof f === 'string' ? f : f.name);
          const sectionFields = applyFieldPerms(formFields.filter(f => sectionFieldNames.includes(f.name)));
          
          return (
            <FormSection
              key={section.name || section.label || index}
              label={section.name ? sectionLabel(schema.objectName, section.name, section.label || section.name) : section.label}
              description={section.description}
              collapsible={section.collapsible}
              collapsed={section.collapsed}
              columns={section.columns}
              showBorder={(section as any).showBorder}
            >
              <SchemaRenderer
                schema={{
                  type: 'form',
                  fields: sectionFields,
                  layout: formLayout,
                  defaultValues: finalDefaultValues,
                  // Only show action buttons after the last section
                  showSubmit: index === schema.sections!.length - 1 && schema.showSubmit !== false && schema.mode !== 'view',
                  showCancel: index === schema.sections!.length - 1 && schema.showCancel !== false,
                  submitLabel: schema.submitText || (schema.mode === 'create' ? 'Create' : 'Update'),
                  cancelLabel: schema.cancelText,
                  onSubmit: handleSubmit,
                  onCancel: handleCancel,
                } as FormSchema}
              />
            </FormSection>
          );
        })}
      </div>
    );
  }

  // Apply auto-layout: infer columns and colSpan when not explicitly configured
  const hasSections = schema.sections?.length;
  const gatedFormFields = applyFieldPerms(formFields);
  const autoLayoutResult = !hasSections
    ? applyAutoLayout(gatedFormFields, objectSchema, schema.columns, schema.mode)
    : { fields: gatedFormFields, columns: schema.columns };

  // ----- Mobile UX (round 3) -----
  // 1) Propagate fullscreen-textarea opt-in to each textarea field so the
  //    field widget can render its expand affordance + dialog.
  const mobileOpts = schema.mobile;
  const fieldsWithMobile = mobileOpts?.fullscreenLongText
    ? autoLayoutResult.fields.map((f) => {
        const t = f.type as string | undefined;
        const isTextarea = t === 'textarea' || t === 'field:textarea' ||
          t === 'string-multiline' || t === 'field:markdown' || t === 'field:html';
        return isTextarea ? ({ ...f, mobile_fullscreen: true } as FormField) : f;
      })
    : autoLayoutResult.fields;

  // 2) Auto-stepper: when explicitly enabled, OR when set to 'auto' on a
  //    long form on a small viewport, route the flat field list through
  //    WizardForm with one (or a few) fields per step.
  const stepperMode = mobileOpts?.stepper;
  const stepperMin = mobileOpts?.stepperMinFields ?? 8;
  const fieldsPerStep = Math.max(1, mobileOpts?.stepperFieldsPerStep ?? 1);
  const wantsStepper =
    !schema.formType &&
    !hasSections &&
    fieldsWithMobile.length >= 2 &&
    (
      stepperMode === true ||
      (stepperMode === 'auto' && isMobile && fieldsWithMobile.length >= stepperMin)
    );

  if (wantsStepper) {
    const visibleFields = fieldsWithMobile;
    const syntheticSections = [] as Array<{ name: string; label?: string; fields: FormField[] }>;
    for (let i = 0; i < visibleFields.length; i += fieldsPerStep) {
      const chunk = visibleFields.slice(i, i + fieldsPerStep);
      syntheticSections.push({
        name: `step-${Math.floor(i / fieldsPerStep) + 1}`,
        label: chunk[0]?.label || chunk[0]?.name || `Step ${Math.floor(i / fieldsPerStep) + 1}`,
        fields: chunk,
      });
    }
    return (
      <WizardForm
        schema={{
          ...schema,
          formType: 'wizard',
          sections: syntheticSections,
          showStepIndicator: true,
        } as any}
        dataSource={dataSource}
        className={schema.className}
      />
    );
  }

  // Default flat form (no sections)
  const formSchema: FormSchema = {
    type: 'form',
    fields: fieldsWithMobile,
    layout: formLayout,
    columns: autoLayoutResult.columns,
    submitLabel: schema.submitText || (schema.mode === 'create' ? 'Create' : 'Update'),
    cancelLabel: schema.cancelText,
    showSubmit: schema.showSubmit !== false && schema.mode !== 'view',
    showCancel: schema.showCancel !== false,
    resetOnSubmit: schema.showReset,
    defaultValues: finalDefaultValues,
    onSubmit: handleSubmit,
    onCancel: handleCancel,
    className: schema.className,
    mobileStickyActions: Boolean(mobileOpts?.stickyActions),
  };

  return (
    <div
      className={mobileOpts?.stickyActions ? 'w-full pb-20 md:pb-0' : 'w-full'}
      data-mobile-form={mobileOpts ? 'true' : undefined}
    >
      <SchemaRenderer schema={formSchema} />
    </div>
  );
};

