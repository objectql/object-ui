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
 * Each section declares its panel via `pane` (spec FormSection.pane); when
 * omitted the legacy positional rule applies — the first section renders in the
 * left/top panel, every other section in the right/bottom one.
 * Aligns with @objectstack/spec FormView type: 'split'
 *
 * Both panels are ONE form (#2153). The panel group is a layout the form
 * renderer owns via `FormSchema.fieldPanes`, so a single `<form>` /
 * react-hook-form instance spans the divider. Rendering a form per panel — per
 * SECTION, in fact — meant an action bar submitted only its own section and
 * silently dropped everything typed on the other side, and a field condition
 * could not see across the split at all.
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { FormField, DataSource, ObjectFormSchema } from '@object-ui/types';
import { cn } from '@object-ui/components';
import { SchemaRenderer, useSafeFieldLabel } from '@object-ui/react';
import { buildSectionFields as buildSectionFieldsShared } from './sectionFields';
import { seedCreateValues, omitServerResolvedDefaults } from './schemaDefaults';
import { usePermissions } from '@object-ui/permissions';
import { applyAutoColSpan, containerGridColsFor } from './autoLayout';
import { useOccSave } from './occSave';
import { hasInlineFieldSource, noSubmitTargetError } from './submitTarget';

export interface SplitFormSectionConfig {
  name?: string;
  label?: string;
  description?: string;
  columns?: 1 | 2 | 3 | 4;
  /**
   * Which panel this section renders in. Aligns with @objectstack/spec
   * FormSection.pane — explicit per-section placement, so reordering sections
   * never silently moves them across the divider. Omitted → the legacy
   * positional rule (first section 'primary', every other 'secondary').
   */
  pane?: 'primary' | 'secondary';
  fields: (string | FormField)[];
  /**
   * ADR-0089 `FormSection.visibleWhen` — conditional visibility for the
   * section's divider HEADER, evaluated by the form renderer with the canonical
   * engine and the host predicate scope (#6010/#6111). Fails OPEN.
   */
  visibleWhen?: string | { dialect?: string; source: string };
  /** Custom CSS class for the section's header row. */
  className?: string;
  /**
   * Custom CSS class for the section's field grid. Applied to the panel's grid
   * when that panel holds this section alone (the common case — the first
   * section owns the left/top panel); a panel stacking several sections shares
   * one grid inside the single form (#2153), so there is none to override.
   */
  gridClassName?: string;
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

  /**
   * Grid width for the whole form (1–4). Aligns with @objectstack/spec
   * FormView.columns and OUTRANKS the per-section `columns`, which say how a
   * section fills the grid rather than how wide it is. Omitted = the widest
   * section's density.
   */
  columns?: number;

  // Common form props
  showSubmit?: boolean;
  submitText?: string;
  showCancel?: boolean;
  cancelText?: string;
  initialValues?: Record<string, any>;
  initialData?: Record<string, any>;
  readOnly?: boolean;
  /**
   * Override persistence — the seam a host uses to own the write. Declared as
   * `ObjectFormSchema['submitHandler']` rather than restated, so this variant
   * and the canonical key `ObjectForm` forwards can never drift apart.
   * When supplied, the form validates and hands the collected values
   * to this handler INSTEAD of calling `dataSource.create` /
   * `dataSource.update`; the returned record is passed on to `onSuccess`.
   *
   * `MasterDetailForm` supplies it to route the parent AND its child
   * collections through one atomic `batchTransaction` (#2679 / ADR-0034
   * item 4). A renderer that does not read it writes the parent on its own and
   * escapes that transaction — objectui#6176.
   */
  submitHandler?: ObjectFormSchema['submitHandler'];

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
  const { userId: currentUserId } = usePermissions();
  const [objectSchema, setObjectSchema] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  // OCC-guarded edit save + its conflict dialog (see occSave.tsx).
  const { saveWithOcc, conflictDialog } = useOccSave();
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

  // The record whose data `formData` currently holds. The fetch effect reads it
  // to tell a genuine record SWAP from a re-run of its own making —
  // `initialData`/`initialValues` are objects callers commonly rebuild every
  // render, and flashing the loading state for those would thrash.
  const loadedRecordIdRef = useRef<string | number | undefined>(undefined);

  // Fetch initial data
  useEffect(() => {
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
      if (schema.mode === 'create' || !schema.recordId) {
        // Declared static defaults are this form's opening values (#4047) —
        // see `schemaDefaults` for the create-only boundary and for why
        // runtime defaults are left to the server.
        setFormData(seedCreateValues(objectSchema, schema.initialData || schema.initialValues, { currentUserId }));
        setLoading(false);
        return;
      }

      if (!dataSource) {
        setFormData(schema.initialData || schema.initialValues || {});
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
    (section: SplitFormSectionConfig): FormField[] =>
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
    // No submit TARGET: a declared `submitHandler` owns the write and needs no
    // adapter of its own (objectui#6176's seam), so only a form with NEITHER it
    // nor a `dataSource` is target-less. The one target-less form that is still
    // legitimate is the inline-fields collector, whose `onSuccess` IS the write.
    // This arm used to be `if (!dataSource)` alone: it confirmed EVERY
    // adapter-less submit, bypassing a declared host seam and persisting
    // nothing (objectui#6300). See `submitTarget.ts` for the whole rule.
    if (!dataSource && !schema.submitHandler && hasInlineFieldSource(schema)) {
      if (schema.onSuccess) {
        await schema.onSuccess(data);
      }
      return data;
    }

    try {
      let result;
      // Omit the fields the producer owns (#4069) — see
      // `omitServerResolvedDefaults` for why an empty key is not the same as
      // no key at insert time. Create only: on an edit form a cleared column is
      // a real removal. Computed ONCE so every persistence route below — the
      // host-owned seam included — writes the identical payload.
      const writePayload = schema.mode === 'create'
        ? omitServerResolvedDefaults(data, objectSchema)
        : data;

      if (schema.submitHandler) {
        // The host owns persistence (e.g. MasterDetailForm batching the parent
        // + its child collections into ONE atomic transaction). The form
        // validates and hands the values over; it does NOT create/update
        // itself. Same seam and same precedence as SimpleObjectForm — every
        // renderer `ObjectForm` routes to must check it FIRST, or a declared
        // host-owned write silently becomes an independent one (objectui#6176).
        result = await schema.submitHandler(writePayload);
      } else if (!dataSource) {
        // No route left: no host seam and no adapter. Refuse instead of reporting
        // success — the `catch` below hands this to `schema.onError` and rethrows.
        throw noSubmitTargetError();
      } else if (schema.mode === 'create') {
        result = await dataSource.create(schema.objectName, writePayload);
      } else if (schema.mode === 'edit' && schema.recordId) {
        // OCC-guarded: sends `ifMatch` from the record we read; a 409 asks the
        // user to keep editing (skip the success path) or overwrite.
        const outcome = await saveWithOcc({
          dataSource,
          objectName: schema.objectName,
          recordId: schema.recordId,
          payload: writePayload,
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

  // Which panel each section renders in: explicit `section.pane` first (spec
  // FormSection.pane), else the legacy positional rule — first section primary,
  // rest secondary — so keyless metadata keeps its exact layout. Placement
  // follows the KEY, not the array position: reordering sections with panes
  // declared never moves them across the divider.
  const paneOf = (section: SplitFormSectionConfig, index: number): 'primary' | 'secondary' =>
    section.pane === 'primary' || section.pane === 'secondary'
      ? section.pane
      : index === 0 ? 'primary' : 'secondary';
  const leftSections = useMemo(
    () => schema.sections.filter((s, i) => paneOf(s, i) === 'primary'),
    [schema.sections],
  );
  const rightSections = useMemo(
    () => schema.sections.filter((s, i) => paneOf(s, i) === 'secondary'),
    [schema.sections],
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

  // The form is ONE grid; each section then lays ITS fields out at its own
  // declared density within that grid via colSpan (#2578) — the same arrangement
  // the stacked/tabbed sectioned forms use. The grid lives on the FIELD
  // container inside the form, never wrapped around the form (that leaves the
  // extra columns permanently empty, #2128).
  //
  // Grid width: the form view's own `columns` first (spec FormView.columns),
  // else the widest section. Same precedence ObjectForm's simple path and
  // ModalForm use, so one piece of metadata lays out the same in every host.
  const clampCol = (n: unknown): number | undefined =>
    typeof n === 'number' && n > 0 ? Math.min(Math.floor(n), 4) : undefined;
  const declaredCols = schema.sections
    .map((s) => clampCol(s.columns))
    .filter((c): c is number => c != null);
  const formColumns = (clampCol(schema.columns)
    ?? (declaredCols.length ? Math.max(...declaredCols) : 1)) as 1 | 2 | 3 | 4;
  const containerFieldClass = containerGridColsFor(formColumns);

  /**
   * One panel's field list: each section contributes an inline `section-divider`
   * header row followed by its fields. A per-section Card would need a
   * per-section form, which is the defect above.
   */
  const paneFields = (sections: SplitFormSectionConfig[], paneKey: string): FormField[] => {
    const out: FormField[] = [];
    sections.forEach((section, index) => {
      const body = buildSectionFields(section);
      if (!body.length) return;
      if (section.label || section.description) {
        out.push({
          name: `__section_${section.name || `${paneKey}_${index}`}`,
          label: section.label,
          description: section.description,
          type: 'section-divider',
          // ADR-0089 section predicate (#6111) — the renderer evaluates it on
          // this pseudo-field with the host predicate scope bound (#6010).
          visibleWhen: section.visibleWhen,
          colSpan: 4,
          className: section.className,
        } as any);
      }
      out.push(
        ...(formColumns > 1
          ? applyAutoColSpan(body, formColumns, clampCol(section.columns))
          : body),
      );
    });
    return out;
  };

  // A pane holding exactly one section can still honour that section's
  // `gridClassName` — it owns the panel's grid outright.
  const panes = [
    { key: 'primary', sections: leftSections, defaultSize: panelSize },
    { key: 'secondary', sections: rightSections, defaultSize: 100 - panelSize },
  ]
    .map((pane) => ({
      ...pane,
      fields: paneFields(pane.sections, pane.key),
      containerClass: pane.sections.length === 1 ? pane.sections[0].gridClassName : undefined,
    }))
    .filter((pane) => pane.fields.length > 0);

  return (
    <div className={cn('w-full @container', className, schema.className)}>
      <SchemaRenderer
        schema={{
          type: 'form' as const,
          objectName: schema.objectName,
          // Every pane's fields, in one list, for the one form instance. The
          // panes below claim them back by name for layout only.
          fields: panes.flatMap((pane) => pane.fields),
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
          // A single pane is not a split — the renderer then falls back to a
          // plain field list rather than a one-panel resizable group.
          fieldPanes: panes.map((pane) => ({
            key: pane.key,
            fields: pane.fields.map((f) => f.name),
            defaultSize: pane.defaultSize,
            ...(pane.containerClass ? { containerClass: pane.containerClass } : {}),
          })),
          fieldPanesOrientation: direction,
          fieldPanesResizable: schema.splitResizable !== false,
        }}
      />
      {conflictDialog}
    </div>
  );
};

export default SplitForm;
