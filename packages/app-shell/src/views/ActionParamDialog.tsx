/**
 * ActionParamDialog — Collects user input for action parameters before execution.
 *
 * Renders each `ActionParamDef` through the SAME field-widget renderer the
 * object form uses (`@object-ui/fields` — `fieldWidgetMap` via
 * `getLazyFieldWidget`), so a declared action param of any form-supported
 * field type (`select`, `lookup`, `file`, `image`, `richtext`, `color`,
 * `date`, …) renders its real widget instead of collapsing to a text input
 * (ADR-0059). The param → field translation lives in the pure
 * `paramToField()` adapter; widgets stay lazy behind `<Suspense>` so opening
 * a dialog only loads the widgets its params actually use.
 *
 * Ambient context is relied on, not threaded: `UploadProvider` (file/image
 * uploads) and `SchemaRendererContext` (dataSource for lookup/user pickers)
 * come from the host view, exactly as the previous `LookupField` reuse did.
 *
 * Returns collected param values or null on cancel.
 */

import { Suspense, useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Label,
} from '@object-ui/components';
import { useObjectTranslation, pickLocalized } from '@object-ui/i18n';
import type { ActionParamDef } from '@object-ui/core';
import { ExpressionEvaluator } from '@object-ui/core';
import { usePredicateScope } from '@object-ui/react';
import { getLazyFieldWidget, fileIdOf, toDateTimeInputValue } from '@object-ui/fields';
import { paramToField } from '../utils/paramToField';

export interface ParamDialogState {
  open: boolean;
  params: ActionParamDef[];
  /** Dialog title — defaults to the generic "Action parameters" label when
   *  absent. Callers pass the action's own label (e.g. "Create environment")
   *  so the dialog reads as the task, not a generic param prompt. */
  title?: string;
  description?: string;
  resolve?: (value: Record<string, any> | null) => void;
}

interface ActionParamDialogProps {
  state: ParamDialogState;
  onOpenChange: (open: boolean) => void;
}

/**
 * Filter action params by their optional `visible` CEL predicate, evaluated
 * against the expression scope (features / user / app / data). A param with no
 * predicate is always kept; a predicate that throws defaults to visible (mirrors
 * the ExpressionProvider "auth config not loaded yet → visible" contract). Pure
 * + exported so the gating is unit-testable without the dialog render tree.
 */
export function filterVisibleParams(
  params: ActionParamDef[],
  scope: Record<string, any>,
): ActionParamDef[] {
  const evaluator = new ExpressionEvaluator(scope);
  return params.filter((p) => {
    if (!p.visible) return true;
    try {
      return evaluator.evaluateCondition(p.visible);
    } catch {
      return true;
    }
  });
}

/**
 * Serialize collected values for the request body. Upload widgets (`file` /
 * `image`) may hold a bare `sys_file` id — the reference form they now submit
 * when the adapter surfaces one — or a rich `{ file_id, name, url, … }` object,
 * or an array of either when `multiple`. The portable API contract is the
 * storage id(s), so each upload param is reduced to its id via `fileIdOf`, the
 * same extractor the field widgets use, so the two surfaces cannot drift on
 * what counts as an id. An object carrying no id is left intact, so the failure
 * is visible rather than silently POSTing `undefined`. Every non-upload value is
 * returned as-is. Pure + exported so the mapping is unit-testable without the
 * dialog render tree.
 *
 * `datetime` params are converted back to the control's zone-less local wall
 * clock (`YYYY-MM-DDTHH:mm`) — the shape this endpoint contract pins (#2714).
 * `DateTimeField` is ISO-canonical on both sides since objectui#3127: it has to
 * be, because a record's stored value arrives as an ISO instant and the control
 * silently rejects that shape, so read and write must share one basis or a
 * UTC+8 user picking 08:33 would store `08:33Z`. Action params have no stored
 * value to read, so that widget-level basis is invisible here — but its ISO
 * output would still reach endpoints that were built against the naive string.
 * Converting at this boundary keeps the widget coherent AND the wire shape
 * byte-identical; moving action params onto ISO is a contract change of its own
 * and belongs in its own ticket, not in a display-bug fix.
 */
