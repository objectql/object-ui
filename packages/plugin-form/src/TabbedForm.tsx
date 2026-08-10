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

import React, { useState, useCallback, useRef } from 'react';
import type { FormField, DataSource } from '@object-ui/types';
import { cn } from '@object-ui/components';
import { SchemaRenderer, useSafeFieldLabel } from '@object-ui/react';
import { buildSectionFields as buildSectionFieldsShared } from './sectionFields';
import { seedCreateValues, omitServerResolvedDefaults } from './schemaDefaults';
import { applyAutoColSpan, containerGridColsFor } from './autoLayout';
import { useOccSave } from './occSave';

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

  /**
   * Custom CSS class for the section's Card wrapper.
   *
   * Unused in the tabbed layout: all tabs share ONE form (#2959), so a tab's
   * panel has no per-section Card to carry it.
   */
  className?: string;

  /**
   * Custom CSS class for the section's field grid — applied to this tab's panel
   * grid (overrides the shared column classes).
   */
  gridClassName?: string;
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
   * Grid width for the whole form (1–4). Aligns with @objectstack/spec
   * FormView.columns and OUTRANKS the per-section `columns`, which say how a
   * section fills the grid rather than how wide it is. Omitted = the widest
   * section's density.
   */
  columns?: number;

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
  // OCC-guarded edit save + its conflict dialog (see occSave.tsx).
  const { saveWithOcc, conflictDialog } = useOccSave();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // Which tab opens first. The live tab state belongs to the form renderer from
  // here on — it owns the panels, so only it can jump to the tab holding a
  // rejected field on a failed submit (#2959).
  const initialTab =
    schema.defaultTab || schema.sections[0]?.name || schema.sections[0]?.label || 'tab-0';

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

  // The record whose data `formData` currently holds. The fetch effect reads it
  // to tell a genuine record SWAP from a re-run of its own making —
  // `initialData`/`initialValues` are objects callers commonly rebuild every
  // render, and flashing the loading state for those would thrash.
  const loadedRecordIdRef = useRef<string | number | undefined>(undefined);

  // Fetch initial data for edit/view modes
  React.useEffect(() => {
    // A `recordId` change re-enters this effect with the form still MOUNTED on
    // the previous record, which needs handling on two fronts (pinned by
    // recordSwapLoading.test.tsx):
    //  - go back to the loading state, so record A's values are not left on
    //    screen AND EDITABLE while B is in flight, to be swapped underneath in
    //    place when it lands. Anything typed there read as A's on screen but
    //    would have been submitted against B.
    //  - ignore a response that is no longer the one being awaited, so two
    //    overlapping reads land in REQUEST order, not completion order.
    let cancelled = false;
    const fetchData = async () => {
      if (schema.mode === 'create' || !schema.recordId || !dataSource) {
        // Declared static defaults are this form's opening values (#4047) —
        // see `schemaDefaults` for the create-only boundary and for why
        // runtime defaults are left to the server.
        setFormData(seedCreateValues(objectSchema, schema.initialData || schema.initialValues));
        setLoading(false);
        return;
      }

      // Only a change of RECORD hides the form.
      if (loadedRecordIdRef.current !== schema.recordId) setLoading(true);

      try {
        const data = await dataSource.findOne(schema.objectName, schema.recordId);
        if (cancelled) return;
        loadedRecordIdRef.current = schema.recordId;
        setFormData(data || {});
      } catch (err) {
        if (cancelled) return;
        setError(err as Error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (objectSchema || !dataSource) {
      fetchData();
    }
    return () => { cancelled = true; };
  }, [objectSchema, schema.mode, schema.recordId, schema.initialData, schema.initialValues, dataSource, schema.objectName]);

  // Build form fields from section config
  const buildSectionFields = useCallback(
    (section: FormSectionConfig): FormField[] =>
      buildSectionFieldsShared(section as any, {
        objectSchema,
        objectName: schema.objectName,
        readOnly: schema.readOnly,
        mode: schema.mode,
        // Feeds the "no persisted record" test that decides whether a runtime
        // `defaultValue` excuses a field from `required` (#4069).
        recordId: schema.recordId,
        fieldLabel,
      }),
    [objectSchema, schema.readOnly, schema.mode, schema.recordId, schema.objectName, fieldLabel],
  );

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
        // Omit the fields the producer owns (#4069) — see
        // `omitServerResolvedDefaults` for why an empty key is not the same as
        // no key at insert time.
        result = await dataSource.create(
          schema.objectName,
          omitServerResolvedDefaults(data, objectSchema),
        );
      } else if (schema.mode === 'edit' && schema.recordId) {
        // OCC-guarded: sends `ifMatch` from the record we read; a 409 asks the
        // user to keep editing (skip the success path) or overwrite.
        const outcome = await saveWithOcc({
          dataSource,
          objectName: schema.objectName,
          recordId: schema.recordId,
          payload: data,
          baseRecord: formData,
        });
        if (outcome.status === 'cancelled') return;
        result = outcome.result;
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
  }, [schema, dataSource, saveWithOcc, formData]);

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

  // ONE form for ALL tabs (#2959). A SchemaRenderer per tab gave each tab its
  // own react-hook-form instance, and Radix unmounted the inactive panel — so
  // every tab the user left behind lost its input and only the visible tab's
  // fields reached the submit payload. The renderer now owns the tab strip and
  // panels (`fieldTabs`): all panels stay mounted inside a single <form>, which
  // is also what lets cross-tab conditions and validation see every field.
  //
  // Multi-column stays on the field container INSIDE the form: each tab's fields
  // carry their own colSpan against the shared grid (sectionFormLayout parity),
  // never a grid wrapped around the form — that would leave the extra columns
  // empty (#2128).
  const clampCol = (n: unknown): number | undefined =>
    typeof n === 'number' && n > 0 ? Math.min(Math.floor(n), 4) : undefined;
  const declaredCols = schema.sections
    .map((s) => clampCol(s.columns))
    .filter((c): c is number => c != null);
  // Grid width: the form view's own `columns` first (spec FormView.columns),
  // else the widest section. Same precedence ObjectForm's simple path and
  // ModalForm use, so one piece of metadata lays out the same in every host.
  const formColumns =
    clampCol(schema.columns) ?? (declaredCols.length ? Math.max(...declaredCols) : 1);
  const containerFieldClass = containerGridColsFor(formColumns);

  const tabGroups = schema.sections.map((section, index) => {
    const body = buildSectionFields(section);
    return {
      key: getTabValue(section, index),
      label: section.label || `Tab ${index + 1}`,
      description: section.description,
      containerClass: section.gridClassName,
      fields: formColumns > 1
        ? applyAutoColSpan(body, formColumns, clampCol(section.columns))
        : body,
    };
  });

  const allFields: FormField[] = tabGroups.flatMap((g) => g.fields);

  return (
    <div className={cn('w-full @container', className, schema.className)}>
      <SchemaRenderer
        schema={{
          type: 'form' as const,
          objectName: schema.objectName,
          fields: allFields,
          columns: formColumns,
          ...(containerFieldClass ? { fieldContainerClass: containerFieldClass } : {}),
          layout: 'vertical' as const,
          defaultValues: formData,
          // Persisted record → `previous` binding + read-only submit strip (#3484).
          previousValues: schema.mode === 'edit' && schema.recordId ? formData : undefined,
          submitLabel: schema.submitText || (schema.mode === 'create' ? 'Create' : 'Update'),
          cancelLabel: schema.cancelText,
          showSubmit: schema.showSubmit !== false && schema.mode !== 'view',
          showCancel: schema.showCancel !== false,
          onSubmit: handleSubmit,
          onCancel: handleCancel,
          fieldTabs: tabGroups.map((g) => ({
            key: g.key,
            label: g.label,
            description: g.description,
            fields: g.fields.map((f) => f.name),
            containerClass: g.containerClass,
          })),
          defaultFieldTab: initialTab,
          fieldTabsPosition: schema.tabPosition || 'top',
        }}
      />
      {conflictDialog}
    </div>
  );
};

export default TabbedForm;
