// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ScreenView — the presentational body of a flow `screen` (framework
 * screen-flow runtime, ADR-0019): the flat input-field list OR the named
 * object's full create/edit form.
 *
 * Extracted from {@link FlowRunner} so the exact same renderer drives both the
 * runtime (paused screen-flow → collect input → resume) and the Studio design
 * preview ({@link ScreenPreview}). Keeping ONE renderer is deliberate: a
 * separate preview reimplementation would drift from runtime — the
 * simulator-vs-engine divergence fixed in #1927.
 *
 * It owns no submit/resume behaviour and no Dialog chrome — the caller frames
 * it (the runtime wraps it in a Dialog + footer and resumes the run; the
 * preview wraps it in a card and hides the persist bar).
 */
import {
  Input,
  Label,
  Textarea,
  Checkbox,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  cn,
} from '@object-ui/components';
import { ObjectForm } from '@object-ui/plugin-form';
import { evalFieldPredicate } from '@object-ui/core';

/**
 * The screen-pause contract is OWNED by `@objectstack/spec/contracts`
 * (objectstack#4115) — the server emits it, this dialog renders it.
 *
 * `ScreenFieldSpec` is re-exported verbatim: the local copy was byte-equivalent
 * (including `visibleWhen`, ADR-0089's canonical spelling), so there was
 * nothing to keep.
 */
export type { ScreenFieldSpec } from '@objectstack/spec/contracts';

import type {
  ScreenFieldSpec,
  ScreenSpec as SpecScreenSpec,
} from '@objectstack/spec/contracts';

/**
 * The spec's screen contract with ONE deliberate widening: `fields` is optional
 * here and required there.
 *
 * Derived structurally from `SpecScreenSpec` so every other key — and any key
 * the spec adds later — arrives automatically; only the documented divergence
 * is spelled out. An `object-form` step, or a message-only screen emitted by a
 * third-party node executor, legitimately carries no `fields` array, and an
 * absent `fields` used to throw the moment the dialog opened. Every read goes
 * through {@link screenFields} rather than touching the array directly, so the
 * widening cannot leak into rendering or `required` enforcement (#3528).
 *
 * If the spec ever makes `fields` optional itself, this alias collapses to a
 * plain re-export — `__tests__/spec-symbol-parity.test.ts` fails on that day and says so.
 */
export type ScreenSpec = Omit<SpecScreenSpec, 'fields'> & { fields?: ScreenFieldSpec[] };

/** Whether a screen renders the object-form body rather than the flat fields. */
export function isObjectFormScreen(screen: ScreenSpec): boolean {
  return screen.kind === 'object-form' && !!screen.objectName;
}

/** The screen's input fields — always an array, even when the payload omits them. */
export function screenFields(screen: ScreenSpec): ScreenFieldSpec[] {
  return Array.isArray(screen.fields) ? screen.fields : [];
}

/**
 * The fields actually on screen for the values collected so far — i.e. every
 * field whose `visibleWhen` predicate holds (or that declares none).
 *
 * This is the list callers must use for BOTH rendering and `required`
 * enforcement. Splitting them is the #3528 dead-end: validate the full list
 * while rendering a subset and Submit blocks on a field the user was never
 * shown, with no resume request ever issued.
 *
 * The predicate is bare CEL over the screen's own field names
 * (`createOpportunity == true`), evaluated through the canonical
 * `@objectstack/formula` engine — the same verdict the server reaches for
 * field rules. Values are bound both bare and under `record.`, so either
 * spelling resolves. A broken predicate **fails open** (field stays visible),
 * matching `resolveFieldRuleState`: hiding an input on a typo would silently
 * drop data the flow is waiting for.
 */
export function visibleScreenFields(
  screen: ScreenSpec,
  values: Record<string, unknown>,
): ScreenFieldSpec[] {
  const scope = screenPredicateScope(screen, values);
  return screenFields(screen).filter((f) =>
    f.visibleWhen
      ? evalFieldPredicate(f.visibleWhen, scope, true, undefined, scope, {
          context: `visibleWhen of screen field '${f.name}'`,
        })
      : true,
  );
}

/**
 * The scope a screen's `visibleWhen` predicates evaluate against: every
 * DECLARED field bound to its collected value, or to a known-empty one when
 * the user has not touched it yet.
 *
 * Seeding matters. An untouched checkbox holds `undefined`, and to CEL an
 * unbound name is an *unknown identifier* — the evaluation errors and
 * `evalFieldPredicate` falls open, leaving `createOpportunity == true` fields
 * on screen precisely in the state where they should be hidden. Binding the
 * declared names makes the predicate resolve to a real `false` instead.
 *
 * Fail-open is still the behaviour we want for a genuinely broken predicate —
 * a syntax error, or a name that is not a field on this screen. Seeding only
 * the declared names keeps that split intact.
 */
function screenPredicateScope(
  screen: ScreenSpec,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const scope: Record<string, unknown> = {};
  for (const f of screenFields(screen)) {
    const t = (f.type || 'text').toLowerCase();
    scope[f.name] = t === 'boolean' || t === 'checkbox' ? false : null;
  }
  for (const [k, v] of Object.entries(values)) if (v !== undefined) scope[k] = v;
  return scope;
}