export function serializeParamValues(
  params: ActionParamDef[],
  values: Record<string, any>,
): Record<string, any> {
  const uploadNames = new Set<string>();
  const datetimeNames = new Set<string>();
  for (const p of params) {
    const t = paramToField(p).type;
    if (t === 'file' || t === 'image') uploadNames.add(p.name);
    else if (t === 'datetime') datetimeNames.add(p.name);
  }
  if (uploadNames.size === 0 && datetimeNames.size === 0) return values;
  const toId = (item: any) => fileIdOf(item) ?? item;
  const out: Record<string, any> = { ...values };
  for (const name of uploadNames) {
    const v = out[name];
    if (v == null) continue;
    out[name] = Array.isArray(v) ? v.map(toId) : toId(v);
  }
  for (const name of datetimeNames) {
    const v = out[name];
    if (v == null || v === '') continue;
    // An unconvertible value is left intact rather than blanked — the same
    // failure-visible rule the upload branch above follows.
    out[name] = toDateTimeInputValue(v) || v;
  }
  return out;
}

/** Skeleton shown while a lazy field widget's chunk loads. */
function WidgetFallback() {
  return <div className="h-9 w-full animate-pulse rounded-md bg-muted" aria-hidden="true" />;
}

export function ActionParamDialog({ state, onOpenChange }: ActionParamDialogProps) {
  const { t, language } = useObjectTranslation();
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  // Params whose upload widget (file/image) is mid-upload. Confirm stays
  // disabled while any is in flight so a param can't be submitted before its
  // fileId resolves (the value is only the fileId once the upload settles).
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const anyUploading = Object.values(uploading).some(Boolean);

  // A param may carry a `visible` predicate (CEL) gating it on the same scope as
  // action visibility (features / user / app / data) — e.g. `create_user`'s
  // phoneNumber param is `features.phoneNumber == true`, so the form never offers
  // a field the backend rejects. Absent = visible; a predicate that errors
  // defaults to visible (mirrors the ExpressionProvider "config not loaded" note).
  const scope = usePredicateScope();
  const visibleParams = useMemo(() => filterVisibleParams(state.params, scope), [state.params, scope]);

  // Reset values when params change
  useEffect(() => {
    if (state.open) {
      const defaults: Record<string, any> = {};
      for (const param of visibleParams) {
        if (param.defaultValue !== undefined) {
          defaults[param.name] = param.defaultValue;
        }
      }
      setValues(defaults);
      setErrors({});
      setUploading({});
    }
  }, [state.open, visibleParams]);

  const isMissingValue = (value: unknown): boolean => {
    if (value === undefined || value === null) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    // Boolean false is a VALID value — only treat undefined/null as missing.
    if (typeof value === 'boolean') return false;
    return false;
  };

  const handleSubmit = () => {
    // An upload is still in flight — the param value isn't its fileId yet, so
    // block the submit (Confirm is also disabled; this guards keyboard submit).
    if (anyUploading) return;
    // Validate required fields
    const newErrors: Record<string, boolean> = {};
    for (const param of visibleParams) {
      if (param.required && isMissingValue(values[param.name])) {
        newErrors[param.name] = true;
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    // Map upload params (file/image) from their rich widget objects to the
    // storage id(s) the API expects before resolving.
    state.resolve?.(serializeParamValues(visibleParams, values));
    onOpenChange(false);
  };

  const handleCancel = () => {
    state.resolve?.(null);
    onOpenChange(false);
  };

  const updateValue = (name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: false }));
  };

  return (
    <Dialog open={state.open} onOpenChange={(open) => {
      if (!open) handleCancel();
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state.title || t('actionDialog.title')}</DialogTitle>
          <DialogDescription>
            {state.description || t('actionDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {visibleParams.map((rawParam) => {
            const param = {
              ...rawParam,
              label: pickLocalized(rawParam.label, language),
              helpText: rawParam.helpText != null ? pickLocalized(rawParam.helpText, language) : rawParam.helpText,
              options: rawParam.options?.map((o) => ({ ...o, label: pickLocalized(o.label, language) })),
            };
            const field = paramToField(param);
            const Widget = getLazyFieldWidget(field.type);
            // Only upload widgets emit upload-in-progress; wiring the callback
            // to non-upload widgets would spread an unknown prop toward the DOM.
            const isUploadWidget = field.type === 'file' || field.type === 'image';
            const uploadProps = isUploadWidget
              ? { onUploadingChange: (u: boolean) => setUploading((prev) => ({ ...prev, [param.name]: u })) }
              : {};
            // A lookup-typed param that fell back to text (no referenceTo)
            // keeps the "paste an ID" placeholder/help hints.
            const isLookupParam = param.type === 'lookup' || param.type === 'reference';
            if (field.type === 'select' && !field.placeholder) {
              field.placeholder = t('actionDialog.selectPlaceholder', { label: param.label });
            }
            if (isLookupParam && field.type === 'text' && !field.placeholder) {
              field.placeholder = t('actionDialog.lookupPlaceholder', { label: param.label });
            }

            // Boolean → inline checkbox row (label sits beside the control
            // instead of above it; help text appears underneath).
            if (field.type === 'boolean') {
              return (
                <div key={param.name} className="grid gap-1">
                  <div className="flex items-start gap-2">
                    <Suspense fallback={<div className="size-4 mt-0.5 animate-pulse rounded-sm bg-muted" aria-hidden="true" />}>
                      <Widget
                        value={values[param.name] === true}
                        onChange={(checked: unknown) => updateValue(param.name, checked === true)}
                        field={field}
                        className="mt-0.5"
                        // Required is a STATE, so it rides the state channel to the
                        // control (objectui#3299, same shape as #3290/#3298). The
                        // widget's `toDomProps` whitelist forwards `aria-*` by
                        // prefix, so this lands on the rendered control. `|| undefined`
                        // so an optional param carries no attribute at all.
                        aria-required={param.required || undefined}
                      />
                    </Suspense>
                    <Label htmlFor={param.name} className="font-normal cursor-pointer">
                      {param.label}
                      {/* Visual-only: the state is announced via `aria-required` on
                          the control; without `aria-hidden` the bare `*` would fold
                          into the accessible name ("Label asterisk"). */}
                      {param.required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
                    </Label>
                  </div>
                  {errors[param.name] && (
                    <p className="text-xs text-destructive ml-6">{t('actionDialog.requiredError', { label: param.label })}</p>
                  )}
                  {param.helpText && (
                    <p className="text-xs text-muted-foreground ml-6">{param.helpText}</p>
                  )}
                </div>
              );
            }

            return (
            <div key={param.name} className="grid gap-2">
              <Label htmlFor={param.name}>
                {param.label}
                {/* Visual-only (objectui#3299): `aria-required` on the widget is
                    the announced channel; hiding the `*` keeps it out of the
                    control's accessible name. */}
                {param.required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
              </Label>

              <Suspense fallback={<WidgetFallback />}>
                <Widget
                  id={param.name}
                  value={values[param.name] ?? null}
                  onChange={(v: unknown) => updateValue(param.name, v)}
                  field={field}
                  className={errors[param.name] ? 'border-destructive' : ''}
                  // State channel for required (objectui#3299) — deliberately NOT
                  // the native `required` attribute (#3290 ruling: that would arm
                  // the browser's constraint-validation bubble alongside the
                  // dialog's own `requiredError` messages — two validators, one
                  // field). Widgets forward `aria-*` via their `toDomProps`
                  // whitelist, so this reaches the real control.
                  aria-required={param.required || undefined}
                  {...uploadProps}
                />
              </Suspense>

              {errors[param.name] && (
                <p className="text-xs text-destructive">{t('actionDialog.requiredError', { label: param.label })}</p>
              )}
              {param.helpText && (
                <p className="text-xs text-muted-foreground">{param.helpText}</p>
              )}
              {isLookupParam && field.type === 'text' && !param.helpText && (
                <p className="text-xs text-muted-foreground">
                  {t('actionDialog.lookupHelpText')}
                </p>
              )}
            </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>{t('actionDialog.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={anyUploading}>
            {anyUploading ? t('actionDialog.uploading') : t('actionDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
