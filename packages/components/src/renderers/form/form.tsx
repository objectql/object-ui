/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry, resolveFieldRuleState, evalFieldPredicate, resolveVisibleOptions, isOptionGroupGated, resolveDependsOnFields, isValueStillOffered } from '@object-ui/core';
import type { FormSchema, FormField as FormFieldConfig, ValidationRule, FieldCondition, SelectOption } from '@object-ui/types';
import { useForm } from 'react-hook-form';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '../../ui/form';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Checkbox } from '../../ui/checkbox';
import { Switch } from '../../ui/switch';
import { 
  Select, 
  SelectTrigger, 
  SelectValue, 
  SelectContent, 
  SelectItem 
} from '../../ui/select';
import { renderChildren } from '../../lib/utils';
import { Alert, AlertDescription } from '../../ui/alert';
import { toast } from '../../ui/sonner';
import { AlertCircle, ChevronDown, ChevronRight, Loader2, Maximize2, Check, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { cn } from '../../lib/utils';
import React from 'react';
import { SchemaRendererContext, usePredicateScope } from '@object-ui/react';
import { createSafeTranslation } from '@object-ui/i18n';

/** Inline section header rendered as a virtual field inside a flat SchemaRenderer field list.
 *  Collapsibility is controlled externally (collapsed state lives in DrawerForm). */
function SectionDivider({ label, collapsible, collapsed, onToggle, className }: {
  label?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  className?: string;
}) {
  if (!label) return null;
  return (
    <div
      className={cn(
        'col-span-full pt-4 pb-1 border-b border-border',
        collapsible && 'cursor-pointer select-none',
        className
      )}
      onClick={collapsible ? onToggle : undefined}
      role={collapsible ? 'button' : undefined}
      aria-expanded={collapsible ? !collapsed : undefined}
    >
      <div className="flex items-center gap-1.5">
        {collapsible && (
          collapsed
            ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="text-sm font-semibold text-foreground">{label}</span>
      </div>
    </div>
  );
}

const useSafeFormTranslation = createSafeTranslation(
  {
    'common.selectOption': 'Select an option',
    'validation.required': '{{field}} is required',
    'validation.minLength': '{{field}} must be at least {{min}} characters',
    'validation.maxLength': '{{field}} must be at most {{max}} characters',
    'validation.min': '{{field}} must be at least {{min}}',
    'validation.max': '{{field}} must be at most {{max}}',
    'validation.pattern': '{{field}} format is invalid',
    'validation.email': 'Please enter a valid email address',
    'validation.url': 'Please enter a valid URL',
    'validation.formInvalid': 'Please check the highlighted fields: {{fields}}',
  },
  'common.selectOption',
);

// --- Dirty detection -------------------------------------------------------
// react-hook-form's `isDirty` compares current values against `defaultValues`
// by strict identity, which produces false positives on a freshly opened form:
// several field widgets normalize their empty state on mount (e.g. '' -> null,
// undefined -> '', a cleared lookup -> null), and `null !== undefined` makes
// RHF flag an untouched create form as dirty. That made the discard-guard pop
// its "unsaved changes?" prompt even when the user typed nothing. We instead
// compute dirtiness ourselves with a comparison that treats all empty-ish
// values as equivalent, so only a genuine edit (empty <-> meaningful, or one
// meaningful value -> another) counts.
const isEmptyish = (v: unknown): boolean =>
  v === undefined ||
  v === null ||
  v === '' ||
  (Array.isArray(v) && v.length === 0);

const valuesEqualForDirty = (a: unknown, b: unknown): boolean => {
  if (isEmptyish(a) && isEmptyish(b)) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return a === b;
  }
};

const computeDirty = (
  baseline: Record<string, unknown>,
  values: Record<string, unknown>,
): boolean => {
  const keys = new Set([
    ...Object.keys(baseline ?? {}),
    ...Object.keys(values ?? {}),
  ]);
  for (const k of keys) {
    if (!valuesEqualForDirty(baseline?.[k], values?.[k])) return true;
  }
  return false;
};

const BUILTIN_FIELD_TYPES = new Set(['input', 'textarea', 'checkbox', 'switch', 'select']);
const DATA_SOURCE_FIELD_TYPES = new Set(['lookup', 'master_detail', 'tree']);

function stripRendererOnlyProps<T extends Record<string, any>>(props: T): T {
  const {
    dataSource: _dataSource,
    inputType: _inputType,
    options: _options,
    field: _field,
    schema: _schema,
    showActions: _showActions,
    fieldContainerClass: _fieldContainerClass,
    mobileStickyActions: _mobileStickyActions,
    mobile_fullscreen: _mobileFullscreen,
    fullscreen: _fullscreen,
    dependentValues: _dependentValues,
    dependsOn: _dependsOn,
    emptyHint: _emptyHint,
    ...domProps
  } = props;

  return domProps as T;
}

function normalizeFieldType(type: string): string {
  return type.startsWith('field:') ? type.slice('field:'.length) : type;
}

function stripRegisteredFieldProps(type: string, props: RenderFieldProps): RenderFieldProps {
  const {
    dataSource,
    inputType: _inputType,
    showActions: _showActions,
    fieldContainerClass: _fieldContainerClass,
    mobileStickyActions: _mobileStickyActions,
    mobile_fullscreen: _mobileFullscreen,
    fullscreen: _fullscreen,
    dependentValues,
    emptyHint: _emptyHint,
    schema: _schema,
    ...fieldProps
  } = props;
  const normalizedType = normalizeFieldType(type);

  return {
    ...fieldProps,
    ...(DATA_SOURCE_FIELD_TYPES.has(normalizedType) ? { dataSource, dependentValues } : {}),
  };
}

/**
 * FullscreenTextarea — `<Textarea>` with a top-right "expand" button that
 * opens a fullscreen edit dialog. Mobile UX (round 3) — driven by the form
 * field's `mobile_fullscreen: true` flag (propagated from
 * `ObjectFormSchema.mobile.fullscreenLongText`).
 */
function FullscreenTextarea({
  value,
  onChange,
  placeholder,
  className,
  label,
  ...rest
}: {
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  [key: string]: any;
}) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(value ?? '');
  const safeOnChange = (v: string) => onChange && onChange(v);
  const openDialog = () => { setDraft(value ?? ''); setOpen(true); };
  const commit = () => { safeOnChange(draft); setOpen(false); };
  return (
    <div className="relative">
      <Textarea
        placeholder={placeholder}
        className={cn('pr-10', className)}
        value={value ?? ''}
        onChange={(e) => safeOnChange(e.target.value)}
        {...rest}
      />
      <button
        type="button"
        onClick={openDialog}
        className="absolute top-1.5 right-1.5 inline-flex items-center justify-center size-7 rounded-md bg-background/80 text-muted-foreground hover:text-foreground hover:bg-background border shadow-sm"
        aria-label={`Edit ${label ?? 'text'} fullscreen`}
        data-testid="form-textarea-fullscreen-toggle"
      >
        <Maximize2 className="size-3.5" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-3xl h-[100dvh] sm:h-[80vh] max-h-[100dvh] sm:max-h-[80vh] flex flex-col p-0 gap-0"
          data-testid="form-textarea-fullscreen-dialog"
        >
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="text-base">{label ?? 'Edit text'}</DialogTitle>
            <DialogDescription className="sr-only">
              Edit the full text value, then save or cancel your changes.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 p-4">
            <Textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              className="h-full min-h-full resize-none text-base"
              data-testid="form-textarea-fullscreen-input"
            />
          </div>
          <DialogFooter className="p-3 border-t flex-row justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              <X className="size-4 mr-1" /> Cancel
            </Button>
            <Button type="button" onClick={commit} data-testid="form-textarea-fullscreen-save">
              <Check className="size-4 mr-1" /> Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Form renderer component - Airtable-style feature-complete form
ComponentRegistry.register('form',
  ({ schema, className, onAction, ...props }: { schema: FormSchema; className?: string; onAction?: (action: any) => void; [key: string]: any }) => {
    const { t } = useSafeFormTranslation();
    const {
      defaultValues = {},
      fields = [],
      submitLabel = 'Submit',
      cancelLabel = 'Cancel',
      showCancel = false,
      showSubmit = true,
      layout = 'vertical',
      columns = 1,
      onSubmit: onSubmitProp,
      onChange: onChangeProp,
      onDirtyChange: onDirtyChangeProp,
      onCancel: onCancelProp,
      resetOnSubmit = false,
      validationMode = 'onSubmit',
      disabled = false,
    } = schema;

    // Initialize react-hook-form
    const form = useForm({
      defaultValues,
      mode: validationMode,
    });

    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [submitError, setSubmitError] = React.useState<string | null>(null);

    // Live snapshot of all form values — subscribes to every change so
    // field-level CEL rules (visibleWhen/readonlyWhen/requiredWhen) re-evaluate
    // reactively as the user edits. Evaluated below via the canonical
    // `@objectstack/formula` engine (same dialect the server enforces). We seed
    // every declared field name to `null` first so a predicate that references
    // a field react-hook-form hasn't registered yet (e.g. on initial mount,
    // before defaults populate) evaluates against a present-but-null value
    // rather than faulting — mirroring the server, which evaluates over the
    // full merged record.
    const watched = form.watch() as Record<string, unknown>;
    const ruleRecord = React.useMemo(() => {
      // Seed every declared field to `null` so a predicate referencing a field
      // that's absent / not-yet-registered evaluates against a present-null
      // value. The canonical CEL engine throws "No such key" on a *missing*
      // field (which would fail the predicate open), but compares cleanly
      // against `null`. Overlay only DEFINED watched values so an unregistered
      // field (value `undefined`) doesn't clobber its null seed back to missing.
      const out: Record<string, unknown> = {};
      for (const f of fields) if (f?.name) out[f.name] = null;
      for (const k of Object.keys(watched)) if (watched[k] !== undefined) out[k] = watched[k];
      return out;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fields, JSON.stringify(watched)]);

    // When a field's CEL rule relaxes — it becomes hidden (visibleWhen FALSE) or
    // no longer required (requiredWhen FALSE) — clear any stale validation error
    // left from a prior submit attempt. react-hook-form keeps an error until the
    // erroring field itself revalidates; without this a "required" message would
    // linger after the condition that imposed it (e.g. status) changed.
    React.useEffect(() => {
      const errs = form.formState.errors as Record<string, unknown>;
      if (!errs || Object.keys(errs).length === 0) return;
      for (const f of fields as FormFieldConfig[]) {
        const name = f?.name;
        if (!name || !errs[name]) continue;
        const st = resolveFieldRuleState(
          {
            visibleWhen: (f as any).visibleWhen,
            readonlyWhen: (f as any).readonlyWhen,
            requiredWhen: (f as any).requiredWhen,
            conditionalRequired: (f as any).conditionalRequired,
          },
          ruleRecord,
          { required: !!f.required, readonly: (f as any).readonly === true },
        );
        // View-level FormField.visibleOn hides the field the same way a
        // field-level visibleWhen does (#2212) — fold it into the verdict.
        const viewVisible =
          (f as any).visibleOn == null ||
          evalFieldPredicate((f as any).visibleOn, ruleRecord, true);
        // A hidden field shows no errors at all; an un-required field clears
        // only its *required* error (keep legitimate format/min/etc. errors).
        const errType = (errs[name] as { type?: string } | undefined)?.type;
        if (!st.visible || !viewVisible || (!st.required && errType === 'required')) form.clearErrors(name);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ruleRecord]);

    // Read DataSource from SchemaRendererContext and propagate it to field
    // widgets as a prop so they can dynamically load related records.
    const schemaCtx = React.useContext(SchemaRendererContext);
    const contextDataSource = schemaCtx?.dataSource ?? null;

    // Global predicate scope (from the host shell's ExpressionProvider) — carries
    // `current_user` etc. so per-option `visibleWhen` can gate on role/context in
    // addition to sibling field values. Empty object when no provider is mounted.
    const predicateScope = usePredicateScope();

    // Field name → label, for the "select the parent first" gate hint (#2284).
    const fieldLabelByName = React.useMemo(() => {
      const m: Record<string, string> = {};
      for (const f of fields as FormFieldConfig[]) if (f?.name) m[f.name] = (f as any).label || f.name;
      return m;
    }, [fields]);

    // Cascade clear (#2284): when a select/radio's option list narrows — because a
    // controlling field changed or a role/context predicate flipped — a previously
    // chosen value may no longer be offered. Drop it so the form never submits a
    // stale "china + california" pair. Mirrors the dependent-lookup gate but for
    // static/predicate-driven option sets. Fail-open filtering keeps unrelated
    // fields untouched (no visibleWhen / dependsOn → nothing recomputed).
    React.useEffect(() => {
      for (const f of fields as FormFieldConfig[]) {
        const name = f?.name;
        if (!name) continue;
        const resolvedType = (f as any).widget || f.type;
        if (resolvedType !== 'select' && resolvedType !== 'radio' && resolvedType !== 'multiselect') continue;
        const opts = (f as any).options as SelectOption[] | undefined;
        if (!opts || opts.length === 0) continue;
        const dependsOn = (f as any).dependsOn;
        const hasOptionPredicate = opts.some((o) => (o as any)?.visibleWhen != null);
        if (!hasOptionPredicate && !dependsOn) continue;
        const current = form.getValues(name);
        if (current === undefined || current === null || current === '') continue;
        // While gated (a dependency is empty) the whole list is withheld — clear
        // any prior value so it can't linger past a parent reset.
        const gated = isOptionGroupGated(dependsOn, ruleRecord);
        const visible = gated ? [] : resolveVisibleOptions(opts, ruleRecord, predicateScope);
        if (!isValueStillOffered(current, visible)) {
          form.setValue(name, Array.isArray(current) ? [] : undefined, {
            shouldValidate: false,
            shouldDirty: true,
          });
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ruleRecord, predicateScope]);

    // React to defaultValues changes — but ONLY when the values actually
    // change, not on every new object identity. Callers often pass a freshly
    // built `defaultValues` object on each render; resetting on identity alone
    // wiped user input mid-interaction (e.g. a parent re-render between a submit
    // click and the deferred requestSubmit emptied the form, so validation then
    // failed on now-blank required fields and nothing was saved). Compare by
    // value so a genuine change (e.g. an edit-mode record finishing loading)
    // still resets, while identity churn is ignored.
    const lastDefaultsKey = React.useRef<string | undefined>(undefined);
    // The pristine snapshot the dirty check compares against. Kept in sync with
    // whatever we last reset the form to (initial defaults, or a loaded record).
    const baselineRef = React.useRef<Record<string, unknown>>(
      (defaultValues ?? {}) as Record<string, unknown>,
    );
    React.useEffect(() => {
      let key: string;
      try { key = JSON.stringify(defaultValues ?? {}); } catch { key = String(Date.now()); }
      if (lastDefaultsKey.current === key) return;
      lastDefaultsKey.current = key;
      form.reset(defaultValues);
      baselineRef.current = (defaultValues ?? {}) as Record<string, unknown>;
      // A fresh reset is by definition pristine — clear any stale dirty signal
      // (e.g. an edit-mode record that just finished loading).
      onDirtyChangeProp?.(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [defaultValues]);

    // Watch for form changes - only track changes when onAction is available
    React.useEffect(() => {
      if (onAction) {
        const subscription = form.watch((data) => {
          onAction({
            type: 'form_change',
            data,
            formData: data,
          });
        });
        return () => subscription.unsubscribe();
      }
    }, [form, onAction]);

    // Surface dirty state to the host (e.g. a modal/drawer guarding against
    // accidental discard of unsaved input). We compute it via a normalized
    // comparison against the pristine baseline (see computeDirty) rather than
    // react-hook-form's `isDirty`, which false-positives on fields that
    // self-normalize their empty value on mount.
    React.useEffect(() => {
      const subscription = form.watch((values) => {
        onDirtyChangeProp?.(
          computeDirty(baselineRef.current, values as Record<string, unknown>),
        );
      });
      return () => subscription.unsubscribe();
    }, [form, onDirtyChangeProp]);

    // Handle form submission
    const handleSubmit = form.handleSubmit(async (data) => {
      setIsSubmitting(true);
      setSubmitError(null);

      // Defensive check: If data is an Event, use getValues()
      let formData = data;
      // Check for Event-like properties
      const isEvent = data && (
        (data as any).nativeEvent || 
        typeof (data as any).preventDefault === 'function' || 
        typeof (data as any).stopPropagation === 'function' ||
        (data as any).target ||
        (data as any).bubbles
      );

      if (isEvent) {
        // This should not happen with RHF handleSubmit, but just in case
        formData = form.getValues();
      } else if (!formData || Object.keys(formData).length === 0) {
        // Fallback: if data is empty check getValues(), in case RHF failed to pass it for some reason
        const values = form.getValues();
        if (values && Object.keys(values).length > 0) {
             formData = values;
        }
      }

      try {
        if (onAction) {
          const result = await onAction({
            type: 'form_submit',
            data: formData,
            formData: formData,
          }) as any;

          // Check if submission returned an error
          if (result?.error) {
            setSubmitError(result.error);
            // Also surface as a toast so the message is visible even when the
            // in-form banner has scrolled out of view (long forms in modals/drawers).
            toast.error(result.error);
            return;
          }
        }

        if (onSubmitProp && typeof onSubmitProp === 'function') {
          await onSubmitProp(formData);
        }

        if (resetOnSubmit) {
          form.reset();
        }
      } catch (error) {
        // Handle different error types safely
        const errorMessage = error instanceof Error 
          ? error.message 
          : typeof error === 'string' 
            ? error 
            : 'An error occurred during submission';
        setSubmitError(errorMessage);
        // Also surface as a toast so the message is visible even when the
        // in-form banner has scrolled out of view (long forms in modals/drawers).
        toast.error(errorMessage);

        // Log errors for debugging (dev environment only)
        // process may not be defined in all environments
        if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
          console.error('Form submission error:', error);
        }
      } finally {
        setIsSubmitting(false);
      }
    }, (validationErrors) => {
      // Client-side (react-hook-form) validation blocked the submit. The
      // per-field errors render inline, but in long forms the offending field
      // is often scrolled out of view — the user clicks 创建 and sees nothing
      // happen. Surface a toast naming the fields so the feedback is visible
      // regardless of scroll position (mirrors the server-error toast above).
      const names = Object.keys(validationErrors || {});
      if (names.length === 0) return;
      const labels = names.map((n) => fieldLabelByName[n] || n);
      const MAX = 3;
      const fieldsText = labels.slice(0, MAX).join('、') + (labels.length > MAX ? '…' : '');
      toast.error(t('validation.formInvalid', { fields: fieldsText }));
    });

    // Handle cancel
    const handleCancel = () => {
      form.reset();
      
      if (onCancelProp && typeof onCancelProp === 'function') {
        onCancelProp();
      }

      if (onAction) {
        onAction({
          type: 'form_cancel',
          data: form.getValues(),
        });
      }
    };

    // Determine grid classes based on columns (explicit classes for Tailwind JIT)
    // Mobile-first: 1 column on mobile, responsive breakpoints for larger screens
    const gridColsClass = 
      columns === 1 ? '' :
      columns === 2 ? 'md:grid-cols-2' :
      columns === 3 ? 'md:grid-cols-2 lg:grid-cols-3' :
      'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
    
    const gridClass = columns > 1 
      ? cn('grid gap-4', gridColsClass)
      : 'space-y-4';

    // Extract designer-related props and conflicting handlers
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style,
        onSubmit: _ignoredOnSubmit, // Prevent overwriting our handleSubmit
        onChange: _ignoredOnChange, // Prevent overwriting our onChange
        // Extract schema props that should not be spread to DOM (handled separately by schema destructuring above)
        submitLabel: _submitLabel,
        cancelLabel: _cancelLabel,
        showSubmit: _showSubmit,
        showCancel: _showCancel,
	        resetOnSubmit: _resetOnSubmit,
	        defaultValues: _defaultValues,
	        inputType: _inputType,
          dataSource: _dataSource,
          showActions: _showActions,
          fieldContainerClass: _fieldContainerClass,
          mobileStickyActions: _mobileStickyActions,
	        ...formProps
	    } = props;

    return (
      <Form {...form}>
        <form 
            onSubmit={handleSubmit} 
            className={className} 
            {...formProps}
            // Apply designer props
            data-obj-id={dataObjId}
            data-obj-type={dataObjType}
            style={style}
        >
          {/* Form Error Alert */}
          {submitError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          {/* Form Fields */}
          {schema.children ? (
            // If children are provided directly, render them
            <div className={schema.fieldContainerClass || 'space-y-4'}>
              {renderChildren(schema.children)}
            </div>
          ) : (
            // Otherwise render fields from schema
            <div className={schema.fieldContainerClass || gridClass}>
              {fields.map((field: FormFieldConfig) => {
                const {
                  name,
                  label,
                  description,
                  type = 'input',
                  required: staticRequired = false,
                  disabled: fieldDisabled = false,
                  validation = {},
                  condition,
                  colSpan,
                  hidden,
                  widget,
                  visibleOn,
                  readonly: staticReadonly,
                  visibleWhen,
                  readonlyWhen,
                  requiredWhen,
                  conditionalRequired,
                  ...fieldProps
                } = field;

                // Skip hidden fields
                if (hidden) return null;

                // Handle conditional rendering with null/undefined safety
                if (condition) {
                  const watchField = condition.field;
                  const watchValue = form.watch(watchField);

                  // Check for null/undefined before evaluating conditions
                  const hasValue = watchValue !== undefined && watchValue !== null;

                  if (condition.equals !== undefined && watchValue !== condition.equals) {
                    return null;
                  }
                  if (condition.notEquals !== undefined && watchValue === condition.notEquals) {
                    return null;
                  }
                  if (condition.in && (!hasValue || !condition.in.includes(watchValue))) {
                    return null;
                  }
                }

                // Field-level CEL conditional rules (B2). Evaluated reactively
                // against the live record via the canonical engine — same
                // dialect the server enforces (requiredWhen / readonlyWhen), so
                // the UX and the persisted verdict agree. A field with no rules
                // resolves to its static flags unchanged.
                const ruleState = resolveFieldRuleState(
                  { visibleWhen, readonlyWhen, requiredWhen, conditionalRequired },
                  ruleRecord,
                  { required: staticRequired, readonly: staticReadonly === true },
                );
                if (!ruleState.visible) return null;

                // View-level conditional visibility — spec FormField.visibleOn,
                // authored on the form view (not the object field). Same
                // canonical CEL engine and record scope as visibleWhen; both
                // the bare-string and `{ dialect, source }` wire shapes are
                // accepted, and a broken predicate fails open (#2212).
                if (visibleOn != null && !evalFieldPredicate(visibleOn, ruleRecord, true)) {
                  return null;
                }
                const required = ruleState.required;
                const readonly = ruleState.readonly;

                // Section divider — renders a collapsible FormSection header inline
                // so all fields share the same form instance (enables cross-section conditions).
                if (type === 'section-divider') {
                  const fp = fieldProps as any;
                  return (
                    <SectionDivider
                      key={name}
                      label={label}
                      collapsible={fp.collapsible}
                      collapsed={fp.collapsed}
                      onToggle={fp.onToggle}
                      className={fp.className}
                    />
                  );
                }

                // Build validation rules
                const rules: any = {
                  ...validation,
                };

                if (required) {
                  rules.required = typeof validation.required === 'string'
                    ? validation.required
                    : t('validation.required', { field: label || name });
                }

                // Localize the standard validation messages emitted by
                // buildValidationRules. Each such rule carries a `messageKey`
                // and leaves `message` undefined for the auto-generated case
                // (a field-authored message is a string and is left untouched);
                // we fill the blanks through i18n so they track the label's
                // language. A fresh object avoids mutating the shared rule.
                const localizeRule = (
                  rule: any,
                  interp?: (r: any) => Record<string, unknown>,
                ) => {
                  if (
                    rule && typeof rule === 'object' &&
                    rule.message == null && typeof rule.messageKey === 'string'
                  ) {
                    return {
                      ...rule,
                      message: t(rule.messageKey, { field: label || name, ...(interp?.(rule)) }),
                    };
                  }
                  return rule;
                };
                if (rules.minLength) rules.minLength = localizeRule(rules.minLength, r => ({ min: r.value }));
                if (rules.maxLength) rules.maxLength = localizeRule(rules.maxLength, r => ({ max: r.value }));
                if (rules.min) rules.min = localizeRule(rules.min, r => ({ min: r.value }));
                if (rules.max) rules.max = localizeRule(rules.max, r => ({ max: r.value }));
                if (rules.pattern) rules.pattern = localizeRule(rules.pattern);

                // Use field.id or field.name for stable keys (never use index alone)
                const fieldKey = field.id ?? name;

                // Resolve the component type: prefer widget override, fallback to field type
                const resolvedType = widget || type;

                // Cascading / role-gated option lists (#2284). For option fields,
                // narrow the set by each option's `visibleWhen` (evaluated against
                // the live record + `current_user`), and gate the whole control
                // while a declared `dependsOn` parent is still empty — surfacing a
                // "select the parent first" hint instead of an unfiltered list.
                const isOptionField =
                  resolvedType === 'select' || resolvedType === 'radio' || resolvedType === 'multiselect';
                const rawOptions = (fieldProps as any).options as SelectOption[] | undefined;
                const dependsOnFields = isOptionField
                  ? resolveDependsOnFields((field as any).dependsOn)
                  : [];
                const optionGroupGated =
                  dependsOnFields.length > 0 && isOptionGroupGated((field as any).dependsOn, ruleRecord);
                const effectiveOptions = isOptionField
                  ? optionGroupGated
                    ? []
                    : resolveVisibleOptions(rawOptions, ruleRecord, predicateScope)
                  : rawOptions;
                const gatedHint = optionGroupGated
                  ? `Select ${dependsOnFields.map((fn) => fieldLabelByName[fn] || fn).join(' / ')} first`
                  : undefined;

                // colSpan classes for grid layout.
                //
                // When the container uses container-query-based grid classes
                // (e.g. `@md:grid-cols-2`), the grid's base is `grid-cols-1`
                // on narrow containers. Applying a bare `col-span-2` in that
                // state causes CSS grid to synthesize an implicit 2nd column
                // track, distorting column widths. We must mirror the same
                // container-query prefix on the col-span utilities so they
                // only engage once the grid is actually multi-column.
                // The effective container is whatever wraps the fields: either
                // `fieldContainerClass` (overrides, typically container-query based)
                // or the locally-computed `gridClass` (viewport-based).
                const containerClass = schema.fieldContainerClass || gridClass;
                // Match both container-query (`@md:`) and viewport (`md:`) prefixes.
                // Return an explicit, statically-detectable class so Tailwind JIT
                // can scan and include it.
                const pickSpanClass = (targetCols: number): string => {
                  const re = /(@)?(sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl):grid-cols-(\d+)/g;
                  const matches = Array.from(containerClass.matchAll(re)).map(m => ({
                    at: m[1] || '',
                    bp: m[2],
                    cols: Number(m[3]),
                  }));
                  if (!matches.length) {
                    // No responsive/container prefix found — bare class is safe
                    // because the grid is already multi-column at all widths.
                    if (targetCols === 2) return 'col-span-2';
                    if (targetCols === 3) return 'col-span-3';
                    return 'col-span-4';
                  }
                  const hit = matches.find(m => m.cols >= targetCols) || matches[matches.length - 1];
                  const key = `${hit.at}${hit.bp}:${targetCols}`;
                  // Explicit literal map so Tailwind JIT discovers these classes.
                  const table: Record<string, string> = {
                    '@sm:2':  '@sm:col-span-2',
                    '@md:2':  '@md:col-span-2',
                    '@lg:2':  '@lg:col-span-2',
                    '@xl:2':  '@xl:col-span-2',
                    '@2xl:2': '@2xl:col-span-2',
                    '@sm:3':  '@sm:col-span-3',
                    '@md:3':  '@md:col-span-3',
                    '@lg:3':  '@lg:col-span-3',
                    '@xl:3':  '@xl:col-span-3',
                    '@2xl:3': '@2xl:col-span-3',
                    '@4xl:3': '@4xl:col-span-3',
                    '@sm:4':  '@sm:col-span-4',
                    '@md:4':  '@md:col-span-4',
                    '@lg:4':  '@lg:col-span-4',
                    '@xl:4':  '@xl:col-span-4',
                    '@2xl:4': '@2xl:col-span-4',
                    '@4xl:4': '@4xl:col-span-4',
                    'sm:2':   'sm:col-span-2',
                    'md:2':   'md:col-span-2',
                    'lg:2':   'lg:col-span-2',
                    'xl:2':   'xl:col-span-2',
                    'sm:3':   'sm:col-span-3',
                    'md:3':   'md:col-span-3',
                    'lg:3':   'lg:col-span-3',
                    'xl:3':   'xl:col-span-3',
                    'sm:4':   'sm:col-span-4',
                    'md:4':   'md:col-span-4',
                    'lg:4':   'lg:col-span-4',
                    'xl:4':   'xl:col-span-4',
                  };
                  return table[key] || (targetCols === 2 ? 'col-span-2' : targetCols === 3 ? 'col-span-3' : 'col-span-4');
                };

                const colSpanClass = colSpan && colSpan > 1
                  ? colSpan === 2 ? pickSpanClass(2)
                  : colSpan === 3 ? pickSpanClass(3)
                  : colSpan >= 4 ? pickSpanClass(4)
                  : ''
                  : '';

                // Metadata-derived stable locator (ADR-0054 C4): the renderer
                // emits it from the object + field name so every generated form
                // inherits it with zero per-app work. Object prefix omitted when
                // the form schema has no owning object.
                const fieldTestId = `field:${schema.objectName ? `${schema.objectName}.` : ''}${name}`;

                return (
                  <FormField
                    key={fieldKey}
                    control={form.control}
                    name={name}
                    rules={rules}
                    render={({ field: formField }) => (
                      <FormItem
                        className={colSpanClass || undefined}
                        data-testid={fieldTestId}
                        data-field={name}
                      >
                        {label && (
                          <FormLabel className="text-xs font-normal text-muted-foreground">
                            {label}
                            {required && (
                              <span className="text-destructive ml-1" aria-label="required">
                                *
                              </span>
                            )}
                          </FormLabel>
                        )}
                        <FormControl>
                          {/* Render the actual field component based on resolved type */}
                          {renderFieldComponent(resolvedType, {
                            ...fieldProps,
                            // specialized fields needs raw metadata, but we should traverse down if it exists
                            // field is the field configuration loop variable
                            field: (field as any).field || field, 
                            ...formField,
                            inputType: fieldProps.inputType,
                            options: isOptionField ? effectiveOptions : fieldProps.options,
                            placeholder: fieldProps.placeholder ?? (resolvedType === 'select' ? t('common.selectOption') : undefined),
                            // `disabled` means "not interactive, muted"; `readonly` means
                            // "shown plainly, not editable" — keep them distinct so widgets
                            // that implement a real readonly display (e.g. EmailField's
                            // mailto link) actually receive it instead of always collapsing
                            // to the grayed-out disabled look. A dependency-gated option
                            // list (#2284) is disabled until its controlling field is set.
                            disabled: disabled || fieldDisabled || isSubmitting || optionGroupGated,
                            readonly,
                            // Gate hint shown when a dependent option list is still
                            // waiting on its controlling field (#2284).
                            emptyHint: gatedHint,
                            dataSource: contextDataSource,
                            // Live form values for dependent (cascading) lookups
                            // (#2215): the widget's `dependsOn` gate + filters must
                            // re-scope as the user picks the parent field in THIS
                            // form, not read a stale record snapshot. Forwarded to
                            // data-source widgets only (see stripRegisteredFieldProps).
                            dependentValues: ruleRecord,
                          })}
                        </FormControl>
                        {description && (
                          <FormDescription>{description}</FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                );
              })}
            </div>
          )}

          {/* Form Actions */}
          {(schema.showActions !== false) && (
            <div
              className={cn(
                `flex flex-col sm:flex-row gap-2 ${layout === 'horizontal' ? 'sm:justify-end' : 'sm:justify-start'} mt-6`,
                schema.mobileStickyActions &&
                  'sticky bottom-0 z-10 -mx-4 px-4 py-3 bg-background/95 supports-[backdrop-filter]:bg-background/80 backdrop-blur border-t md:static md:mx-0 md:px-0 md:py-0 md:bg-transparent md:border-0 md:backdrop-blur-none',
              )}
              data-testid={schema.mobileStickyActions ? 'form-mobile-sticky-actions' : undefined}
            >
              {showCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSubmitting || disabled}
                  className="w-full sm:w-auto"
                >
                  {cancelLabel}
                </Button>
              )}
              {showSubmit && (
              <Button
                type="submit"
                disabled={isSubmitting || disabled}
                className="w-full sm:w-auto"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitLabel}
              </Button>
              )}
            </div>
          )}
        </form>
      </Form>
    );
  },
  {
    namespace: 'ui',
    label: 'Form',
    inputs: [
      { 
        name: 'fields', 
        type: 'array', 
        label: 'Fields',
        description: 'Array of field configurations with name, label, type, validation, etc.'
      },
      { 
        name: 'defaultValues', 
        type: 'object', 
        label: 'Default Values',
        description: 'Object with default values for form fields'
      },
      { name: 'submitLabel', type: 'string', label: 'Submit Button Label', defaultValue: 'Submit' },
      { name: 'cancelLabel', type: 'string', label: 'Cancel Button Label', defaultValue: 'Cancel' },
      { name: 'showCancel', type: 'boolean', label: 'Show Cancel Button', defaultValue: false },
      { 
        name: 'layout', 
        type: 'enum', 
        enum: ['vertical', 'horizontal'],
        label: 'Layout',
        defaultValue: 'vertical'
      },
      { 
        name: 'columns', 
        type: 'number', 
        label: 'Number of Columns',
        defaultValue: 1,
        description: 'For multi-column layouts (1-4)'
      },
      { 
        name: 'validationMode', 
        type: 'enum',
        enum: ['onSubmit', 'onBlur', 'onChange', 'onTouched', 'all'],
        label: 'Validation Mode',
        defaultValue: 'onSubmit'
      },
      { name: 'resetOnSubmit', type: 'boolean', label: 'Reset After Submit', defaultValue: false },
      { name: 'disabled', type: 'boolean', label: 'Disabled', defaultValue: false },
      { name: 'className', type: 'string', label: 'CSS Class' },
      { name: 'fieldContainerClass', type: 'string', label: 'Field Container CSS Class' }
    ],
    defaultProps: {
      submitLabel: 'Submit',
      cancelLabel: 'Cancel',
      showCancel: false,
      layout: 'vertical',
      columns: 1,
      validationMode: 'onSubmit',
      resetOnSubmit: false,
      disabled: false,
      fields: [
        {
          name: 'name',
          label: 'Name',
          type: 'input',
          required: true,
          placeholder: 'Enter your name',
        },
        {
          name: 'email',
          label: 'Email',
          type: 'input',
          inputType: 'email',
          required: true,
          placeholder: 'Enter your email',
        },
      ],
    },
  }
);

// Helper function to render field components with proper typing
interface RenderFieldProps {
  inputType?: string;
  options?: SelectOption[];
  placeholder?: string;
  value?: any;
  onChange?: (value: any) => void;
  disabled?: boolean;
  readonly?: boolean;
  [key: string]: any;
}

// Native date/time inputs only open their picker when the user clicks the tiny
// calendar/clock icon. For these types we open the picker on any click inside the
// box so they behave like the other field widgets (click-anywhere-to-edit).
const NATIVE_PICKER_INPUT_TYPES = new Set(['date', 'datetime-local', 'time', 'month', 'week']);

function openNativePickerOnClick(inputType: string | undefined) {
  if (!inputType || !NATIVE_PICKER_INPUT_TYPES.has(inputType)) return undefined;
  return (e: React.MouseEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    if (el.disabled || el.readOnly) return;
    try {
      (el as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
    } catch {
      // Browsers throw when the picker can't be shown; the native icon still works.
    }
  };
}

function renderFieldComponent(type: string, props: RenderFieldProps) {
  // 1. Try to resolve specialized field widget from registry first.
  //    Form fields should always prefer the `field:<type>` namespace when
  //    available (e.g. so { type: 'text' } in a form schema resolves to the
  //    text input field, not the display text widget that shares the same
  //    short name in the global registry).
  const RegisteredComponent = !BUILTIN_FIELD_TYPES.has(type)
    ? ((!type.includes(':') && ComponentRegistry.get(`field:${type}`)) ||
      ComponentRegistry.get(type))
    : undefined;

  if (RegisteredComponent) {
    const registeredProps = stripRegisteredFieldProps(type, props);
    const fieldSchema = props.field || props.schema || props;
    return <RegisteredComponent schema={fieldSchema} {...registeredProps} />;
  }

  const { inputType, options = [], placeholder, readonly, emptyHint, ...fieldProps } = props;
  const domFieldProps = stripRendererOnlyProps(fieldProps);
  // Text-like controls get a real readonly treatment (native `readOnly` +
  // a soft, non-"disabled" tint) instead of being grayed out. Toggle/choice
  // controls (checkbox/switch/select) have no meaningful "look but don't
  // touch" state of their own, so for those `readonly` falls back to disabled.
  const readonlyInputClass = readonly && 'bg-muted/40 cursor-default focus-visible:ring-0';

  switch (type) {
    case 'input':
      if (inputType === 'file') {
        // File inputs cannot be controlled with value prop
         const { value, ...fileProps } = domFieldProps;
         return <Input type="file" placeholder={placeholder} className="min-h-[44px] sm:min-h-0" {...fileProps} />;
      }
      return (
        <Input
          type={inputType || 'text'}
          placeholder={placeholder}
          className={cn('min-h-[44px] sm:min-h-0', readonlyInputClass)}
          {...domFieldProps}
          onClick={(e) => {
            openNativePickerOnClick(inputType)?.(e);
            domFieldProps.onClick?.(e);
          }}
          readOnly={readonly}
          value={domFieldProps.value ?? ''}
        />
      );

    case 'textarea': {
      const { mobile_fullscreen, fullscreen, label } = fieldProps as any;
      const { label: _label, ...rest } = stripRendererOnlyProps(fieldProps);
      if (mobile_fullscreen || fullscreen) {
        return (
          <FullscreenTextarea
            placeholder={placeholder}
            label={label}
            className="min-h-[44px] sm:min-h-0"
            {...rest}
            value={rest.value ?? ''}
          />
        );
      }
      return (
        <Textarea
          placeholder={placeholder}
          className={cn('min-h-[44px] sm:min-h-0', readonlyInputClass)}
          {...rest}
          readOnly={readonly}
          value={rest.value ?? ''}
        />
      );
    }

    case 'checkbox': {
      // For checkbox, we need to handle the value differently
      const { value, onChange, disabled: cbDisabled, ...checkboxProps } = domFieldProps;
      return (
        <Checkbox
          checked={value}
          onCheckedChange={onChange}
          disabled={cbDisabled || readonly}
          className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
          {...checkboxProps}
        />
      );
    }

    case 'switch': {
      // For switch, we need to handle the value differently (same as checkbox)
      const { value, onChange, disabled: swDisabled, ...switchProps } = domFieldProps;
      return (
        <Switch
          checked={value}
          onCheckedChange={onChange}
          disabled={swDisabled || readonly}
          className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
          {...switchProps}
        />
      );
    }

    case 'select': {
      // For select with react-hook-form, we need to handle the onChange
      const { value: selectValue, onChange: selectOnChange, disabled: selDisabled, ...selectProps } = domFieldProps;

      // Safety check for options. When a dependent (cascading) select is still
      // waiting on its controlling field the renderer passes a gate hint (#2284)
      // — surface that instead of the generic "no options" so the user knows to
      // pick the parent first rather than reading it as a broken widget.
      if (!options || options.length === 0) {
        return (
          <div className="text-sm text-muted-foreground">
            {emptyHint || 'No options available'}
          </div>
        );
      }

      return (
        <Select value={selectValue} onValueChange={selectOnChange} disabled={selDisabled || readonly} {...selectProps}>
          <SelectTrigger className="min-h-[44px] sm:min-h-0">
            <SelectValue placeholder={placeholder || 'Select an option'} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt: SelectOption) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    default:
      return (
        <Input
          type={inputType || 'text'}
          placeholder={placeholder}
          className={cn(readonlyInputClass)}
          {...domFieldProps}
          onClick={(e) => {
            openNativePickerOnClick(inputType)?.(e);
            domFieldProps.onClick?.(e);
          }}
          readOnly={readonly}
        />
      );
  }
}
