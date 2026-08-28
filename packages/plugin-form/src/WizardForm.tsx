/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * WizardForm Component
 * 
 * A multi-step wizard form that guides users through sections step by step.
 * Aligns with @objectstack/spec FormView type: 'wizard'
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { FormField, DataSource, ObjectFormSchema } from '@object-ui/types';
import { Button, cn, toast } from '@object-ui/components';
import { AlertCircle, Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { resolveFieldRuleState, evalFieldPredicate, isMissingForRequired, isServerOwnedValue } from '@object-ui/core';
import { createSafeTranslation } from '@object-ui/i18n';
import { FormSectionContainer } from './FormSection';
import { SchemaRenderer, useSafeFieldLabel, usePredicateScope } from '@object-ui/react';
import { buildSectionFields as buildSectionFieldsShared } from './sectionFields';
import { seedCreateValues, omitServerResolvedDefaults, isCreateFormMode } from './schemaDefaults';
import { usePermissions } from '@object-ui/permissions';
import { applyAutoColSpan, containerGridColsFor } from './autoLayout';
import { resolveSuccessNavigate, type SubmitBehavior } from './successBehavior';
import { resolveSubmitRedirect, submitRedirectScope } from './submitRedirect';
import {
  useSubmitRedirectNavigation,
  type PendingSubmitRedirect,
} from './submitRedirectNavigation';
import { useOccSave } from './occSave';
import { hasInlineFieldSource, noSubmitTargetError } from './submitTarget';
import type { FormSectionConfig } from './TabbedForm';

/**
 * What the submitter is told when a DECLARED `navigateOnSuccess` produced no
 * destination — objectui#5034 point 2.
 *
 * The write succeeded, so this rides on the success toast as a note rather than
 * becoming an error or a blocking panel: turning a successful write into an
 * error state would be a worse lie than the silence it replaces. What was
 * missing is one fact, and only one: the navigation the author declared did not
 * happen. Before this, the toast was byte-identical to the toast a form with no
 * `navigateOnSuccess` at all produces, so an author who mistyped the destination
 * — or whose record carried no usable id — saw a form that looked entirely
 * healthy and had silently stopped honouring a key they wrote.
 *
 * Maintainer ruling, 2026-08-17: "A refused declared navigation is surfaced: the
 * success toast carries a note that the declared navigation was not performed —
 * never indistinguishable from the no-key case."
 *
 * The note names no REASON on purpose. `resolveSuccessNavigate` answers null for
 * two different causes (no usable id on the written record; a destination the
 * same-origin guard refused) and returns no discriminant, so a reason in this
 * copy could only be re-derived by reimplementing that helper's internals at the
 * call site — where it would drift from the helper, and would additionally bake
 * an acceptance rule into user-visible prose, which objectui#5034 has since
 * narrowed once already. The diagnosable detail — the template the author
 * actually wrote — goes to `console.warn` at each call site instead.
 *
 * Lives here rather than in `successBehavior.ts` (the natural home, but read-only
 * for this card) and is imported BY `ObjectForm`, which is the dependency
 * direction that already exists — ObjectForm imports WizardForm, never the
 * reverse. Single-sourced so a wizard and a flat form cannot tell a submitter
 * two different things about one refusal; a test pins that they do not.
 */
export const NAVIGATE_ON_SUCCESS_REFUSED_NOTE =
  'The `navigateOnSuccess` destination declared for this form was refused, '
  + 'so the navigation did not happen.';

// Falls back to English when no i18n provider is mounted.
const useWizardTranslation = createSafeTranslation(
  {
    'wizard.missingRequired': 'Please complete the required fields: {{fields}}',
  },
  'wizard.missingRequired',
);

/**
 * Empty for the purposes of a required check. Shared with the form renderer —
 * one predicate, mirroring the server's `isMissing`, so the wizard's
 * cross-step gate can't drift from the per-field verdict (cloud#972).
 */
const isEmptyValue = isMissingForRequired;

export interface WizardFormSchema {
  type: 'object-form';
  formType: 'wizard';
  
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
   * Wizard step sections
   */
  sections: FormSectionConfig[];
  
  /**
   * Allow navigation to any step (not just sequential).
   *
   * This is navigation freedom, NOT an exemption from the object's rules: the
   * final submit still checks every step's required fields and sends the user
   * back to the first step that has one outstanding (#2959's validation half —
   * react-hook-form only validates the fields currently mounted, so a step
   * nobody opened used to reach the server unvalidated).
   * @default false
   */
  allowSkip?: boolean;

  /**
   * Grid width for each step (1–4). Aligns with @objectstack/spec
   * FormView.columns and OUTRANKS the per-step `columns`, which says how densely
   * that step fills the grid. Omitted = the step's own `columns`, else 1.
   */
  columns?: number;
  
  /**
   * Show step indicators
   * @default true
   */
  showStepIndicator?: boolean;
  
  /**
   * Text for Next button
   * @default 'Next'
   */
  nextText?: string;
  
  /**
   * Text for Previous button
   * @default 'Back'
   */
  prevText?: string;
  
  /**
   * Submit button text (shown on last step)
   */
  submitText?: string;

  /**
   * Declarative success toast text shown when no `onSuccess` handler is given
   * (metadata pages cannot pass a function). Falls back to 'Created'/'Saved'.
   * Ignored when `submitBehavior` is set.
   */
  successMessage?: string;

  /** Navigate here after a successful create/update (declarative; metadata
   * pages can't pass onSuccess). Supports `{id}`/`{recordId}` interpolation
   * from the saved record. Same-origin-guarded. Takes precedence over the toast.
   * Ignored when `submitBehavior` is set. */
  navigateOnSuccess?: string;

  /** Reset the wizard (back to step 1, cleared) after a successful create so the
   * user can enter another. Ignored when `navigateOnSuccess` or `submitBehavior`
   * is set. */
  resetOnSuccess?: boolean;

  /**
   * Declarative post-submit behavior aligned with `@objectstack/spec`'s
   * `FormView.submitBehavior`. When present, takes precedence over
   * `successMessage` / `navigateOnSuccess` / `resetOnSuccess`.
   */
  submitBehavior?: SubmitBehavior;
  
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
   * Initial data (alias)
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
   * Called when step changes
   */
  onStepChange?: (step: number) => void;
  
  /**
   * CSS class
   */
  className?: string;
}

export interface WizardFormProps {
  schema: WizardFormSchema;
  dataSource?: DataSource;
  className?: string;
}

/**
 * WizardForm Component
 * 
 * Renders a multi-step wizard form with step indicators and navigation.
 * 
 * @example
 * ```tsx
 * <WizardForm
 *   schema={{
 *     type: 'object-form',
 *     formType: 'wizard',
 *     objectName: 'users',
 *     mode: 'create',
 *     sections: [
 *       { label: 'Step 1: Personal', fields: ['firstName', 'lastName'] },
 *       { label: 'Step 2: Contact', fields: ['email', 'phone'] },
 *       { label: 'Step 3: Review', fields: [] },
 *     ]
 *   }}
 *   dataSource={dataSource}
 * />
 * ```
 */
export const WizardForm: React.FC<WizardFormProps> = ({
  schema,
  dataSource,
  className,
}) => {
  const { fieldLabel } = useSafeFieldLabel();
  const { userId: currentUserId } = usePermissions();
  const { t } = useWizardTranslation();
  const [objectSchema, setObjectSchema] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  // The persisted record as READ, kept apart from `formData` — the wizard
  // merges each step's answers into `formData`, so it stops being the prior
  // row after step one. Field-rule `previous` and the read-only submit strip
  // need the untouched read (objectui#3484).
  const [persistedRecord, setPersistedRecord] = useState<Record<string, any> | undefined>(undefined);
  // OCC-guarded edit save + its conflict dialog (see occSave.tsx).
  const { saveWithOcc, conflictDialog } = useOccSave();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  // Steps the final submit found an outstanding required field on, so their
  // indicator can say so — a rejection on a step the user is not looking at is
  // otherwise invisible and the submit just appears to do nothing.
  const [invalidSteps, setInvalidSteps] = useState<Set<number>>(new Set());
  // Terminal state for `submitBehavior: { kind: 'thank-you' | 'next-record' }`.
  // Without this the last step's form stayed mounted and fully filled after a
  // successful create, with nothing disabling "Create" — a second click fired
  // a second create request (duplicate record).
  //
  // `refusal` carries the second fact a REFUSED `redirect` destination has to
  // report (objectui#4989): the write succeeded — hence the confirmation this
  // state already renders — but the authored destination is out of contract, so
  // nothing was navigated to and the author needs the reason. Same reasoning as
  // ObjectForm's copy of this state: a refused destination is not a failed
  // submit, so it must not travel in an error channel.
  const [submitted, setSubmitted] = useState<
    { title?: string; message?: string; refusal?: string } | null
  >(null);
  // The accepted destination of a `submitBehavior: { kind: 'redirect' }` submit
  // plus the delay declared for it (objectui#5033). Same reasoning as
  // ObjectForm's copy of this state, and the same reason it is a state and not a
  // timer armed in the handler: a bare `setTimeout` there was owned by nobody, so
  // the pending full-page navigation outlived this wizard and yanked back a
  // submitter who had closed the modal/drawer variant or navigated on. The delay
  // is captured with the destination so the pause cannot be restarted mid-wait by
  // a host re-render carrying a different `delayMs`.
  const [pendingRedirect, setPendingRedirect] = useState<PendingSubmitRedirect | null>(null);

  // The delayed leg of a `redirect` submit behaviour, owned by this component:
  // unmounting cancels the wait. `delayMs` semantics are untouched — the pause is
  // still a pause, an unset value is still a zero timer, i.e. "go now". The host's
  // injected navigate is used when one was supplied, so a mounted host's basename
  // is applied (objectui#4989 defect 4); with no host seam this is the same
  // `window.location.assign` as before. Same hook as ObjectForm's redirect arm —
  // see `submitRedirectNavigation.ts`.
  useSubmitRedirectNavigation(pendingRedirect);

  // Stable id for the *inner* step form's <form> element. The wizard's
  // Next/Create buttons live in the footer, OUTSIDE that form, and submit it
  // natively via `type="submit" form={stepFormId}`. Going through the real
  // form submit (rather than calling handleStepSubmit with the wizard's stale
  // `formData`) runs the step's validation and collects every entered value
  // via RHF `getValues()` — selects, lookups and dates included — so the
  // accumulated record actually reaches the server. Without this the create
  // POST body was `{}` and the server rejected all required fields.
  const stepFormId = React.useId();
  // Bumped on resetOnSuccess to force the inner step form to remount fresh
  // (it's otherwise reused across steps so back/forward retains values).
  const [resetNonce, setResetNonce] = useState(0);
  // Seed `formData` only once. The data-loading effect below depends on
  // `dataSource`/`objectSchema`, whose identity can churn across renders;
  // re-running its create-mode branch would `setFormData({})` mid-wizard and
  // wipe everything the user entered on earlier steps (the create POST then
  // carried only the final step's fields). This guard makes the seed idempotent.
  const seededRef = React.useRef(false);

  const totalSteps = schema.sections.length;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

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

  // Fetch initial data
  React.useEffect(() => {
    const fetchData = async () => {
      if (schema.mode === 'create' || !schema.recordId || !dataSource) {
        if (!seededRef.current) {
          // Declared static defaults are this wizard's opening values (#4047)
          // — see `schemaDefaults` for the create-only boundary and for why
          // runtime defaults are left to the server.
          setFormData(seedCreateValues(objectSchema, schema.initialData || schema.initialValues, { currentUserId }));
          seededRef.current = true;
        }
        setLoading(false);
        return;
      }
      
      try {
        const data = await dataSource.findOne(schema.objectName, schema.recordId);
        setFormData(data || {});
        setPersistedRecord(data || {});
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

  // Build section fields from object schema
  const buildSectionFields = useCallback(
    (section: FormSectionConfig): FormField[] =>
      buildSectionFieldsShared(section as any, {
        objectSchema,
        objectName: schema.objectName,
        readOnly: schema.readOnly,
        mode: schema.mode,
        // Feeds the "no persisted record" test that decides whether a runtime
        // `defaultValue` excuses a field from `required` (#4069). The wizard's
        // own final-submit gate (`missingRequiredByStep`) reads the `required`
        // this produces, so it agrees with the renderer for free.
        recordId: schema.recordId,
        fieldLabel,
      }),
    [objectSchema, schema.readOnly, schema.mode, schema.recordId, schema.objectName, fieldLabel],
  );

  // The same "no persisted record" test the seeding and the create-mode
  // `required` suppression use, so this wizard cannot be seeded as a create
  // form and gated as an edit one.
  const isCreateWizard = isCreateFormMode(schema);

  /**
   * The host shell's global predicate scope (`ExpressionProvider` →
   * `PredicateScopeProvider`) — `current_user` plus the ADR-0068 `user` /
   * `ctx.user` / `os.user` aliases, `app`, `data`, `features`. Empty `{}` when
   * no provider is mounted, which is the same "nothing to bind" the renderer
   * sees (objectui#6110).
   *
   * Read HERE, at the component's top level, because the only consumer is a
   * `useCallback` — a hook cannot be called inside one, and the gate below is
   * invoked from a submit handler where no React context is readable at all.
   * It joins that callback's dependency list for the same reason it joins the
   * renderer's (#6010): a scope change — the host switching organisations, so
   * `current_user.positions` changes — can flip a `visibleWhen` exactly as a
   * keystroke can, and a memoized gate holding the old scope would answer the
   * final submit with a principal the user no longer is.
   */
  const predicateScope = usePredicateScope();

  // Current section fields
  const currentSectionFields = useMemo(() => {
    if (currentStep >= 0 && currentStep < totalSteps) {
      return buildSectionFields(schema.sections[currentStep]);
    }
    return [];
  }, [currentStep, totalSteps, schema.sections, buildSectionFields]);

  /**
   * Required fields the record does not satisfy, grouped by the STEP that
   * declares them.
   *
   * react-hook-form only validates the fields currently MOUNTED, and a wizard
   * mounts one step at a time. Sequential navigation is safe (Next validates the
   * step you are leaving), but `allowSkip` jumps straight to any step — so a
   * required field on a step nobody opened was never registered, never
   * validated, and simply absent from the create payload, with nothing on screen
   * saying so. The final submit therefore re-checks the WHOLE declared field set
   * here.
   *
   * Uses the canonical rule engine (`resolveFieldRuleState`), the same one the
   * form renderer and the server's rule-validator use, so a conditionally
   * required/hidden field gets the same verdict from all three rather than a
   * second, divergent dialect.
   */
  const missingRequiredByStep = useCallback(
    (record: Record<string, any>): Map<number, string[]> => {
      const out = new Map<number, string[]>();
      schema.sections.forEach((section, index) => {
        for (const field of buildSectionFields(section)) {
          const name = field?.name;
          if (!name || (field as any).hidden === true) continue;
          const state = resolveFieldRuleState(
            {
              visibleWhen: (field as any).visibleWhen,
              readonlyWhen: (field as any).readonlyWhen,
              requiredWhen: (field as any).requiredWhen,
            },
            record,
            {
              required: !!field.required,
              readonly: (field as any).readonly === true,
              // Same suppression the form renderer applies (#4069 / #4085): on
              // a CREATE wizard a producer-owned control is left empty and its
              // key omitted, so neither the static flag nor a `requiredWhen`
              // resolving TRUE may hold the final submit. The mode is read from
              // the schema rather than from the absent `previous` argument
              // above — this gate passes no `previous` in EITHER mode, so
              // inferring create-ness from it would drop a `requiredWhen` an
              // EDIT wizard is supposed to enforce.
              serverOwnedValue: isServerOwnedValue(field, isCreateWizard),
            },
            undefined,
            // The host predicate scope, so `current_user` resolves here exactly
            // as it does in the form renderer that DREW this field (#6010).
            // Without it this gate faults on every `current_user` predicate and
            // fails OPEN, demanding a field the wizard itself hid (#6110).
            predicateScope,
            `field '${name}'`,
          );
          // View-level FormField.visibleOn hides the field the same way a
          // field-level visibleWhen does — fold it into the verdict exactly
          // like the form renderer (form.tsx) does, or the gate demands a
          // field the view itself hides (#3090). Since #3090 this slot also
          // receives the ADR-0089 canonical view-level `visibleWhen` spelling.
          const viewVisible =
            (field as any).visibleOn == null ||
            evalFieldPredicate((field as any).visibleOn, record, true, undefined, predicateScope, {
              context: `visibleOn of field '${name}'`,
            });
          // A hidden or read-only field is not the user's to fill in.
          if (!viewVisible || !state.visible || state.readonly || !state.required) continue;
          if (!isEmptyValue(record[name])) continue;
          out.set(index, [...(out.get(index) ?? []), (field as any).label || name]);
        }
      });
      return out;
    },
    [schema.sections, buildSectionFields, isCreateWizard, predicateScope],
  );

  // Handle step data collection (merge partial data into formData)
  const handleStepSubmit = useCallback(async (stepData: Record<string, any>) => {
    const mergedData = { ...formData, ...stepData };
    setFormData(mergedData);

    // Mark step as completed
    setCompletedSteps(prev => new Set(prev).add(currentStep));
    // This step just cleared its own validation, so drop any marker it carried.
    setInvalidSteps(prev => {
      if (!prev.has(currentStep)) return prev;
      const next = new Set(prev);
      next.delete(currentStep);
      return next;
    });

    if (isLastStep) {
      // Gate the submit on the FULL field set, not just this step's (see
      // missingRequiredByStep) — then point the user at the first step that is
      // short something, instead of letting the server answer with a 400 that
      // names fields the user cannot even see.
      const missing = missingRequiredByStep(mergedData);
      if (missing.size > 0) {
        setInvalidSteps(new Set(missing.keys()));
        const labels = [...missing.values()].flat();
        const MAX = 3;
        toast.error(
          t('wizard.missingRequired', {
            fields: labels.slice(0, MAX).join(', ') + (labels.length > MAX ? '…' : ''),
          }),
        );
        goToStep(Math.min(...missing.keys()));
        return;
      }
      setInvalidSteps(new Set());

      // Final submission
      setSubmitting(true);
      try {
        // No submit TARGET: a declared `submitHandler` owns the write and needs no
        // adapter of its own (objectui#6176's seam), so only a form with NEITHER it
        // nor a `dataSource` is target-less. The one target-less form that is still
        // legitimate is the inline-fields collector, whose `onSuccess` IS the write.
        // This arm used to be `if (!dataSource)` alone: it confirmed EVERY
        // adapter-less submit, bypassing a declared host seam and persisting
        // nothing (objectui#6300). See `submitTarget.ts` for the whole rule.
        if (!dataSource && !schema.submitHandler && hasInlineFieldSource(schema)) {
          if (schema.onSuccess) {
            await schema.onSuccess(mergedData);
          }
          return mergedData;
        }
        
        let result;
        // Omit the fields the producer owns (#4069) — see
        // `omitServerResolvedDefaults` for why an empty key is not the same
        // as no key at insert time. Create only: on an edit form a cleared
        // column is a real removal. Computed ONCE so every persistence route
        // below — the host-owned seam included — writes the identical payload.
        const writePayload = schema.mode === 'create'
          ? omitServerResolvedDefaults(mergedData, objectSchema)
          : mergedData;

        if (schema.submitHandler) {
          // The host owns persistence (e.g. MasterDetailForm batching the
          // parent + its child collections into ONE atomic transaction). The
          // form validates and hands the values over; it does NOT create/update
          // itself. Same seam and same precedence as SimpleObjectForm — every
          // renderer `ObjectForm` routes to must check it FIRST, or a declared
          // host-owned write silently becomes an independent one
          // (objectui#6176).
          result = await schema.submitHandler(writePayload);
        } else if (!dataSource) {
          // No route left: no host seam and no adapter. Refuse instead of reporting
          // success — the `catch` below hands this to `schema.onError` and rethrows.
          throw noSubmitTargetError();
        } else if (schema.mode === 'create') {
          result = await dataSource.create(schema.objectName, writePayload);
        } else if (schema.mode === 'edit' && schema.recordId) {
          // OCC-guarded: sends `ifMatch` from the record we read; a 409 asks
          // the user to keep editing (skip the success path) or overwrite.
          // `formData.updated_at` is still the fetched value — no wizard step
          // renders an input for it.
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
        } else if (!schema.submitHandler && schema.submitBehavior) {
          const behavior = schema.submitBehavior;
          switch (behavior.kind) {
            case 'redirect': {
              // objectstack#7496 ruled this url a RELATIVE in-app path with
              // `{{record.field_name}}` interpolation, URL-escaped when the
              // redirect is built. Same consumption as ObjectForm's redirect
              // arm, through the same module, so a wizard and a flat form cannot
              // disagree about one authored value — see `submitRedirect.ts` for
              // why the shape verdict is the spec's own and what it does not fix.
              //
              // The old line asked `isSameOriginUrl`, which accepts a same-origin
              // ABSOLUTE url the contract refuses at the authoring door, and
              // dropped everything else in SILENCE after a successful write
              // (objectui#4989 defects 2, 3 and 5).
              const verdict = resolveSubmitRedirect(
                behavior.url,
                submitRedirectScope(mergedData, result),
              );
              if (!verdict.ok) {
                // The write SUCCEEDED and only the destination is out of
                // contract: confirm the submit, replace the still-filled step
                // form so there is nothing left to resubmit, and show the spec's
                // own prescription for the author.
                toast.error(verdict.refusal);
                setSubmitted({
                  message: schema.successMessage
                    || (schema.mode === 'create' ? 'Created' : 'Saved'),
                  refusal: verdict.refusal,
                });
                break;
              }
              // Hand the accepted destination to the effect that owns the wait
              // (objectui#5033). The verdict flow above is unchanged: this arm
              // still decides WHETHER to navigate, no longer when.
              setPendingRedirect({ url: verdict.url, delayMs: behavior.delayMs ?? 0 });
              break;
            }
            case 'continue':
              // Back to a fresh step 1 for the next entry — "fresh" means the
              // same opening values the wizard had, defaults included (#4047),
              // not a blank object the first entry never started from.
              setFormData(seedCreateValues(objectSchema, schema.initialData || schema.initialValues, { currentUserId }));
              setCompletedSteps(new Set());
              setCurrentStep(0);
              setResetNonce((n) => n + 1);
              break;
            case 'next-record':
            case 'thank-you':
            default: {
              const message = behavior.kind === 'thank-you' && behavior.message
                ? behavior.message
                : schema.successMessage || (schema.mode === 'create' ? 'Created' : 'Saved');
              toast.success(message);
              // Replace the (still fully filled) step form with a confirmation
              // panel so there's nothing left to resubmit.
              setSubmitted({ title: behavior.kind === 'thank-you' ? behavior.title : undefined, message });
              break;
            }
          }
        } else if (!schema.submitHandler) {
          // Legacy declarative success behaviors for metadata-only wizards.
          // Skipped when a `submitHandler` owns persistence: the host already
          // reports the outcome, so a second toast/redirect here would
          // double-confirm (the guard SimpleObjectForm applies for the same
          // reason).
          const nav = resolveSuccessNavigate(schema.navigateOnSuccess, result);
          if (nav) {
            // Landing on the saved record is the confirmation — no toast needed.
            //
            // WHO travels is what ObjectForm's arm does; see the long comment
            // there (objectui#5034, points 1 and 3). The destination goes to the
            // state the seam-owning effect above reads, so a mounted host's
            // basename is applied instead of the origin root. Unconditionally,
            // because `resolveSuccessNavigate` now accepts relative references
            // only — the `window.location.assign` arm that used to stand here is
            // unreachable and was deleted with the ruling that made it so.
            setPendingRedirect({ url: nav, delayMs: 0 });
            return result;
          }
          if (schema.navigateOnSuccess) {
            // Declared, and refused (objectui#5034 point 2). The write succeeded,
            // so this stays a success toast — with the one fact that was missing
            // attached to it. The template goes to the console for the author,
            // where naming it cannot mislead the submitter.
            console.warn(
              '[WizardForm] `navigateOnSuccess` was declared but produced no destination:',
              schema.navigateOnSuccess,
            );
            toast.success(
              schema.successMessage || (schema.mode === 'create' ? 'Created' : 'Saved'),
              { description: NAVIGATE_ON_SUCCESS_REFUSED_NOTE },
            );
          } else {
            toast.success(schema.successMessage || (schema.mode === 'create' ? 'Created' : 'Saved'));
          }
          if (schema.resetOnSuccess && schema.mode === 'create') {
            // Back to a fresh step 1 for the next entry — same opening values
            // as the first entry, defaults included (#4047).
            setFormData(seedCreateValues(objectSchema, schema.initialData || schema.initialValues, { currentUserId }));
            setCompletedSteps(new Set());
            setCurrentStep(0);
            setResetNonce((n) => n + 1);
          }
        }
        return result;
      } catch (err) {
        if (schema.onError) {
          schema.onError(err as Error);
        }
        throw err;
      } finally {
        setSubmitting(false);
      }
    } else {
      // Move to next step
      goToStep(currentStep + 1);
    }
  }, [formData, currentStep, isLastStep, schema, objectSchema, dataSource, missingRequiredByStep, t, saveWithOcc]);

  // Navigation
  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < totalSteps) {
      setCurrentStep(step);
      if (schema.onStepChange) {
        schema.onStepChange(step);
      }
    }
  }, [totalSteps, schema]);

  const handlePrev = useCallback(() => {
    goToStep(currentStep - 1);
  }, [currentStep, goToStep]);

  const handleCancel = useCallback(() => {
    if (schema.onCancel) {
      schema.onCancel();
    }
  }, [schema]);

  const handleStepClick = useCallback((step: number) => {
    if (schema.allowSkip || completedSteps.has(step) || step <= currentStep) {
      goToStep(step);
    }
  }, [schema.allowSkip, completedSteps, currentStep, goToStep]);

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

  if (submitted) {
    return (
      <div className={cn('w-full space-y-4', className, schema.className)}>
        <div className="rounded-md border bg-card p-8 text-center">
          <h3 className="text-lg font-semibold">{submitted.title ?? 'Thanks!'}</h3>
          {submitted.message && (
            <p className="mt-2 text-sm text-muted-foreground">{submitted.message}</p>
          )}
        </div>
        {/*
          A refused `redirect` destination (objectui#4989) keeps the confirmation
          above — the record WAS written — and adds the reason nothing was
          navigated to. `role="alert"` because it appears after the submit the
          user just made, so it has to reach a screen reader without a focus move.
        */}
        {submitted.refusal && (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
          >
            {submitted.refusal}
          </div>
        )}
      </div>
    );
  }

  const currentSection = schema.sections[currentStep];
  const clampCol = (n: unknown): number | undefined =>
    typeof n === 'number' && n > 0 ? Math.min(Math.floor(n), 4) : undefined;
  const stepGridColumns = clampCol(schema.columns) ?? clampCol(currentSection?.columns) ?? 1;
  const stepFieldContainerClass = containerGridColsFor(stepGridColumns);

  return (
    // `@container`: the step's field grid is sized with container queries
    // (`@md:grid-cols-2` …), which need a container ancestor to resolve against —
    // without one the classes are inert and a multi-column step silently stayed
    // single-column. Same wrapper TabbedForm / SplitForm carry.
    <div className={cn('w-full @container', className, schema.className)}>
      {/* Step Indicator */}
      {schema.showStepIndicator !== false && (
        <nav aria-label="Progress" className="mb-8">
          <ol className="flex items-center">
            {schema.sections.map((section, index) => {
              const isActive = index === currentStep;
              const isCompleted = completedSteps.has(index);
              const isClickable = schema.allowSkip || isCompleted || index <= currentStep;
              // The last submit found a required field outstanding on this step.
              const hasError = invalidSteps.has(index);

              return (
                <li
                  key={index}
                  className={cn(
                    'relative flex-1',
                    index !== totalSteps - 1 && 'pr-8 sm:pr-12'
                  )}
                >
                  {/* Connector line */}
                  {index !== totalSteps - 1 && (
                    <div
                      className="absolute top-3 sm:top-4 left-6 -right-4 sm:left-10 sm:-right-2 h-0.5"
                      aria-hidden="true"
                    >
                      <div
                        className={cn(
                          'h-full',
                          isCompleted ? 'bg-primary' : 'bg-muted'
                        )}
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    className={cn(
                      'group relative flex items-center',
                      isClickable ? 'cursor-pointer' : 'cursor-not-allowed'
                    )}
                    onClick={() => handleStepClick(index)}
                    disabled={!isClickable}
                    data-testid={`wizard-step:${section.name || index}`}
                    data-error={hasError || undefined}
                  >
                    {/* Step circle - smaller on mobile */}
                    <span
                      className={cn(
                        'flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full text-xs sm:text-sm font-medium transition-colors',
                        // An outstanding required field outranks the completed
                        // tick: the step needs attention, whatever else it is.
                        hasError && 'border-2 border-destructive bg-background text-destructive',
                        !hasError && isCompleted && 'bg-primary text-primary-foreground',
                        !hasError && isActive && !isCompleted && 'border-2 border-primary bg-background text-primary',
                        !hasError && !isActive && !isCompleted && 'border-2 border-muted bg-background text-muted-foreground'
                      )}
                    >
                      {hasError ? (
                        <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4" aria-hidden />
                      ) : isCompleted ? (
                        <Check className="h-3 w-3 sm:h-4 sm:w-4" />
                      ) : (
                        index + 1
                      )}
                    </span>

                    {/* Step label */}
                    <span className="ml-2 sm:ml-3 text-xs sm:text-sm font-medium hidden sm:block">
                      <span
                        className={cn(
                          hasError
                            ? 'text-destructive'
                            : isActive ? 'text-foreground' : 'text-muted-foreground'
                        )}
                      >
                        {section.label || `Step ${index + 1}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      {/* Current Step Content */}
      <div className="min-h-[200px]">
        {currentSection && (
          <FormSectionContainer
            label={currentSection.label}
            description={currentSection.description}
            columns={1}
            className={currentSection.className}
            gridClassName={currentSection.gridClassName}
          >
            {currentSectionFields.length > 0 ? (
              <SchemaRenderer
                key={resetNonce}
                schema={{
                  type: 'form' as const,
                  objectName: schema.objectName,
                  id: stepFormId,
                  // Multi-column on the field container inside the form, not a
                  // grid around the whole form (which leaves columns empty).
                  //
                  // Grid width: the form view's own `columns` first (spec
                  // FormView.columns — it was being dropped, so a view that
                  // declared 3 columns rendered single-column here while the same
                  // metadata gave 3 in a modal), else this step's own `columns`.
                  // Unlike the tabbed/split hosts there is no widest-section
                  // fallback: wizard steps never share a viewport, so there is no
                  // shared grid to size, and each step keeps its authored width.
                  fields: stepGridColumns > 1
                    ? applyAutoColSpan(currentSectionFields, stepGridColumns, clampCol(currentSection.columns))
                    : currentSectionFields,
                  columns: stepGridColumns,
                  ...(stepFieldContainerClass ? { fieldContainerClass: stepFieldContainerClass } : {}),
                  layout: 'vertical' as const,
                  defaultValues: formData,
                  // Persisted record → `previous` binding + read-only submit
                  // strip (#3484). Never `formData`: that already carries the
                  // answers from earlier steps.
                  previousValues: schema.mode === 'edit' ? persistedRecord : undefined,
                  showSubmit: false,
                  showCancel: false,
                  onSubmit: handleStepSubmit,
                }}
              />
            ) : (
              // A step can legitimately have NO inputs — a final "Review"/confirm
              // step is the canonical case (this component's own usage example
              // ends on `{ label: 'Step 3: Review', fields: [] }`). The footer
              // Next/Create buttons submit the step form *natively* by id, so
              // that form has to exist even when there is nothing to fill in:
              // without it the buttons point at a missing target, the click does
              // nothing at all, and a wizard that ends on a review step can never
              // be completed. Submitting contributes no new values — the record
              // is whatever the earlier steps accumulated in `formData`.
              <form
                id={stepFormId}
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleStepSubmit({});
                }}
              >
                <div className="text-center py-8 text-muted-foreground">
                  No fields configured for this step
                </div>
              </form>
            )}
          </FormSectionContainer>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t">
        <div>
          {schema.showCancel !== false && (
            <Button
              variant="ghost"
              onClick={handleCancel}
            >
              {schema.cancelText || 'Cancel'}
            </Button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Step counter */}
          <span className="text-sm text-muted-foreground mr-2">
            Step {currentStep + 1} of {totalSteps}
          </span>
          
          {!isFirstStep && (
            <Button
              variant="outline"
              onClick={handlePrev}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {schema.prevText || 'Back'}
            </Button>
          )}
          
          {isLastStep ? (
            <Button
              type="submit"
              form={stepFormId}
              disabled={submitting || schema.mode === 'view'}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              {submitting ? 'Submitting...' : (schema.submitText || (schema.mode === 'create' ? 'Create' : 'Update'))}
            </Button>
          ) : (
            <Button
              type="submit"
              form={stepFormId}
            >
              {schema.nextText || 'Next'}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
      {conflictDialog}
    </div>
  );
};

export default WizardForm;
