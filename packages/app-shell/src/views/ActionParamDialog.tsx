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
 * One thing is threaded rather than ambient, and deliberately so: the record an
 * option widget resolves its per-option `visibleWhen` against. The dialog is a
 * small form, so its own in-progress `values` are that record — for WHICH
 * widgets receive it, see `CASCADE_OPTION_WIDGET_TYPES` in `@object-ui/core`
 * (objectui#3765; shared with the form and the bulk dialog per objectui#4770).
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
import {
  evalRowPredicate,
  hasDeclaredPredicate,
  // The shared allow-table of widgets that are fed the dialog's own values as
  // their record — one definition for this dialog, the object form and the bulk
  // dialog (objectui#4770). Its TSDoc carries the rationale that used to be
  // repeated in each of the three copies.
  CASCADE_OPTION_WIDGET_TYPES,
} from '@object-ui/core';
import { usePredicateScope } from '@object-ui/react';
import { getLazyFieldWidget, fileIdOf } from '@object-ui/fields';
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
 * Filter action params by their optional `visible` predicate, evaluated on the
 * canonical entry (`evalRowPredicate`) against the host predicate scope
 * (features / user / app / data). Pure + exported so the gating is unit-testable
 * without the dialog render tree.
 *
 * ## Fail-open, and LOUD (objectui#4640)
 *
 * A param whose `visible` cannot be evaluated — unparseable source, unbound
 * identifier, a key the scope does not carry — is SHOWN, and says so once, with
 * the action and param named and the predicate quoted. Both halves are ruled,
 * not chosen here:
 *
 *  - **Loud** is the standing 2026-08-06 ruling on objectui#4051 /
 *    objectstack#5149: fail-open or fail-closed may be chosen, *silent may not*.
 *    This function used to be silent in three of the four fault shapes — the
 *    bare `catch { return true }` below the old `evaluateCondition` call swallowed
 *    parse errors and unbound identifiers without a word, so a broken predicate
 *    was indistinguishable from an absent one.
 *  - **Open** is the direction ruled for THIS surface: a silently dropped param
 *    is the undiagnosable failure — the dialog never collects a value the server
 *    requires, and the action then fails at submit with nothing pointing at the
 *    predicate. An extra offered field fails the other way, with a server
 *    rejection that carries a message. Two harms; the self-diagnosing one wins.
 *    (Row surfaces rule the opposite way — a faulting row-action `visible` stays
 *    hidden — because there the harm is acting on records the predicate excluded.)
 *
 * ## One value, one answer (objectui#3314)
 *
 * The old implementation's fail DIRECTION was decided by the predicate's
 * DIALECT, not by this surface: a bare string ran the legacy JS evaluator
 * (lenient → falsy → param silently DROPPED) while a `{ dialect, source }`
 * envelope ran CEL (fault → param silently KEPT). One `visible` key, two
 * opposite outcomes, chosen by whether the authored text happened to contain
 * `${…}` / `===`. That fork is deleted, not braced: every spelling now reaches
 * one entry, one fail direction and one warning. (`evalRowPredicate` still
 * routes a legacy-dialect STRING to the old engine for back-compat — with its
 * own deprecation warning naming the predicate — but the fault direction is the
 * same on both of its paths, so the surface no longer has two answers.)
 *
 * ## No row here — the scope keeps its own `data` / `record`
 *
 * `evalRowPredicate`'s subject is a row, and it pins `record` / `data` to it
 * over the host scope (objectui#3796). This surface has no row: its scope IS the
 * host predicate scope, `data` and all. So it passes `rowless: true`, which
 * binds nothing over the scope — an author's `data.*` / `record.*` param
 * predicate keeps reading the host's values instead of faulting on an empty
 * object written over them.
 *
 * @param actionLabel The action's own label, so the fault warning names the
 *                    action as well as the param. Optional — the param name
 *                    alone is still a locator.
 */
export function filterVisibleParams(
  params: ActionParamDef[],
  scope: Record<string, any>,
  actionLabel?: string,
): ActionParamDef[] {
  return params.filter((p) => {
    const raw: unknown = p.visible;
    // "Is a gate declared?" is asked once, by the canonical definition —
    // absent, `''`, whitespace-only, an empty `{ dialect, source: '' }` envelope
    // (what a spec-normalized empty predicate compiles to) and junk all mean
    // "no gate", and must not reach the evaluator to be reported as a fault.
    if (!hasDeclaredPredicate(raw)) return true;
    // A BOOLEAN `visible` is a verdict, not an expression — short-circuited the
    // same way `useRowPredicate` / the row kebab / `bulkEligibility` do
    // (objectui#3492). Handing it to the engine yields
    // `{ dialect: 'cel', source: undefined }`, which faults; on this surface's
    // fail-open that would turn `visible: false` — the most explicit "never
    // offer this" an author can write — into a shown param plus a bogus warning.
    if (typeof raw === 'boolean') return raw;
    return evalRowPredicate(raw as never, null, {
      fallback: true,
      scope,
      rowless: true,
      warnOnError: true,
      label: actionLabel
        ? `param "${p.name}" of action "${actionLabel}"`
        : `param "${p.name}"`,
    });
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
 * `datetime` params pass through here untouched, and that is the fix for
 * objectstack#5061 — the previous version of this function converted them back
 * to the control's zone-less local wall clock (`YYYY-MM-DDTHH:mm`), which is
 * the one shape the platform's `datetime` value contract REJECTS. Since 17.0
 * the dispatcher validates a params bag against the action's declaration before
 * the handler runs (ADR-0104 D2, `validateActionParams` →
 * `InstantValueSchema`), and that contract is an ISO-8601 instant with an
 * explicit zone. A zone-less wall clock earned a 400 on every UI submission, so
 * no value a user could pick could pass: the renderer and the validator wanted
 * disjoint shapes.
 *
 * No conversion is needed at this boundary, because `DateTimeField` is already
 * ISO-canonical on both sides (objectui#3127/#3565): it takes the record's ISO
 * instant in, and hands an ISO instant back out — seconds and milliseconds
 * included, zone explicit. #3565 added the back-conversion to keep the wire
 * shape byte-identical while it fixed a display bug, and said so: moving action
 * params onto ISO is a contract change of its own. objectstack#5061 is that
 * change, and it only removes the conversion — every param value the dialog can
 * hold is already zoned (widget output, or a `defaultFromRow` seed read from a
 * stored instant). Deliberately NOT normalized here: an authored
 * `defaultValue` written as a zone-less wall clock. That value is ambiguous
 * metadata (whose zone?), the spec types it `unknown` so nothing rejects it at
 * authoring time yet, and coercing it in the renderer would make it "work" in
 * the UI while the identical literal still 400s from REST/MCP — the worst split
 * to debug. It stays loud until the spec validates a param default against the
 * param's own value contract (objectstack#6970).
 */
export function serializeParamValues(
  params: ActionParamDef[],
  values: Record<string, any>,
): Record<string, any> {
  const uploadNames = new Set<string>();
  for (const p of params) {
    const t = paramToField(p).type;
    if (t === 'file' || t === 'image') uploadNames.add(p.name);
  }
  if (uploadNames.size === 0) return values;
  const toId = (item: any) => fileIdOf(item) ?? item;
  const out: Record<string, any> = { ...values };
  for (const name of uploadNames) {
    const v = out[name];
    if (v == null) continue;
    out[name] = Array.isArray(v) ? v.map(toId) : toId(v);
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
  // a field the backend rejects. Absent = visible; a predicate that cannot be
  // evaluated is shown AND reported once, naming this action and the param
  // (objectui#4640) — `state.title` is the action's own label, so the console
  // line points at the dialog the user is looking at.
  const scope = usePredicateScope();
  const visibleParams = useMemo(
    () => filterVisibleParams(state.params, scope, state.title),
    [state.params, scope, state.title],
  );

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
          {/* `whitespace-pre-line` so a description composed of more than one
              paragraph renders as authored. objectui#5178 puts an admin-override
              warning ahead of the action's declared description here; collapsed
              to one run-on paragraph the warning stops reading as a warning. */}
          <DialogDescription className="whitespace-pre-line">
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
            // The dialog's own in-progress values ARE the record its option
            // predicates are resolved against (objectui#3765, maintainer ruling
            // 2026-08-11, Option B: "the dialog is a small form"). Until this
            // prop existed the dialog passed nothing, so `useCascadingOptions`
            // fell through to `SchemaRendererContext`'s `formValues` / `data` —
            // the OUTER page's record — and a `visibleWhen` written against a
            // sibling PARAM could never see the value the user had just picked
            // in this same dialog. The evaluator is untouched: it already reads
            // `dependentValues ?? formValues ?? data`; this is the supply half
            // that was missing.
            //
            // Ruled cost, recorded rather than worked around: because a
            // supplied record wins that chain outright, a predicate naming a
            // ROW field the dialog has no param for (`record.owner_id`) no
            // longer resolves against the host page here. It becomes
            // unresolvable, which `resolveVisibleOptions` fails OPEN — the
            // option is offered, never wrongly hidden. Merging the two records
            // (`{ ...row, ...values }`) was option C on the card and was NOT
            // ruled: it invents a third scope dialect that would have to be
            // written into the contract first.
            const cascadeProps = CASCADE_OPTION_WIDGET_TYPES.has(field.type)
              ? { dependentValues: values }
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
                        // The HOST owns the control id (objectui#3962), exactly
                        // as the generic branch below does. Omitting it made
                        // this branch's `<Label htmlFor>` association IMPLICIT:
                        // it only resolved because `BooleanField`'s id fallback
                        // chain reaches `config.name`, which `paramToField`
                        // seeds from `param.name` — a host living off another
                        // package's fallback. Worse, a widget that receives no
                        // host id cannot know the host already rendered a label,
                        // so it emitted its own `sr-only` copy too, and two
                        // label elements referencing one control CONCATENATE
                        // into the accessible name (accname §2D): the checkbox
                        // announced "Confirm This Confirm This". Passing the id
                        // makes the association explicit and suppresses the
                        // duplicate (PR #3959's `emitOwnLabel = !hostId`).
                        id={param.name}
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
                  {...cascadeProps}
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
