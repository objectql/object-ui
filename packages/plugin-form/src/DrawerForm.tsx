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

import React, { useState, useCallback, useEffect, useMemo, useRef, useId } from 'react';
import type { FormField, DataSource } from '@object-ui/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Button,
  cn,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@object-ui/components';
import { Loader2 } from 'lucide-react';

import { SchemaRenderer, useSafeFieldLabel, usePreviewMode } from '@object-ui/react';
import { createSafeTranslation } from '@object-ui/i18n';
import { MasterDetailForm } from './MasterDetailForm';
import { mapFieldTypeToFormType, buildValidationRules } from '@object-ui/fields';
import { buildSectionFields as buildSectionFieldsShared } from './sectionFields';
import { applyAutoLayout } from './autoLayout';
import { sanitizeFormData } from './sanitize';

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

// Localized strings for the unsaved-changes guard. Falls back to English when
// no i18n provider is mounted (createSafeTranslation handles that).
const useDiscardTranslation = createSafeTranslation(
  {
    'form.discardTitle': 'Discard changes?',
    'form.discardMessage': 'You have unsaved changes. If you close this form now, your edits will be lost.',
    'form.keepEditing': 'Keep editing',
    'form.discard': 'Discard',
  },
  'form.discardTitle',
);

export interface DrawerFormSectionConfig {
  name?: string;
  label?: string;
  description?: string;
  columns?: 1 | 2 | 3 | 4;
  fields: (string | FormField)[];
  collapsible?: boolean;
  collapsed?: boolean;
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
   * Guard against *accidentally* discarding unsaved input. When the form has
   * unsaved changes, an accidental close (backdrop click, Escape, or the X
   * button) first asks the user to confirm. The explicit Cancel button is an
   * intentional discard and always closes immediately. Set to `false` to drop
   * the confirmation entirely.
   * @default true
   */
  confirmOnDiscard?: boolean;

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
  /** Inline child collections — renders the drawer as an atomic master-detail
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
  const { t } = useDiscardTranslation();
  const previewMode = usePreviewMode();
  const [objectSchema, setObjectSchema] = useState<any>(null);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // Unsaved-changes guard (mirrors ModalForm). `isDirty` is fed up from the
  // inner form renderer via onDirtyChange; `discardOpen` controls the confirm
  // dialog shown when the user tries to close a dirty form.
  const [isDirty, setIsDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cancelIntentRef = useRef(false);
  const confirmOnDiscard = schema.confirmOnDiscard !== false;

  const isOpen = schema.open !== false;
  const side = schema.drawerSide || 'right';

  // Stable form id so the footer's external submit button can target the
  // inner <form> via the `form` attribute (actions live in the footer, not
  // inside the form renderer — see baseFormSchema.showActions below).
  const formId = useId();

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    schema.sections?.forEach((s, i) => {
      const key = s.name || String(i);
      if (s.collapsed) init[key] = true;
    });
    return init;
  });

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
    (section: DrawerFormSectionConfig): FormField[] =>
      buildSectionFieldsShared(section as any, {
        objectSchema,
        objectName: schema.objectName,
        readOnly: schema.readOnly,
        mode: schema.mode,
        fieldLabel,
      }),
    [objectSchema, schema.readOnly, schema.mode, schema.objectName, fieldLabel],
  );

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
    setIsSubmitting(true);
    try {
      if (!dataSource) {
        if (schema.onSuccess) {
          await schema.onSuccess(data);
        }
        // Close drawer on success
        schema.onOpenChange?.(false);
        return data;
      }

      let result;
      const payload = sanitizeFormData(data, objectSchema);
      if (schema.mode === 'create') {
        result = await dataSource.create(schema.objectName, payload);
      } else if (schema.mode === 'edit' && schema.recordId) {
        result = await dataSource.update(schema.objectName, schema.recordId, payload);
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
    } finally {
      setIsSubmitting(false);
    }
  }, [schema, dataSource, objectSchema]);

  // Actually close the drawer, firing onCancel only when the close originated
  // from the explicit Cancel button.
  const finalizeClose = useCallback(() => {
    setDiscardOpen(false);
    if (cancelIntentRef.current) {
      cancelIntentRef.current = false;
      schema.onCancel?.();
    }
    schema.onOpenChange?.(false);
  }, [schema]);

  // Attempt to close. With unsaved changes, intercept and ask for confirmation
  // instead of discarding the user's input. `viaCancel` marks the Cancel button.
  const attemptClose = useCallback((viaCancel: boolean) => {
    cancelIntentRef.current = viaCancel;
    if (confirmOnDiscard && isDirty) {
      setDiscardOpen(true);
    } else {
      finalizeClose();
    }
  }, [confirmOnDiscard, isDirty, finalizeClose]);

  // The explicit Cancel button is an *intentional* discard, so it closes
  // immediately — no "Discard changes?" prompt. The unsaved-changes guard only
  // intercepts *accidental* closes (backdrop click, Escape, the X), which Radix
  // routes through onOpenChange below. (attemptClose stays for that path.)
  const handleCancel = useCallback(() => {
    cancelIntentRef.current = true;
    finalizeClose();
  }, [finalizeClose]);

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

  // Action buttons live in the drawer's own footer (not inside the form
  // renderer). Routing Cancel through the footer lets it call the
  // unsaved-changes guard directly; the form renderer's built-in Cancel does a
  // `form.reset()` *before* invoking onCancel, which would wipe the user's
  // input before the "Discard changes?" prompt even appears — so "Keep editing"
  // would keep an already-emptied form. Mirrors ModalForm.
  const showSubmit = schema.showSubmit !== false && schema.mode !== 'view';
  const showCancel = schema.showCancel !== false;
  const submitLabel = schema.submitText || (schema.mode === 'create' ? 'Create' : 'Update');
  const cancelLabel = schema.cancelText || 'Cancel';

  // Build base form schema
  const baseFormSchema = {
    type: 'form' as const,
    objectName: schema.objectName,
    layout: formLayout,
    defaultValues: formData,
    submitLabel,
    cancelLabel,
    showSubmit,
    showCancel,
    onSubmit: handleSubmit,
    onCancel: handleCancel,
    onDirtyChange: setIsDirty, // Feed unsaved-changes state up to the close guard
    showActions: false, // Actions render in the drawer footer instead
    id: formId,         // Link the footer's submit button via the form attribute
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

    // Sections layout — all sections share ONE SchemaRenderer / form instance so
    // cross-section field conditions (e.g. condition: { field: 'type', equals: 'lookup' })
    // work via react-hook-form's watch(). A virtual 'section-divider' field is inserted
    // before each group to render the collapsible section header.
    // Fields in a collapsed section get hidden: true so they're excluded from the DOM.
    if (schema.sections?.length) {
      const allFields: FormField[] = [];
      schema.sections.forEach((section, index) => {
        const sectionKey = section.name || String(index);
        const isCollapsed = collapsedSections[sectionKey] ?? (section.collapsed ?? false);

        allFields.push({
          name: `__section_${sectionKey}`,
          label: section.label || '',
          type: 'section-divider',
          colSpan: 4,
          collapsible: section.collapsible,
          collapsed: isCollapsed,
          onToggle: section.collapsible
            ? () => setCollapsedSections(prev => ({ ...prev, [sectionKey]: !isCollapsed }))
            : undefined,
        } as any);

        const sectionFields = buildSectionFields(section);
        if (isCollapsed) {
          allFields.push(...sectionFields.map(f => ({ ...f, hidden: true })));
        } else {
          allFields.push(...sectionFields);
        }
      });

      return (
        <SchemaRenderer
          schema={{
            ...baseFormSchema,
            fields: allFields,
          }}
        />
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

  // Master-detail in a drawer: render the master-detail form (it owns its Save
  // bar) when the schema declares inline child collections; saved atomically.
  const subforms = (schema as any).subforms as any[] | undefined;
  const drawerBody = subforms?.length && schema.mode !== 'view' ? (
    <MasterDetailForm
      schema={{
        type: 'object-master-detail-form',
        objectName: schema.objectName,
        mode: schema.mode === 'edit' ? 'edit' : 'create',
        recordId: schema.recordId,
        fields: schema.fields as any,
        sections: schema.sections as any,
        submitText: schema.submitText,
        cancelText: cancelLabel,
        details: subforms as any,
        onSuccess: async (rec: any) => { await schema.onSuccess?.(rec); schema.onOpenChange?.(false); },
        onError: schema.onError,
        onCancel: () => schema.onOpenChange?.(false),
      }}
      dataSource={dataSource}
    />
  ) : (
    renderContent()
  );

  // Design/preview surfaces render this live on a canvas; a portalled modal Sheet
  // would lock the whole editor (Radix sets body pointer-events:none + a focus trap
  // while open). Render the body inline instead — a hard backstop complementing the
  // schema-level coercion the preview surfaces apply.
  if (previewMode) {
    return (
      <div className="@container rounded-md border bg-card p-4">
        {(schema.title || schema.description) && (
          <div className="mb-3 space-y-0.5">
            {schema.title && <div className="text-sm font-semibold">{schema.title}</div>}
            {schema.description && <p className="text-xs text-muted-foreground">{schema.description}</p>}
          </div>
        )}
        {drawerBody}
      </div>
    );
  }

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        // Backdrop click, Escape, and the X button all route through here.
        // Intercept closes so unsaved input isn't silently discarded.
        if (open) { schema.onOpenChange?.(true); return; }
        attemptClose(false);
      }}
    >
      <SheetContent
        side={side}
        className={cn('overflow-y-auto', className, schema.className)}
        style={widthStyle}
      >
        {(schema.title || schema.description) && (
          <SheetHeader>
            {schema.title && <SheetTitle>{schema.title}</SheetTitle>}
            {schema.description ? (
              <SheetDescription>{schema.description}</SheetDescription>
            ) : (
              <SheetDescription className="sr-only">
                Complete the form fields, then submit or cancel.
              </SheetDescription>
            )}
          </SheetHeader>
        )}

        <div className="@container py-4">
          {drawerBody}
        </div>

        {/* Sticky footer — own action buttons. Cancel calls the discard guard
            directly (no form.reset), so unsaved input survives "Keep editing".
            Suppressed for the master-detail path, which owns its own action bar. */}
        {!error && !loading && !(subforms?.length && schema.mode !== 'view') && (showSubmit || showCancel) && (
          <div className="shrink-0 border-t px-4 py-3 bg-background" data-testid="drawer-form-footer">
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

        {/* Unsaved-changes guard — rendered INSIDE SheetContent so its portal
            inherits the Sheet's Radix layer context (focus scope + dismissable
            layer) through React. As a sibling of <Sheet> it had no such context,
            so the still-open drawer swallowed its button clicks and "Keep
            editing" did nothing. Nesting lets Radix stack the two overlays
            correctly: the alert becomes the topmost layer and its buttons work. */}
        <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('form.discardTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('form.discardMessage')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { cancelIntentRef.current = false; }}>
                {t('form.keepEditing')}
              </AlertDialogCancel>
              <AlertDialogAction onClick={finalizeClose}>
                {t('form.discard')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
};

export default DrawerForm;
