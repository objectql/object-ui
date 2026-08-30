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
import type { FormField, DataSource, ObjectFormSchema } from '@object-ui/types';
import { cn } from '@object-ui/components';
import { SchemaRenderer, useSafeFieldLabel } from '@object-ui/react';
import { buildSectionFields as buildSectionFieldsShared } from './sectionFields';
import { seedCreateValues, omitServerResolvedDefaults } from './schemaDefaults';
import { usePermissions } from '@object-ui/permissions';
import { applyAutoColSpan, containerGridColsFor } from './autoLayout';
import { useOccSave } from './occSave';
import { hasInlineFieldSource, noSubmitTargetError } from './submitTarget';

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
   * ADR-0089 `FormSection.visibleWhen` — the TABBED arm of the one grouping
   * contract ruled 2026-08-29 (objectui#6237, option A). Spelled exactly as the
   * sibling `ModalFormSectionConfig.visibleWhen`, because it IS the same
   * authored key: `ObjectForm` copies a section's predicate here, this layout
   * copies it onto the tab it synthesises (`FormFieldTab.visibleWhen`), and the
   * form renderer evaluates it on the canonical engine with the live record and
   * the host predicate scope bound (#6010) — the same path a field's own
   * `visibleWhen` takes. A broken predicate fails OPEN (the tab stays visible).
   *
   * Ruled semantics (maintainer 2026-08-27, the same ruling for tabs as for
   * sections), inherited from the renderer rather than re-implemented here:
   * visibility decides what is DRAWN and nothing else — a hidden tab's values
   * still submit — and a hidden tab's fields skip CLIENT-side validation, so a
   * user is never blocked by an error pointing at a control they cannot see.
   * The server-side contract stays the loud floor for genuinely-required data;
   * see the boundary note on `WizardStepConfig` and objectui#6237 for the
   * measured reason the server cannot read this predicate.
   *
   * ⛔ Deliberately NOT on the wizard's step type, and that boundary is now
   * structural rather than subtractive (maintainer ruling 2026-08-30,
   * objectui#6237). `WizardForm` used to type its steps as
   * `Omit<FormSectionConfig, 'visibleWhen'>` — a derivation that defended the
   * one key it named while every FUTURE key added here still reached a wizard
   * step by default. `WizardStepConfig` is now declared independently, exactly
   * as `SplitFormSectionConfig` / `ModalFormSectionConfig` /
   * `DrawerFormSectionConfig` already are, so this type and the wizard's share
   * nothing: a key is authorable on a wizard step only if someone writes it
   * there, on the type whose renderer has to honour it.
   */
  visibleWhen?: string | { dialect?: string; source: string };

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
  const { userId: currentUserId } = usePermissions();
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
        setFormData(seedCreateValues(objectSchema, schema.initialData || schema.initialValues, { currentUserId }));
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
      // The authored section predicate (objectui#6237). Carried on the group so
      // BOTH synthesis paths below can read it — the tab arm and the sub-two-tab
      // degradation — instead of each re-deriving it from `schema.sections`.
      visibleWhen: section.visibleWhen,
      fields: formColumns > 1
        ? applyAutoColSpan(body, formColumns, clampCol(section.columns))
        : body,
    };
  });

  // ── "Collapse below two tabs", the ruling's third binding semantic ─────────
  // Two different situations wear that name, and only one of them was answered
  // by the renderer:
  //
  //  (a) A PREDICATE hides one of two tabs. Answered upstream and inherited: the
  //      renderer judges whether the tab arm engages on the DECLARED tabs, so a
  //      predicate can only filter what is drawn — it never collapses the strip
  //      mid-interaction (which would remount every surviving field, destroying
  //      focus and in-progress edits, and would draw the hidden tab's fields
  //      flat, breaking the ruled semantics). Nothing to do here.
  //
  //  (b) The form DECLARES fewer than two tabs. The renderer's tab arm needs
  //      more than one usable tab to engage, so a single-section `tabbed` form
  //      is already rendered as the untabbed layout — there is no tab to carry a
  //      predicate, and the key would be silently inert exactly as it was before
  //      this card. That is the case this block answers, and answering it is not
  //      optional: leaving it out would let `ObjectForm` stop reporting the gap
  //      (the arm now "supports" the key) while one shape of the gap survived.
  //
  // The defined degradation is the untabbed layout's OWN predicate mechanism
  // (#6236): a `section-divider` row that CLAIMS its member fields by name, so
  // the verdict gates the whole group through the identical unmount path and the
  // ruled semantics stay byte-for-byte the same across the two shapes.
  //
  // Deliberately chrome-less — no `label`, no `description`. A single-section
  // tabbed form draws no tab strip today, so its section heading is already
  // absent; synthesising a visible header here would change the layout of every
  // such form rather than just honouring the key. `SectionDivider` renders
  // `null` without a label or description, so the row costs nothing visually and
  // exists only to carry the claim. Emitted ONLY for sections that actually
  // authored a predicate: a form with no predicate is byte-identical to before.
  const rendersAsTabs = tabGroups.length > 1;
  const degradedSectionGates: FormField[] = rendersAsTabs
    ? []
    : tabGroups
        .filter((g) => g.visibleWhen != null)
        .map((g) => ({
          name: `__section_gate_${g.key}`,
          type: 'section-divider',
          visibleWhen: g.visibleWhen,
          fields: g.fields.map((f) => f.name),
          colSpan: 4,
        } as unknown as FormField));

  const allFields: FormField[] = [
    ...degradedSectionGates,
    ...tabGroups.flatMap((g) => g.fields),
  ];

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
            // The tab's predicate slot (objectui#6237) — the same authored
            // `FormSection.visibleWhen` the modal arm copies onto its tab and
            // the flat arm copies onto its divider. The renderer evaluates it
            // and hides trigger, panel and fields together under the ruled
            // hidden-group semantics; re-selection when the ACTIVE tab hides is
            // the renderer's too (`activeFieldTab` derives over the VISIBLE
            // tabs), so this layout inherits all three ruled semantics instead
            // of re-implementing any of them.
            visibleWhen: g.visibleWhen,
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
