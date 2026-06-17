/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ModalForm Component
 * 
 * A form variant that renders inside a Dialog (modal) overlay.
 * Aligns with @objectstack/spec FormView type: 'modal'
 */

import React, { useState, useCallback, useEffect, useMemo, useId } from 'react';
import type { FormField, DataSource } from '@object-ui/types';
import {
  Dialog,
  MobileDialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Skeleton,
  Button,
  cn,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@object-ui/components';
import { Loader2 } from 'lucide-react';
import { FormSection } from './FormSection';
import { MasterDetailForm } from './MasterDetailForm';
import { SchemaRenderer, useSafeFieldLabel } from '@object-ui/react';
import { mapFieldTypeToFormType, buildValidationRules } from '@object-ui/fields';
import { buildSectionFields as buildSectionFieldsShared } from './sectionFields';
import { applyAutoLayout, inferModalSize } from './autoLayout';
import { sanitizeFormData } from './sanitize';
import { usePermissions } from '@object-ui/permissions';

export interface ModalFormSectionConfig {
  name?: string;
  label?: string;
  description?: string;
  columns?: 1 | 2 | 3 | 4;
  fields: (string | FormField)[];
}

export interface ModalFormSchema {
  type: 'object-form';
  formType: 'modal';
  objectName: string;
  mode: 'create' | 'edit' | 'view';
  recordId?: string | number;
  title?: string;
  description?: string;
  sections?: ModalFormSectionConfig[];
  /** Internal content layout (ADR-0050, #1890): 'tabbed' renders sections as
   *  tabs inside the modal, so "modal + tabbed" composes. Default stacks them. */
  contentLayout?: 'simple' | 'tabbed';
  fields?: string[];
  customFields?: FormField[];

  /**
   * Whether the modal is open.
   * @default true
   */
  open?: boolean;

  /**
   * Callback when open state changes.
   */
  onOpenChange?: (open: boolean) => void;

  /**
   * Modal dialog size.
   * @default 'default'
   */
  modalSize?: 'sm' | 'default' | 'lg' | 'xl' | 'full';

  /**
   * Whether to show a close button in the header.
   * @default true
   */
  modalCloseButton?: boolean;

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
  /** Inline child collections — renders the modal as an atomic master-detail
   *  form. Each entry needs only `childObject` (FK + columns derived). */
  subforms?: Array<{
    childObject: string;
    relationshipField?: string;
    columns?: any[];
    amountField?: string;
    totalField?: string;
    title?: string;
    addLabel?: string;
    minRows?: number;
    maxRows?: number;
  }>;
}

export interface ModalFormProps {
  schema: ModalFormSchema;
  dataSource?: DataSource;
  className?: string;
}

/**
 * Size class map for the dialog content.
 *
 * Uses `sm:` prefix so that `tailwind-merge` correctly resolves the conflict
 * with MobileDialogContent's base `sm:max-w-lg` class.  On mobile (< sm) the
 * dialog is already full-screen, so max-width only matters at sm+ breakpoints.
 */
const modalSizeClasses: Record<string, string> = {
  sm: 'sm:max-w-sm',
  default: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-5xl',
  full: 'sm:max-w-[95vw] sm:w-full',
};

/**
 * Container-query-based grid classes for form field layout.
 * Uses @container / @md: / @2xl: / @4xl: variants so that the grid
 * responds to the modal's actual width instead of the viewport,
 * ensuring single-column on narrow mobile modals regardless of viewport size.
 */
const CONTAINER_GRID_COLS: Record<number, string | undefined> = {
  1: undefined, // let the form renderer use its default (space-y-4)
  2: 'grid gap-4 grid-cols-1 @md:grid-cols-2',
  3: 'grid gap-4 grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-3',
  4: 'grid gap-4 grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-4',
};

export const ModalForm: React.FC<ModalFormProps> = ({
  schema,
  dataSource,
  className,
}) => {
  const { fieldLabel } = useSafeFieldLabel();
  const perms = usePermissions();
  // FLS gate: drop non-readable fields, disable non-editable ones.
  // Fail-open when no PermissionProvider mounted (perms.isLoaded false).
  const applyFieldPerms = useCallback(
    (fields: FormField[]): FormField[] => {
      if (!perms?.isLoaded) return fields;
      const out: FormField[] = [];
      for (const f of fields) {
        if (!f?.name) { out.push(f); continue; }
        const canRead = perms.checkField(schema.objectName, f.name, 'read');
        if (!canRead) continue;
        const canWrite = perms.checkField(schema.objectName, f.name, 'write');
        if (!canWrite && schema.mode !== 'view') {
          out.push({ ...f, readOnly: true, disabled: true });
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
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOpen = schema.open !== false;

  // Stable form id for linking the external submit button to the form element
  const formId = useId();

  // Compute auto-layout for flat fields (no sections) to determine inferred columns
  const autoLayoutResult = useMemo(() => {
    if (schema.sections?.length || schema.customFields?.length) return null;
    return applyAutoLayout(formFields, objectSchema, schema.columns, schema.mode);
  }, [formFields, objectSchema, schema.columns, schema.mode, schema.sections, schema.customFields]);

  // Auto-upgrade modal size when auto-layout infers multi-column and user hasn't set modalSize
  const effectiveModalSize = useMemo(() => {
    if (schema.modalSize) return schema.modalSize;
    if (autoLayoutResult?.columns && autoLayoutResult.columns > 1) {
      return inferModalSize(autoLayoutResult.columns);
    }
    // Auto-upgrade for sections: use the max columns across all sections
    if (schema.sections?.length) {
      const maxCols = Math.max(...schema.sections.map(s => Number(s.columns) || 1));
      if (maxCols > 1) return inferModalSize(maxCols);
    }
    return 'default';
  }, [schema.modalSize, autoLayoutResult, schema.sections]);

  const sizeClass = modalSizeClasses[effectiveModalSize] || modalSizeClasses.default;

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
  const buildSectionFields = useCallback(
    (section: ModalFormSectionConfig): FormField[] =>
      buildSectionFieldsShared(section as any, {
        objectSchema,
        objectName: schema.objectName,
        readOnly: schema.readOnly,
        mode: schema.mode,
        fieldLabel,
      }),
    [objectSchema, schema.readOnly, schema.mode, schema.objectName, fieldLabel],
  );

  // Build fields from flat field list (when no sections)
  useEffect(() => {
    if (!objectSchema && dataSource) return;

    if (schema.customFields?.length) {
      setFormFields(schema.customFields);
      setLoading(false);
      return;
    }

    if (schema.sections?.length) {
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
    setIsSubmitting(true);
    try {
      if (!dataSource) {
        if (schema.onSuccess) {
          await schema.onSuccess(data);
        }
        // Close modal on success
        schema.onOpenChange?.(false);
        return data;
      }

      let result;
      let payload = sanitizeFormData(data, objectSchema);
      // FLS defence-in-depth: strip non-editable fields from payload.
      // react-hook-form retains state for unmounted/disabled fields; we
      // must never trust the client to omit them.
      if (perms?.isLoaded) {
        const stripped: Record<string, any> = {};
        for (const k of Object.keys(payload)) {
          if (perms.checkField(schema.objectName, k, 'write')) stripped[k] = payload[k];
        }
        payload = stripped;
      }
      if (schema.mode === 'create') {
        result = await dataSource.create(schema.objectName, payload);
      } else if (schema.mode === 'edit' && schema.recordId) {
        result = await dataSource.update(schema.objectName, schema.recordId, payload);
      }
      if (schema.onSuccess) {
        await schema.onSuccess(result);
      }
      // Close modal on success
      schema.onOpenChange?.(false);
      return result;
    } catch (err) {
      if (schema.onError) {
        schema.onError(err as Error);
      }
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [schema, dataSource, objectSchema, perms]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (schema.onCancel) {
      schema.onCancel();
    }
    // Close modal on cancel
    schema.onOpenChange?.(false);
  }, [schema]);

  const formLayout = (schema.layout === 'vertical' || schema.layout === 'horizontal')
    ? schema.layout
    : 'vertical';

  // Build base form schema
  // Actions are hidden inside the form renderer — we render them in a sticky footer instead
  const showSubmit = schema.showSubmit !== false && schema.mode !== 'view';
  const showCancel = schema.showCancel !== false;
  const submitLabel = schema.submitText || (schema.mode === 'create' ? 'Create' : 'Update');
  const cancelLabel = schema.cancelText || 'Cancel';

  const baseFormSchema = {
    type: 'form' as const,
    layout: formLayout,
    defaultValues: formData,
    submitLabel,
    cancelLabel,
    showSubmit,
    showCancel,
    onSubmit: handleSubmit,
    onCancel: handleCancel,
    showActions: false, // Hide actions — rendered in sticky footer
    id: formId,        // Link external submit button via form attribute
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
        <div className="space-y-4" data-testid="modal-form-skeleton">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      );
    }

    // Sections layout
    if (schema.sections?.length) {
      const sections = schema.sections;
      const sectionKey = (sec: ModalFormSectionConfig, i: number) => sec.name || sec.label || String(i);
      const renderBody = (section: ModalFormSectionConfig) => (
        <SchemaRenderer
          schema={{
            ...baseFormSchema,
            fields: applyFieldPerms(buildSectionFields(section)),
            // Actions are in the sticky footer, not inside sections
          }}
        />
      );

      // ADR-0050 (#1890): a modal can host a tabbed layout — sections render as
      // tabs (label on the trigger) instead of a vertical stack, so a modal
      // create/edit form composes with `tabbed`.
      if (schema.contentLayout === 'tabbed' && sections.length > 1) {
        return (
          <Tabs defaultValue={sectionKey(sections[0], 0)} className="w-full">
            <TabsList className="mb-4">
              {sections.map((section, index) => (
                <TabsTrigger key={sectionKey(section, index)} value={sectionKey(section, index)}>
                  {section.label || `Section ${index + 1}`}
                </TabsTrigger>
              ))}
            </TabsList>
            {sections.map((section, index) => (
              <TabsContent key={sectionKey(section, index)} value={sectionKey(section, index)}>
                <FormSection
                  description={section.description}
                  columns={section.columns || 1}
                  gridClassName={CONTAINER_GRID_COLS[section.columns || 1]}
                >
                  {renderBody(section)}
                </FormSection>
              </TabsContent>
            ))}
          </Tabs>
        );
      }

      return (
        <div className="space-y-6">
          {sections.map((section, index) => (
            <FormSection
              key={sectionKey(section, index)}
              label={section.label}
              description={section.description}
              columns={section.columns || 1}
              gridClassName={CONTAINER_GRID_COLS[section.columns || 1]}
            >
              {renderBody(section)}
            </FormSection>
          ))}
        </div>
      );
    }

    // Reuse pre-computed auto-layout result for flat fields
    const layoutResult = autoLayoutResult ?? applyAutoLayout(formFields, objectSchema, schema.columns, schema.mode);

    // Flat fields layout — use container-query grid classes so the form
    // responds to the modal width, not the viewport width.
    const containerFieldClass = CONTAINER_GRID_COLS[layoutResult.columns || 1];

    return (
      <SchemaRenderer
        schema={{
          ...baseFormSchema,
          fields: applyFieldPerms(layoutResult.fields),
          columns: layoutResult.columns,
          ...(containerFieldClass ? { fieldContainerClass: containerFieldClass } : {}),
        }}
      />
    );
  };

  // Master-detail in a modal: when the schema declares inline child collections,
  // render the master-detail form inside the dialog (it owns its own Save/Cancel
  // action bar, so the modal footer is suppressed). Persisted atomically.
  const subforms = (schema as any).subforms as any[] | undefined;
  if (subforms?.length && schema.mode !== 'view') {
    return (
      <Dialog open={isOpen} onOpenChange={schema.onOpenChange}>
        <MobileDialogContent className={cn(sizeClass, 'flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden p-0', className, schema.className)}>
          {(schema.title || schema.description) && (
            <DialogHeader className="shrink-0 px-4 pt-4 sm:px-6 sm:pt-6 pb-2 border-b">
              {schema.title && <DialogTitle>{schema.title}</DialogTitle>}
              {schema.description ? (
                <DialogDescription>{schema.description}</DialogDescription>
              ) : (
                <DialogDescription className="sr-only">Enter the record and its line items, then save.</DialogDescription>
              )}
            </DialogHeader>
          )}
          <div className="@container flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            <MasterDetailForm
              schema={{
                type: 'object-master-detail-form',
                objectName: schema.objectName,
                mode: schema.mode === 'edit' ? 'edit' : 'create',
                recordId: schema.recordId,
                fields: schema.fields as any,
                sections: schema.sections as any,
                submitText: submitLabel,
                details: subforms as any,
                onSuccess: async (rec: any) => { await schema.onSuccess?.(rec); schema.onOpenChange?.(false); },
                onError: schema.onError,
                onCancel: () => schema.onOpenChange?.(false),
              }}
              dataSource={dataSource}
            />
          </div>
        </MobileDialogContent>
      </Dialog>
    );
  }

  const hasFooter = !loading && !error && (showSubmit || showCancel);

  return (
    <Dialog open={isOpen} onOpenChange={schema.onOpenChange}>
      <MobileDialogContent className={cn(sizeClass, 'flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden p-0', className, schema.className)}>
        {(schema.title || schema.description) && (
          <DialogHeader className="shrink-0 px-4 pt-4 sm:px-6 sm:pt-6 pb-2 border-b">
            {schema.title && <DialogTitle>{schema.title}</DialogTitle>}
            {schema.description ? (
              <DialogDescription>{schema.description}</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">
                Complete the form fields, then submit or cancel.
              </DialogDescription>
            )}
          </DialogHeader>
        )}

        <div className="@container flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {renderContent()}
        </div>

        {/* Sticky footer — always visible action buttons */}
        {hasFooter && (
          <div className="shrink-0 border-t px-4 sm:px-6 py-3 bg-background" data-testid="modal-form-footer">
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              {showCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto"
                >
                  {cancelLabel}
                </Button>
              )}
              {showSubmit && (
                <Button
                  type="submit"
                  form={formId}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto"
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {submitLabel}
                </Button>
              )}
            </div>
          </div>
        )}
      </MobileDialogContent>
    </Dialog>
  );
};

export default ModalForm;