/** Seed flat-field values from each field's `defaultValue`. */
export function initialScreenValues(screen: ScreenSpec): Record<string, unknown> {
  const v: Record<string, unknown> = {};
  for (const f of screenFields(screen)) if (f.defaultValue !== undefined) v[f.name] = f.defaultValue;
  return v;
}

/** Submit/cancel wiring for the object-form body — runtime persists & resumes;
 *  the design preview hides the bar (`showSubmit`/`showCancel` false). */
export interface ScreenObjectFormActions {
  showSubmit?: boolean;
  showCancel?: boolean;
  submitText?: string;
  cancelText?: string;
  onSuccess?: (saved: any) => void;
  onCancel?: () => void;
  /** Overrides the "no data source" copy (the preview phrases it for authors). */
  noDataSourceMessage?: React.ReactNode;
}

export interface ScreenViewProps {
  screen: ScreenSpec;
  /** Controlled values for the flat-fields body. */
  values: Record<string, unknown>;
  onValueChange: (name: string, value: unknown) => void;
  /**
   * Data source — required to render the `object-form` body. ObjectForm fetches
   * the object schema (and persists) through this adapter.
   */
  dataSource?: any;
  /**
   * Object definitions — used to derive an `object-form` step's inline
   * master-detail `subforms` (mirrors RecordFormPage's create form).
   */
  objects?: any[];
  objectForm?: ScreenObjectFormActions;
  className?: string;
}

export function ScreenView({ screen, values, onValueChange, dataSource, objects, objectForm, className }: ScreenViewProps) {
  if (isObjectFormScreen(screen)) {
    const objectDef = Array.isArray(objects) ? objects.find((o: any) => o?.name === screen.objectName) : undefined;
    const subforms = objectDef
      ? ((objectDef as any).form?.subforms ?? (objectDef as any).formViews?.default?.subforms)
      : undefined;
    // Full object create/edit form (with inline master-detail grids). At runtime
    // the form owns its own Save/Cancel bar; the preview hides it.
    return (
      <div className={cn('py-2', className)}>
        {dataSource ? (
          <ObjectForm
            key={screen.nodeId}
            schema={{
              type: 'object-form',
              formType: 'simple',
              objectName: screen.objectName!,
              mode: screen.mode === 'edit' ? 'edit' : 'create',
              recordId: screen.mode === 'edit' ? screen.recordId : undefined,
              ...(screen.defaults ? { initialValues: screen.defaults } : {}),
              layout: 'vertical',
              subforms,
              onSuccess: objectForm?.onSuccess,
              onCancel: objectForm?.onCancel,
              showSubmit: objectForm?.showSubmit ?? true,
              showCancel: objectForm?.showCancel ?? true,
              submitText: objectForm?.submitText ?? 'Save & Continue',
              cancelText: objectForm?.cancelText ?? 'Cancel',
            } as any}
            dataSource={dataSource}
          />
        ) : (
          <div className="text-sm text-destructive py-4">
            {objectForm?.noDataSourceMessage ?? 'This step renders an object form but no data source is available.'}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4 py-2', className)}>
      {visibleScreenFields(screen, values).map((f) => (
        <div key={f.name} className="space-y-1.5">
          <Label htmlFor={`ff-${f.name}`} className="text-sm">
            {f.label || f.name}
            {f.required && <span className="text-destructive"> *</span>}
          </Label>
          <ScreenFieldInput field={f} value={values[f.name]} onChange={(v) => onValueChange(f.name, v)} />
        </div>
      ))}
    </div>
  );
}

/**
 * One screen field's edit control.
 *
 * Named `ScreenFieldInput`, not `FieldInput`: `@objectstack/spec/data` already
 * exports a `FieldInput` type — the authoring shape of an object FIELD
 * (`Omit<Partial<Field>, 'type'>`) — which has nothing to do with this React
 * component. Two unrelated things under one name is the objectstack#4115
 * defect; `__tests__/spec-symbol-parity.test.ts` pins that the spec does not own
 * this name.
 */
export function ScreenFieldInput({ field, value, onChange }: { field: ScreenFieldSpec; value: unknown; onChange: (v: unknown) => void }) {
  const id = `ff-${field.name}`;
  const t = (field.type || 'text').toLowerCase();

  if (Array.isArray(field.options) && field.options.length > 0) {
    return (
      <Select value={value != null ? String(value) : undefined} onValueChange={(v) => onChange(v)}>
        <SelectTrigger id={id}><SelectValue placeholder={field.placeholder || 'Select…'} /></SelectTrigger>
        <SelectContent>
          {field.options.map((o, i) => (
            <SelectItem key={i} value={String(o.value)}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (t === 'boolean' || t === 'checkbox') {
    return <Checkbox id={id} checked={value === true} onCheckedChange={(c) => onChange(c === true)} />;
  }
  if (t === 'textarea' || t === 'markdown') {
    return <Textarea id={id} value={(value as string) ?? ''} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
  }
  const htmlType = t === 'number' || t === 'currency' ? 'number' : t === 'email' ? 'email' : t === 'date' ? 'date' : 'text';
  return (
    <Input
      id={id}
      type={htmlType}
      value={(value as string) ?? ''}
      placeholder={field.placeholder}
      onChange={(e) => onChange(htmlType === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value)}
    />
  );
}
