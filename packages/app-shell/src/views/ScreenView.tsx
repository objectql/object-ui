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

export interface ScreenFieldSpec {
  name: string;
  label?: string;
  type?: string;
  required?: boolean;
  options?: Array<{ value: unknown; label: string }>;
  defaultValue?: unknown;
  placeholder?: string;
}
export interface ScreenSpec {
  nodeId: string;
  title?: string;
  description?: string;
  fields: ScreenFieldSpec[];
  /**
   * `'object-form'` renders the named object's FULL create/edit form — incl.
   * inline master-detail child grids — as a wizard step (vs. the flat `fields`
   * list). The form persists the record (and its children, atomically) itself,
   * then resumes the run with the saved id bound to `idVariable`.
   */
  kind?: 'fields' | 'object-form';
  objectName?: string;
  mode?: 'create' | 'edit';
  recordId?: string;
  defaults?: Record<string, unknown>;
  idVariable?: string;
}

/** Whether a screen renders the object-form body rather than the flat fields. */
export function isObjectFormScreen(screen: ScreenSpec): boolean {
  return screen.kind === 'object-form' && !!screen.objectName;
}

/** Seed flat-field values from each field's `defaultValue`. */
export function initialScreenValues(screen: ScreenSpec): Record<string, unknown> {
  const v: Record<string, unknown> = {};
  for (const f of screen.fields) if (f.defaultValue !== undefined) v[f.name] = f.defaultValue;
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
      {screen.fields.map((f) => (
        <div key={f.name} className="space-y-1.5">
          <Label htmlFor={`ff-${f.name}`} className="text-sm">
            {f.label || f.name}
            {f.required && <span className="text-destructive"> *</span>}
          </Label>
          <FieldInput field={f} value={values[f.name]} onChange={(v) => onValueChange(f.name, v)} />
        </div>
      ))}
    </div>
  );
}

export function FieldInput({ field, value, onChange }: { field: ScreenFieldSpec; value: unknown; onChange: (v: unknown) => void }) {
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
